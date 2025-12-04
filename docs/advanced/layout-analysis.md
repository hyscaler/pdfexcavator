# Layout Analysis

LAParams-style layout analysis for precise text grouping.

## Overview

Layout analysis provides fine-grained control over how characters are grouped into words, lines, and blocks. Based on pdfminer's LAParams concept.

## Basic Usage

```typescript
import { analyzeLayout, DEFAULT_LAPARAMS } from 'pdfexcavator';

const chars = await page.chars;
const result = analyzeLayout(chars, {
  lineOverlap: 0.5,
  charMargin: 2.0,
  wordMargin: 0.1,
  lineMargin: 0.5
});

console.log(result.words);   // Grouped words
console.log(result.lines);   // Grouped lines
console.log(result.text);    // Reconstructed text
```

## Page Methods

```typescript
// Analyze with custom params
const result = await page.analyzeLayout({
  charMargin: 2.0,
  wordMargin: 0.2
});

// Get words with layout analysis
const words = await page.getWordsWithLayout();

// Get lines with layout analysis
const lines = await page.getLinesWithLayout();

// Extract text with layout params
const text = await page.extractTextWithLayout({
  lineOverlap: 0.5,
  charMargin: 2.0
});
```

## Layout Parameters

### DEFAULT_LAPARAMS

```typescript
const DEFAULT_LAPARAMS = {
  lineOverlap: 0.5,      // Min overlap for same line
  charMargin: 2.0,       // Max gap between chars (in char widths)
  wordMargin: 0.1,       // Min gap for word break (in char widths)
  lineMargin: 0.5,       // Min gap between lines (in line heights)
  boxesFlow: 0.5,        // Text flow direction bias
  detectVertical: true,  // Detect vertical text
  allTexts: false        // Include all text objects
};
```

### Parameter Details

#### lineOverlap

Minimum vertical overlap ratio for characters to be on the same line.

```typescript
// Strict: characters must overlap significantly
{ lineOverlap: 0.7 }

// Loose: small overlap is enough
{ lineOverlap: 0.3 }
```

#### charMargin

Maximum horizontal gap (in character widths) between characters in the same word.

```typescript
// Tight: characters must be close
{ charMargin: 1.0 }

// Loose: allow larger gaps
{ charMargin: 3.0 }
```

#### wordMargin

Minimum horizontal gap (in character widths) to break between words.

```typescript
// Small gap triggers word break
{ wordMargin: 0.1 }

// Require larger gap
{ wordMargin: 0.3 }
```

#### lineMargin

Minimum vertical gap (in line heights) between lines.

```typescript
// Tight line spacing
{ lineMargin: 0.3 }

// Normal spacing
{ lineMargin: 0.5 }
```

#### detectVertical

Enable detection of vertical text.

```typescript
{ detectVertical: true }  // Detect rotated text
{ detectVertical: false } // Ignore vertical text
```

## LayoutAnalyzer Class

For more control, use the LayoutAnalyzer class directly.

```typescript
import { LayoutAnalyzer } from 'pdfexcavator';

const analyzer = new LayoutAnalyzer({
  lineOverlap: 0.5,
  charMargin: 2.0,
  wordMargin: 0.1
});

const chars = await page.chars;

// Analyze to words
const words = analyzer.analyzeCharsToWords(chars);

// Analyze to lines
const lines = analyzer.analyzeCharsToLines(chars);

// Full analysis
const result = analyzer.analyze(chars);
```

## Text Direction Detection

```typescript
import { detectReadingDirection, isVerticalText } from 'pdfexcavator';

const chars = await page.chars;

// Detect overall direction
const direction = detectReadingDirection(chars);
// 'ltr' | 'rtl' | 'ttb'

// Check for vertical text
const hasVertical = isVerticalText(chars);
```

## Column Detection

```typescript
import { detectTextColumns } from 'pdfexcavator';

const chars = await page.chars;
const columns = detectTextColumns(chars);

// Returns column boundaries
// [{ x0: 50, x1: 280 }, { x0: 320, x1: 550 }]
```

## Example: Custom Layout for Dense Text

```typescript
async function extractDenseText(pdfPath: string) {
  const pdf = await pdfexcavator.open(pdfPath);
  const page = pdf.pages[0];

  // Tighter parameters for dense text
  const result = await page.analyzeLayout({
    lineOverlap: 0.6,    // Stricter line detection
    charMargin: 1.5,     // Tighter character grouping
    wordMargin: 0.15,    // Slightly larger word breaks
    lineMargin: 0.4      // Tighter line spacing
  });

  await pdf.close();
  return result.text;
}
```

## Example: Extract Text Blocks

```typescript
async function extractTextBlocks(pdfPath: string) {
  const pdf = await pdfexcavator.open(pdfPath);
  const page = pdf.pages[0];

  const analyzer = new LayoutAnalyzer({
    lineMargin: 1.0  // Larger gap = new block
  });

  const chars = await page.chars;
  const lines = analyzer.analyzeCharsToLines(chars);

  // Group lines into blocks by gap
  const blocks: string[][] = [];
  let currentBlock: string[] = [];
  let lastY = 0;

  for (const line of lines) {
    if (lastY && line.y0 - lastY > 20) {
      if (currentBlock.length) {
        blocks.push(currentBlock);
      }
      currentBlock = [];
    }
    currentBlock.push(line.text);
    lastY = line.y1;
  }

  if (currentBlock.length) {
    blocks.push(currentBlock);
  }

  await pdf.close();
  return blocks.map(b => b.join('\n'));
}
```

## Example: Handle Mixed Orientations

```typescript
async function extractMixedOrientations(pdfPath: string) {
  const pdf = await pdfexcavator.open(pdfPath);
  const page = pdf.pages[0];
  const chars = await page.chars;

  // Separate horizontal and vertical text
  const horizontal = chars.filter(c => c.upright);
  const vertical = chars.filter(c => !c.upright);

  // Analyze separately
  const hResult = analyzeLayout(horizontal);
  const vResult = analyzeLayout(vertical, { detectVertical: true });

  console.log('Horizontal text:', hResult.text);
  console.log('Vertical text:', vResult.text);

  await pdf.close();
}
```

## Tips

1. **Start with defaults**: DEFAULT_LAPARAMS works for most documents
2. **Adjust charMargin**: For text with unusual spacing
3. **Adjust lineMargin**: For documents with tight/loose line spacing
4. **Test incrementally**: Change one parameter at a time
5. **Visual debugging**: Render page and draw word/line boxes
