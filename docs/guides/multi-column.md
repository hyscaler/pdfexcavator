# Multi-Column Layout Guide

Handling PDFs with multi-column layouts.

## The Challenge

Multi-column PDFs can cause text extraction issues:

```
Column 1          Column 2
---------         ---------
First line        Fourth line
Second line       Fifth line
Third line        Sixth line
```

Standard extraction might produce:
```
First line Fourth line Second line Fifth line...
```

## Detection

### Automatic Column Detection

```typescript
const columns = await page.detectColumns();
// [{ x0: 50, x1: 280 }, { x0: 320, x1: 550 }]

console.log(`Found ${columns.length} columns`);
```

### Manual Detection

```typescript
import { clusterObjects } from 'pdfexcavator';

const words = await page.extractWords();

// Cluster by x-position to find columns
const xClusters = clusterObjects(words, w => w.x0, 50);

// Analyze gaps between clusters
const columnBounds = xClusters.map(cluster => ({
  x0: Math.min(...cluster.map(w => w.x0)),
  x1: Math.max(...cluster.map(w => w.x1))
}));
```

## Extraction Methods

### Column-Aware Extraction

```typescript
// Automatic column detection and extraction
const text = await page.extractTextByColumns();
```

### With Pre-defined Columns

```typescript
// Define column boundaries manually
const columns = [
  { x0: 50, x1: 280 },   // Left column
  { x0: 320, x1: 550 }   // Right column
];

const text = await page.extractTextByColumns(columns);
```

### Extract Each Column Separately

```typescript
const columns = await page.detectColumns();

for (const col of columns) {
  const cropped = page.crop([col.x0, 0, col.x1, page.height]);
  const text = await cropped.extractText();
  console.log('Column text:', text);
}
```

## Reading Order

### Column-First Order

Read each column top-to-bottom:

```typescript
async function extractColumnFirst(page) {
  const columns = await page.detectColumns();
  const texts = [];

  for (const col of columns) {
    const region = page.crop([col.x0, 0, col.x1, page.height]);
    const text = await region.extractText();
    texts.push(text);
  }

  return texts.join('\n\n');
}
```

### Row-First Order

Read across columns row by row:

```typescript
async function extractRowFirst(page) {
  const words = await page.extractWords();
  const columns = await page.detectColumns();

  // Group words into lines
  const lines = clusterObjects(words, w => w.y0, 5);

  // Sort lines top to bottom
  lines.sort((a, b) =>
    Math.min(...a.map(w => w.y0)) - Math.min(...b.map(w => w.y0))
  );

  // For each line, sort words by column then x-position
  const result = lines.map(lineWords => {
    lineWords.sort((a, b) => {
      // Find which column each word belongs to
      const colA = columns.findIndex(c => a.x0 >= c.x0 && a.x0 <= c.x1);
      const colB = columns.findIndex(c => b.x0 >= c.x0 && b.x0 <= c.x1);

      if (colA !== colB) return colA - colB;
      return a.x0 - b.x0;
    });

    return lineWords.map(w => w.text).join(' ');
  });

  return result.join('\n');
}
```

## Handling Complex Layouts

### Mixed Single/Multi-Column Pages

```typescript
async function extractMixedLayout(page) {
  const columns = await page.detectColumns();

  if (columns.length === 1) {
    // Single column - simple extraction
    return page.extractText();
  }

  // Multi-column - extract by columns
  return page.extractTextByColumns(columns);
}
```

### Headers and Footers Spanning Columns

```typescript
async function extractWithSpanningHeaders(page) {
  const words = await page.extractWords();
  const columns = await page.detectColumns();

  // Identify header region (spans full width)
  const headerThreshold = page.height * 0.1;
  const headerWords = words.filter(w => w.y0 < headerThreshold);
  const bodyWords = words.filter(w => w.y0 >= headerThreshold);

  // Extract header as single column
  const headerText = headerWords
    .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)
    .map(w => w.text)
    .join(' ');

  // Extract body by columns
  const bodyTexts = [];
  for (const col of columns) {
    const colWords = bodyWords.filter(
      w => w.x0 >= col.x0 && w.x1 <= col.x1
    );
    colWords.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
    bodyTexts.push(colWords.map(w => w.text).join(' '));
  }

  return {
    header: headerText,
    columns: bodyTexts
  };
}
```

## OCR'd Multi-Column Documents

For OCR'd multi-column PDFs:

```typescript
// extractTextRaw often works better for OCR'd multi-column docs
const text = await page.extractTextRaw({
  detectLineBreaks: true,
  lineBreakThreshold: 8
});

// The OCR software usually captured columns in reading order
```

## Newspaper-Style Layouts

Complex layouts with varying column widths:

```typescript
async function extractNewspaperLayout(page) {
  const words = await page.extractWords();

  // Group into vertical strips
  const strips = clusterObjects(words, w => w.x0, 30);

  // Analyze each strip
  const articles = [];

  for (const strip of strips) {
    // Find article boundaries within strip
    const sorted = strip.sort((a, b) => a.y0 - b.y0);

    let article = [];
    let lastY = 0;

    for (const word of sorted) {
      if (lastY && word.y0 - lastY > 30) {
        // Large gap = new article
        if (article.length) {
          articles.push(article.map(w => w.text).join(' '));
        }
        article = [];
      }
      article.push(word);
      lastY = word.y1;
    }

    if (article.length) {
      articles.push(article.map(w => w.text).join(' '));
    }
  }

  return articles;
}
```

## Tips

1. **Detect first**: Always detect columns before extraction
2. **Visual inspection**: Render page to image to understand layout
3. **Adjust tolerance**: Column detection tolerance depends on document
4. **Handle headers**: Headers often span columns
5. **Test thoroughly**: Multi-column extraction varies by document
