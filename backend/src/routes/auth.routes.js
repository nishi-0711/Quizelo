const express = require("express");

const { User } = require("../models/User");
const { TokenBlocklist } = require("../models/TokenBlocklist");
const { signAccessToken, decodeToken } = require("../utils/jwt");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

function isStrongEnoughPassword(pw) {
  // Keep minimal rules; can be hardened later (length is the non-negotiable part)
  return typeof pw === "string" && pw.length >= 8;
}

router.post("/signup", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const usernameRaw = req.body.username;
    const password = req.body.password;

    if (!email) return res.status(400).json({ error: "Email is required" });
    const username =
      typeof usernameRaw === "string" && usernameRaw.trim()
        ? usernameRaw.trim()
        : email.split("@")[0].slice(0, 30);
    if (username.length < 2) return res.status(400).json({ error: "Username must be at least 2 characters" });
    if (!isStrongEnoughPassword(password)) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const existing = await User.exists({ email });
    if (existing) return res.status(409).json({ error: "Email already in use" });

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ email, username, passwordHash });

    const { token } = signAccessToken({ userId: user._id.toString(), email: user.email });

    return res.status(201).json({ user: user.toSafeJSON(), token });
  } catch (err) {
    return next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = req.body.password;

    if (!email || typeof password !== "string") {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await user.verifyPassword(password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const { token } = signAccessToken({ userId: user._id.toString(), email: user.email });
    return res.json({ user: user.toSafeJSON(), token });
  } catch (err) {
    return next(err);
  }
});

router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    const decoded = decodeToken(req.auth.token);
    const expSec = decoded?.exp;
    const jti = req.auth.jti;

    if (!expSec || !jti) return res.status(400).json({ error: "Invalid token" });

    const expiresAt = new Date(expSec * 1000);

    // Idempotent logout: if already inserted, treat as success
    await TokenBlocklist.updateOne(
      { jti },
      { $setOnInsert: { jti, userId: req.auth.userId, expiresAt } },
      { upsert: true }
    );

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

