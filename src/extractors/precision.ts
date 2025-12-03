/**
 * Precision Extraction Module
 *
 * Complete operator sequence state machine for precise character positioning.
 */

import type { PDFPageProxy } from 'pdfjs-dist';
import type { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api.js';
import type { Color, Matrix, PDFChar } from '../types.js';

/** PDF Operator codes from pdf.js OPS enum */
const OPS = {
  // Graphics state
  save: 10,
  restore: 11,
  transform: 12,

  // Color operators
  setStrokeColorSpace: 20,
  setFillColorSpace: 21,
  setStrokeColor: 22,
  setStrokeColorN: 23,
  setFillColor: 24,
  setFillColorN: 25,
  setStrokeGray: 26,
  setFillGray: 27,
  setStrokeRGBColor: 28,
  setFillRGBColor: 29,
  setStrokeCMYKColor: 30,
  setFillCMYKColor: 31,

  // Text operators
  beginText: 37,
  endText: 38,
  setCharSpacing: 39,
  setWordSpacing: 40,
  setHScale: 41,
  setLeading: 42,
  setFont: 43,
  setTextRenderingMode: 44,
  setTextRise: 45,
  moveText: 46,
  setLeadingMoveText: 47,
  setTextMatrix: 48,
  nextLine: 49,
  showText: 50,
  showSpacedText: 51,
  nextLineShowText: 52,
  nextLineSetSpacingShowText: 53,

  // Graphics state operators
  setLineWidth: 3,
  setLineCap: 4,
  setLineJoin: 5,
  setMiterLimit: 6,
  setDash: 7,
};

/**
 * Complete graphics state as per PDF specification
 */
export interface GraphicsState {
  /** Current transformation matrix [a, b, c, d, e, f] */
  ctm: number[];
  /** Stroking (outline) color */
  strokingColor: Color;
  /** Non-stroking (fill) color */
  nonStrokingColor: Color;
  /** Line width */
  lineWidth: number;
  /** Line cap style (0=butt, 1=round, 2=square) */
  lineCap: number;
  /** Line join style (0=miter, 1=round, 2=bevel) */
  lineJoin: number;
  /** Miter limit */
  miterLimit: number;
  /** Dash pattern [dashArray, dashPhase] */
  dash: [number[], number] | null;
}

/**
 * Text state as per PDF specification
 */
export interface TextState {
  /** Character spacing (Tc) */
  charSpacing: number;
  /** Word spacing (Tw) */
  wordSpacing: number;
  /** Horizontal scaling (Th) - percentage, 100 = normal */
  horizontalScale: number;
  /** Leading (Tl) - line spacing */
  leading: number;
  /** Font name */
  fontName: string | null;
  /** Font size (Tfs) */
  fontSize: number;
  /** Text rendering mode (Tmode) */
  renderingMode: number;
  /** Text rise (Trise) - baseline shift */
  textRise: number;
}

/**
 * Complete state snapshot at a text position
 */
export interface StateSnapshot {
  graphicsState: GraphicsState;
  textState: TextState;
  /** Text matrix (Tm) */
  textMatrix: number[];
  /** Text line matrix (Tlm) */
  textLineMatrix: number[];
  /** Combined transformation: CTM * Tm */
  combinedMatrix: number[];
}

/**
 * Precise position data for a character
 */
export interface PrecisePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  baseline: number;
  ascent: number;
  descent: number;
  textRise: number;
  rotationAngle: number;
}

/**
 * PDFStateTracker - Complete state machine for PDF operator sequence
 *
 * Tracks all graphics and text state changes through the operator list,
 * enabling precise character positioning without accumulation errors.
 */
export class PDFStateTracker {
  private graphicsStateStack: GraphicsState[] = [];
  private currentGraphicsState: GraphicsState;
  private currentTextState: TextState;
  private textMatrix: number[] = [1, 0, 0, 1, 0, 0];
  private textLineMatrix: number[] = [1, 0, 0, 1, 0, 0];
  private inTextBlock: boolean = false;
  private pageHeight: number;

