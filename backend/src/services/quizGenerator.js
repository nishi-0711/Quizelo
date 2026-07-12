const { GoogleGenerativeAI } = require("@google/generative-ai");
const { z } = require("zod");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const QuestionType = z.enum(["mcq", "true_false", "fill_blank", "short_answer", "mixed"]);
const Difficulty = z.enum(["easy", "medium", "hard", "mixed"]);

const SourceSchema = z.object({
  page: z.number().int().min(1),
  section: z.string().min(1),
  chunkId: z.string().min(1),
  topic: z.string().optional(),
  pdfName: z.string().optional(),
  startLine: z.number().int().optional(),
  endLine: z.number().int().optional(),
});

const BloomLevel = z.enum(["remember", "understand", "apply", "analyze", "evaluate", "create"]).optional();

const McqSchema = z.object({
  type: z.literal("mcq"),
  difficulty: z.enum(["easy", "medium", "hard"]),
  bloom: BloomLevel,
  question: z.string().min(5),
  options: z.array(z.string().min(1)).length(4),
  answerIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(1),
  evidence: z.string().min(1),
  source: SourceSchema,
});

const TfSchema = z.object({
  type: z.literal("true_false"),
  difficulty: z.enum(["easy", "medium", "hard"]),
  bloom: BloomLevel,
  question: z.string().min(5),
  answer: z.boolean(),
  explanation: z.string().min(1),
  evidence: z.string().min(1),
  source: SourceSchema,
});

const FillBlankSchema = z.object({
  type: z.literal("fill_blank"),
  difficulty: z.enum(["easy", "medium", "hard"]),
  bloom: BloomLevel,
  question: z.string().min(5), // should contain "____"
  answer: z.string().min(1),
  explanation: z.string().min(1),
  evidence: z.string().min(1),
  source: SourceSchema,
});

const ShortAnswerSchema = z.object({
  type: z.literal("short_answer"),
  difficulty: z.enum(["easy", "medium", "hard"]),
  bloom: BloomLevel,
  question: z.string().min(5),
  answer: z.string().min(1),
  explanation: z.string().min(1),
  evidence: z.string().min(1),
  source: SourceSchema,
});

const QuestionSchema = z.discriminatedUnion("type", [
  McqSchema,
  TfSchema,
  FillBlankSchema,
  ShortAnswerSchema,
]);

const QuizSchema = z.object({
  questions: z.array(QuestionSchema).min(1),
});

function normalizeForDedupe(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim();
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    const err = new Error(`${name} is required`);
    err.statusCode = 500;
    throw err;
  }
  return v;
}

function buildTypeRules(questionType, count) {
  if (questionType !== "mixed") {
    return `Generate EXACTLY ${count} questions, all of type "${questionType}". Do not include other types.`;
  }

  return [
    `Generate EXACTLY ${count} questions with a TRUE MIX of types across: mcq, true_false, fill_blank, short_answer.`,
    `Rules for mixed types:`,
    `- Use AT LEAST 2 different types if count <= 3.`,
    `- Use AT LEAST 3 different types if count is 4-7.`,
    `- Use ALL 4 types if count >= 8.`,
  ].join("\n");
}

function buildDifficultyRules(difficulty, count) {
  if (difficulty !== "mixed") {
    return `All questions must have difficulty "${difficulty}".`;
  }

  const base = Math.floor(count / 3);
  const rem = count % 3;
  const easy = base + (rem > 0 ? 1 : 0);
  const med = base + (rem > 1 ? 1 : 0);
  const hard = base;
  return `Use a mixed difficulty distribution close to: easy=${easy}, medium=${med}, hard=${hard} (sum=${count}).`;
}

