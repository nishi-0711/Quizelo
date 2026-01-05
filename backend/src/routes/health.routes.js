const express = require("express");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "quizelo-backend",
    uptimeSec: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;

