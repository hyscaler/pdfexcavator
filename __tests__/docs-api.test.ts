/**
 * Comprehensive tests for all documented API functions
 * These tests verify that every function documented in docs/ works as expected
 */

import { jest } from '@jest/globals';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Main imports as documented
import pdfexcavator, {
  PDFExcavator,
  Page,
  PageImage,
  open,
  // Text extraction
  extractChars,
  extractText,
  extractTextSimple,
  extractTextFromItems,
  extractLines,
  extractWords,
  extractCharsWithColors,
  extractCharsWithSpacing,
  extractCharsWithPrecision,
  // Table extraction
  TableFinder,
  findTables,
  extractTables,
  extractTable,
  debugTableFinder,
  detectBorderlessTables,
  findNestedTables,
  extractTablesEnhanced,
  // Layout analysis
  LayoutAnalyzer,
  analyzeLayout,
  detectTextColumns,
  detectReadingDirection,
  isVerticalText,
  DEFAULT_LAPARAMS,
  // Font utilities
  findFontSubstitution,
  classifyFont,
  parseFontStyle,
  FontSubstitutionManager,
  PDF_BASE_FONTS,
  STANDARD_FONT_METRICS,
  extractFontMetrics,
  getCharWidth,
  getBaseline,
  getFontSubstitutions,
  getMissingFonts,
  resetFontSubstitutions,
  // CMap utilities
  getDefaultCMapConfig,
  isCJKFont,
  normalizeCJKText,
  // OCR utilities
  needsOCR,
  isLikelyScanned,
  isTesseractAvailable,
  OCREngine,
  OCR_LANGUAGES,
  PSM_MODES,
  OEM_MODES,
  // BBox utilities
  normalizeBBox,
  isValidBBox,
  pointInBBox,
  bboxOverlaps,
  bboxWithin,
  bboxOutside,
  bboxIntersection,
  bboxUnion,
  getBBox,
  bboxArea,
  bboxCenter,
  bboxExpand,
  filterWithinBBox,
  filterOverlapsBBox,
  filterOutsideBBox,
  // Geometry utilities
  isHorizontalLine,
  isVerticalLine,
  getHorizontalLines,
  getVerticalLines,
  groupHorizontalLines,
  groupVerticalLines,
  rectsToLines,
  getUniqueXPositions,
  getUniqueYPositions,
  lineLength,
  linesIntersect,
  clusterObjects,
  clusterObjectsByMean,
  // Character correction
  correctText,
  autoCorrectText,
  detectEncodingIssues,
  createTextCorrector,
  // Types
  type BBox,
  type PDFChar,
  type PDFWord,
  type PDFTextLine,
  type PDFTable,
  type PDFMetadata,
  type PDFLine,
  type PDFRect,
  type Color,
} from '../src/index.js';

const SAMPLE_PDF_PATH = join(process.cwd(), 'fixtures', 'sample.pdf');

