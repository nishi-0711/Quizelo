import { useState } from "react";

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function Citation({ card }) {
  if (!card) return null;
  const bits = [];
  if (card.sourcePdf) bits.push(`📄 ${card.sourcePdf.replace(/\.pdf$/i, "")}`);
  if (card.topic) bits.push(card.topic);
  if (card.page) bits.push(`Page ${card.page}`);
  if (card.startLine && card.endLine) bits.push(`Lines ${card.startLine}–${card.endLine}`);
  if (bits.length === 0) return null;
  return (
    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
      {bits.join(" · ")}
    </p>
  );
}

export default function FlashcardDeck({ set, onUpdateCard, onRegenerateCard, busyRegenerating = false }) {
  const cards = set?.cards || [];
  const total = cards.length;

  const [order, setOrder] = useState(() => cards.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (total === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">This set has no cards.</p>;
  }

  const cardIndex = order[Math.min(pos, order.length - 1)];
  const card = cards[cardIndex];
  const learnedCount = cards.filter((c) => c.learned).length;
  const progressPct = total > 0 ? Math.round((learnedCount / total) * 100) : 0;

  const goTo = (nextPos) => {
    setPos(Math.max(0, Math.min(nextPos, total - 1)));
    setFlipped(false);
  };

  const toggleLearned = () => {
    if (!onUpdateCard) return;
    onUpdateCard(cardIndex, { learned: !card.learned });
    if (!card.learned && pos < total - 1) {
      setPos((p) => Math.min(p + 1, total - 1));
      setFlipped(false);
    }
  };

  const toggleDifficult = () => {
    if (!onUpdateCard) return;
    onUpdateCard(cardIndex, { difficult: !card.difficult });
  };

  return (
    <div className="w-full">
      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
          <span>📈 Progress</span>
          <span className="tabular-nums">{learnedCount}/{total} learned · {progressPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="mb-5 select-none" style={{ perspective: "1400px" }}>
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="block w-full text-left"
          aria-label="Flip card"
        >
          <div
            className="relative w-full transition-transform duration-500"
            style={{
              transformStyle: "preserve-3d",
              transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            }}
          >
            {/* Front */}
            <div
              className="min-h-[260px] rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-6 flex flex-col"
              style={{ backfaceVisibility: "hidden" }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                  Card {pos + 1} of {total}
                </span>
                {card.difficult && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 text-[10px] font-bold">
                    ⚠️ Difficult
                  </span>
                )}
              </div>
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <p className="text-xl font-bold text-slate-900 dark:text-white leading-relaxed">{card.front}</p>
                <p className="mt-4 text-[11px] text-slate-400 font-semibold">👆 Tap card to flip</p>
              </div>
              {card.topic && (
                <span className="self-start px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">
                  {card.topic}
                </span>
              )}
            </div>

            {/* Back */}
            <div
              className="absolute inset-0 min-h-[260px] rounded-2xl border-2 border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/30 shadow-lg p-6 flex flex-col"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              <div className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-3">
                Answer
              </div>
              <p className="text-lg font-bold text-slate-900 dark:text-white leading-relaxed">{card.back}</p>
              {card.explanation && (
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic">
                  💡 {card.explanation}
                </p>
              )}
              <div className="mt-auto pt-4 border-t border-indigo-100 dark:border-indigo-900/40">
                <Citation card={card} />
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={() => goTo(pos - 1)}
          disabled={pos === 0}
          className="px-4 py-2 rounded-xl border-2 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-all"
        >
          ← Prev
        </button>

        <button
          onClick={() => setOrder(shuffleArray(order))}
          className="px-4 py-2 rounded-xl border-2 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          🔀 Shuffle
        </button>

        <button
          onClick={toggleLearned}
          className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
            card.learned
              ? "bg-emerald-600 border-emerald-600 text-white"
              : "border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
          }`}
        >
          {card.learned ? "✓ Learned" : "Mark Learned"}
        </button>

        <button
          onClick={toggleDifficult}
          className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
            card.difficult
              ? "bg-rose-600 border-rose-600 text-white"
              : "border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          }`}
        >
          ⚠️ {card.difficult ? "Difficult" : "Mark Difficult"}
        </button>

        <button
          onClick={() => onRegenerateCard && onRegenerateCard(cardIndex)}
          disabled={busyRegenerating || !onRegenerateCard}
          className="px-4 py-2 rounded-xl border-2 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-all"
        >
          {busyRegenerating ? "Regenerating…" : "♻️ Regenerate"}
        </button>

        <button
          onClick={() => goTo(pos + 1)}
          disabled={pos === total - 1}
          className="px-4 py-2 rounded-xl border-2 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-all"
        >
          Next →
        </button>
      </div>
    </div>
  );
}