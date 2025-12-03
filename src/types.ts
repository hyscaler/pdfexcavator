/**
 * PDFLens Type Definitions
 */

/** Bounding box coordinates [x0, y0, x1, y1] */
export type BBox = [number, number, number, number];

/** RGB color as [r, g, b] with values 0-1 */
export type RGBColor = [number, number, number];

/** CMYK color as [c, m, y, k] with values 0-1 */
export type CMYKColor = [number, number, number, number];

/** Color can be RGB, CMYK, grayscale, or null */
export type Color = RGBColor | CMYKColor | number | null;

/** Transformation matrix [a, b, c, d, e, f] */
export type Matrix = [number, number, number, number, number, number];

/** A single character with full position and style information */
export interface PDFChar {
  /** The character text */
  text: string;
  /** Left x coordinate */
  x0: number;
  /** Top y coordinate (from top of page) */
  y0: number;
  /** Right x coordinate */
  x1: number;
  /** Bottom y coordinate */
  y1: number;
  /** Character width */
  width: number;
  /** Character height */
  height: number;
  /** Top of character (same as y0) */
  top: number;
  /** Bottom of character (same as y1) */
  bottom: number;
  /** Distance from top of document (across pages) */
  doctop: number;
  /** Font name */
  fontName: string;
  /** Font size in points */
  size: number;
  /** Advance width (spacing to next char) */
  adv: number;
  /** Whether character is upright */
  upright: boolean;
  /** Transformation matrix */
  matrix: Matrix;
  /** Stroking (outline) color */
  strokingColor: Color;
  /** Non-stroking (fill) color */
  nonStrokingColor: Color;
  /** Page number (0-indexed) */
  pageNumber: number;
  /** Marked content ID (if available) */
  mcid?: number;
  /** Structure tag (if available) */
  tag?: string;
}

/** A word extracted from the page */
export interface PDFWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  top: number;
  bottom: number;
  doctop: number;
  /** Characters that make up this word */
  chars: PDFChar[];
  /** Direction of text: 'ltr' or 'rtl' */
  direction: 'ltr' | 'rtl';
  /** Whether word is upright */
  upright: boolean;
}

/** A line of text */
export interface PDFTextLine {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  top: number;
  bottom: number;
  doctop: number;
  chars: PDFChar[];
  words: PDFWord[];
}

/** A graphical line segment */
export interface PDFLine {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  top: number;
  bottom: number;
  doctop: number;
  lineWidth: number;
  strokingColor: Color;
  /** Whether line is stroked (visible) */
  stroke: boolean;
  /** Line cap style */
  lineCap?: number;
  /** Line join style */
  lineJoin?: number;
  /** Dash pattern */
  dash?: [number[], number];
  pageNumber: number;
}

/** A rectangle */
export interface PDFRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  top: number;
  bottom: number;
  doctop: number;
  width: number;
  height: number;
  lineWidth: number;
  strokingColor: Color;
  nonStrokingColor: Color;
  stroke: boolean;
  fill: boolean;
  pageNumber: number;
}

/** A curve/path */
export interface PDFCurve {
  /** Points on the curve */
  pts: Array<[number, number]>;
  /** Full path description */
  path: Array<{ type: string; points: Array<[number, number]> }>;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  top: number;
  bottom: number;
  doctop: number;
  lineWidth: number;
  strokingColor: Color;
  nonStrokingColor: Color;
  stroke: boolean;
  fill: boolean;
  /** Dash pattern */
  dash?: [number[], number];
  pageNumber: number;
}

/** An image in the PDF */
export interface PDFImage {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  top: number;
  bottom: number;
  doctop: number;
  width: number;
  height: number;
  /** Original image size [width, height] */
  srcSize: [number, number];
  /** Color space (e.g., 'DeviceRGB') */
  colorSpace?: string;
  /** Bits per component */
  bitsPerComponent?: number;
  /** Image name/reference */
  name?: string;
  /** Stream data (if extracted) */
  stream?: Uint8Array;
  pageNumber: number;
}

