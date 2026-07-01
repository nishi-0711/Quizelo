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
 * Detect logical topic sections from extracted PDF text using lines with metadata.
 * Uses heading patterns, font height analysis, and semantic split fallbacks.
 * Returns an array of { id, title, pageStart, pageEnd, content }.
 */
function buildChunksFromTopics(topics, allLines) {
  const chunks = [];
  let chunkIndex = 1;

  for (const topic of topics) {
    const topicLines = allLines.filter(l => l.page >= topic.pageStart && l.page <= topic.pageEnd);
    let currentParagraphLines = [];
    let paragraphIndex = 0;

    for (let i = 0; i < topicLines.length; i++) {
      const line = topicLines[i];
      currentParagraphLines.push(line);

      let shouldSplit = false;

      if (i + 1 < topicLines.length) {
        const nextLine = topicLines[i + 1];
        if (nextLine.page !== line.page) {
          shouldSplit = true;
        } else {
          // Detect paragraph transition by vertical layout/gap
          const gap = Math.abs(line.y - nextLine.y);
          // If vertical gap is at least 1.7 times the line font height, split paragraphs
          if (gap >= line.height * 1.7) {
            shouldSplit = true;
          }
        }
      } else {
        shouldSplit = true;
      }

      // Also split if paragraph gets too long to maintain granular search boundaries
      const currentLength = currentParagraphLines.reduce((sum, l) => sum + l.text.length, 0);
      if (currentLength > 800) {
        shouldSplit = true;
      }

      if (shouldSplit && currentParagraphLines.length > 0) {
        const text = currentParagraphLines.map(l => l.text).join(" ").trim();
        const page = currentParagraphLines[0].page;
        // Capture absolute line numbers from lineIndex assigned during extraction
        const startLine = currentParagraphLines[0].lineIndex;
        const endLine = currentParagraphLines[currentParagraphLines.length - 1].lineIndex;
        if (text.length >= 10) {
          chunks.push({
            chunkId: `chunk_${chunkIndex++}`,
            topicId: topic.id,
            section: topic.title,
            page,
            paragraphIndex: paragraphIndex++,
            startLine,
            endLine,
            text
          });
        }
        currentParagraphLines = [];
      }
    }
  }

  return chunks;
}

