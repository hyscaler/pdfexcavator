/**
 * Structured PDF Extraction Example
 * Extracts text with paragraphs, sentences, and bounding boxes
 *
 * Run with: npx tsx examples/structured-extract.ts path/to/your.pdf
 */

import pdfexcavator, { clusterObjects } from '../src/index.js';
import type { PDFWord } from '../src/types.js';

// =======================================================================
// TYPES
// =======================================================================

interface BBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
}

interface Sentence {
  s_text: string;
  s_bbox: BBox;
}

interface Paragraph {
  p_text: string;
  p_bbox: BBox;
  sentences: Sentence[];
}

interface PageData {
  page_number: number;
  page_content: string;
  page_bbox: BBox;
  paragraphs: Paragraph[];
}

interface ExtractedData {
  page_count: number;
  original_file_path: string;
  pages: PageData[];
  extraction_method: string;
  full_text: string;
}

// =======================================================================
// BASIC UTILITY
// =======================================================================

function normalizeBBox(x0: number, top: number, x1: number, bottom: number): BBox {
  return {
    x1: x0,
    y1: top,
    x2: x1,
    y2: bottom,
    width: x1 - x0,
    height: bottom - top,
  };
}

// =======================================================================
// CLEANING
// =======================================================================

function cleanText(text: string): string {
  if (!text) return '';

  // Horizontal lines (-------, =====)
  text = text.replace(/[-–—_=]{6,}/g, '');

  // Symbol-only lines
  text = text.replace(/^[\s\-–—_=·•]+$/gm, '');

  // Standard footer/header pattern
  text = text.replace(
    /Confidential\s*&\s*Proprietary.*Page\s+\d+\s+of\s+\d+/gi,
    ''
  );

  // Lines with no alphanumeric
  text = text.replace(/^[^A-Za-z0-9]+$/gm, '');

  // Collapse blank lines
  text = text.replace(/\n{2,}/g, '\n');

  return text.trim();
}

// =======================================================================
// HEADER/FOOTER REMOVAL BASED ON CONTENT AND POSITION
// =======================================================================

// Common header/footer patterns to detect
const HEADER_FOOTER_PATTERNS = [
  /^page\s+\d+\s*(of\s*\d+)?$/i,                    // "Page 1 of 10"
  /^\d+\s*(of\s*\d+)?$/i,                           // "1 of 10" or just "1"
  /confidential\s*[&]\s*proprietary/i,             // "Confidential & Proprietary"
  /^[-–—_=\s]{10,}$/,                               // Long separator lines
  /^\s*©\s*\d{4}/i,                                 // Copyright lines
  /^(draft|confidential|internal|private)/i,       // Document classification
  /technologies.*private.*limited/i,               // Company name header
  /\b[A-Z]{2,}-[A-Z]{2,}-\d{6,}\b/,                // Document reference numbers (e.g., PD-NT-202501105)
];

function matchesHeaderFooterPattern(text: string): boolean {
  const cleaned = text.trim();
  return HEADER_FOOTER_PATTERNS.some(pattern => pattern.test(cleaned));
}

function isHeader(words: PDFWord[], pageHeight: number): boolean {
  const avgTop = words.reduce((sum, w) => sum + w.y0, 0) / words.length;
  const lineText = words.map(w => w.text).join(' ');

  // Only filter if in top 5% AND matches header pattern
  if (avgTop < pageHeight * 0.05) {
    return matchesHeaderFooterPattern(lineText);
  }
  return false;
}

function isFooter(words: PDFWord[], pageHeight: number): boolean {
  const avgBottom = words.reduce((sum, w) => sum + w.y1, 0) / words.length;
  const lineText = words.map(w => w.text).join(' ');

  // Only filter if in bottom 5% AND matches footer pattern
  if (avgBottom > pageHeight * 0.95) {
    return matchesHeaderFooterPattern(lineText);
  }
  return false;
}

// =======================================================================
// NOISE LINE FILTER
// =======================================================================

function isPageNumberOrNoise(text: string): boolean {
  text = text.trim();
  if (/^\d+\s+of\s+\d+$/.test(text)) return true;
  if (/^\d+$/.test(text)) return true;
  if (/^[-_=\s]+$/.test(text)) return true;
  return false;
}

// =======================================================================
// LINE INTERFACE
// =======================================================================

interface Line {
  text: string;
  words: PDFWord[];
}

// =======================================================================
// PARAGRAPH GROUPING
// =======================================================================

function groupLinesIntoParagraphs(lines: Line[]): Paragraph[] {
  if (!lines.length) return [];

  const filtered: Line[] = [];

  for (const l of lines) {
    const cleaned = cleanText(l.text);
    if (cleaned && !isPageNumberOrNoise(cleaned)) {
      filtered.push({ text: cleaned, words: l.words });
    }
  }

  if (!filtered.length) return [];

  const paragraphs: Paragraph[] = [];
  let current: Line[] = [filtered[0]];
  const PARA_SPACING_THRESHOLD = 15;

  for (let i = 1; i < filtered.length; i++) {
    const prev = filtered[i - 1];
    const curr = filtered[i];

    // Only calculate gap if both lines have words
    let gap = 0;
    if (prev.words.length > 0 && curr.words.length > 0) {
      const prevBottom = Math.max(...prev.words.map((w) => w.y1));
      const currTop = Math.min(...curr.words.map((w) => w.y0));
      gap = currTop - prevBottom;
    }

    if (gap > PARA_SPACING_THRESHOLD) {
      paragraphs.push(createParagraphFromLines(current));
      current = [curr];
    } else {
      current.push(curr);
    }
  }

  if (current.length) {
    paragraphs.push(createParagraphFromLines(current));
  }

  return paragraphs;
}

// =======================================================================
// PARAGRAPH + SENTENCE CREATION
// =======================================================================

