"use strict";

const express = require("express");
const { z } = require("zod");
const { buildPDF, buildDOCX, getFilename } = require("../services/exportService");

const router = express.Router();

// ── Validation ─────────────────────────────────────────────────────────────
const ExportSettingsSchema = z.object({
  includeAnswers:      z.boolean().default(true),
  includeExplanations: z.boolean().default(true),
  shuffleQuestions:    z.boolean().default(false),
  shuffleOptions:      z.boolean().default(false),
});

const ExportBodySchema = z.object({
  questions: z.array(z.any()).min(1, "At least one question is required"),
  pdfName:   z.string().max(200).optional().default("Quiz"),
  format:    z.enum(["pdf", "docx"]).default("pdf"),
  settings:  ExportSettingsSchema.optional().default({}),
});

// ── POST /api/export/quiz ──────────────────────────────────────────────────
router.post("/quiz", async (req, res) => {
  try {
    const parseResult = ExportBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Invalid export request",
        details: parseResult.error.issues,
      });
    }

    const { questions, pdfName, format, settings } = parseResult.data;

    const filename = getFilename(pdfName, format);

    if (format === "docx") {
      const buffer = await buildDOCX(questions, settings, pdfName);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", buffer.length);
      return res.send(buffer);
    }

    // Default: PDF
    const buffer = await buildPDF(questions, settings, pdfName);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);
    return res.send(buffer);
  } catch (err) {
    console.error("[Export Error]", err);
    return res.status(500).json({ error: "Failed to generate export file. Please try again." });
  }
});

module.exports = router;
