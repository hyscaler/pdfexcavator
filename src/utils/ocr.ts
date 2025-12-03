/**
 * OCR Integration for Scanned PDFs
 * Uses Tesseract.js for optical character recognition
 */

import type { PDFChar, PDFWord, PDFTextLine, Matrix } from '../types.js';

/**
 * OCR configuration options
 */
export interface OCROptions {
  /** Tesseract language(s) to use (default: 'eng') */
  lang?: string;
  /** OCR Engine Mode (0=Legacy, 1=LSTM, 2=Legacy+LSTM, 3=Default) */
  oem?: number;
  /** Page Segmentation Mode (see Tesseract docs) */
  psm?: number;
  /** Custom tesseract parameters */
  tesseractParams?: Record<string, string>;
  /** Minimum confidence to include a word (0-100, default: 60) */
  minConfidence?: number;
  /** Whether to preserve whitespace */
  preserveWhitespace?: boolean;
  /** Worker pool size for parallel processing */
  workerCount?: number;
  /** Path to trained data files (for Node.js) */
  langPath?: string;
  /** Whether to log progress */
  logger?: (message: string) => void;
}

/**
 * OCR result for a page
 */
export interface OCRResult {
  /** Extracted text */
  text: string;
  /** Extracted characters with positions */
  chars: PDFChar[];
  /** Extracted words with positions */
  words: PDFWord[];
  /** Extracted lines with positions */
  lines: PDFTextLine[];
  /** Average confidence (0-100) */
  confidence: number;
  /** Time taken in ms */
  processingTime: number;
  /** Whether OCR was actually performed */
  ocrPerformed: boolean;
}

/**
 * OCR word from Tesseract
 */
interface TesseractWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
  baseline?: { x0: number; y0: number; x1: number; y1: number };
  font_name?: string;
  font_size?: number;
}

/**
 * OCR line from Tesseract
 */
interface TesseractLine {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  words: TesseractWord[];
  confidence: number;
}

/**
 * Tesseract recognition result
 */
interface TesseractResult {
  data: {
    text: string;
    lines: TesseractLine[];
    words: TesseractWord[];
    confidence: number;
  };
}

// Tesseract worker type
type TesseractWorker = {
  loadLanguage: (lang: string) => Promise<void>;
  initialize: (lang: string) => Promise<void>;
  setParameters: (params: Record<string, string>) => Promise<void>;
  recognize: (image: Buffer | string) => Promise<TesseractResult>;
  terminate: () => Promise<void>;
};

// Lazy-loaded Tesseract module
let tesseractModule: any = null;
let tesseractWorkerPool: TesseractWorker[] = [];
let tesseractInitialized = false;

/**
 * Dynamically import tesseract.js
 * This allows the library to work even if tesseract.js is not installed
 */
async function loadTesseract(): Promise<any> {
  if (tesseractModule) return tesseractModule;

  // Use dynamic import with a variable to avoid TypeScript compile errors
  const moduleName = 'tesseract.js';
  tesseractModule = await (Function('moduleName', 'return import(moduleName)')(moduleName));
  return tesseractModule;
}

/**
 * Check if Tesseract.js is available
 */