/** An annotation */
export interface PDFAnnotation {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Annotation type (e.g., 'Link', 'Text', 'Highlight') */
  annotationType: string;
  /** Annotation contents */
  contents?: string;
  /** URI for link annotations */
  uri?: string;
  /** Page number for internal links */
  destPageNumber?: number;
  pageNumber: number;
}

/** A hyperlink */
export interface PDFHyperlink {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  uri?: string;
  destPageNumber?: number;
  pageNumber: number;
}

/** PDF metadata */
export interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
  pageCount: number;
  pdfVersion?: string;
  isEncrypted: boolean;
  isLinearized?: boolean;
}

/** Page dimensions and info */
export interface PageInfo {
  pageNumber: number;
  width: number;
  height: number;
  rotation: number;
  /** Media box */
  mediaBox: BBox;
  /** Crop box (visible area) */
  cropBox: BBox;
}

/** Options for text extraction */
export interface TextExtractionOptions {
  /** Horizontal tolerance for grouping characters into words */
  xTolerance?: number;
  /** Dynamic tolerance as ratio of character size */
  xToleranceRatio?: number | null;
  /** Vertical tolerance for grouping into lines */
  yTolerance?: number;
  /** Attempt to preserve visual layout */
  layout?: boolean;
  /** Characters per point (horizontal) for layout mode */
  xDensity?: number;
  /** Lines per point (vertical) for layout mode */
  yDensity?: number;
  /** Line direction: 'ttb', 'btt', 'ltr', 'rtl' */
  lineDirRender?: 'ttb' | 'btt' | 'ltr' | 'rtl' | null;
  /** Character direction within lines */
  charDirRender?: 'ltr' | 'rtl' | null;
  /** Keep blank characters */
  keepBlankChars?: boolean;
  /** Use PDF text flow order */
  useTextFlow?: boolean;
}

/** Options for word extraction */
export interface WordExtractionOptions {
  xTolerance?: number;
  yTolerance?: number;
  keepBlankChars?: boolean;
  useTextFlow?: boolean;
  /** Split words on these characters */
  splitAtPunctuation?: boolean | string[];
  /** Extra attributes to include */
  extraAttrs?: string[];
}

/** A cell in a table */
export interface TableCell {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  top: number;
  bottom: number;
  rowSpan?: number;
  colSpan?: number;
}

/** Detection method used to find a table */
export type TableDetectionMethod = 'lines' | 'text' | 'explicit' | 'hybrid';

/** An extracted table */
export interface PDFTable {
  /** 2D array of cell values (null for empty cells) */
  rows: (string | null)[][];
  /** Detailed cell information */
  cells: (TableCell | null)[][];
  /** Table bounding box */
  bbox: BBox;
  /** Page number */
  pageNumber: number;
  /** Detection confidence score (0-1), higher is more confident */
  confidence?: number;
  /** Method used to detect this table */
  detectionMethod?: TableDetectionMethod;
  /** Nested tables within cells (Phase 3 enhancement) */
  nestedTables?: PDFTable[];
  /** Parent cell location if this is a nested table */
  parentCell?: { row: number; col: number };
}

/** Table finder result */
export interface TableFinderResult {
  tables: PDFTable[];
  /** Edges used to find tables */
  edges: PDFLine[];
  /** Intersections found */
  intersections: Array<{ x: number; y: number }>;
}

/** Options for table extraction */
export interface TableExtractionOptions {
  /** Strategy for vertical separators */
  verticalStrategy?: 'lines' | 'lines_strict' | 'text' | 'explicit';
  /** Strategy for horizontal separators */
  horizontalStrategy?: 'lines' | 'lines_strict' | 'text' | 'explicit';
  /** Explicit vertical line positions */
  explicitVerticalLines?: number[] | PDFLine[];
  /** Explicit horizontal line positions */
  explicitHorizontalLines?: number[] | PDFLine[];
  /** Snap tolerance for line alignment */
  snapTolerance?: number;
  /** Join tolerance for connecting line segments */
  joinTolerance?: number;
  /** Minimum edge length to consider */
  edgeMinLength?: number;
  /** Minimum words to form a vertical edge (text strategy) */
  minWordsVertical?: number;
  /** Minimum words to form a horizontal edge (text strategy) */
  minWordsHorizontal?: number;
  /** Keep blank characters when extracting */
  keepBlankChars?: boolean;
  /** Text extraction tolerance */
  textTolerance?: number;
  textXTolerance?: number | null;
  textYTolerance?: number | null;
  /** Intersection detection tolerance */
  intersectionTolerance?: number;
  intersectionXTolerance?: number | null;
  intersectionYTolerance?: number | null;
}

