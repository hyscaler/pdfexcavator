/**
 * Edge Case Tests
 * Tests for handling edge cases: empty inputs, unicode, malformed data, etc.
 */

import type { PDFChar, Matrix } from '../src/types.js';

// Helper to create mock PDFChar
function createMockChar(text: string, x0: number, y0: number): PDFChar {
  return {
    text,
    x0,
    y0,
    x1: x0 + 10,
    y1: y0 + 12,
    width: 10,
    height: 12,
    top: y0,
    bottom: y0 + 12,
    doctop: y0,
    fontName: 'TestFont',
    size: 12,
    adv: 10,
    upright: true,
    matrix: [1, 0, 0, 1, x0, y0] as Matrix,
    strokingColor: null,
    nonStrokingColor: null,
    pageNumber: 0,
  };
}

describe('Edge Cases', () => {
  describe('Empty Inputs', () => {
    let extractWords: typeof import('../src/index.js').extractWords;
    let extractLines: typeof import('../src/index.js').extractLines;
    let extractText: typeof import('../src/index.js').extractText;
    let extractTables: typeof import('../src/index.js').extractTables;
    let findTables: typeof import('../src/index.js').findTables;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      extractWords = module.extractWords;
      extractLines = module.extractLines;
      extractText = module.extractText;
      extractTables = module.extractTables;
      findTables = module.findTables;
    });

    it('should handle empty char array in extractWords', () => {
      expect(extractWords([])).toEqual([]);
    });

    it('should handle empty char array in extractLines', () => {
      expect(extractLines([])).toEqual([]);
    });

    it('should handle empty char array in extractText', () => {
      expect(extractText([])).toBe('');
    });

    it('should handle empty arrays in extractTables', () => {
      expect(extractTables([], [], [], 0)).toEqual([]);
    });

    it('should handle empty arrays in findTables', () => {
      const result = findTables([], [], [], 0);
      expect(result.tables).toEqual([]);
      expect(result.edges).toEqual([]);
      expect(result.intersections).toEqual([]);
    });
  });

  describe('Single Element Inputs', () => {
    let extractWords: typeof import('../src/index.js').extractWords;
    let extractLines: typeof import('../src/index.js').extractLines;
    let extractText: typeof import('../src/index.js').extractText;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      extractWords = module.extractWords;
      extractLines = module.extractLines;
      extractText = module.extractText;
    });

    it('should handle single character', () => {
      const chars = [createMockChar('A', 0, 0)];

      const words = extractWords(chars);
      expect(words).toHaveLength(1);
      expect(words[0].text).toBe('A');
    });

    it('should handle single space character', () => {
      const chars = [createMockChar(' ', 0, 0)];

      const words = extractWords(chars);
      // Space-only words are typically filtered out
      expect(words.length).toBeLessThanOrEqual(1);
    });

    it('should handle single line', () => {
      const chars = [createMockChar('X', 0, 0)];

      const lines = extractLines(chars);
      expect(lines).toHaveLength(1);
    });
  });

  describe('Unicode Handling', () => {
    let extractWords: typeof import('../src/index.js').extractWords;
    let extractText: typeof import('../src/index.js').extractText;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      extractWords = module.extractWords;
      extractText = module.extractText;
    });

    it('should handle basic Latin characters', () => {
      const chars = [
        createMockChar('H', 0, 0),
        createMockChar('e', 10, 0),
        createMockChar('l', 20, 0),
        createMockChar('l', 30, 0),
        createMockChar('o', 40, 0),
      ];

      const text = extractText(chars);
      expect(text).toContain('Hello');
    });

    it('should handle accented characters', () => {
      const chars = [
        createMockChar('é', 0, 0),
        createMockChar('è', 10, 0),
        createMockChar('ê', 20, 0),
        createMockChar('ë', 30, 0),
      ];

      const text = extractText(chars);
      expect(text).toContain('é');
      expect(text).toContain('è');
    });

    it('should handle CJK characters', () => {
      const chars = [
        createMockChar('日', 0, 0),
        createMockChar('本', 15, 0),
        createMockChar('語', 30, 0),
      ];

      const text = extractText(chars);
      expect(text).toContain('日');
      expect(text).toContain('本');
      expect(text).toContain('語');
    });

    it('should handle Arabic characters', () => {
      const chars = [
        createMockChar('م', 0, 0),
        createMockChar('ر', 10, 0),
        createMockChar('ح', 20, 0),
        createMockChar('ب', 30, 0),
        createMockChar('ا', 40, 0),
      ];

      const text = extractText(chars);
      expect(text.length).toBeGreaterThan(0);
    });

    it('should handle Cyrillic characters', () => {
      const chars = [
        createMockChar('П', 0, 0),
        createMockChar('р', 10, 0),
        createMockChar('и', 20, 0),
        createMockChar('в', 30, 0),
        createMockChar('е', 40, 0),
        createMockChar('т', 50, 0),
      ];

      const text = extractText(chars);
      expect(text).toContain('Привет');
    });

    it('should handle emoji', () => {
      const chars = [
        createMockChar('👋', 0, 0),
        createMockChar('🌍', 20, 0),
        createMockChar('🎉', 40, 0),
      ];

      const words = extractWords(chars);
      expect(words.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle mixed scripts', () => {
      const chars = [
        createMockChar('H', 0, 0),
        createMockChar('日', 10, 0),
        createMockChar('م', 25, 0),
      ];

      const text = extractText(chars);
      expect(text.length).toBeGreaterThan(0);
    });

    it('should handle zero-width characters', () => {
      const chars = [
        createMockChar('A', 0, 0),
        createMockChar('\u200B', 10, 0), // Zero-width space
        createMockChar('B', 10, 0),
      ];

      const text = extractText(chars);
      expect(text).toContain('A');
      expect(text).toContain('B');
    });

    it('should handle combining characters', () => {
      const chars = [
        createMockChar('e', 0, 0),
        createMockChar('\u0301', 10, 0), // Combining acute accent
      ];

      const text = extractText(chars);
      expect(text.length).toBeGreaterThan(0);
    });
  });

  describe('Whitespace Handling', () => {
    let extractWords: typeof import('../src/index.js').extractWords;
    let extractText: typeof import('../src/index.js').extractText;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      extractWords = module.extractWords;
      extractText = module.extractText;
    });

    it('should handle multiple spaces', () => {
      const chars = [
        createMockChar('A', 0, 0),
        createMockChar(' ', 10, 0),
        createMockChar(' ', 20, 0),
        createMockChar(' ', 30, 0),
        createMockChar('B', 40, 0),
      ];

      const words = extractWords(chars);
      expect(words.filter(w => w.text.trim()).length).toBe(2);
    });

    it('should handle tabs', () => {
      const chars = [
        createMockChar('A', 0, 0),
        createMockChar('\t', 10, 0),
        createMockChar('B', 50, 0),
      ];

      const words = extractWords(chars);
      expect(words.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle newlines in char array', () => {
      const chars = [
        createMockChar('A', 0, 0),
        createMockChar('\n', 10, 0),
        createMockChar('B', 0, 20),
      ];

      const text = extractText(chars);
      expect(text).toContain('A');
      expect(text).toContain('B');
    });

    it('should handle carriage returns', () => {
      const chars = [
        createMockChar('A', 0, 0),
        createMockChar('\r', 10, 0),
        createMockChar('B', 0, 20),
      ];

      const words = extractWords(chars);
      expect(words.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle form feed', () => {
      const chars = [
        createMockChar('A', 0, 0),
        createMockChar('\f', 10, 0),
        createMockChar('B', 20, 0),
      ];

      const text = extractText(chars);
      expect(text.length).toBeGreaterThan(0);
    });
  });

  describe('Coordinate Edge Cases', () => {
    let extractWords: typeof import('../src/index.js').extractWords;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      extractWords = module.extractWords;
    });

    it('should handle negative coordinates', () => {
      const chars = [
        createMockChar('A', -100, -50),
        createMockChar('B', -90, -50),
      ];

      const words = extractWords(chars);
      expect(words).toHaveLength(1);
      expect(words[0].x0).toBe(-100);
    });

    it('should handle very large coordinates', () => {
      const chars = [
        createMockChar('A', 10000, 10000),
        createMockChar('B', 10010, 10000),
      ];

      const words = extractWords(chars);
      expect(words).toHaveLength(1);
    });

    it('should handle zero coordinates', () => {
      const chars = [
        createMockChar('A', 0, 0),
        createMockChar('B', 10, 0),
      ];

      const words = extractWords(chars);
      expect(words[0].x0).toBe(0);
      expect(words[0].y0).toBe(0);
    });

    it('should handle floating point coordinates', () => {
      const char1 = createMockChar('A', 0, 0);
      char1.x0 = 10.123456789;
      char1.y0 = 20.987654321;

      const char2 = createMockChar('B', 20.5, 20.987654321);

      const words = extractWords([char1, char2]);
      expect(words.length).toBeGreaterThanOrEqual(1);
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
  });

  describe('Special Characters', () => {
    let extractText: typeof import('../src/index.js').extractText;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      extractText = module.extractText;
    });

    it('should handle punctuation', () => {
      const chars = 'Hello, World!'.split('').map((c, i) =>
        createMockChar(c, i * 10, 0)
      );

      const text = extractText(chars);
      expect(text).toContain('Hello');
      expect(text).toContain('World');
    });

    it('should handle quotes', () => {
      const chars = [
        createMockChar('"', 0, 0),
        createMockChar('t', 10, 0),
        createMockChar('e', 20, 0),
        createMockChar('s', 30, 0),
        createMockChar('t', 40, 0),
        createMockChar('"', 50, 0),
      ];

      const text = extractText(chars);
      expect(text).toContain('"');
      expect(text).toContain('test');
    });

    it('should handle brackets', () => {
      const chars = [
        createMockChar('[', 0, 0),
        createMockChar('1', 10, 0),
        createMockChar(']', 20, 0),
      ];

      const text = extractText(chars);
      expect(text).toContain('[');
      expect(text).toContain('1');
      expect(text).toContain(']');
    });

    it('should handle math symbols', () => {
      const chars = [
        createMockChar('x', 0, 0),
        createMockChar('+', 10, 0),
        createMockChar('y', 20, 0),
        createMockChar('=', 30, 0),
        createMockChar('z', 40, 0),
      ];

      const text = extractText(chars);
      expect(text).toContain('+');
      expect(text).toContain('=');
    });

    it('should handle currency symbols', () => {
      const chars = [
        createMockChar('$', 0, 0),
        createMockChar('1', 10, 0),
        createMockChar('0', 20, 0),
        createMockChar('0', 30, 0),
      ];

      const text = extractText(chars);
      expect(text).toContain('$');
      expect(text).toContain('100');
    });
  });

  describe('Font and Size Variations', () => {
    let extractWords: typeof import('../src/index.js').extractWords;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      extractWords = module.extractWords;
    });

    it('should handle different font sizes', () => {
      const char1 = createMockChar('A', 0, 0);
      char1.size = 8;

      const char2 = createMockChar('B', 10, 0);
      char2.size = 24;

      const char3 = createMockChar('C', 40, 0);
      char3.size = 12;

      const words = extractWords([char1, char2, char3]);
      expect(words.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle different font names', () => {
      const char1 = createMockChar('A', 0, 0);
      char1.fontName = 'Arial';

      const char2 = createMockChar('B', 10, 0);
      char2.fontName = 'Times';

      const words = extractWords([char1, char2]);
      expect(words).toHaveLength(1);
    });

    it('should handle zero size', () => {
      const char = createMockChar('A', 0, 0);
      char.size = 0;
      char.width = 0;
      char.height = 0;

      const words = extractWords([char]);
      expect(words.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Edge Cases', () => {
    let extractWords: typeof import('../src/index.js').extractWords;
    let extractText: typeof import('../src/index.js').extractText;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      extractWords = module.extractWords;
      extractText = module.extractText;
    });

    it('should handle large number of characters efficiently', () => {
      const chars: PDFChar[] = [];
      for (let i = 0; i < 50000; i++) {
        chars.push(createMockChar('x', (i % 80) * 10, Math.floor(i / 80) * 15));
      }

      const start = Date.now();
      extractWords(chars);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle deeply nested line structure', () => {
      const chars: PDFChar[] = [];
      for (let line = 0; line < 1000; line++) {
        for (let char = 0; char < 5; char++) {
          chars.push(createMockChar('x', char * 10, line * 15));
        }
      }

      const start = Date.now();
      extractText(chars);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000);
    });

    it('should handle single very long word', () => {
      const chars: PDFChar[] = [];
      for (let i = 0; i < 1000; i++) {
        chars.push(createMockChar('x', i * 8, 0));
      }

      const words = extractWords(chars);
      expect(words).toHaveLength(1);
      expect(words[0].text.length).toBe(1000);
    });
  });
});
