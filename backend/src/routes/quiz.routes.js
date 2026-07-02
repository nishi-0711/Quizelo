const express = require("express");

const { requireAuth } = require("../middleware/requireAuth");
const { generateQuiz } = require("../services/quizGenerator");
const { quizAssist } = require("../services/aiAssist");

const router = express.Router();

// Generate quiz questions strictly from extracted PDF text (no external knowledge).
router.post("/generate", async (req, res, next) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      const err = new Error("Gemini API key not configured. Contact administrator.");
      err.statusCode = 500;
      throw err;
    }

    const { sourceText, questionType, difficulty, count, selectedTopics, chunks } = req.body || {};

    // If the client sent specific topic chunks, merge their content into the source text.
    // Otherwise fall back to the full sourceText as before.
    let effectiveSource = sourceText;
    let topicTitles = [];
    let topicsWithCounts = null; // set when weighted mode sends targetCount per topic
    let effectiveChunks = chunks || [];

    if (Array.isArray(selectedTopics) && selectedTopics.length > 0) {
      const selectedTopicIds = new Set(selectedTopics.map((t) => t.id).filter(Boolean));
      topicTitles = selectedTopics.map((t) => t.title).filter(Boolean);
      effectiveSource = selectedTopics.map((t) => t.content).filter(Boolean).join("\n\n");
      if (!effectiveSource || effectiveSource.trim().length < 50) {
        return res.status(400).json({ error: "Selected topics contain too little text. Please select more topics." });
      }

      if (Array.isArray(chunks)) {
        effectiveChunks = chunks.filter((c) => selectedTopicIds.has(c.topicId));
      }

      // Weighted mode: every topic carries a numeric targetCount
      const hasTargetCounts = selectedTopics.every(
        (t) => typeof t.targetCount === "number" && t.targetCount >= 1
      );
      if (hasTargetCounts) {
        topicsWithCounts = selectedTopics.map((t) => ({
          title: t.title,
          targetCount: t.targetCount,
        }));
      }
    }

    const quiz = await generateQuiz({
      sourceText: effectiveSource,
      questionType,
      difficulty,
      count,
      topicTitles,
      topicsWithCounts,
      chunks: effectiveChunks,
    });

    return res.json(quiz);
  } catch (err) {
    console.error("[Quiz Generation Error]", err);
    if (err.message.includes("GEMINI_API_KEY")) {
      return res.status(500).json({ 
        error: "Gemini API Key is missing. Please set GEMINI_API_KEY in your backend .env file." 
      });
    }
    // Return detailed error in development
    if (process.env.NODE_ENV === "development") {
      return res.status(err.statusCode || 500).json({
        error: err.message,
        stack: err.stack,
        details: err.errors // For Zod errors
      });
    }
    return next(err);
  }
});

// AI assist for the manual quiz builder (Create Your Own Quiz)
// Body: { action: "improve" | "options" | "explanation", question, options?, answer?, explanation?, sourceText? }
router.post("/assist", async (req, res, next) => {
  try {
    const { action, question, options, answer, explanation, sourceText } = req.body || {};
    const result = await quizAssist({ action, question, options, answer, explanation, sourceText });
    return res.json(result);
  } catch (err) {
    console.error("[Quiz Assist Error]", err.message);
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
});

module.exports = router;

