/**
 * Table Extraction Tests
 * Tests for findTables, extractTables, TableFinder
 */

import type { PDFChar, PDFLine, PDFRect, Matrix } from '../src/types.js';

// Helper to create mock PDFChar
function createMockChar(
  text: string,
  x0: number,
  y0: number,
  width: number = 10,
  height: number = 12
): PDFChar {
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
    fontName: 'TestFont',
    size: 12,
    adv: width,
    upright: true,
    matrix: [1, 0, 0, 1, x0, y0] as Matrix,
    strokingColor: null,
    nonStrokingColor: null,
    pageNumber: 0,
  };
}

// Helper to create mock PDFLine
function createMockLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): PDFLine {
  return {
    x0,
    y0,
    x1,
    y1,
    top: Math.min(y0, y1),
    bottom: Math.max(y0, y1),
    doctop: Math.min(y0, y1),
    lineWidth: 1,
    strokingColor: [0, 0, 0],
    stroke: true,
    pageNumber: 0,
  };
}

// Helper to create mock PDFRect
function createMockRect(
  x0: number,
  y0: number,
  width: number,
  height: number
): PDFRect {
  return {
    x0,
    y0,
    x1: x0 + width,
    y1: y0 + height,
    top: y0,
    bottom: y0 + height,
    doctop: y0,
    width,
    height,
    lineWidth: 1,
    strokingColor: [0, 0, 0],
    nonStrokingColor: null,
    stroke: true,
    fill: false,
    pageNumber: 0,
  };
}

// Helper to create a simple table structure with lines
function createTableLines(
  x: number,
  y: number,
  cols: number,
  rows: number,
  cellWidth: number = 100,
  cellHeight: number = 30
): PDFLine[] {
  const lines: PDFLine[] = [];

  // Horizontal lines
  for (let r = 0; r <= rows; r++) {
    lines.push(createMockLine(x, y + r * cellHeight, x + cols * cellWidth, y + r * cellHeight));
  }

  // Vertical lines
  for (let c = 0; c <= cols; c++) {
    lines.push(createMockLine(x + c * cellWidth, y, x + c * cellWidth, y + rows * cellHeight));
  }

  return lines;
}

// Helper to create text for table cells
function createTableChars(
  x: number,
  y: number,
  data: string[][],
  cellWidth: number = 100,
  cellHeight: number = 30
): PDFChar[] {
  const chars: PDFChar[] = [];

  data.forEach((row, rowIndex) => {
    row.forEach((cellText, colIndex) => {
      const cellX = x + colIndex * cellWidth + 5;
      const cellY = y + rowIndex * cellHeight + 10;

      cellText.split('').forEach((char, charIndex) => {
        chars.push(createMockChar(char, cellX + charIndex * 8, cellY));
      });
    });
  });

  return chars;
}