function createParagraphFromLines(lines: Line[]): Paragraph {
  const allWords: PDFWord[] = [];
  for (const line of lines) {
    allWords.push(...line.words);
  }

  const paraText = cleanText(lines.map((l) => l.text).join(' '));

  const paraBBox = allWords.length > 0
    ? normalizeBBox(
        Math.min(...allWords.map((w) => w.x0)),
        Math.min(...allWords.map((w) => w.y0)),
        Math.max(...allWords.map((w) => w.x1)),
        Math.max(...allWords.map((w) => w.y1))
      )
    : normalizeBBox(0, 0, 0, 0);

  const sentences = mergeLinesIntoSentences(lines);

  return {
    p_text: paraText,
    p_bbox: paraBBox,
    sentences,
  };
}

const END_PUNCT = /[.!?]$/;

function mergeLinesIntoSentences(lines: Line[]): Sentence[] {
  const merged: Sentence[] = [];
  let currentWords: PDFWord[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    currentWords.push(...line.words);

    if (END_PUNCT.test(line.text)) {
      merged.push(buildSentence(currentWords));
      currentWords = [];
    } else if (idx < lines.length - 1) {
      const nextLine = lines[idx + 1];
      // Only calculate gap if both lines have words
      if (nextLine.words.length > 0 && line.words.length > 0) {
        const gap =
          Math.min(...nextLine.words.map((w) => w.y0)) -
          Math.max(...line.words.map((w) => w.y1));

        if (gap > 12) {
          merged.push(buildSentence(currentWords));
          currentWords = [];
        }
      }
    }
  }

  if (currentWords.length) {
    merged.push(buildSentence(currentWords));
  }

  return merged;
}

function buildSentence(words: PDFWord[]): Sentence {
  const bbox = words.length > 0
    ? normalizeBBox(
        Math.min(...words.map((w) => w.x0)),
        Math.min(...words.map((w) => w.y0)),
        Math.max(...words.map((w) => w.x1)),
        Math.max(...words.map((w) => w.y1))
      )
    : normalizeBBox(0, 0, 0, 0);

  return {
    s_text: cleanText(words.map((w) => w.text).join(' ')),
    s_bbox: bbox,
  };
}

// =======================================================================
// MERGE BBOX
// =======================================================================

function mergeBBox(bboxList: BBox[]): BBox {
  if (!bboxList.length) {
    return normalizeBBox(0, 0, 0, 0);
  }

  return normalizeBBox(
    Math.min(...bboxList.map((b) => b.x1)),
    Math.min(...bboxList.map((b) => b.y1)),
    Math.max(...bboxList.map((b) => b.x2)),
    Math.max(...bboxList.map((b) => b.y2))
  );
}

// =======================================================================
// MAIN EXTRACTION
// =======================================================================

async function extractPdfData(pdfPath: string): Promise<ExtractedData> {
  const data: ExtractedData = {
    page_count: 0,
    original_file_path: pdfPath,
    pages: [],
    extraction_method: 'pdfexcavator',
    full_text: '',
  };

  try {
    const pdf = await pdfexcavator.open(pdfPath);
    data.page_count = pdf.pageCount;
    const allPageTexts: string[] = [];

    for (const page of pdf.pages) {
      const pageNumber = page.pageNumber + 1; // 1-indexed
      const words = await page.extractWords();

      if (!words || !words.length) continue;

      const pageHeight = page.height;
      const lines: Line[] = [];

      // Group words into lines by y position (using clustering)
      const wordGroups = clusterObjects(words, (w) => w.y0, 3);

      if (!wordGroups || !wordGroups.length) continue;

      for (const group of wordGroups) {
        if (!group || !group.length) continue;

        // Skip header/footer by vertical position
        if (isHeader(group, pageHeight) || isFooter(group, pageHeight)) {
          continue;
        }

        // Sort words by x position within the line
        group.sort((a, b) => a.x0 - b.x0);

        const lineText = cleanText(group.map((w) => w.text).join(' '));
        if (!lineText) continue;

        lines.push({ text: lineText, words: group });
      }

      if (!lines.length) continue;

      // Sort lines by y position (top to bottom)
      lines.sort((a, b) => {
        const aTop = a.words.length > 0 ? Math.min(...a.words.map((w) => w.y0)) : 0;
        const bTop = b.words.length > 0 ? Math.min(...b.words.map((w) => w.y0)) : 0;
        return aTop - bTop;
      });

      // Group into paragraphs
      const paragraphs = groupLinesIntoParagraphs(lines);

      if (!paragraphs.length) continue;

      // Build page output
      const fullPageText = cleanText(
        paragraphs.map((p) => p.p_text).join('\n\n')
      );
      const fullPageBBox = mergeBBox(paragraphs.map((p) => p.p_bbox));

      data.pages.push({
        page_number: pageNumber,
        page_content: fullPageText,
        page_bbox: fullPageBBox,
        paragraphs,
      });

      allPageTexts.push(fullPageText);
    }

    data.full_text = cleanText(allPageTexts.join('\n\n'));
    await pdf.close();
  } catch (e) {
    console.error(`Error processing PDF: ${e}`);
  }

  return data;
}

// =======================================================================
// CLI
// =======================================================================

async function main() {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    console.log('Usage: npx tsx examples/structured-extract.ts <pdf-file>');
    console.log('');
    console.log('Extracts structured data from PDF:');
    console.log('  - Pages with bounding boxes');
    console.log('  - Paragraphs with bounding boxes');
    console.log('  - Sentences with bounding boxes');
    console.log('  - Header/footer removal');
    console.log('  - Text cleaning');
    process.exit(1);
  }

  console.error(`Processing: ${pdfPath}`);
  const result = await extractPdfData(pdfPath);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
