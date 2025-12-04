/**
 * Text Extraction Tests
 * Tests for extractChars, extractWords, extractLines, extractText
 */

import type { PDFChar, Matrix } from '../src/types.js';

// Helper to create mock PDFChar objects
function createMockChar(
  text: string,
  x0: number,
  y0: number,
  options: Partial<{
    width: number;
    height: number;
    fontName: string;
    size: number;
    pageNumber: number;
  }> = {}
): PDFChar {
  const { width = 10, height = 12, fontName = 'TestFont', size = 12, pageNumber = 0 } = options;

  return {
    text,
    x0,
    y0,
    x1: x0 + width,
    y1: y0 + height,
    width,
    height,
    top: y0,
    bottom: y0 + height,
    doctop: y0,
    fontName,
    size,
    adv: width,
    upright: true,
    matrix: [1, 0, 0, 1, x0, y0] as Matrix,
    strokingColor: null,
    nonStrokingColor: null,
    pageNumber,
  };
}

// Helper to create a word from string
function createWord(word: string, startX: number, y: number, charWidth: number = 10): PDFChar[] {
  return word.split('').map((char, i) => createMockChar(char, startX + i * charWidth, y));
}

describe('Text Extraction', () => {
  describe('extractWords', () => {
    let extractWords: typeof import('../src/index.js').extractWords;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      extractWords = module.extractWords;
    });

    it('should return empty array for empty input', () => {
      expect(extractWords([])).toEqual([]);
    });

    it('should group adjacent characters into words', () => {
      const chars = createWord('Hello', 0, 0);
      const words = extractWords(chars);

      expect(words).toHaveLength(1);
      expect(words[0].text).toBe('Hello');
    });

    it('should split words on spaces', () => {
      const chars = [
        ...createWord('Hello', 0, 0),
        createMockChar(' ', 50, 0),
        ...createWord('World', 70, 0),
      ];
      const words = extractWords(chars);

      expect(words).toHaveLength(2);
      expect(words[0].text).toBe('Hello');
      expect(words[1].text).toBe('World');
    });

    it('should split words on large gaps', () => {
      const chars = [
        ...createWord('Hello', 0, 0),
        ...createWord('World', 200, 0), // Large gap
      ];
      const words = extractWords(chars, { xTolerance: 3 });

      expect(words).toHaveLength(2);
    });

    it('should respect yTolerance for line breaks', () => {
      const chars = [
        ...createWord('Line1', 0, 0),
        ...createWord('Line2', 0, 50), // Different line
      ];
      const words = extractWords(chars, { yTolerance: 3 });

      expect(words).toHaveLength(2);
      expect(words[0].text).toBe('Line1');
      expect(words[1].text).toBe('Line2');
    });

    it('should split on punctuation when enabled', () => {
      const chars = [
        createMockChar('a', 0, 0),
        createMockChar('.', 10, 0),
        createMockChar('b', 20, 0),
      ];
      const words = extractWords(chars, { splitAtPunctuation: true });

      expect(words.length).toBeGreaterThanOrEqual(2);
    });

    it('should use xToleranceRatio when specified', () => {
      const chars = [
        createMockChar('A', 0, 0, { size: 24 }),
        createMockChar('B', 30, 0, { size: 24 }), // Gap relative to font size
      ];
      const words = extractWords(chars, { xToleranceRatio: 0.5 });

      // With ratio 0.5 and size 24, tolerance is 12
      expect(words.length).toBeGreaterThanOrEqual(1);
    });

    it('should calculate word bounding box correctly', () => {
      const chars = createWord('Test', 10, 20);
      const words = extractWords(chars);

      expect(words[0].x0).toBe(10);
      expect(words[0].y0).toBe(20);
      expect(words[0].x1).toBe(50); // 10 + 4*10
      expect(words[0].y1).toBe(32); // 20 + 12
    });

    it('should preserve character references', () => {
      const chars = createWord('Hi', 0, 0);
      const words = extractWords(chars);

      expect(words[0].chars).toHaveLength(2);
      expect(words[0].chars[0].text).toBe('H');
      expect(words[0].chars[1].text).toBe('i');
    });

    it('should detect text direction', () => {
      const ltrChars = createWord('Hello', 0, 0);
      const ltrWords = extractWords(ltrChars);
      expect(ltrWords[0].direction).toBe('ltr');
    });
  });

  describe('extractLines', () => {
    let extractLines: typeof import('../src/index.js').extractLines;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      extractLines = module.extractLines;
    });

    it('should return empty array for empty input', () => {
      expect(extractLines([])).toEqual([]);
    });

    it('should group characters on same line', () => {
      const chars = createWord('Hello World', 0, 0, 10);
      const lines = extractLines(chars);

      expect(lines).toHaveLength(1);
      expect(lines[0].text).toContain('Hello');
    });

    it('should separate characters on different lines', () => {
      const chars = [
        ...createWord('Line1', 0, 0),
        ...createWord('Line2', 0, 50),
      ];
      const lines = extractLines(chars, 3);

      expect(lines).toHaveLength(2);
    });

    it('should respect yTolerance parameter', () => {
      const chars = [
        ...createWord('Same', 0, 0),
        ...createWord('Line', 50, 2), // Slightly different y
      ];

      const tightLines = extractLines(chars, 1);
      const looseLines = extractLines(chars, 5);

      expect(tightLines.length).toBeGreaterThanOrEqual(looseLines.length);
    });

    it('should include words in lines', () => {
      const chars = [
        ...createWord('Hello', 0, 0),
        createMockChar(' ', 50, 0),
        ...createWord('World', 70, 0),
      ];
      const lines = extractLines(chars);

      expect(lines[0].words.length).toBeGreaterThanOrEqual(1);
    });

    it('should calculate line bounding box', () => {
      const chars = createWord('Test', 10, 20);
      const lines = extractLines(chars);

      expect(lines[0].x0).toBe(10);
      expect(lines[0].y0).toBe(20);
    });
  });

  describe('extractText', () => {
    let extractText: typeof import('../src/index.js').extractText;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      extractText = module.extractText;
    });

    it('should return empty string for empty input', () => {
      expect(extractText([])).toBe('');
    });

    it('should extract text from characters', () => {
      const chars = createWord('Hello', 0, 0);
      const text = extractText(chars);

      expect(text).toContain('Hello');
    });

    it('should add spaces between words', () => {
      const chars = [
        ...createWord('Hello', 0, 0),
        ...createWord('World', 100, 0),
      ];
      const text = extractText(chars, { xTolerance: 3 });

      expect(text).toMatch(/Hello\s+World/);
    });

    it('should add newlines between lines', () => {
      const chars = [
        ...createWord('Line1', 0, 0),
        ...createWord('Line2', 0, 50),
      ];
      const text = extractText(chars, { yTolerance: 3 });

      expect(text).toContain('\n');
    });

    it('should respect layout option', () => {
      const chars = [
        ...createWord('Left', 0, 0),
        ...createWord('Right', 300, 0),
      ];

      const simpleText = extractText(chars, { layout: false });
      const layoutText = extractText(chars, { layout: true });

      // Layout mode should preserve spacing
      expect(typeof simpleText).toBe('string');
      expect(typeof layoutText).toBe('string');
    });
  });

  describe('extractTextSimple', () => {
    let extractTextSimple: typeof import('../src/index.js').extractTextSimple;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      extractTextSimple = module.extractTextSimple;
    });

    it('should return empty string for empty input', () => {
      expect(extractTextSimple([])).toBe('');
    });

    it('should extract text quickly', () => {
      const chars = createWord('Quick', 0, 0);

      const start = Date.now();
      const text = extractTextSimple(chars);
      const duration = Date.now() - start;

      expect(text).toContain('Quick');
      expect(duration).toBeLessThan(100);
    });

    it('should respect useTextFlow option', () => {
      const chars = createWord('Test', 0, 0);

      const flowText = extractTextSimple(chars, 3, 3, true);
      const noFlowText = extractTextSimple(chars, 3, 3, false);

      expect(flowText).toContain('Test');
      expect(noFlowText).toContain('Test');
    });
  });

  describe('Character Positioning', () => {
    let extractWords: typeof import('../src/index.js').extractWords;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      extractWords = module.extractWords;
    });

    it('should handle overlapping characters', () => {
      const chars = [
        createMockChar('A', 0, 0),
        createMockChar('B', 5, 0), // Overlaps with A
        createMockChar('C', 10, 0),
      ];

      const words = extractWords(chars, { useTextFlow: true });
      expect(words).toHaveLength(1);
      expect(words[0].text).toBe('ABC');
    });

    it('should handle characters with different sizes', () => {
      const chars = [
        createMockChar('A', 0, 0, { size: 12 }),
        createMockChar('B', 15, 0, { size: 24 }),
        createMockChar('C', 40, 0, { size: 12 }),
      ];

      const words = extractWords(chars);
      expect(words.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle negative coordinates', () => {
      const chars = [
        createMockChar('A', -10, -5),
        createMockChar('B', 0, -5),
      ];

      const words = extractWords(chars);
      expect(words[0].x0).toBe(-10);
    });
  });

  describe('Unicode and Special Characters', () => {
    let extractText: typeof import('../src/index.js').extractText;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      extractText = module.extractText;
    });

    it('should handle Unicode characters', () => {
      const chars = [
        createMockChar('日', 0, 0),
        createMockChar('本', 10, 0),
        createMockChar('語', 20, 0),
      ];

      const text = extractText(chars);
      expect(text).toContain('日本語');
    });

    it('should handle emoji characters', () => {
      const chars = [
        createMockChar('👋', 0, 0),
        createMockChar('🌍', 10, 0),
      ];

      const text = extractText(chars);
      expect(text.length).toBeGreaterThan(0);
    });

    it('should handle whitespace characters', () => {
      const chars = [
        createMockChar('A', 0, 0),
        createMockChar('\t', 10, 0),
        createMockChar('B', 20, 0),
      ];

      const text = extractText(chars);
      expect(text).toContain('A');
      expect(text).toContain('B');
    });
  });

  describe('Performance', () => {
    let extractWords: typeof import('../src/index.js').extractWords;
    let extractText: typeof import('../src/index.js').extractText;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      extractWords = module.extractWords;
      extractText = module.extractText;
    });

    it('should handle large character arrays efficiently', () => {
      // Create 10000 characters
      const chars: PDFChar[] = [];
      for (let i = 0; i < 10000; i++) {
        chars.push(createMockChar('x', i * 5, Math.floor(i / 100) * 20));
      }

      const start = Date.now();
      extractWords(chars);
      const duration = Date.now() - start;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(5000);
    });

    it('should handle many lines efficiently', () => {
      const chars: PDFChar[] = [];
      for (let line = 0; line < 100; line++) {
        for (let char = 0; char < 80; char++) {
          chars.push(createMockChar('x', char * 10, line * 20));
        }
      }

      const start = Date.now();
      extractText(chars);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(3000);
    });
  });
});
