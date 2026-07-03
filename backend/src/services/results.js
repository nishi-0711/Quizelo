const { QuizResult } = require("../models/QuizResult");
const { User } = require("../models/User");

function computeScore(session) {
  const totalQuestions = session.questions.length;
  const answeredCount = session.responses.length;

  // Marks-weighted scoring: every question contributes its marks (default 1,
  // so generated quizzes score identically to before).
  let gradableCount = 0;
  let correctCount = 0;
  let gradableMarks = 0;
  let correctMarks = 0;

  for (const r of session.responses) {
    const q = session.questions[r.index];
    if (!q) continue;
    // short_answer is not reliably auto-gradable => exclude from scoring
    if (q.type === "short_answer") continue;
    const marks = Number.isFinite(Number(q.marks)) && Number(q.marks) > 0 ? Number(q.marks) : 1;
    gradableCount += 1;
    gradableMarks += marks;
    if (r.isCorrect === true) {
      correctCount += 1;
      correctMarks += marks;
    }
  }

  const scorePercent =
    gradableMarks > 0 ? Math.round((correctMarks / gradableMarks) * 100) : gradableCount > 0 ? Math.round((correctCount / gradableCount) * 100) : 0;

  return { totalQuestions, answeredCount, gradableCount, correctCount, scorePercent };
}

function computeXp({ scorePercent, status, answeredCount }) {
  const base = Math.min(50, 10 + answeredCount * 2);
  const scoreBonus = Math.round((scorePercent / 100) * 100); // 0..100
  const completionBonus = status === "completed" ? 25 : 0;
  return base + scoreBonus + completionBonus;
}

async function updateStreak(userId) {
  const user = await User.findById(userId);
  if (!user) return;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  if (!user.lastQuizDate) {
    user.streak = 1;
    user.lastQuizDate = now;
    await user.save();
    return;
  }

  const lastDate = new Date(user.lastQuizDate.getFullYear(), user.lastQuizDate.getMonth(), user.lastQuizDate.getDate());
  const diffTime = today - lastDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    // Yesterday
    user.streak += 1;
    user.lastQuizDate = now;
    await user.save();
  } else if (diffDays > 1) {
    // Break in streak
    user.streak = 1;
    user.lastQuizDate = now;
    await user.save();
  } else if (diffDays === 0) {
    // Already did one today
    user.lastQuizDate = now; // update to latest time
    await user.save();
  }
}

async function upsertResultFromSession(session) {
  if (!session?.finishedAt) return null;
  if (!["completed", "quit"].includes(session.status)) return null;

  const durationSec = Math.max(
    0,
    Math.floor((new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)
  );

  const scoring = computeScore(session);
  const xpEarned = computeXp({
    scorePercent: scoring.scorePercent,
    status: session.status,
    answeredCount: scoring.answeredCount,
  });

  const doc = {
    userId: session.userId,
    sessionId: session._id,
    status: session.status,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    timeLimitSec: session.timeLimitSec,
    durationSec,
    title: session.title || "",
    sourcePdfs: session.sourcePdfs || [],
    difficulty: session.difficulty || "mixed",
    ...scoring,
    xpEarned,
    questions: session.questions,
    responses: session.responses,
  };

  await QuizResult.updateOne({ sessionId: session._id }, { $set: doc }, { upsert: true });

  if (session.status === "completed" && session.userId) {
    await updateStreak(session.userId);
  }

  return await QuizResult.findOne({ sessionId: session._id });
}

function computeBadges({ totalXp, highestScore }) {
  const badges = [];
  if (totalXp >= 100) badges.push({ id: "starter", name: "Starter", description: "Earn 100 XP" });
  if (totalXp >= 500) badges.push({ id: "grinder", name: "Grinder", description: "Earn 500 XP" });
  if (totalXp >= 1500) badges.push({ id: "scholar", name: "Scholar", description: "Earn 1500 XP" });
  if (highestScore >= 90) badges.push({ id: "ace", name: "Ace", description: "Score 90%+ on a quiz" });
  return badges;
}

module.exports = { upsertResultFromSession, computeBadges };

