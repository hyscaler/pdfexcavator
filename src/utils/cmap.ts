/**
 * CMap (Character Map) Support
 * Enables proper handling of CJK (Chinese, Japanese, Korean) characters
 */

import { dirname, join } from 'path';
import { readFile, access } from 'fs/promises';
import { constants } from 'fs';
import { createRequire } from 'module';

/**
 * CMap configuration for pdf.js
 */
export interface CMapConfig {
  /** URL or path to CMap files directory */
  cMapUrl: string;
  /** Whether CMaps are packed (bcmap format) */
  cMapPacked: boolean;
}

/**
 * Get the default CMap configuration
 * Uses createRequire to properly resolve pdfjs-dist regardless of node_modules structure
 */
export async function getDefaultCMapConfig(): Promise<CMapConfig | null> {
  try {
    // Use createRequire to resolve pdfjs-dist path correctly in any node_modules structure
    const require = createRequire(import.meta.url);
    const pdfjsDistPath = dirname(require.resolve('pdfjs-dist/package.json'));
    const cmapPath = join(pdfjsDistPath, 'cmaps');

    await access(cmapPath, constants.R_OK);
    return {
      cMapUrl: cmapPath,
      cMapPacked: true, // pdfjs-dist uses packed bcmap format
    };
  } catch {
    // pdfjs-dist not found or cmaps not accessible
    return null;
  }
}

/**
 * CMap reader for custom CMap loading
 * Implements the CMapReaderFactory interface expected by pdf.js
 */
export class NodeCMapReaderFactory {
  private baseUrl: string;
  private isCompressed: boolean;

  /**
   * Constructor matching pdf.js CMapReaderFactory interface
   * @param options Options object with baseUrl and isCompressed (or cMapUrl and cMapPacked)
   */
  constructor(options: { baseUrl?: string; isCompressed?: boolean; cMapUrl?: string; cMapPacked?: boolean } = {}) {
    // Support both pdf.js naming conventions
    this.baseUrl = options.baseUrl || options.cMapUrl || '';
    this.isCompressed = options.isCompressed ?? options.cMapPacked ?? true;
  }

  async fetch(params: { name: string }): Promise<{ cMapData: Uint8Array; compressionType: number }> {
    const { name } = params;

    // Try packed format first (bcmap)
    try {
      const bcmapPath = join(this.baseUrl, `${name}.bcmap`);
      const data = await readFile(bcmapPath);
      return {
        cMapData: new Uint8Array(data),
        compressionType: 1, // BINARY compressed
      };
    } catch {
      // Try uncompressed format
      try {
        const cmapPath = join(this.baseUrl, name);
        const data = await readFile(cmapPath);
        return {
          cMapData: new Uint8Array(data),
          compressionType: 0, // NONE
        };
      } catch {
        throw new Error(`CMap "${name}" not found`);
      }
    }
  }
}

/**
 * Standard font CMap mappings
 * Maps common CJK font names to their CMap encodings
 */
export const STANDARD_CMAP_ENCODINGS: Record<string, string> = {
  // Japanese
  'HeiseiMin-W3': 'UniJIS-UCS2-H',
  'HeiseiKakuGo-W5': 'UniJIS-UCS2-H',
  'KozMinPr6N-Regular': 'UniJIS-UTF16-H',
  'KozGoPr6N-Medium': 'UniJIS-UTF16-H',

  // Chinese Simplified
  'STSong-Light': 'UniGB-UCS2-H',
  'STHeiti-Regular': 'UniGB-UCS2-H',
  'AdobeSongStd-Light': 'UniGB-UTF16-H',

  // Chinese Traditional
  'MingLiU': 'UniCNS-UCS2-H',
  'MSung-Light': 'UniCNS-UCS2-H',
  'AdobeMingStd-Light': 'UniCNS-UTF16-H',

  // Korean
  'HYGoThic-Medium': 'UniKS-UCS2-H',
  'HYSMyeongJo-Medium': 'UniKS-UCS2-H',
  'AdobeMyungjoStd-Medium': 'UniKS-UTF16-H',
};

/**
 * Detect if a font is likely CJK based on name
 */
export function isCJKFont(fontName: string): boolean {
  const cjkPatterns = [
    // Japanese
    /heisei/i, /kozmin/i, /kozgo/i, /gothic/i, /mincho/i,
    /hiragino/i, /meiryo/i, /yu\s*(gothic|mincho)/i,
    // Chinese
    /song/i, /heiti/i, /ming/i, /kaiti/i, /fangsong/i,
    /simhei/i, /simsun/i, /nsimsun/i, /microsoft\s*yahei/i,
    // Korean
    /gulim/i, /dotum/i, /batang/i, /gungsuh/i, /malgun/i,
    // Generic CJK
    /cjk/i, /\b(jp|cn|kr|tw|hk)\b/i,
  ];

  return cjkPatterns.some(pattern => pattern.test(fontName));
}

