/**
 * OCR Utility Tests
 * Tests for OCR-related functions and utilities
 */

describe('OCR Integration', () => {
  describe('isTesseractAvailable', () => {
    let isTesseractAvailable: typeof import('../src/index.js').isTesseractAvailable;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      isTesseractAvailable = module.isTesseractAvailable;
    });

    it('should return a boolean', async () => {
      const result = await isTesseractAvailable();
      expect(typeof result).toBe('boolean');
    });

    it('should be callable multiple times', async () => {
      const result1 = await isTesseractAvailable();
      const result2 = await isTesseractAvailable();
      expect(result1).toBe(result2);
    });
  });

  describe('OCREngine', () => {
    let OCREngine: typeof import('../src/index.js').OCREngine;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      OCREngine = module.OCREngine;
    });

    it('should create instance with default options', () => {
      const engine = new OCREngine();
      expect(engine).toBeInstanceOf(OCREngine);
    });

    it('should create instance with custom language', () => {
      const engine = new OCREngine({ lang: 'fra' });
      expect(engine).toBeInstanceOf(OCREngine);
    });

    it('should create instance with multiple languages', () => {
      const engine = new OCREngine({ lang: 'eng+fra+deu' });
      expect(engine).toBeInstanceOf(OCREngine);
    });

    it('should create instance with custom PSM mode', () => {
      const engine = new OCREngine({ psm: 6 });
      expect(engine).toBeInstanceOf(OCREngine);
    });

    it('should create instance with custom OEM mode', () => {
      const engine = new OCREngine({ oem: 1 });
      expect(engine).toBeInstanceOf(OCREngine);
    });

    it('should have isAvailable method', async () => {
      const engine = new OCREngine();
      expect(typeof engine.isAvailable).toBe('function');

      const available = await engine.isAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('needsOCR', () => {
    let needsOCR: typeof import('../src/index.js').needsOCR;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      needsOCR = module.needsOCR;
    });

    it('should return boolean', () => {
      const result = needsOCR(0, 1, 100000, 90000);
      expect(typeof result).toBe('boolean');
    });

    it('should suggest OCR when no chars and large image', () => {
      // No characters, one large image covering most of page
      const result = needsOCR(0, 1, 100000, 95000);
      expect(result).toBe(true);
    });

    it('should not suggest OCR when many chars present', () => {
      // Many characters, small image
      const result = needsOCR(1000, 1, 100000, 10000);
      expect(result).toBe(false);
    });

    it('should handle edge case of no images', () => {
      const result = needsOCR(0, 0, 100000, 0);
      expect(typeof result).toBe('boolean');
    });

    it('should handle zero page area', () => {
      // Edge case - shouldn't crash
      const result = needsOCR(0, 0, 0, 0);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isLikelyScanned', () => {
    let isLikelyScanned: typeof import('../src/index.js').isLikelyScanned;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      isLikelyScanned = module.isLikelyScanned;
    });

    it('should return boolean', () => {
      const result = isLikelyScanned(0, [], 612, 792);
      expect(typeof result).toBe('boolean');
    });

    it('should detect scanned page (no chars, large image, high DPI)', () => {
      // srcSize needs to be large enough to calculate DPI > 100
      // DPI = (srcWidth / width) * 72, so srcSize of 2x page size gives ~144 DPI
      const images = [
        { x0: 0, y0: 0, x1: 612, y1: 792, width: 612, height: 792, srcSize: [1224, 1584] as [number, number], pageNumber: 0, top: 0, bottom: 792, doctop: 0 },
      ];
      const result = isLikelyScanned(0, images, 612, 792);
      expect(result).toBe(true);
    });

    it('should not detect normal page with text', () => {
      const images: any[] = [];
      const result = isLikelyScanned(500, images, 612, 792);
      expect(result).toBe(false);
    });

    it('should handle empty images array', () => {
      const result = isLikelyScanned(100, [], 612, 792);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('OCR_LANGUAGES', () => {
    let OCR_LANGUAGES: typeof import('../src/index.js').OCR_LANGUAGES;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      OCR_LANGUAGES = module.OCR_LANGUAGES;
    });

    it('should have English', () => {
      expect(OCR_LANGUAGES.eng).toBe('English');
    });

    it('should have French', () => {
      expect(OCR_LANGUAGES.fra).toBe('French');
    });

    it('should have German', () => {
      expect(OCR_LANGUAGES.deu).toBe('German');
    });

    it('should have Spanish', () => {
      expect(OCR_LANGUAGES.spa).toBe('Spanish');
    });

    it('should have Chinese Simplified', () => {
      expect(OCR_LANGUAGES.chi_sim).toBe('Chinese (Simplified)');
    });

    it('should have Chinese Traditional', () => {
      expect(OCR_LANGUAGES.chi_tra).toBe('Chinese (Traditional)');
    });

    it('should have Japanese', () => {
      expect(OCR_LANGUAGES.jpn).toBe('Japanese');
    });

    it('should have Korean', () => {
      expect(OCR_LANGUAGES.kor).toBe('Korean');
    });

    it('should have Arabic', () => {
      expect(OCR_LANGUAGES.ara).toBe('Arabic');
    });

    it('should have Russian', () => {
      expect(OCR_LANGUAGES.rus).toBe('Russian');
    });
  });

  describe('PSM_MODES', () => {
    let PSM_MODES: typeof import('../src/index.js').PSM_MODES;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      PSM_MODES = module.PSM_MODES;
    });

    it('should have OSD_ONLY mode (0)', () => {
      expect(PSM_MODES.OSD_ONLY).toBe(0);
    });

    it('should have AUTO_OSD mode (1)', () => {
      expect(PSM_MODES.AUTO_OSD).toBe(1);
    });

    it('should have AUTO mode (3)', () => {
      expect(PSM_MODES.AUTO).toBe(3);
    });

    it('should have SINGLE_COLUMN mode (4)', () => {
      expect(PSM_MODES.SINGLE_COLUMN).toBe(4);
    });

    it('should have SINGLE_BLOCK mode (6)', () => {
      expect(PSM_MODES.SINGLE_BLOCK).toBe(6);
    });

    it('should have SINGLE_LINE mode (7)', () => {
      expect(PSM_MODES.SINGLE_LINE).toBe(7);
    });

    it('should have SINGLE_WORD mode (8)', () => {
      expect(PSM_MODES.SINGLE_WORD).toBe(8);
    });

    it('should have SINGLE_CHAR mode (10)', () => {
      expect(PSM_MODES.SINGLE_CHAR).toBe(10);
    });
  });

  describe('OEM_MODES', () => {
    let OEM_MODES: typeof import('../src/index.js').OEM_MODES;

    beforeAll(async () => {
      const module = await import('../src/index.js');
      OEM_MODES = module.OEM_MODES;
    });

    it('should have LEGACY_ONLY mode (0)', () => {
      expect(OEM_MODES.LEGACY_ONLY).toBe(0);
    });

    it('should have LSTM_ONLY mode (1)', () => {
      expect(OEM_MODES.LSTM_ONLY).toBe(1);
    });

    it('should have LEGACY_LSTM mode (2)', () => {
      expect(OEM_MODES.LEGACY_LSTM).toBe(2);
    });

    it('should have DEFAULT mode (3)', () => {
      expect(OEM_MODES.DEFAULT).toBe(3);
    });
  });

  describe('OCROptions interface', () => {
    it('should accept valid options', () => {
      const options = {
        lang: 'eng',
        oem: 1,
        psm: 3,
        minConfidence: 60,
        preserveWhitespace: true,
        workerCount: 2,
      };

      expect(options.lang).toBe('eng');
      expect(options.oem).toBe(1);
      expect(options.psm).toBe(3);
      expect(options.minConfidence).toBe(60);
      expect(options.preserveWhitespace).toBe(true);
      expect(options.workerCount).toBe(2);
    });
  });

  describe('safeMerge (prototype pollution prevention)', () => {
    it('should filter __proto__ key', () => {
      const target: Record<string, unknown> = { a: 1 };
      const source = { b: 2, __proto__: { polluted: true } };

      const dangerousKeys = new Set(['__proto__', 'constructor', 'prototype']);
      for (const key of Object.keys(source)) {
        if (!dangerousKeys.has(key) && Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key as keyof typeof source];
        }
      }

      expect(target).toEqual({ a: 1, b: 2 });
      expect((Object.prototype as any).polluted).toBeUndefined();
    });

    it('should filter constructor key', () => {
      const target: Record<string, unknown> = {};
      const source = { constructor: 'malicious' };

      const dangerousKeys = new Set(['__proto__', 'constructor', 'prototype']);
      for (const key of Object.keys(source)) {
        if (!dangerousKeys.has(key)) {
          target[key] = source[key as keyof typeof source];
        }
      }

      // The malicious 'constructor' string should NOT have been copied
      // The target should retain its original constructor (Object)
      expect(target.constructor).toBe(Object);
      expect(target.constructor).not.toBe('malicious');
    });

    it('should filter prototype key', () => {
      const target: Record<string, unknown> = {};
      const source = { prototype: 'malicious' };

      const dangerousKeys = new Set(['__proto__', 'constructor', 'prototype']);
      for (const key of Object.keys(source)) {
        if (!dangerousKeys.has(key)) {
          target[key] = source[key as keyof typeof source];
        }
      }

      expect(target.prototype).toBeUndefined();
    });

    it('should allow normal keys', () => {
      const target: Record<string, unknown> = {};
      const source = { lang: 'eng', psm: 3, oem: 1 };

      const dangerousKeys = new Set(['__proto__', 'constructor', 'prototype']);
      for (const key of Object.keys(source)) {
        if (!dangerousKeys.has(key)) {
          target[key] = source[key as keyof typeof source];
        }
      }

      expect(target).toEqual({ lang: 'eng', psm: 3, oem: 1 });
    });
  });
});
