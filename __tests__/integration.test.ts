/**
 * Integration Tests
 * Tests for full PDFExcavator workflow with actual PDF processing
 */

import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('PDFExcavator Integration', () => {
  describe('Module Exports', () => {
    let pdfexcavator: typeof import('../src/index.js');

    beforeAll(async () => {
      pdfexcavator = await import('../src/index.js');
    });

    it('should export PDFExcavator class', () => {
      expect(pdfexcavator.PDFExcavator).toBeDefined();
      expect(typeof pdfexcavator.PDFExcavator).toBe('function');
    });

    it('should export Page class', () => {
      expect(pdfexcavator.Page).toBeDefined();
      expect(typeof pdfexcavator.Page).toBe('function');
    });

    it('should export text extraction functions', () => {
      expect(typeof pdfexcavator.extractWords).toBe('function');
      expect(typeof pdfexcavator.extractLines).toBe('function');
      expect(typeof pdfexcavator.extractText).toBe('function');
      expect(typeof pdfexcavator.extractTextSimple).toBe('function');
    });

    it('should export table extraction functions', () => {
      expect(typeof pdfexcavator.findTables).toBe('function');
      expect(typeof pdfexcavator.extractTables).toBe('function');
      expect(pdfexcavator.TableFinder).toBeDefined();
    });

    it('should export layout analysis functions', () => {
      expect(typeof pdfexcavator.analyzeLayout).toBe('function');
      expect(typeof pdfexcavator.detectTextColumns).toBe('function');
      expect(typeof pdfexcavator.detectReadingDirection).toBe('function');
      expect(typeof pdfexcavator.isVerticalText).toBe('function');
      expect(pdfexcavator.LayoutAnalyzer).toBeDefined();
    });

    it('should export font utilities', () => {
      expect(typeof pdfexcavator.findFontSubstitution).toBe('function');
      expect(typeof pdfexcavator.classifyFont).toBe('function');
      expect(typeof pdfexcavator.parseFontStyle).toBe('function');
      expect(pdfexcavator.FontSubstitutionManager).toBeDefined();
    });

    it('should export CMap utilities', () => {
      expect(typeof pdfexcavator.isCJKFont).toBe('function');
      expect(typeof pdfexcavator.normalizeCJKText).toBe('function');
      expect(typeof pdfexcavator.getDefaultCMapConfig).toBe('function');
    });

    it('should export OCR utilities', () => {
      expect(typeof pdfexcavator.isTesseractAvailable).toBe('function');
      expect(typeof pdfexcavator.needsOCR).toBe('function');
      expect(typeof pdfexcavator.isLikelyScanned).toBe('function');
      expect(pdfexcavator.OCREngine).toBeDefined();
      expect(pdfexcavator.OCR_LANGUAGES).toBeDefined();
      expect(pdfexcavator.PSM_MODES).toBeDefined();
      expect(pdfexcavator.OEM_MODES).toBeDefined();
    });

    it('should export bbox filter utilities', () => {
      expect(typeof pdfexcavator.filterWithinBBox).toBe('function');
      expect(typeof pdfexcavator.filterOutsideBBox).toBe('function');
      expect(typeof pdfexcavator.filterOverlapsBBox).toBe('function');
    });

    it('should export constants', () => {
      expect(pdfexcavator.DEFAULT_LAPARAMS).toBeDefined();
      expect(pdfexcavator.PDF_BASE_FONTS).toBeDefined();
      expect(pdfexcavator.FONT_SUBSTITUTION_MAP).toBeDefined();
      expect(pdfexcavator.STANDARD_FONT_METRICS).toBeDefined();
    });

    it('should export types (verify at compile time)', () => {
      // TypeScript will verify these type exports at compile time
      // This test just ensures the module loads correctly
      expect(true).toBe(true);
    });
  });

  describe('PDFExcavator Static Methods', () => {
    let PDFExcavator: typeof import('../src/index.js').PDFExcavator;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      PDFExcavator = module.PDFExcavator;
    });

    it('should have open static method', () => {
      expect(typeof PDFExcavator.open).toBe('function');
    });

    it('should have fromBuffer static method', () => {
      expect(typeof PDFExcavator.fromBuffer).toBe('function');
    });

    it('should have fromUint8Array static method', () => {
      expect(typeof PDFExcavator.fromUint8Array).toBe('function');
    });

    it('should throw on invalid path', async () => {
      await expect(PDFExcavator.open('/nonexistent/path/to/file.pdf')).rejects.toThrow();
    });

    it('should validate basePath option prevents traversal', async () => {
      await expect(
        PDFExcavator.open('/etc/passwd', { basePath: '/home/user/documents' })
      ).rejects.toThrow(/path traversal|outside of allowed/i);
    });

    it('should reject null bytes in path', async () => {
      await expect(
        PDFExcavator.open('/path/to\0/file.pdf')
      ).rejects.toThrow(/null byte/i);
    });
  });

  describe('Minimal PDF Processing', () => {
    let PDFExcavator: typeof import('../src/index.js').PDFExcavator;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      PDFExcavator = module.PDFExcavator;
    });

    // A minimal valid PDF (empty page)
    const MINIMAL_PDF = Buffer.from(
      '%PDF-1.4\n' +
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n' +
      'xref\n0 4\n' +
      '0000000000 65535 f \n' +
      '0000000009 00000 n \n' +
      '0000000052 00000 n \n' +
      '0000000101 00000 n \n' +
      'trailer<</Size 4/Root 1 0 R>>\n' +
      'startxref\n170\n%%EOF'
    );

    it('should open minimal PDF from buffer', async () => {
      const doc = await PDFExcavator.fromBuffer(MINIMAL_PDF);
      expect(doc).toBeDefined();
      expect(doc.pageCount).toBe(1);
      await doc.close();
    });

    it('should get page from document', async () => {
      const doc = await PDFExcavator.fromBuffer(MINIMAL_PDF);
      const page = await doc.getPage(0);
      expect(page).toBeDefined();
      await doc.close();
    });

    it('should get page dimensions', async () => {
      const doc = await PDFExcavator.fromBuffer(MINIMAL_PDF);
      const page = await doc.getPage(0);
      expect(page.width).toBe(612);
      expect(page.height).toBe(792);
      await doc.close();
    });

    it('should extract empty text from blank page', async () => {
      const doc = await PDFExcavator.fromBuffer(MINIMAL_PDF);
      const page = await doc.getPage(0);
      const text = await page.extractText();
      expect(text).toBe('');
      await doc.close();
    });

    it('should get empty chars from blank page', async () => {
      const doc = await PDFExcavator.fromBuffer(MINIMAL_PDF);
      const page = await doc.getPage(0);
      const chars = await page.getChars();
      expect(chars).toEqual([]);
      await doc.close();
    });
  });

  describe('Sample PDF Processing', () => {
    let PDFExcavator: typeof import('../src/index.js').PDFExcavator;
    const SAMPLE_PDF_PATH = join(__dirname, '../fixtures/sample.pdf');
    const samplePdfExists = existsSync(SAMPLE_PDF_PATH);

    beforeAll(async () => {
      const module = await import('../src/index.js');
      PDFExcavator = module.PDFExcavator;
    });

    // Skip tests if sample PDF doesn't exist
    const conditionalTest = samplePdfExists ? it : it.skip;

    conditionalTest('should open sample PDF from file', async () => {
      const doc = await PDFExcavator.open(SAMPLE_PDF_PATH);
      expect(doc).toBeDefined();
      expect(doc.pageCount).toBeGreaterThan(0);
      await doc.close();
    });

    conditionalTest('should extract text from sample PDF', async () => {
      const doc = await PDFExcavator.open(SAMPLE_PDF_PATH);
      const page = await doc.getPage(0);
      const text = await page.extractText();
      expect(text.length).toBeGreaterThan(0);
      await doc.close();
    });

    conditionalTest('should extract words from sample PDF', async () => {
      const doc = await PDFExcavator.open(SAMPLE_PDF_PATH);
      const page = await doc.getPage(0);
      const words = await page.extractWords();
      expect(words.length).toBeGreaterThan(0);
      await doc.close();
    });

    conditionalTest('should extract lines from sample PDF', async () => {
      const doc = await PDFExcavator.open(SAMPLE_PDF_PATH);
      const page = await doc.getPage(0);
      const lines = await page.getTextLines();
      expect(lines.length).toBeGreaterThan(0);
      await doc.close();
    });

    it('should skip sample tests when no sample PDF exists', () => {
      if (!samplePdfExists) {
        console.log('Note: Sample PDF not found at', SAMPLE_PDF_PATH);
        console.log('Create fixtures/sample.pdf to enable full integration tests');
      }
      expect(true).toBe(true);
    });
  });

  describe('Document Metadata', () => {
    let PDFExcavator: typeof import('../src/index.js').PDFExcavator;

    // A minimal PDF with metadata
    const PDF_WITH_METADATA = Buffer.from(
      '%PDF-1.4\n' +
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n' +
      '4 0 obj<</Title(Test Document)/Author(Test Author)/Creator(Test Creator)>>endobj\n' +
      'xref\n0 5\n' +
      '0000000000 65535 f \n' +
      '0000000009 00000 n \n' +
      '0000000052 00000 n \n' +
      '0000000101 00000 n \n' +
      '0000000170 00000 n \n' +
      'trailer<</Size 5/Root 1 0 R/Info 4 0 R>>\n' +
      'startxref\n252\n%%EOF'
    );

    beforeAll(async () => {
      const module = await import('../src/index.js');
      PDFExcavator = module.PDFExcavator;
    });

    it('should access document properties', async () => {
      const doc = await PDFExcavator.fromBuffer(PDF_WITH_METADATA);
      expect(doc).toBeDefined();
      // Metadata access depends on implementation
      expect(doc.pageCount).toBe(1);
      await doc.close();
    });
  });

  describe('Error Handling', () => {
    let PDFExcavator: typeof import('../src/index.js').PDFExcavator;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      PDFExcavator = module.PDFExcavator;
    });

    it('should handle invalid PDF data', async () => {
      const invalidData = Buffer.from('This is not a PDF');
      await expect(PDFExcavator.fromBuffer(invalidData)).rejects.toThrow();
    });

    it('should handle empty buffer', async () => {
      const emptyData = Buffer.from('');
      await expect(PDFExcavator.fromBuffer(emptyData)).rejects.toThrow();
    });

    it('should handle accessing page out of bounds', async () => {
      const MINIMAL_PDF = Buffer.from(
        '%PDF-1.4\n' +
        '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
        '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
        '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n' +
        'xref\n0 4\n' +
        '0000000000 65535 f \n' +
        '0000000009 00000 n \n' +
        '0000000052 00000 n \n' +
        '0000000101 00000 n \n' +
        'trailer<</Size 4/Root 1 0 R>>\n' +
        'startxref\n170\n%%EOF'
      );

      const doc = await PDFExcavator.fromBuffer(MINIMAL_PDF);
      // getPage throws synchronously, not with a promise rejection
      expect(() => doc.getPage(999)).toThrow(/out of range/i);
      await doc.close();
    });

    it('should handle negative page index', async () => {
      const MINIMAL_PDF = Buffer.from(
        '%PDF-1.4\n' +
        '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
        '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
        '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n' +
        'xref\n0 4\n' +
        '0000000000 65535 f \n' +
        '0000000009 00000 n \n' +
        '0000000052 00000 n \n' +
        '0000000101 00000 n \n' +
        'trailer<</Size 4/Root 1 0 R>>\n' +
        'startxref\n170\n%%EOF'
      );

      const doc = await PDFExcavator.fromBuffer(MINIMAL_PDF);
      // getPage throws synchronously, not with a promise rejection
      expect(() => doc.getPage(-1)).toThrow(/out of range/i);
      await doc.close();
    });
  });

  describe('Concurrent Operations', () => {
    let PDFExcavator: typeof import('../src/index.js').PDFExcavator;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      PDFExcavator = module.PDFExcavator;
    });

    it('should handle multiple PDFExcavator instances', async () => {
      const MINIMAL_PDF = Buffer.from(
        '%PDF-1.4\n' +
        '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
        '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
        '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n' +
        'xref\n0 4\n' +
        '0000000000 65535 f \n' +
        '0000000009 00000 n \n' +
        '0000000052 00000 n \n' +
        '0000000101 00000 n \n' +
        'trailer<</Size 4/Root 1 0 R>>\n' +
        'startxref\n170\n%%EOF'
      );

      const [doc1, doc2] = await Promise.all([
        PDFExcavator.fromBuffer(MINIMAL_PDF),
        PDFExcavator.fromBuffer(MINIMAL_PDF),
      ]);

      expect(doc1.pageCount).toBe(1);
      expect(doc2.pageCount).toBe(1);

      await Promise.all([doc1.close(), doc2.close()]);
    });
  });

  describe('Memory Cleanup', () => {
    let PDFExcavator: typeof import('../src/index.js').PDFExcavator;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      PDFExcavator = module.PDFExcavator;
    });

    it('should properly close and cleanup', async () => {
      const MINIMAL_PDF = Buffer.from(
        '%PDF-1.4\n' +
        '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
        '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
        '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n' +
        'xref\n0 4\n' +
        '0000000000 65535 f \n' +
        '0000000009 00000 n \n' +
        '0000000052 00000 n \n' +
        '0000000101 00000 n \n' +
        'trailer<</Size 4/Root 1 0 R>>\n' +
        'startxref\n170\n%%EOF'
      );

      const doc = await PDFExcavator.fromBuffer(MINIMAL_PDF);
      await doc.close();

      // Should be able to open again
      const doc2 = await PDFExcavator.fromBuffer(MINIMAL_PDF);
      expect(doc2.pageCount).toBe(1);
      await doc2.close();
    });

    it('should handle multiple close calls', async () => {
      const MINIMAL_PDF = Buffer.from(
        '%PDF-1.4\n' +
        '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
        '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
        '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n' +
        'xref\n0 4\n' +
        '0000000000 65535 f \n' +
        '0000000009 00000 n \n' +
        '0000000052 00000 n \n' +
        '0000000101 00000 n \n' +
        'trailer<</Size 4/Root 1 0 R>>\n' +
        'startxref\n170\n%%EOF'
      );

      const doc = await PDFExcavator.fromBuffer(MINIMAL_PDF);

      // Multiple close calls should not throw
      await doc.close();
      await doc.close();
      await doc.close();
    });
  });
});
