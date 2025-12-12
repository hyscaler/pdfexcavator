/**
 * PageImage class for visual debugging
 * Provides drawing methods for annotating PDF page renders
 */

import type { BBox, DrawOptions, RenderOptions } from './types.js';
import { resolve, normalize } from 'path';

/**
 * Validate file path to prevent path traversal attacks
 */
function validateSavePath(inputPath: string, basePath?: string): string {
  // Check for null bytes (path truncation attack)
  if (inputPath.includes('\0')) {
    throw new Error('Invalid path: contains invalid characters');
  }

  const normalizedPath = normalize(resolve(inputPath));

  // If a base path is provided, ensure the resolved path is within it
  if (basePath) {
    const normalizedBase = normalize(resolve(basePath));
    if (!normalizedPath.startsWith(normalizedBase)) {
      throw new Error('Path traversal detected: path resolves outside allowed directory');
    }
  }

  return normalizedPath;
}

export interface DrawRectOptions extends DrawOptions {
  radius?: number;
}

export interface DrawCircleOptions extends DrawOptions {
  radius?: number;
}

export interface DrawLineOptions {
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  dash?: number[];
}

/**
 * PageImage class for visual debugging
 * Wraps a canvas with drawing methods
 */
export class PageImage {
  private _canvas: any;
  private _context: any;
  private _scale: number;
  private _originalImageData: any = null; // Canvas ImageData

  constructor(canvas: any, scale: number = 1) {
    this._canvas = canvas;
    this._context = canvas.getContext('2d');
    this._scale = scale;
    // Store original for reset
    this._originalImageData = this._context.getImageData(0, 0, canvas.width, canvas.height);
  }

  /** Get canvas width */
  get width(): number {
    return this._canvas.width;
  }

  /** Get canvas height */
  get height(): number {
    return this._canvas.height;
  }

  /** Get the scale factor */
  get scale(): number {
    return this._scale;
  }

  /** Reset to original rendered page (clear all drawings) */
  reset(): PageImage {
    if (this._originalImageData) {
      this._context.putImageData(this._originalImageData, 0, 0);
    }
    return this;
  }

  /** Create a copy of this PageImage */
  async copy(): Promise<PageImage> {
    const canvasModule = await this._getCanvasModule();
    const { createCanvas } = canvasModule.default || canvasModule;
    const newCanvas = createCanvas(this._canvas.width, this._canvas.height);
    const newContext = newCanvas.getContext('2d');
    newContext.drawImage(this._canvas, 0, 0);

    const copy = new PageImage(newCanvas, this._scale);
    return copy;
  }

  /** Draw a single rectangle on the image */
  drawRect(
    rect: { x0: number; y0: number; x1: number; y1: number } | BBox,
    options: DrawRectOptions = {}
  ): PageImage {
    const r = Array.isArray(rect)
      ? { x0: rect[0], y0: rect[1], x1: rect[2], y1: rect[3] }
      : rect;
    return this.drawRects([r], options);
  }

  /** Draw rectangles on the image */
  drawRects(
    rects: Array<{ x0: number; y0: number; x1: number; y1: number }>,
    options: DrawRectOptions = {}
  ): PageImage {
    const {
      stroke = 'red',
      fill,
      strokeWidth = 1,
      strokeOpacity = 1,
      fillOpacity = 0.3,
      radius = 0,
    } = options;

    for (const rect of rects) {
      const x = rect.x0 * this._scale;
      const y = rect.y0 * this._scale;
      const width = (rect.x1 - rect.x0) * this._scale;
      const height = (rect.y1 - rect.y0) * this._scale;

      this._context.save();

      if (fill) {
        this._context.globalAlpha = fillOpacity;
        this._context.fillStyle = fill;
        if (radius > 0) {
          this._roundRect(x, y, width, height, radius);
          this._context.fill();
        } else {
          this._context.fillRect(x, y, width, height);
        }
      }

      if (stroke) {
        this._context.globalAlpha = strokeOpacity;
        this._context.strokeStyle = stroke;
        this._context.lineWidth = strokeWidth;
        if (radius > 0) {
          this._roundRect(x, y, width, height, radius);
          this._context.stroke();
        } else {
          this._context.strokeRect(x, y, width, height);
        }
      }

      this._context.restore();
    }

    return this;
  }

  /** Draw a single line on the image */
  drawLine(
    line: { x0: number; y0: number; x1: number; y1: number },
    options: DrawLineOptions = {}
  ): PageImage {
    return this.drawLines([line], options);
  }

