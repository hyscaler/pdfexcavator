/**
 * BBox Utility Tests
 * Tests for bounding box operations: intersection, union, filtering, etc.
 */

import type { BBox } from '../src/types.js';

describe('BBox Utilities', () => {
  let normalizeBBox: typeof import('../src/utils/bbox.js').normalizeBBox;
  let isValidBBox: typeof import('../src/utils/bbox.js').isValidBBox;
  let pointInBBox: typeof import('../src/utils/bbox.js').pointInBBox;
  let bboxOverlaps: typeof import('../src/utils/bbox.js').bboxOverlaps;
  let bboxWithin: typeof import('../src/utils/bbox.js').bboxWithin;
  let bboxOutside: typeof import('../src/utils/bbox.js').bboxOutside;
  let bboxIntersection: typeof import('../src/utils/bbox.js').bboxIntersection;
  let bboxUnion: typeof import('../src/utils/bbox.js').bboxUnion;
  let getBBox: typeof import('../src/utils/bbox.js').getBBox;
  let bboxArea: typeof import('../src/utils/bbox.js').bboxArea;
  let bboxCenter: typeof import('../src/utils/bbox.js').bboxCenter;
  let bboxExpand: typeof import('../src/utils/bbox.js').bboxExpand;
  let filterWithinBBox: typeof import('../src/utils/bbox.js').filterWithinBBox;
  let filterOverlapsBBox: typeof import('../src/utils/bbox.js').filterOverlapsBBox;
  let filterOutsideBBox: typeof import('../src/utils/bbox.js').filterOutsideBBox;

  beforeAll(async () => {
    const module = await import('../src/utils/bbox.js');
    normalizeBBox = module.normalizeBBox;
    isValidBBox = module.isValidBBox;
    pointInBBox = module.pointInBBox;
    bboxOverlaps = module.bboxOverlaps;
    bboxWithin = module.bboxWithin;
    bboxOutside = module.bboxOutside;
    bboxIntersection = module.bboxIntersection;
    bboxUnion = module.bboxUnion;
    getBBox = module.getBBox;
    bboxArea = module.bboxArea;
    bboxCenter = module.bboxCenter;
    bboxExpand = module.bboxExpand;
    filterWithinBBox = module.filterWithinBBox;
    filterOverlapsBBox = module.filterOverlapsBBox;
    filterOutsideBBox = module.filterOutsideBBox;
  });

  describe('normalizeBBox', () => {
    it('should keep already normalized bbox unchanged', () => {
      const bbox: BBox = [10, 20, 100, 200];
      expect(normalizeBBox(bbox)).toEqual([10, 20, 100, 200]);
    });

    it('should swap x coordinates if x0 > x1', () => {
      const bbox: BBox = [100, 20, 10, 200];
      expect(normalizeBBox(bbox)).toEqual([10, 20, 100, 200]);
    });

    it('should swap y coordinates if y0 > y1', () => {
      const bbox: BBox = [10, 200, 100, 20];
      expect(normalizeBBox(bbox)).toEqual([10, 20, 100, 200]);
    });

    it('should swap both if needed', () => {
      const bbox: BBox = [100, 200, 10, 20];
      expect(normalizeBBox(bbox)).toEqual([10, 20, 100, 200]);
    });

    it('should handle negative coordinates', () => {
      const bbox: BBox = [-10, -20, -100, -200];
      expect(normalizeBBox(bbox)).toEqual([-100, -200, -10, -20]);
    });
  });

  describe('isValidBBox', () => {
    it('should return true for valid bbox with positive area', () => {
      expect(isValidBBox([0, 0, 100, 100])).toBe(true);
      expect(isValidBBox([10, 20, 50, 60])).toBe(true);
    });

    it('should return false for bbox with zero width', () => {
      expect(isValidBBox([10, 10, 10, 100])).toBe(false);
    });

    it('should return false for bbox with zero height', () => {
      expect(isValidBBox([10, 10, 100, 10])).toBe(false);
    });

    it('should return false for inverted bbox', () => {
      expect(isValidBBox([100, 100, 10, 10])).toBe(false);
    });

    it('should return false for zero-area bbox', () => {
      expect(isValidBBox([10, 10, 10, 10])).toBe(false);
    });
  });

  describe('pointInBBox', () => {
    const bbox: BBox = [10, 20, 100, 200];

    it('should return true for point inside', () => {
      expect(pointInBBox(50, 100, bbox)).toBe(true);
    });

    it('should return true for point on edge', () => {
      expect(pointInBBox(10, 100, bbox)).toBe(true); // left edge
      expect(pointInBBox(100, 100, bbox)).toBe(true); // right edge
      expect(pointInBBox(50, 20, bbox)).toBe(true); // top edge
      expect(pointInBBox(50, 200, bbox)).toBe(true); // bottom edge
    });

    it('should return true for point on corner', () => {
      expect(pointInBBox(10, 20, bbox)).toBe(true);
      expect(pointInBBox(100, 200, bbox)).toBe(true);
    });

    it('should return false for point outside', () => {
      expect(pointInBBox(5, 100, bbox)).toBe(false); // left
      expect(pointInBBox(105, 100, bbox)).toBe(false); // right
      expect(pointInBBox(50, 10, bbox)).toBe(false); // above
      expect(pointInBBox(50, 210, bbox)).toBe(false); // below
    });

    it('should work with inverted bbox (normalizes internally)', () => {
      const inverted: BBox = [100, 200, 10, 20];
      expect(pointInBBox(50, 100, inverted)).toBe(true);
    });
  });

  describe('bboxOverlaps', () => {
    it('should return true for overlapping boxes', () => {
      const a: BBox = [0, 0, 100, 100];
      const b: BBox = [50, 50, 150, 150];
      expect(bboxOverlaps(a, b)).toBe(true);
    });

    it('should return true for one box inside another', () => {
      const outer: BBox = [0, 0, 100, 100];
      const inner: BBox = [25, 25, 75, 75];
      expect(bboxOverlaps(outer, inner)).toBe(true);
      expect(bboxOverlaps(inner, outer)).toBe(true);
    });

    it('should return false for non-overlapping boxes', () => {
      const a: BBox = [0, 0, 50, 50];
      const b: BBox = [100, 100, 150, 150];
      expect(bboxOverlaps(a, b)).toBe(false);
    });

    it('should return false for boxes that touch at edge', () => {
      const a: BBox = [0, 0, 50, 50];
      const b: BBox = [50, 0, 100, 50]; // shares edge at x=50
      expect(bboxOverlaps(a, b)).toBe(false);
    });

    it('should return false for boxes that touch at corner', () => {
      const a: BBox = [0, 0, 50, 50];
      const b: BBox = [50, 50, 100, 100]; // shares corner at (50, 50)
      expect(bboxOverlaps(a, b)).toBe(false);
    });
  });

  describe('bboxWithin', () => {
    it('should return true when inner is completely within outer', () => {
      const inner: BBox = [25, 25, 75, 75];
      const outer: BBox = [0, 0, 100, 100];
      expect(bboxWithin(inner, outer)).toBe(true);
    });

    it('should return true when inner touches outer edge', () => {
      const inner: BBox = [0, 25, 75, 75];
      const outer: BBox = [0, 0, 100, 100];
      expect(bboxWithin(inner, outer)).toBe(true);
    });

    it('should return true when boxes are identical', () => {
      const bbox: BBox = [0, 0, 100, 100];
      expect(bboxWithin(bbox, bbox)).toBe(true);
    });

    it('should return false when inner extends outside', () => {
      const inner: BBox = [25, 25, 125, 75]; // extends beyond x=100
      const outer: BBox = [0, 0, 100, 100];
      expect(bboxWithin(inner, outer)).toBe(false);
    });

    it('should return false when inner is larger', () => {
      const inner: BBox = [0, 0, 100, 100];
      const outer: BBox = [25, 25, 75, 75];
      expect(bboxWithin(inner, outer)).toBe(false);
    });
  });

  describe('bboxOutside', () => {
    it('should return true for non-overlapping boxes', () => {
      const a: BBox = [0, 0, 50, 50];
      const b: BBox = [100, 100, 150, 150];
      expect(bboxOutside(a, b)).toBe(true);
    });

    it('should return false for overlapping boxes', () => {
      const a: BBox = [0, 0, 100, 100];
      const b: BBox = [50, 50, 150, 150];
      expect(bboxOutside(a, b)).toBe(false);
    });

    it('should return true for boxes that touch at edge', () => {
      const a: BBox = [0, 0, 50, 50];
      const b: BBox = [50, 0, 100, 50];
      expect(bboxOutside(a, b)).toBe(true);
    });
  });

  describe('bboxIntersection', () => {
    it('should return intersection area', () => {
      const a: BBox = [0, 0, 100, 100];
      const b: BBox = [50, 50, 150, 150];
      expect(bboxIntersection(a, b)).toEqual([50, 50, 100, 100]);
    });

    it('should return null for non-overlapping boxes', () => {
      const a: BBox = [0, 0, 50, 50];
      const b: BBox = [100, 100, 150, 150];
      expect(bboxIntersection(a, b)).toBeNull();
    });

    it('should return null for touching boxes', () => {
      const a: BBox = [0, 0, 50, 50];
      const b: BBox = [50, 0, 100, 50];
      expect(bboxIntersection(a, b)).toBeNull();
    });

    it('should return inner box when one is within another', () => {
      const outer: BBox = [0, 0, 100, 100];
      const inner: BBox = [25, 25, 75, 75];
      expect(bboxIntersection(outer, inner)).toEqual(inner);
      expect(bboxIntersection(inner, outer)).toEqual(inner);
    });
  });

  describe('bboxUnion', () => {
    it('should return union of two boxes', () => {
      const a: BBox = [0, 0, 50, 50];
      const b: BBox = [100, 100, 150, 150];
      expect(bboxUnion(a, b)).toEqual([0, 0, 150, 150]);
    });

    it('should return union of overlapping boxes', () => {
      const a: BBox = [0, 0, 100, 100];
      const b: BBox = [50, 50, 150, 150];
      expect(bboxUnion(a, b)).toEqual([0, 0, 150, 150]);
    });

    it('should return same box when identical', () => {
      const bbox: BBox = [10, 20, 30, 40];
      expect(bboxUnion(bbox, bbox)).toEqual(bbox);
    });

    it('should return outer box when one is contained', () => {
      const outer: BBox = [0, 0, 100, 100];
      const inner: BBox = [25, 25, 75, 75];
      expect(bboxUnion(outer, inner)).toEqual(outer);
    });
  });

  describe('getBBox', () => {
    it('should extract bbox from object', () => {
      const obj = { x0: 10, y0: 20, x1: 30, y1: 40, extra: 'ignored' };
      expect(getBBox(obj)).toEqual([10, 20, 30, 40]);
    });

    it('should work with minimal object', () => {
      const obj = { x0: 0, y0: 0, x1: 100, y1: 100 };
      expect(getBBox(obj)).toEqual([0, 0, 100, 100]);
    });
  });

  describe('bboxArea', () => {
    it('should calculate area correctly', () => {
      expect(bboxArea([0, 0, 10, 10])).toBe(100);
      expect(bboxArea([0, 0, 100, 50])).toBe(5000);
      expect(bboxArea([10, 20, 30, 40])).toBe(400); // 20 * 20
    });

    it('should return zero for zero-area bbox', () => {
      expect(bboxArea([10, 10, 10, 10])).toBe(0);
    });

    it('should handle negative area for inverted bbox', () => {
      expect(bboxArea([100, 100, 10, 10])).toBe(8100); // (10-100) * (10-100) = 90 * 90
    });
  });

  describe('bboxCenter', () => {
    it('should return center point', () => {
      expect(bboxCenter([0, 0, 100, 100])).toEqual({ x: 50, y: 50 });
      expect(bboxCenter([10, 20, 30, 40])).toEqual({ x: 20, y: 30 });
    });

    it('should handle non-integer centers', () => {
      const center = bboxCenter([0, 0, 11, 11]);
      expect(center).toEqual({ x: 5.5, y: 5.5 });
    });
  });

  describe('bboxExpand', () => {
    it('should expand bbox by margin', () => {
      const bbox: BBox = [10, 20, 30, 40];
      expect(bboxExpand(bbox, 5)).toEqual([5, 15, 35, 45]);
    });

    it('should handle zero margin', () => {
      const bbox: BBox = [10, 20, 30, 40];
      expect(bboxExpand(bbox, 0)).toEqual(bbox);
    });

    it('should handle negative margin (shrink)', () => {
      const bbox: BBox = [10, 20, 100, 200];
      expect(bboxExpand(bbox, -5)).toEqual([15, 25, 95, 195]);
    });
  });

  describe('filterWithinBBox', () => {
    const bbox: BBox = [0, 0, 100, 100];
    const objects = [
      { x0: 10, y0: 10, x1: 50, y1: 50 }, // inside
      { x0: 25, y0: 25, x1: 75, y1: 75 }, // inside
      { x0: 50, y0: 50, x1: 150, y1: 150 }, // overlapping
      { x0: 200, y0: 200, x1: 250, y1: 250 }, // outside
    ];

    it('should keep only objects completely within bbox', () => {
      const result = filterWithinBBox(objects, bbox);
      expect(result).toHaveLength(2);
    });

    it('should exclude overlapping objects', () => {
      const result = filterWithinBBox(objects, bbox);
      expect(result.every((obj) => obj.x1 <= 100 && obj.y1 <= 100)).toBe(true);
    });

    it('should handle empty array', () => {
      expect(filterWithinBBox([], bbox)).toEqual([]);
    });

    it('should handle objects touching bbox edge', () => {
      const edgeObjects = [
        { x0: 0, y0: 0, x1: 100, y1: 100 }, // exactly matching bbox
        { x0: 0, y0: 0, x1: 50, y1: 50 }, // within
      ];
      const result = filterWithinBBox(edgeObjects, bbox);
      expect(result).toHaveLength(2);
    });
  });

  describe('filterOverlapsBBox', () => {
    const bbox: BBox = [0, 0, 100, 100];
    const objects = [
      { x0: 10, y0: 10, x1: 50, y1: 50 }, // inside
      { x0: 50, y0: 50, x1: 150, y1: 150 }, // overlapping
      { x0: 200, y0: 200, x1: 250, y1: 250 }, // outside
    ];

    it('should keep objects that overlap with bbox', () => {
      const result = filterOverlapsBBox(objects, bbox);
      expect(result).toHaveLength(2);
    });

    it('should exclude completely outside objects', () => {
      const result = filterOverlapsBBox(objects, bbox);
      expect(result.every((obj) => obj.x0 < 100 || obj.y0 < 100)).toBe(true);
    });

    it('should handle empty array', () => {
      expect(filterOverlapsBBox([], bbox)).toEqual([]);
    });
  });

  describe('filterOutsideBBox', () => {
    const bbox: BBox = [0, 0, 100, 100];
    const objects = [
      { x0: 10, y0: 10, x1: 50, y1: 50 }, // inside
      { x0: 50, y0: 50, x1: 150, y1: 150 }, // overlapping
      { x0: 200, y0: 200, x1: 250, y1: 250 }, // outside
    ];

    it('should keep only objects completely outside bbox', () => {
      const result = filterOutsideBBox(objects, bbox);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ x0: 200, y0: 200, x1: 250, y1: 250 });
    });

    it('should exclude overlapping and inside objects', () => {
      const result = filterOutsideBBox(objects, bbox);
      expect(result.every((obj) => obj.x0 >= 100 || obj.x1 <= 0 || obj.y0 >= 100 || obj.y1 <= 0)).toBe(true);
    });

    it('should handle empty array', () => {
      expect(filterOutsideBBox([], bbox)).toEqual([]);
    });

    it('should include objects touching edge (not overlapping)', () => {
      const touchingObjects = [
        { x0: 100, y0: 0, x1: 150, y1: 50 }, // touching right edge
        { x0: 10, y0: 10, x1: 50, y1: 50 }, // inside
      ];
      const result = filterOutsideBBox(touchingObjects, bbox);
      expect(result).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('should handle zero-size bboxes', () => {
      const zeroBBox: BBox = [10, 10, 10, 10];
      expect(bboxArea(zeroBBox)).toBe(0);
      expect(isValidBBox(zeroBBox)).toBe(false);
      expect(bboxCenter(zeroBBox)).toEqual({ x: 10, y: 10 });
    });

    it('should handle negative coordinates', () => {
      const negBBox: BBox = [-100, -100, -50, -50];
      expect(bboxArea(negBBox)).toBe(2500);
      expect(bboxCenter(negBBox)).toEqual({ x: -75, y: -75 });
      expect(isValidBBox(negBBox)).toBe(true);
    });

    it('should handle very large coordinates', () => {
      const largeBBox: BBox = [0, 0, 1000000, 1000000];
      expect(bboxArea(largeBBox)).toBe(1000000000000);
      expect(bboxCenter(largeBBox)).toEqual({ x: 500000, y: 500000 });
    });

    it('should handle floating point coordinates', () => {
      const floatBBox: BBox = [10.5, 20.5, 30.5, 40.5];
      expect(bboxArea(floatBBox)).toBe(400); // 20 * 20
      expect(bboxCenter(floatBBox)).toEqual({ x: 20.5, y: 30.5 });
    });
  });
});