/** Options for visual debugging/image rendering */
export interface RenderOptions {
  /** Resolution in DPI (default: 72) */
  resolution?: number;
  /** Or specify width in pixels */
  width?: number;
  /** Or specify height in pixels */
  height?: number;
  /** Scale factor (alternative to resolution) */
  scale?: number;
  /** Background color */
  background?: string;
  /** Anti-aliasing */
  antialias?: boolean;
}

/** Drawing options for visual debugging */
export interface DrawOptions {
  stroke?: string | null;
  fill?: string | null;
  strokeWidth?: number;
  strokeOpacity?: number;
  fillOpacity?: number;
}

/** Filter function for PDF objects */
export type FilterFn<T> = (obj: T) => boolean;

/** All PDF object types */
export type PDFObject = PDFChar | PDFLine | PDFRect | PDFCurve | PDFImage | PDFAnnotation;

/** Layout analysis parameters (from pdfminer) */
export interface LayoutParams {
  lineOverlap?: number;
  charMargin?: number;
  wordMargin?: number;
  lineMargin?: number;
  boxesFlow?: number | null;
  detectVertical?: boolean;
  allTexts?: boolean;
}

/** Options for opening a PDF */
export interface OpenOptions {
  /** Password for encrypted PDFs */
  password?: string;
  /** Layout analysis parameters */
  laparams?: LayoutParams;
  /** Unicode normalization form */
  unicodeNorm?: 'NFC' | 'NFD' | 'NFKC' | 'NFKD' | null;
  /** Throw on metadata parse errors */
  strictMetadata?: boolean;
  /** Attempt to repair malformed PDFs */
  repair?: boolean;
  /** Options for PDF repair */
  repairOptions?: {
    /** Try to fix missing EOF marker */
    fixEOF?: boolean;
    /** Try to fix corrupt xref table */
    rebuildXref?: boolean;
    /** Try to recover from linearization errors */
    ignoreLinearization?: boolean;
    /** Maximum size to process (default: 100MB) */
    maxSize?: number;
  };
  /** Enable CMap support for CJK characters (default: true) */
  enableCMap?: boolean;
  /** Enable font substitution for missing fonts (default: true) */
  enableFontSubstitution?: boolean;
}

/** Options for crop and bbox operations */
export interface CropOptions {
  /** If true, bbox coordinates are relative to the current crop box */
  relative?: boolean;
  /** If true, only include objects entirely within bbox (not just overlapping) */
  strict?: boolean;
}

/** Options for batch page processing */
export interface ProcessingOptions {
  /** Maximum number of pages to process concurrently (default: 4, min: 1) */
  concurrency?: number;
  /** Flush page cache after processing each page to save memory (default: true for large PDFs) */
  flushAfterProcess?: boolean;
  /** Progress callback called after each page is processed */
  onProgress?: (processed: number, total: number, pageNumber: number) => void;
  /** Signal for aborting the operation */
  signal?: AbortSignal;
  /** If true, stop processing on first error. If false, continue and collect errors (default: false) */
  stopOnError?: boolean;
}

/** Error information from page processing */
export interface ProcessingError {
  /** Page index (0-based) */
  pageIndex: number;
  /** Page number (1-based) */
  pageNumber: number;
  /** Error message */
  message: string;
  /** Original error */
  error: Error;
}

/** Result from batch page processing */
export interface ProcessingResult<T> {
  /** Results from each page (undefined for failed pages) */
  results: (T | undefined)[];
  /** Number of pages successfully processed */
  pagesProcessed: number;
  /** Number of pages that failed */
  pagesFailed: number;
  /** Processing time in milliseconds */
  duration: number;
  /** Whether processing was aborted */
  aborted: boolean;
  /** Errors from failed pages */
  errors: ProcessingError[];
}
