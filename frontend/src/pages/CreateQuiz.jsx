import { useEffect, useRef, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ProgressBar, QuestionCard } from "../components/QuestionCard";
import QuizAnalysis from "../components/QuizAnalysis";
import ExportModal from "../components/ExportModal";
import { api } from "../lib/api";

const TYPE_LABELS = { mcq: "Multiple Choice", true_false: "True/False", short_answer: "Short Answer" };
const DIFFICULTIES = ["easy", "medium", "hard"];

function newQuestion(type = "mcq") {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    question: "",
    options: ["", "", "", ""],
    answerIndex: 0,
    answer: "",
    tfAnswer: true,
    explanation: "",
    marks: 1,
    difficulty: "medium",
  };
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Question editor ──────────────────────────────────────────────────────────

function AssistButton({ label, onClick, busy, disabled, color = "indigo" }) {
  const colors = {
    indigo: "border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30",
    violet: "border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30",
    sky: "border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/30",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={`px-3 py-1.5 rounded-xl border-2 text-[11px] font-bold transition-all disabled:opacity-50 ${colors[color]}`}
    >
      {busy ? "Working…" : `✨ ${label}`}
    </button>
  );
}

function QuestionEditor({ draft, onChange, assistBusy, onAssist, assistError }) {
  const set = (patch) => onChange({ ...draft, ...patch });

  const canAssist = draft.question.trim().length >= 3;

  return (
    <div className="space-y-5 p-5 rounded-2xl border-2 border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20">
      {/* Type + difficulty + marks */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="mb-1.5 block text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</label>
          <select
            value={draft.type}
            onChange={(e) => set({ type: e.target.value, answer: e.target.value === "true_false" ? "" : draft.answer })}
            className="w-full rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
          >
            {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-black text-slate-400 uppercase tracking-widest">Difficulty</label>
          <select
            value={draft.difficulty}
            onChange={(e) => set({ difficulty: e.target.value })}
            className="w-full rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
          >
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-black text-slate-400 uppercase tracking-widest">Marks</label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={draft.marks}
            onChange={(e) => set({ marks: Math.max(0, Number(e.target.value) || 0) })}
            className="w-full rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex items-end pb-0.5">
          <span className="text-[11px] font-bold text-slate-400">{draft.type === "mcq" ? "Choose correct option" : draft.type === "true_false" ? "True or False" : "Type the answer"}</span>
        </div>
      </div>

      {/* Question text */}
      <div>
        <label className="mb-1.5 block text-[10px] font-black text-slate-400 uppercase tracking-widest">Question</label>
        <textarea
          rows={2}
          value={draft.question}
          onChange={(e) => set({ question: e.target.value })}
          placeholder="Enter your question here…"
          className="w-full rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
        />
      </div>

      {/* MCQ options */}
      {draft.type === "mcq" && (
        <div className="space-y-2">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Options (click to set the correct one)</label>
          {draft.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => set({ answerIndex: i })}
                className={`flex-shrink-0 h-7 w-7 rounded-full text-xs font-black transition-all ${
                  draft.answerIndex === i
                    ? "bg-emerald-600 text-white shadow"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
                title="Mark as correct"
              >
                {String.fromCharCode(65 + i)}
              </button>
              <input
                value={opt}
                onChange={(e) => {
                  const options = [...draft.options];
                  options[i] = e.target.value;
                  set({ options });
                }}
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                className="flex-1 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
              />
            </div>
          ))}
          <p className="text-[10px] text-slate-400 font-medium">✓ The highlighted letter is the correct answer.</p>
        </div>
      )}

      {/* True/False answer */}
      {draft.type === "true_false" && (
        <div className="flex gap-2">
          {[true, false].map((v) => (
            <button
              key={v.toString()}
              type="button"
              onClick={() => set({ tfAnswer: v })}
              className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${
                draft.tfAnswer === v
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-slate-100 dark:border-slate-800 text-slate-500 hover:border-slate-200"
              }`}
            >
              {v ? "True" : "False"}
            </button>
          ))}
        </div>
      )}

      {/* Short answer */}
      {draft.type === "short_answer" && (
        <div>
          <label className="mb-1.5 block text-[10px] font-black text-slate-400 uppercase tracking-widest">Correct Answer</label>
          <input
            value={draft.answer}
            onChange={(e) => set({ answer: e.target.value })}
            placeholder="Type the correct answer…"
            className="w-full rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
          />
        </div>
      )}

      {/* Explanation */}
      <div>
        <label className="mb-1.5 block text-[10px] font-black text-slate-400 uppercase tracking-widest">Explanation (shown after answering)</label>
        <textarea
          rows={2}
          value={draft.explanation}
          onChange={(e) => set({ explanation: e.target.value })}
          placeholder="Explain why the answer is correct…"
          className="w-full rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
        />
      </div>

      {/* AI assist */}
      <div>
        <label className="mb-1.5 block text-[10px] font-black text-slate-400 uppercase tracking-widest">✨ AI Assist</label>
        <div className="flex flex-wrap gap-2">
          <AssistButton
            label="Improve Question"
            color="indigo"
            busy={assistBusy === "improve"}
            disabled={!canAssist}
            onClick={() => onAssist("improve", { question: draft.question, answer: draft.type === "mcq" ? draft.options[draft.answerIndex] : draft.type === "true_false" ? (draft.tfAnswer ? "True" : "False") : draft.answer, explanation: draft.explanation })}
          />
          {draft.type === "mcq" && (
            <AssistButton
              label="Generate Options"
              color="violet"
              busy={assistBusy === "options"}
              disabled={!canAssist}
              onClick={() => onAssist("options", { question: draft.question, answer: draft.options[draft.answerIndex] || undefined })}
            />
          )}
          <AssistButton
            label="Generate Explanation"
            color="sky"
            busy={assistBusy === "explanation"}
            disabled={!canAssist}
            onClick={() => onAssist("explanation", { question: draft.question, answer: draft.type === "mcq" ? draft.options[draft.answerIndex] : draft.type === "true_false" ? (draft.tfAnswer ? "True" : "False") : draft.answer })}
          />
        </div>
        {assistError && <p className="mt-2 text-[11px] text-rose-500 font-medium">⚠ {assistError}</p>}
      </div>
    </div>
  );
}

