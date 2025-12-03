/**
 * PDFLens - Main document class
 * Optimized with lazy page loading
 */

// Use legacy build for Node.js compatibility
// @ts-ignore - legacy build import
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Page } from './Page.js';
import type { OpenOptions, PDFMetadata, TextExtractionOptions, ProcessingOptions, ProcessingResult, ProcessingError } from './types.js';
import {
  repairPDF,
  analyzePDF,
  isPDFLike,
  extractRawText,
  type RepairResult,
  type RepairOptions,
} from './utils/repair.js';
import {
  getDefaultCMapConfig,
  NodeCMapReaderFactory,
  normalizeCJKText,
  type CMapConfig,
} from './utils/cmap.js';

// Get functions from pdf.js
const getDocument = pdfjsLib.getDocument;

// Set up worker for Node.js environment
// Find the worker file path relative to pdfjs-dist
const workerPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
);
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;

// Cache CMap config
let cachedCMapConfig: CMapConfig | null | undefined = undefined;

export class PDFLens {
  private _document: PDFDocumentProxy;
  private _pages: Page[] = [];
  private _pageProxies: Map<number, Page> = new Map();
  private _metadata: PDFMetadata | null = null;
  private _path: string | null;
  private _options: OpenOptions;
  private _doctopOffsets: number[] = [];
  private _repairResult: RepairResult | null = null;

  private constructor(
    document: PDFDocumentProxy,
    options: OpenOptions,
    path: string | null = null,
    repairResult: RepairResult | null = null
  ) {
    this._document = document;
    this._path = path;
    this._options = options;
    this._repairResult = repairResult;
  }

  /**
   * Open a PDF file from a path
   * @param path Path to PDF file
   * @param options Open options (including repair options)
   */
  static async open(path: string, options: OpenOptions = {}): Promise<PDFLens> {
    const data = await readFile(path);
    return PDFLens.openFromData(data, options, path);
  }

  /**
   * Open a PDF from a Buffer
   */
  static async fromBuffer(buffer: Buffer, options: OpenOptions = {}): Promise<PDFLens> {
    return PDFLens.openFromData(buffer, options);
  }

  /**
   * Open a PDF from a Uint8Array
   */
  static async fromUint8Array(data: Uint8Array, options: OpenOptions = {}): Promise<PDFLens> {
    return PDFLens.openFromData(data, options);
  }

  /**
   * Internal method to open PDF from data with repair support
   */
  private static async openFromData(
    data: Buffer | Uint8Array,
    options: OpenOptions,
    path: string | null = null
  ): Promise<PDFLens> {
    let workingData: Uint8Array = data instanceof Buffer ? new Uint8Array(data) : data;
    let repairResult: RepairResult | null = null;

    // Get CMap configuration (cached)
    if (cachedCMapConfig === undefined) {
      cachedCMapConfig = await getDefaultCMapConfig();
    }

    // Try repair if enabled or if initial load fails
    const tryWithRepair = async (attemptRepair: boolean): Promise<PDFLens> => {
      if (attemptRepair) {
        repairResult = repairPDF(workingData, options.repairOptions);
        if (repairResult.repaired && repairResult.data) {
          workingData = repairResult.data;
        }
      }

      // Build pdf.js options
      const pdfOptions: any = {
        data: workingData,
        password: options.password,
        // Disable worker for Node.js compatibility
        disableWorker: true,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
        // Enable pdf.js recovery mode for malformed PDFs
        stopAtErrors: false,
        // Standard fonts
        standardFontDataUrl: undefined,
      };

      // Add CMap configuration for CJK support
      if (cachedCMapConfig) {
        pdfOptions.cMapUrl = cachedCMapConfig.cMapUrl;
        pdfOptions.cMapPacked = cachedCMapConfig.cMapPacked;
      }

      // Enable CMap support explicitly
      if (options.enableCMap !== false && cachedCMapConfig) {
        pdfOptions.CMapReaderFactory = NodeCMapReaderFactory;
      }

      const document = await getDocument(pdfOptions).promise;

      const instance = new PDFLens(document, options, path, repairResult);
      await instance.loadPages();
      return instance;
    };

    // If repair is explicitly requested, try it first
    if (options.repair) {
      return tryWithRepair(true);
    }

    // Otherwise, try normal load first, then repair on failure
    try {
      return await tryWithRepair(false);
    } catch (error: any) {
      // Check if it looks like a PDF
      if (!isPDFLike(workingData)) {
        throw new Error('File does not appear to be a PDF');
      }

      // Try with repair
      try {
        console.warn(`PDF load failed, attempting repair: ${error.message}`);
        return await tryWithRepair(true);
      } catch (repairError: any) {
        // If repair also fails, throw with both errors
        throw new Error(
          `Failed to open PDF: ${error.message}. ` +
          `Repair attempt also failed: ${repairError.message}`
        );
      }
    }
  }

