const express = require("express");
const multer = require("multer");

const { extractPdfTextFromBuffer } = require("../services/pdfExtract");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB
  },
  fileFilter: (req, file, cb) => {
    const ok =
      file.mimetype === "application/pdf" ||
      (typeof file.originalname === "string" && file.originalname.toLowerCase().endsWith(".pdf"));
    if (!ok) return cb(new Error("Only PDF files are allowed"));
    return cb(null, true);
  },
});

// Upload PDF and extract usable text for quiz generation.
// multipart/form-data field: "file"
router.post("/extract", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file?.buffer) return res.status(400).json({ error: "PDF file is required (field: file)" });

    const result = await extractPdfTextFromBuffer(req.file.buffer);

    if (!result.text) {
      if (result.scannedLikely) {
        return res.status(422).json({
          error: "Scanned PDF detected. OCR is required to extract text.",
          scannedLikely: true,
          pages: result.pages,
        });
      }

      return res.status(422).json({
        error: "No extractable text found in PDF.",
        scannedLikely: false,
        pages: result.pages,
      });
    }

    return res.json({
      pages: result.pages,
      scannedLikely: result.scannedLikely,
      text: result.text,
      perPage: result.perPage,
      topics: result.topics || [],
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

