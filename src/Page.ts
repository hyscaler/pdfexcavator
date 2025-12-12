/**
 * Page class - represents a single PDF page
 * Optimized with lazy loading and caching
 */

import type { PDFPageProxy } from 'pdfjs-dist';
import type {
  BBox,
  Color,
  CropOptions,
  DrawOptions,
  FilterFn,
  PageInfo,
  PDFAnnotation,
  PDFChar,
  PDFCurve,
  PDFHyperlink,
  PDFImage,
  PDFLine,
  PDFObject,
  PDFRect,
  PDFTable,
  PDFTextLine,
  PDFWord,
  RenderOptions,
  TableExtractionOptions,
  TableFinderResult,
  TextExtractionOptions,
  WordExtractionOptions,
} from './types.js';
import {
  extractChars,
  extractCharsWithFontMetrics,
  extractText,
  extractTextSimple,
  extractTextFromItems,
  extractLines,
  extractWords,
} from './extractors/text.js';
import { extractCharsWithColors } from './extractors/chars.js';
import { clearFontCache } from './extractors/fonts.js';
import {
  LayoutAnalyzer,
  analyzeLayout,
  detectTextColumns as layoutDetectColumns,
  detectReadingDirection,
  isVerticalText,
  DEFAULT_LAPARAMS,
} from './extractors/layout.js';
import type { LayoutParams } from './types.js';
import { extractTables, findTables, debugTableFinder, TableFinder } from './extractors/table.js';
import {
  extractStructureTree,
  sortCharsByReadingOrder,
  sortCharsByColumnOrder,
  detectColumns,
  type StructureElement,
} from './extractors/structure.js';
import { PageImage, createPageImage } from './PageImage.js';
import {
  filterWithinBBox,
  filterOutsideBBox,
  filterOverlapsBBox,
} from './utils/bbox.js';
import {
  performOCR,
  needsOCR,
  isLikelyScanned,
  isTesseractAvailable,
  OCREngine,
  type OCROptions,
  type OCRResult,
} from './utils/ocr.js';

/**
 * Escape special regex characters in a string to prevent ReDoS attacks
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Page class with lazy loading and caching for optimal performance
 */
export class Page {
  private _page: PDFPageProxy;
  private _pageNumber: number;
  private _width: number;
  private _height: number;
  private _rotation: number;
  private _doctopOffset: number;
  private _unicodeNorm?: 'NFC' | 'NFD' | 'NFKC' | 'NFKD' | null;

  // Lazy-loaded cached data
  private _chars: PDFChar[] | null = null;
  private _lines: PDFLine[] | null = null;
  private _rects: PDFRect[] | null = null;
  private _curves: PDFCurve[] | null = null;
  private _images: PDFImage[] | null = null;
  private _annots: PDFAnnotation[] | null = null;
  private _operatorList: { fnArray: number[]; argsArray: any[] } | null = null;

  // Cropping bounds (null means full page)
  private _cropBBox: BBox | null = null;

  // Whether to use strict filtering (entirely within vs overlapping)
  private _strict: boolean = false;

  // Parent reference for cropped pages
  private _parentPage: Page | null = null;

  constructor(
    page: PDFPageProxy,
    pageNumber: number,
    doctopOffset: number = 0,
    unicodeNorm?: 'NFC' | 'NFD' | 'NFKC' | 'NFKD' | null
  ) {
    this._page = page;
    this._pageNumber = pageNumber;
    this._doctopOffset = doctopOffset;
    this._unicodeNorm = unicodeNorm;

    const viewport = page.getViewport({ scale: 1 });
    this._width = viewport.width;
    this._height = viewport.height;
    this._rotation = page.rotate;
  }

  // ============ Properties ============

  /** Page number (0-indexed) */
  get pageNumber(): number {
    return this._pageNumber;
  }

  /** Page width in points */
  get width(): number {
    return this._width;
  }

  /** Page height in points */
  get height(): number {
    return this._height;
  }

  /** Page rotation in degrees */
  get rotation(): number {
    return this._rotation;
  }

  /**
   * Access to underlying pdf.js PDFPageProxy for advanced use cases.
   * Use this with low-level extraction functions like extractCharsWithPrecision.
   */
  get pdfPage(): PDFPageProxy {
    return this._page;
  }

  /** Page bounding box */
  get bbox(): BBox {
    return this._cropBBox || [0, 0, this._width, this._height];
  }

  /** Get page info */
  get info(): PageInfo {
    return {
      pageNumber: this._pageNumber,
      width: this._width,
      height: this._height,
      rotation: this._rotation,
      mediaBox: [0, 0, this._width, this._height],
      cropBox: this._cropBBox || [0, 0, this._width, this._height],
    };
  }

  // ============ Character Access ============

