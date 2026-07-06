import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import FlashcardDeck from "../components/FlashcardDeck";
import { api } from "../lib/api";

const COUNT_OPTIONS = ["5", "10", "15"];

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export default function Flashcards() {
  const inputRef = useRef(null);
  const deckRef = useRef(null);

  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState([]);              // [{ id, name, status, error, text, topics, chunks }]
  const [extractedText, setExtractedText] = useState("");
  const [topics, setTopics] = useState([]);
  const [chunks, setChunks] = useState([]);
  const [selectedTopicIds, setSelectedTopicIds] = useState(new Set());

  const [count, setCount] = useState("5");
  const [customCount, setCustomCount] = useState("");
  const [difficulty, setDifficulty] = useState("mixed");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [sets, setSets] = useState([]);
  const [activeSet, setActiveSet] = useState(null);
  const [busyRegenerating, setBusyRegenerating] = useState(false);

  const refreshSets = useCallback(async () => {
    try {
      const res = await api.getFlashcardSets();
      setSets(res.sets || []);
    } catch (err) {
      console.error("Failed to load flashcard sets:", err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getFlashcardSets();
        if (!cancelled) setSets(res.sets || []);
      } catch (err) {
        if (!cancelled) console.error("Failed to load flashcard sets:", err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const rebuildFromDocs = (docs) => {
    const text = docs.filter((d) => d.text).map((d) => d.text).join("\n\n");
    const detected = docs.flatMap((d) => d.topics || []);
    setExtractedText(text);
    setTopics(detected);
    setChunks(docs.flatMap((d) => d.chunks || []));
    setSelectedTopicIds(new Set(detected.map((t) => t.id)));
    setActiveSet(null);
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
    setLoading(true);

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
    setLoading(false);
    rebuildFromDocs(added.filter((d) => d.text));
  };

  const removeDoc = (id) => {
    const remaining = files.filter((d) => d.id !== id);
    setFiles(remaining);
    rebuildFromDocs(remaining.filter((d) => d.text));
  };

  const retryDoc = async (id) => {
    const doc = files.find((d) => d.id === id);
    if (!doc || !doc.raw) return;
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

  const toggleTopic = (id) => {
    setSelectedTopicIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const finalCount = customCount ? parseInt(customCount) : parseInt(count);

  const handleGenerate = async () => {
    if (!extractedText) return;
    if (!Number.isInteger(finalCount) || finalCount < 1 || finalCount > 100) {
      setError("Please enter a valid number of flashcards (1-100).");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const topicTitles = topics.filter((t) => selectedTopicIds.has(t.id)).map((t) => t.title).filter(Boolean);
      const res = await api.generateFlashcards({
        sourceText: extractedText,
        pdfNames: files.filter((d) => d.text).map((d) => d.name),
        count: finalCount,
        difficulty,
        topics: topicTitles,
        chunks,
      });

      setActiveSet(res.set);
      await refreshSets();
      setTimeout(() => deckRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err) {
      setError(err.message || "Failed to generate flashcards.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCard = async (index, patch) => {
    if (!activeSet) return;
    try {
      const res = await api.updateFlashcard(activeSet.id, index, patch);
      setActiveSet(res.set);
      refreshSets();
    } catch (err) {
      setError(err.message || "Failed to update card.");
    }
  };

  const handleRegenerateCard = async (index) => {
    if (!activeSet) return;
    setBusyRegenerating(true);
    try {
      const res = await api.regenerateFlashcard(activeSet.id, index);
      setActiveSet(res.set);
      refreshSets();
    } catch (err) {
      setError(err.message || "Failed to regenerate card.");
    } finally {
      setBusyRegenerating(false);
    }
  };

  const handleOpenSet = async (id) => {
    try {
      const res = await api.getFlashcardSet(id);
      setActiveSet(res.set);
      setTimeout(() => deckRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err) {
      setError(err.message || "Failed to open set.");
    }
  };

  const handleDeleteSet = async (id) => {
    if (!window.confirm("Delete this flashcard set?")) return;
    try {
      await api.deleteFlashcardSet(id);
      if (activeSet?.id === id) setActiveSet(null);
      refreshSets();
    } catch (err) {
      setError(err.message || "Failed to delete set.");
    }
  };

  const resetForm = () => {
    setFiles([]);
    setExtractedText("");
    setTopics([]);
    setChunks([]);
    setSelectedTopicIds(new Set());
    setActiveSet(null);
    setError("");
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 animate-in fade-in duration-500">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100">Flashcards</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          Turn any PDF into a set of study flashcards with AI.
        </p>
      </div>

      {error && (
        <div className="mb-8 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-400 flex items-center gap-3">
          <span className="text-xl">⚠️</span> {error}
        </div>
      )}

      <div className="space-y-8">
        {/* Upload */}
        <Card className="p-8 border-slate-200 dark:border-slate-800 shadow-sm" id="flashcard-upload-card">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">1</div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Upload Source</h2>
          </div>

          <div
            className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
              dragOver
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800"
            }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          >
            <div className="mb-3 text-4xl">🃏</div>
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {files.length > 0 ? "Add More Documents" : "Select PDF Documents"}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {files.length > 0 ? "Click to add more" : "Drag and drop or click to browse"}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">You can select multiple PDFs at once</div>
          </div>
          <input ref={inputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />

          {/* Uploaded document list */}
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
                      {doc.status === "ready" && <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">✓ Ready ({doc.topics.length} topics)</p>}
                      {doc.status === "error" && <p className="text-[10px] text-rose-500 font-medium">⚠ {doc.error}</p>}
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
        </Card>

        {/* Config */}
        {extractedText && (
          <Card className="p-8 border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center gap-3 mb-8">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">2</div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Customize Flashcards</h2>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              {/* Count */}
              <div>
                <label className="mb-3 block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Number of Flashcards</label>
                <div className="flex gap-2 mb-3">
                  {COUNT_OPTIONS.map((num) => (
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
                  max="100"
                  placeholder="Custom amount (max 100)..."
                  value={customCount}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || parseInt(val) >= 1) {
                      setCustomCount(val);
                      setCount("custom");
                    }
                  }}
                  className="w-full rounded-xl border-2 border-slate-100 bg-white px-4 py-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Difficulty */}
              <div>
                <label className="mb-3 block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Difficulty</label>
                <select
                  className="w-full rounded-xl border-2 border-slate-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  <option value="mixed">Mixed</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            {/* Topics */}
            {topics.length > 1 && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Topics</label>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {selectedTopicIds.size} of {topics.length} selected
                  </span>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {topics.map((topic) => {
                    const checked = selectedTopicIds.has(topic.id);
                    return (
                      <label
                        key={topic.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          checked
                            ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-900/20 dark:border-indigo-600"
                            : "border-slate-100 dark:border-slate-800 hover:border-slate-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 accent-indigo-600"
                          checked={checked}
                          onChange={() => toggleTopic(topic.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className={`text-sm font-semibold truncate ${checked ? "text-indigo-700 dark:text-indigo-300" : "text-slate-700 dark:text-slate-300"}`}>
                            {topic.title}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            ~{Math.round(topic.content.length / 5)} words
                            {topic.pageStart && topic.pageEnd && (
                              <span className="ml-1.5">· Pages {topic.pageStart}–{topic.pageEnd}</span>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col items-center pt-6">
              <Button
                id="generate-flashcards-btn"
                size="lg"
                className="w-full max-w-sm py-4 text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 dark:shadow-none disabled:opacity-50"
                disabled={loading || (topics.length > 1 && selectedTopicIds.size === 0)}
                onClick={handleGenerate}
              >
                {loading ? "Generating..." : "Generate Flashcards"}
              </Button>
            </div>
          </Card>
        )}

        {/* Active deck */}
        {activeSet && (
          <Card className="p-8 border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500" id="flashcard-deck-card">
            <div ref={deckRef} className="scroll-mt-24" />
            <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-lg">🃏</span>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">{activeSet.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                  {activeSet.difficulty}
                </span>
                <button
                  onClick={resetForm}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  ✕ Close
                </button>
              </div>
            </div>
            <FlashcardDeck
              set={activeSet}
              onUpdateCard={handleUpdateCard}
              onRegenerateCard={handleRegenerateCard}
              busyRegenerating={busyRegenerating}
            />
          </Card>
        )}

        {/* Saved sets */}
        <Card className="p-8 border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-lg">📚</span>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">My Flashcard Sets</h2>
            <span className="ml-auto text-[11px] text-slate-400 font-medium">{sets.length} saved</span>
          </div>

          {sets.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-500 font-medium">No flashcard sets yet.</p>
              <p className="text-xs text-slate-400 mt-1">Upload a PDF above and generate your first set.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sets.map((set) => (
                <div
                  key={set.id}
                  className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 transition-all group"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{set.title}</div>
                    <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{set.sourcePdfs?.[0]?.replace(/\.pdf$/i, "") || "Document"}</span>
                      <span>·</span>
                      <span>{set.difficulty}</span>
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
                    <button
                      onClick={() => handleOpenSet(set.id)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all"
                    >
                      Study
                    </button>
                    <button
                      onClick={() => handleDeleteSet(set.id)}
                      className="p-2 rounded-lg text-rose-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/30 transition-all"
                      title="Delete set"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}