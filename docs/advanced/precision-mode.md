# Precision Mode

Advanced character extraction with full PDF operator tracking.

## Overview

Precision mode provides exact character positioning by tracking all PDF graphics state operators. Use this when standard extraction doesn't give accurate enough positions.

## When to Use

- Complex layouts with overlapping text
- Rotated or transformed text
- Documents requiring exact coordinates
- Debugging position issues

## Basic Usage

```typescript
import pdfexcavator, { extractCharsWithPrecision } from 'pdfexcavator';

const pdf = await pdfexcavator.open('document.pdf');
const page = pdf.pages[0];

const chars = await extractCharsWithPrecision(
  page.pdfPage,
  page.pageNumber,
  page.height,
  0  // doctop offset
);

for (const char of chars) {
  console.log({
    text: char.text,
    x: char.x0,
    y: char.y0,
    rotation: char.rotationAngle,
    textRise: char.textRise
  });
}
```

## Extraction Levels

### Standard Extraction

```typescript
const chars = await page.chars;
// Basic positions, fast
```

### With Colors

```typescript
import { extractCharsWithColors } from 'pdfexcavator';

const chars = await extractCharsWithColors(
  page.pdfPage, page.pageNumber, page.height, 0
);

for (const char of chars) {
  console.log(char.nonStrokingColor);  // Fill color
  console.log(char.strokingColor);     // Stroke color
}
```

### With Spacing

```typescript
import { extractCharsWithSpacing } from 'pdfexcavator';

const chars = await extractCharsWithSpacing(
  page.pdfPage, page.pageNumber, page.height, 0
);

// Includes charSpacing, wordSpacing, horizontalScale
```

### Full Precision

```typescript
import { extractCharsWithPrecision } from 'pdfexcavator';

const chars = await extractCharsWithPrecision(
  page.pdfPage, page.pageNumber, page.height, 0
);

// Full state tracking with rotation, textRise, etc.
```

## PDF State Tracker

Direct access to PDF graphics state.

```typescript
import { PDFStateTracker, createStateTracker } from 'pdfexcavator';

// Create tracker
const tracker = await createStateTracker(page.pdfPage, page.height);

// Get state at position
const state = tracker.getStateAt(x, y);

if (state) {
  console.log('Text state:', state.textState);
  console.log('Graphics state:', state.graphicsState);
  console.log('Transform matrix:', state.combinedMatrix);
}

// Calculate precise position
const position = tracker.calculatePrecisePosition(x, y, fontSize, charWidth);
console.log('Adjusted X:', position.x);
console.log('Adjusted Y:', position.y);
console.log('Text rise:', position.textRise);
console.log('Rotation:', position.rotationAngle);
```

## Text State Properties

```typescript
interface TextState {
  charSpacing: number;       // Extra space between characters
  wordSpacing: number;       // Extra space between words
  horizontalScale: number;   // Horizontal scaling factor
  leading: number;           // Line leading (spacing)
  textRise: number;          // Vertical offset (subscript/superscript)
  fontSize: number;
  fontName: string | null;   // Current font name (null if not set)
  renderingMode: number;     // Text rendering mode
}
```

## Graphics State Properties

```typescript
interface GraphicsState {
  ctm: number[];              // Current transformation matrix
  nonStrokingColor: Color;    // Fill color
  strokingColor: Color;       // Stroke color
  lineWidth: number;
  lineCap: number;
  lineJoin: number;
  miterLimit: number;
  dash: [number[], number] | null;  // [dashArray, dashPhase] or null
}
```

## Example: Extract Rotated Text

```typescript
async function extractRotatedText(pdfPath: string) {
  const pdf = await pdfexcavator.open(pdfPath);
  const page = pdf.pages[0];

  const chars = await extractCharsWithPrecision(
    page.pdfPage, page.pageNumber, page.height, 0
  );

  // Find rotated characters
  const rotated = chars.filter(c =>
    Math.abs(c.rotationAngle || 0) > 5
  );

  console.log(`Found ${rotated.length} rotated characters`);

  // Group by rotation angle
  const byAngle = new Map<number, typeof chars>();
  for (const char of rotated) {
    const angle = Math.round(char.rotationAngle || 0);
    if (!byAngle.has(angle)) byAngle.set(angle, []);
    byAngle.get(angle)!.push(char);
  }

  for (const [angle, chars] of byAngle) {
    const text = chars.map(c => c.text).join('');
    console.log(`${angle}°: "${text}"`);
  }

  await pdf.close();
}
```

## Example: Extract Subscript/Superscript

```typescript
async function extractSubSuperscript(pdfPath: string) {
  const pdf = await pdfexcavator.open(pdfPath);
  const page = pdf.pages[0];

  const chars = await extractCharsWithPrecision(
    page.pdfPage, page.pageNumber, page.height, 0
  );

  // Find characters with text rise
  const raised = chars.filter(c =>
    Math.abs(c.textRise || 0) > 1
  );

  for (const char of raised) {
    const type = (char.textRise || 0) > 0 ? 'superscript' : 'subscript';
    console.log(`${char.text}: ${type} (rise: ${char.textRise})`);
  }

  await pdf.close();
}
```

## Performance Considerations

Precision mode is slower than standard extraction:

| Mode | Speed | Accuracy |
|------|-------|----------|
| Standard | Fast | Good |
| With Colors | Medium | Good + colors |
| With Spacing | Medium | Better spacing |
| Full Precision | Slow | Exact |

Use precision mode only when needed:

```typescript
async function smartExtract(page) {
  // Try standard first
  const text = await page.extractText();

  // Check for issues
  if (hasPositionIssues(text)) {
    // Fall back to precision
    const chars = await extractCharsWithPrecision(...);
    return buildTextFromChars(chars);
  }

  return text;
}
```
