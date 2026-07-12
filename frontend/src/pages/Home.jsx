import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { api } from "../lib/api";
import ExportModal from "../components/ExportModal";
import { ProgressBar, QuestionCard } from "../components/QuestionCard";
import QuizAnalysis, { DifficultyDashboard } from "../components/QuizAnalysis";

// --- Main Home Component ---

export default function Home() {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState([]);              // [{ id, name, status, error, text, topics, chunks, pdfUrl }]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [extractedText, setExtractedText] = useState("");
  const [topics, setTopics] = useState([]);            // detected topic chunks from all PDFs
  const [chunks, setChunks] = useState([]);            // paragraph-level chunks from all PDFs
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfModalQuestion, setPdfModalQuestion] = useState(null);
  
  const [selectedTopicIds, setSelectedTopicIds] = useState(new Set());
  const [weightedMode, setWeightedMode] = useState(false);
  const [topicWeights, setTopicWeights] = useState({});  // { topicId: 1-10 }
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1); // -1: Config, >=0: Play
  const [userAnswers, setUserAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const quizStartedAtRef = useRef(null);
  const [quizDurationSec, setQuizDurationSec] = useState(null);
  const docsRef = useRef([]);

  // Configuration state
  const [questionType, setQuestionType] = useState("mixed");
  const [difficulty, setDifficulty] = useState("mixed");
  const [count, setCount] = useState("5");
  const [customCount, setCustomCount] = useState("");

  // ── Multi-document helpers ─────────────────────────────────────────────────
  const readyDocs = files.filter((d) => d.text);
  const pdfNames = readyDocs.map((d) => d.name);
  const primaryName = files[0]?.name || "Document";

  const syncFiles = () => setFiles([...docsRef.current]);

  /** Rebuild combined source text / topics / chunks from the current documents. */
  const rebuildFromDocs = (docs) => {
    const text = docs.filter((d) => d.text).map((d) => d.text).join("\n\n");
    const detected = docs.flatMap((d) => d.topics || []);
    setExtractedText(text);
    setTopics(detected);
    setChunks(docs.flatMap((d) => d.chunks || []));
    setSelectedTopicIds(new Set(detected.map((t) => t.id)));
    const defaultWeights = {};
    detected.forEach((t) => { defaultWeights[t.id] = 5; });
    setTopicWeights(defaultWeights);
    setWeightedMode(false);
    // Documents changed — any generated quiz is stale
    setQuizQuestions([]);
    setCurrentQuestionIndex(-1);
    setUserAnswers({});
    setScore(null);
    setReviewMode(false);
    setSessionId(null);
    quizStartedAtRef.current = null;
    setQuizDurationSec(null);
  };

  const handleFiles = async (fileList) => {
    const incoming = Array.from(fileList || []).filter(
      (f) => f.type === "application/pdf" && !docsRef.current.some((d) => d.name === f.name)
    );
    if (incoming.length === 0) {
      setError("Please add a valid PDF file (or it is already in the list).");
      return;
    }
    setError("");

    const newDocs = incoming.map((f) => ({
      id: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      raw: f,
      status: "processing",
      error: "",
      text: "",
      topics: [],
      chunks: [],
      pdfUrl: URL.createObjectURL(f),
    }));

    docsRef.current = [...docsRef.current, ...newDocs];
    syncFiles();
    setLoading(true);

    // Process documents with limited concurrency (2 at a time) so large PDFs
    // don't block the UI and multiple files are handled efficiently.
    const queue = [...newDocs];
    const worker = async () => {
      while (queue.length > 0) {
        const doc = queue.shift();
        try {
          const res = await api.extractPdfs([doc.raw]);
          const d = res.documents?.[0];
          const idx = docsRef.current.findIndex((x) => x.id === doc.id);
          if (idx >= 0) {
            docsRef.current[idx] = d?.text
              ? { ...docsRef.current[idx], status: "ready", text: d.text, topics: d.topics || [], chunks: d.chunks || [] }
              : { ...docsRef.current[idx], status: "error", error: "No extractable text found in this PDF." };
          }
        } catch (err) {
          const idx = docsRef.current.findIndex((x) => x.id === doc.id);
          if (idx >= 0) docsRef.current[idx] = { ...docsRef.current[idx], status: "error", error: err.message || "Failed to extract text from PDF." };
        }
        syncFiles();
      }
    };
    await Promise.all(Array.from({ length: Math.min(2, newDocs.length) }, worker));
    setLoading(false);
    rebuildFromDocs(docsRef.current.filter((d) => d.text));
  };

  const removeDoc = (id) => {
    const doc = docsRef.current.find((x) => x.id === id);
    if (doc?.pdfUrl) URL.revokeObjectURL(doc.pdfUrl);
    docsRef.current = docsRef.current.filter((x) => x.id !== id);
    syncFiles();
    rebuildFromDocs(docsRef.current.filter((d) => d.text));
  };

  const retryDoc = async (id) => {
    const idx = docsRef.current.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const doc = docsRef.current[idx];
    if (!doc.raw) return;
    docsRef.current[idx] = { ...doc, status: "processing", error: "" };
    syncFiles();
    setLoading(true);
    try {
      const res = await api.extractPdfs([doc.raw]);
      const d = res.documents?.[0];
      const i2 = docsRef.current.findIndex((x) => x.id === id);
      if (i2 >= 0) {
        docsRef.current[i2] = d?.text
          ? { ...docsRef.current[i2], status: "ready", text: d.text, topics: d.topics || [], chunks: d.chunks || [] }
          : { ...docsRef.current[i2], status: "error", error: "No extractable text found in this PDF." };
      }
    } catch (err) {
      const i2 = docsRef.current.findIndex((x) => x.id === id);
      if (i2 >= 0) docsRef.current[i2] = { ...docsRef.current[i2], status: "error", error: err.message || "Failed to extract text from PDF." };
    }
    syncFiles();
    setLoading(false);
    rebuildFromDocs(docsRef.current.filter((d) => d.text));
  };

  // ── Topic helpers ──────────────────────────────────────────────────────────
  const showTopicSelector = topics.length > 1;
  const selectedTopics = topics.filter((t) => selectedTopicIds.has(t.id));
  const selectedCharCount = selectedTopics.reduce((s, t) => s + t.content.length, 0);
  const totalWeight = selectedTopics.reduce((s, t) => s + (topicWeights[t.id] || 5), 0);
  const getTopicPercent = (id) => {
    const w = topicWeights[id] || 5;
    return totalWeight > 0 ? Math.round((w / totalWeight) * 100) : 0;
  };

  /** Largest-Remainder Method: distribute totalCount across selectedTopics by weight */
  const distributeByLRM = (total) => {
    if (selectedTopics.length === 0) return {};
    const tw = selectedTopics.reduce((s, t) => s + (topicWeights[t.id] || 5), 0);
    const quotas = selectedTopics.map((t) => ({
      id: t.id,
      quota: total * ((topicWeights[t.id] || 5) / tw),
    }));
    const floors = quotas.map((q) => ({ ...q, fl: Math.floor(q.quota), rem: q.quota - Math.floor(q.quota) }));
    const remaining = total - floors.reduce((s, f) => s + f.fl, 0);
    const sorted = [...floors].sort((a, b) => b.rem - a.rem);
    const counts = {};
    floors.forEach((f) => { counts[f.id] = f.fl; });
    sorted.slice(0, remaining).forEach((f) => { counts[f.id]++; });
    // ensure every topic gets at least 1
    floors.forEach((f) => { if (counts[f.id] < 1) counts[f.id] = 1; });
    return counts;
  };

  const toggleTopic = (id) => {
    setSelectedTopicIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAllTopics = () => setSelectedTopicIds(new Set(topics.map((t) => t.id)));
  const clearAllTopics  = () => setSelectedTopicIds(new Set());

  const handleGenerate = async () => {
    if (!extractedText) return;

    setLoading(true);
    setError("");
    try {
      let finalCount = customCount ? parseInt(customCount) : parseInt(count);
      if (isNaN(finalCount) || finalCount < 1) {
        setError("Please enter a valid number of questions (at least 1).");
        setLoading(false);
        return;
      }

      // Build the selectedTopics payload, optionally with weighted counts
      let topicsPayload = null;
      if (showTopicSelector && selectedTopics.length > 0) {
        if (weightedMode && selectedTopics.length > 1) {
          const countMap = distributeByLRM(finalCount);
          topicsPayload = selectedTopics.map((t) => ({
            id: t.id,
            title: t.title,
            content: t.content,
            targetCount: countMap[t.id] ?? 1,
          }));
        } else {
          topicsPayload = selectedTopics.map((t) => ({ id: t.id, title: t.title, content: t.content }));
        }
      }

      const res = await api.generateQuiz({
        sourceText: extractedText,
        questionType,
        difficulty,
        count: finalCount,
        ...(topicsPayload ? { selectedTopics: topicsPayload } : {}),
        chunks,
      });
      
      if (res.questions && res.questions.length > 0) {
        setQuizQuestions(res.questions);
        setCurrentQuestionIndex(0);
        setUserAnswers({});
        setScore(null);
        setReviewMode(false);
        quizStartedAtRef.current = Date.now();
        setQuizDurationSec(null);
        try {
          // Create session with high lives to prevent auto-termination for long quizzes
          const sessionRes = await api.createSession({
            questions: res.questions,
            timeLimitSec: 3600,
            lives: 100,
            title: `Quiz — ${primaryName.replace(/\.pdf$/i, "") || "Document"}${files.length > 1 ? ` +${files.length - 1} more` : ""}`,
            sourcePdfs: pdfNames,
            difficulty,
          });
          setSessionId(sessionRes.session.id);
        } catch (e) {
          console.error("Failed to create session on backend:", e);
        }
      } else {
        setError("AI could not generate enough questions. Try another PDF or reduce question count.");
      }
    } catch (err) {
      setError(err.message || "Failed to generate quiz. Please check your internet and API key.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSubmit = (answer) => {
    if (reviewMode) return;
    setUserAnswers({ ...userAnswers, [currentQuestionIndex]: answer });
  };

  const calculateScore = () => {
    let totalCorrect = 0;
    quizQuestions.forEach((q, idx) => {
      const userAns = userAnswers[idx];
      if (q.type === 'mcq') {
        if (userAns === q.answerIndex) totalCorrect++;
      } else if (q.type === 'true_false') {
        if (userAns === q.answer) totalCorrect++;
      } else {
        if (String(userAns).trim().toLowerCase() === String(q.answer).trim().toLowerCase()) {
          totalCorrect++;
        }
      }
    });
    return totalCorrect;
  };

  const handleNext = async () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      if (reviewMode) {
        setScore(calculateScore());
        setCurrentQuestionIndex(-1);
        setReviewMode(false);
        return;
      }
      
      if (quizStartedAtRef.current) {
        setQuizDurationSec(Math.max(0, Math.round((Date.now() - quizStartedAtRef.current) / 1000)));
      }

      if (sessionId) {
        setLoading(true); // Optional: if you want a loading state while submitting
        try {
          for (let idx = 0; idx < quizQuestions.length; idx++) {
            if (userAnswers[idx] !== undefined) {
              await api.submitAnswer(sessionId, { index: idx, answer: userAnswers[idx] });
            }
          }
        } catch (e) {
          console.error("Error submitting answers:", e);
        }
        setLoading(false);
      }

      setScore(calculateScore());
    }
  };

  const resetQuiz = () => {
    docsRef.current.forEach((d) => { if (d.pdfUrl) URL.revokeObjectURL(d.pdfUrl); });
    docsRef.current = [];
    setFiles([]);
    setExtractedText("");
    setTopics([]);
    setChunks([]);
    setSelectedTopicIds(new Set());
    setWeightedMode(false);
    setTopicWeights({});
    setQuizQuestions([]);
    setCurrentQuestionIndex(-1);
    setUserAnswers({});
    setScore(null);
    setError("");
    setReviewMode(false);
    setSessionId(null);
    quizStartedAtRef.current = null;
    setQuizDurationSec(null);
    setPdfModalOpen(false);
    setPdfModalQuestion(null);
  };

  const handleRetryWeakTopics = (weakTopics) => {
    // Auto-select weak topic IDs (by matching topic title to detected topics)
    const weakTitles = new Set(weakTopics.map(t => t.topic));
    const matchedIds = topics
      .filter(t => weakTitles.has(t.title))
      .map(t => t.id);
    setSelectedTopicIds(new Set(matchedIds.length > 0 ? matchedIds : topics.map(t => t.id)));
    setScore(null);
    setUserAnswers({});
    setQuizQuestions([]);
    setCurrentQuestionIndex(-1);
    setReviewMode(false);
    quizStartedAtRef.current = null;
    setQuizDurationSec(null);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startReview = () => {
    setScore(null);
    setCurrentQuestionIndex(0);
    setReviewMode(true);
  };

  if (score !== null) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 animate-in fade-in duration-700">
        <Card className="p-10 border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900 text-center">
          <div className="text-6xl mb-6">🏆</div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Quiz Results</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8">You've completed the quiz based on your document.</p>
          
          <div className="inline-flex flex-col items-center justify-center p-8 rounded-full border-4 border-indigo-500 mb-10 bg-indigo-50/50 dark:bg-indigo-900/10">
            <span className="text-5xl font-black text-indigo-600 dark:text-indigo-400">{score} / {quizQuestions.length}</span>
            <span className="text-sm font-semibold text-slate-500 uppercase tracking-widest mt-1">Final Score</span>
          </div>
          
          <div className="space-y-4">
            <Button size="lg" className="w-full" onClick={resetQuiz}>Start New Session</Button>
            <Button variant="ghost" className="w-full" onClick={startReview}>Review Your Answers</Button>
            <button
              id="export-quiz-btn-score"
              onClick={() => setExportModalOpen(true)}
              className="w-full py-3 rounded-xl border-2 border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-sm font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all flex items-center justify-center gap-2"
            >
              <span>⬇️</span> Export Quiz
            </button>
          </div>
        </Card>

        <QuizAnalysis
          questions={quizQuestions}
          userAnswers={userAnswers}
          durationSec={quizDurationSec}
          onRetryWeakTopics={handleRetryWeakTopics}
        />

        {exportModalOpen && (
          <ExportModal
            questions={quizQuestions}
            pdfName={primaryName}
            onClose={() => setExportModalOpen(false)}
          />
        )}
      </div>
    );
  }

  if (currentQuestionIndex >= 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 animate-in slide-in-from-bottom-4 duration-500">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            {reviewMode ? "Reviewing Answers" : "Quiz in progress"}
          </div>
          <div className="flex items-center gap-2">
            {/* Export button in toolbar */}
            <button
              id="export-quiz-btn-toolbar"
              onClick={() => setExportModalOpen(true)}
              title="Export Quiz"
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 dark:hover:bg-indigo-950/30 dark:hover:border-indigo-800 dark:hover:text-indigo-400 text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <span>⬇️</span>
              <span className="hidden sm:inline">Export</span>
            </button>
            <Button variant="ghost" size="sm" className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30" onClick={reviewMode ? () => { setScore(calculateScore()); setReviewMode(false); setCurrentQuestionIndex(-1); } : resetQuiz}>
              {reviewMode ? "Back to Results" : "End Quiz"}
            </Button>
          </div>
        </div>
        
        <ProgressBar current={currentQuestionIndex} total={quizQuestions.length} />

        <QuestionCard 
          question={quizQuestions[currentQuestionIndex]} 
          index={currentQuestionIndex}
          total={quizQuestions.length}
          onAnswer={handleAnswerSubmit}
          currentAnswer={userAnswers[currentQuestionIndex]}
          reviewMode={reviewMode}
          onViewSource={(question) => {
            setPdfModalQuestion(question);
            setPdfModalOpen(true);
          }}
        />

        <div className="flex justify-between items-center px-1">
          <Button 
            variant="ghost" 
            disabled={currentQuestionIndex === 0}
            onClick={() => setCurrentQuestionIndex(currentQuestionIndex - 1)}
            className="text-slate-500"
          >
            ← Previous
          </Button>
          <Button 
            size="lg"
            className="px-12 shadow-lg shadow-indigo-200 dark:shadow-none"
            disabled={!reviewMode && userAnswers[currentQuestionIndex] === undefined}
            onClick={handleNext}
          >
            {currentQuestionIndex === quizQuestions.length - 1 ? (reviewMode ? "Finish Review" : "Submit Quiz") : "Next Question →"}
          </Button>
        </div>

        {/* PDF Viewer Modal */}
        {pdfModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setPdfModalOpen(false)} />
            
            <div className="relative w-full max-w-5xl h-[85vh] rounded-2xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
              <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">PDF Source Viewer</h3>
                  {(() => {
                    const viewerName = pdfModalQuestion?.source?.pdfName || files[0]?.name;
                    return viewerName ? (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate" title={viewerName}>{viewerName}</p>
                    ) : null;
                  })()}
                </div>
                <button
                  onClick={() => setPdfModalOpen(false)}
                  className="ml-4 h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors text-lg"
                >
                  ✕
                </button>
              </div>

              {pdfModalQuestion?.source && (
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Topic</p>
                      <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 leading-snug">
                        {pdfModalQuestion.source.topic || pdfModalQuestion.source.section}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Page</p>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {pdfModalQuestion.source.page}
                      </p>
                    </div>
                    {(pdfModalQuestion.source.startLine && pdfModalQuestion.source.endLine) && (
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Lines</p>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {pdfModalQuestion.source.startLine}–{pdfModalQuestion.source.endLine}
                        </p>
                      </div>
                    )}
                    {pdfModalQuestion.evidence && (
                      <div className="col-span-2 sm:col-span-4">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Highlighted Text</p>
                        <p className="text-xs text-slate-700 dark:text-indigo-200 italic leading-relaxed bg-indigo-50 dark:bg-indigo-950/30 rounded-lg px-3 py-2 border border-indigo-100 dark:border-indigo-900/40">
                          "{pdfModalQuestion.evidence}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex-1 bg-slate-50 dark:bg-slate-950 p-4 flex items-center justify-center min-h-0">
                {(() => {
                  const srcName = pdfModalQuestion?.source?.pdfName;
                  const viewerUrl = srcName ? files.find((d) => d.name === srcName)?.pdfUrl : files[0]?.pdfUrl;
                  return viewerUrl ? (
                    <iframe
                      key={`${viewerUrl}-page-${pdfModalQuestion?.source?.page ?? 1}`}
                      src={`${viewerUrl}#page=${pdfModalQuestion?.source?.page ?? 1}`}
                      className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900"
                      title="PDF Source File"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <span className="text-4xl">📄</span>
                      <p className="text-sm font-medium">PDF preview unavailable — the document reference was cleared.</p>
                      <p className="text-xs text-slate-400">Upload the PDF again to re-enable source viewing.</p>
                    </div>
                  );
                })()}
              </div>

              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end flex-shrink-0">
                <Button onClick={() => setPdfModalOpen(false)}>Close Viewer</Button>
              </div>
            </div>
          </div>
        )}

        {/* Export Modal */}
        {exportModalOpen && (
          <ExportModal
            questions={quizQuestions}
            pdfName={primaryName}
            onClose={() => setExportModalOpen(false)}
          />
        )}

        {/* Dashboard (collapsible) */}
        <DifficultyDashboard questions={quizQuestions} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 animate-in fade-in duration-500">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          Quizelo
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          Turn any PDF into a custom quiz instantly with AI. 
        </p>
      </div>

      {error && (
        <div className="mb-8 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-400 flex items-center gap-3">
          <span className="text-xl">⚠️</span> {error}
        </div>
      )}

      <div className="space-y-8">
        {/* PDF Upload Section */}
        <Card className="p-8 border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group" id="upload-card">
          {loading && !extractedText && (
            <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center transition-all">
              <div className="h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Processing documents...</p>
            </div>
          )}
          
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">1</div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Upload Source</h2>
            {files.length > 0 && (
              <span className="ml-auto text-[11px] text-slate-400 font-medium">{files.length} document{files.length > 1 ? "s" : ""}</span>
            )}
          </div>

          <div
            className={`flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
              dragOver
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-slate-800/50"
            }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          >
            <div className="mb-4 text-4xl group-hover:scale-110 transition-transform">📄</div>
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {files.length > 0 ? "Add More Documents" : "Select PDF Documents"}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {files.length > 0 ? "Click to add more" : "Drag and drop or click to browse"}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">You can select multiple PDFs at once</div>
          </div>
          <input ref={inputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />

          {/* Uploaded document list — each keeps its identity, removable before generation */}
          {files.length > 0 && (
            <div className="mt-5 space-y-2">
              {files.map((doc) => (
                <div
                  key={doc.id}
                  className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border transition-all ${
                    doc.status === "error"
                      ? "border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/20"
                      : doc.status === "ready"
                        ? "border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40"
                        : "border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20"
                  }`}
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    <span className="text-base flex-shrink-0">📄</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{doc.name}</p>
                      {doc.status === "processing" && (
                        <p className="text-[10px] text-slate-400 font-medium">Extracting text…</p>
                      )}
                      {doc.status === "ready" && (
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">✓ Ready ({doc.topics.length} topics)</p>
                      )}
                      {doc.status === "error" && (
                        <p className="text-[10px] text-rose-500 font-medium">⚠ {doc.error}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {doc.status === "error" && (
                      <button
                        onClick={() => retryDoc(doc.id)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all"
                      >
                        Retry
                      </button>
                    )}
                    <button
                      onClick={() => removeDoc(doc.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30 transition-all"
                      title={`Remove ${doc.name}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Study Notes button — visible once a document is processed */}
          {extractedText && (
            <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
              <Link
                to="/study-notes"
                className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 border-2 border-violet-200 dark:border-violet-900/50 text-violet-700 dark:text-violet-400 text-sm font-bold hover:from-violet-100 hover:to-indigo-100 dark:hover:from-violet-950/50 dark:hover:to-indigo-950/50 transition-all hover:border-violet-300 dark:hover:border-violet-800"
              >
                <span className="text-base">📚</span>
                Generate Study Notes
              </Link>
            </div>
          )}
        </Card>

        {/* ── Topic Selector ─────────────────────────────────────────── */}
        {showTopicSelector && (
          <Card className="p-8 border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500" id="topic-selector-card">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">2</div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Select Topics</h2>
              </div>
              {/* Weighted mode toggle */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none" title="Distribute questions proportionally by topic weight">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Weighted</span>
                <button
                  id="weighted-toggle"
                  role="switch"
                  aria-checked={weightedMode}
                  onClick={() => setWeightedMode((w) => !w)}
                  className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    weightedMode ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"
                  }`}
                >
                  <span
                    className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      weightedMode ? "translate-x-[18px]" : "translate-x-0"
                    }`}
                  />
                </button>
              </label>
            </div>

            {/* Bulk action bar */}
            <div className="flex gap-2 mb-4 items-center">
              <button
                id="select-all-topics"
                onClick={selectAllTopics}
                className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                Select All
              </button>
              <button
                id="clear-all-topics"
                onClick={clearAllTopics}
                className="px-3 py-1.5 text-[11px] font-bold rounded-lg border-2 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
              >
                Clear
              </button>
              <span className="ml-auto text-[11px] text-slate-400 font-medium">
                {selectedTopicIds.size} of {topics.length} selected
                {selectedCharCount > 0 && (
                  <span className="ml-1 text-slate-300">· ~{Math.round(selectedCharCount / 5)} words</span>
                )}
              </span>
            </div>

            {/* Topic list */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {topics.map((topic) => {
                const checked = selectedTopicIds.has(topic.id);
                const weight  = topicWeights[topic.id] || 5;
                const percent = weightedMode && checked && selectedTopics.length > 0
                  ? getTopicPercent(topic.id)
                  : null;

                return (
                  <div
                    key={topic.id}
                    className={`rounded-xl border-2 overflow-hidden transition-all ${
                      checked
                        ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-900/20 dark:border-indigo-600"
                        : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
                    }`}
                  >
                    <label className="flex items-start gap-3 p-3 cursor-pointer">
                      {/* Custom checkbox */}
                      <div
                        className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                          checked ? "bg-indigo-600 border-indigo-600" : "border-slate-300 dark:border-slate-600"
                        }`}
                      >
                        {checked && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                            <path d="M1.5 5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggleTopic(topic.id)}
                      />

                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold truncate ${
                          checked ? "text-indigo-700 dark:text-indigo-300" : "text-slate-700 dark:text-slate-300"
                        }`}>
                          {topic.title}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {topic.pdfName && <span className="font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[200px] inline-block align-bottom">{topic.pdfName.replace(/\.pdf$/i, "")} · </span>}
                          ~{Math.round(topic.content.length / 5)} words
                          {topic.pageStart && topic.pageEnd && (
                            <span className="ml-1.5">· Pages {topic.pageStart}–{topic.pageEnd}</span>
                          )}
                        </div>
                      </div>

                      {percent !== null && (
                        <span className="flex-shrink-0 tabular-nums text-[13px] font-black text-indigo-600 dark:text-indigo-400 self-center">
                          {percent}%
                        </span>
                      )}
                    </label>

                    {/* Weight slider — visible only in weighted mode for checked topics */}
                    {weightedMode && checked && (
                      <div className="px-4 pb-3 pt-0">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-slate-400 w-5 text-right tabular-nums">{weight}</span>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            value={weight}
                            onChange={(e) =>
                              setTopicWeights((prev) => ({ ...prev, [topic.id]: parseInt(e.target.value) }))
                            }
                            className="flex-1 h-1.5 rounded-full accent-indigo-600 cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {selectedTopicIds.size === 0 && (
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-400 font-medium">⚠️ Select at least one topic to generate questions.</p>
            )}

            {weightedMode && selectedTopics.length > 1 && (
              <div className="mt-4 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/40">
                <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                  💡 Questions will be distributed across topics based on the sliders above.
                </p>
              </div>
            )}
          </Card>
        )}

        {/* ── Quiz Options ───────────────────────────────────────────── */}
        {/* Quiz Options Section */}
        <Card className="p-8 border-slate-200 dark:border-slate-800 shadow-sm" id="quiz-options-card">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">
              {showTopicSelector ? "3" : "2"}
            </div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Customize Quiz</h2>
          </div>
          
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-3 block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Question Type</label>
              <select
                className="w-full rounded-xl border-2 border-slate-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 transition-all"
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value)}
              >
                <option value="mcq">Multiple Choice</option>
                <option value="true_false">True / False</option>
                <option value="fill_blank">Fill in the Blanks</option>
                <option value="short_answer">Short Answer</option>
                <option value="mixed">Mixed Types</option>
              </select>
            </div>

            <div>
              <label className="mb-3 block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Difficulty</label>
              <select
                className="w-full rounded-xl border-2 border-slate-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 transition-all"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>

            <div className="md:col-span-2 lg:col-span-1">
              <label className="mb-3 block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Number of Items</label>
              <div className="flex gap-2 mb-3">
                {["5", "10", "15"].map((num) => (
                  <button
                    key={num}
                    onClick={() => { setCount(num); setCustomCount(""); }}
                    className={`flex-1 rounded-xl border-2 py-2.5 text-xs font-bold transition-all ${
                      count === num && !customCount
                        ? "border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none"
                        : "border-slate-100 bg-white text-slate-500 hover:border-slate-200 dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                max="50"
                placeholder="Enter custom amount (max 50)..."
                value={customCount}
                onChange={(e) => { 
                  const val = e.target.value;
                  // Only allow empty (for clearing) or positive numbers
                  if (val === "" || parseInt(val) >= 1) {
                    setCustomCount(val); 
                    setCount("custom"); 
                  }
                }}
                className="w-full rounded-xl border-2 border-slate-100 bg-white px-4 py-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 transition-all"
              />
            </div>
          </div>
        </Card>

        {/* Generate Button Section */}
        <div className="flex flex-col items-center pt-6">
          <Button
            id="generate-quiz-btn"
            size="lg"
            className="w-full max-w-sm py-5 text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 dark:shadow-none hover:translate-y-[-2px] transition-all disabled:opacity-50"
            disabled={!extractedText || loading || (showTopicSelector && selectedTopicIds.size === 0)}
            onClick={handleGenerate}
          >
            {loading ? "Generating..." : "Generate Quiz"}
          </Button>
          {files.length === 0 && !loading && (
            <p className="mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Please upload a document first
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
