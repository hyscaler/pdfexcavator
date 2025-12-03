/**
 * PDFLens Unit Tests
 */

import {
  LayoutAnalyzer,
  analyzeLayout,
  detectTextColumns,
  detectReadingDirection,
  isVerticalText,
  DEFAULT_LAPARAMS,
  FontSubstitutionManager,
  findFontSubstitution,
  classifyFont,
  parseFontStyle,
  PDF_BASE_FONTS,
  FONT_SUBSTITUTION_MAP,
  STANDARD_FONT_METRICS,
  getDefaultCMapConfig,
  isCJKFont,
  normalizeCJKText,
  isTesseractAvailable,
  OCREngine,
  OCR_LANGUAGES,
  PSM_MODES,
  OEM_MODES,
  Page,
} from '../src/index.js';
import type { PDFChar, LayoutParams } from '../src/index.js';

// Helper to create mock PDFChar objects
function createMockChar(
  text: string,
  x0: number,
  y0: number,
  width: number = 10,
  height: number = 12
): PDFChar {
  return {
    text,
    x0,
    y0,
    x1: x0 + width,
    y1: y0 + height,
    width,
    height,
    top: y0,
    bottom: y0 + height,
    doctop: y0,
    fontName: 'TestFont',
    size: 12,
    adv: width,
    upright: true,
    matrix: [1, 0, 0, 1, x0, y0],
    strokingColor: null,
    nonStrokingColor: null,
    pageNumber: 0,
  };
}

describe('LAParams Layout Analysis', () => {
  describe('DEFAULT_LAPARAMS', () => {
    it('should have all required properties', () => {
      expect(DEFAULT_LAPARAMS).toHaveProperty('lineOverlap');
      expect(DEFAULT_LAPARAMS).toHaveProperty('charMargin');
      expect(DEFAULT_LAPARAMS).toHaveProperty('wordMargin');
      expect(DEFAULT_LAPARAMS).toHaveProperty('lineMargin');
      expect(DEFAULT_LAPARAMS).toHaveProperty('boxesFlow');
      expect(DEFAULT_LAPARAMS).toHaveProperty('detectVertical');
      expect(DEFAULT_LAPARAMS).toHaveProperty('allTexts');
    });

    it('should have correct default values', () => {
      expect(DEFAULT_LAPARAMS.lineOverlap).toBe(0.5);
      expect(DEFAULT_LAPARAMS.charMargin).toBe(2.0);
      expect(DEFAULT_LAPARAMS.wordMargin).toBe(0.1);
      expect(DEFAULT_LAPARAMS.lineMargin).toBe(0.5);
      expect(DEFAULT_LAPARAMS.boxesFlow).toBe(0.5);
      expect(DEFAULT_LAPARAMS.detectVertical).toBe(true);
      expect(DEFAULT_LAPARAMS.allTexts).toBe(false);
    });
  });

  describe('LayoutAnalyzer', () => {
    it('should instantiate with default params', () => {
      const analyzer = new LayoutAnalyzer();
      expect(analyzer).toBeInstanceOf(LayoutAnalyzer);
    });

    it('should instantiate with custom params', () => {
      const analyzer = new LayoutAnalyzer({ lineOverlap: 0.7 });
      expect(analyzer).toBeInstanceOf(LayoutAnalyzer);
    });

    it('should return empty arrays for empty input', () => {
      const analyzer = new LayoutAnalyzer();
      expect(analyzer.analyzeCharsToWords([])).toEqual([]);
      expect(analyzer.analyzeCharsToLines([])).toEqual([]);
      expect(analyzer.extractText([])).toBe('');
    });

    it('should extract text from characters', () => {
      const analyzer = new LayoutAnalyzer();
      const chars = [
        createMockChar('H', 0, 0),
        createMockChar('i', 10, 0),
      ];
      const text = analyzer.extractText(chars);
      expect(text).toContain('Hi');
    });
  });

  describe('analyzeLayout', () => {
    it('should return words, lines, and text', () => {
      const chars = [
        createMockChar('T', 0, 0),
        createMockChar('e', 10, 0),
        createMockChar('s', 20, 0),
        createMockChar('t', 30, 0),
      ];
      const result = analyzeLayout(chars);
      expect(result).toHaveProperty('words');
      expect(result).toHaveProperty('lines');
      expect(result).toHaveProperty('text');
      expect(result.text).toContain('Test');
    });
  });

  describe('detectTextColumns', () => {
    it('should return empty array for insufficient chars', () => {
      const chars = [createMockChar('A', 0, 0)];
      const columns = detectTextColumns(chars);
      expect(columns).toEqual([]);
    });
  });

  describe('detectReadingDirection', () => {
    it('should return ltr for left-to-right text', () => {
      const chars = [
        createMockChar('A', 0, 0),
        createMockChar('B', 10, 0),
        createMockChar('C', 20, 0),
      ];
      expect(detectReadingDirection(chars)).toBe('ltr');
    });

    it('should return ltr for single character', () => {
      const chars = [createMockChar('A', 0, 0)];
      expect(detectReadingDirection(chars)).toBe('ltr');
    });
  });

  describe('isVerticalText', () => {
    it('should return false for horizontal text', () => {
      const chars = [
        createMockChar('A', 0, 0),
        createMockChar('B', 10, 0),
        createMockChar('C', 20, 0),
      ];
      expect(isVerticalText(chars)).toBe(false);
    });

    it('should return false for single character', () => {
      const chars = [createMockChar('A', 0, 0)];
      expect(isVerticalText(chars)).toBe(false);
    });
  });
});

