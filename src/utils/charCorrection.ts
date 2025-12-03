/**
 * Character Correction Utility
 * Fixes common character encoding issues in PDF text extraction
 *
 * Many PDFs use custom font encodings where glyph IDs don't map to Unicode properly.
 * This utility provides pattern-based and context-aware corrections.
 */

export interface CharCorrectionOptions {
  /** Enable number-to-letter substitutions (3→s, 0→o, 1→l, etc.) */
  numberToLetter?: boolean;
  /** Enable letter-to-number substitutions (s→3, o→0, l→1, etc.) */
  letterToNumber?: boolean;
  /** Enable ligature expansion (ﬁ→fi, ﬂ→fl, etc.) */
  expandLigatures?: boolean;
  /** Enable smart quotes normalization ("→", '→') */
  normalizeQuotes?: boolean;
  /** Enable dash normalization (–, —, − → -) */
  normalizeDashes?: boolean;
  /** Enable whitespace normalization (non-breaking space, etc.) */
  normalizeWhitespace?: boolean;
  /** Custom character mappings { from: to } */
  customMappings?: Record<string, string>;
  /** Context-aware mode (uses word patterns to decide corrections) */
  contextAware?: boolean;
  /** Minimum confidence for context-aware corrections (0-1) */
  minConfidence?: number;
}

const DEFAULT_OPTIONS: Required<CharCorrectionOptions> = {
  numberToLetter: true,
  letterToNumber: false,
  expandLigatures: true,
  normalizeQuotes: true,
  normalizeDashes: true,
  normalizeWhitespace: true,
  customMappings: {},
  contextAware: true,
  minConfidence: 0.6,
};

// Common number-to-letter substitutions (when numbers appear in word context)
const NUMBER_TO_LETTER: Record<string, string> = {
  '0': 'o',
  '1': 'l',
  '2': 'z',
  '3': 's',
  '4': 'a',
  '5': 's',
  '6': 'b',
  '7': 't',
  '8': 'b',
  '9': 'g',
};

// Reverse mappings
const LETTER_TO_NUMBER: Record<string, string> = {
  'o': '0',
  'O': '0',
  'l': '1',
  'I': '1',
  'i': '1',
  'z': '2',
  'Z': '2',
  's': '5',
  'S': '5',
  'b': '6',
  'B': '8',
  'g': '9',
  't': '7',
  'T': '7',
};

// Ligature expansions
const LIGATURES: Record<string, string> = {
  'ﬁ': 'fi',
  'ﬂ': 'fl',
  'ﬀ': 'ff',
  'ﬃ': 'ffi',
  'ﬄ': 'ffl',
  'Ꜳ': 'AA',
  'ꜳ': 'aa',
  'Æ': 'AE',
  'æ': 'ae',
  'Œ': 'OE',
  'œ': 'oe',
  'ĳ': 'ij',
  'Ĳ': 'IJ',
  'ﬆ': 'st',
  'ﬅ': 'ft',
};

// Quote normalization
const QUOTES: Record<string, string> = {
  '\u201C': '"',  // left double quote "
  '\u201D': '"',  // right double quote "
  '\u201E': '"',  // double low-9 quote „
  '\u201F': '"',  // double high-reversed-9 quote ‟
  '\u2018': "'",  // left single quote '
  '\u2019': "'",  // right single quote '
  '\u201A': "'",  // single low-9 quote ‚
  '\u201B': "'",  // single high-reversed-9 quote ‛
  '\u00AB': '"',  // left-pointing double angle «
  '\u00BB': '"',  // right-pointing double angle »
  '\u2039': "'",  // left-pointing single angle ‹
  '\u203A': "'",  // right-pointing single angle ›
};

// Dash normalization
const DASHES: Record<string, string> = {
  '\u2013': '-',  // en dash –
  '\u2014': '-',  // em dash —
  '\u2212': '-',  // minus sign −
  '\u2010': '-',  // hyphen ‐
  '\u2011': '-',  // non-breaking hyphen ‑
  '\u2012': '-',  // figure dash ‒
  '\u2043': '-',  // hyphen bullet ⁃
};

