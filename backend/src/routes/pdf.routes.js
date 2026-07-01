const express = require("express");
const multer = require("multer");

const { extractPdfTextFromBuffer } = require("../services/pdfExtract");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB per file
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    const ok =
      file.mimetype === "application/pdf" ||
      (typeof file.originalname === "string" && file.originalname.toLowerCase().endsWith(".pdf"));
    if (!ok) return cb(new Error("Only PDF files are allowed"));
    return cb(null, true);
  },
});

/**
 * Namespace a document's topics/chunks so multiple PDFs can coexist:
 * - topicId / chunkId become globally unique across documents (doc_0_topic_1 ...)
 * - every chunk carries pdfName + docId so citations preserve document identity
 */
function namespaceDocument(result, index, pdfName) {
  const docId = `doc_${index}`;
  const topics = (result.topics || []).map((t, i) => ({
    ...t,
    id: `${docId}_topic_${i + 1}`,
    pdfName,
  }));
  const chunks = (result.chunks || []).map((c, i) => ({
    ...c,
    chunkId: `${docId}_chunk_${i + 1}`,
    pdfName,
    docId,
  }));
  return { ...result, pdfName, docId, topics, chunks };
}

// Upload one or more PDFs and extract usable text for quiz/notes/flashcard generation.
// multipart/form-data field: "files" (one or more)
// Returns { documents: [ { pdfName, docId, pages, perPage, text, topics, chunks, scannedLikely } ] }
router.post("/extract", upload.array("files", 10), async (req, res, next) => {
  try {
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: "At least one PDF file is required (field: files)" });
    }

    const documents = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = await extractPdfTextFromBuffer(file.buffer);

      if (!result.text) {
        if (result.scannedLikely) {
          return res.status(422).json({
            error: `Scanned PDF detected in "${file.originalname}". OCR is required to extract text.`,
            scannedLikely: true,
            pdfName: file.originalname,
          });
        }
        return res.status(422).json({
          error: `No extractable text found in "${file.originalname}".`,
          scannedLikely: false,
          pdfName: file.originalname,
        });
      }

      documents.push(namespaceDocument(result, i, file.originalname));
    }

    return res.json({ documents });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;