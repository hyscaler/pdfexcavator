# Font Handling

Working with fonts, substitution, and CJK text.

## Font Information

### Get Font from Characters

```typescript
const chars = await page.chars;

for (const char of chars) {
  console.log({
    text: char.text,
    fontName: char.fontName,
    fontSize: char.size
  });
}
```

### Unique Fonts on Page

```typescript
const chars = await page.chars;
const fonts = [...new Set(chars.map(c => c.fontName))];
console.log('Fonts used:', fonts);
```

## Font Substitution

PDFLens automatically substitutes fonts for the 14 PDF base fonts.

### Find Substitution

```typescript
import { findFontSubstitution } from 'pdflens';

const sub = findFontSubstitution('Arial');
console.log(sub.substituteFont);  // 'Helvetica'
console.log(sub.confidence);      // 0.95
```

### Font Classification

```typescript
import { classifyFont } from 'pdflens';

classifyFont('Times');      // 'serif'
classifyFont('Arial');      // 'sans-serif'
classifyFont('Courier');    // 'monospace'
classifyFont('Symbol');     // 'symbol'
```

### Parse Font Style

```typescript
import { parseFontStyle } from 'pdflens';

const style = parseFontStyle('Arial-BoldItalic');
console.log(style.bold);      // true
console.log(style.italic);    // true
console.log(style.weight);    // 700
console.log(style.baseName);  // 'Arial'
```

## PDF Base Fonts

```typescript
import { PDF_BASE_FONTS, STANDARD_FONT_METRICS } from 'pdflens';

console.log(PDF_BASE_FONTS);
// ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique',
//  'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic',
//  'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique',
//  'Symbol', 'ZapfDingbats']

console.log(STANDARD_FONT_METRICS['Helvetica']);
// { ascent: 718, descent: -207, avgWidth: 513, ... }
```

## Font Metrics

### Extract Metrics

```typescript
import { extractFontMetrics, getCharWidth, getBaseline } from 'pdflens';

// Get metrics for fonts on page
const textContent = await pdfPage.getTextContent();
const metrics = await extractFontMetrics(pdfPage, textContent);

// Get character width
const width = getCharWidth(metrics.get('Helvetica'), 'A', 12);

// Get baseline
const baseline = getBaseline('Helvetica', 12);
```

### Track Substitutions

```typescript
import {
  getFontSubstitutions,
  getMissingFonts,
  resetFontSubstitutions
} from 'pdflens';

// After processing
const subs = getFontSubstitutions();
console.log('Substituted fonts:', subs);

const missing = getMissingFonts();
console.log('Missing fonts:', missing);

// Reset tracking
resetFontSubstitutions();
```

## Font Substitution Manager

```typescript
import { FontSubstitutionManager } from 'pdflens';

const manager = new FontSubstitutionManager();

// Get substitution
const sub = manager.getSubstitution('ArialMT');
console.log(sub);  // { original: 'ArialMT', substitute: 'Helvetica', ... }

// Get all substitutions made
console.log(manager.getAllSubstitutions());
```

## CJK Text Support

### Detect CJK Fonts

```typescript
import { isCJKFont } from 'pdflens';

isCJKFont('SimSun');     // true - Chinese
isCJKFont('MS-Mincho');  // true - Japanese
isCJKFont('Gulim');      // true - Korean
isCJKFont('Arial');      // false
```

### Normalize CJK Text

```typescript
import { normalizeCJKText } from 'pdflens';

// Convert fullwidth to halfwidth
normalizeCJKText('ABC');  // 'ABC'
normalizeCJKText('123');  // '123'
```

### CMap Configuration

```typescript
import { getDefaultCMapConfig } from 'pdflens';

// Get CMap config for pdf.js
const config = await getDefaultCMapConfig();
// { cMapUrl: '/node_modules/pdfjs-dist/cmaps/', cMapPacked: true }
```

## Example: Font Analysis

```typescript
async function analyzeFonts(pdfPath: string) {
  const pdf = await pdflens.open(pdfPath);
  const fontUsage = new Map<string, { count: number; sizes: Set<number> }>();

  for (const page of pdf.pages) {
    const chars = await page.chars;

    for (const char of chars) {
      const font = char.fontName;
      if (!fontUsage.has(font)) {
        fontUsage.set(font, { count: 0, sizes: new Set() });
      }
      const usage = fontUsage.get(font)!;
      usage.count++;
      usage.sizes.add(Math.round(char.size));
    }
  }

  console.log('Font Usage Report:');
  for (const [font, usage] of fontUsage) {
    const sizes = [...usage.sizes].sort((a, b) => a - b).join(', ');
    console.log(`  ${font}: ${usage.count} chars, sizes: ${sizes}`);

    // Check substitution
    const sub = findFontSubstitution(font);
    if (sub.substituteFont !== font) {
      console.log(`    → Substituted with: ${sub.substituteFont}`);
    }
  }

  await pdf.close();
}
```

## Example: Filter by Font

```typescript
async function extractByFont(pdfPath: string, targetFont: string) {
  const pdf = await pdflens.open(pdfPath);
  const page = pdf.pages[0];

  const filtered = page.filter(obj =>
    obj.fontName?.toLowerCase().includes(targetFont.toLowerCase())
  );

  const text = await filtered.extractText();
  await pdf.close();
  return text;
}

// Extract only bold text
const boldText = await extractByFont('document.pdf', 'bold');
```

## Example: Detect Font Issues

```typescript
async function detectFontIssues(pdfPath: string) {
  const pdf = await pdflens.open(pdfPath);
  const issues: string[] = [];

  for (const page of pdf.pages) {
    const chars = await page.chars;

    for (const char of chars) {
      // Check for synthetic fonts (OCR)
      if (char.fontName.match(/^g_d\d+_f\d+$/)) {
        issues.push(`Page ${page.pageNumber + 1}: OCR synthetic font detected`);
        break;
      }

      // Check for missing glyphs (tofu)
      if (char.text === '\uFFFD') {
        issues.push(`Page ${page.pageNumber + 1}: Missing glyph at (${char.x0}, ${char.y0})`);
      }
    }
  }

  await pdf.close();
  return issues;
}
```

## Tips

1. **Check for OCR fonts**: Synthetic font names like `g_d0_f1` indicate OCR
2. **Use substitution**: Let PDFLens handle font mapping automatically
3. **CJK setup**: Ensure CMap files are available for Asian text
4. **Font filtering**: Use font name to identify headings, body text, etc.
