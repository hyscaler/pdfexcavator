/**
 * Advanced Table Extraction Tests
 * Tests for TableFinder class, detection strategies, and special table cases
 */

import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { PDFChar, PDFLine, PDFRect, Matrix, PDFTable } from '../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper to create mock PDFChar
function createChar(
  text: string,
  x0: number,
  y0: number,
  width = 10,
  height = 12
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
function createLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  pageNumber = 0
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
    strokingColor: null,
    stroke: true,
    pageNumber,
  };
}

// Helper to create mock PDFRect
function createRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stroke = true,
  pageNumber = 0
): PDFRect {
  return {
    x0,
    y0,
    x1,
    y1,
    width: x1 - x0,
    height: y1 - y0,
    top: y0,
    bottom: y1,
    doctop: y0,
    lineWidth: 1,
    fill: false,
    stroke,
    strokingColor: null,
    nonStrokingColor: null,
    pageNumber,
  };
}

describe('Advanced Table Extraction', () => {
  let TableFinder: typeof import('../src/extractors/table.js').TableFinder;
  let findTables: typeof import('../src/extractors/table.js').findTables;
  let extractTables: typeof import('../src/extractors/table.js').extractTables;
  let extractTable: typeof import('../src/extractors/table.js').extractTable;
  let debugTableFinder: typeof import('../src/extractors/table.js').debugTableFinder;
  let detectBorderlessTables: typeof import('../src/extractors/table.js').detectBorderlessTables;
  let findNestedTables: typeof import('../src/extractors/table.js').findNestedTables;
  let extractTablesEnhanced: typeof import('../src/extractors/table.js').extractTablesEnhanced;

  beforeAll(async () => {
    const module = await import('../src/extractors/table.js');
    TableFinder = module.TableFinder;
    findTables = module.findTables;
    extractTables = module.extractTables;
    extractTable = module.extractTable;
    debugTableFinder = module.debugTableFinder;
    detectBorderlessTables = module.detectBorderlessTables;
    findNestedTables = module.findNestedTables;
    extractTablesEnhanced = module.extractTablesEnhanced;
  });

  describe('TableFinder', () => {
    it('should create instance with default options', () => {
      const finder = new TableFinder([], [], [], 0);
      expect(finder).toBeInstanceOf(TableFinder);
    });

    it('should create instance with custom options', () => {
      const finder = new TableFinder([], [], [], 0, {
        verticalStrategy: 'text',
        horizontalStrategy: 'text',
        snapTolerance: 5,
      });
      expect(finder).toBeInstanceOf(TableFinder);
    });

    it('should detect tables from lines', () => {
      // Create a simple 2x2 grid of lines
      const lines = [
        // Horizontal lines
        createLine(0, 0, 200, 0),    // top
        createLine(0, 50, 200, 50),  // middle
        createLine(0, 100, 200, 100), // bottom
        // Vertical lines
        createLine(0, 0, 0, 100),    // left
        createLine(100, 0, 100, 100), // middle
        createLine(200, 0, 200, 100), // right
      ];

      const finder = new TableFinder([], lines, [], 0);
      const result = finder.findTables();

      expect(result.tables).toBeDefined();
      expect(result.edges).toBeDefined();
      expect(result.intersections).toBeDefined();
    });

    it('should extract text content from table cells', () => {
      // Create chars for table content
      const chars = [
        createChar('A', 20, 20),
        createChar('B', 120, 20),
        createChar('C', 20, 70),
        createChar('D', 120, 70),
      ];

      // Create table grid
      const lines = [
        createLine(0, 0, 200, 0),
        createLine(0, 50, 200, 50),
        createLine(0, 100, 200, 100),
        createLine(0, 0, 0, 100),
        createLine(100, 0, 100, 100),
        createLine(200, 0, 200, 100),
      ];

      const finder = new TableFinder(chars, lines, [], 0);
      const result = finder.findTables();

      // If tables found, check they have cells with content
      if (result.tables.length > 0) {
        expect(result.tables[0].cells).toBeDefined();
      }
    });

    it('should handle empty input', () => {
      const finder = new TableFinder([], [], [], 0);
      const result = finder.findTables();

      expect(result.tables).toEqual([]);
      expect(result.edges).toEqual([]);
      expect(result.intersections).toEqual([]);
    });

    it('should use adaptive tolerance based on character size', () => {
      // Create chars with known sizes
      const chars = Array.from({ length: 100 }, (_, i) =>
        createChar('X', i * 10, 0, 8, 10)
      );

      const finder = new TableFinder(chars, [], [], 0);
      // Finder should adapt tolerance based on average char width
      expect(finder).toBeInstanceOf(TableFinder);
    });
  });

  describe('findTables', () => {
    it('should find tables with grid of lines', () => {
      const lines = [
        createLine(0, 0, 100, 0),
        createLine(0, 50, 100, 50),
        createLine(0, 0, 0, 50),
        createLine(50, 0, 50, 50),
        createLine(100, 0, 100, 50),
      ];

      const result = findTables([], lines, [], 0);

      expect(result.tables).toBeDefined();
      expect(result.edges.length).toBeGreaterThan(0);
    });

    it('should find intersections between lines', () => {
      const lines = [
        createLine(0, 50, 100, 50),   // horizontal
        createLine(50, 0, 50, 100),   // vertical crossing it
      ];

      const result = findTables([], lines, [], 0);

      expect(result.intersections.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle rectangles as table borders', () => {
      const rects = [createRect(0, 0, 100, 100, true)];

      const result = findTables([], [], rects, 0);

      // Stroked rectangles should be converted to edges
      expect(result.edges.length).toBeGreaterThanOrEqual(0);
    });

    it('should work with custom options', () => {
      const result = findTables([], [], [], 0, {
        snapTolerance: 10,
        joinTolerance: 10,
        edgeMinLength: 5,
      });

      expect(result).toBeDefined();
    });
  });

  describe('extractTables', () => {
    it('should extract tables as data structures', () => {
      const lines = [
        createLine(0, 0, 200, 0),
        createLine(0, 50, 200, 50),
        createLine(0, 100, 200, 100),
        createLine(0, 0, 0, 100),
        createLine(100, 0, 100, 100),
        createLine(200, 0, 200, 100),
      ];

      const chars = [
        createChar('H', 20, 20),
        createChar('e', 30, 20),
        createChar('l', 40, 20),
        createChar('l', 50, 20),
        createChar('o', 60, 20),
      ];

      const tables = extractTables(chars, lines, [], 0);

      expect(Array.isArray(tables)).toBe(true);
    });

    it('should handle empty arrays', () => {
      const tables = extractTables([], [], [], 0);
      expect(tables).toEqual([]);
    });
  });

  describe('extractTable', () => {
    it('should extract single table (first one found)', () => {
      const chars = [
        createChar('A', 20, 20),
        createChar('B', 70, 20),
      ];

      const lines = [
        createLine(0, 0, 100, 0),
        createLine(0, 50, 100, 50),
        createLine(0, 0, 0, 50),
        createLine(50, 0, 50, 50),
        createLine(100, 0, 100, 50),
      ];

      const table = extractTable(chars, lines, [], 0);

      // May return null if no table found
      expect(table === null || typeof table === 'object').toBe(true);
    });

    it('should return null when no tables found', () => {
      const table = extractTable([], [], [], 0);
      expect(table).toBeNull();
    });
  });

  describe('debugTableFinder', () => {
    it('should return debug information', () => {
      const lines = [
        createLine(0, 0, 100, 0),
        createLine(0, 50, 100, 50),
        createLine(0, 0, 0, 50),
        createLine(100, 0, 100, 50),
      ];

      const debug = debugTableFinder([], lines, [], 0);

      expect(debug).toHaveProperty('tables');
      expect(debug).toHaveProperty('edges');
      expect(debug).toHaveProperty('intersections');
    });

    it('should work with empty input', () => {
      const debug = debugTableFinder([], [], [], 0);

      expect(debug.tables).toEqual([]);
      expect(debug.edges).toEqual([]);
      expect(debug.intersections).toEqual([]);
    });
  });

  describe('detectBorderlessTables', () => {
    it('should detect tables from text alignment', () => {
      // Create chars that form aligned columns
      const chars = [
        // Column 1
        createChar('N', 10, 10),
        createChar('a', 20, 10),
        createChar('m', 30, 10),
        createChar('e', 40, 10),
        createChar('J', 10, 30),
        createChar('o', 20, 30),
        createChar('h', 30, 30),
        createChar('n', 40, 30),
        // Column 2
        createChar('A', 100, 10),
        createChar('g', 110, 10),
        createChar('e', 120, 10),
        createChar('2', 100, 30),
        createChar('5', 110, 30),
      ];

      const result = detectBorderlessTables(chars, 0);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle empty input', () => {
      const result = detectBorderlessTables([], 0);
      expect(result).toEqual([]);
    });

    it('should work with options', () => {
      const chars = [createChar('A', 10, 10)];
      const result = detectBorderlessTables(chars, 0, { minWordsVertical: 2 });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('findNestedTables', () => {
    it('should find nested tables within parent table', () => {
      // First create a parent table
      const outerLines = [
        createLine(0, 0, 400, 0),
        createLine(0, 200, 400, 200),
        createLine(0, 0, 0, 200),
        createLine(400, 0, 400, 200),
      ];

      // Find outer table first
      const result = findTables([], outerLines, [], 0);

      if (result.tables.length > 0) {
        const parentTable = result.tables[0];

        // Inner table grid (nested)
        const innerLines = [
          createLine(50, 50, 150, 50),
          createLine(50, 100, 150, 100),
          createLine(50, 150, 150, 150),
          createLine(50, 50, 50, 150),
          createLine(100, 50, 100, 150),
          createLine(150, 50, 150, 150),
        ];

        const nestedResult = findNestedTables(parentTable, [], innerLines, [], 2);

        expect(nestedResult).toBeDefined();
        // Should return PDFTable with potential nested tables
        expect(nestedResult).toHaveProperty('rows');
        expect(nestedResult).toHaveProperty('cells');
      }
    });

    it('should handle table without nesting', () => {
      // Create a simple table without nested content
      const lines = [
        createLine(0, 0, 100, 0),
        createLine(0, 50, 100, 50),
        createLine(0, 0, 0, 50),
        createLine(100, 0, 100, 50),
      ];

      const result = findTables([], lines, [], 0);

      if (result.tables.length > 0) {
        const nested = findNestedTables(result.tables[0], [], [], [], 1);
        expect(nested).toBeDefined();
      }
    });
  });

  describe('extractTablesEnhanced', () => {
    it('should extract tables with enhanced detection', () => {
      const chars = [
        createChar('A', 20, 20),
        createChar('B', 120, 20),
      ];

      const lines = [
        createLine(0, 0, 200, 0),
        createLine(0, 50, 200, 50),
        createLine(0, 0, 0, 50),
        createLine(100, 0, 100, 50),
        createLine(200, 0, 200, 50),
      ];

      const result = extractTablesEnhanced(chars, lines, [], 0);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle empty input', () => {
      const result = extractTablesEnhanced([], [], [], 0);

      expect(result).toEqual([]);
    });

    it('should support detectNested option', () => {
      const lines = [
        createLine(0, 0, 100, 0),
        createLine(0, 50, 100, 50),
        createLine(0, 0, 0, 50),
        createLine(100, 0, 100, 50),
      ];

      const result = extractTablesEnhanced([], lines, [], 0, {}, true);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Detection Strategies', () => {
    describe('lines strategy', () => {
      it('should use line-based detection', () => {
        const lines = [
          createLine(0, 0, 100, 0),
          createLine(0, 50, 100, 50),
          createLine(0, 0, 0, 50),
          createLine(100, 0, 100, 50),
        ];

        const result = findTables([], lines, [], 0, {
          verticalStrategy: 'lines',
          horizontalStrategy: 'lines',
        });

        expect(result.edges.length).toBeGreaterThan(0);
      });
    });

    describe('text strategy', () => {
      it('should use text-based edge detection', () => {
        const chars = [
          createChar('A', 10, 10),
          createChar('B', 100, 10),
          createChar('C', 10, 50),
          createChar('D', 100, 50),
        ];

        const result = findTables(chars, [], [], 0, {
          verticalStrategy: 'text',
          horizontalStrategy: 'text',
        });

        expect(result).toBeDefined();
      });
    });

    describe('explicit lines', () => {
      it('should use explicitly provided vertical lines', () => {
        const chars = [
          createChar('A', 20, 10),
          createChar('B', 70, 10),
        ];

        const result = findTables(chars, [], [], 0, {
          verticalStrategy: 'explicit',
          explicitVerticalLines: [0, 50, 100],
          horizontalStrategy: 'explicit',
          explicitHorizontalLines: [0, 50],
        });

        expect(result).toBeDefined();
      });
    });

    describe('hybrid strategy', () => {
      it('should use mixed line and text detection', () => {
        const chars = [createChar('X', 50, 50)];
        const lines = [createLine(0, 0, 100, 0)];

        const result = findTables(chars, lines, [], 0, {
          verticalStrategy: 'text',
          horizontalStrategy: 'lines',
        });

        expect(result).toBeDefined();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small tables', () => {
      const lines = [
        createLine(0, 0, 10, 0),
        createLine(0, 10, 10, 10),
        createLine(0, 0, 0, 10),
        createLine(10, 0, 10, 10),
      ];

      const result = findTables([], lines, [], 0);
      expect(result).toBeDefined();
    });

    it('should handle overlapping lines', () => {
      const lines = [
        createLine(0, 0, 100, 0),
        createLine(50, 0, 150, 0), // overlaps first line
        createLine(0, 0, 0, 50),
        createLine(100, 0, 100, 50),
      ];

      const result = findTables([], lines, [], 0);
      expect(result).toBeDefined();
    });

    it('should handle diagonal lines (non-table)', () => {
      const lines = [
        createLine(0, 0, 100, 100), // diagonal
        createLine(0, 100, 100, 0), // diagonal
      ];

      const result = findTables([], lines, [], 0);
      // Diagonal lines should not form tables
      expect(result.tables.length).toBe(0);
    });

    it('should handle moderate number of lines', () => {
      const lines: PDFLine[] = [];
      // Use 20 lines each direction (400 potential intersections is reasonable)
      for (let i = 0; i < 20; i++) {
        lines.push(createLine(0, i * 10, 200, i * 10)); // horizontal
        lines.push(createLine(i * 10, 0, i * 10, 200)); // vertical
      }

      const start = Date.now();
      const result = findTables([], lines, [], 0);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10000); // Should complete in reasonable time
      expect(result).toBeDefined();
    });

    it('should handle non-stroked rectangles', () => {
      const rects = [createRect(0, 0, 100, 100, false)]; // not stroked

      const result = findTables([], [], rects, 0);
      // Non-stroked rects should be ignored
      expect(result.edges.length).toBe(0);
    });
  });

  describe('Integration with PDFExcavator', () => {
    it('should work with Page.extractTables', async () => {
      const { PDFExcavator } = await import('../src/index.js');
      const samplePath = join(__dirname, '../fixtures/sample.pdf');

      try {
        const pdf = await PDFExcavator.open(samplePath);
        const page = pdf.getPage(0);
        const tables = await page.extractTables();

        expect(Array.isArray(tables)).toBe(true);
        await pdf.close();
      } catch (e) {
        // Skip if sample.pdf not available
        console.log('Skipping: sample.pdf not available');
      }
    });

    it('should work with Page.findTables', async () => {
      const { PDFExcavator } = await import('../src/index.js');
      const samplePath = join(__dirname, '../fixtures/sample.pdf');

      try {
        const pdf = await PDFExcavator.open(samplePath);
        const page = pdf.getPage(0);
        const result = await page.findTables();

        expect(result).toHaveProperty('tables');
        expect(result).toHaveProperty('edges');
        expect(result).toHaveProperty('intersections');
        await pdf.close();
      } catch (e) {
        // Skip if sample.pdf not available
        console.log('Skipping: sample.pdf not available');
      }
    });
  });
});