  /** Map of positions to state snapshots (LRU-style with max limit) */
  private stateSnapshots: Map<string, StateSnapshot> = new Map();
  private static readonly MAX_SNAPSHOTS = 10000;

  constructor(pageHeight: number) {
    this.pageHeight = pageHeight;
    this.currentGraphicsState = this.createDefaultGraphicsState();
    this.currentTextState = this.createDefaultTextState();
  }

  private createDefaultGraphicsState(): GraphicsState {
    return {
      ctm: [1, 0, 0, 1, 0, 0],
      strokingColor: null,
      nonStrokingColor: null,
      lineWidth: 1,
      lineCap: 0,
      lineJoin: 0,
      miterLimit: 10,
      dash: null,
    };
  }

  private createDefaultTextState(): TextState {
    return {
      charSpacing: 0,
      wordSpacing: 0,
      horizontalScale: 100,
      leading: 0,
      fontName: null,
      fontSize: 0,
      renderingMode: 0,
      textRise: 0,
    };
  }

  /**
   * Process the complete operator list and build state snapshots
   */
  processOperatorList(opList: { fnArray: number[]; argsArray: any[] }): void {
    for (let i = 0; i < opList.fnArray.length; i++) {
      const op = opList.fnArray[i];
      const args = opList.argsArray[i] || [];
      this.processOperator(op, args);
    }
  }

  /**
   * Process a single operator
   */
  private processOperator(op: number, args: any[]): void {
    switch (op) {
      // Graphics state operators
      case OPS.save:
        this.save();
        break;

      case OPS.restore:
        this.restore();
        break;

      case OPS.transform:
        if (args.length >= 6) {
          this.transform(args);
        }
        break;

      case OPS.setLineWidth:
        if (args.length >= 1) {
          this.currentGraphicsState.lineWidth = args[0];
        }
        break;

      case OPS.setLineCap:
        if (args.length >= 1) {
          this.currentGraphicsState.lineCap = args[0];
        }
        break;

      case OPS.setLineJoin:
        if (args.length >= 1) {
          this.currentGraphicsState.lineJoin = args[0];
        }
        break;

      case OPS.setMiterLimit:
        if (args.length >= 1) {
          this.currentGraphicsState.miterLimit = args[0];
        }
        break;

      case OPS.setDash:
        if (args.length >= 2) {
          this.currentGraphicsState.dash = [args[0], args[1]];
        }
        break;

      // Color operators
      case OPS.setStrokeGray:
        if (args.length >= 1) {
          this.currentGraphicsState.strokingColor = args[0];
        }
        break;

      case OPS.setFillGray:
        if (args.length >= 1) {
          this.currentGraphicsState.nonStrokingColor = args[0];
        }
        break;

      case OPS.setStrokeRGBColor:
        if (args.length >= 3) {
          this.currentGraphicsState.strokingColor = [args[0], args[1], args[2]];
        }
        break;

      case OPS.setFillRGBColor:
        if (args.length >= 3) {
          this.currentGraphicsState.nonStrokingColor = [args[0], args[1], args[2]];
        }
        break;

      case OPS.setStrokeCMYKColor:
        if (args.length >= 4) {
          this.currentGraphicsState.strokingColor = [args[0], args[1], args[2], args[3]];
        }
        break;

      case OPS.setFillCMYKColor:
        if (args.length >= 4) {
          this.currentGraphicsState.nonStrokingColor = [args[0], args[1], args[2], args[3]];
        }
        break;

      case OPS.setStrokeColor:
      case OPS.setStrokeColorN:
        this.currentGraphicsState.strokingColor = this.parseColorArgs(args);
        break;

      case OPS.setFillColor:
      case OPS.setFillColorN:
        this.currentGraphicsState.nonStrokingColor = this.parseColorArgs(args);
        break;

      // Text state operators
      case OPS.setCharSpacing:
        if (args.length >= 1) {
          this.currentTextState.charSpacing = args[0];
        }
        break;

      case OPS.setWordSpacing:
        if (args.length >= 1) {
          this.currentTextState.wordSpacing = args[0];
        }
        break;

      case OPS.setHScale:
        if (args.length >= 1) {
          this.currentTextState.horizontalScale = args[0];
        }
        break;

      case OPS.setLeading:
        if (args.length >= 1) {
          this.currentTextState.leading = args[0];
        }
        break;

      case OPS.setFont:
        if (args.length >= 2) {
          this.currentTextState.fontName = args[0];
          this.currentTextState.fontSize = args[1];
        }
        break;

      case OPS.setTextRenderingMode:
        if (args.length >= 1) {
          this.currentTextState.renderingMode = args[0];
        }
        break;

      case OPS.setTextRise:
        if (args.length >= 1) {
          this.currentTextState.textRise = args[0];
        }
        break;

      // Text positioning operators
      case OPS.beginText:
        this.beginText();
        break;

      case OPS.endText:
        this.endText();
        break;

      case OPS.setTextMatrix:
        if (args.length >= 6) {
          this.setTextMatrix(args);
        }
        break;

      case OPS.moveText:
        if (args.length >= 2) {
          this.moveText(args[0], args[1]);
        }
        break;

      case OPS.setLeadingMoveText:
        if (args.length >= 2) {
          this.currentTextState.leading = -args[1];
          this.moveText(args[0], args[1]);
        }
        break;

      case OPS.nextLine:
        this.nextLine();
        break;

      // Text showing operators - record state snapshot
      case OPS.showText:
      case OPS.showSpacedText:
      case OPS.nextLineShowText:
      case OPS.nextLineSetSpacingShowText:
        if (op === OPS.nextLineShowText || op === OPS.nextLineSetSpacingShowText) {
          this.nextLine();
        }
        if (op === OPS.nextLineSetSpacingShowText && args.length >= 3) {
          this.currentTextState.wordSpacing = args[0];
          this.currentTextState.charSpacing = args[1];
        }
        if (this.inTextBlock) {
          this.recordStateSnapshot();
        }
        break;
    }
  }

