/**
 * Font metrics extraction utilities
 * Extracts font information from pdf.js for accurate character positioning
 */

import type { PDFPageProxy } from 'pdfjs-dist';
import type { TextContent } from 'pdfjs-dist/types/src/display/api.js';
import {
  findFontSubstitution,
  getFontMetrics as getSubstituteFontMetrics,
  FontSubstitutionManager,
  type FontSubstitution,
} from '../utils/fontSubstitution.js';

/** TextStyle from pdf.js TextContent (pre-computed font info) */
export interface TextStyle {
  fontFamily: string;
  ascent: number;
  descent: number;
  vertical: boolean;
}

/** Font metrics information */
export interface FontMetrics {
  fontName: string;
  /** Ascent (distance above baseline) as fraction of em */
  ascent: number;
  /** Descent (distance below baseline) as fraction of em - usually negative */
  descent: number;
  /** Default width for characters without specific width */
  defaultWidth: number;
  /** Whether font is vertical */
  vertical: boolean;
  /** Whether font is monospace */
  monospace: boolean;
  /** Character widths (unicode -> width in glyph units) */
  widths: Map<number, number>;
  /** Font family name */
  family?: string;
  /** Whether font is bold */
  bold: boolean;
  /** Whether font is italic */
  italic: boolean;
  /** Font substitution info (if font was substituted) */
  substitution?: FontSubstitution;
  /** Whether metrics came from TextStyle (most reliable source) */
  fromTextStyle?: boolean;
}

/** Global font substitution manager */
const fontSubstitutionManager = new FontSubstitutionManager();

/** Cache for font metrics by page */
const fontCache = new WeakMap<PDFPageProxy, Map<string, FontMetrics>>();

/** Extract font metrics from a PDF page */
export async function extractFontMetrics(
  page: PDFPageProxy,
  textContent?: TextContent
): Promise<Map<string, FontMetrics>> {
  // Check cache first (without textContent, since styles override anyway)
  if (!textContent && fontCache.has(page)) {
    return fontCache.get(page)!;
  }

  const fontMap = new Map<string, FontMetrics>();
  const textStyles: Record<string, TextStyle> = {};
  if (textContent && (textContent as any).styles) {
    const styles = (textContent as any).styles as Record<string, TextStyle>;
    for (const [fontName, style] of Object.entries(styles)) {
      textStyles[fontName] = style;
    }
  }

  try {
    // Get operator list to find all font references
    const opList = await page.getOperatorList();
    const fontRefs = new Set<string>();

    // OPS.setFont = 43
    const SET_FONT = 43;
    for (let i = 0; i < opList.fnArray.length; i++) {
      if (opList.fnArray[i] === SET_FONT) {
        const fontName = opList.argsArray[i]?.[0];
        if (fontName) {
          fontRefs.add(fontName);
        }
      }
    }

    // Also add fonts from textContent items
    if (textContent) {
      for (const item of textContent.items) {
        if ('fontName' in item && item.fontName) {
          fontRefs.add(item.fontName as string);
        }
      }
    }

    // Extract metrics for each font
    for (const fontName of fontRefs) {
      // Check if we have TextStyle metrics (priority 1)
      const textStyle = textStyles[fontName];

      try {
        const fontFromObjs = await getFontData(page, fontName);

        if (textStyle) {
          const metrics: FontMetrics = fontFromObjs
            ? {
                ...fontFromObjs,
                // Override with TextStyle values (more accurate)
                ascent: textStyle.ascent,
                descent: textStyle.descent,
                vertical: textStyle.vertical,
                family: textStyle.fontFamily || fontFromObjs.family,
                fromTextStyle: true,
              }
            : {
                // Use TextStyle as primary source
                fontName,
                ascent: textStyle.ascent,
                descent: textStyle.descent,
                defaultWidth: 0.5, // Will use per-char widths when available
                vertical: textStyle.vertical,
                monospace: fontName.toLowerCase().includes('mono') ||
                           fontName.toLowerCase().includes('courier'),
                widths: new Map(),
                family: textStyle.fontFamily,
                bold: fontName.toLowerCase().includes('bold'),
                italic: fontName.toLowerCase().includes('italic') ||
                        fontName.toLowerCase().includes('oblique'),
                fromTextStyle: true,
              };

          fontMap.set(fontName, metrics);
        } else if (fontFromObjs) {
          fontMap.set(fontName, fontFromObjs);
        } else {
          fontMap.set(fontName, getDefaultFontMetrics(fontName));
        }
      } catch {
        // Font not available, try TextStyle or use defaults
        if (textStyle) {
          fontMap.set(fontName, {
            fontName,
            ascent: textStyle.ascent,
            descent: textStyle.descent,
            defaultWidth: 0.5,
            vertical: textStyle.vertical,
            monospace: fontName.toLowerCase().includes('mono'),
            widths: new Map(),
            family: textStyle.fontFamily,
            bold: fontName.toLowerCase().includes('bold'),
            italic: fontName.toLowerCase().includes('italic'),
            fromTextStyle: true,
          });
        } else {
          fontMap.set(fontName, getDefaultFontMetrics(fontName));
        }
      }
    }
  } catch {
    // Fallback: use TextStyles if available, otherwise defaults
    for (const [fontName, style] of Object.entries(textStyles)) {
      fontMap.set(fontName, {
        fontName,
        ascent: style.ascent,
        descent: style.descent,
        defaultWidth: 0.5,
        vertical: style.vertical,
        monospace: fontName.toLowerCase().includes('mono'),
        widths: new Map(),
        family: style.fontFamily,
        bold: fontName.toLowerCase().includes('bold'),
        italic: fontName.toLowerCase().includes('italic'),
        fromTextStyle: true,
      });
    }
  }

  // Cache the result (if no textContent, to allow reuse)
  if (!textContent) {
    fontCache.set(page, fontMap);
  }

  return fontMap;
}

