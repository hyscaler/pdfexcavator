/**
 * Layout Analysis Engine
 * Implements pdfminer-style LAParams for precise text extraction
 */

import type { PDFChar, PDFWord, PDFTextLine, LayoutParams } from '../types.js';

/**
 * Default layout parameters (matching pdfminer defaults)
 */
export const DEFAULT_LAPARAMS: Required<LayoutParams> = {
  lineOverlap: 0.5,      // Min overlap ratio for chars on same line
  charMargin: 2.0,       // Max distance between chars (as factor of char width)
  wordMargin: 0.1,       // Min distance to separate words (as factor of char width)
  lineMargin: 0.5,       // Max distance between lines (as factor of line height)
  boxesFlow: 0.5,        // Text flow direction weight (null=visual, 0=L2R, 1=T2B)
  detectVertical: true,  // Whether to detect vertical text
  allTexts: false,       // Extract text from all objects (including images)
};

/**
 * Layout text box - represents a text element with layout info
 */
interface LayoutBox {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  chars: PDFChar[];
  isVertical: boolean;
}

/**
 * Text group - a group of text elements that flow together
 */
interface TextGroup {
  boxes: LayoutBox[];
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  flowIndex: number;
}

/**
 * Layout analyzer class
 */
export class LayoutAnalyzer {
  private params: Required<LayoutParams>;

  constructor(params: Partial<LayoutParams> = {}) {
    this.params = { ...DEFAULT_LAPARAMS, ...params };
  }

  /**
   * Analyze characters and group them into words
   */
  analyzeCharsToWords(chars: PDFChar[]): PDFWord[] {
    if (chars.length === 0) return [];

    // Sort chars by position (top-to-bottom, left-to-right)
    const sortedChars = this.sortCharsByPosition(chars);

    // Group into lines first
    const lines = this.groupCharsIntoLines(sortedChars);

    // Split lines into words
    const words: PDFWord[] = [];
    for (const lineChars of lines) {
      words.push(...this.splitLineIntoWords(lineChars));
    }

    return words;
  }

  /**
   * Analyze characters into text lines
   */
  analyzeCharsToLines(chars: PDFChar[]): PDFTextLine[] {
    if (chars.length === 0) return [];

    // Sort and group into lines
    const sortedChars = this.sortCharsByPosition(chars);
    const lineGroups = this.groupCharsIntoLines(sortedChars);

    // Convert to PDFTextLine format, filtering out null results
    return lineGroups
      .map((lineChars) => this.createLine(lineChars))
      .filter((line): line is PDFTextLine => line !== null);
  }

  /**
   * Extract text with layout analysis
   */
  extractText(chars: PDFChar[]): string {
    const lines = this.analyzeCharsToLines(chars);

    // If boxesFlow is null, use visual order
    if (this.params.boxesFlow === null) {
      return lines
        .sort((a, b) => {
          const yDiff = a.y0 - b.y0;
          if (Math.abs(yDiff) > 3) return yDiff;
          return a.x0 - b.x0;
        })
        .map((line) => line.text)
        .join('\n');
    }

    // Use flow-based ordering
    const textGroups = this.groupLinesIntoBlocks(lines);
    return textGroups
      .sort((a, b) => a.flowIndex - b.flowIndex)
      .map((group) => group.boxes.map((b) => b.text).join('\n'))
      .join('\n\n');
  }

  /**
   * Sort characters by position
   */
  private sortCharsByPosition(chars: PDFChar[]): PDFChar[] {
    const sorted = [...chars];

    sorted.sort((a, b) => {
      // Check if chars are on the same line
      const aCenter = (a.y0 + a.y1) / 2;
      const bCenter = (b.y0 + b.y1) / 2;
      const aHeight = a.y1 - a.y0;
      const bHeight = b.y1 - b.y0;
      const overlap = this.calculateOverlap(a.y0, a.y1, b.y0, b.y1);
      const minHeight = Math.min(aHeight, bHeight);

      // If vertical overlap is significant, they're on the same line
      if (overlap / minHeight >= this.params.lineOverlap) {
        // Same line - sort by x position
        return a.x0 - b.x0;
      }

      // Different lines - sort by y position
      return a.y0 - b.y0;
    });

    return sorted;
  }

