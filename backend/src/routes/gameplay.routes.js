const express = require("express");

const { requireAuth } = require("../middleware/requireAuth");
const { QuizSession } = require("../models/QuizSession");
const { validateNonEmptyAnswer, gradeQuestion } = require("../utils/quizGrading");
const { upsertResultFromSession } = require("../services/results");

const router = express.Router();

function sessionSummary(session) {
  const answered = session.responses?.length || 0;
  const total = session.questions?.length || 0;
  const remaining = session.timeLimitSec
    ? Math.max(
        0,
        session.timeLimitSec - Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)
      )
    : null;

  return {
    id: session._id.toString(),
    status: session.status,
    currentIndex: session.currentIndex,
    answeredCount: answered,
    totalQuestions: total,
    timeLimitSec: session.timeLimitSec,
    remainingSec: remaining,
    lives: session.lives,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
  };
}

// Create a quiz session from generated quiz questions.
// Body: { questions: [...], timeLimitSec?: number, lives?: number }
router.post("/sessions", requireAuth, async (req, res, next) => {
  try {
    const { questions, timeLimitSec, lives } = req.body || {};
    if (!Array.isArray(questions) || questions.length < 1) {
      return res.status(400).json({ error: "questions array is required" });
    }
    if (questions.length > 100) return res.status(400).json({ error: "Too many questions (max 100)" });

    const tl = timeLimitSec == null ? null : Number(timeLimitSec);
    if (tl != null && (!Number.isFinite(tl) || tl <= 0 || tl > 60 * 60 * 6)) {
      return res.status(400).json({ error: "timeLimitSec must be between 1 and 21600 seconds" });
    }

    const lv = lives == null ? 3 : Number(lives);
    if (!Number.isFinite(lv) || lv < 1 || lv > 100) {
      return res.status(400).json({ error: "lives must be between 1 and 100" });
    }

    // Basic sanity checks; detailed schema validation can be added later.
    const normalized = questions.map((q) => ({
      type: q.type,
      difficulty: q.difficulty,
      question: q.question,
      options: q.options,
      answerIndex: q.answerIndex,
      answer: q.answer,
      explanation: q.explanation,
      evidence: q.evidence,
    }));

    const session = await QuizSession.create({
      userId: req.auth.userId,
      questions: normalized,
      timeLimitSec: tl,
      lives: lv,
      currentIndex: 0,
      status: "in_progress",
      startedAt: new Date(),
    });

    return res.status(201).json({ session: sessionSummary(session) });
  } catch (err) {
    return next(err);
  }
});

// Get session summary (for progress bar / resume / dashboard).
router.get("/sessions/:id", requireAuth, async (req, res, next) => {
  try {
    const session = await QuizSession.findOne({ _id: req.params.id, userId: req.auth.userId });
    if (!session) return res.status(404).json({ error: "Session not found" });
    return res.json({ session: sessionSummary(session) });
  } catch (err) {
    return next(err);
  }
});

// Get ONE question at a time (supports navigation by index).
// GET /sessions/:id/question?index=0
router.get("/sessions/:id/question", requireAuth, async (req, res, next) => {
  try {
    const session = await QuizSession.findOne({ _id: req.params.id, userId: req.auth.userId });
    if (!session) return res.status(404).json({ error: "Session not found" });

    const idx = req.query.index == null ? session.currentIndex : Number(req.query.index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= session.questions.length) {
      return res.status(400).json({ error: "Invalid index" });
    }

    session.currentIndex = idx;
    await session.save();

    const q = session.questions[idx];
    const existing = session.responses.find((r) => r.index === idx);

    // Do not leak correct answers in the gameplay question payload.
    const safeQuestion = {
      index: idx,
      type: q.type,
      difficulty: q.difficulty,
      question: q.question,
      options: q.type === "mcq" ? q.options : undefined,
      answered: Boolean(existing),
      userAnswer: existing ? existing.userAnswer : undefined,
    };

    return res.json({ session: sessionSummary(session), question: safeQuestion });
  } catch (err) {
    return next(err);
  }
});

// Submit answer for a question index.
// Body: { index: number, answer: any }
router.post("/sessions/:id/answer", requireAuth, async (req, res, next) => {
  try {
    const session = await QuizSession.findOne({ _id: req.params.id, userId: req.auth.userId });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.status !== "in_progress") return res.status(409).json({ error: "Session is not in progress" });

    const idx = Number(req.body?.index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= session.questions.length) {
      return res.status(400).json({ error: "Invalid index" });
    }

    const q = session.questions[idx];
    const userAnswer = req.body?.answer;

    const validationError = validateNonEmptyAnswer(q, userAnswer);
    if (validationError) return res.status(400).json({ error: validationError });

    // Fill-in-the-blank specific: ensure the question is actually a blank.
    if (q.type === "fill_blank" && !String(q.question || "").includes("____")) {
      return res.status(500).json({ error: "Invalid fill_blank question format (missing ____)" });
    }

    const { isCorrect } = gradeQuestion(q, userAnswer);

    const now = new Date();
    const existingIdx = session.responses.findIndex((r) => r.index === idx);
    const responseDoc = { index: idx, userAnswer, isCorrect, answeredAt: now };

    if (existingIdx >= 0) session.responses[existingIdx] = responseDoc;
    else session.responses.push(responseDoc);

    // Handle lives system
    if (!isCorrect && session.lives > 0) {
      session.lives -= 1;
    }

    // Keep currentIndex aligned
    session.currentIndex = idx;

    // Optional completion: auto-complete if all answered or lives depleted
    if (session.responses.length >= session.questions.length || session.lives <= 0) {
      session.status = "completed";
      session.finishedAt = now;
    }

    await session.save();
    if (session.status === "completed") {
      await upsertResultFromSession(session);
    }

    // Return feedback without revealing too much for future questions.
    const feedback = {
      index: idx,
      type: q.type,
      isCorrect,
      correctAnswer:
        q.type === "mcq"
          ? q.answerIndex
          : q.type === "true_false"
            ? q.answer
            : q.type === "fill_blank" || q.type === "short_answer"
              ? q.answer
              : undefined,
      explanation: q.explanation,
    };

    return res.json({ session: sessionSummary(session), feedback });
  } catch (err) {
    return next(err);
  }
});

// Quit quiz (save progress) — frontend should show confirmation popup before calling this.
router.post("/sessions/:id/quit", requireAuth, async (req, res, next) => {
  try {
    const session = await QuizSession.findOne({ _id: req.params.id, userId: req.auth.userId });
    if (!session) return res.status(404).json({ error: "Session not found" });

    if (session.status === "quit") return res.json({ session: sessionSummary(session) });

    session.status = "quit";
    session.finishedAt = new Date();
    await session.save();
    await upsertResultFromSession(session);

    return res.json({ session: sessionSummary(session) });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

