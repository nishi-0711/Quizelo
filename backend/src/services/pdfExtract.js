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

    return {
      pages: totalPages,
      perPage,
      text: extractedText,
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

module.exports = { extractPdfTextFromBuffer };