  /**
   * Group characters into lines based on vertical position
   */
  private groupCharsIntoLines(chars: PDFChar[]): PDFChar[][] {
    if (chars.length === 0) return [];

    const lines: PDFChar[][] = [];
    let currentLine: PDFChar[] = [chars[0]];
    let lineY0 = chars[0].y0;
    let lineY1 = chars[0].y1;

    for (let i = 1; i < chars.length; i++) {
      const char = chars[i];
      const charHeight = char.y1 - char.y0;
      const lineHeight = lineY1 - lineY0;

      // Check vertical overlap with current line
      const overlap = this.calculateOverlap(lineY0, lineY1, char.y0, char.y1);
      const minHeight = Math.min(charHeight, lineHeight);

      if (minHeight > 0 && overlap / minHeight >= this.params.lineOverlap) {
        // Same line
        currentLine.push(char);
        lineY0 = Math.min(lineY0, char.y0);
        lineY1 = Math.max(lineY1, char.y1);
      } else {
        // New line
        lines.push(currentLine);
        currentLine = [char];
        lineY0 = char.y0;
        lineY1 = char.y1;
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    // Sort each line by x position
    for (const line of lines) {
      line.sort((a, b) => a.x0 - b.x0);
    }

    return lines;
  }

  /**
   * Split a line of characters into words
   */
  private splitLineIntoWords(lineChars: PDFChar[]): PDFWord[] {
    if (lineChars.length === 0) return [];

    const words: PDFWord[] = [];
    let currentWordChars: PDFChar[] = [lineChars[0]];

    for (let i = 1; i < lineChars.length; i++) {
      const prevChar = lineChars[i - 1];
      const char = lineChars[i];

      // Calculate gap between characters
      const gap = char.x0 - prevChar.x1;
      const avgCharWidth = (prevChar.width + char.width) / 2;

      // Determine if this is a word break
      const isWordBreak =
        gap > avgCharWidth * this.params.charMargin ||
        (gap > avgCharWidth * this.params.wordMargin && prevChar.text === ' ') ||
        char.text === ' ';

      if (isWordBreak) {
        // End current word (skip if it's just whitespace)
        const wordText = currentWordChars.map((c) => c.text).join('');
        if (wordText.trim()) {
          const word = this.createWord(currentWordChars);
          if (word) words.push(word);
        }
        currentWordChars = [char];
      } else {
        currentWordChars.push(char);
      }
    }

    // Add final word
    const wordText = currentWordChars.map((c) => c.text).join('');
    if (wordText.trim()) {
      const word = this.createWord(currentWordChars);
      if (word) words.push(word);
    }

    return words;
  }

  /**
   * Group text lines into logical blocks
   */
  private groupLinesIntoBlocks(lines: PDFTextLine[]): TextGroup[] {
    if (lines.length === 0) return [];

    // Convert lines to boxes
    const boxes: LayoutBox[] = lines.map((line) => ({
      text: line.text,
      x0: line.x0,
      y0: line.y0,
      x1: line.x1,
      y1: line.y1,
      chars: line.chars,
      isVertical: false,
    }));

    // Group boxes that are close together
    const groups: TextGroup[] = [];
    const assigned = new Set<number>();

    for (let i = 0; i < boxes.length; i++) {
      if (assigned.has(i)) continue;

      const group: TextGroup = {
        boxes: [boxes[i]],
        x0: boxes[i].x0,
        y0: boxes[i].y0,
        x1: boxes[i].x1,
        y1: boxes[i].y1,
        flowIndex: 0,
      };
      assigned.add(i);

      // Find all boxes that belong to this group
      let changed = true;
      while (changed) {
        changed = false;
        for (let j = 0; j < boxes.length; j++) {
          if (assigned.has(j)) continue;

          const box = boxes[j];
          const avgLineHeight = (group.y1 - group.y0) / group.boxes.length;

          // Check if box is close enough to be part of this group
          const verticalGap = Math.min(
            Math.abs(box.y0 - group.y1),
            Math.abs(group.y0 - box.y1)
          );

          const horizontalOverlap = this.calculateOverlap(
            group.x0, group.x1, box.x0, box.x1
          );

          if (
            verticalGap < avgLineHeight * this.params.lineMargin &&
            horizontalOverlap > 0
          ) {
            group.boxes.push(box);
            group.x0 = Math.min(group.x0, box.x0);
            group.y0 = Math.min(group.y0, box.y0);
            group.x1 = Math.max(group.x1, box.x1);
            group.y1 = Math.max(group.y1, box.y1);
            assigned.add(j);
            changed = true;
          }
        }
      }

      groups.push(group);
    }

    // Calculate flow index based on boxesFlow parameter
    this.calculateFlowIndex(groups);

    return groups;
  }

  /**
   * Calculate flow index for text groups
   */
  private calculateFlowIndex(groups: TextGroup[]): void {
    const boxesFlow = this.params.boxesFlow ?? 0.5;

    for (const group of groups) {
      // Weight between horizontal (0) and vertical (1) position
      const horizontalScore = group.x0;
      const verticalScore = group.y0;

      // Mix based on boxesFlow parameter
      group.flowIndex =
        horizontalScore * (1 - boxesFlow) + verticalScore * boxesFlow;
    }
  }

  /**
   * Calculate overlap between two ranges
   */
  private calculateOverlap(a0: number, a1: number, b0: number, b1: number): number {
    const overlapStart = Math.max(a0, b0);
    const overlapEnd = Math.min(a1, b1);
    return Math.max(0, overlapEnd - overlapStart);
  }

  /**
   * Create a word from characters
   */
  private createWord(chars: PDFChar[]): PDFWord | null {
    if (chars.length === 0) return null;

    const x0 = Math.min(...chars.map((c) => c.x0));
    const y0 = Math.min(...chars.map((c) => c.y0));
    const x1 = Math.max(...chars.map((c) => c.x1));
    const y1 = Math.max(...chars.map((c) => c.y1));

    return {
      text: chars.map((c) => c.text).join(''),
      x0,
      y0,
      x1,
      y1,
      top: y0,
      bottom: y1,
      doctop: Math.min(...chars.map((c) => c.doctop)),
      chars,
      direction: chars[0].x0 <= chars[chars.length - 1].x0 ? 'ltr' : 'rtl',
      upright: chars.every((c) => c.upright),
    };
  }

  /**
   * Create a line from characters
   */
  private createLine(chars: PDFChar[]): PDFTextLine | null {
    if (chars.length === 0) return null;

    const x0 = Math.min(...chars.map((c) => c.x0));
    const y0 = Math.min(...chars.map((c) => c.y0));
    const x1 = Math.max(...chars.map((c) => c.x1));
    const y1 = Math.max(...chars.map((c) => c.y1));

    const words = this.splitLineIntoWords(chars);

    return {
      text: chars.map((c) => c.text).join(''),
      x0,
      y0,
      x1,
      y1,
      top: y0,
      bottom: y1,
      doctop: Math.min(...chars.map((c) => c.doctop)),
      chars,
      words,
    };
  }
}

/**
 * Analyze text layout with custom parameters
 */
export function analyzeLayout(
  chars: PDFChar[],
  params?: Partial<LayoutParams>
): {
  words: PDFWord[];
  lines: PDFTextLine[];
  text: string;
} {
  const analyzer = new LayoutAnalyzer(params);

  return {
    words: analyzer.analyzeCharsToWords(chars),
    lines: analyzer.analyzeCharsToLines(chars),
    text: analyzer.extractText(chars),
  };
}

/**
 * Detect if text is likely vertical
 */
export function isVerticalText(chars: PDFChar[]): boolean {
  if (chars.length < 2) return false;

  let verticalCount = 0;
  let horizontalCount = 0;

  for (let i = 1; i < chars.length; i++) {
    const prev = chars[i - 1];
    const curr = chars[i];

    const dx = Math.abs(curr.x0 - prev.x0);
    const dy = Math.abs(curr.y0 - prev.y0);

    if (dy > dx) {
      verticalCount++;
    } else {
      horizontalCount++;
    }
  }

  return verticalCount > horizontalCount * 2;
}

/**
 * Detect reading direction
 */
export function detectReadingDirection(chars: PDFChar[]): 'ltr' | 'rtl' | 'ttb' | 'btt' {
  if (chars.length < 2) return 'ltr';

  // Check if text is vertical
  if (isVerticalText(chars)) {
    // Check vertical direction
    const firstY = chars[0].y0;
    const lastY = chars[chars.length - 1].y0;
    return lastY > firstY ? 'ttb' : 'btt';
  }

  // Check horizontal direction
  const firstX = chars[0].x0;
  const lastX = chars[chars.length - 1].x0;
  return lastX > firstX ? 'ltr' : 'rtl';
}

/**
 * Detect text columns in a page
 */
export function detectTextColumns(
  chars: PDFChar[],
  minGapRatio: number = 0.03
): Array<{ x0: number; x1: number }> {
  if (chars.length < 10) return [];

  // Get page bounds
  const minX = Math.min(...chars.map((c) => c.x0));
  const maxX = Math.max(...chars.map((c) => c.x1));
  const pageWidth = maxX - minX;
  const minGap = pageWidth * minGapRatio;

  // Create histogram of x positions
  const binSize = pageWidth / 100;
  const histogram = new Map<number, number>();

  for (const char of chars) {
    const bin = Math.floor((char.x0 - minX) / binSize);
    histogram.set(bin, (histogram.get(bin) || 0) + 1);
  }

  // Find gaps (empty bins)
  const gaps: Array<{ start: number; end: number }> = [];
  let gapStart = -1;

  for (let bin = 0; bin <= 100; bin++) {
    const count = histogram.get(bin) || 0;

    if (count === 0) {
      if (gapStart === -1) gapStart = bin;
    } else {
      if (gapStart !== -1) {
        const gapWidth = (bin - gapStart) * binSize;
        if (gapWidth >= minGap) {
          gaps.push({
            start: minX + gapStart * binSize,
            end: minX + bin * binSize,
          });
        }
        gapStart = -1;
      }
    }
  }

  // Convert gaps to columns
  if (gaps.length === 0) {
    return [{ x0: minX, x1: maxX }];
  }

  const columns: Array<{ x0: number; x1: number }> = [];
  let colStart = minX;

  for (const gap of gaps) {
    columns.push({ x0: colStart, x1: gap.start });
    colStart = gap.end;
  }
  columns.push({ x0: colStart, x1: maxX });

  return columns;
}