function makePrompt({ sourceText, questionType, difficulty, count, topicTitles, topicsWithCounts, chunks }) {
  const trimmed = sourceText.trim();
  const clipped = trimmed.length > 100000 ? trimmed.slice(0, 100000) : trimmed; 

  let scopeBlock = "";
  if (topicsWithCounts && topicsWithCounts.length > 0) {
    // Weighted mode: explicit per-topic counts
    const totalTargeted = topicsWithCounts.reduce((s, t) => s + t.targetCount, 0);
    scopeBlock =
      `SCOPE RESTRICTION:\n` +
      `Generate questions distributed across the following topics with EXACT question counts:\n` +
      topicsWithCounts.map((t, i) => `  ${i + 1}. "${t.title}" → generate EXACTLY ${t.targetCount} question(s)`).join("\n") +
      `\nTotal MUST be EXACTLY ${totalTargeted} questions.` +
      `\nDo NOT use any information outside these topic areas.\n`;
  } else if (topicTitles && topicTitles.length > 0) {
    // Standard mode: restrict to listed topics, LLM distributes freely
    scopeBlock =
      `SCOPE RESTRICTION:\n` +
      `Generate questions ONLY from the following topic(s):\n` +
      topicTitles.map((t, i) => `  ${i + 1}. ${t}`).join("\n") +
      `\nDo NOT use any information outside these topic areas.\n`;
  }

  let chunksBlock = "";
  if (Array.isArray(chunks) && chunks.length > 0) {
    chunksBlock = 
      `CHUNKS FOR REFERENCE:\n` +
      `The source text is divided into the following numbered paragraph chunks, possibly from multiple documents. For each question you generate, you MUST cite the exact chunkId, pdfName, page, section, startLine, and endLine from this list.\n\n` +
      chunks.map(c => {
        const docInfo = c.pdfName ? `, pdfName: "${c.pdfName}"` : ``;
        const lineInfo = (c.startLine && c.endLine) ? `, startLine: ${c.startLine}, endLine: ${c.endLine}` : ``;
        return `[chunkId: "${c.chunkId}"${docInfo}, page: ${c.page}, section: "${c.section}"${lineInfo}]\nText: "${c.text}"`;
      }).join("\n\n") +
      `\n\n`;
  }

  return `
You are a quiz generator. Your task is to generate a high-quality quiz based ONLY on the provided source text.

${chunksBlock}${scopeBlock}SOURCE TEXT:
"""
${clipped}
"""

GOAL:
Generate EXACTLY ${count} questions.
Type: ${questionType === "mixed" ? "A mix of mcq, true_false, fill_blank, and short_answer" : questionType}
Difficulty: ${difficulty === "mixed" ? "A mix of easy, medium, and hard" : difficulty}

OUTPUT FORMAT:
You MUST return a JSON object with a single key "questions" containing an array of objects.
Every object in the array MUST have these fields:
1. "type": (string) one of: "mcq", "true_false", "fill_blank", "short_answer"
2. "difficulty": (string) one of: "easy", "medium", "hard"
3. "question": (string) The text of the question. For "fill_blank", include "____".
4. "explanation": (string) A brief explanation of the correct answer.
5. "evidence": (string) A DIRECT, VERBATIM quote from the SOURCE TEXT that proves the answer.
6. "source": (object) The citation structure referencing a chunk from the CHUNKS FOR REFERENCE list. This object MUST contain:
    - "page": (number) The page number of the cited chunk.
    - "section": (string) The section/topic name of the cited chunk.
    - "chunkId": (string) The chunkId of the cited chunk (e.g. "doc_0_chunk_1").
    - "topic": (string) Same as the section name of the cited chunk.
    - "pdfName": (string) The pdfName of the cited chunk (copy exactly from the chunk metadata above).
    - "startLine": (number) The startLine of the cited chunk (copy exactly from the chunk metadata above).
    - "endLine": (number) The endLine of the cited chunk (copy exactly from the chunk metadata above).

TYPE-SPECIFIC FIELDS:
- For "mcq":
    - "options": (array of 4 strings) 
    - "answerIndex": (number, 0-3) The index of the correct option.
- For "true_false":
    - "answer": (boolean)
- For "fill_blank":
    - "answer": (string) The word(s) that fill the "____".
- For "short_answer":
    - "answer": (string) A concise correct answer.

ADDITIONAL FIELD (all question types):
7. "bloom": (string) Bloom's Taxonomy cognitive level. Must be one of:
   "remember" (recall facts), "understand" (explain concepts), "apply" (use knowledge),
   "analyze" (break down structure), "evaluate" (judge/critique), "create" (design/produce).

STRICT RULES:
- NO duplicate questions.
- NO outside knowledge.
- Response MUST be pure JSON. No markdown formatting.
`.trim();
}