  private parseColorArgs(args: any[]): Color {
    if (!args || args.length === 0) return null;
    if (args.length === 1) return args[0];
    if (args.length === 3) return [args[0], args[1], args[2]];
    if (args.length >= 4) return [args[0], args[1], args[2], args[3]];
    return null;
  }

  private save(): void {
    this.graphicsStateStack.push({ ...this.currentGraphicsState });
  }

  private restore(): void {
    if (this.graphicsStateStack.length > 0) {
      this.currentGraphicsState = this.graphicsStateStack.pop()!;
    }
  }

  private transform(args: number[]): void {
    this.currentGraphicsState.ctm = this.multiplyMatrices(
      this.currentGraphicsState.ctm,
      args
    );
  }

  private beginText(): void {
    this.inTextBlock = true;
    this.textMatrix = [1, 0, 0, 1, 0, 0];
    this.textLineMatrix = [1, 0, 0, 1, 0, 0];
  }

  private endText(): void {
    this.inTextBlock = false;
  }

  private setTextMatrix(args: number[]): void {
    this.textMatrix = [...args];
    this.textLineMatrix = [...args];
  }

  private moveText(tx: number, ty: number): void {
    // Td operator: Tm = Tlm * [1 0 0 1 tx ty]
    const [a, b, c, d, e, f] = this.textLineMatrix;
    this.textLineMatrix = [
      a, b, c, d,
      e + tx * a + ty * c,
      f + tx * b + ty * d,
    ];
    this.textMatrix = [...this.textLineMatrix];
  }

  private nextLine(): void {
    // T* operator: move to start of next line using leading
    this.moveText(0, -this.currentTextState.leading);
  }