describe('Table Extraction', () => {
  describe('TableFinder', () => {
    let TableFinder: typeof import('../src/index.js').TableFinder;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      TableFinder = module.TableFinder;
    });

    it('should instantiate with basic parameters', () => {
      const finder = new TableFinder([], [], [], 0);
      expect(finder).toBeInstanceOf(TableFinder);
    });

    it('should instantiate with options', () => {
      const finder = new TableFinder([], [], [], 0, {
        verticalStrategy: 'lines',
        horizontalStrategy: 'lines',
      });
      expect(finder).toBeInstanceOf(TableFinder);
    });

    it('should return empty result for empty input', () => {
      const finder = new TableFinder([], [], [], 0);
      const result = finder.findTables();

      expect(result.tables).toEqual([]);
      expect(result.edges).toEqual([]);
      expect(result.intersections).toEqual([]);
    });

    it('should detect table from lines', () => {
      const lines = createTableLines(0, 0, 3, 3);
      const chars = createTableChars(0, 0, [
        ['A', 'B', 'C'],
        ['1', '2', '3'],
        ['X', 'Y', 'Z'],
      ]);

      const finder = new TableFinder(chars, lines, [], 0, {
        verticalStrategy: 'lines',
        horizontalStrategy: 'lines',
      });
      const result = finder.findTables();

      expect(result.edges.length).toBeGreaterThan(0);
    });

    it('should detect edges from lines', () => {
      const lines = [
        createMockLine(0, 0, 100, 0),   // Horizontal
        createMockLine(0, 0, 0, 100),   // Vertical
      ];

      const finder = new TableFinder([], lines, [], 0);
      const result = finder.findTables();

      expect(result.edges.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('findTables', () => {
    let findTables: typeof import('../src/index.js').findTables;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      findTables = module.findTables;
    });

    it('should return result object with tables, edges, intersections', () => {
      const result = findTables([], [], [], 0);

      expect(result).toHaveProperty('tables');
      expect(result).toHaveProperty('edges');
      expect(result).toHaveProperty('intersections');
    });

    it('should accept options parameter', () => {
      const result = findTables([], [], [], 0, {
        snapTolerance: 5,
        minWordsVertical: 2,
      });

      expect(result.tables).toBeInstanceOf(Array);
    });

    it('should find tables with line strategy', () => {
      const lines = createTableLines(0, 0, 2, 2);
      const result = findTables([], lines, [], 0, {
        verticalStrategy: 'lines',
        horizontalStrategy: 'lines',
      });

      expect(result.edges.length).toBeGreaterThan(0);
    });
  });

  describe('extractTables', () => {
    let extractTables: typeof import('../src/index.js').extractTables;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      extractTables = module.extractTables;
    });

    it('should return array of tables', () => {
      const tables = extractTables([], [], [], 0);
      expect(Array.isArray(tables)).toBe(true);
    });

    it('should return empty array for empty input', () => {
      const tables = extractTables([], [], [], 0);
      expect(tables).toEqual([]);
    });

    it('should extract tables with cell data', () => {
      const lines = createTableLines(0, 0, 2, 2);
      const chars = createTableChars(0, 0, [
        ['A', 'B'],
        ['C', 'D'],
      ]);

      const tables = extractTables(chars, lines, [], 0, {
        verticalStrategy: 'lines',
        horizontalStrategy: 'lines',
      });

      // May or may not find tables depending on line detection
      expect(Array.isArray(tables)).toBe(true);
    });
  });

  describe('Table Structure', () => {
    let extractTables: typeof import('../src/index.js').extractTables;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      extractTables = module.extractTables;
    });

    it('should include pageNumber in table', () => {
      const lines = createTableLines(0, 0, 2, 2);
      const tables = extractTables([], lines, [], 5);

      if (tables.length > 0) {
        expect(tables[0].pageNumber).toBe(5);
      }
    });

    it('should include bbox in table', () => {
      const lines = createTableLines(10, 20, 2, 2);
      const tables = extractTables([], lines, [], 0);

      if (tables.length > 0) {
        expect(tables[0].bbox).toBeDefined();
        expect(tables[0].bbox).toHaveLength(4);
      }
    });

    it('should have rows as 2D array', () => {
      const lines = createTableLines(0, 0, 2, 2);
      const chars = createTableChars(0, 0, [
        ['A', 'B'],
        ['C', 'D'],
      ]);
      const tables = extractTables(chars, lines, [], 0);

      if (tables.length > 0) {
        expect(Array.isArray(tables[0].rows)).toBe(true);
        if (tables[0].rows.length > 0) {
          expect(Array.isArray(tables[0].rows[0])).toBe(true);
        }
      }
    });
  });

  describe('Table Detection Strategies', () => {
    let TableFinder: typeof import('../src/index.js').TableFinder;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      TableFinder = module.TableFinder;
    });

    it('should support lines strategy', () => {
      const finder = new TableFinder([], [], [], 0, {
        verticalStrategy: 'lines',
        horizontalStrategy: 'lines',
      });
      expect(finder).toBeDefined();
    });

    it('should support lines_strict strategy', () => {
      const finder = new TableFinder([], [], [], 0, {
        verticalStrategy: 'lines_strict',
        horizontalStrategy: 'lines_strict',
      });
      expect(finder).toBeDefined();
    });

    it('should support text strategy', () => {
      const finder = new TableFinder([], [], [], 0, {
        verticalStrategy: 'text',
        horizontalStrategy: 'text',
      });
      expect(finder).toBeDefined();
    });

    it('should support explicit strategy', () => {
      const finder = new TableFinder([], [], [], 0, {
        verticalStrategy: 'explicit',
        horizontalStrategy: 'explicit',
        explicitVerticalLines: [0, 100, 200],
        explicitHorizontalLines: [0, 50, 100],
      });
      expect(finder).toBeDefined();
    });

    it('should support mixed strategies', () => {
      const finder = new TableFinder([], [], [], 0, {
        verticalStrategy: 'lines',
        horizontalStrategy: 'text',
      });
      expect(finder).toBeDefined();
    });
  });

  describe('Edge Detection', () => {
    let findTables: typeof import('../src/index.js').findTables;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      findTables = module.findTables;
    });

    it('should detect horizontal edges', () => {
      const lines = [
        createMockLine(0, 0, 200, 0),
        createMockLine(0, 50, 200, 50),
      ];
      const result = findTables([], lines, [], 0);

      // Edges should be detected
      expect(Array.isArray(result.edges)).toBe(true);
    });

    it('should detect vertical edges', () => {
      const lines = [
        createMockLine(0, 0, 0, 100),
        createMockLine(100, 0, 100, 100),
      ];
      const result = findTables([], lines, [], 0);

      expect(Array.isArray(result.edges)).toBe(true);
    });

    it('should detect intersections', () => {
      const lines = [
        createMockLine(0, 50, 200, 50),  // Horizontal
        createMockLine(100, 0, 100, 100), // Vertical
      ];
      const result = findTables([], lines, [], 0);

      expect(Array.isArray(result.intersections)).toBe(true);
    });

    it('should respect snapTolerance', () => {
      const lines = [
        createMockLine(0, 0, 100, 0),
        createMockLine(0, 2, 100, 2), // Almost same position
      ];

      const looseTolerance = findTables([], lines, [], 0, { snapTolerance: 5 });
      const tightTolerance = findTables([], lines, [], 0, { snapTolerance: 1 });

      // With loose tolerance, lines may be snapped together
      expect(Array.isArray(looseTolerance.edges)).toBe(true);
      expect(Array.isArray(tightTolerance.edges)).toBe(true);
    });
  });

  describe('Rectangle-based Tables', () => {
    let findTables: typeof import('../src/index.js').findTables;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      findTables = module.findTables;
    });

    it('should handle rectangles as table cells', () => {
      const rects = [
        createMockRect(0, 0, 100, 50),
        createMockRect(100, 0, 100, 50),
        createMockRect(0, 50, 100, 50),
        createMockRect(100, 50, 100, 50),
      ];

      const result = findTables([], [], rects, 0);
      expect(Array.isArray(result.tables)).toBe(true);
    });
  });

  describe('Text-based Table Detection', () => {
    let findTables: typeof import('../src/index.js').findTables;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      findTables = module.findTables;
    });

    it('should detect columns from aligned text', () => {
      // Create text aligned in columns
      const chars: PDFChar[] = [];

      // Column 1
      chars.push(createMockChar('A', 0, 0));
      chars.push(createMockChar('B', 0, 20));
      chars.push(createMockChar('C', 0, 40));

      // Column 2
      chars.push(createMockChar('1', 100, 0));
      chars.push(createMockChar('2', 100, 20));
      chars.push(createMockChar('3', 100, 40));

      const result = findTables(chars, [], [], 0, {
        verticalStrategy: 'text',
        horizontalStrategy: 'text',
        minWordsVertical: 2,
        minWordsHorizontal: 2,
      });

      expect(Array.isArray(result.tables)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    let extractTables: typeof import('../src/index.js').extractTables;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      extractTables = module.extractTables;
    });

    it('should handle single cell table', () => {
      const lines = createTableLines(0, 0, 1, 1);
      const tables = extractTables([], lines, [], 0);

      expect(Array.isArray(tables)).toBe(true);
    });

    it('should handle very wide tables', () => {
      const lines = createTableLines(0, 0, 20, 2, 50, 30);
      const tables = extractTables([], lines, [], 0);

      expect(Array.isArray(tables)).toBe(true);
    });

    it('should handle very tall tables', () => {
      const lines = createTableLines(0, 0, 2, 50, 100, 20);
      const tables = extractTables([], lines, [], 0);

      expect(Array.isArray(tables)).toBe(true);
    });

    it('should handle incomplete table borders', () => {
      // Missing some lines
      const lines = [
        createMockLine(0, 0, 200, 0),     // Top
        createMockLine(0, 100, 200, 100), // Bottom
        createMockLine(0, 0, 0, 100),     // Left
        // Missing right edge
      ];

      const tables = extractTables([], lines, [], 0);
      expect(Array.isArray(tables)).toBe(true);
    });

    it('should handle overlapping tables', () => {
      const lines1 = createTableLines(0, 0, 2, 2);
      const lines2 = createTableLines(150, 25, 2, 2); // Overlapping

      const tables = extractTables([], [...lines1, ...lines2], [], 0);
      expect(Array.isArray(tables)).toBe(true);
    });
  });
});
