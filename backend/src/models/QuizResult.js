const mongoose = require("mongoose");

const quizResultSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: "User" },
    sessionId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, index: true, ref: "QuizSession" },

    status: { type: String, required: true, enum: ["completed", "quit"], index: true },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, required: true },
    timeLimitSec: { type: Number, default: null },
    durationSec: { type: Number, required: true },

    // Display metadata copied from the session
    title: { type: String, default: "" },
    sourcePdfs: { type: [String], default: [] },
    difficulty: { type: String, default: "mixed" },

    totalQuestions: { type: Number, required: true },
    answeredCount: { type: Number, required: true },
    gradableCount: { type: Number, required: true },
    correctCount: { type: Number, required: true },
    scorePercent: { type: Number, required: true },

    xpEarned: { type: Number, required: true },

    // Keep a snapshot for viewing past quizzes
    questions: { type: [mongoose.Schema.Types.Mixed], required: true },
    responses: { type: [mongoose.Schema.Types.Mixed], required: true },
  },
  { timestamps: true }
);

quizResultSchema.index({ userId: 1, finishedAt: -1 });

const QuizResult = mongoose.model("QuizResult", quizResultSchema);

module.exports = { QuizResult };