  /**
   * Get repair result (if repair was attempted)
   */
  get repairResult(): RepairResult | null {
    return this._repairResult;
  }

  /**
   * Check if the PDF was repaired when opening
   */
  get wasRepaired(): boolean {
    return this._repairResult?.repaired ?? false;
  }

  /**
   * Get issues found during repair analysis
   */
  get repairIssues(): string[] {
    return this._repairResult?.issues ?? [];
  }

  /**
   * Analyze PDF structure without opening
   * Useful for diagnosing issues with malformed PDFs
   */
  static analyzePDF(data: Buffer | Uint8Array) {
    return analyzePDF(data);
  }

  /**
   * Extract raw text from a possibly corrupt PDF
   * This is a fallback method when normal parsing fails
   */
  static extractRawText(data: Buffer | Uint8Array): string[] {
    return extractRawText(data);
  }

  /**
   * Check if data looks like a PDF
   */
  static isPDFLike(data: Buffer | Uint8Array): boolean {
    return isPDFLike(data);
  }

  /**
   * Load all pages with doctop offsets calculated
   */
  private async loadPages(): Promise<void> {
    const numPages = this._document.numPages;
    this._pages = [];
    this._doctopOffsets = [];

    let doctopOffset = 0;

    for (let i = 1; i <= numPages; i++) {
      const pdfPage = await this._document.getPage(i);
      const viewport = pdfPage.getViewport({ scale: 1 });

      this._doctopOffsets.push(doctopOffset);

      const page = new Page(
        pdfPage,
        i - 1, // 0-indexed
        doctopOffset,
        this._options.unicodeNorm
      );

      this._pages.push(page);
      doctopOffset += viewport.height;
    }
  }

  /**
   * Get all pages
   */
  get pages(): Page[] {
    return this._pages;
  }

  /**
   * Get number of pages
   */
  get pageCount(): number {
    return this._pages.length;
  }

  /**
   * Get a specific page (0-indexed)
   */
  getPage(index: number): Page {
    if (index < 0 || index >= this._pages.length) {
      throw new Error(`Page index ${index} out of range (0-${this._pages.length - 1})`);
    }
    return this._pages[index];
  }

  /**
   * Get PDF metadata
   */
  async getMetadata(): Promise<PDFMetadata> {
    if (this._metadata !== null) {
      return this._metadata;
    }

    const pdfMetadata = await this._document.getMetadata();
    const info = pdfMetadata.info as Record<string, any>;

    let creationDate: Date | undefined;
    let modificationDate: Date | undefined;

    try {
      creationDate = info?.CreationDate ? this.parseDate(info.CreationDate) : undefined;
    } catch {
      if (this._options.strictMetadata) throw new Error('Failed to parse CreationDate');
    }

    try {
      modificationDate = info?.ModDate ? this.parseDate(info.ModDate) : undefined;
    } catch {
      if (this._options.strictMetadata) throw new Error('Failed to parse ModDate');
    }

    this._metadata = {
      title: info?.Title || undefined,
      author: info?.Author || undefined,
      subject: info?.Subject || undefined,
      keywords: info?.Keywords || undefined,
      creator: info?.Creator || undefined,
      producer: info?.Producer || undefined,
      creationDate,
      modificationDate,
      pageCount: this._document.numPages,
      pdfVersion: info?.PDFFormatVersion || undefined,
      isEncrypted: false,
      isLinearized: info?.IsLinearized || undefined,
    };

    return this._metadata;
  }

  /**
   * Alias for getMetadata()
   */
  get metadata(): Promise<PDFMetadata> {
    return this.getMetadata();
  }