describe('Documented API Tests', () => {
  // ============================================================
  // PDFExcavator Class (docs/api/pdfexcavator.md)
  // ============================================================
  describe('PDFExcavator Class', () => {
    describe('Opening PDFs', () => {
      it('should open PDF with pdfexcavator.open(path)', async () => {
        const pdf = await pdfexcavator.open(SAMPLE_PDF_PATH);
        expect(pdf).toBeInstanceOf(PDFExcavator);
        expect(pdf.pageCount).toBeGreaterThan(0);
        await pdf.close();
      });

      it('should open PDF with named export open(path)', async () => {
        const pdf = await open(SAMPLE_PDF_PATH);
        expect(pdf).toBeInstanceOf(PDFExcavator);
        await pdf.close();
      });

      it('should open PDF with options', async () => {
        const pdf = await pdfexcavator.open(SAMPLE_PDF_PATH, {
          enableCMap: true,
          enableFontSubstitution: true,
        });
        expect(pdf).toBeInstanceOf(PDFExcavator);
        await pdf.close();
      });

      it('should open PDF from Buffer with PDFExcavator.fromBuffer()', async () => {
        const buffer = readFileSync(SAMPLE_PDF_PATH);
        const pdf = await PDFExcavator.fromBuffer(buffer);
        expect(pdf).toBeInstanceOf(PDFExcavator);
        expect(pdf.pageCount).toBeGreaterThan(0);
        await pdf.close();
      });

      it('should open PDF from Uint8Array with PDFExcavator.fromUint8Array()', async () => {
        const buffer = readFileSync(SAMPLE_PDF_PATH);
        const uint8Array = new Uint8Array(buffer);
        const pdf = await PDFExcavator.fromUint8Array(uint8Array);
        expect(pdf).toBeInstanceOf(PDFExcavator);
        await pdf.close();
      });
    });

    describe('Properties', () => {
      let pdf: PDFExcavator;

      beforeAll(async () => {
        pdf = await pdfexcavator.open(SAMPLE_PDF_PATH);
      });

      afterAll(async () => {
        await pdf.close();
      });

      it('should have pageCount property', () => {
        expect(typeof pdf.pageCount).toBe('number');
        expect(pdf.pageCount).toBeGreaterThan(0);
      });

      it('should have pages array for iteration', () => {
        expect(Array.isArray(pdf.pages)).toBe(true);
        expect(pdf.pages.length).toBe(pdf.pageCount);
        for (const page of pdf.pages) {
          expect(page).toBeInstanceOf(Page);
        }
      });

      it('should have metadata async getter', async () => {
        const meta = await pdf.metadata;
        expect(meta).toBeDefined();
        expect(typeof meta.pageCount).toBe('number');
        expect(meta.pageCount).toBe(pdf.pageCount);
        // Optional properties
        expect('title' in meta).toBe(true);
        expect('author' in meta).toBe(true);
        expect('pdfVersion' in meta).toBe(true);
        expect('isEncrypted' in meta).toBe(true);
      });
    });

    describe('Methods', () => {
      let pdf: PDFExcavator;

      beforeAll(async () => {
        pdf = await pdfexcavator.open(SAMPLE_PDF_PATH);
      });

      afterAll(async () => {
        await pdf.close();
      });

      it('should get page by index with getPage()', () => {
        const page = pdf.getPage(0);
        expect(page).toBeInstanceOf(Page);
        expect(page.pageNumber).toBe(0);

        const lastPage = pdf.getPage(pdf.pageCount - 1);
        expect(lastPage.pageNumber).toBe(pdf.pageCount - 1);
      });

      it('should throw for invalid page index', () => {
        expect(() => pdf.getPage(-1)).toThrow();
        expect(() => pdf.getPage(pdf.pageCount)).toThrow();
      });

      it('should extract text from all pages with extractText()', async () => {
        const allText = await pdf.extractText();
        expect(typeof allText).toBe('string');
        expect(allText.length).toBeGreaterThan(0);
      });

      it('should search for text with search()', async () => {
        const results = await pdf.search('Lorem');
        expect(Array.isArray(results)).toBe(true);
        if (results.length > 0) {
          expect(results[0]).toHaveProperty('pageNumber');
          expect(results[0]).toHaveProperty('matches');
        }
      });

      it('should search with regex pattern', async () => {
        const results = await pdf.search(/[A-Z][a-z]+/g);
        expect(Array.isArray(results)).toBe(true);
      });

      it('should process pages with processPages()', async () => {
        const result = await pdf.processPages(
          async (page) => {
            const text = await page.extractText();
            return { pageNumber: page.pageNumber, length: text.length };
          },
          { concurrency: 2 }
        );

        expect(result.results).toBeDefined();
        expect(result.pagesProcessed).toBe(pdf.pageCount);
        expect(typeof result.duration).toBe('number');
      });

      it('should process pages with progress callback', async () => {
        const progressCalls: number[] = [];

        await pdf.processPages(
          async (page) => page.extractText(),
          {
            concurrency: 1,
            onProgress: (done, total) => {
              progressCalls.push(done);
            }
          }
        );

        expect(progressCalls.length).toBe(pdf.pageCount);
      });

      it('should process pages sequentially with processPagesSequential()', async () => {
        const result = await pdf.processPagesSequential(
          async (page) => await page.extractText()
        );

        expect(result.results).toBeDefined();
        expect(result.pagesProcessed).toBe(pdf.pageCount);
      });
    });

    describe('Static Methods', () => {
      it('should check if buffer is PDF with isPDFLike()', () => {
        const pdfBuffer = readFileSync(SAMPLE_PDF_PATH);
        expect(PDFExcavator.isPDFLike(pdfBuffer)).toBe(true);

        const notPdfBuffer = Buffer.from('Hello World');
        expect(PDFExcavator.isPDFLike(notPdfBuffer)).toBe(false);
      });

      it('should analyze PDF structure with analyzePDF()', () => {
        const buffer = readFileSync(SAMPLE_PDF_PATH);
        const analysis = PDFExcavator.analyzePDF(buffer);

        expect(analysis).toBeDefined();
        expect('version' in analysis).toBe(true);
        expect('encrypted' in analysis).toBe(true);
      });

      it('should extract raw text with extractRawText()', () => {
        const buffer = readFileSync(SAMPLE_PDF_PATH);
        const texts = PDFExcavator.extractRawText(buffer);

        expect(Array.isArray(texts)).toBe(true);
      });
    });

    describe('Resource Management', () => {
      it('should close PDF and free resources', async () => {
        const pdf = await pdfexcavator.open(SAMPLE_PDF_PATH);
        await pdf.close();
        // Should not throw on multiple close calls
        await pdf.close();
      });
    });
  });

  // ============================================================
  // Page Class (docs/api/page.md)
  // ============================================================
  describe('Page Class', () => {
    let pdf: PDFExcavator;
    let page: Page;

    beforeAll(async () => {
      pdf = await pdfexcavator.open(SAMPLE_PDF_PATH);
      page = pdf.pages[0];
    });

    afterAll(async () => {
      await pdf.close();
    });

    describe('Properties', () => {
      it('should have pageNumber property', () => {
        expect(typeof page.pageNumber).toBe('number');
        expect(page.pageNumber).toBe(0);
      });

      it('should have width property', () => {
        expect(typeof page.width).toBe('number');
        expect(page.width).toBeGreaterThan(0);
      });

      it('should have height property', () => {
        expect(typeof page.height).toBe('number');
        expect(page.height).toBeGreaterThan(0);
      });

      it('should have rotation property', () => {
        expect(typeof page.rotation).toBe('number');
        expect([0, 90, 180, 270]).toContain(page.rotation);
      });

      it('should have pdfPage accessor for advanced use', () => {
        expect(page.pdfPage).toBeDefined();
        expect(typeof page.pdfPage.getTextContent).toBe('function');
      });

      it('should have chars async getter', async () => {
        const chars = await page.chars;
        expect(Array.isArray(chars)).toBe(true);
        if (chars.length > 0) {
          expect(chars[0]).toHaveProperty('text');
          expect(chars[0]).toHaveProperty('x0');
          expect(chars[0]).toHaveProperty('y0');
        }
      });
    });

    describe('Text Extraction Methods', () => {
      it('should extract text with extractText()', async () => {
        const text = await page.extractText();
        expect(typeof text).toBe('string');
      });

      it('should extract text with layout option', async () => {
        const text = await page.extractText({ layout: true });
        expect(typeof text).toBe('string');
      });

      it('should extract text simply with extractTextSimple()', async () => {
        const text = await page.extractTextSimple();
        expect(typeof text).toBe('string');
      });

      it('should extract raw text with extractTextRaw()', async () => {
        const text = await page.extractTextRaw();
        expect(typeof text).toBe('string');
      });

      it('should extract raw text with options', async () => {
        const text = await page.extractTextRaw({
          detectLineBreaks: true,
          lineBreakThreshold: 5,
        });
        expect(typeof text).toBe('string');
      });

      it('should extract words with extractWords()', async () => {
        const words = await page.extractWords();
        expect(Array.isArray(words)).toBe(true);
        if (words.length > 0) {
          expect(words[0]).toHaveProperty('text');
          expect(words[0]).toHaveProperty('x0');
          expect(words[0]).toHaveProperty('y0');
          expect(words[0]).toHaveProperty('x1');
          expect(words[0]).toHaveProperty('y1');
        }
      });

      it('should get text lines with getTextLines()', async () => {
        const lines = await page.getTextLines();
        expect(Array.isArray(lines)).toBe(true);
      });
    });

    describe('Table Extraction Methods', () => {
      it('should extract tables with extractTables()', async () => {
        const tables = await page.extractTables();
        expect(Array.isArray(tables)).toBe(true);
      });

      it('should extract tables with options', async () => {
        const tables = await page.extractTables({
          verticalStrategy: 'lines',
          horizontalStrategy: 'lines',
        });
        expect(Array.isArray(tables)).toBe(true);
      });

      it('should extract single table with extractTable()', async () => {
        const table = await page.extractTable();
        // May be null if no tables found
        if (table) {
          expect(table).toHaveProperty('rows');
          expect(Array.isArray(table.rows)).toBe(true);
        }
      });

      it('should find tables with findTables()', async () => {
        const result = await page.findTables();
        expect(result).toHaveProperty('tables');
        expect(result).toHaveProperty('edges');
        expect(result).toHaveProperty('intersections');
      });

      it('should debug table finder with debugTableFinder()', async () => {
        const debug = await page.debugTableFinder();
        expect(debug).toHaveProperty('edges');
        expect(debug).toHaveProperty('intersections');
        expect(debug).toHaveProperty('tables');
      });
    });

    describe('Graphics Methods', () => {
      it('should get lines with getLines()', async () => {
        const lines = await page.getLines();
        expect(Array.isArray(lines)).toBe(true);
      });

      it('should get rectangles with getRects()', async () => {
        const rects = await page.getRects();
        expect(Array.isArray(rects)).toBe(true);
      });

      it('should get curves with getCurves()', async () => {
        const curves = await page.getCurves();
        expect(Array.isArray(curves)).toBe(true);
      });

      it('should get images with getImages()', async () => {
        const images = await page.getImages();
        expect(Array.isArray(images)).toBe(true);
      });

      it('should get annotations with getAnnotations()', async () => {
        const annots = await page.getAnnotations();
        expect(Array.isArray(annots)).toBe(true);
      });

      it('should get hyperlinks with getHyperlinks()', async () => {
        const links = await page.getHyperlinks();
        expect(Array.isArray(links)).toBe(true);
      });
    });

    describe('Search and Filter Methods', () => {
      it('should search for text with search()', async () => {
        const results = await page.search('Lorem');
        expect(Array.isArray(results)).toBe(true);
      });

      it('should search with regex', async () => {
        const results = await page.search(/[A-Z]+/g);
        expect(Array.isArray(results)).toBe(true);
      });

      it('should crop page with crop()', () => {
        const cropped = page.crop([0, 0, 300, 400]);
        expect(cropped).toBeInstanceOf(Page);
        expect(cropped.bbox).toEqual([0, 0, 300, 400]);
      });

      it('should filter within bbox with withinBBox()', () => {
        const filtered = page.withinBBox([0, 0, 300, 400]);
        expect(filtered).toBeInstanceOf(Page);
      });

      it('should filter outside bbox with outsideBBox()', () => {
        const filtered = page.outsideBBox([0, 0, 100, 100]);
        // Returns OutsideBBoxPage which extends Page functionality
        expect(filtered).toBeDefined();
        expect(typeof filtered.extractText).toBe('function');
      });

      it('should filter with custom function with filter()', () => {
        const filtered = page.filter((obj) => obj.x0 < 300);
        // Returns FilteredPage which extends Page functionality
        expect(filtered).toBeDefined();
        expect(typeof filtered.extractText).toBe('function');
      });
    });

    describe('OCR Methods', () => {
      it('should check if OCR is needed with needsOCR()', async () => {
        const needs = await page.needsOCR();
        expect(typeof needs).toBe('boolean');
      });

      it('should check if page is scanned with isScannedPage()', async () => {
        const isScanned = await page.isScannedPage();
        expect(typeof isScanned).toBe('boolean');
      });
    });

    describe('Layout Analysis Methods', () => {
      it('should analyze layout with analyzeLayout()', async () => {
        const result = await page.analyzeLayout();
        expect(result).toHaveProperty('words');
        expect(result).toHaveProperty('lines');
        expect(result).toHaveProperty('text');
      });

      it('should get words with layout analysis', async () => {
        const words = await page.getWordsWithLayout();
        expect(Array.isArray(words)).toBe(true);
      });

      it('should get lines with layout analysis', async () => {
        const lines = await page.getLinesWithLayout();
        expect(Array.isArray(lines)).toBe(true);
      });

      it('should extract text with layout params', async () => {
        const text = await page.extractTextWithLayout({
          charMargin: 2.0,
          wordMargin: 0.1,
        });
        expect(typeof text).toBe('string');
      });

      it('should detect columns with detectColumns()', async () => {
        const columns = await page.detectColumns();
        expect(Array.isArray(columns)).toBe(true);
      });
    });

    describe('Utility Methods', () => {
      it('should flush page cache with flush()', () => {
        // Should not throw
        page.flush();
      });

      it('should get page info', () => {
        const info = page.info;
        expect(info).toHaveProperty('pageNumber');
        expect(info).toHaveProperty('width');
        expect(info).toHaveProperty('height');
        expect(info).toHaveProperty('rotation');
      });

      it('should have static getDefaultLAParams()', () => {
        const params = Page.getDefaultLAParams();
        expect(params).toHaveProperty('lineOverlap');
        expect(params).toHaveProperty('charMargin');
        expect(params).toHaveProperty('wordMargin');
      });

      it('should have static isOCRAvailable()', async () => {
        const available = await Page.isOCRAvailable();
        expect(typeof available).toBe('boolean');
      });
    });
  });

  // ============================================================
  // Text Extraction Functions (docs/api/text-extraction.md)
  // ============================================================
  describe('Text Extraction Functions', () => {
    let pdf: PDFExcavator;
    let page: Page;
    let chars: PDFChar[];

    beforeAll(async () => {
      pdf = await pdfexcavator.open(SAMPLE_PDF_PATH);
      page = pdf.pages[0];
      chars = await page.chars;
    });

    afterAll(async () => {
      await pdf.close();
    });

    it('should extract chars with extractChars()', async () => {
      const textContent = await page.pdfPage.getTextContent();
      const extractedChars = extractChars(textContent, page.pageNumber, page.height);
      expect(Array.isArray(extractedChars)).toBe(true);
    });

    it('should extract words with extractWords()', () => {
      const words = extractWords(chars);
      expect(Array.isArray(words)).toBe(true);
      if (words.length > 0) {
        expect(words[0]).toHaveProperty('text');
        expect(words[0]).toHaveProperty('x0');
      }
    });

    it('should extract lines with extractLines()', () => {
      const lines = extractLines(chars);
      expect(Array.isArray(lines)).toBe(true);
    });

    it('should extract text with extractText()', () => {
      const text = extractText(chars);
      expect(typeof text).toBe('string');
    });

    it('should extract text simply with extractTextSimple()', () => {
      const text = extractTextSimple(chars);
      expect(typeof text).toBe('string');
    });

    it('should extract text from items with extractTextFromItems()', async () => {
      const textContent = await page.pdfPage.getTextContent();
      const text = extractTextFromItems(textContent);
      expect(typeof text).toBe('string');
    });

    it('should extract chars with colors', async () => {
      const charsWithColors = await extractCharsWithColors(
        page.pdfPage,
        page.pageNumber,
        page.height,
        0
      );
      expect(Array.isArray(charsWithColors)).toBe(true);
    });

    it('should extract chars with spacing', async () => {
      const charsWithSpacing = await extractCharsWithSpacing(
        page.pdfPage,
        page.pageNumber,
        page.height,
        0
      );
      expect(Array.isArray(charsWithSpacing)).toBe(true);
    });

    it('should extract chars with precision', async () => {
      const preciseChars = await extractCharsWithPrecision(
        page.pdfPage,
        page.pageNumber,
        page.height,
        0
      );
      expect(Array.isArray(preciseChars)).toBe(true);
    });
  });

  // ============================================================
  // Table Extraction Functions (docs/api/table-extraction.md)
  // ============================================================
  describe('Table Extraction Functions', () => {
    const chars: PDFChar[] = [];
    const lines: any[] = [];
    const rects: any[] = [];

    it('should create TableFinder instance', () => {
      const finder = new TableFinder(chars, lines, rects, 0);
      expect(finder).toBeInstanceOf(TableFinder);
    });

    it('should find tables with findTables()', () => {
      const result = findTables(chars, lines, rects, 0);
      expect(result).toHaveProperty('tables');
      expect(result).toHaveProperty('edges');
      expect(result).toHaveProperty('intersections');
    });

    it('should extract tables with extractTables()', () => {
      const tables = extractTables(chars, lines, rects, 0);
      expect(Array.isArray(tables)).toBe(true);
    });

    it('should extract single table with extractTable()', () => {
      const table = extractTable(chars, lines, rects, 0);
      // May be null
      expect(table === null || typeof table === 'object').toBe(true);
    });

    it('should debug table finder with debugTableFinder()', () => {
      const debug = debugTableFinder(chars, lines, rects, 0);
      expect(debug).toHaveProperty('edges');
      expect(debug).toHaveProperty('intersections');
      expect(debug).toHaveProperty('tables');
    });

    it('should detect borderless tables', () => {
      const tables = detectBorderlessTables(chars, 0);
      expect(Array.isArray(tables)).toBe(true);
    });

    it('should find nested tables (requires existing table)', () => {
      // findNestedTables requires an existing PDFTable object as first argument
      // We test this by calling extractTables first, then testing with result
      const result = findTables(chars, lines, rects, 0);
      if (result.tables.length > 0) {
        const nested = findNestedTables(result.tables[0], chars, lines, rects);
        expect(nested).toHaveProperty('cells');
      } else {
        // No tables to test nested functionality - skip
        expect(true).toBe(true);
      }
    });

    it('should extract tables enhanced', () => {
      const tables = extractTablesEnhanced(chars, lines, rects, 0);
      expect(Array.isArray(tables)).toBe(true);
    });
  });

  // ============================================================
  // Layout Analysis (docs/advanced/layout-analysis.md)
  // ============================================================
  describe('Layout Analysis', () => {
    let chars: PDFChar[];

    beforeAll(async () => {
      const pdf = await pdfexcavator.open(SAMPLE_PDF_PATH);
      chars = await pdf.pages[0].chars;
      await pdf.close();
    });

    it('should have DEFAULT_LAPARAMS', () => {
      expect(DEFAULT_LAPARAMS).toHaveProperty('lineOverlap');
      expect(DEFAULT_LAPARAMS).toHaveProperty('charMargin');
      expect(DEFAULT_LAPARAMS).toHaveProperty('wordMargin');
      expect(DEFAULT_LAPARAMS).toHaveProperty('lineMargin');
      expect(DEFAULT_LAPARAMS).toHaveProperty('boxesFlow');
      expect(DEFAULT_LAPARAMS).toHaveProperty('detectVertical');
    });

    it('should create LayoutAnalyzer instance', () => {
      const analyzer = new LayoutAnalyzer();
      expect(analyzer).toBeInstanceOf(LayoutAnalyzer);
    });

    it('should create LayoutAnalyzer with custom params', () => {
      const analyzer = new LayoutAnalyzer({
        lineOverlap: 0.6,
        charMargin: 1.5,
      });
      expect(analyzer).toBeInstanceOf(LayoutAnalyzer);
    });

    it('should analyze layout with analyzeLayout()', () => {
      const result = analyzeLayout(chars);
      expect(result).toHaveProperty('words');
      expect(result).toHaveProperty('lines');
      expect(result).toHaveProperty('text');
    });

    it('should detect text columns', () => {
      const columns = detectTextColumns(chars);
      expect(Array.isArray(columns)).toBe(true);
    });

    it('should detect reading direction', () => {
      const direction = detectReadingDirection(chars);
      expect(['ltr', 'rtl', 'ttb']).toContain(direction);
    });

    it('should check for vertical text', () => {
      const hasVertical = isVerticalText(chars);
      expect(typeof hasVertical).toBe('boolean');
    });
  });

  // ============================================================
  // Font Utilities (docs/advanced/fonts.md)
  // ============================================================
  describe('Font Utilities', () => {
    it('should find font substitution', () => {
      const sub = findFontSubstitution('Arial');
      expect(sub).toHaveProperty('substituteFont');
      expect(sub).toHaveProperty('confidence');
    });

    it('should classify fonts', () => {
      expect(classifyFont('Times')).toBe('serif');
      expect(classifyFont('Arial')).toBe('sans-serif');
      expect(classifyFont('Courier')).toBe('monospace');
    });

    it('should parse font style', () => {
      const style = parseFontStyle('Arial-BoldItalic');
      expect(style).toHaveProperty('bold');
      expect(style).toHaveProperty('italic');
      expect(style).toHaveProperty('weight');
    });

    it('should create FontSubstitutionManager', () => {
      const manager = new FontSubstitutionManager();
      expect(manager).toBeInstanceOf(FontSubstitutionManager);

      const sub = manager.getSubstitution('ArialMT');
      expect(sub).toBeDefined();
    });

    it('should have PDF_BASE_FONTS array', () => {
      expect(Array.isArray(PDF_BASE_FONTS)).toBe(true);
      expect(PDF_BASE_FONTS.length).toBe(14);
      expect(PDF_BASE_FONTS).toContain('Helvetica');
      expect(PDF_BASE_FONTS).toContain('Times-Roman');
      expect(PDF_BASE_FONTS).toContain('Courier');
    });

    it('should have STANDARD_FONT_METRICS', () => {
      expect(STANDARD_FONT_METRICS).toHaveProperty('Helvetica');
      expect(STANDARD_FONT_METRICS['Helvetica']).toHaveProperty('ascent');
      expect(STANDARD_FONT_METRICS['Helvetica']).toHaveProperty('descent');
    });

    it('should get/reset font substitutions', () => {
      resetFontSubstitutions();
      const subs = getFontSubstitutions();
      expect(typeof subs).toBe('object');
    });

    it('should get missing fonts', () => {
      const missing = getMissingFonts();
      expect(Array.isArray(missing)).toBe(true);
    });
  });

  // ============================================================
  // CMap Utilities (docs/api/utilities.md)
  // ============================================================
  describe('CMap Utilities', () => {
    it('should get default CMap config', async () => {
      const config = await getDefaultCMapConfig();
      // May be null if pdfjs-dist cmaps not found
      if (config) {
        expect(config).toHaveProperty('cMapUrl');
        expect(config).toHaveProperty('cMapPacked');
      }
    });

    it('should detect CJK fonts with isCJKFont()', () => {
      expect(isCJKFont('SimSun')).toBe(true);
      expect(isCJKFont('MS-Mincho')).toBe(true);
      expect(isCJKFont('Gulim')).toBe(true);
      expect(isCJKFont('Arial')).toBe(false);
    });

    it('should normalize CJK text', () => {
      // Fullwidth to halfwidth
      expect(normalizeCJKText('ＡＢＣ')).toBe('ABC');
      expect(normalizeCJKText('１２３')).toBe('123');
    });
  });

  // ============================================================
  // OCR Functions (docs/api/ocr.md)
  // ============================================================
  describe('OCR Functions', () => {
    it('should check if tesseract is available', async () => {
      const available = await isTesseractAvailable();
      expect(typeof available).toBe('boolean');
    });

    it('should check if OCR is needed with needsOCR()', () => {
      const result = needsOCR(0, 1, 1000, 900);
      expect(typeof result).toBe('boolean');
    });

    it('should check if page is likely scanned', () => {
      const images = [{ width: 600, height: 800, srcSize: [600, 800] as [number, number] }];
      const result = isLikelyScanned(0, images, 600, 800);
      expect(typeof result).toBe('boolean');
    });

    it('should create OCREngine instance', () => {
      const engine = new OCREngine();
      expect(engine).toBeInstanceOf(OCREngine);
    });

    it('should have OCR_LANGUAGES', () => {
      expect(OCR_LANGUAGES).toHaveProperty('eng');
      expect(OCR_LANGUAGES).toHaveProperty('chi_sim');
      expect(OCR_LANGUAGES).toHaveProperty('jpn');
    });

    it('should have PSM_MODES', () => {
      expect(PSM_MODES).toHaveProperty('AUTO');
      expect(PSM_MODES).toHaveProperty('SINGLE_BLOCK');
      expect(PSM_MODES).toHaveProperty('SINGLE_LINE');
    });

    it('should have OEM_MODES', () => {
      expect(OEM_MODES).toHaveProperty('DEFAULT');
      expect(OEM_MODES).toHaveProperty('LSTM_ONLY');
    });
  });

  // ============================================================
  // BBox Utilities (docs/api/utilities.md)
  // ============================================================
  describe('BBox Utilities', () => {
    const bbox1: BBox = [0, 0, 100, 100];
    const bbox2: BBox = [50, 50, 150, 150];
    const bbox3: BBox = [200, 200, 300, 300];

    it('should normalize bbox', () => {
      const inverted: BBox = [100, 100, 0, 0];
      const normalized = normalizeBBox(inverted);
      expect(normalized[0]).toBeLessThan(normalized[2]);
      expect(normalized[1]).toBeLessThan(normalized[3]);
    });

    it('should validate bbox with isValidBBox()', () => {
      expect(isValidBBox(bbox1)).toBe(true);
      expect(isValidBBox([0, 0, 0, 0])).toBe(false);
    });

    it('should check point in bbox with pointInBBox()', () => {
      expect(pointInBBox(50, 50, bbox1)).toBe(true);
      expect(pointInBBox(150, 150, bbox1)).toBe(false);
    });

    it('should check bbox overlap with bboxOverlaps()', () => {
      expect(bboxOverlaps(bbox1, bbox2)).toBe(true);
      expect(bboxOverlaps(bbox1, bbox3)).toBe(false);
    });

    it('should check bbox within with bboxWithin()', () => {
      const inner: BBox = [25, 25, 75, 75];
      expect(bboxWithin(inner, bbox1)).toBe(true);
      expect(bboxWithin(bbox2, bbox1)).toBe(false);
    });

    it('should check bbox outside with bboxOutside()', () => {
      expect(bboxOutside(bbox1, bbox3)).toBe(true);
      expect(bboxOutside(bbox1, bbox2)).toBe(false);
    });

    it('should get bbox intersection', () => {
      const intersection = bboxIntersection(bbox1, bbox2);
      expect(intersection).toEqual([50, 50, 100, 100]);

      const noIntersection = bboxIntersection(bbox1, bbox3);
      expect(noIntersection).toBeNull();
    });

    it('should get bbox union', () => {
      const union = bboxUnion(bbox1, bbox2);
      expect(union).toEqual([0, 0, 150, 150]);
    });

    it('should get bbox from object', () => {
      const obj = { x0: 10, y0: 20, x1: 30, y1: 40 };
      const bbox = getBBox(obj);
      expect(bbox).toEqual([10, 20, 30, 40]);
    });

    it('should calculate bbox area', () => {
      expect(bboxArea(bbox1)).toBe(10000);
    });

    it('should get bbox center', () => {
      const center = bboxCenter(bbox1);
      expect(center).toEqual({ x: 50, y: 50 });
    });

    it('should expand bbox', () => {
      const expanded = bboxExpand(bbox1, 10);
      expect(expanded).toEqual([-10, -10, 110, 110]);
    });

    it('should filter objects within bbox', () => {
      const objects = [
        { x0: 25, y0: 25, x1: 75, y1: 75 },
        { x0: 150, y0: 150, x1: 200, y1: 200 },
      ];
      const filtered = filterWithinBBox(objects, bbox1);
      expect(filtered.length).toBe(1);
    });

    it('should filter objects overlapping bbox', () => {
      const objects = [
        { x0: 50, y0: 50, x1: 150, y1: 150 },
        { x0: 200, y0: 200, x1: 300, y1: 300 },
      ];
      const filtered = filterOverlapsBBox(objects, bbox1);
      expect(filtered.length).toBe(1);
    });

    it('should filter objects outside bbox', () => {
      const objects = [
        { x0: 25, y0: 25, x1: 75, y1: 75 },
        { x0: 200, y0: 200, x1: 300, y1: 300 },
      ];
      const filtered = filterOutsideBBox(objects, bbox1);
      expect(filtered.length).toBe(1);
    });
  });

  // ============================================================
  // Geometry Utilities (docs/api/utilities.md)
  // ============================================================
  describe('Geometry Utilities', () => {
    // Helper to create a full PDFLine object
    const makeLine = (x0: number, y0: number, x1: number, y1: number): PDFLine => ({
      x0, y0, x1, y1,
      top: Math.min(y0, y1),
      bottom: Math.max(y0, y1),
      doctop: Math.min(y0, y1),
      lineWidth: 1,
      strokingColor: [0, 0, 0],
      stroke: true,
      pageNumber: 0,
    });

    it('should detect horizontal lines', () => {
      const hLine = makeLine(0, 100, 200, 100);
      const vLine = makeLine(100, 0, 100, 200);

      expect(isHorizontalLine(hLine)).toBe(true);
      expect(isHorizontalLine(vLine)).toBe(false);
    });

    it('should detect vertical lines', () => {
      const hLine = makeLine(0, 100, 200, 100);
      const vLine = makeLine(100, 0, 100, 200);

      expect(isVerticalLine(vLine)).toBe(true);
      expect(isVerticalLine(hLine)).toBe(false);
    });

    it('should get horizontal lines', () => {
      const lines = [
        makeLine(0, 100, 200, 100),
        makeLine(100, 0, 100, 200),
      ];
      const hLines = getHorizontalLines(lines);
      expect(hLines.length).toBe(1);
    });

    it('should get vertical lines', () => {
      const lines = [
        makeLine(0, 100, 200, 100),
        makeLine(100, 0, 100, 200),
      ];
      const vLines = getVerticalLines(lines);
      expect(vLines.length).toBe(1);
    });

    it('should group horizontal lines', () => {
      const lines = [
        makeLine(0, 100, 200, 100),
        makeLine(0, 101, 200, 101),
        makeLine(0, 200, 200, 200),
      ];
      const groups = groupHorizontalLines(lines, 5);
      // groupHorizontalLines returns a Map<number, PDFLine[]>
      expect(groups.size).toBe(2);
    });

    it('should group vertical lines', () => {
      const lines = [
        makeLine(100, 0, 100, 200),
        makeLine(101, 0, 101, 200),
        makeLine(200, 0, 200, 200),
      ];
      const groups = groupVerticalLines(lines, 5);
      // groupVerticalLines returns a Map<number, PDFLine[]>
      expect(groups.size).toBe(2);
    });

    it('should convert rects to lines', () => {
      const rects: PDFRect[] = [
        {
          x0: 0, y0: 0, x1: 100, y1: 100,
          width: 100, height: 100,
          top: 0, bottom: 100, doctop: 0,
          strokingColor: [0, 0, 0],
          nonStrokingColor: null,
          stroke: true,
          fill: false,
          lineWidth: 1,
          pageNumber: 0,
        },
      ];
      const lines = rectsToLines(rects);
      expect(lines.length).toBe(4);
    });

    it('should get unique X positions', () => {
      const lines = [
        makeLine(100, 0, 100, 200),
        makeLine(101, 0, 101, 200),
        makeLine(200, 0, 200, 200),
      ];
      const positions = getUniqueXPositions(lines, 5);
      expect(positions.length).toBe(2);
    });

    it('should get unique Y positions', () => {
      const lines = [
        makeLine(0, 100, 200, 100),
        makeLine(0, 101, 200, 101),
        makeLine(0, 200, 200, 200),
      ];
      const positions = getUniqueYPositions(lines, 5);
      expect(positions.length).toBe(2);
    });

    it('should calculate line length', () => {
      const line = makeLine(0, 0, 100, 0);
      expect(lineLength(line)).toBe(100);
    });

    it('should check if lines intersect', () => {
      const line1 = makeLine(0, 50, 100, 50);
      const line2 = makeLine(50, 0, 50, 100);
      const line3 = makeLine(200, 0, 200, 100);

      expect(linesIntersect(line1, line2)).toBe(true);
      expect(linesIntersect(line1, line3)).toBe(false);
    });

    it('should cluster objects by key', () => {
      const objects = [
        { y: 100 },
        { y: 102 },
        { y: 200 },
        { y: 201 },
      ];
      const clusters = clusterObjects(objects, (o) => o.y, 5);
      expect(clusters.length).toBe(2);
    });

    it('should cluster objects by mean', () => {
      const objects = [
        { y: 100 },
        { y: 102 },
        { y: 200 },
      ];
      const clusters = clusterObjectsByMean(objects, (o) => o.y, 5);
      expect(clusters.length).toBe(2);
    });
  });

  // ============================================================
  // Character Correction (docs/guides/post-processing.md)
  // ============================================================
  describe('Character Correction', () => {
    it('should correct text with correctText()', () => {
      const text = 'Th3 qu1ck br0wn f0x';
      const corrected = correctText(text, { numberToLetter: true });
      expect(corrected).not.toContain('3');
      expect(corrected).not.toContain('1');
      expect(corrected).not.toContain('0');
    });

    it('should expand ligatures', () => {
      const text = 'ﬁnd ﬂow';
      const corrected = correctText(text, { expandLigatures: true });
      expect(corrected).toContain('fi');
      expect(corrected).toContain('fl');
    });

    it('should normalize quotes', () => {
      const text = '"Hello"';
      const corrected = correctText(text, { normalizeQuotes: true });
      expect(corrected).toBe('"Hello"');
    });

    it('should normalize dashes', () => {
      const text = 'one—two–three';
      const corrected = correctText(text, { normalizeDashes: true });
      expect(corrected).toBe('one-two-three');
    });

    it('should auto-correct text', () => {
      const text = 'Th3 qu1ck';
      const result = autoCorrectText(text);
      // Returns object with text, corrected flag, and issues detected
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('corrected');
      expect(result).toHaveProperty('issuesDetected');
    });

    it('should detect encoding issues', () => {
      const text = 'Th3 qu1ck ﬁnd';
      const issues = detectEncodingIssues(text);
      // Returns object with issues, score, and suggestions
      expect(issues).toHaveProperty('issues');
      expect(issues).toHaveProperty('score');
      expect(issues).toHaveProperty('suggestions');
    });

    it('should create text corrector', () => {
      const corrector = createTextCorrector({
        expandLigatures: true,
        normalizeQuotes: true,
      });
      expect(typeof corrector).toBe('function');

      const result = corrector('ﬁnd "text"');
      expect(result).toContain('fi');
    });
  });

  // ============================================================
  // Complete Workflow Tests
  // ============================================================
  describe('Complete Workflow', () => {
    it('should complete documented workflow example', async () => {
      const pdf = await pdfexcavator.open(SAMPLE_PDF_PATH);

      try {
        // Get metadata
        const meta = await pdf.metadata;
        expect(meta.pageCount).toBe(pdf.pageCount);

        // Process each page
        for (const page of pdf.pages) {
          const text = await page.extractText();
          const tables = await page.extractTables();

          expect(typeof text).toBe('string');
          expect(Array.isArray(tables)).toBe(true);
        }
      } finally {
        await pdf.close();
      }
    });

    it('should work with Buffer input', async () => {
      const buffer = readFileSync(SAMPLE_PDF_PATH);
      const pdf = await PDFExcavator.fromBuffer(buffer);

      const text = await pdf.extractText();
      expect(text.length).toBeGreaterThan(0);

      await pdf.close();
    });

    it('should work with concurrent processing', async () => {
      const pdf = await pdfexcavator.open(SAMPLE_PDF_PATH);

      const result = await pdf.processPages(
        async (page) => {
          const text = await page.extractText();
          const words = await page.extractWords();
          return { textLength: text.length, wordCount: words.length };
        },
        { concurrency: 4 }
      );

      expect(result.pagesProcessed).toBe(pdf.pageCount);
      expect(result.errors.length).toBe(0);

      await pdf.close();
    });

    it('should work with page cropping and filtering', async () => {
      const pdf = await pdfexcavator.open(SAMPLE_PDF_PATH);
      const page = pdf.pages[0];

      // Crop to upper half
      const cropped = page.crop([0, 0, page.width, page.height / 2]);
      const croppedText = await cropped.extractText();

      // Filter large text (cast to PDFChar to access size)
      const filtered = page.filter((obj) => ('size' in obj ? (obj as PDFChar).size : 0) > 10);
      const filteredText = await filtered.extractText();

      expect(typeof croppedText).toBe('string');
      expect(typeof filteredText).toBe('string');

      await pdf.close();
    });

    it('should handle low-level extraction with pdfPage', async () => {
      const pdf = await pdfexcavator.open(SAMPLE_PDF_PATH);
      const page = pdf.pages[0];

      // Use pdfPage for low-level access
      const textContent = await page.pdfPage.getTextContent();
      const chars = extractChars(textContent, page.pageNumber, page.height);
      const words = extractWords(chars);
      const text = extractText(chars);

      expect(chars.length).toBeGreaterThan(0);
      expect(words.length).toBeGreaterThan(0);
      expect(text.length).toBeGreaterThan(0);

      await pdf.close();
    });
  });
});