describe('Font Substitution', () => {
  describe('FontSubstitutionManager', () => {
    it('should create instance', () => {
      const manager = new FontSubstitutionManager();
      expect(manager).toBeInstanceOf(FontSubstitutionManager);
    });

    it('should get substitution for known font', () => {
      const manager = new FontSubstitutionManager();
      const sub = manager.getSubstitution('Arial');
      expect(sub.substituteFont).toBe('Helvetica');
      expect(sub.confidence).toBeGreaterThan(0.9);
    });

    it('should track all substitutions', () => {
      const manager = new FontSubstitutionManager();
      manager.getSubstitution('Arial');
      manager.getSubstitution('TimesNewRoman');
      const subs = manager.getAllSubstitutions();
      expect(subs.length).toBe(2);
    });

    it('should clear substitutions', () => {
      const manager = new FontSubstitutionManager();
      manager.getSubstitution('Arial');
      manager.clear();
      expect(manager.getAllSubstitutions().length).toBe(0);
    });
  });

  describe('findFontSubstitution', () => {
    it('should find substitution for Arial', () => {
      const sub = findFontSubstitution('Arial');
      expect(sub.originalFont).toBe('Arial');
      expect(sub.substituteFont).toBe('Helvetica');
    });

    it('should find substitution for Times variants', () => {
      const sub = findFontSubstitution('TimesNewRoman');
      expect(sub.substituteFont).toBe('Times-Roman');
    });

    it('should find substitution for Courier variants', () => {
      const sub = findFontSubstitution('CourierNew');
      expect(sub.substituteFont).toBe('Courier');
    });
  });

  describe('classifyFont', () => {
    it('should classify serif fonts', () => {
      expect(classifyFont('Times')).toBe('serif');
      expect(classifyFont('Georgia')).toBe('serif');
    });

    it('should classify sans-serif fonts', () => {
      expect(classifyFont('Helvetica')).toBe('sans-serif');
      expect(classifyFont('Arial')).toBe('sans-serif');
    });

    it('should classify monospace fonts', () => {
      expect(classifyFont('Courier')).toBe('monospace');
      expect(classifyFont('Consolas')).toBe('monospace');
    });
  });

  describe('parseFontStyle', () => {
    it('should detect bold', () => {
      expect(parseFontStyle('Arial-Bold').bold).toBe(true);
      expect(parseFontStyle('Arial').bold).toBe(false);
    });

    it('should detect italic', () => {
      expect(parseFontStyle('Arial-Italic').italic).toBe(true);
      expect(parseFontStyle('Arial-Oblique').italic).toBe(true);
    });

    it('should return weight', () => {
      expect(parseFontStyle('Arial-Bold').weight).toBe(700);
      expect(parseFontStyle('Arial-Light').weight).toBe(300);
    });
  });

  describe('PDF_BASE_FONTS', () => {
    it('should contain 14 base fonts', () => {
      expect(PDF_BASE_FONTS.length).toBe(14);
    });

    it('should contain expected fonts', () => {
      expect(PDF_BASE_FONTS).toContain('Helvetica');
      expect(PDF_BASE_FONTS).toContain('Times-Roman');
      expect(PDF_BASE_FONTS).toContain('Courier');
      expect(PDF_BASE_FONTS).toContain('Symbol');
    });
  });

  describe('STANDARD_FONT_METRICS', () => {
    it('should have metrics for all base fonts', () => {
      for (const font of PDF_BASE_FONTS) {
        expect(STANDARD_FONT_METRICS).toHaveProperty(font);
      }
    });

    it('should have correct metric properties', () => {
      const metrics = STANDARD_FONT_METRICS['Helvetica'];
      expect(metrics).toHaveProperty('ascent');
      expect(metrics).toHaveProperty('descent');
      expect(metrics).toHaveProperty('avgWidth');
      expect(metrics).toHaveProperty('capHeight');
      expect(metrics).toHaveProperty('xHeight');
    });
  });
});

