"use strict";

const { GoogleGenerativeAI } = require("@google/generative-ai");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Model fallback chain (same strategy as quiz/notes services) ──────────────
const MODEL_CHAIN = [
  process.env.GEMINI_MODEL || "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
];

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    const err = new Error(`${name} is required`);
    err.statusCode = 500;
    throw err;
  }
  return v;
}

function buildChunksBlock(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) return "";
  return (
    `SOURCE CHUNKS (cite page/line numbers from these entries ONLY):\n` +
    chunks
      .map((c) => {
        const docInfo = c.pdfName ? `, pdfName: "${c.pdfName}"` : "";
        const lineInfo = c.startLine && c.endLine ? `, startLine: ${c.startLine}, endLine: ${c.endLine}` : "";
        return `[chunkId: "${c.chunkId}"${docInfo}, page: ${c.page}, section: "${c.section}"${lineInfo}]\nText: "${c.text}"`;
      })
      .join("\n\n") +
    "\n\n"
  );
}

function makeFlashcardPrompt({ sourceText, pdfNames, count, difficulty, topics, chunks }) {
  const clipped = sourceText.trim().slice(0, 100000);
  const docs = Array.isArray(pdfNames) && pdfNames.length > 0 ? pdfNames : [];
  const docLabel =
    docs.length === 1
      ? docs[0].replace(/\.pdf$/i, "").replace(/_/g, " ")
      : docs.length > 1
        ? docs.map((d) => d.replace(/\.pdf$/i, "").replace(/_/g, " ")).join(", ")
        : "the document";
  const docListBlock =
    docs.length > 1
      ? `SOURCE DOCUMENTS (in order):\n${docs.map((d, i) => `  ${i + 1}. "${d}"`).join("\n")}\n\n`
      : "";

  const topicBlock =
    Array.isArray(topics) && topics.length > 0
      ? `TOPIC RESTRICTION:\nGenerate cards ONLY about these topics:\n${topics
          .map((t, i) => `  ${i + 1}. ${t}`)
          .join("\n")}\nDo not use information outside these topics.\n\n`
      : "";

  const diffRule =
    difficulty === "mixed"
      ? "Use a mix of easy, medium, and hard concepts across the set."
      : `All cards must target "${difficulty}" difficulty.`;

  return `
You are an expert study assistant. Your task is to create a set of flashcards from the source text below.

SOURCE DOCUMENT: "${docLabel}"
${docListBlock}${topicBlock}${buildChunksBlock(chunks)}SOURCE TEXT:
"""
${clipped}
"""

TASK:
Create EXACTLY ${count} flashcards. ${diffRule}
Each card captures a key concept, term, fact, formula, or question from the source text.

OUTPUT FORMAT:
Return a single JSON object:
{
  "title": "string — concise title for this flashcard set (e.g. 'Key Concepts from <document>')",
  "cards": [
    {
      "front": "string — the question or concept prompt shown on the front of the card",
      "back": "string — the concise answer shown on the back of the card",
      "explanation": "string — 1-2 sentence short explanation of the answer",
      "topic": "string — the section/topic name this card belongs to",
      "chunkId": "string — the chunkId of the source chunk this card is based on (omit if no chunks list was provided)",
      "page": "number — page number of the source chunk this card is based on (omit if unknown)",
      "startLine": "number — startLine of the source chunk (omit if unknown)",
      "endLine": "number — endLine of the source chunk (omit if unknown)"
    }
  ]
}

STRICT RULES:
- Only use information from the source text. No outside knowledge.
- If a chunks list was provided above, the "chunkId", "page", "startLine", "endLine", and "topic" fields MUST be copied exactly from the matching chunk entry. Otherwise omit them.
- Front must be a self-contained prompt (a reader should know what is being asked without seeing the back).
- Back must be concise (1-3 sentences max).
- No duplicate cards.
- Response MUST be pure JSON. No markdown, no code fences.
`.trim();
}

function parseCardsJSON(raw) {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  const parsed = JSON.parse(text);
  if (!parsed.cards || !Array.isArray(parsed.cards) || parsed.cards.length === 0) {
    throw new Error("Flashcards JSON missing 'cards' array");
  }
  return parsed;
}

function sanitizeCards(rawCards) {
  const cards = [];
  for (const c of rawCards || []) {
    const front = String(c.front || "").trim();
    const back = String(c.back || "").trim();
    if (front.length < 3 || back.length < 1) continue;

    const page = Number.isFinite(Number(c.page)) ? Number(c.page) : null;
    const startLine = Number.isFinite(Number(c.startLine)) ? Number(c.startLine) : null;
    const endLine = Number.isFinite(Number(c.endLine)) ? Number(c.endLine) : null;

    cards.push({
      front,
      back,
      explanation: String(c.explanation || "").trim(),
      topic: String(c.topic || "").trim(),
      chunkId: String(c.chunkId || "").trim(),
      page,
      startLine,
      endLine,
    });
  }
  return cards;
}

/**
 * Ground every card against the chunk list: when a card cites a chunkId (or its
 * topic matches a chunk), overwrite source metadata from the authoritative chunk
 * so document identity, page, and line numbers are never invented.
 */
