import { Card } from "./Card";

export const ProgressBar = ({ current, total }) => {
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

export const QuestionCard = ({ question, index, total, onAnswer, currentAnswer, reviewMode, onViewSource }) => {
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

      {question.source && (
        <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/20 overflow-hidden">
          {/* Citation bar */}
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-base leading-none">📖</span>
              <div className="min-w-0">
                <span className="block text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider truncate">
                  {question.source.pdfName ? `${question.source.pdfName} — ` : ""}{question.source.topic || question.source.section}
                </span>
                <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Page {question.source.page}
                  {(question.source.startLine && question.source.endLine) && (
                    <> &middot; Lines {question.source.startLine}–{question.source.endLine}</>
                  )}
                </span>
              </div>
            </div>
            {reviewMode && (
              <button
                onClick={() => onViewSource && onViewSource(question)}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
              >
                View Source
              </button>
            )}
          </div>
        </div>
      )}

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