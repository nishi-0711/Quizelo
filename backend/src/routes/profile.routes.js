const express = require("express");

const { requireAuth } = require("../middleware/requireAuth");
const { User } = require("../models/User");
const { QuizResult } = require("../models/QuizResult");
const { computeBadges } = require("../services/results");

const router = express.Router();

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.auth.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const agg = await QuizResult.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: "$userId",
          totalQuizzesTaken: { $sum: 1 },
          highestScore: { $max: "$scorePercent" },
          avgScore: { $avg: "$scorePercent" },
          totalXp: { $sum: "$xpEarned" },
        },
      },
    ]);

    const stats = agg[0] || {
      totalQuizzesTaken: 0,
      highestScore: 0,
      avgScore: 0,
      totalXp: 0,
    };

    const history = await QuizResult.find({ userId: user._id })
      .sort({ finishedAt: -1 })
      .limit(20)
      .select("sessionId status finishedAt scorePercent totalQuestions answeredCount xpEarned durationSec");

    const badges = computeBadges({ totalXp: stats.totalXp || 0, highestScore: stats.highestScore || 0 });

    return res.json({
      user: user.toSafeJSON(),
      stats: {
        totalQuizzesTaken: stats.totalQuizzesTaken || 0,
        highestScore: Math.round(stats.highestScore || 0),
        averageScore: Math.round(stats.avgScore || 0),
        xp: stats.totalXp || 0,
        streak: user.streak || 0,
        badges,
      },
      history,
    });
  } catch (err) {
    return next(err);
  }
});

router.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const username = String(req.body?.username || "").trim();
    if (username.length < 2 || username.length > 30) {
      return res.status(400).json({ error: "Username must be 2-30 characters" });
    }
    const user = await User.findByIdAndUpdate(req.auth.userId, { $set: { username } }, { new: true });
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ user: user.toSafeJSON() });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

