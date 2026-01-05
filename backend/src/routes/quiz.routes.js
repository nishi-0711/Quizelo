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

    const { sourceText, questionType, difficulty, count } = req.body || {};

    const quiz = await generateQuiz({
      sourceText,
      questionType,
      difficulty,
      count,
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