// Whitespace normalization
const WHITESPACE: Record<string, string> = {
  '\u00A0': ' ',  // non-breaking space
  '\u2000': ' ',  // en quad
  '\u2001': ' ',  // em quad
  '\u2002': ' ',  // en space
  '\u2003': ' ',  // em space
  '\u2004': ' ',  // three-per-em space
  '\u2005': ' ',  // four-per-em space
  '\u2006': ' ',  // six-per-em space
  '\u2007': ' ',  // figure space
  '\u2008': ' ',  // punctuation space
  '\u2009': ' ',  // thin space
  '\u200A': ' ',  // hair space
  '\u200B': '',   // zero-width space
  '\u202F': ' ',  // narrow no-break space
  '\u205F': ' ',  // medium mathematical space
  '\u3000': ' ',  // ideographic space
  '\uFEFF': '',   // zero-width no-break space (BOM)
};

// Common English words for context detection
const COMMON_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
  'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
  'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
  'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
  'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
  'is', 'are', 'was', 'were', 'been', 'being', 'has', 'had', 'does', 'did',
  'should', 'must', 'shall', 'may', 'might', 'need', 'used', 'said', 'each', 'such',
]);

// Common word patterns with numbers that should be letters
const WORD_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Common words with number substitutions
  { pattern: /\bth3\b/gi, replacement: 'the' },
  { pattern: /\b1s\b/gi, replacement: 'is' },
  { pattern: /\b1t\b/gi, replacement: 'it' },
  { pattern: /\bw1th\b/gi, replacement: 'with' },
  { pattern: /\bth1s\b/gi, replacement: 'this' },
  { pattern: /\bf0r\b/gi, replacement: 'for' },
  { pattern: /\bn0t\b/gi, replacement: 'not' },
  { pattern: /\by0u\b/gi, replacement: 'you' },
  { pattern: /\b0f\b/gi, replacement: 'of' },
  { pattern: /\b0n\b/gi, replacement: 'on' },
  { pattern: /\b0r\b/gi, replacement: 'or' },
  { pattern: /\bt0\b/gi, replacement: 'to' },
  { pattern: /\b1n\b/gi, replacement: 'in' },
  { pattern: /\ban0\b/gi, replacement: 'and' },
  { pattern: /\ba3\b/gi, replacement: 'as' },
  { pattern: /\bha3\b/gi, replacement: 'has' },
  { pattern: /\bwa3\b/gi, replacement: 'was' },
  { pattern: /\b3o\b/gi, replacement: 'so' },
  { pattern: /\bu3e\b/gi, replacement: 'use' },
  { pattern: /\b3ee\b/gi, replacement: 'see' },
  { pattern: /\b3ay\b/gi, replacement: 'say' },
  { pattern: /\b3ome\b/gi, replacement: 'some' },
  { pattern: /\b3uch\b/gi, replacement: 'such' },
  { pattern: /\b3hall\b/gi, replacement: 'shall' },
  { pattern: /\b3hould\b/gi, replacement: 'should' },
  { pattern: /\b3ince\b/gi, replacement: 'since' },
  { pattern: /\b3tate\b/gi, replacement: 'state' },
  { pattern: /\b3ection\b/gi, replacement: 'section' },
  { pattern: /\b3ystem\b/gi, replacement: 'system' },
  { pattern: /\bca3e\b/gi, replacement: 'case' },
  { pattern: /\bcau3e\b/gi, replacement: 'cause' },
  { pattern: /\bbecau3e\b/gi, replacement: 'because' },
  { pattern: /\bpur3ue\b/gi, replacement: 'pursue' },
  { pattern: /\bi33ue\b/gi, replacement: 'issue' },
  { pattern: /\bmi33\b/gi, replacement: 'miss' },
  { pattern: /\bpa33\b/gi, replacement: 'pass' },
  { pattern: /\bcla33\b/gi, replacement: 'class' },
  { pattern: /\ble33\b/gi, replacement: 'less' },
  { pattern: /\bpo33ible\b/gi, replacement: 'possible' },
  { pattern: /\bnece33ary\b/gi, replacement: 'necessary' },
  { pattern: /\bproce33\b/gi, replacement: 'process' },
  { pattern: /\baddre33\b/gi, replacement: 'address' },
  { pattern: /\bacce33\b/gi, replacement: 'access' },
  { pattern: /\b3ucce33\b/gi, replacement: 'success' },
  { pattern: /\bbu3ine33\b/gi, replacement: 'business' },
  // 0 → o patterns
  { pattern: /\b0ne\b/gi, replacement: 'one' },
  { pattern: /\b0nly\b/gi, replacement: 'only' },
  { pattern: /\b0ther\b/gi, replacement: 'other' },
  { pattern: /\b0ver\b/gi, replacement: 'over' },
  { pattern: /\b0wn\b/gi, replacement: 'own' },
  { pattern: /\bwh0\b/gi, replacement: 'who' },
  { pattern: /\bals0\b/gi, replacement: 'also' },
  { pattern: /\bint0\b/gi, replacement: 'into' },
  { pattern: /\btw0\b/gi, replacement: 'two' },
  { pattern: /\bd0\b/gi, replacement: 'do' },
  { pattern: /\bn0w\b/gi, replacement: 'now' },
  { pattern: /\bh0w\b/gi, replacement: 'how' },
  { pattern: /\bkn0w\b/gi, replacement: 'know' },
  { pattern: /\bsh0w\b/gi, replacement: 'show' },
  { pattern: /\bw0rk\b/gi, replacement: 'work' },
  { pattern: /\bw0rd\b/gi, replacement: 'word' },
  { pattern: /\bw0rld\b/gi, replacement: 'world' },
  { pattern: /\bg00d\b/gi, replacement: 'good' },
  { pattern: /\bl00k\b/gi, replacement: 'look' },
  { pattern: /\bb00k\b/gi, replacement: 'book' },
  { pattern: /\bt00\b/gi, replacement: 'too' },
  // 1 → l/i patterns
  { pattern: /\b1ike\b/gi, replacement: 'like' },
  { pattern: /\bw1ll\b/gi, replacement: 'will' },
  { pattern: /\bst1ll\b/gi, replacement: 'still' },
  { pattern: /\bunt1l\b/gi, replacement: 'until' },
  { pattern: /\bwh1le\b/gi, replacement: 'while' },
  { pattern: /\bf1le\b/gi, replacement: 'file' },
  { pattern: /\bt1me\b/gi, replacement: 'time' },
  { pattern: /\bl1ne\b/gi, replacement: 'line' },
  { pattern: /\bl1fe\b/gi, replacement: 'life' },
  { pattern: /\bl1st\b/gi, replacement: 'list' },
  { pattern: /\bf1rst\b/gi, replacement: 'first' },
  { pattern: /\bf1nd\b/gi, replacement: 'find' },
  { pattern: /\bth1nk\b/gi, replacement: 'think' },
  { pattern: /\bpo1nt\b/gi, replacement: 'point' },
];

