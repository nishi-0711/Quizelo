const express = require("express");

const { requireAuth } = require("../middleware/requireAuth");
const { User } = require("../models/User");

const router = express.Router();

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.auth.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ user: user.toSafeJSON() });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