/**
 * Get appropriate CMap for a font
 */
export function getCMapForFont(fontName: string, registry?: string): string | null {
  // Check standard mappings first
  if (STANDARD_CMAP_ENCODINGS[fontName]) {
    return STANDARD_CMAP_ENCODINGS[fontName];
  }

  // Determine by registry (from font dictionary)
  if (registry) {
    switch (registry.toLowerCase()) {
      case 'adobe':
        if (fontName.toLowerCase().includes('japan')) return 'UniJIS-UTF16-H';
        if (fontName.toLowerCase().includes('gb')) return 'UniGB-UTF16-H';
        if (fontName.toLowerCase().includes('cns')) return 'UniCNS-UTF16-H';
        if (fontName.toLowerCase().includes('korea')) return 'UniKS-UTF16-H';
        break;
      case 'japan':
        return 'UniJIS-UTF16-H';
      case 'gb':
      case 'china':
        return 'UniGB-UTF16-H';
      case 'cns':
      case 'taiwan':
        return 'UniCNS-UTF16-H';
      case 'korea':
        return 'UniKS-UTF16-H';
    }
  }

  // Try to detect from font name
  const nameLower = fontName.toLowerCase();

  // Japanese indicators
  if (/japan|jp|jis|heisei|kozmin|kozgo|mincho|gothic|hiragino|meiryo/i.test(nameLower)) {
    return 'UniJIS-UTF16-H';
  }

  // Chinese Simplified indicators
  if (/gb|china|cn|sim|song|heiti|fangsong|kaiti|yahei/i.test(nameLower)) {
    return 'UniGB-UTF16-H';
  }

  // Chinese Traditional indicators
  if (/cns|taiwan|tw|hk|ming|pming/i.test(nameLower)) {
    return 'UniCNS-UTF16-H';
  }

  // Korean indicators
  if (/korea|kr|ks|gulim|dotum|batang|gungsuh|malgun/i.test(nameLower)) {
    return 'UniKS-UTF16-H';
  }

  return null;
}

/**
 * Unicode range detection for CJK characters
 */
export function detectCJKRange(text: string): 'japanese' | 'chinese-simplified' | 'chinese-traditional' | 'korean' | 'mixed' | null {
  let hasJapanese = false;
  let hasChineseSimplified = false;
  let hasChineseTraditional = false;
  let hasKorean = false;

  for (const char of text) {
    const code = char.charCodeAt(0);

    // Hiragana and Katakana (Japanese specific)
    if ((code >= 0x3040 && code <= 0x309F) || (code >= 0x30A0 && code <= 0x30FF)) {
      hasJapanese = true;
    }
    // Hangul (Korean)
    else if ((code >= 0xAC00 && code <= 0xD7AF) || (code >= 0x1100 && code <= 0x11FF)) {
      hasKorean = true;
    }
    // CJK Unified Ideographs (shared)
    else if (code >= 0x4E00 && code <= 0x9FFF) {
      // This range is shared - would need frequency analysis to distinguish
      // For now, mark as potentially any
    }
  }

  const count = [hasJapanese, hasChineseSimplified, hasChineseTraditional, hasKorean].filter(Boolean).length;

  if (count === 0) return null;
  if (count > 1) return 'mixed';
  if (hasJapanese) return 'japanese';
  if (hasKorean) return 'korean';
  if (hasChineseSimplified) return 'chinese-simplified';
  if (hasChineseTraditional) return 'chinese-traditional';

  return null;
}

/**
 * Normalize CJK text (handle fullwidth/halfwidth variants)
 */
export function normalizeCJKText(text: string): string {
  let result = '';

  for (const char of text) {
    const code = char.charCodeAt(0);

    // Fullwidth ASCII variants (FF01-FF5E) -> ASCII (0021-007E)
    if (code >= 0xFF01 && code <= 0xFF5E) {
      result += String.fromCharCode(code - 0xFEE0);
    }
    // Fullwidth space -> regular space
    else if (code === 0x3000) {
      result += ' ';
    }
    // Halfwidth Katakana (FF65-FF9F) - keep as is or convert to fullwidth
    else {
      result += char;
    }
  }

  return result;
}
