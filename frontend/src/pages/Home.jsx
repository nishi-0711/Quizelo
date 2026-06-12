import { useRef, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { api } from "../lib/api";

// --- Sub-components ---

const ProgressBar = ({ current, total }) => {
  const percentage = ((current + 1) / total) * 100;
  return (
    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-6 overflow-hidden">
      <div 
        className="bg-indigo-600 h-full transition-all duration-300 ease-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

const QuestionCard = ({ question, index, total, onAnswer, currentAnswer, reviewMode }) => {
  return (
    <Card className="p-8 border-slate-200 dark:border-slate-800 shadow-lg bg-white dark:bg-slate-900 mb-8 transition-all duration-300 transform">
      <div className="flex items-center justify-between mb-8">
        <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
          Question {index + 1} of {total}
        </div>
        <div className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
          {question.type.replace('_', ' ')}
        </div>
      </div>

      <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-8 leading-relaxed">
        {question.question}
      </h3>

      <div className="space-y-3">
        {question.type === 'mcq' && question.options.map((option, idx) => (
          <button
            key={idx}
            onClick={() => onAnswer(idx)}
            disabled={reviewMode}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
              reviewMode && idx === question.answerIndex
                ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-500 dark:text-emerald-300"
                : reviewMode && currentAnswer === idx && idx !== question.answerIndex
                ? "border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-900/30 dark:border-rose-500 dark:text-rose-300"
                : currentAnswer === idx
                ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                : "border-slate-100 bg-slate-50 text-slate-700 hover:border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-300"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                reviewMode && idx === question.answerIndex ? "border-emerald-500 bg-emerald-500 text-white" :
                reviewMode && currentAnswer === idx && idx !== question.answerIndex ? "border-rose-500 bg-rose-500 text-white" :
                currentAnswer === idx ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 text-slate-400"
              }`}>
                {String.fromCharCode(65 + idx)}
              </span>
              {option}
            </div>
          </button>
        ))}

        {question.type === 'true_false' && (
          <div className="grid grid-cols-2 gap-4">
            {[true, false].map((val) => (
              <button
                key={val.toString()}
                onClick={() => onAnswer(val)}
                disabled={reviewMode}
                className={`p-6 rounded-xl border-2 font-bold transition-all ${
                  reviewMode && val === question.answer
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-500 dark:text-emerald-300"
                    : reviewMode && currentAnswer === val && val !== question.answer
                    ? "border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-900/30 dark:border-rose-500 dark:text-rose-300"
                    : currentAnswer === val
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                    : "border-slate-100 bg-slate-50 text-slate-700 hover:border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-300"
                }`}
              >
                {val ? "True" : "False"}
              </button>
            ))}
          </div>
        )}

        {(question.type === 'fill_blank' || question.type === 'short_answer') && (
          <div className="space-y-4">
            <textarea
              className={`w-full p-4 rounded-xl border-2 outline-none transition-all ${
                reviewMode && String(currentAnswer).trim().toLowerCase() === String(question.answer).trim().toLowerCase()
                  ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-900/10 dark:text-emerald-100"
                  : reviewMode && String(currentAnswer).trim().toLowerCase() !== String(question.answer).trim().toLowerCase()
                  ? "border-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-900/10 dark:text-rose-100"
                  : "border-slate-200 bg-slate-50 focus:border-indigo-500 dark:bg-slate-800/50 dark:border-slate-700 dark:text-white"
              }`}
              placeholder="Type your answer here..."
              rows={3}
              value={currentAnswer || ""}
              onChange={(e) => onAnswer(e.target.value)}
              disabled={reviewMode}
            />
            {reviewMode && String(currentAnswer).trim().toLowerCase() !== String(question.answer).trim().toLowerCase() && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300">
                <span className="font-bold text-xs uppercase tracking-wider mb-1 block">Correct Answer:</span>
                {question.answer}
              </div>
            )}
          </div>
        )}
      </div>

      {reviewMode && (
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4 animate-in slide-in-from-bottom-2">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Explanation</h4>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{question.explanation}</p>
          </div>
          <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 dark:border-indigo-900/30 dark:bg-indigo-900/10">
            <h4 className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <span>📄</span> Source Evidence
            </h4>
            <p className="text-sm text-indigo-900 dark:text-indigo-200 italic">"{question.evidence}"</p>
          </div>
        </div>
      )}
    </Card>
  );
};

// --- Main Home Component ---

export default function Home() {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [extractedText, setExtractedText] = useState("");
  const [topics, setTopics] = useState([]); // detected topic chunks
  const [selectedTopicIds, setSelectedTopicIds] = useState(new Set()); // which topics are checked
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1); // -1: Config, >=0: Play
  const [userAnswers, setUserAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  // Configuration state
  const [questionType, setQuestionType] = useState("mixed");
  const [difficulty, setDifficulty] = useState("mixed");
  const [count, setCount] = useState("5");
  const [customCount, setCustomCount] = useState("");

  // Topic helpers
  const showTopicSelector = topics.length > 1; // hide when only full-doc fallback
  const selectedTopics = topics.filter((t) => selectedTopicIds.has(t.id));
  const selectedCharCount = selectedTopics.reduce((s, t) => s + t.content.length, 0);

  const handleFileChange = async (f) => {
    if (f && f.type === "application/pdf") {
      setFile(f);
      setError("");
      setLoading(true);
      try {
        const res = await api.extractPdf(f);
        if (res.text) {
          setExtractedText(res.text);
          const detected = res.topics && res.topics.length > 0 ? res.topics : [];
          setTopics(detected);
          // Auto-select all topics
          setSelectedTopicIds(new Set(detected.map((t) => t.id)));
        } else {
          setError("No extractable text found in this PDF.");
          setFile(null);
        }
      } catch (err) {
        setError(err.message || "Failed to extract text from PDF.");
        setFile(null);
      } finally {
        setLoading(false);
      }
    } else {
      setError("Please upload a valid PDF file.");
    }
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
  const clearAllTopics = () => setSelectedTopicIds(new Set());

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

      // If topics are available and user has selected specific ones, send them.
      // Otherwise fall back to full text.
      const topicsPayload = showTopicSelector && selectedTopics.length > 0 ? selectedTopics : null;

      const res = await api.generateQuiz({
        sourceText: extractedText,
        questionType,
        difficulty,
        count: finalCount,
        ...(topicsPayload ? { selectedTopics: topicsPayload } : {}),
      });
      
      if (res.questions && res.questions.length > 0) {
        setQuizQuestions(res.questions);
        setCurrentQuestionIndex(0);
        setUserAnswers({});
        setScore(null);
        setReviewMode(false);
        try {
          // Create session with high lives to prevent auto-termination for long quizzes
          const sessionRes = await api.createSession({ questions: res.questions, timeLimitSec: 3600, lives: 100 });
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
    setFile(null);
    setExtractedText("");
    setTopics([]);
    setSelectedTopicIds(new Set());
    setQuizQuestions([]);
    setCurrentQuestionIndex(-1);
    setUserAnswers({});
    setScore(null);
    setError("");
    setReviewMode(false);
    setSessionId(null);
  };

  const startReview = () => {
    setScore(null);
    setCurrentQuestionIndex(0);
    setReviewMode(true);
  };

  if (score !== null) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center animate-in fade-in duration-700">
        <Card className="p-10 border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900">
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
          </div>
        </Card>
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
          <Button variant="ghost" size="sm" className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30" onClick={reviewMode ? () => { setScore(calculateScore()); setReviewMode(false); setCurrentQuestionIndex(-1); } : resetQuiz}>
            {reviewMode ? "Back to Results" : "End Quiz"}
          </Button>
        </div>
        
        <ProgressBar current={currentQuestionIndex} total={quizQuestions.length} />

        <QuestionCard 
          question={quizQuestions[currentQuestionIndex]} 
          index={currentQuestionIndex}
          total={quizQuestions.length}
          onAnswer={handleAnswerSubmit}
          currentAnswer={userAnswers[currentQuestionIndex]}
          reviewMode={reviewMode}
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
        <Card className="p-8 border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          {loading && !extractedText && (
            <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center transition-all">
              <div className="h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Processing document...</p>
            </div>
          )}
          
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">1</div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Upload Source</h2>
          </div>

          <div
            className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
              dragOver
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-slate-800/50"
            }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileChange(e.dataTransfer.files?.[0]); }}
          >
            <div className="mb-4 text-4xl group-hover:scale-110 transition-transform">📄</div>
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {file ? "Document Ready" : "Select PDF Document"}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {file ? "Click to change document" : "Drag and drop or click to browse"}
            </div>
            
            {file && (
              <div className="mt-5 rounded-xl bg-indigo-600 px-4 py-2 text-[10px] font-black text-white uppercase tracking-widest shadow-lg shadow-indigo-200 dark:shadow-none">
                {file.name}
              </div>
            )}
          </div>
          <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => handleFileChange(e.target.files?.[0])} />
        </Card>

        {/* Topic Selector Section — only shown when multiple topics detected */}
        {showTopicSelector && (
          <Card className="p-8 border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">2</div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Select Topics</h2>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={selectAllTopics}
                className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                Select All
              </button>
              <button
                onClick={clearAllTopics}
                className="px-3 py-1.5 text-[11px] font-bold rounded-lg border-2 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
              >
                Clear
              </button>
              <span className="ml-auto text-[11px] text-slate-400 font-medium self-center">
                {selectedTopicIds.size} of {topics.length} selected
                {selectedCharCount > 0 && (
                  <span className="ml-1 text-slate-300">· ~{Math.round(selectedCharCount / 5)} words</span>
                )}
              </span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {topics.map((topic) => {
                const checked = selectedTopicIds.has(topic.id);
                return (
                  <label
                    key={topic.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      checked
                        ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-900/20 dark:border-indigo-600"
                        : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                      checked ? "bg-indigo-600 border-indigo-600" : "border-slate-300 dark:border-slate-600"
                    }`}>
                      {checked && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                          <path d="M1.5 5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
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
                        ~{Math.round(topic.content.length / 5)} words
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            {selectedTopicIds.size === 0 && (
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-400 font-medium">⚠️ Select at least one topic to generate questions.</p>
            )}
          </Card>
        )}

        {/* Quiz Options Section */}
        <Card className="p-8 border-slate-200 dark:border-slate-800 shadow-sm">
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
            size="lg"
            className="w-full max-w-sm py-5 text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 dark:shadow-none hover:translate-y-[-2px] transition-all disabled:opacity-50"
            disabled={!extractedText || loading || (showTopicSelector && selectedTopicIds.size === 0)}
            onClick={handleGenerate}
          >
            {loading ? "Generating..." : "Generate Quiz"}
          </Button>
          {!file && !loading && (
            <p className="mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Please upload a document first
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
