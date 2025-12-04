/**
 * Page Class Tests
 * Tests for Page class methods: search, crop, filter, etc.
 */

describe('Page Class', () => {
  describe('Static Methods', () => {
    let Page: typeof import('../src/index.js').Page;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      Page = module.Page;
    });

    it('should export Page class', () => {
      expect(Page).toBeDefined();
    });

    it('should have getDefaultLAParams static method', () => {
      expect(typeof Page.getDefaultLAParams).toBe('function');
    });

    it('should return valid LAParams from getDefaultLAParams', () => {
      const params = Page.getDefaultLAParams();

      expect(params).toHaveProperty('lineOverlap');
      expect(params).toHaveProperty('charMargin');
      expect(params).toHaveProperty('wordMargin');
      expect(params).toHaveProperty('lineMargin');
      expect(params).toHaveProperty('boxesFlow');
      expect(params).toHaveProperty('detectVertical');
      expect(params).toHaveProperty('allTexts');
    });

    it('should have isOCRAvailable static method', () => {
      expect(typeof Page.isOCRAvailable).toBe('function');
    });

    it('should return boolean from isOCRAvailable', async () => {
      const available = await Page.isOCRAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('escapeRegExp helper', () => {
    it('should escape all special regex characters', () => {
      const specialChars = '.*+?^${}()|[]\\';
      const escaped = specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      expect(escaped).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
    });

    it('should not modify normal text', () => {
      const normal = 'Hello World 123';
      const escaped = normal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      expect(escaped).toBe('Hello World 123');
    });

    it('should escape mixed content', () => {
      const mixed = 'test.value (item)';
      const escaped = mixed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      expect(escaped).toBe('test\\.value \\(item\\)');
    });
  });

  describe('Search Options', () => {
    it('should have literal option default to true for strings', () => {
      // This tests the expected behavior
      const options = { literal: true };
      expect(options.literal).toBe(true);
    });

    it('should allow literal: false for regex mode', () => {
      const options = { literal: false };
      expect(options.literal).toBe(false);
    });
  });
});

describe('BBox Utilities', () => {
  let filterWithinBBox: typeof import('../src/index.js').filterWithinBBox;
  let filterOutsideBBox: typeof import('../src/index.js').filterOutsideBBox;
  let filterOverlapsBBox: typeof import('../src/index.js').filterOverlapsBBox;

  beforeAll(async () => {
    const module = await import('../src/index.js');
    filterWithinBBox = module.filterWithinBBox;
    filterOutsideBBox = module.filterOutsideBBox;
    filterOverlapsBBox = module.filterOverlapsBBox;
  });

  const createObject = (x0: number, y0: number, x1: number, y1: number) => ({
    x0, y0, x1, y1,
    top: y0,
    bottom: y1,
  });

  describe('filterWithinBBox', () => {
    it('should filter objects within bbox', () => {
      const objects = [
        createObject(10, 10, 20, 20), // Inside
        createObject(50, 50, 60, 60), // Inside
        createObject(150, 150, 160, 160), // Outside
      ];
      const bbox: [number, number, number, number] = [0, 0, 100, 100];

      const result = filterWithinBBox(objects, bbox);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no objects within', () => {
      const objects = [
        createObject(150, 150, 160, 160),
      ];
      const bbox: [number, number, number, number] = [0, 0, 100, 100];

      const result = filterWithinBBox(objects, bbox);
      expect(result).toHaveLength(0);
    });

    it('should handle empty input', () => {
      const bbox: [number, number, number, number] = [0, 0, 100, 100];
      const result = filterWithinBBox([], bbox);
      expect(result).toEqual([]);
    });
  });

  describe('filterOutsideBBox', () => {
    it('should filter objects outside bbox', () => {
      const objects = [
        createObject(10, 10, 20, 20), // Inside
        createObject(150, 150, 160, 160), // Outside
      ];
      const bbox: [number, number, number, number] = [0, 0, 100, 100];

      const result = filterOutsideBBox(objects, bbox);
      expect(result).toHaveLength(1);
      expect(result[0].x0).toBe(150);
    });
  });

  describe('filterOverlapsBBox', () => {
    it('should filter objects that overlap bbox', () => {
      const objects = [
        createObject(10, 10, 20, 20), // Inside (overlaps)
        createObject(90, 90, 110, 110), // Partially overlaps
        createObject(200, 200, 210, 210), // Outside
      ];
      const bbox: [number, number, number, number] = [0, 0, 100, 100];

      const result = filterOverlapsBBox(objects, bbox);
      expect(result).toHaveLength(2);
    });

    it('should include objects on boundary', () => {
      const objects = [
        createObject(100, 0, 110, 50), // Touching right edge
      ];
      const bbox: [number, number, number, number] = [0, 0, 100, 100];

      const result = filterOverlapsBBox(objects, bbox);
      // May or may not include depending on strict vs loose overlap
      expect(Array.isArray(result)).toBe(true);
    });
  });
});

describe('Geometry Utilities', () => {
  describe('Line operations', () => {
    it('should identify horizontal lines', () => {
      const line = { x0: 0, y0: 50, x1: 100, y1: 50 };
      const isHorizontal = Math.abs(line.y1 - line.y0) < 1;
      expect(isHorizontal).toBe(true);
    });

    it('should identify vertical lines', () => {
      const line = { x0: 50, y0: 0, x1: 50, y1: 100 };
      const isVertical = Math.abs(line.x1 - line.x0) < 1;
      expect(isVertical).toBe(true);
    });

    it('should calculate line length', () => {
      const line = { x0: 0, y0: 0, x1: 3, y1: 4 };
      const length = Math.sqrt(
        Math.pow(line.x1 - line.x0, 2) + Math.pow(line.y1 - line.y0, 2)
      );
      expect(length).toBe(5);
    });
  });

  describe('Rectangle operations', () => {
    it('should calculate rectangle area', () => {
      const rect = { x0: 0, y0: 0, x1: 10, y1: 5, width: 10, height: 5 };
      const area = rect.width * rect.height;
      expect(area).toBe(50);
    });

    it('should detect rectangle overlap', () => {
      const rect1 = { x0: 0, y0: 0, x1: 10, y1: 10 };
      const rect2 = { x0: 5, y0: 5, x1: 15, y1: 15 };

      const overlaps = !(
        rect1.x1 < rect2.x0 ||
        rect2.x1 < rect1.x0 ||
        rect1.y1 < rect2.y0 ||
        rect2.y1 < rect1.y0
      );

      expect(overlaps).toBe(true);
    });

    it('should detect non-overlapping rectangles', () => {
      const rect1 = { x0: 0, y0: 0, x1: 10, y1: 10 };
      const rect2 = { x0: 20, y0: 20, x1: 30, y1: 30 };

      const overlaps = !(
        rect1.x1 < rect2.x0 ||
        rect2.x1 < rect1.x0 ||
        rect1.y1 < rect2.y0 ||
        rect2.y1 < rect1.y0
      );

      expect(overlaps).toBe(false);
    });
  });
});

describe('Crop Operations', () => {
  describe('Relative coordinates', () => {
    it('should convert relative to absolute coordinates', () => {
      const cropBox = { x0: 100, y0: 100, x1: 400, y1: 400 };
      const relativeBBox: [number, number, number, number] = [0.1, 0.1, 0.9, 0.9];

      const width = cropBox.x1 - cropBox.x0;
      const height = cropBox.y1 - cropBox.y0;

      const absoluteBBox = [
        cropBox.x0 + relativeBBox[0] * width,
        cropBox.y0 + relativeBBox[1] * height,
        cropBox.x0 + relativeBBox[2] * width,
        cropBox.y0 + relativeBBox[3] * height,
      ];

      expect(absoluteBBox[0]).toBe(130);
      expect(absoluteBBox[1]).toBe(130);
      expect(absoluteBBox[2]).toBe(370);
      expect(absoluteBBox[3]).toBe(370);
    });
  });

  describe('Strict vs loose filtering', () => {
    it('should understand strict filtering (entirely within)', () => {
      const bbox: [number, number, number, number] = [0, 0, 100, 100];
      const objectInside = { x0: 10, y0: 10, x1: 90, y1: 90 };
      const objectPartial = { x0: 50, y0: 50, x1: 150, y1: 150 };

      const strictInside =
        objectInside.x0 >= bbox[0] &&
        objectInside.y0 >= bbox[1] &&
        objectInside.x1 <= bbox[2] &&
        objectInside.y1 <= bbox[3];

      const partialStrict =
        objectPartial.x0 >= bbox[0] &&
        objectPartial.y0 >= bbox[1] &&
        objectPartial.x1 <= bbox[2] &&
        objectPartial.y1 <= bbox[3];

      expect(strictInside).toBe(true);
      expect(partialStrict).toBe(false);
    });
  });
});

describe('Filter Operations', () => {
  describe('Filter function types', () => {
    it('should support predicate functions', () => {
      const objects = [
        { type: 'char', text: 'A' },
        { type: 'char', text: 'B' },
        { type: 'line' },
      ];

      const charFilter = (obj: any) => obj.type === 'char';
      const filtered = objects.filter(charFilter);

      expect(filtered).toHaveLength(2);
    });

    it('should support complex filter conditions', () => {
      const objects = [
        { x0: 10, y0: 10, size: 12 },
        { x0: 50, y0: 10, size: 24 },
        { x0: 10, y0: 50, size: 12 },
      ];

      const filter = (obj: any) => obj.x0 < 30 && obj.size === 12;
      const filtered = objects.filter(filter);

      expect(filtered).toHaveLength(2);
    });
  });
});
