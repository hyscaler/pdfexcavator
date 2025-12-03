/**
 * Font Substitution Support
 * Provides fallback fonts when PDF fonts are missing or unavailable
 */

/**
 * Font substitution mapping
 */
export interface FontSubstitution {
  /** Original font name */
  originalFont: string;
  /** Substituted font name */
  substituteFont: string;
  /** Confidence in the substitution (0-1) */
  confidence: number;
  /** Reason for substitution */
  reason: string;
}

/**
 * Font classification
 */
export type FontClass = 'serif' | 'sans-serif' | 'monospace' | 'script' | 'decorative' | 'symbol' | 'unknown';

/**
 * Standard PDF base fonts (always available)
 */
export const PDF_BASE_FONTS = [
  'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic',
  'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique',
  'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique',
  'Symbol', 'ZapfDingbats',
];

/**
 * Font substitution rules
 * Maps common font names to their best substitutes
 */
export const FONT_SUBSTITUTION_MAP: Record<string, string> = {
  // Times variants
  'TimesNewRoman': 'Times-Roman',
  'TimesNewRomanPS': 'Times-Roman',
  'TimesNewRomanPSMT': 'Times-Roman',
  'Times': 'Times-Roman',
  'Times-Roman': 'Times-Roman',
  'NimbusRomNo9L-Regu': 'Times-Roman',
  'NimbusRomNo9L-Medi': 'Times-Bold',
  'NimbusRomNo9L-ReguItal': 'Times-Italic',
  'NimbusRomNo9L-MediItal': 'Times-BoldItalic',

  // Helvetica/Arial variants
  'Arial': 'Helvetica',
  'ArialMT': 'Helvetica',
  'Arial-BoldMT': 'Helvetica-Bold',
  'Arial-ItalicMT': 'Helvetica-Oblique',
  'Arial-BoldItalicMT': 'Helvetica-BoldOblique',
  'Helvetica': 'Helvetica',
  'HelveticaNeue': 'Helvetica',
  'NimbusSanL-Regu': 'Helvetica',
  'NimbusSanL-Bold': 'Helvetica-Bold',
  'NimbusSanL-ReguItal': 'Helvetica-Oblique',
  'NimbusSanL-BoldItal': 'Helvetica-BoldOblique',

  // Courier variants
  'CourierNew': 'Courier',
  'CourierNewPS': 'Courier',
  'CourierNewPSMT': 'Courier',
  'NimbusMonL-Regu': 'Courier',
  'NimbusMonL-Bold': 'Courier-Bold',
  'NimbusMonL-ReguObli': 'Courier-Oblique',
  'NimbusMonL-BoldObli': 'Courier-BoldOblique',

  // Symbol fonts
  'Symbol': 'Symbol',
  'SymbolMT': 'Symbol',
  'ZapfDingbats': 'ZapfDingbats',
  'Wingdings': 'ZapfDingbats',
  'Webdings': 'ZapfDingbats',

  // Common sans-serif fonts
  'Verdana': 'Helvetica',
  'Tahoma': 'Helvetica',
  'Calibri': 'Helvetica',
  'Trebuchet': 'Helvetica',
  'TrebuchetMS': 'Helvetica',
  'SegoeUI': 'Helvetica',

  // Common serif fonts
  'Georgia': 'Times-Roman',
  'Palatino': 'Times-Roman',
  'PalatinoLinotype': 'Times-Roman',
  'BookAntiqua': 'Times-Roman',
  'Garamond': 'Times-Roman',
  'Cambria': 'Times-Roman',

  // Common monospace fonts
  'Consolas': 'Courier',
  'LucidaConsole': 'Courier',
  'Monaco': 'Courier',
  'Menlo': 'Courier',
  'SourceCodePro': 'Courier',
  'DejaVuSansMono': 'Courier',
};

/**
 * Font classification patterns
 */
const FONT_CLASS_PATTERNS: Array<{ pattern: RegExp; class: FontClass }> = [
  // Serif fonts
  { pattern: /times|roman|georgia|palatino|garamond|cambria|book|antiqua|century|didot|bodoni/i, class: 'serif' },
  // Sans-serif fonts
  { pattern: /helvetica|arial|verdana|tahoma|calibri|trebuchet|segoe|futura|gill|avenir|roboto|open\s*sans|lato|montserrat/i, class: 'sans-serif' },
  // Monospace fonts
  { pattern: /courier|mono|console|consolas|menlo|monaco|source\s*code|fira\s*code|jetbrains|terminal|fixed/i, class: 'monospace' },
  // Script fonts
  { pattern: /script|cursive|handwriting|brush|zapfino|lucida\s*handwriting|comic/i, class: 'script' },
  // Symbol fonts
  { pattern: /symbol|dingbat|wingding|webding|icon|emoji|fontawesome|material/i, class: 'symbol' },
  // Decorative fonts
  { pattern: /decorative|display|poster|impact|stencil|western|gothic|blackletter/i, class: 'decorative' },
];

