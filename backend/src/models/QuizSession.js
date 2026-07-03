const mongoose = require("mongoose");

const questionBase = {
  type: { type: String, required: true, enum: ["mcq", "true_false", "fill_blank", "short_answer"] },
  difficulty: { type: String, required: true, enum: ["easy", "medium", "hard"] },
  question: { type: String, required: true },
  explanation: { type: String, default: "" },
  evidence: { type: String, default: "" },
  marks: { type: Number, default: 1 },
};

const questionSchema = new mongoose.Schema(
  {
    ...questionBase,
    // MCQ
    options: { type: [String], default: undefined },
    answerIndex: { type: Number, default: undefined },
    // TF / Fill / Short
    answer: { type: mongoose.Schema.Types.Mixed, default: undefined },
  },
  { _id: false }
);

const responseSchema = new mongoose.Schema(
  {
    index: { type: Number, required: true },
    // userAnswer shape depends on question type:
    // - mcq: number (selected index 0..3)
    // - true_false: boolean
    // - fill_blank: string
    // - short_answer: string
    userAnswer: { type: mongoose.Schema.Types.Mixed, required: true },
    isCorrect: { type: Boolean, default: null },
    answeredAt: { type: Date, required: true },
  },
  { _id: false }
);

const quizSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: "User" },
    status: {
      type: String,
      required: true,
      enum: ["in_progress", "completed", "quit"],
      default: "in_progress",
      index: true,
    },
    currentIndex: { type: Number, required: true, default: 0 },
    startedAt: { type: Date, required: true, default: () => new Date() },
    finishedAt: { type: Date, default: null },
    timeLimitSec: { type: Number, default: null },
    lives: { type: Number, default: 3 },

    // Display metadata (set by the client at session creation)
    title: { type: String, default: "" },
    sourcePdfs: { type: [String], default: [] },
    difficulty: { type: String, default: "mixed" },

    // Snapshot of quiz questions at generation time.
    questions: { type: [questionSchema], required: true },
    responses: { type: [responseSchema], default: [] },
  },
  { timestamps: true }
);

quizSessionSchema.index({ userId: 1, createdAt: -1 });

const QuizSession = mongoose.model("QuizSession", quizSessionSchema);

module.exports = { QuizSession };

