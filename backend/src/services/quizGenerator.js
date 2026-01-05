const { GoogleGenerativeAI } = require("@google/generative-ai");
const { z } = require("zod");

const QuestionType = z.enum(["mcq", "true_false", "fill_blank", "short_answer", "mixed"]);
const Difficulty = z.enum(["easy", "medium", "hard", "mixed"]);

const McqSchema = z.object({
  type: z.literal("mcq"),
  difficulty: z.enum(["easy", "medium", "hard"]),
  question: z.string().min(5),
  options: z.array(z.string().min(1)).length(4),
  answerIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(1),
  evidence: z.string().min(1),
});

const TfSchema = z.object({
  type: z.literal("true_false"),
  difficulty: z.enum(["easy", "medium", "hard"]),
  question: z.string().min(5),
  answer: z.boolean(),
  explanation: z.string().min(1),
  evidence: z.string().min(1),
});

const FillBlankSchema = z.object({
  type: z.literal("fill_blank"),
  difficulty: z.enum(["easy", "medium", "hard"]),
  question: z.string().min(5), // should contain "____"
  answer: z.string().min(1),
  explanation: z.string().min(1),
  evidence: z.string().min(1),
});

const ShortAnswerSchema = z.object({
  type: z.literal("short_answer"),
  difficulty: z.enum(["easy", "medium", "hard"]),
  question: z.string().min(5),
  answer: z.string().min(1),
  explanation: z.string().min(1),
  evidence: z.string().min(1),
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

function makePrompt({ sourceText, questionType, difficulty, count }) {
  const trimmed = sourceText.trim();
  const clipped = trimmed.length > 100000 ? trimmed.slice(0, 100000) : trimmed; 

  return `
You are a quiz generator. Your task is to generate a high-quality quiz based ONLY on the provided source text.

SOURCE TEXT:
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

STRICT RULES:
- NO duplicate questions.
- NO outside knowledge.
- Response MUST be pure JSON. No markdown formatting.
`.trim();
}

function fuzzyMatchEvidence(sourceText, evidence) {
  if (!evidence || typeof evidence !== "string") return null;
  
  // 1. Try exact match
  if (sourceText.includes(evidence)) return evidence;

  // 2. Try trimmed match
  const trimmed = evidence.trim();
  if (sourceText.includes(trimmed)) return trimmed;

  // 3. Try ignoring extra whitespace/newlines and case
  const normalize = (s) => s.replace(/\s+/g, ' ').trim();
  const normalizedEvidence = normalize(evidence);
  if (!normalizedEvidence) return null;

  const regexSource = normalizedEvidence
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // escape regex
    .replace(/\s+/g, '\\s+');
  
  try {
    const regex = new RegExp(regexSource, 'i');
    const match = sourceText.match(regex);
    if (match) return match[0];
  } catch (e) {
    // Ignore regex errors
  }

  return null;
}

async function generateQuiz({ sourceText, questionType, difficulty, count }, retryCount = 0) {
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
  const modelName = process.env.GEMINI_MODEL || "gemini-flash-latest";
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
    }
  });

  const prompt = makePrompt({ sourceText, questionType: qt, difficulty: diff, count: n });

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      if (retryCount < 1) return generateQuiz({ sourceText, questionType, difficulty, count }, retryCount + 1);
      const err = new Error("AI returned non-JSON output");
      err.statusCode = 502;
      throw err;
    }

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
       if (retryCount < 1) return generateQuiz({ sourceText, questionType, difficulty, count }, retryCount + 1);
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
      seen.add(key);
      validQuestions.push(q);
    }

    // If we don't have enough and haven't retried yet, try one more time
    if (validQuestions.length < n && retryCount < 1) {
      console.warn(`[Quiz Gen] Retry triggered. Only got ${validQuestions.length}/${n} valid questions.`);
      return generateQuiz({ sourceText, questionType, difficulty, count }, retryCount + 1);
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
        const e = new Error("Gemini API is not available in your region. Please use a VPN or OpenAI instead.");
        e.statusCode = 403;
        throw e;
    }
    // If it's already a custom error with status code, rethrow
    if (err.statusCode) throw err;
    
    // Otherwise wrap it
    console.error(`[Quiz Gen Error]`, err);
    const e = new Error(err.message || "An unexpected error occurred during quiz generation.");
    e.statusCode = 500;
    throw e;
  }
}

module.exports = { generateQuiz };


