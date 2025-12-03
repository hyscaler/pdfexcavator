# Post-Processing Guide

Techniques for cleaning and structuring extracted PDF content.

## Text Cleaning

### Basic Cleaning

```typescript
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')           // Collapse whitespace
    .replace(/\n{3,}/g, '\n\n')     // Max 2 newlines
    .trim();
}
```

### Remove Headers/Footers

```typescript
function removeHeadersFooters(text) {
  return text
    // Page numbers
    .replace(/^Page\s+\d+\s*(of\s*\d+)?$/gim, '')
    // Confidential markers
    .replace(/confidential\s*[&]\s*proprietary/gi, '')
    // Separator lines
    .replace(/^[-_=]{5,}$/gm, '')
    // Empty lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
```

### Character Correction

```typescript
import { correctText, autoCorrectText } from 'pdflens';

// Automatic correction
const fixed = autoCorrectText(rawText);

// Manual options
const fixed = correctText(rawText, {
  numbersToLetters: true,   // 0→o, 1→l, 3→e
  ligatures: true,          // ﬁ→fi, ﬂ→fl
  quotes: true,             // Normalize quotes
  dashes: true,             // Normalize dashes
  whitespace: true          // Fix whitespace
});
```

## Grouping into Lines

```typescript
import { clusterObjects } from 'pdflens';

const words = await page.extractWords();

// Group by y-position (3px tolerance)
const lines = clusterObjects(words, w => w.y0, 3);

// Sort lines top to bottom
lines.sort((a, b) =>
  Math.min(...a.map(w => w.y0)) - Math.min(...b.map(w => w.y0))
);

// Build line text
const lineTexts = lines.map(lineWords => {
  lineWords.sort((a, b) => a.x0 - b.x0);  // Left to right
  return lineWords.map(w => w.text).join(' ');
});
```

## Paragraph Detection

```typescript
function detectParagraphs(lines, gapThreshold = 15) {
  const paragraphs = [];
  let currentPara = [];
  let lastBottom = 0;

  for (const line of lines) {
    const lineTop = Math.min(...line.words.map(w => w.y0));
    const lineBottom = Math.max(...line.words.map(w => w.y1));

    if (lastBottom && lineTop - lastBottom > gapThreshold) {
      // Large gap = new paragraph
      if (currentPara.length) {
        paragraphs.push(currentPara);
      }
      currentPara = [];
    }

    currentPara.push(line);
    lastBottom = lineBottom;
  }

  if (currentPara.length) {
    paragraphs.push(currentPara);
  }

  return paragraphs;
}
```

## Sentence Detection

```typescript
function splitIntoSentences(text) {
  // Split on sentence-ending punctuation
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// Or detect from lines
function detectSentences(lines) {
  const sentences = [];
  let current = '';

  for (const line of lines) {
    current += (current ? ' ' : '') + line.text;

    if (/[.!?]$/.test(line.text)) {
      sentences.push(current.trim());
      current = '';
    }
  }

  if (current.trim()) {
    sentences.push(current.trim());
  }

  return sentences;
}
```

## Header/Footer Detection

### By Position

```typescript
function isHeader(words, pageHeight) {
  const avgY = words.reduce((sum, w) => sum + w.y0, 0) / words.length;
  return avgY < pageHeight * 0.1;  // Top 10%
}

function isFooter(words, pageHeight) {
  const avgY = words.reduce((sum, w) => sum + w.y1, 0) / words.length;
  return avgY > pageHeight * 0.9;  // Bottom 10%
}
```

### By Content Pattern

```typescript
const HEADER_FOOTER_PATTERNS = [
  /^page\s+\d+(\s+of\s+\d+)?$/i,
  /confidential/i,
  /^[-_=]{10,}$/,
  /©\s*\d{4}/,
];

function matchesHeaderFooter(text) {
  return HEADER_FOOTER_PATTERNS.some(p => p.test(text.trim()));
}

function filterHeadersFooters(lines, pageHeight) {
  return lines.filter(line => {
    const words = line.words;
    const text = line.text;

    // Skip if in header/footer zone AND matches pattern
    if (isHeader(words, pageHeight) && matchesHeaderFooter(text)) {
      return false;
    }
    if (isFooter(words, pageHeight) && matchesHeaderFooter(text)) {
      return false;
    }

    return true;
  });
}
```

## Bounding Box Calculation

```typescript
function computeBBox(words) {
  if (!words.length) return { x0: 0, y0: 0, x1: 0, y1: 0 };

  return {
    x0: Math.min(...words.map(w => w.x0)),
    y0: Math.min(...words.map(w => w.y0)),
    x1: Math.max(...words.map(w => w.x1)),
    y1: Math.max(...words.map(w => w.y1)),
  };
}
```

## Structured Extraction

### Complete Example

```typescript
import pdflens, { clusterObjects } from 'pdflens';

async function extractStructured(pdfPath) {
  const pdf = await pdflens.open(pdfPath);
  const result = {
    pages: []
  };

  for (const page of pdf.pages) {
    const words = await page.extractWords();

    // Group into lines
    const lineGroups = clusterObjects(words, w => w.y0, 3);
    const lines = lineGroups.map(words => ({
      text: words.sort((a, b) => a.x0 - b.x0).map(w => w.text).join(' '),
      words,
      bbox: computeBBox(words)
    }));

    // Sort top to bottom
    lines.sort((a, b) => a.bbox.y0 - b.bbox.y0);

    // Filter headers/footers
    const content = filterHeadersFooters(lines, page.height);

    // Detect paragraphs
    const paragraphs = detectParagraphs(content);

    result.pages.push({
      pageNumber: page.pageNumber + 1,
      content: content.map(l => l.text).join('\n'),
      paragraphs: paragraphs.map(para => ({
        text: para.map(l => l.text).join(' '),
        bbox: computeBBox(para.flatMap(l => l.words)),
        sentences: detectSentences(para)
      }))
    });
  }

  await pdf.close();
  return result;
}
```

## JSON Output

```typescript
// Output structure
{
  "pages": [
    {
      "pageNumber": 1,
      "content": "Full page text...",
      "paragraphs": [
        {
          "text": "Paragraph text...",
          "bbox": { "x0": 50, "y0": 100, "x1": 500, "y1": 150 },
          "sentences": [
            "First sentence.",
            "Second sentence."
          ]
        }
      ]
    }
  ]
}
```

## Tips

1. **Adjust tolerances**: Line grouping tolerance depends on font size
2. **Test patterns**: Header/footer patterns vary by document type
3. **Preserve bboxes**: Keep bounding boxes for downstream processing
4. **Handle edge cases**: Empty pages, single-line pages, etc.
5. **Validate output**: Check paragraph/sentence boundaries make sense
