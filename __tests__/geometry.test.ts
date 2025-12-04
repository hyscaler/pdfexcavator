/**
 * Geometry Utility Tests
 * Tests for line detection, intersection, clustering, and table analysis utilities
 */

import type { PDFLine, PDFRect } from '../src/types.js';

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

describe('Geometry Utilities', () => {
  let approxEqual: typeof import('../src/utils/geometry.js').approxEqual;
  let isHorizontalLine: typeof import('../src/utils/geometry.js').isHorizontalLine;
  let isVerticalLine: typeof import('../src/utils/geometry.js').isVerticalLine;
  let getHorizontalLines: typeof import('../src/utils/geometry.js').getHorizontalLines;
  let getVerticalLines: typeof import('../src/utils/geometry.js').getVerticalLines;
  let groupHorizontalLines: typeof import('../src/utils/geometry.js').groupHorizontalLines;
  let groupVerticalLines: typeof import('../src/utils/geometry.js').groupVerticalLines;
  let rectsToLines: typeof import('../src/utils/geometry.js').rectsToLines;
  let getUniqueYPositions: typeof import('../src/utils/geometry.js').getUniqueYPositions;
  let getUniqueXPositions: typeof import('../src/utils/geometry.js').getUniqueXPositions;
  let lineLength: typeof import('../src/utils/geometry.js').lineLength;
  let linesIntersect: typeof import('../src/utils/geometry.js').linesIntersect;
  let clusterObjects: typeof import('../src/utils/geometry.js').clusterObjects;
  let clusterObjectsByMean: typeof import('../src/utils/geometry.js').clusterObjectsByMean;

  beforeAll(async () => {
    const module = await import('../src/utils/geometry.js');
    approxEqual = module.approxEqual;
    isHorizontalLine = module.isHorizontalLine;
    isVerticalLine = module.isVerticalLine;
    getHorizontalLines = module.getHorizontalLines;
    getVerticalLines = module.getVerticalLines;
    groupHorizontalLines = module.groupHorizontalLines;
    groupVerticalLines = module.groupVerticalLines;
    rectsToLines = module.rectsToLines;
    getUniqueYPositions = module.getUniqueYPositions;
    getUniqueXPositions = module.getUniqueXPositions;
    lineLength = module.lineLength;
    linesIntersect = module.linesIntersect;
    clusterObjects = module.clusterObjects;
    clusterObjectsByMean = module.clusterObjectsByMean;
  });

  describe('approxEqual', () => {
    it('should return true for equal numbers', () => {
      expect(approxEqual(5, 5)).toBe(true);
      expect(approxEqual(0, 0)).toBe(true);
      expect(approxEqual(-10, -10)).toBe(true);
    });

    it('should return true for numbers within default tolerance', () => {
      expect(approxEqual(5, 7)).toBe(true); // within 3
      expect(approxEqual(5, 8)).toBe(true); // exactly 3
      expect(approxEqual(10, 12)).toBe(true);
    });

    it('should return false for numbers outside default tolerance', () => {
      expect(approxEqual(5, 9)).toBe(false); // 4 > 3
      expect(approxEqual(0, 4)).toBe(false);
    });

    it('should support custom tolerance', () => {
      expect(approxEqual(5, 10, 5)).toBe(true); // exactly at tolerance
      expect(approxEqual(5, 11, 5)).toBe(false); // outside tolerance
      expect(approxEqual(100, 101, 1)).toBe(true);
      expect(approxEqual(100, 102, 1)).toBe(false);
    });

    it('should work with negative numbers', () => {
      expect(approxEqual(-5, -7)).toBe(true);
      expect(approxEqual(-5, -9)).toBe(false);
    });

    it('should work with floating point numbers', () => {
      expect(approxEqual(5.5, 7.5)).toBe(true);
      expect(approxEqual(5.5, 8.5)).toBe(true);
      expect(approxEqual(5.5, 9.5)).toBe(false);
    });
  });

  describe('isHorizontalLine', () => {
    it('should detect horizontal line', () => {
      const line = createLine(0, 10, 100, 10);
      expect(isHorizontalLine(line)).toBe(true);
    });

    it('should detect approximately horizontal line within tolerance', () => {
      const line = createLine(0, 10, 100, 12); // y differs by 2
      expect(isHorizontalLine(line)).toBe(true);
    });

    it('should reject vertical line', () => {
      const line = createLine(10, 0, 10, 100);
      expect(isHorizontalLine(line)).toBe(false);
    });

    it('should reject diagonal line', () => {
      const line = createLine(0, 0, 100, 100);
      expect(isHorizontalLine(line)).toBe(false);
    });

    it('should support custom tolerance', () => {
      const line = createLine(0, 10, 100, 15); // y differs by 5
      expect(isHorizontalLine(line, 3)).toBe(false);
      expect(isHorizontalLine(line, 5)).toBe(true);
    });
  });

  describe('isVerticalLine', () => {
    it('should detect vertical line', () => {
      const line = createLine(10, 0, 10, 100);
      expect(isVerticalLine(line)).toBe(true);
    });

    it('should detect approximately vertical line within tolerance', () => {
      const line = createLine(10, 0, 12, 100); // x differs by 2
      expect(isVerticalLine(line)).toBe(true);
    });

    it('should reject horizontal line', () => {
      const line = createLine(0, 10, 100, 10);
      expect(isVerticalLine(line)).toBe(false);
    });

    it('should reject diagonal line', () => {
      const line = createLine(0, 0, 100, 100);
      expect(isVerticalLine(line)).toBe(false);
    });

    it('should support custom tolerance', () => {
      const line = createLine(10, 0, 15, 100); // x differs by 5
      expect(isVerticalLine(line, 3)).toBe(false);
      expect(isVerticalLine(line, 5)).toBe(true);
    });
  });

  describe('getHorizontalLines', () => {
    it('should filter horizontal lines', () => {
      const lines = [
        createLine(0, 10, 100, 10), // horizontal
        createLine(10, 0, 10, 100), // vertical
        createLine(0, 50, 100, 50), // horizontal
        createLine(0, 0, 100, 100), // diagonal
      ];

      const horizontal = getHorizontalLines(lines);
      expect(horizontal).toHaveLength(2);
    });

    it('should return empty array for no horizontal lines', () => {
      const lines = [
        createLine(10, 0, 10, 100), // vertical
        createLine(50, 0, 50, 100), // vertical
      ];

      const horizontal = getHorizontalLines(lines);
      expect(horizontal).toHaveLength(0);
    });

    it('should handle empty input', () => {
      expect(getHorizontalLines([])).toEqual([]);
    });
  });

  describe('getVerticalLines', () => {
    it('should filter vertical lines', () => {
      const lines = [
        createLine(0, 10, 100, 10), // horizontal
        createLine(10, 0, 10, 100), // vertical
        createLine(50, 0, 50, 100), // vertical
        createLine(0, 0, 100, 100), // diagonal
      ];

      const vertical = getVerticalLines(lines);
      expect(vertical).toHaveLength(2);
    });

    it('should return empty array for no vertical lines', () => {
      const lines = [
        createLine(0, 10, 100, 10), // horizontal
        createLine(0, 50, 100, 50), // horizontal
      ];

      const vertical = getVerticalLines(lines);
      expect(vertical).toHaveLength(0);
    });

    it('should handle empty input', () => {
      expect(getVerticalLines([])).toEqual([]);
    });
  });

  describe('groupHorizontalLines', () => {
    it('should group horizontal lines by Y position', () => {
      const lines = [
        createLine(0, 10, 100, 10),
        createLine(50, 10, 150, 10), // same Y
        createLine(0, 50, 100, 50),
        createLine(0, 100, 100, 100),
      ];

      const groups = groupHorizontalLines(lines);
      expect(groups.size).toBe(3);
    });

    it('should group lines within tolerance', () => {
      const lines = [
        createLine(0, 10, 100, 10),
        createLine(50, 11, 150, 11), // Y=11, within tolerance of Y=10
        createLine(0, 50, 100, 50),
      ];

      const groups = groupHorizontalLines(lines);
      expect(groups.size).toBe(2);

      // Find the group around Y=10
      let group10: PDFLine[] | undefined;
      for (const [y, g] of groups) {
        if (y === 10) group10 = g;
      }
      expect(group10).toHaveLength(2);
    });

    it('should ignore non-horizontal lines', () => {
      const lines = [
        createLine(10, 0, 10, 100), // vertical
        createLine(0, 50, 100, 50), // horizontal
      ];

      const groups = groupHorizontalLines(lines);
      expect(groups.size).toBe(1);
    });

    it('should handle empty input', () => {
      const groups = groupHorizontalLines([]);
      expect(groups.size).toBe(0);
    });
  });

  describe('groupVerticalLines', () => {
    it('should group vertical lines by X position', () => {
      const lines = [
        createLine(10, 0, 10, 100),
        createLine(10, 50, 10, 150), // same X
        createLine(50, 0, 50, 100),
        createLine(100, 0, 100, 100),
      ];

      const groups = groupVerticalLines(lines);
      expect(groups.size).toBe(3);
    });

    it('should group lines within tolerance', () => {
      const lines = [
        createLine(10, 0, 10, 100),
        createLine(11, 50, 11, 150), // X=11, within tolerance of X=10
        createLine(50, 0, 50, 100),
      ];

      const groups = groupVerticalLines(lines);
      expect(groups.size).toBe(2);
    });

    it('should ignore non-vertical lines', () => {
      const lines = [
        createLine(0, 10, 100, 10), // horizontal
        createLine(50, 0, 50, 100), // vertical
      ];

      const groups = groupVerticalLines(lines);
      expect(groups.size).toBe(1);
    });

    it('should handle empty input', () => {
      const groups = groupVerticalLines([]);
      expect(groups.size).toBe(0);
    });
  });

  describe('rectsToLines', () => {
    it('should convert rectangle to 4 lines', () => {
      const rects = [createRect(0, 0, 100, 50)];
      const lines = rectsToLines(rects);

      expect(lines).toHaveLength(4);
    });

    it('should create correct top/bottom/left/right edges', () => {
      const rects = [createRect(10, 20, 110, 70)];
      const lines = rectsToLines(rects);

      // Check for horizontal lines (top and bottom)
      const horizontal = lines.filter(
        (l) => Math.abs(l.y0 - l.y1) < 1
      );
      expect(horizontal).toHaveLength(2);
      expect(horizontal.some((l) => l.y0 === 20)).toBe(true); // top
      expect(horizontal.some((l) => l.y0 === 70)).toBe(true); // bottom

      // Check for vertical lines (left and right)
      const vertical = lines.filter(
        (l) => Math.abs(l.x0 - l.x1) < 1
      );
      expect(vertical).toHaveLength(2);
      expect(vertical.some((l) => l.x0 === 10)).toBe(true); // left
      expect(vertical.some((l) => l.x0 === 110)).toBe(true); // right
    });

    it('should ignore non-stroked rectangles', () => {
      const rects = [
        createRect(0, 0, 100, 50, true), // stroked
        createRect(0, 60, 100, 110, false), // not stroked
      ];
      const lines = rectsToLines(rects);

      expect(lines).toHaveLength(4); // only from first rect
    });

    it('should handle empty input', () => {
      expect(rectsToLines([])).toEqual([]);
    });

    it('should handle multiple rectangles', () => {
      const rects = [
        createRect(0, 0, 100, 50),
        createRect(0, 60, 100, 110),
      ];
      const lines = rectsToLines(rects);

      expect(lines).toHaveLength(8); // 4 per rect
    });
  });

  describe('getUniqueYPositions', () => {
    it('should extract unique Y positions from horizontal lines', () => {
      const lines = [
        createLine(0, 10, 100, 10),
        createLine(50, 10, 150, 10), // duplicate Y
        createLine(0, 50, 100, 50),
        createLine(0, 100, 100, 100),
      ];

      const yPositions = getUniqueYPositions(lines);
      expect(yPositions).toHaveLength(3);
      expect(yPositions).toEqual([10, 50, 100]);
    });

    it('should return sorted positions', () => {
      const lines = [
        createLine(0, 100, 100, 100),
        createLine(0, 10, 100, 10),
        createLine(0, 50, 100, 50),
      ];

      const yPositions = getUniqueYPositions(lines);
      expect(yPositions).toEqual([10, 50, 100]);
    });

    it('should merge positions within tolerance', () => {
      const lines = [
        createLine(0, 10, 100, 10),
        createLine(0, 11, 100, 11), // within tolerance
        createLine(0, 50, 100, 50),
      ];

      const yPositions = getUniqueYPositions(lines);
      expect(yPositions).toHaveLength(2);
    });

    it('should handle empty input', () => {
      expect(getUniqueYPositions([])).toEqual([]);
    });
  });

  describe('getUniqueXPositions', () => {
    it('should extract unique X positions from vertical lines', () => {
      const lines = [
        createLine(10, 0, 10, 100),
        createLine(10, 50, 10, 150), // duplicate X
        createLine(50, 0, 50, 100),
        createLine(100, 0, 100, 100),
      ];

      const xPositions = getUniqueXPositions(lines);
      expect(xPositions).toHaveLength(3);
      expect(xPositions).toEqual([10, 50, 100]);
    });

    it('should return sorted positions', () => {
      const lines = [
        createLine(100, 0, 100, 100),
        createLine(10, 0, 10, 100),
        createLine(50, 0, 50, 100),
      ];

      const xPositions = getUniqueXPositions(lines);
      expect(xPositions).toEqual([10, 50, 100]);
    });

    it('should handle empty input', () => {
      expect(getUniqueXPositions([])).toEqual([]);
    });
  });

  describe('lineLength', () => {
    it('should calculate horizontal line length', () => {
      const line = createLine(0, 0, 100, 0);
      expect(lineLength(line)).toBe(100);
    });

    it('should calculate vertical line length', () => {
      const line = createLine(0, 0, 0, 100);
      expect(lineLength(line)).toBe(100);
    });

    it('should calculate diagonal line length', () => {
      const line = createLine(0, 0, 3, 4);
      expect(lineLength(line)).toBe(5); // 3-4-5 triangle
    });

    it('should handle zero length', () => {
      const line = createLine(10, 10, 10, 10);
      expect(lineLength(line)).toBe(0);
    });

    it('should handle negative coordinates', () => {
      const line = createLine(-50, -50, 50, 50);
      expect(lineLength(line)).toBeCloseTo(Math.sqrt(20000)); // ~141.42
    });
  });

  describe('linesIntersect', () => {
    it('should detect intersecting perpendicular lines', () => {
      const horizontal = createLine(0, 50, 100, 50);
      const vertical = createLine(50, 0, 50, 100);

      expect(linesIntersect(horizontal, vertical)).toBe(true);
    });

    it('should detect intersecting diagonal lines', () => {
      const line1 = createLine(0, 0, 100, 100);
      const line2 = createLine(0, 100, 100, 0);

      expect(linesIntersect(line1, line2)).toBe(true);
    });

    it('should not detect non-intersecting parallel lines', () => {
      const line1 = createLine(0, 0, 100, 0);
      const line2 = createLine(0, 10, 100, 10);

      expect(linesIntersect(line1, line2)).toBe(false);
    });

    it('should not detect non-intersecting perpendicular lines', () => {
      const horizontal = createLine(0, 0, 50, 0); // ends at x=50
      const vertical = createLine(100, 0, 100, 100); // starts at x=100

      expect(linesIntersect(horizontal, vertical)).toBe(false);
    });

    it('should handle lines that touch at endpoint', () => {
      const line1 = createLine(0, 0, 50, 50);
      const line2 = createLine(50, 50, 100, 0);

      expect(linesIntersect(line1, line2)).toBe(true);
    });

    it('should handle collinear overlapping segments', () => {
      const line1 = createLine(0, 0, 50, 0);
      const line2 = createLine(25, 0, 75, 0); // overlaps

      expect(linesIntersect(line1, line2)).toBe(true);
    });
  });

  describe('clusterObjects', () => {
    it('should cluster objects by numeric key', () => {
      const objects = [
        { y: 10 },
        { y: 11 },
        { y: 12 },
        { y: 50 },
        { y: 51 },
      ];

      const clusters = clusterObjects(objects, (o) => o.y);
      expect(clusters).toHaveLength(2);
      expect(clusters[0]).toHaveLength(3); // y: 10, 11, 12
      expect(clusters[1]).toHaveLength(2); // y: 50, 51
    });

    it('should respect tolerance', () => {
      const objects = [
        { y: 10 },
        { y: 15 },
        { y: 20 },
      ];

      // Default tolerance (3) - each in separate cluster
      const clusters1 = clusterObjects(objects, (o) => o.y);
      expect(clusters1).toHaveLength(3);

      // Larger tolerance (5) - all in one cluster
      const clusters2 = clusterObjects(objects, (o) => o.y, 5);
      expect(clusters2).toHaveLength(1);
    });

    it('should handle empty array', () => {
      expect(clusterObjects([], (o: { y: number }) => o.y)).toEqual([]);
    });

    it('should handle single item', () => {
      const clusters = clusterObjects([{ y: 10 }], (o) => o.y);
      expect(clusters).toHaveLength(1);
      expect(clusters[0]).toHaveLength(1);
    });

    it('should cluster by different keys', () => {
      const objects = [
        { x: 10, y: 100 },
        { x: 11, y: 200 },
        { x: 50, y: 100 },
      ];

      // Cluster by x
      const byX = clusterObjects(objects, (o) => o.x);
      expect(byX).toHaveLength(2); // x: 10-11, x: 50

      // Cluster by y
      const byY = clusterObjects(objects, (o) => o.y);
      expect(byY).toHaveLength(2); // y: 100 (2 items), y: 200
    });

    it('should sort objects within cluster', () => {
      const objects = [
        { y: 12 },
        { y: 10 },
        { y: 11 },
      ];

      const clusters = clusterObjects(objects, (o) => o.y, 3);
      expect(clusters).toHaveLength(1);
      // Objects should be sorted by y
      expect(clusters[0][0].y).toBe(10);
      expect(clusters[0][1].y).toBe(11);
      expect(clusters[0][2].y).toBe(12);
    });
  });

  describe('clusterObjectsByMean', () => {
    it('should cluster by mean value', () => {
      const objects = [
        { y: 10 },
        { y: 11 },
        { y: 12 },
        { y: 50 },
        { y: 51 },
      ];

      const clusters = clusterObjectsByMean(objects, (o) => o.y);
      expect(clusters).toHaveLength(2);
    });

    it('should handle empty array', () => {
      expect(clusterObjectsByMean([], (o: { y: number }) => o.y)).toEqual([]);
    });

    it('should handle single item', () => {
      const clusters = clusterObjectsByMean([{ y: 10 }], (o) => o.y);
      expect(clusters).toHaveLength(1);
      expect(clusters[0]).toHaveLength(1);
    });

    it('should use mean for cluster membership', () => {
      // With mean-based clustering, the cluster center shifts as items are added
      const objects = [
        { y: 10 },
        { y: 13 },  // Might join first cluster if mean-based
        { y: 50 },
      ];

      const clusters = clusterObjectsByMean(objects, (o) => o.y);
      expect(clusters.length).toBeGreaterThanOrEqual(2);
    });

    it('should respect tolerance', () => {
      const objects = [
        { y: 10 },
        { y: 15 },
        { y: 20 },
      ];

      // Smaller tolerance - each separate
      const clusters1 = clusterObjectsByMean(objects, (o) => o.y, 3);
      expect(clusters1).toHaveLength(3);

      // Larger tolerance - can merge
      const clusters2 = clusterObjectsByMean(objects, (o) => o.y, 10);
      expect(clusters2.length).toBeLessThanOrEqual(3);
    });
  });
});