/**
 * Get font data from pdf.js common objects
 */
async function getFontData(
  page: PDFPageProxy,
  fontName: string
): Promise<FontMetrics | null> {
  return new Promise((resolve) => {
    // Use a timeout in case the font isn't available
    const timeout = setTimeout(() => resolve(null), 100);

    try {
      // pdf.js stores fonts in commonObjs with 'g_d' prefix for page objects
      page.commonObjs.get(fontName, (fontObj: any) => {
        clearTimeout(timeout);

        if (!fontObj) {
          resolve(getDefaultFontMetrics(fontName));
          return;
        }

        const metrics = parseFontObject(fontName, fontObj);
        resolve(metrics);
      });
    } catch {
      clearTimeout(timeout);
      resolve(getDefaultFontMetrics(fontName));
    }
  });
}

/**
 * Parse font object from pdf.js to extract metrics
 */
function parseFontObject(fontName: string, fontObj: any): FontMetrics {
  const widths = new Map<number, number>();

  // Extract character widths
  if (fontObj.widths) {
    for (const [charCode, width] of Object.entries(fontObj.widths)) {
      widths.set(parseInt(charCode, 10), width as number);
    }
  }

  // Try to get toUnicode mapping for better width lookups
  if (fontObj.toUnicode && fontObj.widths) {
    // Some fonts have toUnicode mapping which helps map glyph widths
  }

  // Detect font characteristics from name
  const nameLower = fontName.toLowerCase();
  const isBold = nameLower.includes('bold') || nameLower.includes('black') ||
                 nameLower.includes('heavy') || nameLower.includes('medium');
  const isItalic = nameLower.includes('italic') || nameLower.includes('oblique');
  const isMonospace = nameLower.includes('mono') || nameLower.includes('courier') ||
                      nameLower.includes('consolas') || nameLower.includes('fixed');

  // Get ascent/descent - pdf.js normalizes these
  let ascent = fontObj.ascent ?? 0.88;
  let descent = fontObj.descent ?? -0.12;

  // Normalize if values seem out of range
  if (Math.abs(ascent) > 2) {
    ascent = ascent / 1000;
  }
  if (Math.abs(descent) > 2) {
    descent = descent / 1000;
  }

  // Default width (for characters not in the widths table)
  const defaultWidth = fontObj.defaultWidth ?? (isMonospace ? 0.6 : 0.5);

  return {
    fontName,
    ascent,
    descent,
    defaultWidth,
    vertical: fontObj.vertical ?? false,
    monospace: isMonospace,
    widths,
    family: extractFontFamily(fontName),
    bold: isBold,
    italic: isItalic,
  };
}

/**
 * Get default font metrics for unknown fonts
 * Uses font substitution to provide better fallback metrics
 */
