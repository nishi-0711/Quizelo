const express = require("express");

const healthRoutes = require("./health.routes");
const authRoutes = require("./auth.routes");
const usersRoutes = require("./users.routes");
const pdfRoutes = require("./pdf.routes");
const quizRoutes = require("./quiz.routes");
const gameplayRoutes = require("./gameplay.routes");
const profileRoutes = require("./profile.routes");
const historyRoutes = require("./history.routes");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ message: "Welcome to Quizelo API" });
});

router.use(healthRoutes);
router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/pdf", pdfRoutes);
router.use("/quiz", quizRoutes);
router.use("/gameplay", gameplayRoutes);
router.use("/profile", profileRoutes);
router.use("/history", historyRoutes);

module.exports = router;

