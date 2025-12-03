/**
 * Enhanced character extraction with color support
 * Correlates text content with operator list to extract colors
 */

import type { PDFPageProxy } from 'pdfjs-dist';
import type { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api.js';
import type { Color, Matrix, PDFChar } from '../types.js';

/** Graphics state for tracking colors */
interface GraphicsState {
  strokingColor: Color;
  nonStrokingColor: Color;
  lineWidth: number;
  lineCap: number;
  lineJoin: number;
  dash: [number[], number] | null;
  ctm: number[];
}

/** Text state for tracking spacing operators */
export interface TextState {
  /** Character spacing (operator 39) - extra space between chars in glyph space units */
  charSpacing: number;
  /** Word spacing (operator 40) - extra space after space chars in glyph space units */
  wordSpacing: number;
  /** Horizontal scaling (operator 41) - percentage, 100 = normal */
  horizontalScale: number;
  /** Text rise (operator 45) - baseline shift for super/subscript */
  textRise: number;
  /** Current font name */
  fontName: string | null;
  /** Current font size */
  fontSize: number;
}

/** PDF Operator codes from pdf.js */
const OPS = {
  // Graphics state
  save: 10,
  restore: 11,
  transform: 12,

  // Path construction
  moveTo: 13,
  lineTo: 14,
  curveTo: 15,
  curveTo2: 16,
  curveTo3: 17,
  closePath: 18,
  rectangle: 19,

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

  // Path painting
  stroke: 64,
  closeStroke: 65,
  fill: 66,
  eoFill: 67,
  fillStroke: 68,
  eoFillStroke: 69,
  closeFillStroke: 70,
  closeEOFillStroke: 71,
  endPath: 72,

  // Graphics state operators
  setLineWidth: 3,
  setLineCap: 4,
  setLineJoin: 5,
  setMiterLimit: 6,
  setDash: 7,

  // XObject
  paintXObject: 85,
  paintImageXObject: 85,
};

/** Extract characters with full color information */
export async function extractCharsWithColors(
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

  const colorMap = buildColorMap(opList, pageHeight);

  return extractCharsFromContent(
    textContent,
    colorMap,
    pageNumber,
    pageHeight,
    doctopOffset,
    unicodeNorm
  );
}

/** Combined state for position mapping */
interface PositionState {
  strokingColor: Color;
  nonStrokingColor: Color;
  textState: TextState;
}

/** Build a map of positions to color and text state by tracking operators */
function buildStateMap(
  opList: { fnArray: number[]; argsArray: any[] },
  pageHeight: number
): Map<string, PositionState> {
  const stateMap = new Map<string, PositionState>();
  const stateStack: GraphicsState[] = [];
  let currentGraphicsState: GraphicsState = {
    strokingColor: null,
    nonStrokingColor: null,
    lineWidth: 1,
    lineCap: 0,
    lineJoin: 0,
    dash: null,
    ctm: [1, 0, 0, 1, 0, 0],
  };

  let currentTextState: TextState = {
    charSpacing: 0,
    wordSpacing: 0,
    horizontalScale: 100,
    textRise: 0,
    fontName: null,
    fontSize: 0,
  };

  let inTextBlock = false;
  let textMatrix = [1, 0, 0, 1, 0, 0];
  let textLineMatrix = [1, 0, 0, 1, 0, 0];

  for (let i = 0; i < opList.fnArray.length; i++) {
    const op = opList.fnArray[i];
    const args = opList.argsArray[i];

    switch (op) {
      case OPS.save:
        stateStack.push({ ...currentGraphicsState });
        break;

      case OPS.restore:
        if (stateStack.length > 0) {
          currentGraphicsState = stateStack.pop()!;
        }
        break;

      case OPS.transform:
        if (args && args.length >= 6) {
          currentGraphicsState.ctm = multiplyMatrix(currentGraphicsState.ctm, args);
        }
        break;

      case OPS.setStrokeGray:
        if (args && args.length >= 1) {
          currentGraphicsState.strokingColor = args[0];
        }
        break;

      case OPS.setStrokeRGBColor:
        if (args && args.length >= 3) {
          currentGraphicsState.strokingColor = [args[0], args[1], args[2]];
        }
        break;

      case OPS.setStrokeCMYKColor:
        if (args && args.length >= 4) {
          currentGraphicsState.strokingColor = [args[0], args[1], args[2], args[3]];
        }
        break;

      case OPS.setStrokeColor:
      case OPS.setStrokeColorN:
        if (args) {
          if (args.length === 1) {
            currentGraphicsState.strokingColor = args[0];
          } else if (args.length === 3) {
            currentGraphicsState.strokingColor = [args[0], args[1], args[2]];
          } else if (args.length >= 4) {
            currentGraphicsState.strokingColor = [args[0], args[1], args[2], args[3]];
          }
        }
        break;

      case OPS.setFillGray:
        if (args && args.length >= 1) {
          currentGraphicsState.nonStrokingColor = args[0];
        }
        break;

      case OPS.setFillRGBColor:
        if (args && args.length >= 3) {
          currentGraphicsState.nonStrokingColor = [args[0], args[1], args[2]];
        }
        break;

      case OPS.setFillCMYKColor:
        if (args && args.length >= 4) {
          currentGraphicsState.nonStrokingColor = [args[0], args[1], args[2], args[3]];
        }
        break;

      case OPS.setFillColor:
      case OPS.setFillColorN:
        if (args) {
          if (args.length === 1) {
            currentGraphicsState.nonStrokingColor = args[0];
          } else if (args.length === 3) {
            currentGraphicsState.nonStrokingColor = [args[0], args[1], args[2]];
          } else if (args.length >= 4) {
            currentGraphicsState.nonStrokingColor = [args[0], args[1], args[2], args[3]];
          }
        }
        break;

      case OPS.setCharSpacing:
        if (args && args.length >= 1) {
          currentTextState.charSpacing = args[0];
        }
        break;

      case OPS.setWordSpacing:
        if (args && args.length >= 1) {
          currentTextState.wordSpacing = args[0];
        }
        break;

      case OPS.setHScale:
        if (args && args.length >= 1) {
          currentTextState.horizontalScale = args[0];
        }
        break;

      case OPS.setTextRise:
        if (args && args.length >= 1) {
          currentTextState.textRise = args[0];
        }
        break;

      case OPS.setFont:
        if (args && args.length >= 2) {
          currentTextState.fontName = args[0];
          currentTextState.fontSize = args[1];
        }
        break;

      case OPS.beginText:
        inTextBlock = true;
        textMatrix = [1, 0, 0, 1, 0, 0];
        textLineMatrix = [1, 0, 0, 1, 0, 0];
        break;

      case OPS.endText:
        inTextBlock = false;
        break;

      case OPS.setTextMatrix:
        if (args && args.length >= 6) {
          textMatrix = [...args];
          textLineMatrix = [...args];
        }
        break;

      case OPS.moveText:
        if (args && args.length >= 2) {
          textLineMatrix = [
            textLineMatrix[0], textLineMatrix[1],
            textLineMatrix[2], textLineMatrix[3],
            textLineMatrix[4] + args[0] * textLineMatrix[0] + args[1] * textLineMatrix[2],
            textLineMatrix[5] + args[0] * textLineMatrix[1] + args[1] * textLineMatrix[3],
          ];
          textMatrix = [...textLineMatrix];
        }
        break;

      case OPS.showText:
      case OPS.showSpacedText:
      case OPS.nextLineShowText:
      case OPS.nextLineSetSpacingShowText:
        if (inTextBlock) {
          const fullMatrix = multiplyMatrix(currentGraphicsState.ctm, textMatrix);
          const x = Math.round(fullMatrix[4]);
          const y = Math.round(pageHeight - fullMatrix[5]);
          const key = `${Math.floor(x / 5) * 5},${Math.floor(y / 5) * 5}`;
          stateMap.set(key, {
            strokingColor: currentGraphicsState.strokingColor,
            nonStrokingColor: currentGraphicsState.nonStrokingColor,
            textState: { ...currentTextState },
          });
        }
        break;
    }
  }

  return stateMap;
}

/**
 * Build a map of approximate positions to colors
 * by tracking graphics state through operators
 * @deprecated Use buildStateMap for full state tracking
 */
function buildColorMap(
  opList: { fnArray: number[]; argsArray: any[] },
  pageHeight: number
): Map<string, { strokingColor: Color; nonStrokingColor: Color }> {
  const colorMap = new Map<string, { strokingColor: Color; nonStrokingColor: Color }>();
  const stateStack: GraphicsState[] = [];
  let currentState: GraphicsState = {
    strokingColor: null,
    nonStrokingColor: null,
    lineWidth: 1,
    lineCap: 0,
    lineJoin: 0,
    dash: null,
    ctm: [1, 0, 0, 1, 0, 0],
  };

  let inTextBlock = false;
  let textMatrix = [1, 0, 0, 1, 0, 0];
  let textLineMatrix = [1, 0, 0, 1, 0, 0];

  for (let i = 0; i < opList.fnArray.length; i++) {
    const op = opList.fnArray[i];
    const args = opList.argsArray[i];

    switch (op) {
      case OPS.save:
        stateStack.push({ ...currentState });
        break;

      case OPS.restore:
        if (stateStack.length > 0) {
          currentState = stateStack.pop()!;
        }
        break;

      case OPS.transform:
        if (args && args.length >= 6) {
          currentState.ctm = multiplyMatrix(currentState.ctm, args);
        }
        break;

      case OPS.setStrokeGray:
        if (args && args.length >= 1) {
          currentState.strokingColor = args[0];
        }
        break;

      case OPS.setStrokeRGBColor:
        if (args && args.length >= 3) {
          currentState.strokingColor = [args[0], args[1], args[2]];
        }
        break;

      case OPS.setStrokeCMYKColor:
        if (args && args.length >= 4) {
          currentState.strokingColor = [args[0], args[1], args[2], args[3]];
        }
        break;

      case OPS.setStrokeColor:
      case OPS.setStrokeColorN:
        if (args) {
          if (args.length === 1) {
            currentState.strokingColor = args[0];
          } else if (args.length === 3) {
            currentState.strokingColor = [args[0], args[1], args[2]];
          } else if (args.length >= 4) {
            currentState.strokingColor = [args[0], args[1], args[2], args[3]];
          }
        }
        break;

      case OPS.setFillGray:
        if (args && args.length >= 1) {
          currentState.nonStrokingColor = args[0];
        }
        break;

      case OPS.setFillRGBColor:
        if (args && args.length >= 3) {
          currentState.nonStrokingColor = [args[0], args[1], args[2]];
        }
        break;

      case OPS.setFillCMYKColor:
        if (args && args.length >= 4) {
          currentState.nonStrokingColor = [args[0], args[1], args[2], args[3]];
        }
        break;

      case OPS.setFillColor:
      case OPS.setFillColorN:
        if (args) {
          if (args.length === 1) {
            currentState.nonStrokingColor = args[0];
          } else if (args.length === 3) {
            currentState.nonStrokingColor = [args[0], args[1], args[2]];
          } else if (args.length >= 4) {
            currentState.nonStrokingColor = [args[0], args[1], args[2], args[3]];
          }
        }
        break;

      case OPS.beginText:
        inTextBlock = true;
        textMatrix = [1, 0, 0, 1, 0, 0];
        textLineMatrix = [1, 0, 0, 1, 0, 0];
        break;

      case OPS.endText:
        inTextBlock = false;
        break;

      case OPS.setTextMatrix:
        if (args && args.length >= 6) {
          textMatrix = [...args];
          textLineMatrix = [...args];
        }
        break;

      case OPS.moveText:
        if (args && args.length >= 2) {
          textLineMatrix = [
            textLineMatrix[0], textLineMatrix[1],
            textLineMatrix[2], textLineMatrix[3],
            textLineMatrix[4] + args[0] * textLineMatrix[0] + args[1] * textLineMatrix[2],
            textLineMatrix[5] + args[0] * textLineMatrix[1] + args[1] * textLineMatrix[3],
          ];
          textMatrix = [...textLineMatrix];
        }
        break;

      case OPS.showText:
      case OPS.showSpacedText:
      case OPS.nextLineShowText:
      case OPS.nextLineSetSpacingShowText:
        if (inTextBlock) {
          const fullMatrix = multiplyMatrix(currentState.ctm, textMatrix);
          const x = Math.round(fullMatrix[4]);
          const y = Math.round(pageHeight - fullMatrix[5]);
          const key = `${Math.floor(x / 5) * 5},${Math.floor(y / 5) * 5}`;
          colorMap.set(key, {
            strokingColor: currentState.strokingColor,
            nonStrokingColor: currentState.nonStrokingColor,
          });
        }
        break;
    }
  }

  return colorMap;
}

/**
 * Extract characters from text content with color information
 */
function extractCharsFromContent(
  textContent: TextContent,
  colorMap: Map<string, { strokingColor: Color; nonStrokingColor: Color }>,
  pageNumber: number,
  pageHeight: number,
  doctopOffset: number,
  unicodeNorm?: 'NFC' | 'NFD' | 'NFKC' | 'NFKD' | null
): PDFChar[] {
  const chars: PDFChar[] = [];

  for (const item of textContent.items) {
    if (!('str' in item)) continue;

    const textItem = item as TextItem;
    const { str, transform, fontName, width: totalWidth } = textItem;

    if (!str && !textItem.hasEOL) continue;

    const [scaleX, skewY, skewX, scaleY, x, y] = transform;
    const fontSize = Math.sqrt(scaleX * scaleX + skewY * skewY);
    const isUpright = Math.abs(skewX) < 0.01 && Math.abs(skewY) < 0.01;
    const flippedY = pageHeight - y;
    const posKey = `${Math.floor(x / 5) * 5},${Math.floor(flippedY / 5) * 5}`;
    const colors = colorMap.get(posKey) || { strokingColor: null, nonStrokingColor: null };
    let finalColors = colors;
    if (!colors.nonStrokingColor) {
      for (let dx = -10; dx <= 10; dx += 5) {
        for (let dy = -10; dy <= 10; dy += 5) {
          const nearbyKey = `${Math.floor(x / 5) * 5 + dx},${Math.floor(flippedY / 5) * 5 + dy}`;
          const nearbyColors = colorMap.get(nearbyKey);
          if (nearbyColors?.nonStrokingColor) {
            finalColors = nearbyColors;
            break;
          }
        }
        if (finalColors.nonStrokingColor) break;
      }
    }

    const charCount = str.length || 1;
    const avgCharWidth = totalWidth / charCount;

    for (let i = 0; i < str.length; i++) {
      let charText = str[i];

      if (unicodeNorm && charText) {
        charText = charText.normalize(unicodeNorm);
      }

      const charX = x + i * avgCharWidth * Math.abs(scaleX);
      const charWidth = avgCharWidth * Math.abs(scaleX);
      const charHeight = Math.abs(fontSize);
      const charY0 = flippedY - charHeight;
      const charY1 = flippedY;

      chars.push({
        text: charText,
        x0: charX,
        y0: charY0,
        x1: charX + charWidth,
        y1: charY1,
        width: charWidth,
        height: charHeight,
        top: charY0,
        bottom: charY1,
        doctop: doctopOffset + charY0,
        fontName: fontName || 'unknown',
        size: fontSize,
        adv: charWidth,
        upright: isUpright,
        matrix: transform as Matrix,
        strokingColor: finalColors.strokingColor,
        nonStrokingColor: finalColors.nonStrokingColor,
        pageNumber,
      });
    }
  }

  return chars;
}

/**
 * Multiply two transformation matrices
 */
function multiplyMatrix(m1: number[], m2: number[]): number[] {
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

/** Extract characters with full spacing and color information */
export async function extractCharsWithSpacing(
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

  const stateMap = buildStateMap(opList, pageHeight);
  return extractCharsWithStateMap(
    textContent,
    stateMap,
    pageNumber,
    pageHeight,
    doctopOffset,
    unicodeNorm
  );
}

/** Extract characters using state map with spacing adjustments */
function extractCharsWithStateMap(
  textContent: TextContent,
  stateMap: Map<string, PositionState>,
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

    const posKey = `${Math.floor(x / 5) * 5},${Math.floor(flippedY / 5) * 5}`;
    let state = stateMap.get(posKey);

    if (!state) {
      for (let dx = -10; dx <= 10; dx += 5) {
        for (let dy = -10; dy <= 10; dy += 5) {
          const nearbyKey = `${Math.floor(x / 5) * 5 + dx},${Math.floor(flippedY / 5) * 5 + dy}`;
          state = stateMap.get(nearbyKey);
          if (state) break;
        }
        if (state) break;
      }
    }

    const textState: TextState = state?.textState || {
      charSpacing: 0,
      wordSpacing: 0,
      horizontalScale: 100,
      textRise: 0,
      fontName: null,
      fontSize: 0,
    };
    const colors = {
      strokingColor: state?.strokingColor || null,
      nonStrokingColor: state?.nonStrokingColor || null,
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

      let charWidth = baseCharWidth * hScale;
      const charSpacingUserSpace = (textState.charSpacing || 0) * fontSize / 1000;
      const isSpace = charText === ' ';
      const wordSpacingUserSpace = isSpace ? (textState.wordSpacing || 0) * fontSize / 1000 : 0;
      const adjustedWidth = charWidth * Math.abs(scaleX);
      const charHeight = Math.abs(fontSize);
      const adjustedY0 = flippedY - charHeight - textRise;
      const adjustedY1 = flippedY - textRise;

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

/** Get text state at a specific position on the page */
export async function getTextStateAt(
  page: PDFPageProxy,
  x: number,
  y: number,
  pageHeight: number
): Promise<TextState | null> {
  const opList = await page.getOperatorList();
  const stateMap = buildStateMap(opList, pageHeight);

  const posKey = `${Math.floor(x / 5) * 5},${Math.floor(y / 5) * 5}`;
  const state = stateMap.get(posKey);

  return state?.textState || null;
}