  private recordStateSnapshot(): void {
    // Calculate position in user space
    const combinedMatrix = this.multiplyMatrices(
      this.currentGraphicsState.ctm,
      this.textMatrix
    );

    const x = Math.round(combinedMatrix[4]);
    const y = Math.round(this.pageHeight - combinedMatrix[5]);

    // Create position key with tolerance
    const key = `${Math.floor(x / 5) * 5},${Math.floor(y / 5) * 5}`;

    // Enforce max size limit (simple eviction of oldest entries)
    if (this.stateSnapshots.size >= PDFStateTracker.MAX_SNAPSHOTS) {
      const firstKey = this.stateSnapshots.keys().next().value;
      if (firstKey !== undefined) {
        this.stateSnapshots.delete(firstKey);
      }
    }

    this.stateSnapshots.set(key, {
      graphicsState: { ...this.currentGraphicsState },
      textState: { ...this.currentTextState },
      textMatrix: [...this.textMatrix],
      textLineMatrix: [...this.textLineMatrix],
      combinedMatrix: [...combinedMatrix],
    });
  }

  /**
   * Get state snapshot at a position
   */
  getStateAt(x: number, y: number): StateSnapshot | null {
    const key = `${Math.floor(x / 5) * 5},${Math.floor(y / 5) * 5}`;
    let state = this.stateSnapshots.get(key);

    if (!state) {
      // Try nearby positions
      for (let dx = -10; dx <= 10; dx += 5) {
        for (let dy = -10; dy <= 10; dy += 5) {
          const nearbyKey = `${Math.floor(x / 5) * 5 + dx},${Math.floor(y / 5) * 5 + dy}`;
          state = this.stateSnapshots.get(nearbyKey);
          if (state) break;
        }
        if (state) break;
      }
    }

    return state || null;
  }

  /**
   * Get all recorded state snapshots
   */
  getAllSnapshots(): Map<string, StateSnapshot> {
    return this.stateSnapshots;
  }

  /**
   * Calculate precise position for a character
   */
  calculatePrecisePosition(
    x: number,
    y: number,
    fontSize: number,
    charWidth: number,
    ascent: number = 0.8,
    descent: number = 0.2
  ): PrecisePosition {
    const state = this.getStateAt(x, y);

    if (!state) {
      // Return basic position without state
      return {
        x,
        y,
        width: charWidth,
        height: fontSize,
        baseline: y + fontSize * ascent,
        ascent: fontSize * ascent,
        descent: fontSize * descent,
        textRise: 0,
        rotationAngle: 0,
      };
    }

    const { textState, combinedMatrix } = state;

    // Apply text rise
    const adjustedY = y - textState.textRise;

    // Calculate rotation from combined matrix
    const rotationAngle = Math.atan2(combinedMatrix[1], combinedMatrix[0]) * (180 / Math.PI);

    // Apply horizontal scaling
    const hScale = textState.horizontalScale / 100;
    const adjustedWidth = charWidth * hScale;

    return {
      x,
      y: adjustedY,
      width: adjustedWidth,
      height: fontSize,
      baseline: adjustedY + fontSize * ascent,
      ascent: fontSize * ascent,
      descent: fontSize * descent,
      textRise: textState.textRise,
      rotationAngle,
    };
  }

  /**
   * Multiply two transformation matrices
   */
  private multiplyMatrices(m1: number[], m2: number[]): number[] {
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
  }
}

/**
 * Extract characters with maximum precision using the state tracker
 */
export async function extractCharsWithPrecision(
  page: PDFPageProxy,
  pageNumber: number,
  pageHeight: number,
  doctopOffset: number = 0,
  unicodeNorm?: 'NFC' | 'NFD' | 'NFKC' | 'NFKD' | null
): Promise<PDFChar[]> {
  const [textContent, opList] = await Promise.all([
    page.getTextContent(),
    page.getOperatorList(),
  ]);

  const tracker = new PDFStateTracker(pageHeight);
  tracker.processOperatorList(opList);

  return extractCharsWithTracker(
    textContent,
    tracker,
    pageNumber,
    pageHeight,
    doctopOffset,
    unicodeNorm
  );
}

