# Text Extraction API

Functions for extracting text from PDFs at various levels of detail.

## High-Level Extraction

### Page Methods

```typescript
// Simple text extraction
const text = await page.extractText();

// With layout preservation
const text = await page.extractText({ layout: true });

// Fast extraction
const text = await page.extractTextSimple();

// For OCR'd documents
const text = await page.extractTextRaw();
```

## Low-Level Functions

### extractChars(textContent, pageNumber, pageHeight, doctopOffset?, unicodeNorm?)

Extract individual characters with full metadata.

```typescript
import { extractChars } from 'pdflens';

const textContent = await pdfPage.getTextContent();
const chars = extractChars(textContent, 0, pageHeight);

for (const char of chars) {
  console.log({
    text: char.text,
    x0: char.x0,
    y0: char.y0,
    x1: char.x1,
    y1: char.y1,
    fontName: char.fontName,
    size: char.size,
    color: char.nonStrokingColor
  });
}
```

**PDFChar Properties:**
| Property | Type | Description |
|----------|------|-------------|
| text | `string` | Character text |
| x0, y0 | `number` | Top-left position |
| x1, y1 | `number` | Bottom-right position |
| width, height | `number` | Dimensions |
| fontName | `string` | Font name |
| size | `number` | Font size |
| upright | `boolean` | Is upright text |
| matrix | `Matrix` | Transform matrix |
| nonStrokingColor | `Color` | Fill color |

### extractWords(chars, options?)

Group characters into words.

```typescript
import { extractWords } from 'pdflens';

const words = extractWords(chars, {
  xTolerance: 3,
  yTolerance: 3,
  splitAtPunctuation: false
});

for (const word of words) {
  console.log(`"${word.text}" at (${word.x0}, ${word.y0})`);
}
```

**PDFWord Properties:**
| Property | Type | Description |
|----------|------|-------------|
| text | `string` | Word text |
| x0, y0, x1, y1 | `number` | Bounding box |
| chars | `PDFChar[]` | Characters in word |
| direction | `'ltr' \| 'rtl'` | Text direction |

### extractLines(chars, options?)

Group characters into lines.

```typescript
import { extractLines } from 'pdflens';

const lines = extractLines(chars, { yTolerance: 3 });

for (const line of lines) {
  console.log(line.text);
}
```

### extractText(chars, options?)

Convert characters to text string.

```typescript
import { extractText } from 'pdflens';

const text = extractText(chars, {
  layout: false,
  xTolerance: 3,
  yTolerance: 3
});
```

### extractTextSimple(chars, xTolerance?, yTolerance?, useTextFlow?)

Fast text extraction.

```typescript
import { extractTextSimple } from 'pdflens';

const text = extractTextSimple(chars, 3, 3, true);
```

### extractTextFromItems(textContent, options?)

Extract text preserving PDF order. Best for OCR'd documents.

```typescript
import { extractTextFromItems } from 'pdflens';

const textContent = await pdfPage.getTextContent();
const text = extractTextFromItems(textContent, {
  detectLineBreaks: true,
  lineBreakThreshold: 5,
  addSpaces: true,
  spaceThreshold: 10
});
```

## Text Extraction Options

### TextExtractionOptions

```typescript
interface TextExtractionOptions {
  xTolerance?: number;        // Horizontal grouping (default: 3)
  xToleranceRatio?: number;   // Tolerance as ratio of char size
  yTolerance?: number;        // Vertical grouping (default: 3)
  layout?: boolean;           // Preserve visual layout (default: false)
  xDensity?: number;          // Horizontal density for layout
  yDensity?: number;          // Vertical density for layout
  keepBlankChars?: boolean;   // Keep blank characters
  useTextFlow?: boolean;      // Use PDF text flow (default: true)
}
```

### WordExtractionOptions

```typescript
interface WordExtractionOptions {
  xTolerance?: number;           // Horizontal tolerance
  yTolerance?: number;           // Vertical tolerance
  keepBlankChars?: boolean;      // Keep blanks
  useTextFlow?: boolean;         // Use PDF flow
  splitAtPunctuation?: boolean;  // Split at punctuation
  extraAttrs?: string[];         // Extra attributes to copy
}
```

## Character Correction

Fix common OCR/encoding issues in extracted text.

```typescript
import { correctText, autoCorrectText, detectEncodingIssues } from 'pdflens';

// Auto-detect and fix
const fixed = autoCorrectText(text);

// Manual options
const fixed = correctText(text, {
  numbersToLetters: true,  // 0→o, 1→l, 3→e
  ligatures: true,         // ﬁ→fi, ﬂ→fl
  quotes: true,            // Normalize quotes
  dashes: true,            // Normalize dashes
  whitespace: true         // Fix whitespace
});

// Check for issues
const issues = detectEncodingIssues(text);
if (issues.hasIssues) {
  console.log('Issues:', issues.types);
}
```

## Precision Extraction

For maximum accuracy with complex PDFs.

```typescript
import {
  extractCharsWithColors,
  extractCharsWithSpacing,
  extractCharsWithPrecision
} from 'pdflens';

// With color information
const chars = await extractCharsWithColors(pdfPage, pageNum, height, offset);

// With spacing adjustments
const chars = await extractCharsWithSpacing(pdfPage, pageNum, height, offset);

// Full precision with state tracking
const chars = await extractCharsWithPrecision(pdfPage, pageNum, height, offset);
```

## Example: Custom Text Processing

```typescript
import pdflens, { extractWords, clusterObjects } from 'pdflens';

async function extractParagraphs(pdfPath: string) {
  const pdf = await pdflens.open(pdfPath);
  const page = pdf.pages[0];

  // Get words
  const words = await page.extractWords();

  // Group into lines by y-position
  const lines = clusterObjects(words, w => w.y0, 5);

  // Sort lines top to bottom
  lines.sort((a, b) => Math.min(...a.map(w => w.y0)) - Math.min(...b.map(w => w.y0)));

  // Build paragraphs based on gaps
  const paragraphs: string[] = [];
  let currentPara = '';
  let lastY = 0;

  for (const lineWords of lines) {
    lineWords.sort((a, b) => a.x0 - b.x0);
    const lineText = lineWords.map(w => w.text).join(' ');
    const lineY = Math.min(...lineWords.map(w => w.y0));

    if (lastY && lineY - lastY > 20) {
      // Large gap = new paragraph
      paragraphs.push(currentPara.trim());
      currentPara = lineText;
    } else {
      currentPara += ' ' + lineText;
    }
    lastY = lineY;
  }

  if (currentPara) {
    paragraphs.push(currentPara.trim());
  }

  await pdf.close();
  return paragraphs;
}
```
