"use strict";

const express = require("express");
const { requireAuth } = require("../middleware/requireAuth");
const { FlashcardSet } = require("../models/FlashcardSet");
const { generateFlashcards, regenerateCard } = require("../services/flashcardService");

const router = express.Router();

// Summary shape used for list views
function setSummary(set) {
  const cards = set.cards || [];
  return {
    id: set._id.toString(),
    title: set.title,
    sourcePdfs: set.sourcePdfs || [],
    difficulty: set.difficulty || "mixed",
    totalCards: cards.length,
    learnedCount: cards.filter((c) => c.learned).length,
    createdAt: set.createdAt,
  };
}

// POST /flashcards/generate — generate from PDF text and save the set
router.post("/generate", requireAuth, async (req, res, next) => {
  try {
    const { sourceText, pdfName, pdfNames, count, difficulty, topics, chunks } = req.body || {};

    if (!sourceText || typeof sourceText !== "string" || sourceText.trim().length < 50) {
      return res.status(400).json({ error: "sourceText must be at least 50 characters." });
    }

    const sourcePdfs = (Array.isArray(pdfNames) && pdfNames.length > 0 ? pdfNames : pdfName ? [pdfName] : []).slice(0, 10);

    // For large multi-document inputs, only send chunks belonging to the selected topics.
    let effectiveChunks = Array.isArray(chunks) ? chunks : [];
    if (Array.isArray(topics) && topics.length > 0) {
      const titleSet = new Set(topics);
      effectiveChunks = effectiveChunks.filter((c) => titleSet.has(c.section));
    }

    const result = await generateFlashcards({
      sourceText: sourceText.trim(),
      pdfNames: sourcePdfs,
      count,
      difficulty,
      topics,
      chunks: effectiveChunks,
    });

    const set = await FlashcardSet.create({
      userId: req.auth.userId,
      title: result.title,
      sourcePdfs,
      difficulty: ["easy", "medium", "hard", "mixed"].includes(difficulty) ? difficulty : "mixed",
      sourceText: sourceText.trim().slice(0, 100000),
      cards: result.cards.map((c) => ({ ...c, sourcePdf: c.sourcePdf || sourcePdfs[0] || "" })),
    });

    return res.status(201).json({ set });
  } catch (err) {
    console.error("[flashcards/generate] error:", err.message);
    return next(err);
  }
});

// GET /flashcards — list user's saved sets (most recent first)
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const sets = await FlashcardSet.find({ userId: req.auth.userId })
      .sort({ createdAt: -1 })
      .limit(100);
    return res.json({ sets: sets.map(setSummary) });
  } catch (err) {
    return next(err);
  }
});

// GET /flashcards/:id — full set (cards + metadata)
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const set = await FlashcardSet.findOne({ _id: req.params.id, userId: req.auth.userId });
    if (!set) return res.status(404).json({ error: "Flashcard set not found" });
    return res.json({ set });
  } catch (err) {
    return next(err);
  }
});

// PATCH /flashcards/:id/cards/:index — mark a card learned / difficult
router.patch("/:id/cards/:index", requireAuth, async (req, res, next) => {
  try {
    const set = await FlashcardSet.findOne({ _id: req.params.id, userId: req.auth.userId });
    if (!set) return res.status(404).json({ error: "Flashcard set not found" });

    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index >= set.cards.length) {
      return res.status(400).json({ error: "Invalid card index" });
    }

    const { learned, difficult } = req.body || {};
    if (learned !== undefined) set.cards[index].learned = Boolean(learned);
    if (difficult !== undefined) set.cards[index].difficult = Boolean(difficult);

    await set.save();
    return res.json({ set });
  } catch (err) {
    return next(err);
  }
});

// POST /flashcards/:id/regenerate — regenerate a single card
// Body: { index: number, front?: string }
router.post("/:id/regenerate", requireAuth, async (req, res, next) => {
  try {
    const set = await FlashcardSet.findOne({ _id: req.params.id, userId: req.auth.userId });
    if (!set) return res.status(404).json({ error: "Flashcard set not found" });

    const index = Number(req.body?.index);
    if (!Number.isInteger(index) || index < 0 || index >= set.cards.length) {
      return res.status(400).json({ error: "Invalid card index" });
    }

    const card = set.cards[index].toObject();
    if (req.body?.front) card.front = String(req.body.front).trim();

    const newCard = await regenerateCard({
      sourceText: set.sourceText || "",
      pdfNames: set.sourcePdfs || [],
      pdfName: (set.sourcePdfs || [])[0] || "",
      card,
    });

    // Preserve progress flags and source attribution on the regenerated card
    newCard.learned = set.cards[index].learned;
    newCard.difficult = set.cards[index].difficult;
    newCard.sourcePdf = set.cards[index].sourcePdf || (set.sourcePdfs || [])[0] || "";
    newCard.sourceText = set.cards[index].sourceText || "";
    newCard.chunkId = set.cards[index].chunkId || "";
    set.cards[index] = { ...newCard };

    await set.save();
    return res.json({ set });
  } catch (err) {
    console.error("[flashcards/regenerate] error:", err.message);
    return next(err);
  }
});

// DELETE /flashcards/:id
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const set = await FlashcardSet.findOneAndDelete({ _id: req.params.id, userId: req.auth.userId });
    if (!set) return res.status(404).json({ error: "Flashcard set not found" });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;