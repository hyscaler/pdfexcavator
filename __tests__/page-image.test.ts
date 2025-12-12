/**
 * PageImage Tests
 * Tests for PageImage class: drawing, saving, and visual debugging
 */

import { jest } from '@jest/globals';
import { tmpdir } from 'os';
import { join } from 'path';
import { existsSync, unlinkSync } from 'fs';

describe('PageImage', () => {
  let PageImage: typeof import('../src/index.js').PageImage;
  let createPageImage: typeof import('../src/index.js').createPageImage;
  let PDFExcavator: typeof import('../src/index.js').PDFExcavator;
  let canvasAvailable = false;

  beforeAll(async () => {
    const module = await import('../src/index.js');
    PageImage = module.PageImage;
    createPageImage = module.createPageImage;
    PDFExcavator = module.PDFExcavator;

    // Check if canvas is available
    try {
      await import('canvas');
      canvasAvailable = true;
    } catch {
      canvasAvailable = false;
    }
  });

  describe('Module Exports', () => {
    it('should export PageImage class', () => {
      expect(PageImage).toBeDefined();
      expect(typeof PageImage).toBe('function');
    });

    it('should export createPageImage function', () => {
      expect(createPageImage).toBeDefined();
      expect(typeof createPageImage).toBe('function');
    });
  });

  describe('PageImage with Mock Canvas', () => {
    // Create a mock canvas for testing without actual canvas package
    function createMockCanvas(width: number, height: number) {
      const imageData = {
        data: new Uint8ClampedArray(width * height * 4),
        width,
        height,
      };

      const context = {
        save: jest.fn(),
        restore: jest.fn(),
        fillRect: jest.fn(),
        strokeRect: jest.fn(),
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        stroke: jest.fn(),
        fill: jest.fn(),
        arc: jest.fn(),
        closePath: jest.fn(),
        quadraticCurveTo: jest.fn(),
        fillText: jest.fn(),
        strokeText: jest.fn(),
        setLineDash: jest.fn(),
        drawImage: jest.fn(),
        getImageData: jest.fn(() => imageData),
        putImageData: jest.fn(),
        globalAlpha: 1,
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        font: '',
        imageSmoothingEnabled: true,
      };

      return {
        width,
        height,
        getContext: jest.fn(() => context),
        toBuffer: jest.fn(() => Buffer.from('mock-image-data')),
        _context: context,
      };
    }

    it('should create PageImage instance', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      expect(pageImage).toBeInstanceOf(PageImage);
    });

    it('should return correct dimensions', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      expect(pageImage.width).toBe(612);
      expect(pageImage.height).toBe(792);
    });

    it('should return correct scale', () => {
      const mockCanvas = createMockCanvas(1224, 1584);
      const pageImage = new PageImage(mockCanvas, 2);

      expect(pageImage.scale).toBe(2);
    });

    it('should draw rectangle', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      const result = pageImage.drawRect({ x0: 10, y0: 20, x1: 100, y1: 80 });

      expect(result).toBe(pageImage); // Returns self for chaining
      expect(mockCanvas._context.save).toHaveBeenCalled();
      expect(mockCanvas._context.restore).toHaveBeenCalled();
    });

    it('should draw rectangle with BBox array', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      const result = pageImage.drawRect([10, 20, 100, 80] as [number, number, number, number]);

      expect(result).toBe(pageImage);
    });

    it('should draw multiple rectangles', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      const rects = [
        { x0: 10, y0: 20, x1: 100, y1: 80 },
        { x0: 150, y0: 200, x1: 300, y1: 400 },
      ];

      const result = pageImage.drawRects(rects);

      expect(result).toBe(pageImage);
      // save/restore called for each rect
      expect(mockCanvas._context.save).toHaveBeenCalledTimes(2);
    });

    it('should draw rectangles with custom options', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      pageImage.drawRect({ x0: 10, y0: 20, x1: 100, y1: 80 }, {
        stroke: 'blue',
        fill: 'yellow',
        strokeWidth: 2,
        strokeOpacity: 0.8,
        fillOpacity: 0.5,
        radius: 5,
      });

      expect(mockCanvas._context.save).toHaveBeenCalled();
    });

    it('should draw line', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      const result = pageImage.drawLine({ x0: 0, y0: 0, x1: 100, y1: 100 });

      expect(result).toBe(pageImage);
      expect(mockCanvas._context.beginPath).toHaveBeenCalled();
      expect(mockCanvas._context.moveTo).toHaveBeenCalled();
      expect(mockCanvas._context.lineTo).toHaveBeenCalled();
      expect(mockCanvas._context.stroke).toHaveBeenCalled();
    });

    it('should draw multiple lines', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      const lines = [
        { x0: 0, y0: 0, x1: 100, y1: 0 },
        { x0: 0, y0: 50, x1: 100, y1: 50 },
      ];

      const result = pageImage.drawLines(lines);

      expect(result).toBe(pageImage);
    });

    it('should draw lines with dash pattern', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      pageImage.drawLine({ x0: 0, y0: 0, x1: 100, y1: 100 }, {
        dash: [5, 3],
      });

      expect(mockCanvas._context.setLineDash).toHaveBeenCalledWith([5, 3]);
    });

    it('should draw vertical line', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      const result = pageImage.drawVLine(100);

      expect(result).toBe(pageImage);
    });

    it('should draw multiple vertical lines', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      const result = pageImage.drawVLines([100, 200, 300]);

      expect(result).toBe(pageImage);
    });

    it('should draw horizontal line', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      const result = pageImage.drawHLine(100);

      expect(result).toBe(pageImage);
    });

    it('should draw multiple horizontal lines', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      const result = pageImage.drawHLines([100, 200, 300]);

      expect(result).toBe(pageImage);
    });

    it('should draw circle', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      const result = pageImage.drawCircle({ x: 100, y: 100 });

      expect(result).toBe(pageImage);
      expect(mockCanvas._context.arc).toHaveBeenCalled();
    });

    it('should draw multiple circles', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      const points = [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ];

      const result = pageImage.drawCircles(points);

      expect(result).toBe(pageImage);
    });

    it('should draw circles with custom options', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      pageImage.drawCircle({ x: 100, y: 100 }, {
        stroke: 'green',
        fill: 'lightgreen',
        radius: 10,
        strokeWidth: 2,
      });

      expect(mockCanvas._context.arc).toHaveBeenCalled();
    });

    it('should draw points (small circles)', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      const points = [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ];

      const result = pageImage.drawPoints(points);

      expect(result).toBe(pageImage);
    });

    it('should draw text', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      const result = pageImage.drawText('Hello', 100, 100);

      expect(result).toBe(pageImage);
      expect(mockCanvas._context.fillText).toHaveBeenCalled();
    });

    it('should draw text with custom options', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      pageImage.drawText('Hello', 100, 100, {
        font: '16px Arial',
        fill: 'blue',
        stroke: 'black',
        strokeWidth: 1,
      });

      expect(mockCanvas._context.fillText).toHaveBeenCalled();
      expect(mockCanvas._context.strokeText).toHaveBeenCalled();
    });

    it('should draw bboxes (alias for drawRects)', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      const objects = [
        { x0: 10, y0: 20, x1: 100, y1: 80 },
      ];

      const result = pageImage.drawBBoxes(objects);

      expect(result).toBe(pageImage);
    });

    it('should reset to original image', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      // Draw something
      pageImage.drawRect({ x0: 10, y0: 20, x1: 100, y1: 80 });

      // Reset
      const result = pageImage.reset();

      expect(result).toBe(pageImage);
      expect(mockCanvas._context.putImageData).toHaveBeenCalled();
    });

    it('should convert to buffer', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      const buffer = pageImage.toBuffer();

      expect(buffer).toBeInstanceOf(Buffer);
      expect(mockCanvas.toBuffer).toHaveBeenCalledWith('image/png');
    });

    it('should convert to JPEG buffer', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      pageImage.toBuffer('jpeg');

      expect(mockCanvas.toBuffer).toHaveBeenCalledWith('image/jpeg');
    });

    it('should debug table finder visualization', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      const tableFinderResult = {
        edges: [
          { x0: 0, y0: 0, x1: 100, y1: 0 },
          { x0: 0, y0: 50, x1: 100, y1: 50 },
        ],
        intersections: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        tables: [
          { bbox: [0, 0, 100, 50] as [number, number, number, number] },
        ],
      };

      const result = pageImage.debugTableFinder(tableFinderResult);

      expect(result).toBe(pageImage);
    });

    it('should debug table finder with empty arrays', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      const tableFinderResult = {
        edges: [],
        intersections: [],
        tables: [],
      };

      const result = pageImage.debugTableFinder(tableFinderResult);

      expect(result).toBe(pageImage);
    });

    it('should debug table finder with custom colors', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      const tableFinderResult = {
        edges: [{ x0: 0, y0: 0, x1: 100, y1: 0 }],
        intersections: [{ x: 50, y: 50 }],
        tables: [{ bbox: [0, 0, 100, 100] as [number, number, number, number] }],
      };

      const result = pageImage.debugTableFinder(tableFinderResult, {
        edgeColor: 'green',
        intersectionColor: 'yellow',
        tableColor: 'pink',
        tableFillOpacity: 0.5,
      });

      expect(result).toBe(pageImage);
    });

    it('should support method chaining', () => {
      const mockCanvas = createMockCanvas(612, 792);
      const pageImage = new PageImage(mockCanvas, 1);

      const result = pageImage
        .drawRect({ x0: 10, y0: 20, x1: 100, y1: 80 })
        .drawLine({ x0: 0, y0: 0, x1: 100, y1: 100 })
        .drawCircle({ x: 50, y: 50 })
        .drawText('Test', 10, 10);

      expect(result).toBe(pageImage);
    });
  });

  describe('Save Path Validation', () => {
    it('should reject path with null bytes', async () => {
      const mockCanvas = {
        width: 100,
        height: 100,
        getContext: () => ({
          getImageData: () => ({ data: new Uint8ClampedArray(100), width: 100, height: 100 }),
        }),
        toBuffer: () => Buffer.from('test'),
      };
      const pageImage = new PageImage(mockCanvas, 1);

      await expect(
        pageImage.save('test\0.png')
      ).rejects.toThrow(/invalid/i);
    });

    it('should reject path traversal when basePath is set', async () => {
      const mockCanvas = {
        width: 100,
        height: 100,
        getContext: () => ({
          getImageData: () => ({ data: new Uint8ClampedArray(100), width: 100, height: 100 }),
        }),
        toBuffer: () => Buffer.from('test'),
      };
      const pageImage = new PageImage(mockCanvas, 1);

      await expect(
        pageImage.save('../../../etc/passwd.png', { basePath: '/safe/dir' })
      ).rejects.toThrow(/traversal/i);
    });

    it('should require path parameter', async () => {
      const mockCanvas = {
        width: 100,
        height: 100,
        getContext: () => ({
          getImageData: () => ({ data: new Uint8ClampedArray(100), width: 100, height: 100 }),
        }),
        toBuffer: () => Buffer.from('test'),
      };
      const pageImage = new PageImage(mockCanvas, 1);

      await expect(
        pageImage.save('')
      ).rejects.toThrow(/required/i);
    });
  });

  describe('Integration with Real Canvas', () => {
    const conditionalTest = canvasAvailable ? it : it.skip;

    conditionalTest('should create PageImage from PDF page', async () => {
      const SAMPLE_PDF_PATH = join(__dirname, '../fixtures/sample.pdf');

      if (!existsSync(SAMPLE_PDF_PATH)) {
        console.log('Skipping: sample.pdf not found');
        return;
      }

      const doc = await PDFExcavator.open(SAMPLE_PDF_PATH);
      const page = await doc.getPage(0);
      const image = await page.toImage();

      expect(image).toBeInstanceOf(PageImage);
      expect(image.width).toBeGreaterThan(0);
      expect(image.height).toBeGreaterThan(0);

      await doc.close();
    });

    conditionalTest('should create PageImage with custom resolution', async () => {
      const SAMPLE_PDF_PATH = join(__dirname, '../fixtures/sample.pdf');

      if (!existsSync(SAMPLE_PDF_PATH)) {
        console.log('Skipping: sample.pdf not found');
        return;
      }

      const doc = await PDFExcavator.open(SAMPLE_PDF_PATH);
      const page = await doc.getPage(0);
      const image = await page.toImage({ resolution: 150 });

      // At 150 DPI (2x the default 72 DPI), dimensions should be roughly 2x
      expect(image.width).toBeGreaterThan(0);
      expect(image.scale).toBeCloseTo(150 / 72, 1);

      await doc.close();
    });

    conditionalTest('should save image to file', async () => {
      const SAMPLE_PDF_PATH = join(__dirname, '../fixtures/sample.pdf');

      if (!existsSync(SAMPLE_PDF_PATH)) {
        console.log('Skipping: sample.pdf not found');
        return;
      }

      const doc = await PDFExcavator.open(SAMPLE_PDF_PATH);
      const page = await doc.getPage(0);
      const image = await page.toImage();

      const tempPath = join(tmpdir(), `test-${Date.now()}.png`);

      try {
        await image.save(tempPath);
        expect(existsSync(tempPath)).toBe(true);
      } finally {
        // Cleanup
        if (existsSync(tempPath)) {
          unlinkSync(tempPath);
        }
        await doc.close();
      }
    });

    conditionalTest('should draw on image and save', async () => {
      const SAMPLE_PDF_PATH = join(__dirname, '../fixtures/sample.pdf');

      if (!existsSync(SAMPLE_PDF_PATH)) {
        console.log('Skipping: sample.pdf not found');
        return;
      }

      const doc = await PDFExcavator.open(SAMPLE_PDF_PATH);
      const page = await doc.getPage(0);
      const image = await page.toImage();

      // Draw some annotations
      image
        .drawRect({ x0: 50, y0: 50, x1: 200, y1: 100 }, { stroke: 'red', strokeWidth: 2 })
        .drawCircle({ x: 300, y: 300 }, { fill: 'blue', radius: 20 })
        .drawText('Test Annotation', 50, 150, { fill: 'green' });

      const tempPath = join(tmpdir(), `test-annotated-${Date.now()}.png`);

      try {
        await image.save(tempPath);
        expect(existsSync(tempPath)).toBe(true);
      } finally {
        if (existsSync(tempPath)) {
          unlinkSync(tempPath);
        }
        await doc.close();
      }
    });

    conditionalTest('should copy PageImage', async () => {
      const SAMPLE_PDF_PATH = join(__dirname, '../fixtures/sample.pdf');

      if (!existsSync(SAMPLE_PDF_PATH)) {
        console.log('Skipping: sample.pdf not found');
        return;
      }

      const doc = await PDFExcavator.open(SAMPLE_PDF_PATH);
      const page = await doc.getPage(0);
      const image = await page.toImage();

      const copy = await image.copy();

      expect(copy).toBeInstanceOf(PageImage);
      expect(copy.width).toBe(image.width);
      expect(copy.height).toBe(image.height);
      expect(copy).not.toBe(image); // Different instance

      await doc.close();
    });

    it('should skip canvas tests when canvas not available', () => {
      if (!canvasAvailable) {
        console.log('Note: Canvas package not installed, some tests skipped');
        console.log('Install with: npm install canvas');
      }
      expect(true).toBe(true);
    });
  });
});
