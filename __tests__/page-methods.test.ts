/**
 * Page Methods Tests
 * Tests for Page search, crop, filter, withinBBox, outsideBBox methods
 */

import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Page Methods', () => {
  let PDFExcavator: typeof import('../src/index.js').PDFExcavator;
  let samplePdfPath: string;

  beforeAll(async () => {
    const module = await import('../src/index.js');
    PDFExcavator = module.PDFExcavator;
    samplePdfPath = join(__dirname, '../fixtures/sample.pdf');
  });

  describe('search', () => {
    it('should find literal text matches', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        const results = await page.search('the');

        expect(Array.isArray(results)).toBe(true);
        // Each result should have required properties
        for (const result of results) {
          expect(result).toHaveProperty('text');
          expect(result).toHaveProperty('x0');
          expect(result).toHaveProperty('y0');
          expect(result).toHaveProperty('x1');
          expect(result).toHaveProperty('y1');
          expect(result).toHaveProperty('chars');
          expect(Array.isArray(result.chars)).toBe(true);
        }
      } finally {
        await pdf.close();
      }
    });

    it('should be case insensitive by default', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        const lowerResults = await page.search('pdf');
        const upperResults = await page.search('PDF');

        // Both should find results (if text exists)
        expect(Array.isArray(lowerResults)).toBe(true);
        expect(Array.isArray(upperResults)).toBe(true);
      } finally {
        await pdf.close();
      }
    });

    it('should escape special regex characters by default', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        // This would be a dangerous pattern if not escaped
        const results = await page.search('(a+)+$');

        // Should not hang, should complete quickly
        expect(Array.isArray(results)).toBe(true);
      } finally {
        await pdf.close();
      }
    });

    it('should allow regex patterns with literal: false', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        // Search for words starting with capital letter
        const results = await page.search('[A-Z]\\w+', { literal: false });

        expect(Array.isArray(results)).toBe(true);
      } finally {
        await pdf.close();
      }
    });

    it('should accept RegExp object directly', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        const results = await page.search(/\d+/g);

        expect(Array.isArray(results)).toBe(true);
      } finally {
        await pdf.close();
      }
    });

    it('should return empty array for non-matching search', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        const results = await page.search('xyznonexistenttext123');

        expect(results).toEqual([]);
      } finally {
        await pdf.close();
      }
    });

    it('should return results with valid bounding boxes', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        const results = await page.search('.');

        for (const result of results) {
          expect(result.x1).toBeGreaterThanOrEqual(result.x0);
          expect(result.y1).toBeGreaterThanOrEqual(result.y0);
        }
      } finally {
        await pdf.close();
      }
    });
  });

  describe('crop', () => {
    it('should return a new Page instance', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        const cropped = page.crop([0, 0, 300, 400]);

        expect(cropped).toBeDefined();
        expect(cropped.pageNumber).toBe(page.pageNumber);
      } finally {
        await pdf.close();
      }
    });

    it('should limit chars to cropped region', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        const fullChars = await page.getChars();

        // Crop to small region
        const cropped = page.crop([0, 0, 100, 100]);
        const croppedChars = await cropped.getChars();

        // Cropped should have fewer or equal chars
        expect(croppedChars.length).toBeLessThanOrEqual(fullChars.length);

        // All cropped chars should be within the crop bbox (with some tolerance)
        for (const char of croppedChars) {
          expect(char.x0).toBeLessThanOrEqual(100 + 1);
          expect(char.y0).toBeLessThanOrEqual(100 + 1);
        }
      } finally {
        await pdf.close();
      }
    });

    it('should support relative coordinates', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);

        // First crop to a region
        const firstCrop = page.crop([100, 100, 400, 400]);

        // Then crop relative to that region
        const secondCrop = firstCrop.crop([0, 0, 100, 100], { relative: true });

        // The second crop should be relative to the first crop's box
        const bbox = secondCrop.bbox;
        expect(bbox[0]).toBe(100); // x0 = 100 + 0
        expect(bbox[1]).toBe(100); // y0 = 100 + 0
      } finally {
        await pdf.close();
      }
    });

    it('should support strict mode', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);

        // Crop with strict mode - only include objects entirely within
        const strictCrop = page.crop([100, 100, 300, 300], { strict: true });
        const nonStrictCrop = page.crop([100, 100, 300, 300], { strict: false });

        // Both should work
        const strictChars = await strictCrop.getChars();
        const nonStrictChars = await nonStrictCrop.getChars();

        expect(strictChars.length).toBeGreaterThanOrEqual(0);
        expect(nonStrictChars.length).toBeGreaterThanOrEqual(0);

        // Non-strict might have more chars (overlapping)
        expect(nonStrictChars.length).toBeGreaterThanOrEqual(strictChars.length);
      } finally {
        await pdf.close();
      }
    });

    it('should return correct bbox', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        const bboxInput: [number, number, number, number] = [50, 75, 250, 350];
        const cropped = page.crop(bboxInput);

        expect(cropped.bbox).toEqual(bboxInput);
      } finally {
        await pdf.close();
      }
    });

    it('should preserve page operations on cropped page', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        const cropped = page.crop([0, 0, 300, 300]);

        // Should be able to extract text
        const text = await cropped.extractText();
        expect(typeof text).toBe('string');

        // Should be able to extract words
        const words = await cropped.extractWords();
        expect(Array.isArray(words)).toBe(true);

        // Should be able to search
        const results = await cropped.search('the');
        expect(Array.isArray(results)).toBe(true);
      } finally {
        await pdf.close();
      }
    });
  });

  describe('withinBBox', () => {
    it('should return a Page with objects within bbox', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        const within = page.withinBBox([100, 100, 400, 400]);

        expect(within).toBeDefined();
        expect(within.pageNumber).toBe(page.pageNumber);
      } finally {
        await pdf.close();
      }
    });

    it('should use strict mode by default', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);

        // withinBBox defaults to strict: true
        const within = page.withinBBox([100, 100, 400, 400]);
        const explicit = page.crop([100, 100, 400, 400], { strict: true });

        // Should behave the same
        const withinChars = await within.getChars();
        const explicitChars = await explicit.getChars();

        expect(withinChars.length).toBe(explicitChars.length);
      } finally {
        await pdf.close();
      }
    });

    it('should support relative coordinates', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        const cropped = page.crop([100, 100, 500, 500]);

        // Get objects within relative bbox
        const within = cropped.withinBBox([0, 0, 100, 100], { relative: true });

        expect(within.bbox[0]).toBe(100); // x0 should be 100 + 0
        expect(within.bbox[1]).toBe(100); // y0 should be 100 + 0
      } finally {
        await pdf.close();
      }
    });
  });

  describe('outsideBBox', () => {
    it('should return a Page excluding objects in bbox', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        const fullChars = await page.getChars();

        // Exclude a region
        const outside = page.outsideBBox([200, 200, 400, 400]);
        const outsideChars = await outside.getChars();

        // Should have fewer chars
        expect(outsideChars.length).toBeLessThanOrEqual(fullChars.length);
      } finally {
        await pdf.close();
      }
    });

    it('should exclude objects entirely within bbox in strict mode', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);

        // Get all chars in the exclude region
        const withinBox = page.withinBBox([200, 200, 400, 400]);
        const charsInBox = await withinBox.getChars();

        // Exclude with strict mode (default)
        const outside = page.outsideBBox([200, 200, 400, 400]);
        const outsideChars = await outside.getChars();

        // Chars that were entirely within should not be in outsideChars
        for (const char of charsInBox) {
          const found = outsideChars.find(
            (c) => c.text === char.text && c.x0 === char.x0 && c.y0 === char.y0
          );
          expect(found).toBeUndefined();
        }
      } finally {
        await pdf.close();
      }
    });

    it('should work with non-strict mode', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);

        const strictOutside = page.outsideBBox([200, 200, 400, 400], { strict: true });
        const nonStrictOutside = page.outsideBBox([200, 200, 400, 400], { strict: false });

        const strictChars = await strictOutside.getChars();
        const nonStrictChars = await nonStrictOutside.getChars();

        // Non-strict might exclude more (any overlap excluded)
        expect(strictChars.length).toBeGreaterThanOrEqual(nonStrictChars.length);
      } finally {
        await pdf.close();
      }
    });

    it('should support relative coordinates', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        const cropped = page.crop([100, 100, 500, 500]);

        // Exclude relative to crop box
        const outside = cropped.outsideBBox([50, 50, 150, 150], { relative: true });

        // Should not throw
        const chars = await outside.getChars();
        expect(chars).toBeDefined();
      } finally {
        await pdf.close();
      }
    });

    it('should preserve other page operations', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        const outside = page.outsideBBox([200, 200, 400, 400]);

        // Should be able to extract text
        const text = await outside.extractText();
        expect(typeof text).toBe('string');

        // Should be able to get rects
        const rects = await outside.getRects();
        expect(Array.isArray(rects)).toBe(true);

        // Should be able to get images
        const images = await outside.getImages();
        expect(Array.isArray(images)).toBe(true);
      } finally {
        await pdf.close();
      }
    });
  });

  describe('filter', () => {
    it('should create FilteredPage with test function', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);

        // Filter to only include objects in upper half
        const filtered = page.filter((obj) => obj.y0 < 400);

        expect(filtered).toBeDefined();
      } finally {
        await pdf.close();
      }
    });

    it('should filter chars by test function', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        const fullChars = await page.getChars();

        // Filter to upper half
        const filtered = page.filter((obj) => obj.y0 < 400);
        const filteredChars = await filtered.getChars();

        // All filtered chars should be in upper half
        for (const char of filteredChars) {
          expect(char.y0).toBeLessThan(400);
        }

        // Should have fewer or equal chars
        expect(filteredChars.length).toBeLessThanOrEqual(fullChars.length);
      } finally {
        await pdf.close();
      }
    });

    it('should filter by font name', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        const chars = await page.getChars();

        if (chars.length > 0) {
          const firstFont = chars[0].fontName;

          // Filter by font name
          const filtered = page.filter((obj) => {
            if ('fontName' in obj) {
              return (obj as { fontName: string }).fontName === firstFont;
            }
            return true;
          });

          const filteredChars = await filtered.getChars();
          expect(filteredChars.every((c) => c.fontName === firstFont)).toBe(true);
        }
      } finally {
        await pdf.close();
      }
    });

    it('should filter rects', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        const filtered = page.filter((obj) => obj.y0 < 200);

        const rects = await filtered.getRects();
        for (const rect of rects) {
          expect(rect.y0).toBeLessThan(200);
        }
      } finally {
        await pdf.close();
      }
    });

    it('should filter lines', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        const filtered = page.filter((obj) => obj.x0 > 100);

        const lines = await filtered.getTextLines();
        for (const line of lines) {
          expect(line.x0).toBeGreaterThan(100);
        }
      } finally {
        await pdf.close();
      }
    });

    it('should support search on filtered page', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        const filtered = page.filter(() => true); // Include all

        const results = await filtered.search('the');
        expect(Array.isArray(results)).toBe(true);
      } finally {
        await pdf.close();
      }
    });
  });

  describe('filterObjects', () => {
    it('should filter array of objects by function', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        const chars = await page.getChars();

        const filtered = page.filterObjects(chars, (c) => c.text !== ' ');

        // Should not include spaces
        expect(filtered.every((c) => c.text !== ' ')).toBe(true);
      } finally {
        await pdf.close();
      }
    });

    it('should work with empty array', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);

        const filtered = page.filterObjects([], () => true);
        expect(filtered).toEqual([]);
      } finally {
        await pdf.close();
      }
    });
  });

  describe('chained operations', () => {
    it('should support crop then search', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        const cropped = page.crop([0, 0, 400, 400]);
        const results = await cropped.search('the');

        // Results should be within cropped region
        for (const result of results) {
          expect(result.x1).toBeLessThanOrEqual(400 + 10); // Some tolerance
          expect(result.y1).toBeLessThanOrEqual(400 + 10);
        }
      } finally {
        await pdf.close();
      }
    });

    it('should support nested crops', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        const crop1 = page.crop([0, 0, 500, 500]);
        const crop2 = crop1.crop([0, 0, 300, 300], { relative: true });

        // Final crop box should be within original
        const bbox = crop2.bbox;
        expect(bbox[2]).toBeLessThanOrEqual(300);
        expect(bbox[3]).toBeLessThanOrEqual(300);
      } finally {
        await pdf.close();
      }
    });

    it('should support filter then extract', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        const filtered = page.filter((obj) => obj.y0 < 300);

        const text = await filtered.extractText();
        const words = await filtered.extractWords();

        expect(typeof text).toBe('string');
        expect(Array.isArray(words)).toBe(true);
      } finally {
        await pdf.close();
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty crop region', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        // Crop to empty region (no chars should be there)
        const cropped = page.crop([0, 0, 1, 1]);

        const chars = await cropped.getChars();
        expect(chars.length).toBe(0);
      } finally {
        await pdf.close();
      }
    });

    it('should handle crop outside page bounds', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        // Crop to region outside page
        const cropped = page.crop([1000, 1000, 2000, 2000]);

        const chars = await cropped.getChars();
        expect(chars.length).toBe(0);
      } finally {
        await pdf.close();
      }
    });

    it('should handle filter that matches nothing', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        const filtered = page.filter(() => false);

        const chars = await filtered.getChars();
        expect(chars.length).toBe(0);
      } finally {
        await pdf.close();
      }
    });

    it('should handle filter that matches everything', async () => {
      const pdf = await PDFExcavator.open(samplePdfPath);
      try {
        const page = pdf.getPage(0);
        const fullChars = await page.getChars();

        const filtered = page.filter(() => true);
        const filteredChars = await filtered.getChars();

        expect(filteredChars.length).toBe(fullChars.length);
      } finally {
        await pdf.close();
      }
    });
  });
});