// ─── Builder mode ─────────────────────────────────────────────────────────────

function Builder({ title, setTitle, questions, setQuestions }) {
  const [editingId, setEditingId] = useState(null);   // id of question being edited; "new" for the add form
  const [draft, setDraft] = useState(() => newQuestion("mcq"));
  const [assistBusy, setAssistBusy] = useState(null);
  const [assistError, setAssistError] = useState("");

  const applyAssist = async (action, input) => {
    setAssistBusy(action);
    setAssistError("");
    try {
      const res = await api.quizAssist({ action, ...input });
      if (action === "improve") {
        setDraft((d) => ({ ...d, question: res.question, explanation: res.explanation || d.explanation }));
      } else if (action === "options") {
        setDraft((d) => ({ ...d, options: res.options, answerIndex: res.answerIndex }));
      } else {
        setDraft((d) => ({ ...d, explanation: res.explanation }));
      }
    } catch (err) {
      setAssistError(err.message || "AI assist failed. Check your API key / quota and try again.");
    } finally {
      setAssistBusy(null);
    }
  };

  const startEditing = (q) => {
    setEditingId(q ? q.id : "new");
    setDraft(q ? { ...q } : newQuestion("mcq"));
    setAssistError("");
  };

  const saveDraft = () => {
    if (!draft.question.trim()) {
      setAssistError("Question text cannot be empty.");
      return;
    }
    if (draft.type === "mcq" && draft.options.some((o) => !o.trim())) {
      setAssistError("Fill in all four options.");
      return;
    }
    if (draft.type === "short_answer" && !draft.answer.trim()) {
      setAssistError("Provide the correct answer.");
      return;
    }
    if (editingId === "new") {
      setQuestions((prev) => [...prev, { ...draft, id: uid() }]);
    } else {
      setQuestions((prev) => prev.map((q) => (q.id === editingId ? draft : q)));
    }
    setEditingId(null);
    setDraft(newQuestion("mcq"));
    setAssistError("");
  };

  const removeQuestion = (id) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    if (editingId === id) { setEditingId(null); setDraft(newQuestion("mcq")); }
  };

  const moveQuestion = (index, dir) => {
    setQuestions((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const totalMarks = questions.reduce((s, q) => s + (Number(q.marks) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Title */}
      <Card className="p-6 border-slate-200 dark:border-slate-800 shadow-sm">
        <label className="mb-2 block text-[10px] font-black text-slate-400 uppercase tracking-widest">Quiz Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Chapter 1 — Water Cycle"
          className="w-full rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-base font-semibold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
        />
        <p className="mt-2 text-[11px] text-slate-400">
          {questions.length} question{questions.length === 1 ? "" : "s"} · {totalMarks} total marks
        </p>
      </Card>

      {/* Question list */}
      {questions.length > 0 && (
        <div className="space-y-2">
          {questions.map((q, index) => (
            <div key={q.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex items-center gap-3">
                  <span className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-black">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{q.question || "Untitled question"}</p>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">
                      {TYPE_LABELS[q.type]} · {q.difficulty} · {q.marks || 0} mark{q.marks === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => moveQuestion(index, -1)} disabled={index === 0} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-all" title="Move up">↑</button>
                  <button onClick={() => moveQuestion(index, 1)} disabled={index === questions.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-all" title="Move down">↓</button>
                  <button onClick={() => startEditing(q)} className="p-1.5 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/30 transition-all" title="Edit">✏️</button>
                  <button onClick={() => removeQuestion(q.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30 transition-all" title="Delete">🗑</button>
                </div>
              </div>
              {editingId === q.id && (
                <div className="px-4 pb-4">
                  <QuestionEditor
                    draft={draft}
                    onChange={setDraft}
                    assistBusy={assistBusy}
                    onAssist={applyAssist}
                    assistError={assistError}
                  />
                  <div className="mt-3 flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingId(null); setDraft(newQuestion("mcq")); setAssistError(""); }}>Cancel</Button>
                    <Button size="sm" onClick={saveDraft}>Save Question</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add question */}
      {editingId === "new" && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-0">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">New Question</h3>
          </div>
          <div className="p-4">
            <QuestionEditor
              draft={draft}
              onChange={setDraft}
              assistBusy={assistBusy}
              onAssist={applyAssist}
              assistError={assistError}
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setEditingId(null); setDraft(newQuestion("mcq")); setAssistError(""); }}>Cancel</Button>
              <Button size="sm" onClick={saveDraft}>Add Question</Button>
            </div>
          </div>
        </div>
      )}

      {editingId !== "new" && (
        <div className="flex justify-center">
          <Button variant="secondary" className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 text-slate-500 dark:text-slate-400"
            onClick={() => startEditing(null)}>
            + Add Question
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Play mode ────────────────────────────────────────────────────────────────

function Play({ questions, title, sessionId, onExit }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [reviewMode, setReviewMode] = useState(false);
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const startedAtRef = useRef(null);
  const [durationSec, setDurationSec] = useState(null);

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  const payload = questions.map((q) => ({
    type: q.type,
    difficulty: q.difficulty,
    question: q.question,
    options: q.type === "mcq" ? q.options : undefined,
    answerIndex: q.type === "mcq" ? q.answerIndex : undefined,
    answer: q.type === "mcq" ? undefined : q.type === "true_false" ? q.tfAnswer : q.answer,
    explanation: q.explanation || "No explanation provided.",
    evidence: q.evidence || "",
    marks: Number(q.marks) || 1,
  }));

  const calculateScore = () => {
    let total = 0;
    payload.forEach((q, idx) => {
      const ua = userAnswers[idx];
      if (q.type === "mcq") { if (ua === q.answerIndex) total++; }
      else if (q.type === "true_false") { if (ua === q.answer) total++; }
      else if (String(ua ?? "").trim().toLowerCase() === String(q.answer ?? "").trim().toLowerCase()) total++;
    });
    return total;
  };

  const handleAnswer = (answer) => {
    if (reviewMode) return;
    setUserAnswers((prev) => ({ ...prev, [currentIndex]: answer }));
  };

  const handleNext = async () => {
    if (currentIndex < payload.length - 1) {
      setCurrentIndex(currentIndex + 1);
      return;
    }
    if (reviewMode) {
      setScore(calculateScore());
      setCurrentIndex(0);
      setReviewMode(false);
      return;
    }
    setDurationSec(Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000)));
    if (sessionId) {
      setLoading(true);
      try {
        for (let idx = 0; idx < payload.length; idx++) {
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
  };

  const startReview = () => {
    setScore(null);
    setCurrentIndex(0);
    setReviewMode(true);
  };

  if (score !== null) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 animate-in fade-in duration-700">
        <Card className="p-10 border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900 text-center">
          <div className="text-6xl mb-6">🏆</div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Quiz Results</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8">{title}</p>
          <div className="inline-flex flex-col items-center justify-center p-8 rounded-full border-4 border-indigo-500 mb-10 bg-indigo-50/50 dark:bg-indigo-900/10">
            <span className="text-5xl font-black text-indigo-600 dark:text-indigo-400">{score} / {payload.length}</span>
            <span className="text-sm font-semibold text-slate-500 uppercase tracking-widest mt-1">Final Score</span>
          </div>
          <div className="space-y-4">
            <Button size="lg" className="w-full" onClick={onExit}>Back to Editor</Button>
            <Button variant="ghost" className="w-full" onClick={startReview}>Review Your Answers</Button>
            <button
              onClick={() => setExportModalOpen(true)}
              className="w-full py-3 rounded-xl border-2 border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-sm font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all flex items-center justify-center gap-2"
            >
              <span>⬇️</span> Export Quiz
            </button>
          </div>
        </Card>

        <QuizAnalysis
          questions={payload}
          userAnswers={userAnswers}
          durationSec={durationSec}
        />

        {exportModalOpen && (
          <ExportModal questions={payload} pdfName={title} onClose={() => setExportModalOpen(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 animate-in slide-in-from-bottom-4 duration-500">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
          {reviewMode ? "Reviewing Answers" : `${title} — in progress`}
        </div>
        <Button variant="ghost" size="sm" className="text-xs text-rose-500 hover:text-rose-600" onClick={reviewMode ? () => { setScore(calculateScore()); setReviewMode(false); } : onExit}>
          {reviewMode ? "Back to Results" : "End Quiz"}
        </Button>
      </div>

      <ProgressBar current={currentIndex} total={payload.length} />

      <QuestionCard
        question={payload[currentIndex]}
        index={currentIndex}
        total={payload.length}
        onAnswer={handleAnswer}
        currentAnswer={userAnswers[currentIndex]}
        reviewMode={reviewMode}
      />

      <div className="flex justify-between items-center px-1">
        <Button variant="ghost" disabled={currentIndex === 0} onClick={() => setCurrentIndex(currentIndex - 1)} className="text-slate-500">
          ← Previous
        </Button>
        <Button
          size="lg"
          className="px-12 shadow-lg shadow-indigo-200 dark:shadow-none"
          disabled={(!reviewMode && userAnswers[currentIndex] === undefined) || loading}
          onClick={handleNext}
        >
          {loading ? "Submitting…" : currentIndex === payload.length - 1 ? (reviewMode ? "Finish Review" : "Submit Quiz") : "Next Question →"}
        </Button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreateQuiz() {
  const [title, setTitle] = useState("My Quiz");
  const [questions, setQuestions] = useState([]);
  const [play, setPlay] = useState(false);
  const [playSessionId, setPlaySessionId] = useState(null);
  const [startError, setStartError] = useState("");
  const [starting, setStarting] = useState(false);

  const launch = async () => {
    setStartError("");
    if (!title.trim()) { setStartError("Give your quiz a title."); return; }
    if (questions.length === 0) { setStartError("Add at least one question before starting."); return; }
    const invalid = questions.find((q) => !q.question.trim() || (q.type === "mcq" && q.options.some((o) => !o.trim())) || (q.type === "short_answer" && !q.answer.trim()));
    if (invalid) { setStartError("Every question needs text, options (MCQ) or an answer (short answer)."); return; }

    setStarting(true);
    try {
      const payload = questions.map((q) => ({
        type: q.type,
        difficulty: q.difficulty,
        question: q.question,
        options: q.type === "mcq" ? q.options : undefined,
        answerIndex: q.type === "mcq" ? q.answerIndex : undefined,
        answer: q.type === "mcq" ? undefined : q.type === "true_false" ? q.tfAnswer : q.answer,
        explanation: q.explanation || "No explanation provided.",
        evidence: q.evidence || "",
        marks: Number(q.marks) || 1,
      }));
      const sessionRes = await api.createSession({
        questions: payload,
        timeLimitSec: null,
        title: title.trim(),
        sourcePdfs: [],
        difficulty: "mixed",
      });
      // Pass session id to Play so answers are graded on the backend
      setPlaySessionId(sessionRes.session.id);
      setPlay(true);
    } catch (err) {
      setStartError(err.message || "Failed to start the quiz.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 animate-in fade-in duration-500">
      {play ? (
        <Play
          key={playSessionId}
          questions={questions}
          title={title.trim()}
          sessionId={playSessionId}
          onExit={() => { setPlay(false); setPlaySessionId(null); }}
        />
      ) : (
        <>
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100">Create Your Own Quiz</h1>
            <p className="mt-3 text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              Build a quiz by hand — add, edit, reorder, and set marks for every question. AI assist is optional.
            </p>
          </div>

          {startError && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-400">
              ⚠️ {startError}
            </div>
          )}

          <Builder title={title} setTitle={setTitle} questions={questions} setQuestions={setQuestions} />

          <div className="flex flex-col items-center pt-8">
            <Button
              id="start-manual-quiz-btn"
              size="lg"
              className="w-full max-w-sm py-4 text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 dark:shadow-none disabled:opacity-50"
              disabled={starting || questions.length === 0}
              onClick={launch}
            >
              {starting ? "Starting…" : "Start Quiz"}
            </Button>
            {questions.length === 0 && (
              <p className="mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Add at least one question to start
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}