function fuzzyMatchEvidence(sourceText, evidence) {
  if (!evidence || typeof evidence !== "string") return null;
  
  // Clean quotes and spaces from the evidence quote
  let cleanEvidence = evidence.trim()
    .replace(/^["'“”‘’'«»]+|["'“”‘’'«»]+$/g, "") // strip leading/trailing quotes
    .trim();

  if (!cleanEvidence) return null;

  // 1. Try exact match
  if (sourceText.includes(cleanEvidence)) return cleanEvidence;

  // 2. Try matching after converting all whitespaces (spaces, tabs, newlines) to a single space
  const normalize = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const normSource = normalize(sourceText);
  const normEvidence = normalize(cleanEvidence);

  if (normSource.includes(normEvidence)) {
    const escapedWords = normEvidence
      .split(' ')
      .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .filter(Boolean);
    
    if (escapedWords.length > 0) {
      const regexStr = escapedWords.join('\\s+');
      try {
        const regex = new RegExp(regexStr, 'i');
        const match = sourceText.match(regex);
        if (match) return match[0];
      } catch (e) {
        // ignore
      }
    }
  }

  // 3. Fallback: Try matching a significant consecutive subset of words (first 70% of words)
  const words = cleanEvidence.split(/\s+/);
  if (words.length > 6) {
    const subWords = words.slice(0, Math.ceil(words.length * 0.7));
    const subRegexStr = subWords
      .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s+');
    try {
      const regex = new RegExp(subRegexStr, 'i');
      const match = sourceText.match(regex);
      if (match) return match[0];
    } catch (e) {
      // ignore
    }
  }

  return null;
}

