const pdfParse = require("pdf-parse");

// pdf-parse exports as default in CommonJS
const pdf = pdfParse.default || pdfParse;

function normalizeExtractedText(s) {
  if (!s) return "";

  // Join hyphenated line breaks: "exam-\nple" -> "example"
  let out = s.replace(/(\w)-\s*\n\s*(\w)/g, "$1$2");

  // Normalize newlines/spaces but keep paragraph breaks
  out = out.replace(/\r\n/g, "\n");
  out = out.replace(/[ \t]+\n/g, "\n");
  out = out.replace(/\n{3,}/g, "\n\n");
  out = out.replace(/[ \t]{2,}/g, " ");

  return out.trim();
}

/**
 * Detect logical topic sections from extracted PDF text.
 * Uses heading-pattern heuristics — no external deps required.
 * Returns an array of { id, title, content }.
 * Falls back to a single "Full Document" chunk when no headings found.
 */
function detectTopics(text) {
  const lines = text.split("\n");

  // Patterns that look like headings
  const headingPatterns = [
    /^(chapter|unit|section|part|module|lesson|topic)\s+\d+/i,  // Chapter 1, Unit 2
    /^\d+\.\s{1,3}[A-Z][^\n]{2,80}$/,                           // 1. Introduction
    /^\d+\.\d+\s{1,3}[A-Z][^\n]{2,60}$/,                        // 1.1 Background
    /^#{1,3}\s+[^\n]{3,80}$/,                                    // ## Markdown heading
    /^[A-Z][A-Z\s\-:]{6,60}$/,                                   // ALL CAPS HEADINGS (min 7 chars)
  ];

  const isHeading = (line) => {
    const t = line.trim();
    if (!t || t.length > 120 || t.length < 3) return false;
    // Skip lines that are likely table headers or purely numeric
    if (/^\d+$/.test(t)) return false;
    return headingPatterns.some((p) => p.test(t));
  };

  const chunks = [];
  let currentTitle = null;
  let currentLines = [];
  let topicIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isHeading(line)) {
      // Save previous chunk if it has real content
      if (currentTitle !== null && currentLines.join("\n").trim().length > 80) {
        chunks.push({
          id: `topic_${++topicIndex}`,
          title: currentTitle,
          content: currentLines.join("\n").trim(),
        });
      }
      currentTitle = line.trim().replace(/^#+\s+/, "");
      currentLines = [];
    } else {
      if (currentTitle !== null) {
        currentLines.push(line);
      }
    }
  }

  // Flush last chunk
  if (currentTitle !== null && currentLines.join("\n").trim().length > 80) {
    chunks.push({
      id: `topic_${++topicIndex}`,
      title: currentTitle,
      content: currentLines.join("\n").trim(),
    });
  }

  // Fallback: whole document as one topic
  if (chunks.length === 0) {
    return [{ id: "topic_1", title: "Full Document", content: text }];
  }

  return chunks;
}

async function extractPdfTextFromBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    const err = new Error("Empty file");
    err.statusCode = 400;
    throw err;
  }

  try {
    // Extract text using pdf-parse
    const data = await pdf(buffer);

    const totalPages = data.numpages || data.pages || 0;
    const perPage = [];
    let extractedText = data.text || "";

    // Normalize the extracted text
    extractedText = normalizeExtractedText(extractedText);

    console.log(`[PDF Extract] Pages: ${totalPages}, Text length: ${extractedText.length}, Scanned: ${!extractedText}`);

    if (!extractedText) {
      // No text found - likely a scanned PDF
      return {
        pages: totalPages,
        perPage: [],
        text: "",
        topics: [],
        scannedLikely: true,
      };
    }

    // If we have text, split it into pages (approximate)
    const pages = extractedText.split("\n\n");
    pages.forEach((pageText, idx) => {
      if (pageText.trim()) {
        perPage.push({ page: idx + 1, text: pageText });
      }
    });

    // Detect logical topic sections
    const topics = detectTopics(extractedText);
    console.log(`[PDF Extract] Detected ${topics.length} topic(s)`);

    return {
      pages: totalPages,
      perPage,
      text: extractedText,
      topics,
      scannedLikely: false,
    };
  } catch (e) {
    console.error("[PDF Extract Error]", e);
    const err = new Error("Unreadable PDF");
    err.statusCode = 422;
    err.cause = e;
    throw err;
  }
}

module.exports = { extractPdfTextFromBuffer, detectTopics };