describe('CMap Support', () => {
  describe('isCJKFont', () => {
    it('should detect Japanese fonts', () => {
      expect(isCJKFont('HeiseiMin-W3')).toBe(true);
      expect(isCJKFont('KozMinPr6N')).toBe(true);
      expect(isCJKFont('Meiryo')).toBe(true);
    });

    it('should detect Chinese fonts', () => {
      expect(isCJKFont('SimSun')).toBe(true);
      expect(isCJKFont('MingLiU')).toBe(true);
      expect(isCJKFont('Microsoft YaHei')).toBe(true);
    });

    it('should detect Korean fonts', () => {
      expect(isCJKFont('Gulim')).toBe(true);
      expect(isCJKFont('Malgun')).toBe(true);
    });

    it('should not detect non-CJK fonts', () => {
      expect(isCJKFont('Arial')).toBe(false);
      expect(isCJKFont('Helvetica')).toBe(false);
    });
  });

  describe('normalizeCJKText', () => {
    it('should convert fullwidth ASCII to regular ASCII', () => {
      expect(normalizeCJKText('ＡＢＣ')).toBe('ABC');
      expect(normalizeCJKText('１２３')).toBe('123');
    });

    it('should convert fullwidth space', () => {
      expect(normalizeCJKText('　')).toBe(' ');
    });

    it('should preserve regular text', () => {
      expect(normalizeCJKText('Hello')).toBe('Hello');
    });
  });

  describe('getDefaultCMapConfig', () => {
    it('should return config or null', async () => {
      const config = await getDefaultCMapConfig();
      // May be null if pdfjs-dist cmaps not found
      if (config) {
        expect(config).toHaveProperty('cMapUrl');
        expect(config).toHaveProperty('cMapPacked');
      }
    });
  });
});

describe('OCR Integration', () => {
  describe('isTesseractAvailable', () => {
    it('should return boolean', async () => {
      const available = await isTesseractAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('OCREngine', () => {
    it('should create instance', () => {
      const engine = new OCREngine({ lang: 'eng' });
      expect(engine).toBeInstanceOf(OCREngine);
    });

    it('should support checking availability', async () => {
      const engine = new OCREngine();
      const available = await engine.isAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('OCR_LANGUAGES', () => {
    it('should have English', () => {
      expect(OCR_LANGUAGES.eng).toBe('English');
    });

    it('should have CJK languages', () => {
      expect(OCR_LANGUAGES.chi_sim).toBe('Chinese (Simplified)');
      expect(OCR_LANGUAGES.jpn).toBe('Japanese');
      expect(OCR_LANGUAGES.kor).toBe('Korean');
    });
  });

  describe('PSM_MODES', () => {
    it('should have expected modes', () => {
      expect(PSM_MODES.AUTO).toBe(3);
      expect(PSM_MODES.SINGLE_LINE).toBe(7);
      expect(PSM_MODES.SINGLE_WORD).toBe(8);
    });
  });

  describe('OEM_MODES', () => {
    it('should have expected modes', () => {
      expect(OEM_MODES.LSTM_ONLY).toBe(1);
      expect(OEM_MODES.DEFAULT).toBe(3);
    });
  });
});

describe('Page Class', () => {
  describe('Static Methods', () => {
    it('should have getDefaultLAParams', () => {
      expect(typeof Page.getDefaultLAParams).toBe('function');
      const params = Page.getDefaultLAParams();
      expect(params).toHaveProperty('lineOverlap');
    });

    it('should have isOCRAvailable', async () => {
      expect(typeof Page.isOCRAvailable).toBe('function');
      const available = await Page.isOCRAvailable();
      expect(typeof available).toBe('boolean');
    });
  });
});