async function generateQuiz({ sourceText, questionType, difficulty, count, topicTitles = [], topicsWithCounts = null, chunks = [] }, retryCount = 0) {
  if (typeof sourceText !== "string" || sourceText.trim().length < 50) {
    const err = new Error("sourceText must be at least 50 characters of extracted PDF text");
    err.statusCode = 400;
    throw err;
  }

  const qt = QuestionType.parse(questionType);
  const diff = Difficulty.parse(difficulty);

  const n = Number(count);
  if (!Number.isInteger(n) || n < 1 || n > 50) {
    const err = new Error("count must be an integer between 1 and 50");
    err.statusCode = 400;
    throw err;
  }

  const apiKey = requireEnv("GEMINI_API_KEY");

  // ── Model fallback chain ────────────────────────────────────────────────────
  // When the primary model is overloaded, automatically step down to a lighter
  // model so the user still gets a result without waiting.
  const MODEL_CHAIN = [
    process.env.GEMINI_MODEL || "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
  ];
  // Deduplicate while preserving order
  const uniqueChain = [...new Set(MODEL_CHAIN)];
  // Pick the model based on how many retries have already failed
  const MAX_RETRIES = 4; // 5 total attempts
  const modelIndex = Math.min(Math.floor(retryCount / 2), uniqueChain.length - 1);
  const modelName = uniqueChain[modelIndex];

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const prompt = makePrompt({ sourceText, questionType: qt, difficulty: diff, count: n, topicTitles, topicsWithCounts, chunks });

  // Helper: call generateContent with a timeout so a hanging 503 never freezes the server
  async function callWithTimeout(timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const r = await model.generateContent(prompt, { signal: controller.signal });
      clearTimeout(timer);
      return r;
    } catch (e) {
      clearTimeout(timer);
      if (e.name === "AbortError" || e.message?.includes("aborted")) {
        const te = new Error("Gemini API timed out after 45 seconds. The model may be overloaded — please try again.");
        te.statusCode = 503;
        te.isTimeout = true;
        throw te;
      }
      throw e;
    }
  }

  let result, response, content;
  try {
    console.log(`[Quiz Gen] Attempt ${retryCount + 1}/${MAX_RETRIES + 1} using model: ${modelName}`);
    result = await callWithTimeout(45000);
    console.log(`[Quiz Gen] Response received successfully from ${modelName}.`);
    response = await result.response;
    content = response.text();
  } catch (err) {
    // Log the full raw error so the real cause is always visible in server logs
    console.error(`[Quiz Gen API Error - Attempt ${retryCount + 1}] model=${modelName}`, {
      message:      err.message,
      status:       err.status,
      statusText:   err.statusText,
      errorDetails: err.errorDetails ?? null,
      stack:        err.stack,
    });

    // 429 — rate-limited or quota hit. Forward the real SDK message; don't invent one.
    if (err.status === 429) {
      const e = new Error(err.message || "Gemini API returned 429 (rate limit / quota).");
      e.statusCode = 429;
      throw e;
    }

    // 503 / timeout — retry with exponential backoff + jitter
    if (retryCount < MAX_RETRIES) {
      // Exponential backoff: 2s, 4s, 8s, 16s  +  up to 1s of random jitter
      const baseDelay = Math.min(2000 * Math.pow(2, retryCount), 16000);
      const jitter = Math.floor(Math.random() * 1000);
      const delay = baseDelay + jitter;
      const nextModel = uniqueChain[Math.min(Math.floor((retryCount + 1) / 2), uniqueChain.length - 1)];
      const modelMsg = nextModel !== modelName ? ` (switching to ${nextModel})` : "";
      console.log(`[Quiz Gen] Retrying in ${delay}ms${modelMsg}...`);
      await sleep(delay);
      return generateQuiz({ sourceText, questionType, difficulty, count, topicTitles, topicsWithCounts, chunks }, retryCount + 1);
    }

    // Exhausted all retries — forward the real error, just ensure a statusCode is set
    if (!err.statusCode) err.statusCode = err.status || 500;
    throw err;
  }

  try {
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      if (retryCount < 2) {
        console.warn(`[Quiz Gen] JSON parsing failed. Retrying...`);
        return generateQuiz({ sourceText, questionType, difficulty, count, topicTitles, topicsWithCounts, chunks }, retryCount + 1);
      }
      const err = new Error("AI returned non-JSON output");
      err.statusCode = 502;
      throw err;
    }

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
       if (retryCount < 2) {
         console.warn(`[Quiz Gen] Missing questions array. Retrying...`);
         return generateQuiz({ sourceText, questionType, difficulty, count, topicTitles, topicsWithCounts, chunks }, retryCount + 1);
       }
       const err = new Error("AI returned invalid structure (missing questions array)");
       err.statusCode = 502;
       throw err;
    }

    // Validate and filter questions individually to be resilient
    const validQuestions = [];
    const seen = new Set();
    const rejectionReasons = [];

    for (const rawQ of parsed.questions) {
      const result = QuestionSchema.safeParse(rawQ);
      if (!result.success) {
        rejectionReasons.push(`Schema validation failed for a question: ${JSON.stringify(result.error.issues)}`);
        continue;
      }

      const q = result.data;

      // Enforce type strictly (unless mixed)
      if (qt !== "mixed" && q.type !== qt) {
        rejectionReasons.push(`Disallowed type: ${q.type}`);
        continue;
      }

      // Enforce difficulty (unless mixed)
      if (diff !== "mixed" && q.difficulty !== diff) {
        rejectionReasons.push(`Disallowed difficulty: ${q.difficulty}`);
        continue;
      }

      // Enforce no duplicates
      const key = normalizeForDedupe(q.question);
      if (!key || seen.has(key)) {
        rejectionReasons.push(`Duplicate question detected`);
        continue;
      }

      // Type-specific logic: fill_blank placeholder
      if (q.type === "fill_blank" && !q.question.includes("____")) {
        rejectionReasons.push(`fill_blank missing "____"`);
        continue;
      }

      // Evidence check
      const matchedEvidence = fuzzyMatchEvidence(sourceText, q.evidence);
      if (!matchedEvidence) {
        rejectionReasons.push(`Evidence not found in source text`);
        continue;
      }
      
      q.evidence = matchedEvidence;

      // Grounding: verify and auto-correct the cited chunk
      const evidenceText = q.evidence.trim();

      // 1. Check if the LLM-cited chunk exists and contains the evidence
      const citedChunk = chunks.find(c => c.chunkId === q.source?.chunkId);
      if (citedChunk) {
        const hasEvidence = fuzzyMatchEvidence(citedChunk.text, evidenceText);
        if (hasEvidence) {
          // Confirm source metadata from chunk
          q.source.page = citedChunk.page;
          q.source.section = citedChunk.section;
          q.source.topic = citedChunk.section;
          if (citedChunk.pdfName) q.source.pdfName = citedChunk.pdfName;
          if (citedChunk.startLine) q.source.startLine = citedChunk.startLine;
          if (citedChunk.endLine) q.source.endLine = citedChunk.endLine;
        } else {
          // 2. LLM cited wrong chunk — scan all chunks for real location
          let corrected = false;
          for (const c of chunks) {
            if (fuzzyMatchEvidence(c.text, evidenceText)) {
              q.source = {
                page: c.page,
                section: c.section,
                chunkId: c.chunkId,
                topic: c.section,
                ...(c.pdfName ? { pdfName: c.pdfName } : {}),
                ...(c.startLine ? { startLine: c.startLine } : {}),
                ...(c.endLine   ? { endLine: c.endLine }   : {}),
              };
              corrected = true;
              break;
            }
          }
          // If not correctable, keep existing source (LLM-provided fallback)
          if (!corrected && !q.source.topic) {
            q.source.topic = q.source.section;
          }
        }
      } else if (chunks.length > 0) {
        // Cited chunk doesn't exist — scan all chunks
        let corrected = false;
        for (const c of chunks) {
          if (fuzzyMatchEvidence(c.text, evidenceText)) {
            q.source = {
              page: c.page,
              section: c.section,
              chunkId: c.chunkId,
              topic: c.section,
              ...(c.pdfName ? { pdfName: c.pdfName } : {}),
              ...(c.startLine ? { startLine: c.startLine } : {}),
              ...(c.endLine   ? { endLine: c.endLine }   : {}),
            };
            corrected = true;
            break;
          }
        }
        if (!corrected && !q.source.topic) {
          q.source.topic = q.source.section;
        }
      } else {
        // No chunks available — copy section to topic
        if (!q.source.topic) q.source.topic = q.source.section;
      }

      seen.add(key);
      validQuestions.push(q);
    }

    // If we don't have enough and haven't retried yet, try one more time
    if (validQuestions.length < n && retryCount < 2) {
      console.warn(`[Quiz Gen] Retry triggered. Only got ${validQuestions.length}/${n} valid questions.`);
      return generateQuiz({ sourceText, questionType, difficulty, count, topicTitles, topicsWithCounts, chunks }, retryCount + 1);
    }

    // Ensure we have at least SOME questions
    if (validQuestions.length === 0) {
      console.error(`[Quiz Gen] Zero valid questions generated. Rejection reasons:`, rejectionReasons);
      const err = new Error("Failed to generate any valid questions. Try a different PDF or check the source text quality.");
      err.statusCode = 400;
      throw err;
    }

    // Return what we have (up to n)
    return { questions: validQuestions.slice(0, n) };
  } catch (err) {
    if (err.message?.includes("User location is not supported")) {
      const e = new Error("Gemini API is not available in your region.");
      e.statusCode = 403;
      throw e;
    }

    // Pass through errors that already have a statusCode (our own typed errors)
    if (err.statusCode) throw err;

    // 429 slipped through inner catch — forward the real SDK message, do not replace it
    if (err.status === 429) {
      console.error(`[Quiz Gen] 429 reached outer catch`, {
        message:      err.message,
        status:       err.status,
        errorDetails: err.errorDetails ?? null,
      });
      const e = new Error(err.message || "Gemini API returned 429 (rate limit / quota).");
      e.statusCode = 429;
      throw e;
    }

    console.error(`[Quiz Gen Error]`, {
      message:      err.message,
      status:       err.status,
      errorDetails: err.errorDetails ?? null,
      stack:        err.stack,
    });
    const e = new Error(err.message || "An unexpected error occurred during quiz generation.");
    e.statusCode = err.status || 500;
    throw e;
  }
}

module.exports = { generateQuiz };