export async function isTesseractAvailable(): Promise<boolean> {
  try {
    await loadTesseract();
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize Tesseract worker(s)
 */
async function initTesseract(options: OCROptions = {}): Promise<TesseractWorker> {
  const mod = await loadTesseract();

  const { createWorker } = mod;

  const workerOptions: any = {};

  if (options.langPath) {
    workerOptions.langPath = options.langPath;
  }

  if (options.logger) {
    workerOptions.logger = (m: any) => options.logger?.(m.status || JSON.stringify(m));
  }

  const worker = await createWorker(workerOptions);

  const lang = options.lang || 'eng';
  await worker.loadLanguage(lang);
  await worker.initialize(lang);

  // Set OEM and PSM if specified
  const params: Record<string, string> = {};
  if (options.oem !== undefined) {
    params['tessedit_ocr_engine_mode'] = options.oem.toString();
  }
  if (options.psm !== undefined) {
    params['tessedit_pageseg_mode'] = options.psm.toString();
  }
  if (options.tesseractParams) {
    Object.assign(params, options.tesseractParams);
  }

  if (Object.keys(params).length > 0) {
    await worker.setParameters(params);
  }

  return worker as TesseractWorker;
}

/**
 * Get or create a Tesseract worker
 */
async function getWorker(options: OCROptions = {}): Promise<TesseractWorker> {
  if (tesseractWorkerPool.length > 0) {
    return tesseractWorkerPool.pop()!;
  }
  return initTesseract(options);
}

/**
 * Return a worker to the pool
 */
function returnWorker(worker: TesseractWorker): void {
  tesseractWorkerPool.push(worker);
}

/**
 * Terminate all workers
 */
export async function terminateOCR(): Promise<void> {
  for (const worker of tesseractWorkerPool) {
    await worker.terminate();
  }
  tesseractWorkerPool = [];
  tesseractInitialized = false;
}

/**
 * Perform OCR on an image buffer
 * @param imageBuffer PNG or JPEG image data
 * @param pageNumber Page number for the result
 * @param pageHeight Page height for coordinate conversion
 * @param doctopOffset Document top offset
 * @param options OCR options
 */
export async function performOCR(
  imageBuffer: Buffer,
  pageNumber: number,
  pageHeight: number,
  doctopOffset: number,
  options: OCROptions = {}
): Promise<OCRResult> {
  const startTime = Date.now();
  const minConfidence = options.minConfidence ?? 60;

  // Check if Tesseract is available
  if (!(await isTesseractAvailable())) {
    throw new Error(
      'Tesseract.js is not installed. Install it with: npm install tesseract.js'
    );
  }

  const worker = await getWorker(options);

  try {
    const result = await worker.recognize(imageBuffer);

    // Convert Tesseract results to PDFLens format
    const chars: PDFChar[] = [];
    const words: PDFWord[] = [];
    const lines: PDFTextLine[] = [];

    // Default transformation matrix
    const defaultMatrix: Matrix = [1, 0, 0, 1, 0, 0];

    for (const tesseractLine of result.data.lines) {
      if (tesseractLine.confidence < minConfidence) continue;

      const lineChars: PDFChar[] = [];
      const lineWords: PDFWord[] = [];

      for (const tesseractWord of tesseractLine.words) {
        if (tesseractWord.confidence < minConfidence) continue;

        const wordChars: PDFChar[] = [];
        const wordText = tesseractWord.text;
        const wordBBox = tesseractWord.bbox;

        // Estimate character positions within the word
        const charWidth = (wordBBox.x1 - wordBBox.x0) / wordText.length;

        for (let i = 0; i < wordText.length; i++) {
          const charX0 = wordBBox.x0 + i * charWidth;
          const charX1 = charX0 + charWidth;

          const char: PDFChar = {
            text: wordText[i],
            x0: charX0,
            y0: wordBBox.y0,
            x1: charX1,
            y1: wordBBox.y1,
            width: charWidth,
            height: wordBBox.y1 - wordBBox.y0,
            top: wordBBox.y0,
            bottom: wordBBox.y1,
            doctop: doctopOffset + wordBBox.y0,
            fontName: tesseractWord.font_name || 'OCR-detected',
            size: tesseractWord.font_size || 12,
            adv: charWidth,
            upright: true,
            matrix: defaultMatrix,
            strokingColor: null,
            nonStrokingColor: [0, 0, 0],
            pageNumber,
          };

          wordChars.push(char);
          lineChars.push(char);
          chars.push(char);
        }

        // Create word
        const word: PDFWord = {
          text: wordText,
          x0: wordBBox.x0,
          y0: wordBBox.y0,
          x1: wordBBox.x1,
          y1: wordBBox.y1,
          top: wordBBox.y0,
          bottom: wordBBox.y1,
          doctop: doctopOffset + wordBBox.y0,
          chars: wordChars,
          direction: 'ltr',
          upright: true,
        };

        lineWords.push(word);
        words.push(word);
      }

      // Create line
      if (lineChars.length > 0) {
        const line: PDFTextLine = {
          text: tesseractLine.text,
          x0: tesseractLine.bbox.x0,
          y0: tesseractLine.bbox.y0,
          x1: tesseractLine.bbox.x1,
          y1: tesseractLine.bbox.y1,
          top: tesseractLine.bbox.y0,
          bottom: tesseractLine.bbox.y1,
          doctop: doctopOffset + tesseractLine.bbox.y0,
          chars: lineChars,
          words: lineWords,
        };

        lines.push(line);
      }
    }

    return {
      text: result.data.text,
      chars,
      words,
      lines,
      confidence: result.data.confidence,
      processingTime: Date.now() - startTime,
      ocrPerformed: true,
    };
  } finally {
    returnWorker(worker);
  }
}

/**
 * Detect if a page likely needs OCR
 * A page needs OCR if it has images but little or no text
 * @param charCount Number of characters on the page
 * @param imageCount Number of images on the page
 * @param pageArea Total page area
 * @param imageArea Total image area
 */
export function needsOCR(
  charCount: number,
  imageCount: number,
  pageArea: number,
  imageArea: number
): boolean {
  // If page has enough text, no OCR needed
  if (charCount > 50) return false;

  // If no images, OCR won't help
  if (imageCount === 0) return false;

  // If images cover more than 50% of the page and there's little text
  const imageCoverageRatio = imageArea / pageArea;
  if (imageCoverageRatio > 0.5 && charCount < 20) {
    return true;
  }

  // If there are images and very little text
  if (imageCount > 0 && charCount < 10) {
    return true;
  }

  return false;
}

/**
 * Estimate if a page is a scanned document
 * Scanned documents typically have:
 * - Large images covering most of the page
 * - No embedded text or very little text
 * - Images at page-level resolution
 */
export function isLikelyScanned(
  charCount: number,
  images: Array<{ width: number; height: number; srcSize: [number, number] }>,
  pageWidth: number,
  pageHeight: number
): boolean {
  // If there's substantial text, it's not a scan
  if (charCount > 100) return false;

  const pageArea = pageWidth * pageHeight;

  for (const img of images) {
    const imgArea = img.width * img.height;
    const coverageRatio = imgArea / pageArea;

    // Image covers most of the page
    if (coverageRatio > 0.8) {
      // Check if source resolution is high (typical for scans)
      const [srcWidth, srcHeight] = img.srcSize;
      const dpi = Math.max(srcWidth / img.width, srcHeight / img.height) * 72;

      // Scans are typically 150-600 DPI
      if (dpi > 100) {
        return true;
      }
    }
  }

  return false;
}

/**
 * OCR Engine wrapper for managing workers and options
 */
export class OCREngine {
  private options: OCROptions;
  private initialized: boolean = false;

  constructor(options: OCROptions = {}) {
    this.options = options;
  }

  /**
   * Initialize the OCR engine
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!(await isTesseractAvailable())) {
      throw new Error(
        'Tesseract.js is not installed. Install it with: npm install tesseract.js'
      );
    }

    // Pre-initialize workers based on workerCount
    const workerCount = this.options.workerCount || 1;
    for (let i = 0; i < workerCount; i++) {
      const worker = await initTesseract(this.options);
      tesseractWorkerPool.push(worker);
    }

    this.initialized = true;
  }

  /**
   * Perform OCR on an image
   */
  async recognize(
    imageBuffer: Buffer,
    pageNumber: number,
    pageHeight: number,
    doctopOffset: number
  ): Promise<OCRResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    return performOCR(imageBuffer, pageNumber, pageHeight, doctopOffset, this.options);
  }

  /**
   * Terminate the OCR engine and release resources
   */
  async terminate(): Promise<void> {
    await terminateOCR();
    this.initialized = false;
  }

  /**
   * Check if OCR is available
   */
  async isAvailable(): Promise<boolean> {
    return isTesseractAvailable();
  }
}

/**
 * Supported OCR languages
 * See: https://tesseract-ocr.github.io/tessdoc/Data-Files-in-different-versions.html
 */
export const OCR_LANGUAGES = {
  // Common languages
  eng: 'English',
  chi_sim: 'Chinese (Simplified)',
  chi_tra: 'Chinese (Traditional)',
  jpn: 'Japanese',
  kor: 'Korean',
  ara: 'Arabic',
  rus: 'Russian',
  fra: 'French',
  deu: 'German',
  spa: 'Spanish',
  por: 'Portuguese',
  ita: 'Italian',
  hin: 'Hindi',
  tha: 'Thai',
  vie: 'Vietnamese',

  // Special
  osd: 'Orientation and Script Detection',
  equ: 'Math/Equation detection',
} as const;

/**
 * Page Segmentation Modes
 */
export const PSM_MODES = {
  OSD_ONLY: 0,              // Orientation and script detection only
  AUTO_OSD: 1,              // Automatic page segmentation with OSD
  AUTO_ONLY: 2,             // Automatic page segmentation without OSD or OCR
  AUTO: 3,                  // Fully automatic page segmentation without OSD (default)
  SINGLE_COLUMN: 4,         // Assume a single column of text
  SINGLE_BLOCK_VERT: 5,     // Assume a single uniform block of vertically aligned text
  SINGLE_BLOCK: 6,          // Assume a single uniform block of text
  SINGLE_LINE: 7,           // Treat the image as a single text line
  SINGLE_WORD: 8,           // Treat the image as a single word
  CIRCLE_WORD: 9,           // Treat the image as a single word in a circle
  SINGLE_CHAR: 10,          // Treat the image as a single character
  SPARSE_TEXT: 11,          // Find as much text as possible in no particular order
  SPARSE_TEXT_OSD: 12,      // Sparse text with OSD
  RAW_LINE: 13,             // Treat the image as a single text line (no hacks)
} as const;

/**
 * OCR Engine Modes
 */
export const OEM_MODES = {
  LEGACY_ONLY: 0,           // Legacy engine only
  LSTM_ONLY: 1,             // Neural net LSTM engine only
  LEGACY_LSTM: 2,           // Legacy + LSTM engines
  DEFAULT: 3,               // Default (currently LSTM)
} as const;
