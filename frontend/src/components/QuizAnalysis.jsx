import { Card } from "./Card";

// ─── Shared label/color maps ──────────────────────────────────────────────────

const TYPE_LABELS = { mcq: "MCQ", true_false: "True/False", fill_blank: "Fill Blank", short_answer: "Short Answer" };
const BLOOM_LABELS = { remember: "Remember", understand: "Understand", apply: "Apply", analyze: "Analyze", evaluate: "Evaluate", create: "Create" };
const BLOOM_COLORS = {
  remember:   "bg-sky-500",
  understand: "bg-indigo-500",
  apply:      "bg-violet-500",
  analyze:    "bg-amber-500",
  evaluate:   "bg-orange-500",
  create:     "bg-rose-500",
};

function MiniBar({ value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-bold tabular-nums text-slate-400 w-6 text-right">{value}</span>
    </div>
  );
}

// ─── Difficulty / type / Bloom breakdown ──────────────────────────────────────

export function DifficultyDashboard({ questions }) {
  if (!questions || questions.length === 0) return null;

  const easy   = questions.filter(q => q.difficulty === "easy").length;
  const medium = questions.filter(q => q.difficulty === "medium").length;
  const hard   = questions.filter(q => q.difficulty === "hard").length;
  const total  = questions.length;

  // Avg difficulty score: easy=1, medium=2, hard=3
  const avgScore = ((easy * 1 + medium * 2 + hard * 3) / total).toFixed(2);

  // Type distribution
  const typeCounts = {};
  questions.forEach(q => { typeCounts[q.type] = (typeCounts[q.type] || 0) + 1; });

  // Bloom distribution (only if at least one question has bloom)
  const hasBloom = questions.some(q => q.bloom);
  const bloomCounts = {};
  if (hasBloom) questions.forEach(q => { if (q.bloom) bloomCounts[q.bloom] = (bloomCounts[q.bloom] || 0) + 1; });

  return (
    <Card className="p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-lg">📊</span>
        <h3 className="font-black text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider">Quiz Analysis</h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Easy",    count: easy,   color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/40" },
          { label: "Medium",  count: medium, color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/40" },
          { label: "Hard",    count: hard,   color: "text-rose-600 dark:text-rose-400",     bg: "bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-900/40" },
          { label: "Avg Score", count: avgScore, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/40" },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className={`rounded-xl border p-3 text-center ${bg}`}>
            <div className={`text-2xl font-black ${color}`}>{count}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        {/* Question Type Distribution */}
        <div>
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Question Types</h4>
          <div className="space-y-2">
            {Object.entries(TYPE_LABELS).filter(([t]) => typeCounts[t] > 0).map(([type, label]) => (
              <div key={type}>
                <div className="flex justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                  <span>{label}</span>
                </div>
                <MiniBar value={typeCounts[type] || 0} max={total} color="bg-indigo-500" />
              </div>
            ))}
          </div>
        </div>

        {/* Bloom's Taxonomy */}
        {hasBloom && (
          <div>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Bloom's Taxonomy</h4>
            <div className="space-y-2">
              {Object.entries(BLOOM_LABELS).filter(([b]) => bloomCounts[b] > 0).map(([bloom, label]) => (
                <div key={bloom}>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">{label}</div>
                  <MiniBar value={bloomCounts[bloom] || 0} max={total} color={BLOOM_COLORS[bloom] || "bg-indigo-500"} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Topic performance (strong / weak / recommended revision) ─────────────────

export function WeakTopicAnalysis({ questions, userAnswers, onRetryWeakTopics }) {
  if (!questions || questions.length === 0) return null;

  // Build per-topic stats
  const topicMap = {};
  questions.forEach((q, idx) => {
    const topic = q.source?.topic || q.source?.section || "General";
    if (!topicMap[topic]) topicMap[topic] = { topic, correct: 0, total: 0, pages: new Set(), chunkId: q.source?.chunkId };
    topicMap[topic].total++;
    if (q.source?.page) topicMap[topic].pages.add(q.source.page);
    const ua = userAnswers[idx];
    const correct =
      q.type === "mcq" ? ua === q.answerIndex :
      q.type === "true_false" ? ua === q.answer :
      String(ua || "").trim().toLowerCase() === String(q.answer || "").trim().toLowerCase();
    if (correct) topicMap[topic].correct++;
  });

  const stats = Object.values(topicMap).map(t => ({
    ...t,
    accuracy: Math.round((t.correct / t.total) * 100),
    pages: [...t.pages].sort((a, b) => a - b),
  })).sort((a, b) => a.accuracy - b.accuracy);

  const weak   = stats.filter(t => t.accuracy < 60);
  const medium = stats.filter(t => t.accuracy >= 60 && t.accuracy < 80);
  const strong = stats.filter(t => t.accuracy >= 80);

  const weakPages = [...new Set(weak.flatMap(t => t.pages))].sort((a, b) => a - b);

  function statusIcon(acc) {
    if (acc >= 80) return { icon: "✅", color: "text-emerald-600 dark:text-emerald-400" };
    if (acc >= 60) return { icon: "⚠️",  color: "text-amber-600 dark:text-amber-400" };
    return { icon: "❌",  color: "text-rose-600 dark:text-rose-400" };
  }

  return (
    <Card className="p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 mt-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-lg">🎯</span>
        <h3 className="font-black text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider">Topic Performance</h3>
      </div>

      <div className="space-y-2 mb-5">
        {stats.map((t) => {
          const { icon, color } = statusIcon(t.accuracy);
          return (
            <div key={t.topic} className="flex items-center justify-between gap-3 py-2 border-b border-slate-50 dark:border-slate-800 last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm">{icon}</span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{t.topic}</span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="w-24 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      t.accuracy >= 80 ? "bg-emerald-500" : t.accuracy >= 60 ? "bg-amber-500" : "bg-rose-500"
                    }`}
                    style={{ width: `${t.accuracy}%` }}
                  />
                </div>
                <span className={`text-xs font-black tabular-nums w-8 text-right ${color}`}>{t.accuracy}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2 mb-5">
        {strong.length > 0 && <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">{strong.length} Strong</span>}
        {medium.length > 0 && <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[11px] font-bold">{medium.length} Medium</span>}
        {weak.length > 0   && <span className="px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-[11px] font-bold">{weak.length} Weak</span>}
      </div>

      {/* Recommended revision pages */}
      {weakPages.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-100 dark:border-amber-900/40 mb-4">
          <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Recommended Revision</p>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            {weakPages.length <= 8
              ? `Pages: ${weakPages.join(", ")}`
              : `Pages: ${weakPages.slice(0, 8).join(", ")} +${weakPages.length - 8} more`}
          </p>
          {weak.map(t => (
            <p key={t.topic} className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
              {t.topic} — {t.accuracy}% accuracy
            </p>
          ))}
        </div>
      )}

      {/* Retry weak topics */}
      {weak.length > 0 && onRetryWeakTopics && (
        <button
          id="retry-weak-topics-btn"
          onClick={() => onRetryWeakTopics(weak)}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:from-indigo-700 hover:to-violet-700 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
        >
          <span>🔁</span> Generate Quiz on Weak Topics
        </button>
      )}
    </Card>
  );
}

// ─── Full quiz analysis (shown after the quiz is completed) ───────────────────

function isAnswerCorrect(q, ua) {
  if (q.type === "mcq") return ua === q.answerIndex;
  if (q.type === "true_false") return ua === q.answer;
  return String(ua ?? "").trim().toLowerCase() === String(q.answer ?? "").trim().toLowerCase();
}

function formatAnswer(q, ua) {
  if (ua === undefined || ua === null || ua === "") return "—";
  if (q.type === "mcq" && Array.isArray(q.options)) {
    const opt = q.options[ua];
    return opt !== undefined ? `${String.fromCharCode(65 + ua)}. ${opt}` : String(ua);
  }
  if (q.type === "true_false") return ua ? "True" : "False";
  return String(ua);
}

function formatDuration(sec) {
  if (sec === null || sec === undefined || Number.isNaN(sec)) return null;
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export default function QuizAnalysis({ questions, userAnswers = {}, durationSec = null, onRetryWeakTopics }) {
  if (!questions || questions.length === 0) return null;

  const verdicts = questions.map((q, idx) => ({
    idx,
    q,
    ua: userAnswers[idx],
    correct: isAnswerCorrect(q, userAnswers[idx]),
  }));

  const correctCount = verdicts.filter((v) => v.correct).length;
  const incorrectCount = verdicts.length - correctCount;
  const accuracy = Math.round((correctCount / verdicts.length) * 100);
  const timeLabel = formatDuration(durationSec);

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <Card className="p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="flex items-center gap-2 mb-5">
          <span className="text-lg">🧠</span>
          <h3 className="font-black text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider">Quiz Analysis</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-900/40 p-3 text-center">
            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{correctCount}/{verdicts.length}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Score</div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 dark:bg-slate-800/60 dark:border-slate-800 p-3 text-center">
            <div className="text-2xl font-black text-slate-700 dark:text-slate-200">{accuracy}%</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Accuracy</div>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-900/40 p-3 text-center">
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{correctCount}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Correct</div>
          </div>
          <div className="rounded-xl border border-rose-100 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-900/40 p-3 text-center">
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400">{incorrectCount}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Incorrect</div>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-900/40 p-3 text-center col-span-2 sm:col-span-1">
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{timeLabel ?? "—"}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Time Taken</div>
          </div>
        </div>
      </Card>

      {/* Per-question verdicts */}
      <Card className="p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">✅</span>
          <h3 className="font-black text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider">Answer Breakdown</h3>
        </div>
        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
          {verdicts.map(({ idx, q, ua, correct }) => (
            <div
              key={idx}
              className={`rounded-xl border p-3.5 ${correct
                ? "border-emerald-100 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-900/10"
                : "border-rose-100 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-900/10"}`}
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex-shrink-0 text-sm">{correct ? "✅" : "❌"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug">{q.question}</p>
                  <div className="mt-1.5 space-y-0.5 text-xs">
                    <p className="text-slate-500 dark:text-slate-400">
                      <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Your answer: </span>
                      {formatAnswer(q, ua)}
                    </p>
                    {!correct && (
                      <p className="text-emerald-700 dark:text-emerald-400">
                        <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Correct: </span>
                        {formatAnswer(q, q.answerIndex !== undefined ? q.answerIndex : q.answer)}
                      </p>
                    )}
                    <p className="text-slate-400 dark:text-slate-500 italic mt-1 line-clamp-2">{q.explanation}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Difficulty + type breakdown */}
      <DifficultyDashboard questions={questions} />

      {/* Topic-wise performance */}
      <WeakTopicAnalysis questions={questions} userAnswers={userAnswers} onRetryWeakTopics={onRetryWeakTopics} />
    </div>
  );
}