/**
 * Classify a font based on its name
 */
export function classifyFont(fontName: string): FontClass {
  const normalizedName = fontName.replace(/[-_,\s]+/g, '').toLowerCase();

  for (const { pattern, class: fontClass } of FONT_CLASS_PATTERNS) {
    if (pattern.test(normalizedName)) {
      return fontClass;
    }
  }

  return 'unknown';
}

/**
 * Parse font style from font name
 */
export function parseFontStyle(fontName: string): {
  bold: boolean;
  italic: boolean;
  weight: number;
} {
  const nameLower = fontName.toLowerCase();

  const bold = /bold|black|heavy|ultra|extra\s*bold|semibold|demi/i.test(nameLower);
  const italic = /italic|oblique|slant/i.test(nameLower);

  // Determine weight
  let weight = 400; // Normal
  if (/thin|hairline/i.test(nameLower)) weight = 100;
  else if (/extra\s*light|ultra\s*light/i.test(nameLower)) weight = 200;
  else if (/light/i.test(nameLower)) weight = 300;
  else if (/medium/i.test(nameLower)) weight = 500;
  else if (/semi\s*bold|demi\s*bold/i.test(nameLower)) weight = 600;
  else if (/bold/i.test(nameLower)) weight = 700;
  else if (/extra\s*bold|ultra\s*bold/i.test(nameLower)) weight = 800;
  else if (/black|heavy/i.test(nameLower)) weight = 900;

  return { bold: bold || weight >= 700, italic, weight };
}

/**
 * Find the best font substitution for a given font name
 */
export function findFontSubstitution(fontName: string): FontSubstitution {
  // Normalize font name (remove prefix like ABCDEF+)
  const normalizedName = fontName.replace(/^[A-Z]{6}\+/, '').replace(/[-_,\s]+/g, '');

  // Check direct mapping first
  if (FONT_SUBSTITUTION_MAP[normalizedName]) {
    return {
      originalFont: fontName,
      substituteFont: FONT_SUBSTITUTION_MAP[normalizedName],
      confidence: 0.95,
      reason: 'Direct mapping',
    };
  }

  // Check if it's already a base font
  for (const baseFont of PDF_BASE_FONTS) {
    if (normalizedName.toLowerCase().includes(baseFont.toLowerCase().replace('-', ''))) {
      return {
        originalFont: fontName,
        substituteFont: baseFont,
        confidence: 0.9,
        reason: 'Base font variant',
      };
    }
  }

  // Classify and substitute based on font class
  const fontClass = classifyFont(fontName);
  const style = parseFontStyle(fontName);

  let substituteFont: string;
  let confidence: number;
  let reason: string;

  switch (fontClass) {
    case 'serif':
      if (style.bold && style.italic) substituteFont = 'Times-BoldItalic';
      else if (style.bold) substituteFont = 'Times-Bold';
      else if (style.italic) substituteFont = 'Times-Italic';
      else substituteFont = 'Times-Roman';
      confidence = 0.7;
      reason = 'Serif class substitution';
      break;

    case 'sans-serif':
      if (style.bold && style.italic) substituteFont = 'Helvetica-BoldOblique';
      else if (style.bold) substituteFont = 'Helvetica-Bold';
      else if (style.italic) substituteFont = 'Helvetica-Oblique';
      else substituteFont = 'Helvetica';
      confidence = 0.7;
      reason = 'Sans-serif class substitution';
      break;

    case 'monospace':
      if (style.bold && style.italic) substituteFont = 'Courier-BoldOblique';
      else if (style.bold) substituteFont = 'Courier-Bold';
      else if (style.italic) substituteFont = 'Courier-Oblique';
      else substituteFont = 'Courier';
      confidence = 0.8;
      reason = 'Monospace class substitution';
      break;

    case 'symbol':
      substituteFont = 'Symbol';
      confidence = 0.6;
      reason = 'Symbol font substitution';
      break;

    case 'script':
    case 'decorative':
      // These don't have good substitutes, use Helvetica as fallback
      substituteFont = 'Helvetica';
      confidence = 0.3;
      reason = 'No suitable substitute available';
      break;

    default:
      // Unknown - use Helvetica as universal fallback
      substituteFont = 'Helvetica';
      confidence = 0.4;
      reason = 'Unknown font class, using default';
  }

  return {
    originalFont: fontName,
    substituteFont,
    confidence,
    reason,
  };
}

