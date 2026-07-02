"use strict";

const { GoogleGenerativeAI } = require("@google/generative-ai");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Model fallback chain (same strategy as the other Gemini services) ─────────
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

function makePrompt({ action, question, options, answer, explanation, sourceText }) {
  const groundedBlock =
    sourceText && sourceText.trim().length > 50
      ? `\nSOURCE TEXT (use ONLY this material as the factual basis; do not invent facts):\n\"\"\"\n${sourceText.trim().slice(0, 40000)}\n\"\"\"\n`
      : "\nNOTE: No source document was provided. Generate a sensible suggestion from general knowledge, clearly educational and factually safe.\n";

  const questionBlock = `CURRENT QUESTION: "${question || ""}"`;
  const answerBlock = answer ? `CURRENT ANSWER: "${answer}"` : "";
  const optionsBlock = Array.isArray(options) && options.length > 0 ? `CURRENT OPTIONS: ${JSON.stringify(options)}` : "";
  const explanationBlock = explanation ? `CURRENT EXPLANATION: "${explanation}"` : "";

  if (action === "options") {
    return `
You are a quiz question assistant.${groundedBlock}
${questionBlock}
${answerBlock}

TASK:
Generate EXACTLY 4 multiple-choice options for this question. The correct answer must be included as one of the options.
Make distractors plausible but clearly wrong. Keep each option short (under 12 words).

OUTPUT FORMAT (pure JSON, no markdown):
{
  "options": ["string", "string", "string", "string"],
  "answerIndex": 0
}
The answerIndex is the index (0-3) of the correct option.
`.trim();
  }

  if (action === "improve") {
    return `
You are a quiz question assistant.${groundedBlock}
${questionBlock}
${answerBlock}

TASK:
Rewrite this question to be clearer, more precise, and more engaging while keeping the same meaning and the same correct answer.
Do not change the answer. If a source text is provided, keep the question fully grounded in it.
Keep the question concise (max 40 words).

OUTPUT FORMAT (pure JSON, no markdown):
{
  "question": "string — the improved question",
  "answer": "string — unchanged answer",
  "explanation": "string — optional 1-2 sentence clarification of what the question is asking"
}
`.trim();
  }

  // explanation
  return `
You are a quiz question assistant.${groundedBlock}
${questionBlock}
${answerBlock}
${explanationBlock}

TASK:
Write a clear, concise explanation of the correct answer for this question (2-4 sentences).
If a source text is provided, base the explanation strictly on it. Otherwise explain the concept accurately.

OUTPUT FORMAT (pure JSON, no markdown):
{
  "explanation": "string"
}
`.trim();
}

function parseJSON(raw) {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  return JSON.parse(text);
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

async function quizAssist({ action, question, options, answer, explanation, sourceText }) {
  if (!["improve", "options", "explanation"].includes(action)) {
    const err = new Error("action must be one of: improve, options, explanation");
    err.statusCode = 400;
    throw err;
  }
  if (!question || typeof question !== "string" || question.trim().length < 3) {
    const err = new Error("question is required");
    err.statusCode = 400;
    throw err;
  }

  const prompt = makePrompt({ action, question, options, answer, explanation, sourceText });

  let lastError;
  for (const modelName of MODEL_CHAIN) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[aiAssist] action=${action} model=${modelName} attempt=${attempt}`);
        const raw = await callModel(prompt, modelName);
        const parsed = parseJSON(raw);

        if (action === "options") {
          const opts = Array.isArray(parsed.options) ? parsed.options.map((o) => String(o).trim()).filter(Boolean).slice(0, 4) : [];
          if (opts.length !== 4) throw new Error("AI returned invalid options");
          const ai = Number(parsed.answerIndex);
          return { options: opts, answerIndex: Number.isInteger(ai) && ai >= 0 && ai < 4 ? ai : 0 };
        }
        if (action === "improve") {
          const q = String(parsed.question || "").trim();
          if (q.length < 3) throw new Error("AI returned invalid question");
          return {
            question: q,
            answer: parsed.answer !== undefined ? String(parsed.answer) : answer,
            explanation: parsed.explanation !== undefined ? String(parsed.explanation) : explanation,
          };
        }
        // explanation
        const e = String(parsed.explanation || "").trim();
        if (e.length < 3) throw new Error("AI returned invalid explanation");
        return { explanation: e };
      } catch (err) {
        lastError = err;
        const status = err.status ?? err.statusCode ?? 0;
        const isRetryable = status === 503 || status === 429 || status === 500;
        console.error(`[aiAssist] action=${action} model=${modelName} attempt=${attempt} status=${status} error=${err.message}`);
        if (!isRetryable || attempt === 3) break;
        const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
        await sleep(delay);
      }
    }
  }

  const err = new Error(lastError?.message || "All Gemini models failed for AI assist");
  err.statusCode = 503;
  throw err;
}

module.exports = { quizAssist };