# Page Class

Represents a single PDF page with methods for extracting content.

## Properties

### pageNumber

Zero-based page index.

```typescript
console.log(page.pageNumber); // 0
```

### width

Page width in points.

```typescript
console.log(page.width); // 612
```

### height

Page height in points.

```typescript
console.log(page.height); // 792
```

### rotation

Page rotation in degrees (0, 90, 180, 270).

```typescript
console.log(page.rotation); // 0
```

### pdfPage

Access to underlying pdf.js PDFPageProxy for advanced use cases.

```typescript
import { extractCharsWithPrecision } from 'pdfexcavator';

// Use with low-level extraction functions
const chars = await extractCharsWithPrecision(
  page.pdfPage,
  page.pageNumber,
  page.height,
  0
);
```

### chars

Characters on the page (async getter).

```typescript
const chars = await page.chars;
for (const char of chars) {
  console.log(`"${char.text}" at (${char.x0}, ${char.y0})`);
}
```

## Text Extraction Methods

### extractText(options?)

Extract text from the page.

```typescript
const text = await page.extractText();

// With layout preservation
const layoutText = await page.extractText({ layout: true });
```

**TextExtractionOptions:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| layout | `boolean` | false | Preserve visual layout |
| xTolerance | `number` | 3 | Horizontal grouping tolerance |
| yTolerance | `number` | 3 | Vertical grouping tolerance |
| useTextFlow | `boolean` | true | Use PDF text flow order |

### extractTextSimple(xTolerance?, yTolerance?)

Fast text extraction (less accurate).

```typescript
const text = await page.extractTextSimple();
const text = await page.extractTextSimple(3, 3);
```

### extractTextRaw(options?)

Extract text preserving original PDF order. Best for OCR'd documents.

```typescript
const text = await page.extractTextRaw();

const text = await page.extractTextRaw({
  detectLineBreaks: true,
  lineBreakThreshold: 5,
  addSpaces: true,
  spaceThreshold: 10
});
```

### extractWords(options?)

Extract words with positions.

```typescript
const words = await page.extractWords();

for (const word of words) {
  console.log(`"${word.text}" at (${word.x0}, ${word.y0})`);
}
```

**WordExtractionOptions:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| xTolerance | `number` | 3 | Horizontal grouping |
| yTolerance | `number` | 3 | Vertical grouping |
| splitAtPunctuation | `boolean` | false | Split on punctuation |

### getTextLines()

Get text lines.

```typescript
const lines = await page.getTextLines();
for (const line of lines) {
  console.log(line.text);
}
```

## Table Extraction Methods

### extractTables(options?)

Extract all tables from the page.

```typescript
const tables = await page.extractTables();

for (const table of tables) {
  console.log(`Table: ${table.rows.length} rows`);
  console.log(`Confidence: ${table.confidence}`);
  for (const row of table.rows) {
    console.log(row.join(' | '));
  }
}
```

### extractTable(options?)

Extract the first/main table.

```typescript
const table = await page.extractTable();
```

**TableExtractionOptions:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| strategy | `'lines' \| 'text'` | 'lines' | Detection strategy |
| snapTolerance | `number` | 3 | Edge alignment tolerance |
| minWordsVertical | `number` | 3 | Min words for column |
| minWordsHorizontal | `number` | 1 | Min words for row |

## Graphics Extraction Methods

### getLines()

Get line graphics (strokes).

```typescript
const lines = await page.getLines();
for (const line of lines) {
  console.log(`Line: (${line.x0},${line.y0}) to (${line.x1},${line.y1})`);
}
```

### getRects()

Get rectangles.

```typescript
const rects = await page.getRects();
for (const rect of rects) {
  console.log(`Rect: ${rect.width}x${rect.height}`);
}
```

### getCurves()

Get curves (bezier paths).

```typescript
const curves = await page.getCurves();
```

### getImages()

Get image metadata.

```typescript
const images = await page.getImages();
for (const img of images) {
  console.log(`Image: ${img.width}x${img.height}`);
}
```

### getAnnotations()

Get PDF annotations.

```typescript
const annots = await page.getAnnotations();
for (const annot of annots) {
  console.log(`${annot.annotationType}: ${annot.contents}`);
}
```

### getHyperlinks()

Get hyperlinks.

```typescript
const links = await page.getHyperlinks();
for (const link of links) {
  console.log(`Link: ${link.uri}`);
}
```

## Region Selection

### crop(bbox)

Crop page to bounding box.

```typescript
const cropped = page.crop([100, 100, 400, 400]);
const text = await cropped.extractText();
```

### withinBBox(bbox)

Get objects within bounding box.

```typescript
const region = page.withinBBox([50, 50, 300, 300]);
```

### outsideBBox(bbox)

Get objects outside bounding box.

```typescript
const outside = page.outsideBBox([100, 100, 200, 200]);
```

### filter(fn)

Filter page objects.

```typescript
const largeText = page.filter(obj => obj.size > 12);
const boldText = page.filter(obj => obj.fontName?.includes('Bold'));
```

## OCR Methods

### needsOCR()

Check if page needs OCR.

```typescript
const needsOcr = await page.needsOCR();
```

### isScannedPage()

Check if page is scanned.

```typescript
const isScanned = await page.isScannedPage();
```

### performOCR(options?)

Perform OCR on the page.

```typescript
const result = await page.performOCR({ lang: 'eng' });
console.log(result.text);
console.log(result.confidence);
```

### extractTextWithOCR()

Extract text with OCR fallback.

```typescript
const text = await page.extractTextWithOCR();
```

## Rendering Methods

### toImage(options?)

Render page to image (requires `canvas`).

```typescript
const image = await page.toImage({ scale: 2 });
const buffer = image.toBuffer();
fs.writeFileSync('page.png', buffer);
```

**RenderOptions:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| scale | `number` | 1 | Scale factor |
| resolution | `number` | 72 | DPI |

## Layout Analysis Methods

### analyzeLayout(params?)

Analyze text layout with LAParams.

```typescript
const result = await page.analyzeLayout({
  lineOverlap: 0.5,
  charMargin: 2.0,
  wordMargin: 0.1
});

console.log(result.words);
console.log(result.lines);
console.log(result.text);
```

### detectColumns(minGapRatio?)

Detect text columns.

```typescript
const columns = await page.detectColumns();
// [{ x0: 50, x1: 280 }, { x0: 320, x1: 550 }]
```

### extractTextByColumns(columns?, options?)

Extract text respecting column layout.

```typescript
const text = await page.extractTextByColumns();
```