function groundCards(cards, chunks, fallbackPdfName) {
  const chunkByTopic = new Map();
  for (const c of chunks || []) {
    if (c.topicId && !chunkByTopic.has(c.topicId)) chunkByTopic.set(c.topicId, c);
  }

  return cards.map((card) => {
    let chunk = null;
    if (card.chunkId && chunks) chunk = chunks.find((c) => c.chunkId === card.chunkId) || null;
    if (!chunk && card.topic && chunkByTopic.has(card.topic)) chunk = chunkByTopic.get(card.topic);

    if (chunk) {
      return {
        ...card,
        sourcePdf: chunk.pdfName || fallbackPdfName || "",
        topic: chunk.section || card.topic,
        page: chunk.page ?? card.page,
        startLine: chunk.startLine ?? card.startLine,
        endLine: chunk.endLine ?? card.endLine,
        sourceText: typeof chunk.text === "string" ? chunk.text.slice(0, 2000) : "",
      };
    }

    return { ...card, sourcePdf: fallbackPdfName || "", sourceText: "" };
  });
}

async function callModel(prompt, modelName) {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: "application/json" },
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function generateFlashcards({ sourceText, pdfNames, pdfName, count, difficulty, topics = [], chunks = [] }) {
  if (typeof sourceText !== "string" || sourceText.trim().length < 50) {
    const err = new Error("sourceText must be at least 50 characters of extracted PDF text");
    err.statusCode = 400;
    throw err;
  }

  const n = Number(count);
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    const err = new Error("count must be an integer between 1 and 100");
    err.statusCode = 400;
    throw err;
  }

  const names = (Array.isArray(pdfNames) && pdfNames.length > 0 ? pdfNames : pdfName ? [pdfName] : []).slice(0, 10);

  const prompt = makeFlashcardPrompt({
    sourceText: sourceText.trim(),
    pdfNames: names,
    count: n,
    difficulty: ["easy", "medium", "hard", "mixed"].includes(difficulty) ? difficulty : "mixed",
    topics,
    chunks,
  });

  let lastError;
  for (const modelName of MODEL_CHAIN) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[flashcardService] model=${modelName} attempt=${attempt}`);
        const raw = await callModel(prompt, modelName);
        const parsed = parseCardsJSON(raw);
        const cards = groundCards(sanitizeCards(parsed.cards), chunks, names[0] || "");
        if (cards.length === 0) {
          console.error("[flashcardService] raw output:", raw.slice(0, 2000));
          throw new Error("No valid cards could be parsed");
        }
        console.log(`[flashcardService] OK — ${cards.length} cards`);
        return {
          title: String(parsed.title || `Flashcards — ${(names[0] || "Document").replace(/\.pdf$/i, "")}`).trim(),
          cards,
        };
      } catch (err) {
        lastError = err;
        const status = err.status ?? err.statusCode ?? 0;
        const isRetryable = status === 503 || status === 429 || status === 500;
        console.error(`[flashcardService] model=${modelName} attempt=${attempt} status=${status} error=${err.message}`);
        if (!isRetryable || attempt === 3) break;
        const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
        console.log(`[flashcardService] retrying in ${delay}ms`);
        await sleep(delay);
      }
    }
  }

  const err = new Error(lastError?.message || "All Gemini models failed to generate flashcards");
  err.statusCode = 503;
  throw err;
}

async function regenerateCard({ sourceText, pdfNames, pdfName, card, topics = [] }) {
  const clipped = (sourceText || "").trim().slice(0, 100000);
  const docLabel = (pdfNames && pdfNames[0] ? pdfNames[0] : pdfName || "").replace(/\.pdf$/i, "").replace(/_/g, " ") || "the document";

  const prompt = `
You are an expert study assistant. Regenerate ONE flashcard based ONLY on the source text below.

SOURCE DOCUMENT: "${docLabel}"

ORIGINAL CARD:
- Front: "${card.front}"
- Back: "${card.back}"
- Topic: "${card.topic || ""}"

${Array.isArray(topics) && topics.length > 0 ? `FOCUS TOPIC: ${topics[0]}\n` : ""}SOURCE TEXT:
"""
${clipped}
"""

TASK:
Produce an improved version of this exact card. Keep the same core concept but make the front clearer and the back more accurate and concise, using ONLY the source text.

OUTPUT FORMAT (pure JSON, no markdown):
{
  "front": "string",
  "back": "string",
  "explanation": "string — 1-2 sentence short explanation",
  "topic": "string",
  "page": number,
  "startLine": number,
  "endLine": number
}
`.trim();

  let lastError;
  for (const modelName of MODEL_CHAIN) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[flashcardService] regenerate model=${modelName} attempt=${attempt}`);
        const raw = await callModel(prompt, modelName);
        const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, ""));
        const c = parsed;
        const front = String(c.front || "").trim();
        const back = String(c.back || "").trim();
        if (front.length < 3 || back.length < 1) throw new Error("Regenerated card invalid");
        return {
          front,
          back,
          explanation: String(c.explanation || "").trim(),
          topic: String(c.topic || card.topic || "").trim(),
          page: Number.isFinite(Number(c.page)) ? Number(c.page) : card.page ?? null,
          startLine: Number.isFinite(Number(c.startLine)) ? Number(c.startLine) : card.startLine ?? null,
          endLine: Number.isFinite(Number(c.endLine)) ? Number(c.endLine) : card.endLine ?? null,
        };
      } catch (err) {
        lastError = err;
        const status = err.status ?? err.statusCode ?? 0;
        const isRetryable = status === 503 || status === 429 || status === 500;
        console.error(`[flashcardService] regenerate model=${modelName} attempt=${attempt} status=${status} error=${err.message}`);
        if (!isRetryable || attempt === 3) break;
        const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
        await sleep(delay);
      }
    }
  }

  const err = new Error(lastError?.message || "Failed to regenerate flashcard");
  err.statusCode = 503;
  throw err;
}

module.exports = { generateFlashcards, regenerateCard };