import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import FlashcardDeck from "../components/FlashcardDeck";
import { api } from "../lib/api";

const TABS = [
  { id: "quizzes", label: "Quizzes", icon: "📝" },
  { id: "notes", label: "Study Notes", icon: "📚" },
  { id: "flashcards", label: "Flashcards", icon: "🃏" },
];

const DIFF_COLORS = {
  easy: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  hard: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
  mixed: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400",
};

function DifficultyBadge({ difficulty }) {
  const d = difficulty || "mixed";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${DIFF_COLORS[d] || DIFF_COLORS.mixed}`}>
      {d}
    </span>
  );
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function formatDuration(sec) {
  if (sec === null || sec === undefined || Number.isNaN(sec)) return null;
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function ModalShell({ title, subtitle, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${wide ? "max-w-4xl" : "max-w-2xl"} max-h-[90vh] rounded-2xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-black text-slate-900 dark:text-white truncate">{title}</h2>
            {subtitle && <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="ml-4 h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors text-lg"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Quiz review modal ────────────────────────────────────────────────────────

function formatAnswer(q, ua) {
  if (ua === undefined || ua === null || ua === "") return "—";
  if (q.type === "mcq" && Array.isArray(q.options)) {
    const opt = q.options[ua];
    return opt !== undefined ? `${String.fromCharCode(65 + ua)}. ${opt}` : String(ua);
  }
  if (q.type === "true_false") return ua ? "True" : "False";
  return String(ua);
}

function QuizReviewModal({ result, onClose }) {
  const questions = result.questions || [];
  const responses = result.responses || [];

  const verdicts = questions.map((q, idx) => {
    const r = responses.find((x) => x.index === idx);
    const correct = r ? r.isCorrect === true : false;
    return { idx, q, r, correct };
  });
  const correctCount = verdicts.filter((v) => v.correct).length;

  return (
    <ModalShell
      title={result.title || "Quiz Review"}
      subtitle={result.sourcePdfs?.[0] ? `From: ${result.sourcePdfs[0]}` : undefined}
      onClose={onClose}
      wide
    >
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-900/40 p-3 text-center">
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{result.scorePercent}%</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Score</div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 dark:bg-slate-800/60 dark:border-slate-800 p-3 text-center">
          <div className="text-2xl font-black text-slate-700 dark:text-slate-200">{correctCount}/{questions.length}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Correct</div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 dark:bg-slate-800/60 dark:border-slate-800 p-3 text-center">
          <div className="text-2xl font-black text-slate-700 dark:text-slate-200">{questions.length}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Questions</div>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-900/40 p-3 text-center">
          <div className="text-lg font-black text-amber-600 dark:text-amber-400">{formatDuration(result.durationSec) || "—"}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Time</div>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-900/40 p-3 text-center">
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">+{result.xpEarned ?? 0}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">XP</div>
        </div>
      </div>

      {/* Per-question review */}
      <div className="space-y-4">
        {verdicts.map(({ idx, q, r, correct }) => (
          <div key={idx} className={`rounded-xl border p-4 ${correct ? "border-emerald-100 dark:border-emerald-900/40" : "border-rose-100 dark:border-rose-900/40"}`}>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex-shrink-0">{correct ? "✅" : "❌"}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Q{idx + 1}</span>
                  <span className="text-[10px] font-bold text-slate-400">{q.type?.replace("_", " ")}</span>
                  <DifficultyBadge difficulty={q.difficulty} />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug">{q.question}</p>
                <div className="mt-2 space-y-1 text-xs">
                  <p className="text-slate-500 dark:text-slate-400">
                    <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Your answer: </span>
                    {formatAnswer(q, r?.userAnswer)}
                  </p>
                  {!correct && (
                    <p className="text-emerald-700 dark:text-emerald-400">
                      <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Correct: </span>
                      {formatAnswer(q, q.type === "mcq" ? q.answerIndex : q.answer)}
                    </p>
                  )}
                  {q.explanation && (
                    <p className="text-slate-400 dark:text-slate-500 italic mt-1">{q.explanation}</p>
                  )}
                  {q.evidence && (
                    <p className="text-indigo-600 dark:text-indigo-400 italic text-[11px] mt-1 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg px-3 py-2 border border-indigo-100 dark:border-indigo-900/40">
                      "{(q.evidence || "").slice(0, 220)}{q.evidence?.length > 220 ? "…" : ""}"
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}

// ─── Note viewer modal ────────────────────────────────────────────────────────

function NoteViewerModal({ note, onClose, onExport, exporting = false }) {
  const [openIdx, setOpenIdx] = useState(0);
  return (
    <ModalShell title={note.title} subtitle={note.subject || (note.sourcePdfs?.[0] ? `From: ${note.sourcePdfs[0]}` : undefined)} onClose={onClose} wide>
      {Array.isArray(note.topics) && note.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {note.topics.slice(0, 12).map((t, i) => (
            <span key={i} className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {(note.sections || []).map((sec, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              onClick={() => setOpenIdx(openIdx === i ? -1 : i)}
            >
              <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{sec.chapter}</span>
              <svg className={`flex-shrink-0 w-4 h-4 text-slate-400 transition-transform duration-200 ${openIdx === i ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>
            {openIdx === i && (
              <div className="px-5 pb-5 space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                {sec.summary && <p className="text-sm text-slate-600 dark:text-slate-400 italic">{sec.summary}</p>}
                {Array.isArray(sec.keyConcepts) && sec.keyConcepts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {sec.keyConcepts.map((c, j) => (
                      <span key={j} className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">{c}</span>
                    ))}
                  </div>
                )}
                {Array.isArray(sec.definitions) && sec.definitions.length > 0 && (
                  <div className="space-y-1.5">
                    {sec.definitions.map((d, j) => (
                      <p key={j} className="text-sm pl-3 border-l-2 border-indigo-200 dark:border-indigo-800">
                        <span className="font-bold text-slate-900 dark:text-white">{d.term}: </span>
                        <span className="text-slate-600 dark:text-slate-400">{d.definition}</span>
                      </p>
                    ))}
                  </div>
                )}
                {Array.isArray(sec.formulas) && sec.formulas.length > 0 && (
                  <div className="space-y-1.5">
                    {sec.formulas.map((f, j) => (
                      <div key={j} className="px-3 py-2 rounded-lg bg-slate-900 dark:bg-slate-950 border border-slate-700 font-mono text-xs text-emerald-400">{f}</div>
                    ))}
                  </div>
                )}
                {Array.isArray(sec.keyTakeaways) && sec.keyTakeaways.length > 0 && (
                  <ul className="space-y-1">
                    {sec.keyTakeaways.map((tk, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500" />{tk}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {Array.isArray(note.quickRevision) && note.quickRevision.length > 0 && (
        <div className="mt-5 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3">
            <h3 className="text-white font-black text-sm uppercase tracking-widest">⚡ Quick Revision</h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {note.quickRevision.map((item, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[10px] font-black flex items-center justify-center mt-0.5">{i + 1}</span>
                <p className="text-sm text-slate-700 dark:text-slate-300">{item}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" size="sm" disabled={exporting} onClick={() => onExport("pdf")}>📄 Export PDF</Button>
        <Button variant="secondary" size="sm" disabled={exporting} onClick={() => onExport("docx")}>📝 Export DOCX</Button>
      </div>
    </ModalShell>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function History() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab = rawTab === "notes" || rawTab === "flashcards" ? rawTab : "quizzes";
  const [quizzes, setQuizzes] = useState([]);
  const [notes, setNotes] = useState([]);
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [reviewResult, setReviewResult] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [viewNote, setViewNote] = useState(null);
  const [viewNoteExporting, setViewNoteExporting] = useState(false);
  const [viewSet, setViewSet] = useState(null);
  const [setBusy, setSetBusy] = useState(false);

  const fetchAll = useCallback(async () => {
    const [h, n, f] = await Promise.all([api.getHistory(), api.getNotes(), api.getFlashcardSets()]);
    return { quizzes: h.results || [], notes: n.notes || [], sets: f.sets || [] };
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const data = await fetchAll();
      setQuizzes(data.quizzes);
      setNotes(data.notes);
      setSets(data.sets);
    } catch (err) {
      setError(err.message || "Failed to load your history.");
    }
  }, [fetchAll]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAll();
        if (cancelled) return;
        setQuizzes(data.quizzes);
        setNotes(data.notes);
        setSets(data.sets);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load your history.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchAll]);

  // ── Quiz actions ──
  const handleReviewQuiz = async (sessionId) => {
    setReviewLoading(true);
    try {
      const res = await api.getResult(sessionId);
      setReviewResult(res.result);
    } catch (err) {
      setError(err.message || "Failed to load quiz result.");
    } finally {
      setReviewLoading(false);
    }
  };

  const handleDeleteQuiz = async (sessionId) => {
    if (!window.confirm("Delete this quiz from history?")) return;
    try {
      await api.deleteHistory(sessionId);
      setQuizzes((prev) => prev.filter((q) => q.sessionId !== sessionId));
    } catch (err) {
      setError(err.message || "Failed to delete quiz.");
    }
  };

  // ── Note actions ──
  const handleOpenNote = async (id) => {
    try {
      const res = await api.getNote(id);
      setViewNote(res.note);
    } catch (err) {
      setError(err.message || "Failed to open note.");
    }
  };

  const handleExportNote = async (format) => {
    if (!viewNote) return;
    setViewNoteExporting(true);
    try {
      await api.exportNotes({ notes: viewNote, pdfName: viewNote.title, format });
    } catch (err) {
      setError(err.message || `Failed to export note (${format}).`);
    } finally {
      setViewNoteExporting(false);
    }
  };

  const handleDeleteNote = async (id) => {
    if (!window.confirm("Delete this note?")) return;
    try {
      await api.deleteNote(id);
      setNotes((prev) => prev.filter((n) => n._id !== id));
    } catch (err) {
      setError(err.message || "Failed to delete note.");
    }
  };

  // ── Flashcard actions ──
  const handleOpenSet = async (id) => {
    try {
      const res = await api.getFlashcardSet(id);
      setViewSet(res.set);
    } catch (err) {
      setError(err.message || "Failed to open set.");
    }
  };

  const handleDeleteSet = async (id) => {
    if (!window.confirm("Delete this flashcard set?")) return;
    try {
      await api.deleteFlashcardSet(id);
      setSets((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err.message || "Failed to delete set.");
    }
  };

  const handleUpdateSetCard = async (index, patch) => {
    if (!viewSet) return;
    try {
      const res = await api.updateFlashcard(viewSet.id, index, patch);
      setViewSet(res.set);
      loadAll();
    } catch (err) {
      setError(err.message || "Failed to update card.");
    }
  };

  const handleRegenerateSetCard = async (index) => {
    if (!viewSet) return;
    setSetBusy(true);
    try {
      const res = await api.regenerateFlashcard(viewSet.id, index);
      setViewSet(res.set);
      loadAll();
    } catch (err) {
      setError(err.message || "Failed to regenerate card.");
    } finally {
      setSetBusy(false);
    }
  };

  const filteredNotes = notes.filter((n) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (n.title || "").toLowerCase().includes(q) ||
      (n.subject || "").toLowerCase().includes(q) ||
      (n.topics || []).some((t) => String(t).toLowerCase().includes(q))
    );
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 animate-in fade-in duration-500">
      <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">History</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Your previously generated quizzes, study notes, and flashcard sets.
          </p>
        </div>
        <Link to="/">
          <Button variant="secondary" size="sm">← Back to Home</Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSearchParams(t.id === "quizzes" ? {} : { tab: t.id })}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === t.id
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none"
                : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-2 border-slate-100 dark:border-slate-800 hover:border-slate-200"
            }`}
          >
            {t.icon} {t.label}
            {t.id === "quizzes" && quizzes.length > 0 && (
              <span className="ml-1.5 opacity-70">({quizzes.length})</span>
            )}
            {t.id === "notes" && notes.length > 0 && (
              <span className="ml-1.5 opacity-70">({notes.length})</span>
            )}
            {t.id === "flashcards" && sets.length > 0 && (
              <span className="ml-1.5 opacity-70">({sets.length})</span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-400">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Quizzes tab ── */}
          {activeTab === "quizzes" && (
            <Card className="p-6 sm:p-8 border-slate-200 dark:border-slate-800 shadow-sm">
              <h2 className="mb-6 text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>📝</span> Quiz History
              </h2>
              {quizzes.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-slate-500 font-medium">No quizzes taken yet.</p>
                  <Link to="/" className="text-indigo-600 font-bold text-xs mt-2 block hover:underline">Generate your first quiz →</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {quizzes.map((item) => (
                    <div key={item.sessionId || item._id} className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 transition-all group">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {item.title || "Quiz Session"}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>{item.sourcePdfs?.[0]?.replace(/\.pdf$/i, "") || "Document"}</span>
                          <span>·</span>
                          <span>{item.totalQuestions} questions</span>
                          {item.difficulty && (<><span>·</span><DifficultyBadge difficulty={item.difficulty} /></>)}
                          <span>·</span>
                          <span>{formatDate(item.finishedAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          {item.scorePercent !== undefined && item.status === "completed" ? (
                            <div className={`text-sm font-black ${item.scorePercent >= 80 ? "text-emerald-600" : item.scorePercent >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                              {item.scorePercent}%
                            </div>
                          ) : (
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{item.status || "completed"}</div>
                          )}
                        </div>
                        <button
                          onClick={() => handleReviewQuiz(item.sessionId || item._id)}
                          disabled={reviewLoading}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all"
                        >
                          Review
                        </button>
                        <button
                          onClick={() => handleDeleteQuiz(item.sessionId || item._id)}
                          className="p-2 rounded-lg text-rose-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/30 transition-all"
                          title="Delete"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* ── Notes tab ── */}
          {activeTab === "notes" && (
            <Card className="p-6 sm:p-8 border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>📚</span> Generated Notes
                </h2>
                <input
                  type="search"
                  placeholder="Search notes…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full sm:w-64 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              {filteredNotes.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-slate-500 font-medium">
                    {notes.length === 0 ? "No notes generated yet." : "No notes match your search."}
                  </p>
                  <Link to="/" className="text-indigo-600 font-bold text-xs mt-2 block hover:underline">Generate study notes →</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredNotes.map((note) => (
                    <div key={note._id} className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 transition-all group">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{note.title}</div>
                          <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>{note.sourcePdfs?.[0]?.replace(/\.pdf$/i, "") || "Document"}</span>
                            <span>·</span>
                            <span>{formatDate(note.createdAt)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => handleOpenNote(note._id)} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all">
                            Open
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note._id)}
                            className="p-2 rounded-lg text-rose-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/30 transition-all"
                            title="Delete"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                          </button>
                        </div>
                      </div>
                      {Array.isArray(note.topics) && note.topics.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {note.topics.slice(0, 6).map((t, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                              {t}
                            </span>
                          ))}
                          {note.topics.length > 6 && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] font-bold">
                              +{note.topics.length - 6}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* ── Flashcards tab ── */}
          {activeTab === "flashcards" && (
            <Card className="p-6 sm:p-8 border-slate-200 dark:border-slate-800 shadow-sm">
              <h2 className="mb-6 text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>🃏</span> Flashcard Sets
              </h2>
              {sets.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-slate-500 font-medium">No flashcard sets yet.</p>
                  <Link to="/flashcards" className="text-indigo-600 font-bold text-xs mt-2 block hover:underline">Create your first set →</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {sets.map((set) => (
                    <div key={set.id} className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 transition-all group">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{set.title}</div>
                        <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>{set.sourcePdfs?.[0]?.replace(/\.pdf$/i, "") || "Document"}</span>
                          <span>·</span>
                          <DifficultyBadge difficulty={set.difficulty} />
                          <span>·</span>
                          <span>{set.totalCards} cards</span>
                          <span>·</span>
                          <span className={set.learnedCount === set.totalCards ? "text-emerald-600 dark:text-emerald-400" : ""}>
                            {set.learnedCount}/{set.totalCards} learned
                          </span>
                          <span>·</span>
                          <span>{formatDate(set.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => handleOpenSet(set.id)} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all">
                          Study
                        </button>
                        <button
                          onClick={() => handleDeleteSet(set.id)}
                          className="p-2 rounded-lg text-rose-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/30 transition-all"
                          title="Delete"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* Modals */}
      {reviewResult && <QuizReviewModal result={reviewResult} onClose={() => setReviewResult(null)} />}
      {viewNote && (
        <NoteViewerModal
          note={viewNote}
          exporting={viewNoteExporting}
          onClose={() => setViewNote(null)}
          onExport={handleExportNote}
        />
      )}
      {viewSet && (
        <ModalShell
          title={viewSet.title}
          subtitle={`${viewSet.totalCards ?? viewSet.cards?.length ?? 0} cards · ${viewSet.difficulty || "mixed"}`}
          onClose={() => setViewSet(null)}
          wide
        >
          <FlashcardDeck
            set={viewSet}
            onUpdateCard={handleUpdateSetCard}
            onRegenerateCard={handleRegenerateSetCard}
            busyRegenerating={setBusy}
          />
        </ModalShell>
      )}
    </div>
  );
}