  /** Draw lines on the image */
  drawLines(
    lines: Array<{ x0: number; y0: number; x1: number; y1: number }>,
    options: DrawLineOptions = {}
  ): PageImage {
    const {
      stroke = 'red',
      strokeWidth = 1,
      strokeOpacity = 1,
      dash,
    } = options;

    this._context.save();
    this._context.globalAlpha = strokeOpacity;
    this._context.strokeStyle = stroke;
    this._context.lineWidth = strokeWidth;

    if (dash) {
      this._context.setLineDash(dash);
    }

    for (const line of lines) {
      this._context.beginPath();
      this._context.moveTo(line.x0 * this._scale, line.y0 * this._scale);
      this._context.lineTo(line.x1 * this._scale, line.y1 * this._scale);
      this._context.stroke();
    }

    this._context.restore();
    return this;
  }

  /** Draw a vertical line at x position (full height) */
  drawVLine(x: number, options: DrawLineOptions = {}): PageImage {
    return this.drawLine(
      { x0: x, y0: 0, x1: x, y1: this.height / this._scale },
      options
    );
  }

  /** Draw multiple vertical lines */
  drawVLines(xPositions: number[], options: DrawLineOptions = {}): PageImage {
    const lines = xPositions.map(x => ({
      x0: x, y0: 0, x1: x, y1: this.height / this._scale
    }));
    return this.drawLines(lines, options);
  }

  /** Draw a horizontal line at y position (full width) */
  drawHLine(y: number, options: DrawLineOptions = {}): PageImage {
    return this.drawLine(
      { x0: 0, y0: y, x1: this.width / this._scale, y1: y },
      options
    );
  }

  /** Draw multiple horizontal lines */
  drawHLines(yPositions: number[], options: DrawLineOptions = {}): PageImage {
    const lines = yPositions.map(y => ({
      x0: 0, y0: y, x1: this.width / this._scale, y1: y
    }));
    return this.drawLines(lines, options);
  }

  /** Draw circles on the image */
  drawCircles(
    points: Array<{ x: number; y: number }>,
    options: DrawCircleOptions = {}
  ): PageImage {
    const {
      stroke = 'red',
      fill = 'red',
      strokeWidth = 1,
      strokeOpacity = 1,
      fillOpacity = 0.5,
      radius = 5,
    } = options;

    for (const point of points) {
      const x = point.x * this._scale;
      const y = point.y * this._scale;

      this._context.save();
      this._context.beginPath();
      this._context.arc(x, y, radius, 0, Math.PI * 2);

      if (fill) {
        this._context.globalAlpha = fillOpacity;
        this._context.fillStyle = fill;
        this._context.fill();
      }

      if (stroke) {
        this._context.globalAlpha = strokeOpacity;
        this._context.strokeStyle = stroke;
        this._context.lineWidth = strokeWidth;
        this._context.stroke();
      }

      this._context.restore();
    }

    return this;
  }

  /** Draw a single circle on the image */
  drawCircle(
    point: { x: number; y: number },
    options: DrawCircleOptions = {}
  ): PageImage {
    return this.drawCircles([point], options);
  }

  /** Draw points (small circles) on the image */
  drawPoints(
    points: Array<{ x: number; y: number }>,
    options: DrawCircleOptions = {}
  ): PageImage {
    return this.drawCircles(points, { radius: 3, ...options });
  }

  /** Draw text on the image */
  drawText(
    text: string,
    x: number,
    y: number,
    options: { font?: string; fill?: string; stroke?: string; strokeWidth?: number } = {}
  ): PageImage {
    const {
      font = '12px sans-serif',
      fill = 'black',
      stroke,
      strokeWidth = 1,
    } = options;

    this._context.save();
    this._context.font = font;

    if (fill) {
      this._context.fillStyle = fill;
      this._context.fillText(text, x * this._scale, y * this._scale);
    }

    if (stroke) {
      this._context.strokeStyle = stroke;
      this._context.lineWidth = strokeWidth;
      this._context.strokeText(text, x * this._scale, y * this._scale);
    }

    this._context.restore();
    return this;
  }

  /** Outline specific objects */
  drawBBoxes(
    objects: Array<{ x0: number; y0: number; x1: number; y1: number }>,
    options: DrawRectOptions = {}
  ): PageImage {
    return this.drawRects(objects, options);
  }

  /** Save image to buffer (PNG format) */
  toBuffer(format: 'png' | 'jpeg' = 'png'): Buffer {
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    return this._canvas.toBuffer(mimeType);
  }

