import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import NotesView from "../components/NotesView";
import { api } from "../lib/api";

export default function StudyNotes() {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState([]);           // [{ id, name, raw, status, error, text, topics, chunks }]
  const [extractedText, setExtractedText] = useState("");

  const [phase, setPhase] = useState("idle");       // idle | loading | ready | exporting
  const [notes, setNotes] = useState(null);
  const [error, setError] = useState("");

  const rebuildFromDocs = (docs) => {
    const text = docs.filter((d) => d.text).map((d) => d.text).join("\n\n");
    setExtractedText(text);
    setNotes(null);
    setPhase("idle");
  };

  const handleFiles = async (fileList) => {
    const incoming = Array.from(fileList || []).filter(
      (f) => f.type === "application/pdf" && !files.some((d) => d.name === f.name)
    );
    if (incoming.length === 0) {
      setError("Please add a valid PDF file (or it is already in the list).");
      return;
    }
    setError("");
    setPhase("loading");

    const added = [];
    for (const f of incoming) {
      const entry = { id: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: f.name, raw: f, status: "processing", error: "", text: "", topics: [], chunks: [] };
      added.push(entry);
      setFiles((prev) => [...prev, entry]);
      try {
        const res = await api.extractPdfs([f]);
        const d = res.documents?.[0];
        if (d?.text) {
          entry.text = d.text;
          entry.topics = d.topics || [];
          entry.chunks = d.chunks || [];
          entry.status = "ready";
        } else {
          entry.status = "error";
          entry.error = "No extractable text found in this PDF.";
        }
      } catch (err) {
        entry.status = "error";
        entry.error = err.message || "Failed to extract text from PDF.";
      }
      setFiles((prev) => prev.map((x) => (x.id === entry.id ? { ...x, ...entry } : x)));
    }
    setPhase("idle");
    rebuildFromDocs(added.filter((d) => d.text));
  };

  const removeDoc = (id) => {
    const remaining = files.filter((d) => d.id !== id);
    setFiles(remaining);
    rebuildFromDocs(remaining.filter((d) => d.text));
  };

  const retryDoc = async (id) => {
    const doc = files.find((d) => d.id === id);
    if (!doc?.raw) return;
    setError("");
    setFiles((prev) => prev.map((d) => (d.id === id ? { ...d, status: "processing", error: "" } : d)));
    try {
      const res = await api.extractPdfs([doc.raw]);
      const d = res.documents?.[0];
      const updated = d?.text
        ? { ...doc, status: "ready", text: d.text, topics: d.topics || [], chunks: d.chunks || [], error: "" }
        : { ...doc, status: "error", error: "No extractable text found in this PDF." };
      setFiles((prev) => prev.map((x) => (x.id === id ? updated : x)));
      rebuildFromDocs([...files.map((x) => (x.id === id ? updated : x))].filter((x) => x.text));
    } catch (err) {
      setFiles((prev) => prev.map((x) => (x.id === id ? { ...x, status: "error", error: err.message || "Failed to extract text from PDF." } : x)));
    }
  };

  const handleGenerate = async () => {
    if (!extractedText) return;
    setPhase("loading");
    setError("");
    try {
      const pdfNames = files.filter((d) => d.text).map((d) => d.name);
      const result = await api.generateNotes(extractedText, pdfNames);
      setNotes(result);
      setPhase("ready");
    } catch (err) {
      setError(err.message || "Failed to generate study notes. Please try again.");
      setPhase("idle");
    }
  };

  const handleExport = async (format) => {
    if (!notes) return;
    setPhase("exporting");
    setError("");
    try {
      await api.exportNotes({ notes, pdfName: notes.title, format });
    } catch (err) {
      setError(err.message || `Export failed (${format}).`);
    } finally {
      setPhase("ready");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 animate-in fade-in duration-500">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100">Study Notes</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          Turn any PDF into structured study notes with AI — saved to your notes library automatically.
        </p>
      </div>

      {error && (
        <div className="mb-8 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-400 flex items-center gap-3">
          <span className="text-xl">⚠️</span> {error}
        </div>
      )}

      <div className="space-y-8">
        {/* Upload */}
        <Card className="p-8 border-slate-200 dark:border-slate-800 shadow-sm">
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
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800"
            }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          >
            <div className="mb-3 text-4xl">📖</div>
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {files.length > 0 ? "Add More Documents" : "Select PDF Documents"}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {files.length > 0 ? "Click to add more" : "Drag and drop or click to browse"}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">You can select multiple PDFs at once</div>
          </div>
          <input ref={inputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />

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
                      {doc.status === "processing" && <p className="text-[10px] text-slate-400 font-medium">Extracting text…</p>}
                      {doc.status === "ready" && <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">✓ Ready</p>}
                      {doc.status === "error" && <p className="text-[10px] text-rose-500 font-medium">⚠ {doc.error}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {doc.status === "error" && (
                      <button onClick={() => retryDoc(doc.id)} className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all">
                        Retry
                      </button>
                    )}
                    <button onClick={() => removeDoc(doc.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30 transition-all" title={`Remove ${doc.name}`}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Generate */}
        {extractedText && phase !== "ready" && phase !== "exporting" && (
          <Card className="p-8 border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">2</div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Generate Notes</h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              The AI will analyze {files.filter((d) => d.text).length > 1 ? `your ${files.filter((d) => d.text).length} documents` : "your document"} and create chapter-wise
              summaries, key concepts, definitions, formulas, and quick revision notes — grounded only in the uploaded content.
            </p>
            <div className="flex flex-col items-center">
              <Button
                id="generate-notes-btn"
                size="lg"
                className="w-full max-w-sm py-4 text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 dark:shadow-none disabled:opacity-50"
                disabled={phase === "loading"}
                onClick={handleGenerate}
              >
                {phase === "loading" ? "Generating..." : "Generate Study Notes"}
              </Button>
            </div>
          </Card>
        )}

        {/* Loading */}
        {phase === "loading" && !notes && (
          <Card className="p-8 border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <div className="relative">
                <div className="h-14 w-14 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-xl">📚</div>
              </div>
              <div className="text-center">
                <p className="font-bold text-slate-700 dark:text-slate-300">Analyzing document{files.length > 1 ? "s" : ""}...</p>
                <p className="text-sm text-slate-400 mt-1">The AI is reading your PDFs and creating structured notes</p>
              </div>
            </div>
          </Card>
        )}

        {/* Ready */}
        {phase === "ready" && notes && (
          <Card className="p-6 sm:p-8 border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
            <NotesView notes={notes} onExport={handleExport} exporting={phase === "exporting"} />
          </Card>
        )}

        {/* Empty state */}
        {files.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm text-slate-500 font-medium">Upload a PDF above to get started.</p>
            <Link to="/history?tab=notes" className="text-indigo-600 font-bold text-xs mt-2 block hover:underline">
              Or browse your saved notes →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}