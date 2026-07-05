"use strict";

const { GoogleGenerativeAI } = require("@google/generative-ai");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Model fallback chain (pinned to confirmed-available models) ───────────────
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

function makeNotesPrompt(sourceText, pdfNames) {
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

  return `
You are an expert academic study assistant. Your task is to generate comprehensive, well-structured study notes from the source text below.

SOURCE DOCUMENT: "${docLabel}"
${docListBlock}SOURCE TEXT:
"""
${clipped}
"""

TASK:
Analyze the source text and produce structured study notes. Group content into logical chapters/sections.

OUTPUT FORMAT:
Return a single JSON object with this exact structure:
{
  "title": "string — concise overall title for these notes",
  "subject": "string — subject/field of study inferred from content",
  "sections": [
    {
      "chapter": "string — chapter or section name",
      "summary": "string — 2-4 sentence overview of this section",
      "keyConcepts": ["string — each a short concept name or phrase"],
      "definitions": [
        { "term": "string", "definition": "string — clear, concise definition" }
      ],
      "formulas": ["string — each formula or equation as plain text, e.g. 'E = mc²'"],
      "keyTakeaways": ["string — 1-sentence bullet points, max 5 per section"],
      "source": {
        "pdfName": "string — the exact document name this section came from (omit if unknown)",
        "pages": ["number — page numbers this section covers (omit if unknown)"]
      }
    }
  ],
  "quickRevision": ["string — short, punchy bullet points for last-minute revision, max 10 total"]
}

RULES:
- Only use information from the source text. No outside knowledge.
- If a section has no formulas, use an empty array [].
- If a section has no definitions, use an empty array [].
- If a section has no known source pages, use {"pdfName": "", "pages": []}.
- keyConcepts should have 3-8 items per section.
- keyTakeaways should have 3-5 items per section.
- quickRevision should have 5-10 items total.
- Response MUST be pure JSON. No markdown, no code fences.
`.trim();
}

function parseNotesJSON(raw) {
  let text = raw.trim();
  // Strip markdown code fences if present
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  const parsed = JSON.parse(text);

  // Validate minimal structure
  if (!parsed.sections || !Array.isArray(parsed.sections)) {
    throw new Error("Notes JSON missing 'sections' array");
  }
  return parsed;
}

async function generateNotes(sourceText, pdfNames) {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const genAI = new GoogleGenerativeAI(apiKey);
  const prompt = makeNotesPrompt(sourceText, pdfNames);

  let lastError;

  for (const modelName of MODEL_CHAIN) {
    const model = genAI.getGenerativeModel({ model: modelName });

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[notesService] model=${modelName} attempt=${attempt}`);
        const result = await model.generateContent(prompt);
        const raw = result.response.text();
        const notes = parseNotesJSON(raw);
        console.log(
          `[notesService] OK — ${notes.sections?.length ?? 0} sections`
        );
        return notes;
      } catch (err) {
        lastError = err;
        const status = err.status ?? err.statusCode ?? 0;
        const isRetryable = status === 503 || status === 429 || status === 500;
        console.error(
          `[notesService] model=${modelName} attempt=${attempt} status=${status} error=${err.message}`
        );

        if (!isRetryable || attempt === 3) break;
        const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
        console.log(`[notesService] retrying in ${delay}ms`);
        await sleep(delay);
      }
    }
  }

  const err = new Error(
    lastError?.message || "All Gemini models failed to generate study notes"
  );
  err.statusCode = 503;
  throw err;
}

module.exports = { generateNotes };