/**
 * Extract characters using the state tracker
 */
function extractCharsWithTracker(
  textContent: TextContent,
  tracker: PDFStateTracker,
  pageNumber: number,
  pageHeight: number,
  doctopOffset: number,
  unicodeNorm?: 'NFC' | 'NFD' | 'NFKC' | 'NFKD' | null
): PDFChar[] {
  const chars: PDFChar[] = [];

  for (const item of textContent.items) {
    if (!('str' in item)) continue;

    const textItem = item as TextItem;
    const { str, transform, fontName, width: totalWidth, height: itemHeight } = textItem;

    if (!str && !textItem.hasEOL) continue;

    const [scaleX, skewY, skewX, scaleY, x, y] = transform;
    const calculatedFontSize = Math.sqrt(scaleX * scaleX + skewY * skewY);
    const fontSize = (itemHeight && itemHeight > 0) ? itemHeight : calculatedFontSize;
    const isUpright = Math.abs(skewX) < 0.01 && Math.abs(skewY) < 0.01;
    const flippedY = pageHeight - y;
    const state = tracker.getStateAt(x, flippedY);
    const textState = state?.textState || {
      charSpacing: 0,
      wordSpacing: 0,
      horizontalScale: 100,
      textRise: 0,
    };
    const colors = {
      strokingColor: state?.graphicsState.strokingColor || null,
      nonStrokingColor: state?.graphicsState.nonStrokingColor || null,
    };

    const charCount = str.length || 1;
    const baseCharWidth = totalWidth / charCount;
    const hScale = textState.horizontalScale / 100;
    const textRise = textState.textRise || 0;
    let currentX = x;

    for (let i = 0; i < str.length; i++) {
      let charText = str[i];

      if (unicodeNorm && charText) {
        charText = charText.normalize(unicodeNorm);
      }

      const precisePos = tracker.calculatePrecisePosition(
        currentX,
        flippedY,
        fontSize,
        baseCharWidth * hScale
      );

      const charSpacingUserSpace = (textState.charSpacing || 0) * fontSize / 1000;
      const isSpace = charText === ' ';
      const wordSpacingUserSpace = isSpace ? (textState.wordSpacing || 0) * fontSize / 1000 : 0;

      const adjustedWidth = precisePos.width * Math.abs(scaleX);
      const charHeight = Math.abs(fontSize);
      const adjustedY0 = precisePos.y - charHeight;
      const adjustedY1 = precisePos.y;

      chars.push({
        text: charText,
        x0: currentX,
        y0: adjustedY0,
        x1: currentX + adjustedWidth,
        y1: adjustedY1,
        width: adjustedWidth,
        height: charHeight,
        top: adjustedY0,
        bottom: adjustedY1,
        doctop: doctopOffset + adjustedY0,
        fontName: fontName || 'unknown',
        size: fontSize,
        adv: adjustedWidth + charSpacingUserSpace + wordSpacingUserSpace,
        upright: isUpright,
        matrix: transform as Matrix,
        strokingColor: colors.strokingColor,
        nonStrokingColor: colors.nonStrokingColor,
        pageNumber,
      });

      currentX += adjustedWidth + charSpacingUserSpace + wordSpacingUserSpace;
    }
  }

  return chars;
}

/**
 * Create a state tracker for a page
 * Useful for advanced analysis and debugging
 */
export async function createStateTracker(
  page: PDFPageProxy,
  pageHeight: number
): Promise<PDFStateTracker> {
  const opList = await page.getOperatorList();
  const tracker = new PDFStateTracker(pageHeight);
  tracker.processOperatorList(opList);
  return tracker;
}
