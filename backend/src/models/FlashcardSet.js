const mongoose = require("mongoose");

const cardSchema = new mongoose.Schema(
  {
    front: { type: String, required: true },
    back: { type: String, required: true },
    explanation: { type: String, default: "" },
    sourcePdf: { type: String, default: "" },
    topic: { type: String, default: "" },
    chunkId: { type: String, default: "" },
    page: { type: Number, default: null },
    startLine: { type: Number, default: null },
    endLine: { type: Number, default: null },
    sourceText: { type: String, default: "" },
    learned: { type: Boolean, default: false },
    difficult: { type: Boolean, default: false },
  },
  { _id: false }
);

const flashcardSetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: "User" },
    title: { type: String, required: true },
    sourcePdfs: { type: [String], default: [] },
    difficulty: { type: String, default: "mixed" },
    // Snapshot of the source text so individual cards can be regenerated later.
    sourceText: { type: String, default: "" },
    cards: { type: [cardSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

flashcardSetSchema.index({ userId: 1, createdAt: -1 });

const FlashcardSet = mongoose.model("FlashcardSet", flashcardSetSchema);

module.exports = { FlashcardSet };