  /**
   * Parse PDF date string
   */
  private parseDate(dateStr: string): Date | undefined {
    if (!dateStr) return undefined;

    // PDF dates are in format: D:YYYYMMDDHHmmSSOHH'mm'
    const match = dateStr.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
    if (!match) return undefined;

    const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );
  }

  /**
   * Extract text from all pages
   */
  async extractText(options?: TextExtractionOptions & { separator?: string }): Promise<string> {
    const { separator = '\n\n', ...textOptions } = options || {};
    const texts: string[] = [];

    for (const page of this._pages) {
      const text = await page.extractText(textOptions);
      texts.push(text);
    }

    return texts.join(separator);
  }

  /**
   * Extract tables from all pages
   */
  async extractTables(): Promise<Array<{ pageNumber: number; tables: any[] }>> {
    const results: Array<{ pageNumber: number; tables: any[] }> = [];

    for (const page of this._pages) {
      const tables = await page.extractTables();
      if (tables.length > 0) {
        results.push({
          pageNumber: page.pageNumber,
          tables,
        });
      }
    }

    return results;
  }

  /**
   * Search across all pages
   */
  async search(pattern: string | RegExp): Promise<Array<{ pageNumber: number; matches: any[] }>> {
    const results: Array<{ pageNumber: number; matches: any[] }> = [];

    for (const page of this._pages) {
      const matches = await page.search(pattern);
      if (matches.length > 0) {
        results.push({
          pageNumber: page.pageNumber,
          matches,
        });
      }
    }

    return results;
  }

  /**
   * Iterate over pages
   */
  [Symbol.iterator](): Iterator<Page> {
    return this._pages[Symbol.iterator]();
  }

  /**
   * Process pages with controlled concurrency and memory management
   * Use this for large PDFs to avoid memory issues and CPU overload
   *
   * @example
   * // Extract text from all pages with concurrency control
   * const result = await pdf.processPages(
   *   async (page) => await page.extractText(),
   *   { concurrency: 2, flushAfterProcess: true }
   * );
   *
   * @example
   * // With progress tracking and error handling
   * const result = await pdf.processPages(
   *   async (page) => await page.extractTables(),
   *   {
   *     concurrency: 4,
   *     onProgress: (done, total) => console.log(`${done}/${total}`),
   *     stopOnError: false // Continue even if some pages fail
   *   }
   * );
   * if (result.errors.length > 0) {
   *   console.log('Some pages failed:', result.errors);
   * }
   */
  async processPages<T>(
    processor: (page: Page, index: number) => Promise<T>,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult<T>> {
    const {
      concurrency: rawConcurrency = 4,
      flushAfterProcess = this._pages.length > 20,
      onProgress,
      signal,
      stopOnError = false,
    } = options;

    // Validate and clamp concurrency to at least 1
    const concurrency = Math.max(1, Math.floor(rawConcurrency));

    const startTime = Date.now();
    const results: (T | undefined)[] = new Array(this._pages.length).fill(undefined);
    const errors: ProcessingError[] = [];
    let processed = 0;
    let failed = 0;
    let aborted = false;
    let shouldStop = false;

    // Handle empty PDF
    if (this._pages.length === 0) {
      return {
        results: [],
        pagesProcessed: 0,
        pagesFailed: 0,
        duration: Date.now() - startTime,
        aborted: false,
        errors: [],
      };
    }

    // Process pages in batches based on concurrency
    const processBatch = async (startIndex: number): Promise<void> => {
      if (shouldStop || aborted) return;

      const endIndex = Math.min(startIndex + concurrency, this._pages.length);
      const batch: Promise<void>[] = [];

      for (let i = startIndex; i < endIndex; i++) {
        // Check abort signal before starting each page
        if (signal?.aborted) {
          aborted = true;
          shouldStop = true;
          return;
        }

        if (shouldStop) return;

        const page = this._pages[i];
        const pageIndex = i;

        batch.push(
          processor(page, pageIndex)
            .then((result) => {
              // Check if we should discard result due to abort/stop
              if (shouldStop) return;

              results[pageIndex] = result;
              processed++;

              if (flushAfterProcess) {
                page.flush();
              }

              onProgress?.(processed + failed, this._pages.length, page.pageNumber);
            })
            .catch((err) => {
              const error = err instanceof Error ? err : new Error(String(err));
              errors.push({
                pageIndex,
                pageNumber: page.pageNumber + 1,
                message: error.message,
                error,
              });
              failed++;

              // Always flush on error to free memory
              if (flushAfterProcess) {
                page.flush();
              }

              if (stopOnError) {
                shouldStop = true;
              }

              onProgress?.(processed + failed, this._pages.length, page.pageNumber);
            })
        );
      }

      // Wait for current batch to complete
      await Promise.all(batch);

      // Process next batch if not stopped
      if (endIndex < this._pages.length && !shouldStop && !aborted) {
        await processBatch(endIndex);
      }
    };

    await processBatch(0);

    return {
      results,
      pagesProcessed: processed,
      pagesFailed: failed,
      duration: Date.now() - startTime,
      aborted,
      errors,
    };
  }

  /**
   * Process pages sequentially (one at a time)
   * Most memory-efficient option for very large PDFs
   */
  async processPagesSequential<T>(
    processor: (page: Page, index: number) => Promise<T>,
    options: Omit<ProcessingOptions, 'concurrency'> = {}
  ): Promise<ProcessingResult<T>> {
    return this.processPages(processor, { ...options, concurrency: 1 });
  }

  /**
   * Flush all page caches to free memory
   */
  flush(): void {
    for (const page of this._pages) {
      page.flush();
    }
  }

  /**
   * Close the document and release resources
   */
  async close(): Promise<void> {
    this.flush();
    await this._document.destroy();
    this._pages = [];
    this._metadata = null;
  }

  /**
   * Get file path (if opened from file)
   */
  get path(): string | null {
    return this._path;
  }
}

/**
 * Convenience function to open a PDF
 * Usage: const pdf = await pdflens.open('file.pdf')
 */
export async function open(path: string, options: OpenOptions = {}): Promise<PDFLens> {
  return PDFLens.open(path, options);
}