function detectTopics(allLines, fullText) {
  if (!allLines || allLines.length === 0) {
    const topics = [{ id: "topic_1", title: "Full Document", pageStart: 1, pageEnd: 1, content: fullText }];
    const chunks = [{ chunkId: "chunk_1", topicId: "topic_1", section: "Full Document", page: 1, paragraphIndex: 0, text: fullText }];
    return { topics, chunks };
  }

  // 1. Calculate body height (most frequent height of non-empty lines)
  const heightFreq = {};
  allLines.forEach((line) => {
    const text = line.text.trim();
    if (!text || text.length < 5) return; // skip very short lines/whitespace for body calculation
    const h = Math.round(line.height * 10) / 10; // round to 1 decimal place
    if (h > 0) {
      heightFreq[h] = (heightFreq[h] || 0) + 1;
    }
  });

  let bodyHeight = 10;
  let maxFreq = 0;
  for (const h in heightFreq) {
    if (heightFreq[h] > maxFreq) {
      maxFreq = heightFreq[h];
      bodyHeight = parseFloat(h);
    }
  }

  // Patterns that look like headings
  const headingRegexes = [
    /^(chapter|unit|section|part|module|lesson|topic)\s+\d+/i,  // Chapter 1, Unit 2
    /^\d+\.\s+[A-Z]/,                                           // 1. Introduction
    /^\d+\.\d+\s+[A-Z]/,                                        // 1.1 Background
    /^#{1,3}\s+[A-Z]/,                                          // ## Heading
  ];

  const isHeading = (line) => {
    const t = line.text.trim();
    if (!t || t.length > 100 || t.length < 3) return false;
    
    // Skip purely numeric lines
    if (/^\d+$/.test(t)) return false;

    // 1. Check if it matches regex patterns
    const matchesRegex = headingRegexes.some((r) => r.test(t));
    if (matchesRegex) return true;

    // 2. Check font-size pattern: height >= bodyHeight * 1.25
    const isLarger = line.height >= bodyHeight * 1.25;
    if (isLarger) {
      // Must not end with typical sentence punctuation
      if (/[.?!,;:]$/.test(t)) return false;
      // Must start with an uppercase letter, digit, or quotes/brackets
      if (/^[a-z]/.test(t)) return false;
      return true;
    }

    // 3. Check for ALL CAPS headings (length 6 to 60)
    if (/^[A-Z][A-Z\s\-:]{5,60}$/.test(t)) {
      if (/[.?!]$/.test(t)) return false;
      return true;
    }

    return false;
  };

  const rawChunks = [];
  let currentChunk = null;

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    const isHead = isHeading(line);
    
    if (isHead) {
      // Save current chunk if it has content
      if (currentChunk) {
        rawChunks.push(currentChunk);
      }
      
      let title = line.text.trim().replace(/^#+\s+/, "");
      
      // Generic label check: e.g. "Chapter 1", "Topic 2", "Section A", "Part 3"
      const isGeneric = /^(chapter|unit|section|part|module|lesson|topic|lecture|chap|sec)\s+\w+[:.\s]*$/i.test(title);
      if (isGeneric && i + 1 < allLines.length) {
        // Look ahead for the next non-empty line
        let nextIndex = i + 1;
        while (nextIndex < allLines.length && !allLines[nextIndex].text.trim()) {
          nextIndex++;
        }
        if (nextIndex < allLines.length) {
          const nextLine = allLines[nextIndex];
          const nextText = nextLine.text.trim();
          // Heuristics for a valid sub-title:
          // Not another heading, starts uppercase/numeric, not too long, doesn't end with sentence period
          if (!isHeading(nextLine) && 
              nextText.length > 2 && 
              nextText.length < 80 && 
              /^[A-Z0-9]/.test(nextText) && 
              !/[.?!]$/.test(nextText)) {
            title = `${title}: ${nextText}`;
            i = nextIndex; // skip look-ahead line in content so it isn't duplicated
          }
        }
      }

      currentChunk = {
        title,
        lines: [line],
        pageStart: line.page,
        pageEnd: line.page,
      };
    } else {
      if (!currentChunk) {
        // Text before the first heading -> group into Introduction
        currentChunk = {
          title: "Introduction",
          lines: [],
          pageStart: 1,
          pageEnd: line.page,
        };
      }
      currentChunk.lines.push(line);
      currentChunk.pageEnd = line.page;
    }
  }

  if (currentChunk) {
    rawChunks.push(currentChunk);
  }

  // Post-processing:
  // 1. Convert lines array into text content
  const processedChunks = rawChunks.map((chunk) => {
    const content = chunk.lines.map((l) => l.text).join("\n").trim();
    return {
      title: chunk.title,
      content,
      pageStart: chunk.pageStart,
      pageEnd: chunk.pageEnd,
      lines: chunk.lines
    };
  }).filter(c => c.content.length > 0);

  // 2. Merge small chunks (< 200 chars) into the previous chunk (or next if no previous)
  const mergedChunks = [];
  for (const chunk of processedChunks) {
    if (chunk.content.length < 200 && mergedChunks.length > 0) {
      const prev = mergedChunks[mergedChunks.length - 1];
      prev.content += "\n\n" + chunk.content;
      prev.pageEnd = Math.max(prev.pageEnd, chunk.pageEnd);
      prev.lines = prev.lines.concat(chunk.lines);
    } else if (chunk.content.length < 200 && processedChunks.length > 1) {
      // If first chunk is too small, merge it into the next one temporarily
      mergedChunks.push(chunk);
    } else {
      // If we had a deferred first chunk that is too small, merge it into this one
      if (mergedChunks.length === 1 && mergedChunks[0].content.length < 200) {
        const first = mergedChunks[0];
        chunk.content = first.content + "\n\n" + chunk.content;
        chunk.pageStart = Math.min(first.pageStart, chunk.pageStart);
        chunk.lines = first.lines.concat(chunk.lines);
        mergedChunks[0] = chunk;
      } else {
        mergedChunks.push(chunk);
      }
    }
  }

  // 3. Split large chunks (> 10,000 characters) semantically
  const finalChunks = [];
  const MAX_CHUNK_SIZE = 10000;

  for (const chunk of mergedChunks) {
    if (chunk.content.length <= MAX_CHUNK_SIZE) {
      finalChunks.push(chunk);
      continue;
    }

    // Split large chunk by paragraphs or line groups
    const subChunks = [];
    let currentSubLines = [];
    let currentSubLength = 0;
    let partNum = 1;

    for (const line of chunk.lines) {
      currentSubLines.push(line);
      currentSubLength += line.text.length + 1;

      // Split if length threshold met and line is a clean break (e.g. ends with period)
      const isCleanBreak = /[.?!]$/.test(line.text.trim());
      if (currentSubLength >= 7000 && (isCleanBreak || currentSubLength >= MAX_CHUNK_SIZE)) {
        const pStart = currentSubLines[0].page;
        const pEnd = currentSubLines[currentSubLines.length - 1].page;
        const subContent = currentSubLines.map(l => l.text).join("\n").trim();
        
        subChunks.push({
          title: `${chunk.title} (Part ${partNum++})`,
          content: subContent,
          pageStart: pStart,
          pageEnd: pEnd,
        });
        currentSubLines = [];
        currentSubLength = 0;
      }
    }

    // Flush remaining sub-chunk
    if (currentSubLines.length > 0) {
      const pStart = currentSubLines[0].page;
      const pEnd = currentSubLines[currentSubLines.length - 1].page;
      const subContent = currentSubLines.map(l => l.text).join("\n").trim();
      subChunks.push({
        title: partNum > 1 ? `${chunk.title} (Part ${partNum})` : chunk.title,
        content: subContent,
        pageStart: pStart,
        pageEnd: pEnd,
      });
    }

    finalChunks.push(...subChunks);
  }

  // Fallback: If fallback results in 0 chunks, or if no headings detected and fewer than 3 chunks
  // we can partition pages directly to have a nice set of topics
  if (finalChunks.length < 3 && allLines.length > 0) {
    const totalPages = allLines[allLines.length - 1].page;
    if (totalPages >= 3) {
      const pageChunks = [];
      const pagesPerChunk = Math.ceil(totalPages / 4); // target ~4 chunks
      let currentPart = 1;
      let currentPartLines = [];

      for (const line of allLines) {
        const currentPartStartPage = (currentPart - 1) * pagesPerChunk + 1;
        const currentPartEndPage = currentPart * pagesPerChunk;
        
        if (line.page > currentPartEndPage && currentPartLines.length > 0) {
          const content = currentPartLines.map(l => l.text).join("\n").trim();
          if (content.length > 50) {
            let secTitle = `Section ${currentPart}`;
            const firstLine = currentPartLines.find(l => l.text.trim().length > 5);
            if (firstLine) {
              const cleanLine = firstLine.text.trim()
                .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9\s,.:()\-!]+$/g, "")
                .slice(0, 50);
              if (cleanLine.length > 5) {
                secTitle = `${secTitle}: ${cleanLine}`;
              }
            }
            pageChunks.push({
              title: `${secTitle} (Pages ${currentPartLines[0].page}-${currentPartLines[currentPartLines.length - 1].page})`,
              content,
              pageStart: currentPartLines[0].page,
              pageEnd: currentPartLines[currentPartLines.length - 1].page,
            });
          }
          currentPart++;
          currentPartLines = [line];
        } else {
          currentPartLines.push(line);
        }
      }

      if (currentPartLines.length > 0) {
        const content = currentPartLines.map(l => l.text).join("\n").trim();
        if (content.length > 50) {
          let secTitle = `Section ${currentPart}`;
          const firstLine = currentPartLines.find(l => l.text.trim().length > 5);
          if (firstLine) {
            const cleanLine = firstLine.text.trim()
              .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9\s,.:()\-!]+$/g, "")
              .slice(0, 50);
            if (cleanLine.length > 5) {
              secTitle = `${secTitle}: ${cleanLine}`;
            }
          }
          pageChunks.push({
            title: `${secTitle} (Pages ${currentPartLines[0].page}-${currentPartLines[currentPartLines.length - 1].page})`,
            content,
            pageStart: currentPartLines[0].page,
            pageEnd: currentPartLines[currentPartLines.length - 1].page,
          });
        }
      }

      if (pageChunks.length >= 3) {
        const topics = pageChunks.map((c, i) => ({ id: `topic_${i + 1}`, ...c }));
        const chunks = buildChunksFromTopics(topics, allLines);
        return { topics, chunks };
      }
    }
  }

  const topics = finalChunks.map((chunk, index) => ({
    id: `topic_${index + 1}`,
    title: chunk.title,
    pageStart: chunk.pageStart,
    pageEnd: chunk.pageEnd,
    content: chunk.content,
  }));
  const chunks = buildChunksFromTopics(topics, allLines);
  return { topics, chunks };
}

