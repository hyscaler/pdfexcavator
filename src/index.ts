/**
 * PDFExcavator - A powerful PDF extraction library for Node.js
 *
 * PDFExcavator allows you to extract text,
 * tables, and visual elements from PDF files with precision.
 *
 * @example
 * ```typescript
 * import pdfexcavator from 'pdfexcavator';
 *
 * const pdf = await pdfexcavator.open('document.pdf');
 * const metadata = await pdf.metadata;
 *
 * for (const page of pdf.pages) {
 *   const text = await page.extractText();
 *   const tables = await page.extractTables();
 * }
 *
 * await pdf.close();
 * ```
 */

// Main classes
export { PDFExcavator, open } from './PDFExcavator.js';
export { Page } from './Page.js';
export { PageImage, createPageImage } from './PageImage.js';

// Table finder
export {
  TableFinder,
  findTables,
  debugTableFinder,
  extractTables,
  extractTable,
  detectBorderlessTables,
  findNestedTables,
  extractTablesEnhanced,
} from './extractors/table.js';

// Text extraction utilities
export { extractChars, extractText, extractTextSimple, extractTextFromItems, extractLines, extractWords } from './extractors/text.js';

// Character extraction with enhanced features
export {
  extractCharsWithColors,
  extractCharsWithSpacing,
  getTextStateAt,
} from './extractors/chars.js';
export type { TextState } from './extractors/chars.js';

// Precision extraction (Phase 3 - state machine)
export {
  PDFStateTracker,
  extractCharsWithPrecision,
  createStateTracker,
} from './extractors/precision.js';
export type {
  GraphicsState,
  StateSnapshot,
  PrecisePosition,
} from './extractors/precision.js';

// Layout analysis (LAParams)
export {
  LayoutAnalyzer,
  analyzeLayout,
  detectTextColumns,
  detectReadingDirection,
  isVerticalText,
  DEFAULT_LAPARAMS,
} from './extractors/layout.js';

// Font utilities
export {
  extractFontMetrics,
  getCharWidth,
  getBaseline,
  getTypicalSpacing,
  getFontSubstitutions,
  getMissingFonts,
  resetFontSubstitutions,
} from './extractors/fonts.js';
export type { FontMetrics } from './extractors/fonts.js';

// Font substitution
export {
  findFontSubstitution,
  getFontMetrics as getSubstituteFontMetrics,
  classifyFont,
  parseFontStyle,
  FontSubstitutionManager,
  PDF_BASE_FONTS,
  FONT_SUBSTITUTION_MAP,
  STANDARD_FONT_METRICS,
} from './utils/fontSubstitution.js';
export type { FontSubstitution, FontClass } from './utils/fontSubstitution.js';

// CMap utilities
export {
  getDefaultCMapConfig,
  isCJKFont,
  normalizeCJKText,
} from './utils/cmap.js';
export type { CMapConfig } from './utils/cmap.js';

// OCR integration
export {
  performOCR,
  needsOCR,
  isLikelyScanned,
  isTesseractAvailable,
  terminateOCR,
  OCREngine,
  OCR_LANGUAGES,
  PSM_MODES,
  OEM_MODES,
} from './utils/ocr.js';
export type { OCROptions, OCRResult } from './utils/ocr.js';

// Types - Core
export type {
  BBox,
  RGBColor,
  CMYKColor,
  Color,
  Matrix,
  PDFMetadata,
  PageInfo,
  OpenOptions,
  LayoutParams,
} from './types.js';

// Types - PDF Objects
export type {
  PDFChar,
  PDFWord,
  PDFTextLine,
  PDFLine,
  PDFRect,
  PDFCurve,
  PDFImage,
  PDFAnnotation,
  PDFHyperlink,
  PDFObject,
} from './types.js';

// Types - Tables
export type {
  TableCell,
  PDFTable,
  TableFinderResult,
  TableExtractionOptions,
  TableDetectionMethod,
} from './types.js';

// Types - Options
export type {
  TextExtractionOptions,
  WordExtractionOptions,
  RenderOptions,
  DrawOptions,
  FilterFn,
  CropOptions,
  ProcessingOptions,
  ProcessingResult,
  ProcessingError,
} from './types.js';

// Utility functions - Bounding Box
export {
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
} from './utils/bbox.js';

// Utility functions - Geometry
export {
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
} from './utils/geometry.js';

// Character correction utilities
export {
  correctText,
  createTextCorrector,
  detectEncodingIssues,
  autoCorrectText,
  NUMBER_TO_LETTER,
  LETTER_TO_NUMBER,
  LIGATURES,
  QUOTES,
  DASHES,
  WHITESPACE,
  COMMON_WORDS,
  WORD_PATTERNS,
} from './utils/charCorrection.js';
export type { CharCorrectionOptions } from './utils/charCorrection.js';

// Default export for convenience
import { PDFExcavator, open } from './PDFExcavator.js';

export default {
  PDFExcavator,
  open,
};