  /** Save image to file */
  async save(
    path: string,
    options: { format?: 'png' | 'jpeg'; quality?: number; basePath?: string } = {}
  ): Promise<void> {
    if (!path) {
      throw new Error('Path is required to save image');
    }

    // Validate path to prevent path traversal attacks
    const safePath = validateSavePath(path, options.basePath);

    try {
      const { format = 'png' } = options;
      const buffer = this.toBuffer(format);

      const { writeFile } = await import('fs/promises');
      await writeFile(safePath, buffer);
    } catch (error) {
      // Avoid leaking full path in error messages for security
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to save image: ${message}`);
    }
  }

  /** Debug table finder visualization */
  debugTableFinder(
    result: {
      edges: Array<{ x0: number; y0: number; x1: number; y1: number }>;
      intersections: Array<{ x: number; y: number }>;
      tables: Array<{ bbox: BBox | [number, number, number, number] }>;
    },
    options: {
      edgeColor?: string;
      intersectionColor?: string;
      tableColor?: string;
      tableFillOpacity?: number;
    } = {}
  ): PageImage {
    const {
      edgeColor = 'red',
      intersectionColor = 'blue',
      tableColor = 'lightblue',
      tableFillOpacity = 0.3,
    } = options;

    // Draw edges (red lines)
    if (result.edges && result.edges.length > 0) {
      this.drawLines(result.edges, { stroke: edgeColor, strokeWidth: 1 });
    }

    // Draw intersections (blue circles)
    if (result.intersections && result.intersections.length > 0) {
      this.drawCircles(result.intersections, {
        fill: intersectionColor,
        stroke: intersectionColor,
        radius: 3,
        fillOpacity: 0.7,
      });
    }

    // Draw tables (light blue fill)
    if (result.tables && result.tables.length > 0) {
      const tableRects = result.tables.map(t => {
        const bbox = t.bbox;
        return Array.isArray(bbox)
          ? { x0: bbox[0], y0: bbox[1], x1: bbox[2], y1: bbox[3] }
          : bbox;
      });
      this.drawRects(tableRects, {
        fill: tableColor,
        fillOpacity: tableFillOpacity,
        stroke: 'blue',
        strokeWidth: 2,
      });
    }

    return this;
  }

  /** Show image (opens in default viewer - Node.js only) */
  async show(): Promise<void> {
    const { tmpdir } = await import('os');
    const { join } = await import('path');
    const { exec } = await import('child_process');
    const { unlink } = await import('fs/promises');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const tempPath = join(tmpdir(), `pdfexcavator-${Date.now()}.png`);
    await this.save(tempPath);

    // Open with default viewer based on platform
    const platform = process.platform;
    const command =
      platform === 'darwin'
        ? `open "${tempPath}"`
        : platform === 'win32'
          ? `start "" "${tempPath}"`
          : `xdg-open "${tempPath}"`;

    await execAsync(command);

    // Schedule cleanup after a delay to allow viewer to open
    setTimeout(async () => {
      try {
        await unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }, 5000);
  }

  /** Helper to draw rounded rectangles */
  private _roundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    this._context.beginPath();
    this._context.moveTo(x + radius, y);
    this._context.lineTo(x + width - radius, y);
    this._context.quadraticCurveTo(x + width, y, x + width, y + radius);
    this._context.lineTo(x + width, y + height - radius);
    this._context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this._context.lineTo(x + radius, y + height);
    this._context.quadraticCurveTo(x, y + height, x, y + height - radius);
    this._context.lineTo(x, y + radius);
    this._context.quadraticCurveTo(x, y, x + radius, y);
    this._context.closePath();
  }

  /** Get canvas module (for copy operation) */
  private async _getCanvasModule(): Promise<any> {
    // Using dynamic import for ESM compatibility
    // Canvas is an optional peer dependency
    try {
      return await import('canvas');
    } catch {
      throw new Error('Canvas module not available. Install with: npm install canvas');
    }
  }
}

/**
 * Create a PageImage from a PDF page
 */
export async function createPageImage(
  page: any, // PDFPageProxy
  pageHeight: number,
  options: RenderOptions = {}
): Promise<PageImage> {
  const { resolution = 72, width, height, scale, background = 'white', antialias = false } = options;

  // Calculate scale from resolution or explicit dimensions
  let finalScale: number;
  const pageWidth = page.getViewport({ scale: 1 }).width;
  const pageHeightPts = page.getViewport({ scale: 1 }).height;

  if (scale) {
    finalScale = scale;
  } else if (width) {
    finalScale = width / pageWidth;
  } else if (height) {
    finalScale = height / pageHeightPts;
  } else {
    finalScale = resolution / 72;
  }

  // Dynamic import for canvas
  let createCanvas: any;
  try {
    // @ts-ignore
    const canvasModule = await import(/* webpackIgnore: true */ 'canvas');
    createCanvas = canvasModule.createCanvas;
  } catch {
    throw new Error(
      'Visual rendering requires the "canvas" package. Install it with: npm install canvas'
    );
  }

  const viewport = page.getViewport({ scale: finalScale });
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext('2d');

  // Set anti-aliasing
  context.imageSmoothingEnabled = antialias;

  // Fill background
  context.fillStyle = background;
  context.fillRect(0, 0, viewport.width, viewport.height);

  // Render PDF page
  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  return new PageImage(canvas, finalScale);
}