  /**
   * Remove duplicate characters (common in OCR'd PDFs)
   * Characters are considered duplicates if they have the same text
   * and are at approximately the same position
   */
  async dedupeChars(tolerance: number = 1): Promise<Page> {
    const chars = await this.getChars();
    const seen = new Set<string>();
    const uniqueChars: PDFChar[] = [];

    for (const char of chars) {
      // Create a key based on position (rounded to tolerance) and text
      const key = `${char.text}:${Math.round(char.x0 / tolerance)}:${Math.round(char.y0 / tolerance)}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueChars.push(char);
      }
    }

    // Create a new page instance with deduped chars
    const dedupedPage = new Page(
      this._page,
      this._pageNumber,
      this._doctopOffset,
      this._unicodeNorm
    );
    dedupedPage._chars = uniqueChars;
    dedupedPage._parentPage = this._parentPage || this;
    dedupedPage._cropBBox = this._cropBBox;

    return dedupedPage;
  }

  /**
   * Get all characters on the page (lazy loaded, cached)
   * @param options.colors If true, extract character colors (slightly slower)
   * @param options.fontMetrics If true, use font metrics for accurate character widths
   */
  async getChars(options?: { colors?: boolean; fontMetrics?: boolean }): Promise<PDFChar[]> {
    // If this is a cropped page, get from parent and filter
    if (this._parentPage) {
      const parentChars = await this._parentPage.getChars(options);
      if (this._cropBBox) {
        return this._strict
          ? filterWithinBBox(parentChars, this._cropBBox)
          : filterOverlapsBBox(parentChars, this._cropBBox);
      }
      return parentChars;
    }

    // Lazy load and cache
    if (this._chars === null) {
      if (options?.colors) {
        // Use enhanced extraction with colors
        this._chars = await extractCharsWithColors(
          this._page,
          this._pageNumber,
          this._height,
          this._doctopOffset,
          this._unicodeNorm
        );
      } else if (options?.fontMetrics) {
        // Use font metrics for accurate character positioning
        const textContent = await this._page.getTextContent();
        this._chars = await extractCharsWithFontMetrics(
          this._page,
          textContent,
          this._pageNumber,
          this._height,
          this._doctopOffset,
          this._unicodeNorm
        );
      } else {
        // Use fast extraction without colors
        const textContent = await this._page.getTextContent();
        this._chars = extractChars(
          textContent,
          this._pageNumber,
          this._height,
          this._doctopOffset,
          this._unicodeNorm
        );
      }
    }

    if (this._cropBBox) {
      return this._strict
        ? filterWithinBBox(this._chars, this._cropBBox)
        : filterOverlapsBBox(this._chars, this._cropBBox);
    }

    return this._chars;
  }

  /** Alias for getChars() */
  get chars(): Promise<PDFChar[]> {
    return this.getChars();
  }

  // ============ Text Extraction ============

  /** Get text lines */
  async getTextLines(yTolerance?: number): Promise<PDFTextLine[]> {
    const chars = await this.getChars();
    return extractLines(chars, yTolerance);
  }

  /** Extract text from the page */
  async extractText(options?: TextExtractionOptions): Promise<string> {
    const chars = await this.getChars();
    return extractText(chars, options);
  }

  /** Fast text extraction (less accurate but faster) */
  async extractTextSimple(xTolerance = 3, yTolerance = 3): Promise<string> {
    const chars = await this.getChars();
    return extractTextSimple(chars, xTolerance, yTolerance);
  }

  /**
   * Extract text preserving the original PDF text flow order.
   * This is ideal for OCR'd documents and multi-column layouts where
   * character-level extraction fails due to overlapping positions.
   *
   * Unlike other extraction methods that re-order characters by position,
   * this method preserves the order that text items appear in the PDF stream,
   * which often reflects the correct reading order for OCR'd documents.
   *
   * @param options Extraction options
   * @returns Extracted text in original PDF order
   */
  async extractTextRaw(options?: {
    detectLineBreaks?: boolean;
    lineBreakThreshold?: number;
    addSpaces?: boolean;
    spaceThreshold?: number;
  }): Promise<string> {
    const textContent = await this._page.getTextContent();
    return extractTextFromItems(textContent, options);
  }

  /** Extract words from the page */
  async extractWords(options?: WordExtractionOptions): Promise<PDFWord[]> {
    const chars = await this.getChars();
    return extractWords(chars, options);
  }

  // ============ Document Structure ============

  /**
   * Get the structure tree for this page (if available)
   * Tagged PDFs contain structure information for accessibility
   */
  async getStructureTree(): Promise<StructureElement | null> {
    return extractStructureTree(this._page);
  }

  /**
   * Get characters sorted by logical reading order
   * Uses PDF structure tree if available, falls back to visual order
   */
  async getCharsInReadingOrder(): Promise<PDFChar[]> {
    const chars = await this.getChars();
    return sortCharsByReadingOrder(this._page, chars);
  }

  /**
   * Extract text in logical reading order
   * Uses PDF structure tree if available, falls back to visual order
   */
  async extractTextInReadingOrder(options?: TextExtractionOptions): Promise<string> {
    const chars = await this.getCharsInReadingOrder();
    return extractText(chars, options);
  }

  /**
   * Detect text columns on the page
   * @param minGapRatio Minimum gap as ratio of page width to consider a column break
   * @returns Array of column boundaries
   */
  async detectColumns(minGapRatio: number = 0.05): Promise<Array<{ x0: number; x1: number }>> {
    const chars = await this.getChars();
    return detectColumns(chars, minGapRatio);
  }

  /**
   * Get characters sorted by column-aware order
   * For multi-column layouts, reads each column top-to-bottom before moving to next
   * @param columns Optional pre-defined column boundaries
   */
  async getCharsInColumnOrder(
    columns?: Array<{ x0: number; x1: number }>
  ): Promise<PDFChar[]> {
    const chars = await this.getChars();
    return sortCharsByColumnOrder(chars, columns);
  }

  /**
   * Extract text respecting column layout
   * For multi-column documents, reads columns in order
   * @param columns Optional pre-defined column boundaries
   */
  async extractTextByColumns(
    columns?: Array<{ x0: number; x1: number }>,
    options?: TextExtractionOptions
  ): Promise<string> {
    const chars = await this.getCharsInColumnOrder(columns);
    return extractText(chars, options);
  }

  // ============ LAParams Layout Analysis ============

  /**
   * Extract text using pdfminer-style LAParams for precise layout control
   * This provides more accurate text extraction for complex layouts
   * @param params Layout analysis parameters (lineOverlap, charMargin, wordMargin, etc.)
   */
  async extractTextWithLayout(params?: Partial<LayoutParams>): Promise<string> {
    const chars = await this.getChars();
    const analyzer = new LayoutAnalyzer(params);
    return analyzer.extractText(chars);
  }

  /**
   * Analyze text layout and get detailed structure
   * Returns words, lines, and extracted text using LAParams
   * @param params Layout analysis parameters
   */
  async analyzeLayout(params?: Partial<LayoutParams>): Promise<{
    words: PDFWord[];
    lines: PDFTextLine[];
    text: string;
  }> {
    const chars = await this.getChars();
    return analyzeLayout(chars, params);
  }

  /**
   * Get words using LAParams-based layout analysis
   * More accurate word detection than default extractWords
   * @param params Layout analysis parameters
   */
  async getWordsWithLayout(params?: Partial<LayoutParams>): Promise<PDFWord[]> {
    const chars = await this.getChars();
    const analyzer = new LayoutAnalyzer(params);
    return analyzer.analyzeCharsToWords(chars);
  }

  /**
   * Get text lines using LAParams-based layout analysis
   * More accurate line detection than default getTextLines
   * @param params Layout analysis parameters
   */
  async getLinesWithLayout(params?: Partial<LayoutParams>): Promise<PDFTextLine[]> {
    const chars = await this.getChars();
    const analyzer = new LayoutAnalyzer(params);
    return analyzer.analyzeCharsToLines(chars);
  }

  /**
   * Detect text columns using histogram-based analysis
   * @param minGapRatio Minimum gap as ratio of page width to be considered a column break
   */
  async detectTextColumns(minGapRatio: number = 0.03): Promise<Array<{ x0: number; x1: number }>> {
    const chars = await this.getChars();
    return layoutDetectColumns(chars, minGapRatio);
  }

  /**
   * Detect reading direction of text on the page
   * @returns 'ltr' | 'rtl' | 'ttb' | 'btt' (left-to-right, right-to-left, top-to-bottom, bottom-to-top)
   */
  async getReadingDirection(): Promise<'ltr' | 'rtl' | 'ttb' | 'btt'> {
    const chars = await this.getChars();
    return detectReadingDirection(chars);
  }

  /**
   * Check if the page contains primarily vertical text
   * Useful for detecting CJK vertical text layouts
   */
  async hasVerticalText(): Promise<boolean> {
    const chars = await this.getChars();
    return isVerticalText(chars);
  }

  /**
   * Get the default LAParams values
   */
  static getDefaultLAParams(): Required<LayoutParams> {
    return { ...DEFAULT_LAPARAMS };
  }

  // ============ OCR Integration ============

  /**
   * Check if Tesseract.js OCR is available
   */
  static async isOCRAvailable(): Promise<boolean> {
    return isTesseractAvailable();
  }

  /**
   * Check if this page likely needs OCR (scanned document detection)
   * A page needs OCR if it has images but little or no text
   */
  async needsOCR(): Promise<boolean> {
    const [chars, images] = await Promise.all([
      this.getChars(),
      this.getImages(),
    ]);

    const pageArea = this._width * this._height;
    let imageArea = 0;
    for (const img of images) {
      imageArea += img.width * img.height;
    }

    return needsOCR(chars.length, images.length, pageArea, imageArea);
  }

  /**
   * Check if this page appears to be a scanned document
   * Scanned pages have large full-page images with little or no text
   */
  async isScannedPage(): Promise<boolean> {
    const [chars, images] = await Promise.all([
      this.getChars(),
      this.getImages(),
    ]);

    return isLikelyScanned(chars.length, images, this._width, this._height);
  }

  /**
   * Perform OCR on the page
   * Renders the page to an image and extracts text using Tesseract.js
   * Requires both 'canvas' and 'tesseract.js' packages to be installed
   * @param options OCR options (lang, minConfidence, etc.)
   */
  async performOCR(options: OCROptions = {}): Promise<OCRResult> {
    // Check if Tesseract is available first
    const tesseractAvailable = await isTesseractAvailable();
    if (!tesseractAvailable) {
      throw new Error(
        'OCR requires tesseract.js package. Install it with: npm install tesseract.js'
      );
    }

    // Render page to image buffer (requires canvas)
    let pageImage;
    try {
      pageImage = await this.toImage({
        resolution: options.tesseractParams?.resolution
          ? parseInt(options.tesseractParams.resolution)
          : 300, // 300 DPI is good for OCR
      });
    } catch (error: any) {
      if (error.message?.includes('canvas')) {
        throw new Error(
          'OCR requires the canvas package for rendering. Install it with: npm install canvas'
        );
      }
      throw error;
    }

    const imageBuffer = await pageImage.toBuffer();

    return performOCR(
      imageBuffer,
      this._pageNumber,
      this._height,
      this._doctopOffset,
      options
    );
  }

  /**
   * Extract text with automatic OCR fallback
   * If the page has little or no text but has images, performs OCR automatically
   * @param textOptions Text extraction options
   * @param ocrOptions OCR options (used if OCR is needed)
   */
  async extractTextWithOCR(
    textOptions?: TextExtractionOptions,
    ocrOptions?: OCROptions
  ): Promise<string> {
    const chars = await this.getChars();

    // If there's substantial text, use normal extraction
    if (chars.length > 50) {
      return extractText(chars, textOptions);
    }

    // Check if OCR is available and needed
    const ocrAvailable = await isTesseractAvailable();
    if (!ocrAvailable) {
      // Fall back to normal extraction
      return extractText(chars, textOptions);
    }

    const shouldOCR = await this.needsOCR();
    if (!shouldOCR) {
      return extractText(chars, textOptions);
    }

    // Perform OCR
    try {
      const ocrResult = await this.performOCR(ocrOptions);
      return ocrResult.text;
    } catch (error) {
      // If OCR fails, fall back to normal extraction
      console.warn('OCR failed, falling back to embedded text:', error);
      return extractText(chars, textOptions);
    }
  }

  /**
   * Get characters with automatic OCR fallback
   * If the page has little or no text but has images, performs OCR automatically
   */
  async getCharsWithOCR(ocrOptions?: OCROptions): Promise<PDFChar[]> {
    const chars = await this.getChars();

    // If there's substantial text, use existing chars
    if (chars.length > 50) {
      return chars;
    }

    // Check if OCR is available and needed
    const ocrAvailable = await isTesseractAvailable();
    if (!ocrAvailable) {
      return chars;
    }

    const shouldOCR = await this.needsOCR();
    if (!shouldOCR) {
      return chars;
    }

    // Perform OCR
    try {
      const ocrResult = await this.performOCR(ocrOptions);
      // Combine existing chars with OCR chars
      return [...chars, ...ocrResult.chars];
    } catch {
      return chars;
    }
  }

  /**
   * Get words with automatic OCR fallback
   */
  async getWordsWithOCR(ocrOptions?: OCROptions): Promise<PDFWord[]> {
    const words = await this.extractWords();

    if (words.length > 10) {
      return words;
    }

    const ocrAvailable = await isTesseractAvailable();
    if (!ocrAvailable) {
      return words;
    }

    const shouldOCR = await this.needsOCR();
    if (!shouldOCR) {
      return words;
    }

    try {
      const ocrResult = await this.performOCR(ocrOptions);
      return [...words, ...ocrResult.words];
    } catch {
      return words;
    }
  }

  // ============ Graphical Elements ============

  /** Get line segments (graphical lines) - lazy loaded */
  async getLines(): Promise<PDFLine[]> {
    const filterLines = (lines: PDFLine[], bbox: BBox, strict: boolean): PDFLine[] => {
      return lines.filter((l) => {
        const lineBBox = { x0: Math.min(l.x0, l.x1), y0: Math.min(l.y0, l.y1), x1: Math.max(l.x0, l.x1), y1: Math.max(l.y0, l.y1) };
        if (strict) {
          return filterWithinBBox([lineBBox], bbox).length > 0;
        }
        return filterOverlapsBBox([lineBBox], bbox).length > 0;
      });
    };

    if (this._parentPage) {
      const parentLines = await this._parentPage.getLines();
      return this._cropBBox
        ? filterLines(parentLines, this._cropBBox, this._strict)
        : parentLines;
    }

    if (this._lines === null) {
      this._lines = await this.extractGraphics('lines');
    }

    if (this._cropBBox) {
      return filterLines(this._lines, this._cropBBox, this._strict);
    }

    return this._lines;
  }

  /** Alias for getLines() */
  get lines(): Promise<PDFLine[]> {
    return this.getLines();
  }

  /** Get rectangles - lazy loaded */
  async getRects(): Promise<PDFRect[]> {
    if (this._parentPage) {
      const parentRects = await this._parentPage.getRects();
      if (this._cropBBox) {
        return this._strict
          ? filterWithinBBox(parentRects, this._cropBBox)
          : filterOverlapsBBox(parentRects, this._cropBBox);
      }
      return parentRects;
    }

    if (this._rects === null) {
      this._rects = await this.extractGraphics('rects');
    }

    if (this._cropBBox) {
      return this._strict
        ? filterWithinBBox(this._rects, this._cropBBox)
        : filterOverlapsBBox(this._rects, this._cropBBox);
    }
    return this._rects;
  }

  /** Alias for getRects() */
  get rects(): Promise<PDFRect[]> {
    return this.getRects();
  }

  /** Get curves/paths - lazy loaded */
  async getCurves(): Promise<PDFCurve[]> {
    if (this._parentPage) {
      const parentCurves = await this._parentPage.getCurves();
      if (this._cropBBox) {
        return this._strict
          ? filterWithinBBox(parentCurves, this._cropBBox)
          : filterOverlapsBBox(parentCurves, this._cropBBox);
      }
      return parentCurves;
    }

    if (this._curves === null) {
      this._curves = await this.extractGraphics('curves');
    }

    if (this._cropBBox) {
      return this._strict
        ? filterWithinBBox(this._curves, this._cropBBox)
        : filterOverlapsBBox(this._curves, this._cropBBox);
    }
    return this._curves;
  }

  /** Alias for getCurves() */
  get curves(): Promise<PDFCurve[]> {
    return this.getCurves();
  }

  /** Get images - lazy loaded */
  async getImages(): Promise<PDFImage[]> {
    if (this._parentPage) {
      const parentImages = await this._parentPage.getImages();
      if (this._cropBBox) {
        return this._strict
          ? filterWithinBBox(parentImages, this._cropBBox)
          : filterOverlapsBBox(parentImages, this._cropBBox);
      }
      return parentImages;
    }

    if (this._images === null) {
      this._images = await this.extractImages();
    }

    if (this._cropBBox) {
      return this._strict
        ? filterWithinBBox(this._images, this._cropBBox)
        : filterOverlapsBBox(this._images, this._cropBBox);
    }
    return this._images;
  }

  /** Alias for getImages() */
  get images(): Promise<PDFImage[]> {
    return this.getImages();
  }

  /** Get annotations - lazy loaded */
  async getAnnotations(): Promise<PDFAnnotation[]> {
    if (this._parentPage) {
      const parentAnnots = await this._parentPage.getAnnotations();
      if (this._cropBBox) {
        return this._strict
          ? filterWithinBBox(parentAnnots, this._cropBBox)
          : filterOverlapsBBox(parentAnnots, this._cropBBox);
      }
      return parentAnnots;
    }

    if (this._annots === null) {
      this._annots = await this.extractAnnotations();
    }

    if (this._cropBBox) {
      return this._strict
        ? filterWithinBBox(this._annots, this._cropBBox)
        : filterOverlapsBBox(this._annots, this._cropBBox);
    }
    return this._annots;
  }

  /** Alias for getAnnotations() */
  get annots(): Promise<PDFAnnotation[]> {
    return this.getAnnotations();
  }

  /** Get hyperlinks */
  async getHyperlinks(): Promise<PDFHyperlink[]> {
    const annots = await this.getAnnotations();
    return annots
      .filter((a) => a.annotationType === 'Link' && (a.uri || a.destPageNumber !== undefined))
      .map((a) => ({
        x0: a.x0,
        y0: a.y0,
        x1: a.x1,
        y1: a.y1,
        uri: a.uri,
        destPageNumber: a.destPageNumber,
        pageNumber: a.pageNumber,
      }));
  }

  /** Alias for getHyperlinks() */
  get hyperlinks(): Promise<PDFHyperlink[]> {
    return this.getHyperlinks();
  }

  /** Get all objects combined */
  async getObjects(): Promise<PDFObject[]> {
    const [chars, lines, rects, curves, images, annots] = await Promise.all([
      this.getChars(),
      this.getLines(),
      this.getRects(),
      this.getCurves(),
      this.getImages(),
      this.getAnnotations(),
    ]);

    return [...chars, ...lines, ...rects, ...curves, ...images, ...annots];
  }

  /** Alias for getObjects() */
  get objects(): Promise<PDFObject[]> {
    return this.getObjects();
  }

  // ============ Derived Properties ============

  /** Get edges from rectangles */
  async getRectEdges(): Promise<PDFLine[]> {
    const rects = await this.getRects();
    const edges: PDFLine[] = [];

    for (const rect of rects) {
      if (!rect.stroke) continue;

      const baseProps = {
        lineWidth: rect.lineWidth,
        strokingColor: rect.strokingColor,
        stroke: true,
        pageNumber: rect.pageNumber,
      };

      // Top edge
      edges.push({
        x0: rect.x0, y0: rect.y0, x1: rect.x1, y1: rect.y0,
        top: rect.y0, bottom: rect.y0, doctop: rect.doctop,
        ...baseProps,
      });
      // Bottom edge
      edges.push({
        x0: rect.x0, y0: rect.y1, x1: rect.x1, y1: rect.y1,
        top: rect.y1, bottom: rect.y1, doctop: rect.doctop + rect.height,
        ...baseProps,
      });
      // Left edge
      edges.push({
        x0: rect.x0, y0: rect.y0, x1: rect.x0, y1: rect.y1,
        top: rect.y0, bottom: rect.y1, doctop: rect.doctop,
        ...baseProps,
      });
      // Right edge
      edges.push({
        x0: rect.x1, y0: rect.y0, x1: rect.x1, y1: rect.y1,
        top: rect.y0, bottom: rect.y1, doctop: rect.doctop,
        ...baseProps,
      });
    }

    return edges;
  }

  /** Alias for getRectEdges() */
  get rectEdges(): Promise<PDFLine[]> {
    return this.getRectEdges();
  }

  /** Get edges from curves (decompose curves to line segments) */
  async getCurveEdges(): Promise<PDFLine[]> {
    const curves = await this.getCurves();
    const edges: PDFLine[] = [];

    for (const curve of curves) {
      if (!curve.stroke) continue;
      if (curve.pts.length < 2) continue;

      // Create line segments between consecutive points
      for (let i = 0; i < curve.pts.length - 1; i++) {
        const [x0, y0] = curve.pts[i];
        const [x1, y1] = curve.pts[i + 1];

        edges.push({
          x0,
          y0,
          x1,
          y1,
          top: Math.min(y0, y1),
          bottom: Math.max(y0, y1),
          doctop: curve.doctop + Math.min(y0, y1) - curve.y0,
          lineWidth: curve.lineWidth,
          strokingColor: curve.strokingColor,
          stroke: true,
          pageNumber: curve.pageNumber,
        });
      }
    }

    return edges;
  }

  /** Alias for getCurveEdges() */
  get curveEdges(): Promise<PDFLine[]> {
    return this.getCurveEdges();
  }

  /** Get all edges (lines + rect edges + curve edges) */
  async getEdges(): Promise<PDFLine[]> {
    const [lines, rectEdges, curveEdges] = await Promise.all([
      this.getLines(),
      this.getRectEdges(),
      this.getCurveEdges(),
    ]);

    return [...lines, ...rectEdges, ...curveEdges];
  }

  /** Alias for getEdges() */
  get edges(): Promise<PDFLine[]> {
    return this.getEdges();
  }

  // ============ Table Extraction ============

  /** Extract tables from the page */
  async extractTables(options?: TableExtractionOptions): Promise<PDFTable[]> {
    const [chars, lines, rects] = await Promise.all([
      this.getChars(),
      this.getLines(),
      this.getRects(),
    ]);

    return extractTables(chars, lines, rects, this._pageNumber, options);
  }

  /** Extract a single table (first one found) */
  async extractTable(options?: TableExtractionOptions): Promise<PDFTable | null> {
    const tables = await this.extractTables(options);
    return tables[0] || null;
  }

  /** Find tables with debug information */
  async findTables(options?: TableExtractionOptions): Promise<TableFinderResult> {
    const [chars, lines, rects] = await Promise.all([
      this.getChars(),
      this.getLines(),
      this.getRects(),
    ]);

    return findTables(chars, lines, rects, this._pageNumber, options);
  }

  /** Debug table finder - visual debugging data */
  async debugTableFinder(options?: TableExtractionOptions): Promise<TableFinderResult> {
    const [chars, lines, rects] = await Promise.all([
      this.getChars(),
      this.getLines(),
      this.getRects(),
    ]);

    return debugTableFinder(chars, lines, rects, this._pageNumber, options);
  }

  // ============ Region Selection ============

  /**
   * Resolve a bounding box based on options
   * @param bbox The input bounding box
   * @param options Crop options (relative, strict)
   * @returns Resolved absolute bounding box
   */
  private resolveBBox(bbox: BBox, options: CropOptions = {}): BBox {
    const { relative = false } = options;

    if (relative && this._cropBBox) {
      // Convert relative coordinates to absolute
      const [cx0, cy0] = this._cropBBox;
      return [
        cx0 + bbox[0],
        cy0 + bbox[1],
        cx0 + bbox[2],
        cy0 + bbox[3],
      ];
    }

    return bbox;
  }

  /**
   * Crop the page to a bounding box
   * Returns a new Page instance limited to the cropped region
   * @param bbox Bounding box [x0, y0, x1, y1]
   * @param options.relative If true, coordinates are relative to current crop box
   * @param options.strict If true, only include objects entirely within bbox
   */
  crop(bbox: BBox, options: CropOptions = {}): Page {
    const resolvedBBox = this.resolveBBox(bbox, options);

    const cropped = new Page(
      this._page,
      this._pageNumber,
      this._doctopOffset,
      this._unicodeNorm
    );
    cropped._parentPage = this._parentPage || this;
    cropped._cropBBox = resolvedBBox;
    cropped._strict = options.strict ?? false;
    return cropped;
  }

  /**
   * Get objects within a bounding box (objects must be entirely within)
   * @param bbox Bounding box [x0, y0, x1, y1]
   * @param options.relative If true, coordinates are relative to current crop box
   * @param options.strict If true (default), only include objects entirely within bbox
   */
  withinBBox(bbox: BBox, options: CropOptions = {}): Page {
    return this.crop(bbox, { ...options, strict: options.strict ?? true });
  }

  /**
   * Get a page with objects outside a bounding box
   * @param bbox Bounding box to exclude
   * @param options.relative If true, coordinates are relative to current crop box
   * @param options.strict If true (default), exclude objects entirely within bbox only
   */
  outsideBBox(bbox: BBox, options: CropOptions = {}): OutsideBBoxPage {
    const resolvedBBox = this.resolveBBox(bbox, options);
    return new OutsideBBoxPage(this, resolvedBBox, options.strict ?? true);
  }

  /**
   * Filter objects by a custom function (utility method)
   */
  filterObjects<T extends PDFObject>(objects: T[], fn: FilterFn<T>): T[] {
    return objects.filter(fn);
  }

  /**
   * Create a filtered page that only includes objects matching the test function
   */
  filter(testFn: FilterFn<PDFObject>): FilteredPage {
    return new FilteredPage(this, testFn);
  }

  // ============ Search ============

  /**
   * Search for text on the page
   * @param pattern - String for literal search, or RegExp for pattern matching
   * @param options - Search options
   * @param options.literal - If true, treat string pattern as literal text (default: true for strings)
   */
  async search(
    pattern: string | RegExp,
    options: { literal?: boolean } = {}
  ): Promise<Array<{ text: string; x0: number; y0: number; x1: number; y1: number; chars: PDFChar[] }>> {
    const words = await this.extractWords();
    const results: Array<{ text: string; x0: number; y0: number; x1: number; y1: number; chars: PDFChar[] }> = [];

    let regex: RegExp;
    if (typeof pattern === 'string') {
      // Default to literal search for strings to prevent ReDoS
      const useLiteral = options.literal !== false;
      const safePattern = useLiteral ? escapeRegExp(pattern) : pattern;
      regex = new RegExp(safePattern, 'gi');
    } else {
      regex = pattern;
    }

    for (const word of words) {
      if (regex.test(word.text)) {
        results.push({
          text: word.text,
          x0: word.x0,
          y0: word.y0,
          x1: word.x1,
          y1: word.y1,
          chars: word.chars,
        });
      }
      // Reset regex state for global patterns
      regex.lastIndex = 0;
    }

    return results;
  }

  // ============ Visual Debugging ============

  /**
   * Render page to a PageImage object for visual debugging
   * Requires canvas support (node-canvas in Node.js)
   * @param options Render options (resolution, width, height, scale, etc.)
   * @returns PageImage object with drawing methods
   */
  async toImage(options: RenderOptions = {}): Promise<PageImage> {
    return createPageImage(this._page, this._height, options);
  }

  /**
   * Render page to a PNG buffer
   * Requires canvas support (node-canvas in Node.js)
   * @param options Render options
   * @returns PNG image buffer
   */
  async toBuffer(options: RenderOptions = {}): Promise<Buffer> {
    const pageImage = await this.toImage(options);
    return pageImage.toBuffer();
  }

  /**
   * Draw rectangles on page image for debugging
   * @deprecated Use toImage().drawRects() instead
   */
  async debugDraw(
    items: Array<{ x0: number; y0: number; x1: number; y1: number }>,
    options: DrawOptions & RenderOptions = {}
  ): Promise<Buffer> {
    const {
      stroke = 'red',
      fill,
      strokeWidth = 2,
      strokeOpacity = 1,
      fillOpacity = 0.3,
      ...renderOptions
    } = options;

    const pageImage = await this.toImage(renderOptions);
    pageImage.drawRects(items, {
      stroke,
      fill,
      strokeWidth,
      strokeOpacity,
      fillOpacity,
    });

    return pageImage.toBuffer();
  }

  // ============ Memory Management ============

  /**
   * Clear cached data to free memory
   */
  flush(): void {
    this._chars = null;
    this._lines = null;
    this._rects = null;
    this._curves = null;
    this._images = null;
    this._annots = null;
    this._operatorList = null;
    // Clear font cache for this page
    clearFontCache(this._page);
  }

  /**
   * Close the page (alias for flush)
   */
  close(): void {
    this.flush();
  }

  // ============ Private Methods ============

  /** Get cached operator list */
  private async getOperatorList(): Promise<{ fnArray: number[]; argsArray: any[] }> {
    if (!this._operatorList) {
      this._operatorList = await this._page.getOperatorList();
    }
    return this._operatorList;
  }

  /** Extract graphics from the page */
  private async extractGraphics(
    type: 'lines' | 'rects' | 'curves'
  ): Promise<any[]> {
    const ops = await this.getOperatorList();
    const results: any[] = [];

    // PDF operator codes
    const OPS = {
      moveTo: 13,
      lineTo: 14,
      curveTo: 15,
      curveTo2: 16,
      curveTo3: 17,
      closePath: 18,
      rectangle: 19,
      stroke: 48,
      closeStroke: 49,
      fill: 50,
      eoFill: 51,
      fillStroke: 52,
      eoFillStroke: 53,
      closeFillStroke: 54,
      setStrokeColor: 23,
      setFillColor: 28,
      setLineWidth: 3,
      setLineCap: 4,
      setLineJoin: 5,
      setDash: 7,
      setStrokeGray: 26,
      setFillGray: 27,
      setStrokeRGBColor: 28,
      setFillRGBColor: 29,
    };

    // Track path points and curve points separately
    let currentPath: Array<{ x: number; y: number; type: 'line' | 'curve' }> = [];
    let currentCurvePoints: Array<{ x: number; y: number }> = [];
    let pathStartX = 0;
    let pathStartY = 0;
    let currentX = 0;
    let currentY = 0;
    let lineWidth = 1;
    let lineCap = 0;
    let lineJoin = 0;
    let dashArray: number[] = [];
    let dashPhase = 0;
    let strokingColor: Color = null;
    let nonStrokingColor: Color = null;
    let hasCurves = false;

    // Track path commands for curve path description
    let currentPathCommands: Array<{ type: string; points: Array<[number, number]> }> = [];

    const finalizeCurve = (isStroked: boolean, isFilled: boolean) => {
      if (type === 'curves' && currentCurvePoints.length >= 2) {
        const allX = currentCurvePoints.map((p) => p.x);
        const allY = currentCurvePoints.map((p) => p.y);
        const x0 = Math.min(...allX);
        const y0 = Math.min(...allY);
        const x1 = Math.max(...allX);
        const y1 = Math.max(...allY);

        // Convert points to [x, y] tuple format
        const pts: Array<[number, number]> = currentCurvePoints.map((p) => [p.x, p.y]);

        results.push({
          pts,
          path: [...currentPathCommands],
          x0,
          y0,
          x1,
          y1,
          top: y0,
          bottom: y1,
          doctop: this._doctopOffset + y0,
          lineWidth,
          strokingColor,
          nonStrokingColor,
          stroke: isStroked,
          fill: isFilled,
          dash: dashArray.length > 0 ? [dashArray, dashPhase] as [number[], number] : undefined,
          pageNumber: this._pageNumber,
        } as PDFCurve);
      }
      currentPathCommands = [];
    };

    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      const args = ops.argsArray[i];

      switch (fn) {
        case OPS.setLineWidth:
          if (args && args.length >= 1) lineWidth = args[0];
          break;

        case OPS.setLineCap:
          if (args && args.length >= 1) lineCap = args[0];
          break;

        case OPS.setLineJoin:
          if (args && args.length >= 1) lineJoin = args[0];
          break;

        case OPS.setDash:
          if (args && args.length >= 2) {
            dashArray = args[0] || [];
            dashPhase = args[1] || 0;
          }
          break;

        case OPS.setStrokeColor:
          if (args) strokingColor = args.length === 3 ? args as [number, number, number] : args[0];
          break;

        case OPS.setStrokeGray:
          if (args && args.length >= 1) strokingColor = args[0];
          break;

        case OPS.setStrokeRGBColor:
          if (args && args.length >= 3) strokingColor = [args[0], args[1], args[2]];
          break;

        case OPS.setFillColor:
          if (args) nonStrokingColor = args.length === 3 ? args as [number, number, number] : args[0];
          break;

        case OPS.setFillGray:
          if (args && args.length >= 1) nonStrokingColor = args[0];
          break;

        case OPS.setFillRGBColor:
          if (args && args.length >= 3) nonStrokingColor = [args[0], args[1], args[2]];
          break;

        case OPS.moveTo:
          if (args && args.length >= 2) {
            currentX = args[0];
            currentY = this._height - args[1];
            pathStartX = currentX;
            pathStartY = currentY;
            currentPath = [{ x: currentX, y: currentY, type: 'line' }];
            currentCurvePoints = [{ x: currentX, y: currentY }];
            currentPathCommands = [{ type: 'm', points: [[currentX, currentY]] }];
            hasCurves = false;
          }
          break;

        case OPS.lineTo:
          if (args && args.length >= 2) {
            currentX = args[0];
            currentY = this._height - args[1];
            currentPath.push({ x: currentX, y: currentY, type: 'line' });
            currentCurvePoints.push({ x: currentX, y: currentY });
            currentPathCommands.push({ type: 'l', points: [[currentX, currentY]] });
          }
          break;

        case OPS.curveTo:
          // Bezier curve with two control points
          if (args && args.length >= 6) {
            hasCurves = true;
            const cp1x = args[0];
            const cp1y = this._height - args[1];
            const cp2x = args[2];
            const cp2y = this._height - args[3];
            currentX = args[4];
            currentY = this._height - args[5];
            currentCurvePoints.push({ x: cp1x, y: cp1y });
            currentCurvePoints.push({ x: cp2x, y: cp2y });
            currentCurvePoints.push({ x: currentX, y: currentY });
            currentPath.push({ x: currentX, y: currentY, type: 'curve' });
            currentPathCommands.push({
              type: 'c',
              points: [[cp1x, cp1y], [cp2x, cp2y], [currentX, currentY]],
            });
          }
          break;

        case OPS.curveTo2:
          // Bezier curve with initial point replicated
          if (args && args.length >= 4) {
            hasCurves = true;
            const cp2x = args[0];
            const cp2y = this._height - args[1];
            currentX = args[2];
            currentY = this._height - args[3];
            currentCurvePoints.push({ x: cp2x, y: cp2y });
            currentCurvePoints.push({ x: currentX, y: currentY });
            currentPath.push({ x: currentX, y: currentY, type: 'curve' });
            currentPathCommands.push({
              type: 'v',
              points: [[cp2x, cp2y], [currentX, currentY]],
            });
          }
          break;

        case OPS.curveTo3:
          // Bezier curve with final point replicated
          if (args && args.length >= 4) {
            hasCurves = true;
            const cp1x = args[0];
            const cp1y = this._height - args[1];
            currentX = args[2];
            currentY = this._height - args[3];
            currentCurvePoints.push({ x: cp1x, y: cp1y });
            currentCurvePoints.push({ x: currentX, y: currentY });
            currentPath.push({ x: currentX, y: currentY, type: 'curve' });
            currentPathCommands.push({
              type: 'y',
              points: [[cp1x, cp1y], [currentX, currentY]],
            });
          }
          break;

        case OPS.closePath:
          // Close the path back to start
          if (currentPath.length > 0) {
            currentPath.push({ x: pathStartX, y: pathStartY, type: 'line' });
            currentCurvePoints.push({ x: pathStartX, y: pathStartY });
            currentPathCommands.push({ type: 'h', points: [] });
            currentX = pathStartX;
            currentY = pathStartY;
          }
          break;

        case OPS.rectangle:
          if (args && args.length >= 4 && type === 'rects') {
            const [x, y, w, h] = args;
            const rect: PDFRect = {
              x0: x,
              y0: this._height - y - h,
              x1: x + w,
              y1: this._height - y,
              top: this._height - y - h,
              bottom: this._height - y,
              doctop: this._doctopOffset + this._height - y - h,
              width: Math.abs(w),
              height: Math.abs(h),
              lineWidth,
              strokingColor,
              nonStrokingColor,
              stroke: false,
              fill: false,
              pageNumber: this._pageNumber,
            };
            results.push(rect);
          }
          break;

        case OPS.stroke:
        case OPS.closeStroke:
          if (type === 'lines' && currentPath.length >= 2 && !hasCurves) {
            for (let j = 0; j < currentPath.length - 1; j++) {
              const p1 = currentPath[j];
              const p2 = currentPath[j + 1];
              results.push({
                x0: p1.x,
                y0: p1.y,
                x1: p2.x,
                y1: p2.y,
                top: Math.min(p1.y, p2.y),
                bottom: Math.max(p1.y, p2.y),
                doctop: this._doctopOffset + Math.min(p1.y, p2.y),
                lineWidth,
                strokingColor,
                stroke: true,
                lineCap,
                lineJoin,
                dash: dashArray.length > 0 ? [dashArray, dashPhase] as [number[], number] : undefined,
                pageNumber: this._pageNumber,
              } as PDFLine);
            }
          }
          if (type === 'curves' && hasCurves) {
            finalizeCurve(true, false);
          }
          if (type === 'rects' && results.length > 0) {
            const lastRect = results[results.length - 1];
            if ('fill' in lastRect) lastRect.stroke = true;
          }
          currentPath = [];
          currentCurvePoints = [];
          hasCurves = false;
          break;

        case OPS.fill:
        case OPS.eoFill:
          if (type === 'curves' && hasCurves) {
            finalizeCurve(false, true);
          }
          if (type === 'rects' && results.length > 0) {
            const lastRect = results[results.length - 1];
            if ('fill' in lastRect) lastRect.fill = true;
          }
          currentPath = [];
          currentCurvePoints = [];
          hasCurves = false;
          break;

        case OPS.fillStroke:
        case OPS.eoFillStroke:
        case OPS.closeFillStroke:
          if (type === 'rects' && results.length > 0) {
            const lastRect = results[results.length - 1];
            if ('fill' in lastRect) {
              lastRect.stroke = true;
              lastRect.fill = true;
            }
          }
          if (type === 'curves' && hasCurves) {
            finalizeCurve(true, true);
          }
          if (type === 'lines' && currentPath.length >= 2 && !hasCurves) {
            for (let j = 0; j < currentPath.length - 1; j++) {
              const p1 = currentPath[j];
              const p2 = currentPath[j + 1];
              results.push({
                x0: p1.x,
                y0: p1.y,
                x1: p2.x,
                y1: p2.y,
                top: Math.min(p1.y, p2.y),
                bottom: Math.max(p1.y, p2.y),
                doctop: this._doctopOffset + Math.min(p1.y, p2.y),
                lineWidth,
                strokingColor,
                stroke: true,
                lineCap,
                lineJoin,
                dash: dashArray.length > 0 ? [dashArray, dashPhase] as [number[], number] : undefined,
                pageNumber: this._pageNumber,
              } as PDFLine);
            }
          }
          currentPath = [];
          currentCurvePoints = [];
          hasCurves = false;
          break;
      }
    }

    return results;
  }

  /** Extract images from the page */
  private async extractImages(): Promise<PDFImage[]> {
    const ops = await this.getOperatorList();
    const images: PDFImage[] = [];

    // PDF operator codes
    const OPS_PAINT_IMAGE_XOBJECT = 85;
    const OPS_TRANSFORM = 12; // setTransform / cm operator
    const OPS_SAVE = 10; // q - save graphics state
    const OPS_RESTORE = 11; // Q - restore graphics state

    // Track transformation matrix stack
    // CTM is [a, b, c, d, e, f] representing:
    // | a c e |
    // | b d f |
    // | 0 0 1 |
    const ctmStack: number[][] = [];
    let currentCTM = [1, 0, 0, 1, 0, 0]; // Identity matrix

    const multiplyMatrix = (m1: number[], m2: number[]): number[] => {
      const [a1, b1, c1, d1, e1, f1] = m1;
      const [a2, b2, c2, d2, e2, f2] = m2;
      return [
        a1 * a2 + c1 * b2,
        b1 * a2 + d1 * b2,
        a1 * c2 + c1 * d2,
        b1 * c2 + d1 * d2,
        a1 * e2 + c1 * f2 + e1,
        b1 * e2 + d1 * f2 + f1,
      ];
    };

    // Get common objects which contain image data
    const commonObjs = this._page.commonObjs;
    const objs = this._page.objs;

    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      const args = ops.argsArray[i];

      switch (fn) {
        case OPS_SAVE:
          ctmStack.push([...currentCTM]);
          break;

        case OPS_RESTORE:
          if (ctmStack.length > 0) {
            currentCTM = ctmStack.pop()!;
          }
          break;

        case OPS_TRANSFORM:
          if (args && args.length >= 6) {
            const newTransform = args as number[];
            currentCTM = multiplyMatrix(currentCTM, newTransform);
          }
          break;

        case OPS_PAINT_IMAGE_XOBJECT:
          if (args && args[0]) {
            const imgName = args[0] as string;

            // In PDF, images are drawn as a 1x1 unit square transformed by CTM
            // The CTM already contains the scaling/positioning
            const [a, b, c, d, e, f] = currentCTM;

            // Image width and height from the transform
            const imgWidth = Math.sqrt(a * a + b * b);
            const imgHeight = Math.sqrt(c * c + d * d);

            // Calculate corner positions
            // Original image is unit square (0,0) to (1,1)
            const x0 = e;
            const y0 = this._height - f - imgHeight;
            const x1 = e + imgWidth;
            const y1 = this._height - f;

            // Try to get image data
            let imgData: any = null;
            let stream: Uint8Array | undefined;
            let colorSpace: string | undefined;
            let bitsPerComponent: number | undefined;
            let srcWidth = Math.round(imgWidth);
            let srcHeight = Math.round(imgHeight);

            try {
              // Try to get from page objects first
              imgData = objs.get(imgName);
              if (!imgData) {
                // Try common objects
                imgData = commonObjs.get(imgName);
              }

              if (imgData) {
                if (imgData.data) {
                  stream = new Uint8Array(imgData.data);
                }
                if (imgData.width) srcWidth = imgData.width;
                if (imgData.height) srcHeight = imgData.height;
                if (imgData.colorSpace) {
                  colorSpace = Array.isArray(imgData.colorSpace)
                    ? imgData.colorSpace[0]?.name || 'DeviceRGB'
                    : imgData.colorSpace?.name || 'DeviceRGB';
                }
                if (imgData.bitsPerComponent) {
                  bitsPerComponent = imgData.bitsPerComponent;
                }
              }
            } catch {
              // Image data extraction failed, continue without it
            }

            images.push({
              x0,
              y0,
              x1,
              y1,
              top: y0,
              bottom: y1,
              doctop: this._doctopOffset + y0,
              width: imgWidth,
              height: imgHeight,
              srcSize: [srcWidth, srcHeight],
              colorSpace,
              bitsPerComponent,
              stream,
              name: imgName,
              pageNumber: this._pageNumber,
            });
          }
          break;
      }
    }

    return images;
  }

  /** Extract annotations from the page */
  private async extractAnnotations(): Promise<PDFAnnotation[]> {
    const annotations = await this._page.getAnnotations();
    const results: PDFAnnotation[] = [];

    for (const annot of annotations) {
      if (annot.rect) {
        const [x0, y0, x1, y1] = annot.rect;
        results.push({
          x0,
          y0: this._height - y1,
          x1,
          y1: this._height - y0,
          annotationType: annot.subtype || 'Unknown',
          contents: annot.contents,
          uri: annot.url,
          destPageNumber: annot.dest?.[0]?.num,
          pageNumber: this._pageNumber,
        });
      }
    }

    return results;
  }
}

/**
 * Special page class for outsideBBox operations
 * Returns objects that are outside (not overlapping) the excluded bounding box
 */
class OutsideBBoxPage {
  private _sourcePage: Page;
  private _excludeBBox: BBox;
  private _strict: boolean;

  constructor(sourcePage: Page, excludeBBox: BBox, strict: boolean = true) {
    this._sourcePage = sourcePage;
    this._excludeBBox = excludeBBox;
    this._strict = strict;
  }

  /** Get page info from source page */
  get info(): PageInfo {
    return this._sourcePage.info;
  }

  /** Get page number */
  get pageNumber(): number {
    return this._sourcePage.pageNumber;
  }

  /** Get page width */
  get width(): number {
    return this._sourcePage.width;
  }

  /** Get page height */
  get height(): number {
    return this._sourcePage.height;
  }

  /** Get characters outside the excluded box */
  async getChars(): Promise<PDFChar[]> {
    const chars = await this._sourcePage.getChars();
    if (this._strict) {
      // In strict mode, keep objects that are not entirely within the exclude box
      const withinBox = new Set(filterWithinBBox(chars, this._excludeBBox));
      return chars.filter((c) => !withinBox.has(c));
    }
    // In non-strict mode, keep objects that don't overlap at all
    return filterOutsideBBox(chars, this._excludeBBox);
  }

  /** Alias for getChars() */
  get chars(): Promise<PDFChar[]> {
    return this.getChars();
  }

  /** Extract text from outside the excluded box */
  async extractText(options?: TextExtractionOptions): Promise<string> {
    const chars = await this.getChars();
    return extractText(chars, options);
  }

  /** Extract words from outside the excluded box */
  async extractWords(options?: WordExtractionOptions): Promise<PDFWord[]> {
    const chars = await this.getChars();
    return extractWords(chars, options);
  }

  /** Get text lines from outside the excluded box */
  async getTextLines(yTolerance?: number): Promise<PDFTextLine[]> {
    const chars = await this.getChars();
    return extractLines(chars, yTolerance);
  }

  /** Get lines outside the excluded box */
  async getLines(): Promise<PDFLine[]> {
    const lines = await this._sourcePage.getLines();
    return lines.filter((l) => {
      const bbox: BBox = [
        Math.min(l.x0, l.x1),
        Math.min(l.y0, l.y1),
        Math.max(l.x0, l.x1),
        Math.max(l.y0, l.y1),
      ];
      return filterOutsideBBox([{ x0: bbox[0], y0: bbox[1], x1: bbox[2], y1: bbox[3] }], this._excludeBBox).length > 0;
    });
  }

  /** Alias for getLines() */
  get lines(): Promise<PDFLine[]> {
    return this.getLines();
  }

  /** Get rectangles outside the excluded box */
  async getRects(): Promise<PDFRect[]> {
    const rects = await this._sourcePage.getRects();
    if (this._strict) {
      const withinBox = new Set(filterWithinBBox(rects, this._excludeBBox));
      return rects.filter((r) => !withinBox.has(r));
    }
    return filterOutsideBBox(rects, this._excludeBBox);
  }

  /** Alias for getRects() */
  get rects(): Promise<PDFRect[]> {
    return this.getRects();
  }

  /** Get curves outside the excluded box */
  async getCurves(): Promise<PDFCurve[]> {
    const curves = await this._sourcePage.getCurves();
    if (this._strict) {
      const withinBox = new Set(filterWithinBBox(curves, this._excludeBBox));
      return curves.filter((c) => !withinBox.has(c));
    }
    return filterOutsideBBox(curves, this._excludeBBox);
  }

  /** Alias for getCurves() */
  get curves(): Promise<PDFCurve[]> {
    return this.getCurves();
  }

  /** Get images outside the excluded box */
  async getImages(): Promise<PDFImage[]> {
    const images = await this._sourcePage.getImages();
    if (this._strict) {
      const withinBox = new Set(filterWithinBBox(images, this._excludeBBox));
      return images.filter((i) => !withinBox.has(i));
    }
    return filterOutsideBBox(images, this._excludeBBox);
  }

  /** Alias for getImages() */
  get images(): Promise<PDFImage[]> {
    return this.getImages();
  }

  /** Get annotations outside the excluded box */
  async getAnnotations(): Promise<PDFAnnotation[]> {
    const annots = await this._sourcePage.getAnnotations();
    if (this._strict) {
      const withinBox = new Set(filterWithinBBox(annots, this._excludeBBox));
      return annots.filter((a) => !withinBox.has(a));
    }
    return filterOutsideBBox(annots, this._excludeBBox);
  }

  /** Alias for getAnnotations() */
  get annots(): Promise<PDFAnnotation[]> {
    return this.getAnnotations();
  }

  /** Get hyperlinks outside the excluded box */
  async getHyperlinks(): Promise<PDFHyperlink[]> {
    const hyperlinks = await this._sourcePage.getHyperlinks();
    return hyperlinks.filter((h) =>
      filterOutsideBBox([{ x0: h.x0, y0: h.y0, x1: h.x1, y1: h.y1 }], this._excludeBBox).length > 0
    );
  }

  /** Alias for getHyperlinks() */
  get hyperlinks(): Promise<PDFHyperlink[]> {
    return this.getHyperlinks();
  }

  /** Get all objects outside the excluded box */
  async getObjects(): Promise<PDFObject[]> {
    const [chars, lines, rects, curves, images, annots] = await Promise.all([
      this.getChars(),
      this.getLines(),
      this.getRects(),
      this.getCurves(),
      this.getImages(),
      this.getAnnotations(),
    ]);

    return [...chars, ...lines, ...rects, ...curves, ...images, ...annots];
  }

  /** Alias for getObjects() */
  get objects(): Promise<PDFObject[]> {
    return this.getObjects();
  }

  /** Extract tables from outside the excluded box */
  async extractTables(options?: TableExtractionOptions): Promise<PDFTable[]> {
    const [chars, lines, rects] = await Promise.all([
      this.getChars(),
      this.getLines(),
      this.getRects(),
    ]);

    return extractTables(chars, lines, rects, this._sourcePage.pageNumber, options);
  }

  /** Extract a single table (first found) outside the excluded box */
  async extractTable(options?: TableExtractionOptions): Promise<PDFTable | null> {
    const tables = await this.extractTables(options);
    return tables[0] || null;
  }

  /** Search for text outside the excluded box */
  async search(
    pattern: string | RegExp,
    options: { literal?: boolean } = {}
  ): Promise<Array<{ text: string; x0: number; y0: number; x1: number; y1: number; chars: PDFChar[] }>> {
    const words = await this.extractWords();
    const results: Array<{ text: string; x0: number; y0: number; x1: number; y1: number; chars: PDFChar[] }> = [];

    let regex: RegExp;
    if (typeof pattern === 'string') {
      const useLiteral = options.literal !== false;
      const safePattern = useLiteral ? escapeRegExp(pattern) : pattern;
      regex = new RegExp(safePattern, 'gi');
    } else {
      regex = pattern;
    }

    for (const word of words) {
      if (regex.test(word.text)) {
        results.push({
          text: word.text,
          x0: word.x0,
          y0: word.y0,
          x1: word.x1,
          y1: word.y1,
          chars: word.chars,
        });
      }
      regex.lastIndex = 0;
    }

    return results;
  }
}

/**
 * Filtered page class - returns only objects matching the test function
 */
class FilteredPage {
  private _sourcePage: Page;
  private _testFn: FilterFn<PDFObject>;

  constructor(sourcePage: Page, testFn: FilterFn<PDFObject>) {
    this._sourcePage = sourcePage;
    this._testFn = testFn;
  }

  get info(): PageInfo {
    return this._sourcePage.info;
  }

  get pageNumber(): number {
    return this._sourcePage.pageNumber;
  }

  get width(): number {
    return this._sourcePage.width;
  }

  get height(): number {
    return this._sourcePage.height;
  }

  async getChars(): Promise<PDFChar[]> {
    const chars = await this._sourcePage.getChars();
    return chars.filter(c => this._testFn(c as PDFObject));
  }

  get chars(): Promise<PDFChar[]> {
    return this.getChars();
  }

  async extractText(options?: TextExtractionOptions): Promise<string> {
    const chars = await this.getChars();
    return extractText(chars, options);
  }

  async extractWords(options?: WordExtractionOptions): Promise<PDFWord[]> {
    const chars = await this.getChars();
    return extractWords(chars, options);
  }

  async getTextLines(yTolerance?: number): Promise<PDFTextLine[]> {
    const chars = await this.getChars();
    return extractLines(chars, yTolerance);
  }

  async getLines(): Promise<PDFLine[]> {
    const lines = await this._sourcePage.getLines();
    return lines.filter(l => this._testFn(l as PDFObject));
  }

  get lines(): Promise<PDFLine[]> {
    return this.getLines();
  }

  async getRects(): Promise<PDFRect[]> {
    const rects = await this._sourcePage.getRects();
    return rects.filter(r => this._testFn(r as PDFObject));
  }

  get rects(): Promise<PDFRect[]> {
    return this.getRects();
  }

  async getCurves(): Promise<PDFCurve[]> {
    const curves = await this._sourcePage.getCurves();
    return curves.filter(c => this._testFn(c as PDFObject));
  }

  get curves(): Promise<PDFCurve[]> {
    return this.getCurves();
  }

  async getImages(): Promise<PDFImage[]> {
    const images = await this._sourcePage.getImages();
    return images.filter(i => this._testFn(i as PDFObject));
  }

  get images(): Promise<PDFImage[]> {
    return this.getImages();
  }

  async getAnnotations(): Promise<PDFAnnotation[]> {
    const annots = await this._sourcePage.getAnnotations();
    return annots.filter(a => this._testFn(a as PDFObject));
  }

  get annots(): Promise<PDFAnnotation[]> {
    return this.getAnnotations();
  }

  async getHyperlinks(): Promise<PDFHyperlink[]> {
    const links = await this._sourcePage.getHyperlinks();
    return links.filter(l => this._testFn(l as PDFObject));
  }

  get hyperlinks(): Promise<PDFHyperlink[]> {
    return this.getHyperlinks();
  }

  async getObjects(): Promise<PDFObject[]> {
    const [chars, lines, rects, curves, images, annots] = await Promise.all([
      this.getChars(),
      this.getLines(),
      this.getRects(),
      this.getCurves(),
      this.getImages(),
      this.getAnnotations(),
    ]);
    return [...chars, ...lines, ...rects, ...curves, ...images, ...annots];
  }

  get objects(): Promise<PDFObject[]> {
    return this.getObjects();
  }

  async extractTables(options?: TableExtractionOptions): Promise<PDFTable[]> {
    const [chars, lines, rects] = await Promise.all([
      this.getChars(),
      this.getLines(),
      this.getRects(),
    ]);
    return extractTables(chars, lines, rects, this._sourcePage.pageNumber, options);
  }

  async extractTable(options?: TableExtractionOptions): Promise<PDFTable | null> {
    const tables = await this.extractTables(options);
    return tables[0] || null;
  }

  async search(
    pattern: string | RegExp,
    options: { literal?: boolean } = {}
  ): Promise<Array<{ text: string; x0: number; y0: number; x1: number; y1: number; chars: PDFChar[] }>> {
    const words = await this.extractWords();
    const results: Array<{ text: string; x0: number; y0: number; x1: number; y1: number; chars: PDFChar[] }> = [];

    let regex: RegExp;
    if (typeof pattern === 'string') {
      const useLiteral = options.literal !== false;
      const safePattern = useLiteral ? escapeRegExp(pattern) : pattern;
      regex = new RegExp(safePattern, 'gi');
    } else {
      regex = pattern;
    }

    for (const word of words) {
      if (regex.test(word.text)) {
        results.push({
          text: word.text,
          x0: word.x0,
          y0: word.y0,
          x1: word.x1,
          y1: word.y1,
          chars: word.chars,
        });
      }
      regex.lastIndex = 0;
    }

    return results;
  }
}
