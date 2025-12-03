/**
 * Text extraction utilities
 */

import type { PDFPageProxy } from 'pdfjs-dist';
import type { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api.js';
import type {
  Color,
  Matrix,
  PDFChar,
  PDFTextLine,
  PDFWord,
  TextExtractionOptions,
  WordExtractionOptions,
} from '../types.js';
import { extractFontMetrics, getCharWidth, type FontMetrics } from './fonts.js';

/** Default text extraction options */
const DEFAULT_TEXT_OPTIONS: Required<TextExtractionOptions> = {
  xTolerance: 3,
  xToleranceRatio: null,
  yTolerance: 3,
  layout: false,
  xDensity: 7.25,
  yDensity: 13,
  lineDirRender: null,
  charDirRender: null,
  keepBlankChars: false,
  useTextFlow: true,
};

/** Default word extraction options */
const DEFAULT_WORD_OPTIONS: Required<WordExtractionOptions> = {
  xTolerance: 3,
  xToleranceRatio: null,
  yTolerance: 3,
  keepBlankChars: false,
  useTextFlow: true,
  splitAtPunctuation: false,
  extraAttrs: [],
};

/**
 * Calculate rotation angle from transformation matrix
 */
function getRotationAngle(transform: number[]): number {
  const [scaleX, skewY, skewX, scaleY] = transform;
  // Rotation angle in radians
  const angle = Math.atan2(skewY, scaleX);
  // Convert to degrees
  return (angle * 180) / Math.PI;
}

/**
 * Check if a transformation matrix indicates vertical text (rotated 90 or -90 degrees)
 * This checks individual character rotation, not overall text arrangement
 */
function isTransformVertical(transform: number[]): boolean {
  const angle = Math.abs(getRotationAngle(transform));
  return Math.abs(angle - 90) < 5 || Math.abs(angle - 270) < 5 || Math.abs(angle + 90) < 5;
}

/**
 * Extract characters from pdf.js text content with full metadata
 */
export function extractChars(
  textContent: TextContent,
  pageNumber: number,
  pageHeight: number,
  doctopOffset: number = 0,
  unicodeNorm?: 'NFC' | 'NFD' | 'NFKC' | 'NFKD' | null
): PDFChar[] {
  const chars: PDFChar[] = [];

  for (const item of textContent.items) {
    if (!('str' in item)) continue;

    const textItem = item as TextItem;
    const { str, transform, fontName, width: totalWidth, height: itemHeight } = textItem;

    if (!str && !textItem.hasEOL) continue;

    const [scaleX, skewY, skewX, scaleY, x, y] = transform;
    const calculatedFontSize = Math.sqrt(scaleX * scaleX + skewY * skewY);
    const fontSize = (itemHeight && itemHeight > 0) ? itemHeight : calculatedFontSize;

    const isUpright = Math.abs(skewX) < 0.01 && Math.abs(skewY) < 0.01;
    const isVertical = isTransformVertical(transform);
    const rotationAngle = getRotationAngle(transform);

    // PDF coordinates have origin at bottom-left, convert to top-left
    const flippedY = pageHeight - y;

    // Calculate character dimensions
    const charCount = str.length || 1;
    const avgCharWidth = totalWidth / charCount;

    for (let i = 0; i < str.length; i++) {
      let charText = str[i];

      // Apply unicode normalization if specified
      if (unicodeNorm && charText) {
        charText = charText.normalize(unicodeNorm);
      }

      let charX: number, charY0: number, charY1: number, charX1: number;
      let charWidth: number, charHeight: number;

      if (isVertical) {
        // Vertical text - swap dimensions and adjust positioning
        charWidth = Math.abs(fontSize);
        charHeight = avgCharWidth * Math.abs(scaleY !== 0 ? scaleY : scaleX);

        // For vertical text, characters stack vertically
        charX = x;
        charX1 = x + charWidth;

        if (rotationAngle > 0) {
          // Rotated clockwise (90 degrees)
          charY0 = flippedY + i * charHeight;
          charY1 = charY0 + charHeight;
        } else {
          // Rotated counter-clockwise (-90 degrees)
          charY0 = flippedY - (i + 1) * charHeight;
          charY1 = charY0 + charHeight;
        }
      } else {
        // Normal horizontal text
        charWidth = avgCharWidth * Math.abs(scaleX);
        charHeight = Math.abs(fontSize);

        // Handle rotated but not vertical text
        if (!isUpright) {
          const cos = Math.cos((rotationAngle * Math.PI) / 180);
          const sin = Math.sin((rotationAngle * Math.PI) / 180);
          const baseX = i * avgCharWidth;
          charX = x + baseX * cos;
          const baseY = flippedY - baseX * sin;
          charY0 = baseY - charHeight;
          charY1 = baseY;
        } else {
          charX = x + i * avgCharWidth * Math.abs(scaleX);
          charY0 = flippedY - charHeight;
          charY1 = flippedY;
        }
        charX1 = charX + charWidth;
      }

      chars.push({
        text: charText,
        x0: charX,
        y0: charY0,
        x1: charX1,
        y1: charY1,
        width: charWidth,
        height: charHeight,
        top: charY0,
        bottom: charY1,
        doctop: doctopOffset + charY0,
        fontName: fontName || 'unknown',
        size: fontSize,
        adv: charWidth, // Advance width
        upright: isUpright,
        matrix: transform as Matrix,
        strokingColor: null, // Use extractCharsWithColors for color support
        nonStrokingColor: null,
        pageNumber,
      });
    }
  }

  return chars;
}

/**
 * Extract characters with accurate font metrics
 * This provides better character width calculation using actual font data
 * Enhanced to use TextItem.height and TextContent.styles from pdf.js
 */
export async function extractCharsWithFontMetrics(
  page: PDFPageProxy,
  textContent: TextContent,
  pageNumber: number,
  pageHeight: number,
  doctopOffset: number = 0,
  unicodeNorm?: 'NFC' | 'NFD' | 'NFKC' | 'NFKD' | null
): Promise<PDFChar[]> {
  // Extract font metrics for this page
  const fontMetrics = await extractFontMetrics(page, textContent);
  const chars: PDFChar[] = [];

  for (const item of textContent.items) {
    if (!('str' in item)) continue;

    const textItem = item as TextItem;
    const { str, transform, fontName, width: totalWidth, height: itemHeight } = textItem;

    if (!str && !textItem.hasEOL) continue;

    const [scaleX, skewY, skewX, scaleY, x, y] = transform;
    const calculatedFontSize = Math.sqrt(scaleX * scaleX + skewY * skewY);
    const fontSize = (itemHeight && itemHeight > 0) ? itemHeight : calculatedFontSize;

    const isUpright = Math.abs(skewX) < 0.01 && Math.abs(skewY) < 0.01;
    const isVertical = isTransformVertical(transform);
    const rotationAngle = getRotationAngle(transform);

    // PDF coordinates have origin at bottom-left, convert to top-left
    const flippedY = pageHeight - y;

    // Get font metrics for this font (now includes TextStyle info)
    const metrics = fontMetrics.get(fontName);

    // Calculate individual character widths using font metrics
    const charWidths: number[] = [];
    let totalCalculatedWidth = 0;

    for (let i = 0; i < str.length; i++) {
      const charWidth = getCharWidth(metrics, str[i], fontSize);
      charWidths.push(charWidth);
      totalCalculatedWidth += charWidth;
    }

    // Scale factor to match pdf.js total width (which is more accurate for final positioning)
    const scaleFactor = totalCalculatedWidth > 0 && totalWidth > 0
      ? totalWidth / totalCalculatedWidth
      : 1;

    // Apply scale factor to individual widths
    const scaledWidths = charWidths.map(w => w * scaleFactor);

    // Track cumulative x position
    let currentX = x;

    for (let i = 0; i < str.length; i++) {
      let charText = str[i];

      // Apply unicode normalization if specified
      if (unicodeNorm && charText) {
        charText = charText.normalize(unicodeNorm);
      }

      const charWidth = scaledWidths[i] * Math.abs(scaleX);
      const charHeight = Math.abs(fontSize);

      let charX: number, charY0: number, charY1: number, charX1: number;

      if (isVertical) {
        // Vertical text - swap dimensions and adjust positioning
        const vertCharWidth = charHeight;
        const vertCharHeight = charWidth;

        charX = currentX;
        charX1 = charX + vertCharWidth;

        if (rotationAngle > 0) {
          charY0 = flippedY + i * vertCharHeight;
          charY1 = charY0 + vertCharHeight;
        } else {
          charY0 = flippedY - (i + 1) * vertCharHeight;
          charY1 = charY0 + vertCharHeight;
        }

        chars.push({
          text: charText,
          x0: charX,
          y0: charY0,
          x1: charX1,
          y1: charY1,
          width: vertCharWidth,
          height: vertCharHeight,
          top: charY0,
          bottom: charY1,
          doctop: doctopOffset + charY0,
          fontName: fontName || 'unknown',
          size: fontSize,
          adv: vertCharHeight,
          upright: false,
          matrix: transform as Matrix,
          strokingColor: null,
          nonStrokingColor: null,
          pageNumber,
        });
      } else if (!isUpright) {
        // Handle rotated but not vertical text
        const cos = Math.cos((rotationAngle * Math.PI) / 180);
        const sin = Math.sin((rotationAngle * Math.PI) / 180);

        // Calculate position based on cumulative width
        const offsetX = currentX - x;
        charX = x + offsetX * cos;
        const baseY = flippedY - offsetX * sin;
        charY0 = baseY - charHeight;
        charY1 = baseY;
        charX1 = charX + charWidth * cos;

        chars.push({
          text: charText,
          x0: charX,
          y0: charY0,
          x1: charX1,
          y1: charY1,
          width: charWidth,
          height: charHeight,
          top: charY0,
          bottom: charY1,
          doctop: doctopOffset + charY0,
          fontName: fontName || 'unknown',
          size: fontSize,
          adv: charWidth,
          upright: isUpright,
          matrix: transform as Matrix,
          strokingColor: null,
          nonStrokingColor: null,
          pageNumber,
        });

        currentX += scaledWidths[i];
      } else {
        // Normal horizontal text with accurate widths
        charX = currentX;
        charY0 = flippedY - charHeight;
        charY1 = flippedY;
        charX1 = charX + charWidth;

        chars.push({
          text: charText,
          x0: charX,
          y0: charY0,
          x1: charX1,
          y1: charY1,
          width: charWidth,
          height: charHeight,
          top: charY0,
          bottom: charY1,
          doctop: doctopOffset + charY0,
          fontName: fontName || 'unknown',
          size: fontSize,
          adv: charWidth,
          upright: isUpright,
          matrix: transform as Matrix,
          strokingColor: null,
          nonStrokingColor: null,
          pageNumber,
        });

        currentX += scaledWidths[i];
      }
    }
  }

  return chars;
}

/**
 * Group characters into words
 */
export function extractWords(
  chars: PDFChar[],
  options: WordExtractionOptions = {}
): PDFWord[] {
  const opts = { ...DEFAULT_WORD_OPTIONS, ...options };

  if (chars.length === 0) return [];

  // Add original index to each char for stable sorting
  const charsWithIndex = chars.map((c, idx) => ({ char: c, originalIndex: idx }));

  // Sort chars by position (top to bottom, then by original order or x position)
  const sortedChars = charsWithIndex.sort((a, b) => {
    const yDiff = a.char.y0 - b.char.y0;
    if (Math.abs(yDiff) > opts.yTolerance) return yDiff;

    // If useTextFlow is enabled, preserve original PDF order within each line
    // This handles PDFs with character-level spacing/kerning that causes overlapping bboxes
    if (opts.useTextFlow) {
      return a.originalIndex - b.originalIndex;
    }

    return a.char.x0 - b.char.x0;
  }).map(item => item.char);

  const words: PDFWord[] = [];
  let currentWordChars: PDFChar[] = [];

  const isWordBreak = (prev: PDFChar, curr: PDFChar): boolean => {
    // Different line
    if (Math.abs(curr.y0 - prev.y0) > opts.yTolerance) return true;

    // Gap between characters
    const gap = curr.x0 - prev.x1;

    // Calculate tolerance - use xToleranceRatio if set (based on char size)
    let tolerance: number;
    if (opts.xToleranceRatio !== null && opts.xToleranceRatio !== undefined) {
      // Use the average size of the two characters for tolerance calculation
      const avgSize = (prev.size + curr.size) / 2;
      tolerance = avgSize * opts.xToleranceRatio;
    } else {
      tolerance = opts.xTolerance;
    }

    if (gap > tolerance) return true;

    // Space character
    if (prev.text === ' ' || curr.text === ' ') return true;

    // Punctuation split
    if (opts.splitAtPunctuation) {
      const punctuation =
        typeof opts.splitAtPunctuation === 'boolean'
          ? /[.,;:!?()[\]{}'"]/
          : new RegExp(`[${opts.splitAtPunctuation.join('')}]`);
      if (punctuation.test(prev.text) || punctuation.test(curr.text)) return true;
    }

    return false;
  };

  const createWord = (wordChars: PDFChar[]): PDFWord | null => {
    if (wordChars.length === 0) return null;

    const text = wordChars.map((c) => c.text).join('');
    const x0 = Math.min(...wordChars.map((c) => c.x0));
    const y0 = Math.min(...wordChars.map((c) => c.y0));
    const x1 = Math.max(...wordChars.map((c) => c.x1));
    const y1 = Math.max(...wordChars.map((c) => c.y1));

    // Determine direction based on character order
    const firstChar = wordChars[0];
    const lastChar = wordChars[wordChars.length - 1];
    const direction = firstChar.x0 <= lastChar.x0 ? 'ltr' : 'rtl';

    return {
      text,
      x0,
      y0,
      x1,
      y1,
      top: y0,
      bottom: y1,
      doctop: Math.min(...wordChars.map((c) => c.doctop)),
      chars: wordChars,
      direction,
      upright: wordChars.every((c) => c.upright),
    };
  };

  for (const char of sortedChars) {
    // Skip blank characters if not keeping them
    if (!opts.keepBlankChars && char.text.trim() === '') {
      if (currentWordChars.length > 0) {
        const word = createWord(currentWordChars);
        if (word) words.push(word);
        currentWordChars = [];
      }
      continue;
    }

    if (currentWordChars.length === 0) {
      currentWordChars.push(char);
    } else {
      const prevChar = currentWordChars[currentWordChars.length - 1];
      if (isWordBreak(prevChar, char)) {
        const word = createWord(currentWordChars);
        if (word) words.push(word);
        currentWordChars = [char];
      } else {
        currentWordChars.push(char);
      }
    }
  }

  if (currentWordChars.length > 0) {
    const word = createWord(currentWordChars);
    if (word) words.push(word);
  }

  return words;
}

/**
 * Group characters into text lines
 */
export function extractLines(
  chars: PDFChar[],
  yTolerance: number = 3
): PDFTextLine[] {
  if (chars.length === 0) return [];

  // Sort by y then x
  const sortedChars = [...chars].sort((a, b) => {
    const yDiff = a.y0 - b.y0;
    if (Math.abs(yDiff) > yTolerance) return yDiff;
    return a.x0 - b.x0;
  });

  const lines: PDFTextLine[] = [];
  let currentLineChars: PDFChar[] = [sortedChars[0]];
  let currentY = sortedChars[0].y0;

  for (let i = 1; i < sortedChars.length; i++) {
    const char = sortedChars[i];

    if (Math.abs(char.y0 - currentY) <= yTolerance) {
      currentLineChars.push(char);
    } else {
      const line = createLine(currentLineChars, yTolerance);
      if (line) lines.push(line);
      currentLineChars = [char];
      currentY = char.y0;
    }
  }

  if (currentLineChars.length > 0) {
    const line = createLine(currentLineChars, yTolerance);
    if (line) lines.push(line);
  }

  return lines;
}

function createLine(chars: PDFChar[], yTolerance: number): PDFTextLine | null {
  if (chars.length === 0) return null;

  // Sort by x position
  const sortedChars = [...chars].sort((a, b) => a.x0 - b.x0);

  const x0 = Math.min(...sortedChars.map((c) => c.x0));
  const y0 = Math.min(...sortedChars.map((c) => c.y0));
  const x1 = Math.max(...sortedChars.map((c) => c.x1));
  const y1 = Math.max(...sortedChars.map((c) => c.y1));

  const words = extractWords(sortedChars, { yTolerance });

  return {
    text: sortedChars.map((c) => c.text).join(''),
    x0,
    y0,
    x1,
    y1,
    top: y0,
    bottom: y1,
    doctop: Math.min(...sortedChars.map((c) => c.doctop)),
    chars: sortedChars,
    words,
  };
}

/**
 * Extract text from characters - main extraction function
 */
export function extractText(
  chars: PDFChar[],
  options: TextExtractionOptions = {}
): string {
  const opts = { ...DEFAULT_TEXT_OPTIONS, ...options };

  if (chars.length === 0) return '';

  // First extract words with appropriate tolerance
  const words = extractWords(chars, {
    xTolerance: opts.xTolerance,
    xToleranceRatio: opts.xToleranceRatio,
    yTolerance: opts.yTolerance,
    keepBlankChars: opts.keepBlankChars,
  });

  // Then group words into lines
  const lines = groupWordsIntoLines(words, opts.yTolerance);

  // Apply direction rendering if specified
  if (opts.lineDirRender) {
    sortLinesByDirection(lines, opts.lineDirRender);
  }

  if (opts.charDirRender) {
    for (const line of lines) {
      sortWordsByDirection(line.words, opts.charDirRender);
    }
  }

  if (!opts.layout) {
    // Simple text extraction
    return lines.map((line) => lineToText(line, opts.xTolerance)).join('\n');
  }

  // Layout-preserved extraction
  return layoutText(lines, opts);
}

/**
 * Simple/fast text extraction
 */
export function extractTextSimple(
  chars: PDFChar[],
  xTolerance: number = 3,
  yTolerance: number = 3,
  useTextFlow: boolean = true
): string {
  if (chars.length === 0) return '';

  // Add original index for stable sorting
  const charsWithIndex = chars.map((c, idx) => ({ char: c, originalIndex: idx }));

  // Sort chars by position (top to bottom, then by original order or x position)
  const sortedChars = charsWithIndex.sort((a, b) => {
    const yDiff = a.char.y0 - b.char.y0;
    if (Math.abs(yDiff) > yTolerance) return yDiff;

    // If useTextFlow is enabled, preserve original PDF order within each line
    if (useTextFlow) {
      return a.originalIndex - b.originalIndex;
    }

    return a.char.x0 - b.char.x0;
  }).map(item => item.char);

  let result = '';
  let lastChar: PDFChar | null = null;

  for (const char of sortedChars) {
    if (lastChar) {
      // Check for line break
      if (Math.abs(char.y0 - lastChar.y0) > yTolerance) {
        result += '\n';
      }
      // Check for word break
      else if (char.x0 - lastChar.x1 > xTolerance) {
        result += ' ';
      }
    }
    result += char.text;
    lastChar = char;
  }

  return result;
}

/**
 * Extract text from raw pdf.js TextContent, preserving original item order.
 * This is ideal for OCR'd documents and multi-column layouts where
 * character-level extraction fails due to overlapping positions.
 *
 * @param textContent - The TextContent object from pdf.js
 * @param options - Extraction options
 * @returns Extracted text preserving the PDF's natural reading order
 */
export function extractTextFromItems(
  textContent: TextContent,
  options: {
    /** Add line breaks on significant y-position changes (default: true) */
    detectLineBreaks?: boolean;
    /** Y-position change threshold for line breaks in points (default: 5) */
    lineBreakThreshold?: number;
    /** Add spaces between text items on the same line (default: true) */
    addSpaces?: boolean;
    /** X-gap threshold for adding spaces (default: 10) */
    spaceThreshold?: number;
  } = {}
): string {
  const {
    detectLineBreaks = true,
    lineBreakThreshold = 5,
    addSpaces = true,
    spaceThreshold = 10,
  } = options;

  let text = '';
  let lastY: number | null = null;
  let lastX1: number | null = null;

  for (const item of textContent.items) {
    if (!('str' in item) || !item.str) continue;

    const y = item.transform[5];
    const x = item.transform[4];
    const width = item.width || 0;

    // Check for line break (significant y change)
    if (detectLineBreaks && lastY !== null) {
      const yDiff = Math.abs(y - lastY);
      if (yDiff > lineBreakThreshold) {
        text += '\n';
        lastX1 = null; // Reset x tracking on new line
      }
    }

    // Check for space (gap between items on same line)
    if (addSpaces && lastX1 !== null && lastY !== null) {
      const yDiff = Math.abs(y - lastY);
      if (yDiff <= lineBreakThreshold) {
        const gap = x - lastX1;
        if (gap > spaceThreshold) {
          text += ' ';
        }
      }
    }

    text += item.str;
    lastY = y;
    lastX1 = x + width;
  }

  return text;
}

function groupWordsIntoLines(words: PDFWord[], yTolerance: number): PDFTextLine[] {
  if (words.length === 0) return [];

  const sortedWords = [...words].sort((a, b) => {
    const yDiff = a.y0 - b.y0;
    if (Math.abs(yDiff) > yTolerance) return yDiff;
    return a.x0 - b.x0;
  });

  const lines: PDFTextLine[] = [];
  let currentWords: PDFWord[] = [sortedWords[0]];
  let currentY = sortedWords[0].y0;

  for (let i = 1; i < sortedWords.length; i++) {
    const word = sortedWords[i];

    if (Math.abs(word.y0 - currentY) <= yTolerance) {
      currentWords.push(word);
    } else {
      lines.push(wordsToLine(currentWords));
      currentWords = [word];
      currentY = word.y0;
    }
  }

  if (currentWords.length > 0) {
    lines.push(wordsToLine(currentWords));
  }

  return lines;
}

function wordsToLine(words: PDFWord[]): PDFTextLine {
  const sortedWords = [...words].sort((a, b) => a.x0 - b.x0);
  const allChars = sortedWords.flatMap((w) => w.chars);

  return {
    text: sortedWords.map((w) => w.text).join(' '),
    x0: Math.min(...sortedWords.map((w) => w.x0)),
    y0: Math.min(...sortedWords.map((w) => w.y0)),
    x1: Math.max(...sortedWords.map((w) => w.x1)),
    y1: Math.max(...sortedWords.map((w) => w.y1)),
    top: Math.min(...sortedWords.map((w) => w.top)),
    bottom: Math.max(...sortedWords.map((w) => w.bottom)),
    doctop: Math.min(...sortedWords.map((w) => w.doctop)),
    chars: allChars,
    words: sortedWords,
  };
}

function lineToText(line: PDFTextLine, xTolerance: number): string {
  const words = [...line.words].sort((a, b) => a.x0 - b.x0);

  let text = '';
  for (let i = 0; i < words.length; i++) {
    if (i > 0) {
      const gap = words[i].x0 - words[i - 1].x1;
      // Add extra spaces for large gaps
      const spaces = Math.max(1, Math.floor(gap / xTolerance));
      text += ' '.repeat(spaces);
    }
    text += words[i].text;
  }

  return text;
}

function sortLinesByDirection(
  lines: PDFTextLine[],
  direction: 'ttb' | 'btt' | 'ltr' | 'rtl'
): void {
  switch (direction) {
    case 'ttb':
      lines.sort((a, b) => a.y0 - b.y0);
      break;
    case 'btt':
      lines.sort((a, b) => b.y0 - a.y0);
      break;
    case 'ltr':
      lines.sort((a, b) => a.x0 - b.x0);
      break;
    case 'rtl':
      lines.sort((a, b) => b.x0 - a.x0);
      break;
  }
}

function sortWordsByDirection(words: PDFWord[], direction: 'ltr' | 'rtl'): void {
  if (direction === 'ltr') {
    words.sort((a, b) => a.x0 - b.x0);
  } else {
    words.sort((a, b) => b.x0 - a.x0);
  }
}

/**
 * Create layout-preserved text output
 */
function layoutText(
  lines: PDFTextLine[],
  opts: Required<TextExtractionOptions>
): string {
  if (lines.length === 0) return '';

  // Find page boundaries
  const minX = Math.min(...lines.map((l) => l.x0));
  const maxX = Math.max(...lines.map((l) => l.x1));
  const minY = Math.min(...lines.map((l) => l.y0));
  const maxY = Math.max(...lines.map((l) => l.y1));

  const pageWidth = maxX - minX;
  const pageHeight = maxY - minY;

  // Calculate grid size based on density
  const cols = Math.ceil(pageWidth * opts.xDensity / 72); // Convert points to characters
  const rowHeight = 72 / opts.yDensity;

  const result: string[] = [];
  let lastRowIndex = -1;

  // Sort lines by y position
  const sortedLines = [...lines].sort((a, b) => a.y0 - b.y0);

  for (const line of sortedLines) {
    const rowIndex = Math.floor((line.y0 - minY) / rowHeight);

    // Add blank lines if needed
    while (lastRowIndex < rowIndex - 1) {
      result.push('');
      lastRowIndex++;
    }

    // Create row with characters positioned by x
    const row = new Array(cols).fill(' ');

    for (const char of line.chars) {
      const col = Math.floor((char.x0 - minX) * opts.xDensity / 72);
      if (col >= 0 && col < cols) {
        row[col] = char.text;
      }
    }

    result.push(row.join('').trimEnd());
    lastRowIndex = rowIndex;
  }

  return result.join('\n');
}
