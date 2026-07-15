import { useState } from "react";

function SectionCard({ sec, index }) {
  const [open, setOpen] = useState(index === 0);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-black">
            {index + 1}
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{sec.chapter}</span>
          {sec.source?.pdfName && (
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] font-bold truncate max-w-[160px]">
              {sec.source.pdfName.replace(/\.pdf$/i, "")}
            </span>
          )}
        </div>
        <svg
          className={`flex-shrink-0 w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-slate-100 dark:border-slate-800 pt-4 animate-in slide-in-from-top-1 duration-200">
          {sec.summary && (
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed italic">{sec.summary}</p>
          )}

          {Array.isArray(sec.keyConcepts) && sec.keyConcepts.length > 0 && (
            <div>
              <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2">Key Concepts</h4>
              <div className="flex flex-wrap gap-2">
                {sec.keyConcepts.map((c, i) => (
                  <span key={i} className="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{c}</span>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(sec.definitions) && sec.definitions.length > 0 && (
            <div>
              <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2">Definitions</h4>
              <div className="space-y-2">
                {sec.definitions.map((d, i) => (
                  <div key={i} className="pl-3 border-l-2 border-indigo-200 dark:border-indigo-800">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">{d.term}: </span>
                    <span className="text-sm text-slate-600 dark:text-slate-400">{d.definition}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(sec.formulas) && sec.formulas.length > 0 && (
            <div>
              <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2">Formulas</h4>
              <div className="space-y-2">
                {sec.formulas.map((f, i) => (
                  <div key={i} className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-950 border border-slate-700 font-mono text-sm text-emerald-400">{f}</div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(sec.keyTakeaways) && sec.keyTakeaways.length > 0 && (
            <div>
              <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2">Key Takeaways</h4>
              <ul className="space-y-1.5">
                {sec.keyTakeaways.map((tk, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    {tk}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sec.source?.pages?.length > 0 && (
            <p className="text-[10px] text-slate-400 font-medium">
              📄 Pages: {sec.source.pages.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function NotesView({ notes, onExport, exporting = false }) {
  if (!notes) return null;
  return (
    <div className="space-y-5">
      {/* Notes metadata */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 border border-indigo-100 dark:border-indigo-900/40">
        <h3 className="font-black text-lg text-slate-900 dark:text-white mb-1">{notes.title}</h3>
        {notes.subject && <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">{notes.subject}</p>}
        {Array.isArray(notes.sourcePdfs) && notes.sourcePdfs.length > 0 && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            From: {notes.sourcePdfs.join(", ")}
          </p>
        )}
        <p className="text-xs text-slate-400 mt-1">{notes.sections?.length ?? 0} sections · {notes.quickRevision?.length ?? 0} quick revision points</p>
        {notes.saved && (
          <p className="mt-1.5 inline-block px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
            💾 Saved to your Notes library
          </p>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {(notes.sections || []).map((sec, i) => (
          <SectionCard key={i} sec={sec} index={i} />
        ))}
      </div>

      {/* Quick Revision */}
      {Array.isArray(notes.quickRevision) && notes.quickRevision.length > 0 && (
        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3">
            <h3 className="text-white font-black text-sm uppercase tracking-widest">⚡ Quick Revision</h3>
          </div>
          <div className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
            {notes.quickRevision.map((item, i) => (
              <div key={i} className={`flex items-start gap-3 px-5 py-3 ${i % 2 === 0 ? "bg-slate-50/60 dark:bg-slate-800/30" : ""}`}>
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[10px] font-black flex items-center justify-center mt-0.5">{i + 1}</span>
                <p className="text-sm text-slate-700 dark:text-slate-300">{item}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export actions */}
      {onExport && (
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button
            id="notes-export-pdf"
            disabled={exporting}
            onClick={() => onExport("pdf")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 disabled:opacity-50 transition-all"
          >
            <span>📄</span> Export PDF
          </button>
          <button
            id="notes-export-docx"
            disabled={exporting}
            onClick={() => onExport("docx")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-50 dark:hover:bg-indigo-950/30 disabled:opacity-50 transition-all"
          >
            <span>📝</span> Export DOCX
          </button>
        </div>
      )}
    </div>
  );
}