function getDefaultFontMetrics(fontName: string): FontMetrics {
  // Get font substitution info
  const substitution = fontSubstitutionManager.getSubstitution(fontName);
  const substituteMetrics = getSubstituteFontMetrics(fontName);

  const nameLower = fontName.toLowerCase();
  const isBold = nameLower.includes('bold') || substituteMetrics.avgWidth > 0.55;
  const isItalic = nameLower.includes('italic') || nameLower.includes('oblique');
  const isMonospace = nameLower.includes('mono') || nameLower.includes('courier') ||
                      (substituteMetrics.avgWidth === 0.6);

  return {
    fontName,
    ascent: substituteMetrics.ascent,
    descent: substituteMetrics.descent,
    defaultWidth: substituteMetrics.avgWidth,
    vertical: false,
    monospace: isMonospace,
    widths: new Map(),
    family: extractFontFamily(fontName),
    bold: isBold,
    italic: isItalic,
    substitution: substitution.confidence < 1 ? substitution : undefined,
  };
}

/**
 * Get all font substitutions that were made
 */
export function getFontSubstitutions(): FontSubstitution[] {
  return fontSubstitutionManager.getAllSubstitutions();
}

/**
 * Get list of fonts that couldn't be properly substituted
 */
export function getMissingFonts(): string[] {
  return fontSubstitutionManager.getMissingFonts();
}

/**
 * Reset font substitution tracking
 */
export function resetFontSubstitutions(): void {
  fontSubstitutionManager.clear();
}

/**
 * Extract font family name from pdf.js font name
 */
function extractFontFamily(fontName: string): string {
  // Remove common prefixes added by pdf.js
  let family = fontName.replace(/^g_d\d+_/, '');
  family = family.replace(/^[A-Z]{6}\+/, ''); // Remove subset prefix like ABCDEF+

  // Remove style suffixes
  family = family.replace(/[-,]?(Bold|Italic|Oblique|Regular|Medium|Light|Black|Heavy|Condensed|Extended)$/gi, '');

  return family.trim() || 'unknown';
}

/**
 * Get character width from font metrics
 * @param metrics Font metrics
 * @param char Character to measure
 * @param fontSize Font size in points
 * @returns Width in points
 */
export function getCharWidth(
  metrics: FontMetrics | undefined,
  char: string,
  fontSize: number
): number {
  if (!metrics) {
    // Default: assume average char is 0.5em
    return fontSize * 0.5;
  }

  // Try to get width from widths table
  const charCode = char.charCodeAt(0);
  let width = metrics.widths.get(charCode);

  // If not found, use default width
  if (width === undefined) {
    // For space, use a slightly smaller width
    if (char === ' ') {
      width = metrics.defaultWidth * 0.5;
    } else {
      width = metrics.defaultWidth;
    }
  }

  // Width is typically in 1/1000 em units from pdf.js
  if (width > 10) {
    width = width / 1000;
  }

  return fontSize * width;
}

/**
 * Calculate baseline position from font metrics
 * @param y0 Top of character box
 * @param y1 Bottom of character box
 * @param metrics Font metrics
 * @returns Baseline y position
 */
export function getBaseline(
  y0: number,
  y1: number,
  metrics: FontMetrics | undefined
): number {
  const height = y1 - y0;

  if (!metrics) {
    // Default: baseline at ~80% down from top
    return y0 + height * 0.8;
  }

  // Calculate baseline from ascent/descent ratio
  const totalHeight = metrics.ascent - metrics.descent;
  const ascentRatio = metrics.ascent / totalHeight;

  return y0 + height * ascentRatio;
}

/**
 * Check if two characters are likely from the same font run
 * (helps with kerning/spacing decisions)
 */
export function isSameFontRun(
  char1FontName: string,
  char1Size: number,
  char2FontName: string,
  char2Size: number,
  tolerance: number = 0.5
): boolean {
  if (char1FontName !== char2FontName) return false;
  return Math.abs(char1Size - char2Size) <= tolerance;
}

/**
 * Get typical character spacing for a font
 * (for detecting word breaks)
 */
export function getTypicalSpacing(
  metrics: FontMetrics | undefined,
  fontSize: number
): number {
  if (!metrics) {
    return fontSize * 0.25; // Default word spacing
  }

  // Word spacing is typically 0.25-0.33 em
  const spaceWidth = getCharWidth(metrics, ' ', fontSize);
  return spaceWidth > 0 ? spaceWidth * 0.8 : fontSize * 0.25;
}

/**
 * Clear font cache for a page (called when page is closed)
 */
export function clearFontCache(page: PDFPageProxy): void {
  fontCache.delete(page);
}
