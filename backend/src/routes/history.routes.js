const express = require("express");

const { requireAuth } = require("../middleware/requireAuth");
const { QuizResult } = require("../models/QuizResult");

const { QuizSession } = require("../models/QuizSession");

const router = express.Router();

// List past quiz results (most recent first)
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const results = await QuizResult.find({ userId: req.auth.userId })
      .sort({ finishedAt: -1 })
      .limit(50)
      .select("sessionId status finishedAt scorePercent totalQuestions answeredCount xpEarned durationSec");

    return res.json({ results });
  } catch (err) {
    return next(err);
  }
});

// View a past quiz result (includes questions + responses snapshot)
router.get("/:sessionId", requireAuth, async (req, res, next) => {
  try {
    const result = await QuizResult.findOne({ userId: req.auth.userId, sessionId: req.params.sessionId });
    if (!result) return res.status(404).json({ error: "Result not found" });
    return res.json({ result });
  } catch (err) {
    return next(err);
  }
});

// Delete a past quiz result and its session
router.delete("/:sessionId", requireAuth, async (req, res, next) => {
  try {
    const result = await QuizResult.findOneAndDelete({ userId: req.auth.userId, sessionId: req.params.sessionId });
    if (!result) return res.status(404).json({ error: "Result not found" });
    
    // Also cleanup the session document
    await QuizSession.findOneAndDelete({ userId: req.auth.userId, _id: req.params.sessionId });
    
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

