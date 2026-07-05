"use strict";

const express = require("express");
const { requireAuth } = require("../middleware/requireAuth");
const { generateNotes } = require("../services/notesService");
const { buildNotesPDF, buildNotesDOCX } = require("../services/exportService");
const { StudyNote } = require("../models/Note");

const router = express.Router();

// Derive a compact list of covered topics from the generated notes structure.
function deriveTopics(notes) {
  const seen = new Set();
  (notes.sections || []).forEach((s) => {
    if (s?.chapter) seen.add(s.chapter);
    (s?.keyConcepts || []).slice(0, 3).forEach((k) => seen.add(k));
  });
  return [...seen].slice(0, 15);
}

/**
 * POST /notes/generate
 * Body: { sourceText: string, pdfName?: string }
 * Returns: JSON notes object (auto-saved to the user's notes library)
 */
router.post("/generate", requireAuth, async (req, res) => {
  try {
    const { sourceText, pdfName, pdfNames } = req.body;

    if (!sourceText || typeof sourceText !== "string" || sourceText.trim().length < 50) {
      return res.status(400).json({ error: "sourceText must be at least 50 characters." });
    }

    // Support both single pdfName and multi-PDF pdfNames array
    const sourcePdfs = Array.isArray(pdfNames) && pdfNames.length > 0
      ? pdfNames
      : pdfName
        ? [pdfName]
        : [];

    const notes = await generateNotes(sourceText.trim(), sourcePdfs);

    const doc = await StudyNote.create({
      userId: req.auth.userId,
      title: notes.title || "Study Notes",
      subject: notes.subject || "",
      sourcePdfs,
      topics: deriveTopics(notes),
      sections: notes.sections || [],
      quickRevision: notes.quickRevision || [],
    });

    return res.json({ ...notes, _id: doc._id.toString(), saved: true });
  } catch (err) {
    const status = err.statusCode || err.status || 500;
    console.error("[notes/generate] error:", err.message);
    return res.status(status).json({ error: err.message });
  }
});

/**
 * GET /notes — list the user's saved notes (most recent first)
 */
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const notes = await StudyNote.find({ userId: req.auth.userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .select("title subject sourcePdfs topics createdAt updatedAt");
    return res.json({ notes });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /notes/:id — full saved note
 */
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const note = await StudyNote.findOne({ _id: req.params.id, userId: req.auth.userId });
    if (!note) return res.status(404).json({ error: "Note not found" });
    return res.json({ note });
  } catch (err) {
    return next(err);
  }
});

/**
 * DELETE /notes/:id
 */
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const note = await StudyNote.findOneAndDelete({ _id: req.params.id, userId: req.auth.userId });
    if (!note) return res.status(404).json({ error: "Note not found" });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /notes/export
 * Body: { notes: object, pdfName?: string, format: "pdf" | "docx" }
 * Streams the binary file
 */
router.post("/export", async (req, res) => {
  try {
    const { notes, pdfName, format } = req.body;

    if (!notes || typeof notes !== "object") {
      return res.status(400).json({ error: "notes object is required." });
    }
    if (!["pdf", "docx"].includes(format)) {
      return res.status(400).json({ error: "format must be 'pdf' or 'docx'." });
    }

    const base = (pdfName || notes.title || "StudyNotes")
      .replace(/\.pdf$/i, "")
      .replace(/[^a-zA-Z0-9_\-]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 60);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `Notes_${base}_${date}.${format}`;

    let buffer;
    if (format === "pdf") {
      buffer = await buildNotesPDF(notes);
      res.setHeader("Content-Type", "application/pdf");
    } else {
      buffer = await buildNotesDOCX(notes);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
    }

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);
    return res.send(buffer);
  } catch (err) {
    const status = err.statusCode || err.status || 500;
    console.error("[notes/export] error:", err.message);
    return res.status(status).json({ error: err.message });
  }
});

module.exports = router;