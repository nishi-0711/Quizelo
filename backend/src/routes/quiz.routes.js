const express = require("express");

const { requireAuth } = require("../middleware/requireAuth");
const { generateQuiz } = require("../services/quizGenerator");

const router = express.Router();

// Generate quiz questions strictly from extracted PDF text (no external knowledge).
router.post("/generate", async (req, res, next) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      const err = new Error("Gemini API key not configured. Contact administrator.");
      err.statusCode = 500;
      throw err;
    }

    const { sourceText, questionType, difficulty, count, selectedTopics } = req.body || {};

    // If the client sent specific topic chunks, merge their content into the source text.
    // Otherwise fall back to the full sourceText as before.
    let effectiveSource = sourceText;
    let topicTitles = [];

    if (Array.isArray(selectedTopics) && selectedTopics.length > 0) {
      topicTitles = selectedTopics.map((t) => t.title).filter(Boolean);
      effectiveSource = selectedTopics.map((t) => t.content).filter(Boolean).join("\n\n");
      if (!effectiveSource || effectiveSource.trim().length < 50) {
        return res.status(400).json({ error: "Selected topics contain too little text. Please select more topics." });
      }
    }

    const quiz = await generateQuiz({
      sourceText: effectiveSource,
      questionType,
      difficulty,
      count,
      topicTitles,
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

module.exports = router;

