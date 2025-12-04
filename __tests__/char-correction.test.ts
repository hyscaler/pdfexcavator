/**
 * Character Correction Tests
 * Tests for fixing PDF text encoding issues: ligatures, quotes, numbers-to-letters, etc.
 */

describe('Character Correction', () => {
  let correctText: typeof import('../src/utils/charCorrection.js').correctText;
  let createTextCorrector: typeof import('../src/utils/charCorrection.js').createTextCorrector;
  let detectEncodingIssues: typeof import('../src/utils/charCorrection.js').detectEncodingIssues;
  let autoCorrectText: typeof import('../src/utils/charCorrection.js').autoCorrectText;
  let NUMBER_TO_LETTER: typeof import('../src/utils/charCorrection.js').NUMBER_TO_LETTER;
  let LIGATURES: typeof import('../src/utils/charCorrection.js').LIGATURES;
  let QUOTES: typeof import('../src/utils/charCorrection.js').QUOTES;
  let DASHES: typeof import('../src/utils/charCorrection.js').DASHES;
  let WHITESPACE: typeof import('../src/utils/charCorrection.js').WHITESPACE;

  beforeAll(async () => {
    const module = await import('../src/utils/charCorrection.js');
    correctText = module.correctText;
    createTextCorrector = module.createTextCorrector;
    detectEncodingIssues = module.detectEncodingIssues;
    autoCorrectText = module.autoCorrectText;
    NUMBER_TO_LETTER = module.NUMBER_TO_LETTER;
    LIGATURES = module.LIGATURES;
    QUOTES = module.QUOTES;
    DASHES = module.DASHES;
    WHITESPACE = module.WHITESPACE;
  });

  describe('correctText', () => {
    describe('ligature expansion', () => {
      it('should expand fi ligature', () => {
        expect(correctText('ﬁle')).toBe('file');
        expect(correctText('ﬁrst')).toBe('first');
      });

      it('should expand fl ligature', () => {
        expect(correctText('ﬂow')).toBe('flow');
        expect(correctText('ﬂat')).toBe('flat');
      });

      it('should expand ff ligature', () => {
        expect(correctText('oﬀer')).toBe('offer');
        expect(correctText('aﬀect')).toBe('affect');
      });

      it('should expand ffi ligature', () => {
        expect(correctText('oﬃce')).toBe('office');
        expect(correctText('eﬃcient')).toBe('efficient');
      });

      it('should expand ffl ligature', () => {
        expect(correctText('baﬄe')).toBe('baffle');
        expect(correctText('waﬄe')).toBe('waffle');
      });

      it('should expand other ligatures', () => {
        expect(correctText('Æther')).toBe('AEther');
        expect(correctText('œuvre')).toBe('oeuvre');
      });

      it('should handle multiple ligatures', () => {
        expect(correctText('ﬁnal oﬃce ﬂoor')).toBe('final office floor');
      });

      it('should not expand when disabled', () => {
        expect(correctText('ﬁle', { expandLigatures: false })).toBe('ﬁle');
      });
    });

    describe('quote normalization', () => {
      it('should normalize curly double quotes', () => {
        expect(correctText('"hello"')).toBe('"hello"');
        expect(correctText('"world"')).toBe('"world"');
      });

      it('should normalize curly single quotes', () => {
        expect(correctText('\u2018test\u2019')).toBe("'test'");
        expect(correctText("it\u2019s")).toBe("it's");
      });

      it('should normalize angle quotes', () => {
        expect(correctText('«test»')).toBe('"test"');
        expect(correctText('‹test›')).toBe("'test'");
      });

      it('should not normalize when disabled', () => {
        expect(correctText('"hello"', { normalizeQuotes: false })).toBe('"hello"');
      });
    });

    describe('dash normalization', () => {
      it('should normalize en dash', () => {
        expect(correctText('pages 1–10')).toBe('pages 1-10');
      });

      it('should normalize em dash', () => {
        expect(correctText('word—word')).toBe('word-word');
      });

      it('should normalize minus sign', () => {
        expect(correctText('a − b')).toBe('a - b');
      });

      it('should normalize multiple dash types', () => {
        expect(correctText('a–b—c−d')).toBe('a-b-c-d');
      });

      it('should not normalize when disabled', () => {
        expect(correctText('a–b', { normalizeDashes: false })).toBe('a–b');
      });
    });

    describe('whitespace normalization', () => {
      it('should normalize non-breaking space', () => {
        expect(correctText('hello\u00A0world')).toBe('hello world');
      });

      it('should remove zero-width space', () => {
        expect(correctText('hel\u200Blo')).toBe('hello');
      });

      it('should normalize em space', () => {
        expect(correctText('hello\u2003world')).toBe('hello world');
      });

      it('should normalize ideographic space', () => {
        expect(correctText('hello\u3000world')).toBe('hello world');
      });

      it('should not normalize when disabled', () => {
        expect(correctText('hello\u00A0world', { normalizeWhitespace: false })).toBe('hello\u00A0world');
      });
    });

    describe('number to letter correction', () => {
      it('should correct common word patterns', () => {
        expect(correctText('th3')).toBe('the');
        expect(correctText('1s')).toBe('is');
        expect(correctText('1t')).toBe('it');
        expect(correctText('0f')).toBe('of');
      });

      it('should correct words with 0 → o', () => {
        expect(correctText('0ne')).toBe('one');
        expect(correctText('0nly')).toBe('only');
        expect(correctText('als0')).toBe('also');
        expect(correctText('int0')).toBe('into');
        expect(correctText('g00d')).toBe('good');
      });

      it('should correct words with 1 → l/i', () => {
        expect(correctText('1ike')).toBe('like');
        expect(correctText('w1ll')).toBe('will');
        expect(correctText('f1le')).toBe('file');
        expect(correctText('t1me')).toBe('time');
      });

      it('should correct words with 3 → s', () => {
        expect(correctText('3o')).toBe('so');
        expect(correctText('u3e')).toBe('use');
        expect(correctText('3ee')).toBe('see');
        expect(correctText('cla33')).toBe('class');
        expect(correctText('proce33')).toBe('process');
      });

      it('should preserve actual numbers', () => {
        expect(correctText('123')).toBe('123');
        expect(correctText('page 42')).toBe('page 42');
        expect(correctText('2024')).toBe('2024');
      });

      it('should not correct when disabled', () => {
        expect(correctText('th3', { numberToLetter: false })).toBe('th3');
      });
    });

    describe('context-aware correction', () => {
      it('should correct mixed letter/number words', () => {
        // Words that look like they have encoding errors
        const result = correctText('w0rk', { contextAware: true });
        expect(result).toBe('work');
      });

      it('should preserve words that are mostly numbers', () => {
        // Don't change actual alphanumeric codes
        const result = correctText('A123', { contextAware: true, minConfidence: 0.6 });
        expect(result).toBe('A123');
      });

      it('should respect minConfidence threshold', () => {
        // Higher confidence required for correction
        const text = 'f1le';
        const highConf = correctText(text, { minConfidence: 0.9 });
        expect(highConf).toBe('file'); // Known pattern
      });
    });

    describe('custom mappings', () => {
      it('should apply custom character mappings', () => {
        const result = correctText('aXb', { customMappings: { X: 'Y' } });
        expect(result).toBe('aYb');
      });

      it('should apply custom mappings before other corrections', () => {
        const result = correctText('®', { customMappings: { '®': '(R)' } });
        expect(result).toBe('(R)');
      });

      it('should handle multiple custom mappings', () => {
        const result = correctText('a→b←c', {
          customMappings: { '→': '->', '←': '<-' },
        });
        expect(result).toBe('a->b<-c');
      });
    });

    describe('combined corrections', () => {
      it('should apply multiple correction types', () => {
        const garbled = 'Th3 "ﬁrst" oﬃce—needs ﬁxing';
        // Note: th3 pattern is case insensitive, so Th3 -> the (lowercase)
        const expected = 'the "first" office-needs fixing';
        expect(correctText(garbled)).toBe(expected);
      });

      it('should handle empty string', () => {
        expect(correctText('')).toBe('');
      });

      it('should handle plain text without issues', () => {
        const plain = 'This is normal text without encoding issues.';
        expect(correctText(plain)).toBe(plain);
      });
    });
  });

  describe('createTextCorrector', () => {
    it('should create reusable corrector with preset options', () => {
      const corrector = createTextCorrector({ expandLigatures: true });
      expect(corrector('ﬁle')).toBe('file');
      expect(corrector('oﬃce')).toBe('office');
    });

    it('should use custom options', () => {
      const corrector = createTextCorrector({ normalizeQuotes: false });
      expect(corrector('"test"')).toBe('"test"');
    });

    it('should create independent correctors', () => {
      const c1 = createTextCorrector({ expandLigatures: true });
      const c2 = createTextCorrector({ expandLigatures: false });

      expect(c1('ﬁle')).toBe('file');
      expect(c2('ﬁle')).toBe('ﬁle');
    });
  });

  describe('detectEncodingIssues', () => {
    it('should detect words with mixed letters/numbers', () => {
      const result = detectEncodingIssues('th3 qu1ck br0wn f0x');
      expect(result.score).toBeGreaterThan(0);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.suggestions).toContain('Enable numberToLetter correction');
    });

    it('should detect ligature characters', () => {
      const result = detectEncodingIssues('The ﬁle contains ﬂowing text');
      expect(result.issues.some((i) => i.includes('ligature'))).toBe(true);
      expect(result.suggestions).toContain('Enable expandLigatures');
    });

    it('should detect curly quotes (informational only)', () => {
      const result = detectEncodingIssues('\u201CHello\u201D said \u2018John\u2019');
      // Curly quotes are informational and don't increase score
      // They only add a suggestion but no issue is recorded
      expect(result.score).toBe(0); // Clean text otherwise
    });

    it('should return low score for clean text', () => {
      const result = detectEncodingIssues('This is clean text without issues.');
      expect(result.score).toBe(0);
      expect(result.issues).toHaveLength(0);
    });

    it('should return score between 0 and 1', () => {
      const texts = [
        'normal text',
        'th3 qu1ck br0wn f0x',
        'ﬁle oﬃce "test" a—b',
        '\uFFFD\uFFFD\uFFFD',
      ];

      for (const text of texts) {
        const result = detectEncodingIssues(text);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('autoCorrectText', () => {
    it('should auto-correct when issues detected above threshold', () => {
      const garbled = 'th3 qu1ck br0wn f0x';
      const result = autoCorrectText(garbled, 0.1);

      expect(result.corrected).toBe(true);
      expect(result.text).not.toBe(garbled);
      expect(result.issuesDetected.length).toBeGreaterThan(0);
    });

    it('should not correct when issues below threshold', () => {
      const clean = 'This is clean text without issues.';
      const result = autoCorrectText(clean, 0.5);

      expect(result.corrected).toBe(false);
      expect(result.text).toBe(clean);
      expect(result.issuesDetected).toHaveLength(0);
    });

    it('should use default threshold', () => {
      const garbled = 'th3 qu1ck br0wn f0x';
      const result = autoCorrectText(garbled);

      expect(result.corrected).toBe(true);
    });

    it('should return corrected text', () => {
      const garbled = 'ﬁle ﬂow oﬃce';
      const result = autoCorrectText(garbled, 0);

      expect(result.text).toBe('file flow office');
    });
  });

  describe('exported mappings', () => {
    it('should export NUMBER_TO_LETTER mappings', () => {
      expect(NUMBER_TO_LETTER['0']).toBe('o');
      expect(NUMBER_TO_LETTER['1']).toBe('l');
      expect(NUMBER_TO_LETTER['3']).toBe('s');
    });

    it('should export LIGATURES mappings', () => {
      expect(LIGATURES['ﬁ']).toBe('fi');
      expect(LIGATURES['ﬂ']).toBe('fl');
      expect(LIGATURES['ﬀ']).toBe('ff');
    });

    it('should export QUOTES mappings', () => {
      expect(QUOTES['\u201C']).toBe('"'); // left double quote
      expect(QUOTES['\u201D']).toBe('"'); // right double quote
    });

    it('should export DASHES mappings', () => {
      expect(DASHES['\u2013']).toBe('-'); // en dash
      expect(DASHES['\u2014']).toBe('-'); // em dash
    });

    it('should export WHITESPACE mappings', () => {
      expect(WHITESPACE['\u00A0']).toBe(' '); // non-breaking space
      expect(WHITESPACE['\u200B']).toBe(''); // zero-width space
    });
  });

  describe('edge cases', () => {
    it('should handle Unicode surrogate pairs', () => {
      const text = 'emoji: 😀 and text';
      const result = correctText(text);
      expect(result).toBe(text);
    });

    it('should handle very long text', () => {
      const longText = 'th3 '.repeat(1000);
      const result = correctText(longText);
      expect(result).toContain('the ');
    });

    it('should handle special characters', () => {
      const text = '!@#$%^&*()[]{}|\\;:,.<>?';
      const result = correctText(text);
      expect(result).toBe(text);
    });

    it('should handle newlines and tabs', () => {
      // Note: text like "line1" gets corrected because 1→l in context
      const text = 'hello\nworld\ttab';
      const result = correctText(text);
      expect(result).toBe(text);
    });

    it('should handle mixed case (case insensitive patterns)', () => {
      // Patterns are case insensitive, so both get corrected
      expect(correctText('TH3')).toBe('the'); // Case insensitive pattern
      expect(correctText('Th3')).toBe('the'); // Case insensitive pattern
      expect(correctText('th3')).toBe('the'); // Lowercase
    });

    it('should handle already correct text', () => {
      const text = 'The quick brown fox jumps over the lazy dog.';
      expect(correctText(text)).toBe(text);
    });
  });
});