async function extractPdfTextFromBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    const err = new Error("Empty file");
    err.statusCode = 400;
    throw err;
  }

  try {
    const allLines = [];
    const perPageMap = new Map();
    let globalLineIndex = 0; // document-wide line counter

    const pagerender = async (pageData) => {
      const textContent = await pageData.getTextContent({
        normalizeWhitespace: false,
        disableCombineTextItems: false
      });
      
      let lastY = null;
      let currentLineItems = [];
      const pageNum = pageData.pageIndex + 1;
      const pageLines = [];

      for (const item of textContent.items) {
        const itemY = item.transform[5];
        if (lastY !== null && Math.abs(itemY - lastY) > 1) {
          if (currentLineItems.length > 0) {
            const lineText = currentLineItems.map(it => it.str).join("").trim();
            const maxHeights = currentLineItems.map(it => it.height || 0);
            const maxLineHeight = maxHeights.length > 0 ? Math.max(...maxHeights) : 0;
            if (lineText) {
              globalLineIndex++;
              allLines.push({ text: lineText, page: pageNum, height: maxLineHeight, y: lastY, lineIndex: globalLineIndex });
              pageLines.push(lineText);
            }
          }
          currentLineItems = [item];
        } else {
          currentLineItems.push(item);
        }
        lastY = itemY;
      }

      if (currentLineItems.length > 0) {
        const lineText = currentLineItems.map(it => it.str).join("").trim();
        const maxHeights = currentLineItems.map(it => it.height || 0);
        const maxLineHeight = maxHeights.length > 0 ? Math.max(...maxHeights) : 0;
        if (lineText) {
          globalLineIndex++;
          allLines.push({ text: lineText, page: pageNum, height: maxLineHeight, y: lastY, lineIndex: globalLineIndex });
          pageLines.push(lineText);
        }
      }

      const pageText = pageLines.join("\n");
      if (pageText.trim()) {
        perPageMap.set(pageNum, pageText);
      }
      return pageText;
    };

    // Extract text using pdf-parse with custom pagerender
    const data = await pdf(buffer, { pagerender });

    const totalPages = data.numpages || data.pages || 0;
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
        chunks: [],
        scannedLikely: true,
      };
    }

    const perPage = [];
    for (const [pageNum, text] of perPageMap.entries()) {
      perPage.push({ page: pageNum, text: normalizeExtractedText(text) });
    }

    // Detect logical topic sections
    const { topics, chunks } = detectTopics(allLines, extractedText);
    console.log(`[PDF Extract] Detected ${topics.length} topic(s) and ${chunks.length} paragraph chunk(s)`);

    return {
      pages: totalPages,
      perPage,
      text: extractedText,
      topics,
      chunks,
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