/**
 * Font metrics for standard PDF fonts
 * These are approximations for layout calculations
 */
export const STANDARD_FONT_METRICS: Record<string, {
  ascent: number;
  descent: number;
  avgWidth: number;
  capHeight: number;
  xHeight: number;
}> = {
  'Times-Roman': { ascent: 0.683, descent: -0.217, avgWidth: 0.401, capHeight: 0.662, xHeight: 0.450 },
  'Times-Bold': { ascent: 0.683, descent: -0.217, avgWidth: 0.427, capHeight: 0.676, xHeight: 0.461 },
  'Times-Italic': { ascent: 0.683, descent: -0.217, avgWidth: 0.402, capHeight: 0.653, xHeight: 0.442 },
  'Times-BoldItalic': { ascent: 0.683, descent: -0.217, avgWidth: 0.421, capHeight: 0.669, xHeight: 0.462 },
  'Helvetica': { ascent: 0.718, descent: -0.207, avgWidth: 0.513, capHeight: 0.718, xHeight: 0.523 },
  'Helvetica-Bold': { ascent: 0.718, descent: -0.207, avgWidth: 0.535, capHeight: 0.718, xHeight: 0.532 },
  'Helvetica-Oblique': { ascent: 0.718, descent: -0.207, avgWidth: 0.513, capHeight: 0.718, xHeight: 0.523 },
  'Helvetica-BoldOblique': { ascent: 0.718, descent: -0.207, avgWidth: 0.535, capHeight: 0.718, xHeight: 0.532 },
  'Courier': { ascent: 0.629, descent: -0.157, avgWidth: 0.600, capHeight: 0.562, xHeight: 0.426 },
  'Courier-Bold': { ascent: 0.629, descent: -0.157, avgWidth: 0.600, capHeight: 0.562, xHeight: 0.439 },
  'Courier-Oblique': { ascent: 0.629, descent: -0.157, avgWidth: 0.600, capHeight: 0.562, xHeight: 0.426 },
  'Courier-BoldOblique': { ascent: 0.629, descent: -0.157, avgWidth: 0.600, capHeight: 0.562, xHeight: 0.439 },
  'Symbol': { ascent: 0.800, descent: -0.200, avgWidth: 0.600, capHeight: 0.700, xHeight: 0.500 },
  'ZapfDingbats': { ascent: 0.800, descent: -0.200, avgWidth: 0.800, capHeight: 0.700, xHeight: 0.500 },
};

/**
 * Get font metrics for a font (using substitution if needed)
 */
export function getFontMetrics(fontName: string): {
  ascent: number;
  descent: number;
  avgWidth: number;
  capHeight: number;
  xHeight: number;
} {
  // Check if it's a standard font
  if (STANDARD_FONT_METRICS[fontName]) {
    return STANDARD_FONT_METRICS[fontName];
  }

  // Find substitution
  const substitution = findFontSubstitution(fontName);

  // Return metrics for substitute
  return STANDARD_FONT_METRICS[substitution.substituteFont] || STANDARD_FONT_METRICS['Helvetica'];
}

/**
 * Font substitution manager for tracking substitutions
 */
export class FontSubstitutionManager {
  private substitutions: Map<string, FontSubstitution> = new Map();
  private missingFonts: Set<string> = new Set();

  /**
   * Get or create substitution for a font
   */
  getSubstitution(fontName: string): FontSubstitution {
    if (!this.substitutions.has(fontName)) {
      const substitution = findFontSubstitution(fontName);
      this.substitutions.set(fontName, substitution);

      if (substitution.confidence < 0.8) {
        this.missingFonts.add(fontName);
      }
    }

    return this.substitutions.get(fontName)!;
  }

  /**
   * Get all substitutions made
   */
  getAllSubstitutions(): FontSubstitution[] {
    return Array.from(this.substitutions.values());
  }

  /**
   * Get list of fonts that had poor substitutions
   */
  getMissingFonts(): string[] {
    return Array.from(this.missingFonts);
  }

  /**
   * Check if a font had to be substituted
   */
  wasSubstituted(fontName: string): boolean {
    const sub = this.substitutions.get(fontName);
    return sub ? sub.originalFont !== sub.substituteFont : false;
  }

  /**
   * Clear all substitution data
   */
  clear(): void {
    this.substitutions.clear();
    this.missingFonts.clear();
  }
}
