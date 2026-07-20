import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";

// ─── Toggle Checkbox ────────────────────────────────────────────────────────
function ToggleRow({ id, label, description, checked, onChange, disabled }) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start justify-between gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all select-none
        ${checked
          ? "border-indigo-500/70 bg-indigo-50/60 dark:bg-indigo-900/20 dark:border-indigo-600/60"
          : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
        }
        ${disabled ? "opacity-40 cursor-not-allowed" : ""}
      `}
    >
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-semibold ${checked ? "text-indigo-700 dark:text-indigo-300" : "text-slate-700 dark:text-slate-300"}`}>
          {label}
        </div>
        {description && (
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">{description}</div>
        )}
      </div>
      {/* Custom toggle switch */}
      <div className="flex-shrink-0 mt-0.5">
        <input
          id={id}
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
        />
        <div
          className={`relative w-10 h-[22px] rounded-full transition-colors duration-200
            ${checked ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"}
          `}
        >
          <span
            className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200
              ${checked ? "translate-x-[18px]" : "translate-x-0"}
            `}
          />
        </div>
      </div>
    </label>
  );
}

// ─── Format Pill Tabs ────────────────────────────────────────────────────────
function FormatTabs({ value, onChange }) {
  const formats = [
    { id: "pdf",  label: "PDF",  icon: "📄", desc: "Ready to print" },
    { id: "docx", label: "DOCX", icon: "📝", desc: "Editable Word" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {formats.map((f) => (
        <button
          key={f.id}
          onClick={() => onChange(f.id)}
          className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 font-semibold transition-all
            ${value === f.id
              ? "border-indigo-500 bg-indigo-600 text-white shadow-lg shadow-indigo-200/60 dark:shadow-none"
              : "border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-200 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
            }
          `}
        >
          <span className="text-2xl leading-none">{f.icon}</span>
          <span className="text-sm">{f.label}</span>
          <span className={`text-[10px] font-normal ${value === f.id ? "text-indigo-100" : "text-slate-400"}`}>{f.desc}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Main Export Modal ────────────────────────────────────────────────────────
export default function ExportModal({ questions, pdfName, onClose }) {
  const [format, setFormat] = useState("pdf");
  const [settings, setSettings] = useState({
    includeAnswers:      true,
    includeExplanations: true,
    shuffleQuestions:    false,
    shuffleOptions:      false,
  });
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error, setError]       = useState("");
  const overlayRef              = useRef(null);

  // Close on ESC
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const toggleSetting = (key) =>
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleExport = async () => {
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      await api.exportQuiz({ questions, pdfName, format, settings });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || "Export failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    /* Overlay */
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

      {/* Modal panel */}
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Brand accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Export Quiz</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {questions.length} question{questions.length !== 1 ? "s" : ""}
              {pdfName && ` · ${pdfName.replace(/\.pdf$/i, "")}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-all text-lg"
          >
            ✕
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">

          {/* Format Selector */}
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Format</p>
            <FormatTabs value={format} onChange={setFormat} />
          </div>

          {/* Settings */}
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Options</p>
            <div className="space-y-2">
              <ToggleRow
                id="export-include-answers"
                label="Include Answers"
                description="Add an answer key section to the export"
                checked={settings.includeAnswers}
                onChange={() => toggleSetting("includeAnswers")}
              />
              <ToggleRow
                id="export-include-explanations"
                label="Include Explanations"
                description="Show explanation text for each question"
                checked={settings.includeExplanations}
                onChange={() => toggleSetting("includeExplanations")}
                disabled={!settings.includeAnswers}
              />
              <ToggleRow
                id="export-shuffle-questions"
                label="Shuffle Questions"
                description="Randomize the question order"
                checked={settings.shuffleQuestions}
                onChange={() => toggleSetting("shuffleQuestions")}
              />
              <ToggleRow
                id="export-shuffle-options"
                label="Shuffle Options"
                description="Randomize MCQ answer choices"
                checked={settings.shuffleOptions}
                onChange={() => toggleSetting("shuffleOptions")}
              />
            </div>
          </div>

          {/* Error / Success banners */}
          {error && (
            <div className="px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-sm font-medium flex items-center gap-2 animate-in slide-in-from-bottom-2">
              <span>⚠️</span> {error}
            </div>
          )}
          {success && (
            <div className="px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 text-sm font-medium flex items-center gap-2 animate-in slide-in-from-bottom-2">
              <span>✅</span> Download started!
            </div>
          )}

          {/* Export button */}
          <button
            id="export-confirm-btn"
            onClick={handleExport}
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60 text-white font-black text-sm uppercase tracking-[0.15em] shadow-lg shadow-indigo-200/70 dark:shadow-none transition-all flex items-center justify-center gap-2.5"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Generating {format.toUpperCase()}…
              </>
            ) : (
              <>
                <span>{format === "pdf" ? "📄" : "📝"}</span>
                Download {format.toUpperCase()}
              </>
            )}
          </button>

          <p className="text-center text-[10px] text-slate-400 dark:text-slate-600">
            File will be named: <span className="font-mono">Quiz_{(pdfName || "Quiz").replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30)}_{new Date().toISOString().slice(0, 10)}.{format}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