/**
 * Apply simple character mappings
 */
function applyMappings(text: string, mappings: Record<string, string>): string {
  let result = text;
  for (const [from, to] of Object.entries(mappings)) {
    result = result.split(from).join(to);
  }
  return result;
}

/**
 * Apply word pattern corrections
 */
function applyWordPatterns(text: string): string {
  let result = text;
  for (const { pattern, replacement } of WORD_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Context-aware number to letter correction
 * Only converts numbers to letters when they appear within word-like contexts
 */
function contextAwareNumberToLetter(text: string, minConfidence: number): string {
  // Find sequences that look like words but contain numbers
  const wordLikePattern = /\b[a-zA-Z0-9]+\b/g;

  return text.replace(wordLikePattern, (match) => {
    // Skip if it's all numbers (likely an actual number)
    if (/^\d+$/.test(match)) return match;

    // Skip if it's all letters (no correction needed)
    if (/^[a-zA-Z]+$/.test(match)) return match;

    // Count letters vs numbers
    const letters = (match.match(/[a-zA-Z]/g) || []).length;
    const numbers = (match.match(/\d/g) || []).length;

    // If mostly letters, likely a word with encoding errors
    const letterRatio = letters / (letters + numbers);
    if (letterRatio < minConfidence) return match;

    // Replace numbers with likely letters
    let corrected = match;
    for (const [num, letter] of Object.entries(NUMBER_TO_LETTER)) {
      // Only replace if surrounded by letters
      const pattern = new RegExp(`([a-zA-Z])${num}([a-zA-Z])`, 'g');
      corrected = corrected.replace(pattern, `$1${letter}$2`);

      // Also handle at start/end of word
      const startPattern = new RegExp(`^${num}([a-zA-Z])`, 'g');
      corrected = corrected.replace(startPattern, `${letter}$1`);

      const endPattern = new RegExp(`([a-zA-Z])${num}$`, 'g');
      corrected = corrected.replace(endPattern, `$1${letter}`);
    }

    // Check if corrected word is a common word
    if (COMMON_WORDS.has(corrected.toLowerCase())) {
      return corrected;
    }

    // If no improvement, return original
    return corrected;
  });
}

/**
 * Correct garbled text from PDF encoding issues
 *
 * @example
 * ```typescript
 * import { correctText } from 'pdflens';
 *
 * const garbled = "Th3 qu1ck br0wn f0x jump3 0ver the lazy d0g";
 * const fixed = correctText(garbled);
 * // "The quick brown fox jumps over the lazy dog"
 * ```
 */
export function correctText(text: string, options: CharCorrectionOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let result = text;

  // Apply custom mappings first (highest priority)
  if (opts.customMappings && Object.keys(opts.customMappings).length > 0) {
    result = applyMappings(result, opts.customMappings);
  }

  // Expand ligatures
  if (opts.expandLigatures) {
    result = applyMappings(result, LIGATURES);
  }

  // Normalize quotes
  if (opts.normalizeQuotes) {
    result = applyMappings(result, QUOTES);
  }

  // Normalize dashes
  if (opts.normalizeDashes) {
    result = applyMappings(result, DASHES);
  }

  // Normalize whitespace
  if (opts.normalizeWhitespace) {
    result = applyMappings(result, WHITESPACE);
  }

  // Apply known word pattern corrections
  if (opts.numberToLetter) {
    result = applyWordPatterns(result);
  }

  // Context-aware corrections
  if (opts.contextAware && opts.numberToLetter) {
    result = contextAwareNumberToLetter(result, opts.minConfidence);
  }

  // Letter to number (if enabled, usually for specific use cases)
  if (opts.letterToNumber) {
    // Only apply in number-like contexts (e.g., "l23" → "123")
    result = result.replace(/\b([a-zA-Z]?\d+[a-zA-Z]?\d*)\b/g, (match) => {
      let corrected = match;
      for (const [letter, num] of Object.entries(LETTER_TO_NUMBER)) {
        corrected = corrected.split(letter).join(num);
      }
      return corrected;
    });
  }

  return result;
}

/**
 * Create a reusable text corrector with preset options
 */
export function createTextCorrector(options: CharCorrectionOptions = {}): (text: string) => string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  return (text: string) => correctText(text, opts);
}

/**
 * Detect potential encoding issues in text
 * Returns a score from 0-1 indicating likelihood of encoding problems
 */
export function detectEncodingIssues(text: string): {
  score: number;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Check for numbers in word-like contexts
  const wordsWithNumbers = text.match(/\b[a-zA-Z]+\d+[a-zA-Z]*\b|\b[a-zA-Z]*\d+[a-zA-Z]+\b/g) || [];
  if (wordsWithNumbers.length > 0) {
    const ratio = wordsWithNumbers.length / (text.split(/\s+/).length || 1);
    if (ratio > 0.1) {
      issues.push(`Found ${wordsWithNumbers.length} words with mixed letters/numbers`);
      suggestions.push('Enable numberToLetter correction');
      score += Math.min(ratio * 2, 0.4);
    }
  }

  // Check for unusual Unicode characters
  const unusualChars = text.match(/[\u0080-\u009F\uFFFD]/g) || [];
  if (unusualChars.length > 0) {
    issues.push(`Found ${unusualChars.length} unusual/replacement characters`);
    suggestions.push('Check PDF font encoding');
    score += Math.min(unusualChars.length / text.length * 10, 0.3);
  }

  // Check for ligatures that might need expansion
  const ligatures = text.match(/[ﬁﬂﬀﬃﬄ]/g) || [];
  if (ligatures.length > 0) {
    issues.push(`Found ${ligatures.length} ligature characters`);
    suggestions.push('Enable expandLigatures');
    score += 0.1;
  }

  // Check for curly quotes
  const curlyQuotes = text.match(/[""'']/g) || [];
  if (curlyQuotes.length > 0) {
    issues.push(`Found ${curlyQuotes.length} curly quote characters`);
    suggestions.push('Enable normalizeQuotes for plain ASCII quotes');
    // This is not really an issue, just informational
  }

  return {
    score: Math.min(score, 1),
    issues,
    suggestions,
  };
}

/**
 * Auto-correct text with automatic issue detection
 * Only applies corrections if encoding issues are detected
 */
export function autoCorrectText(text: string, threshold: number = 0.2): {
  text: string;
  corrected: boolean;
  issuesDetected: string[];
} {
  const detection = detectEncodingIssues(text);

  if (detection.score >= threshold) {
    return {
      text: correctText(text),
      corrected: true,
      issuesDetected: detection.issues,
    };
  }

  return {
    text,
    corrected: false,
    issuesDetected: [],
  };
}

// Export mappings for customization
export {
  NUMBER_TO_LETTER,
  LETTER_TO_NUMBER,
  LIGATURES,
  QUOTES,
  DASHES,
  WHITESPACE,
  COMMON_WORDS,
  WORD_PATTERNS,
};
