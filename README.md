# PDFLens

A powerful PDF extraction library for Node.js built on Mozilla's pdf.js.

Extract text, tables, graphics, and visual elements from PDF files with precision. Features advanced layout analysis, CJK text support, font substitution, and optional OCR for scanned documents.

## Features

### Core Extraction
- **Text Extraction** - Extract text with full character-level detail including positions, fonts, colors
- **Table Extraction** - Detect and extract tables with confidence scoring, borderless table support, and nested table detection
- **Graphics Extraction** - Extract lines, rectangles, curves, and images from PDF pages
- **Annotation Extraction** - Extract PDF annotations and hyperlinks

### Advanced Features
- **Layout Analysis** - LAParams support for precise text grouping into words, lines, and blocks
- **Precision Mode** - Full PDF operator state tracking for exact character positioning
- **Object Clustering** - Group objects by position with tolerance-based clustering
- **Region Filtering** - Crop pages and filter objects by bounding box or custom functions

### Language & Font Support
- **CJK Support** - Full CMap support for Chinese, Japanese, and Korean text
- **Font Substitution** - Automatic font mapping for the 14 PDF base fonts
- **Font Metrics** - Access character widths, baselines, and spacing information

### Integration
- **OCR Integration** - Optional Tesseract.js integration for scanned documents
- **Visual Debugging** - Render pages to images with drawing annotations
- **CLI Tool** - Command-line interface for quick PDF extraction
- **PDF Repair** - Attempt recovery of malformed PDF files

## Installation

```bash
npm install pdflens
```

### Optional Dependencies

For rendering pages to images:
```bash
npm install canvas
```

For OCR support (scanned documents):
```bash
npm install tesseract.js
```

## Quick Start

```typescript
import pdflens from 'pdflens';

// Open a PDF
const pdf = await pdflens.open('document.pdf');

// Get metadata
const metadata = await pdf.metadata;
console.log(`Title: ${metadata.title}`);
console.log(`Pages: ${metadata.pageCount}`);

// Extract text from each page
for (const page of pdf.pages) {
  const text = await page.extractText();
  console.log(text);
}

// Extract tables
for (const page of pdf.pages) {
  const tables = await page.extractTables();
  for (const table of tables) {
    console.log(table.rows);
  }
}

// Close when done
await pdf.close();
```

## API Reference

### Opening PDFs

```typescript
import pdflens, { PDFLens } from 'pdflens';

// From file path
const pdf = await pdflens.open('document.pdf');

// With password
const pdf = await pdflens.open('encrypted.pdf', { password: 'secret' });

// With repair options for malformed PDFs
const pdf = await pdflens.open('damaged.pdf', { repair: true });

// From Buffer
const buffer = fs.readFileSync('document.pdf');
const pdf = await PDFLens.fromBuffer(buffer);

// From Uint8Array
const pdf = await PDFLens.fromUint8Array(data);
```

### Working with Pages

```typescript
// Iterate all pages
for (const page of pdf.pages) {
  console.log(`Page ${page.pageNumber}: ${page.width}x${page.height}`);
}

// Get specific page (0-indexed)
const page = pdf.getPage(0);

// Page properties
console.log(page.width, page.height);
console.log(page.rotation);
console.log(page.pageNumber);
```

### Text Extraction

```typescript
// Basic text extraction
const text = await page.extractText();

// With layout preservation
const layoutText = await page.extractText({ layout: true });

// Get individual characters with full details
const chars = await page.chars;
for (const char of chars) {
  console.log(`"${char.text}" at (${char.x0}, ${char.y0})`);
  console.log(`  Font: ${char.fontName}, Size: ${char.size}`);
  console.log(`  Color:`, char.nonStrokingColor);
}

// Get words
const words = await page.extractWords();

// Get text lines
const lines = await page.getLines();

// For OCR'd documents or multi-column layouts, use extractTextRaw()
// This preserves the original PDF text order instead of re-ordering by position
const rawText = await page.extractTextRaw();

// Extract text from entire PDF
const allText = await pdf.extractText();

// Standalone text extraction functions
import {
  extractChars,
  extractText,
  extractTextSimple,
  extractLines,
  extractWords
} from 'pdflens';

// Use with pdf.js page proxy directly
const chars = await extractChars(pdfPageProxy);
const text = extractText(chars);
const simpleText = extractTextSimple(chars);
const lines = extractLines(chars);
const words = extractWords(chars);
```

### Graphics Extraction

Extract vector graphics and images from PDF pages:

```typescript
// Get line graphics (strokes)
const lines = await page.getLines();
for (const line of lines) {
  console.log(`Line from (${line.x0}, ${line.y0}) to (${line.x1}, ${line.y1})`);
  console.log(`  Width: ${line.lineWidth}, Color:`, line.strokingColor);
}

// Get rectangles
const rects = await page.getRects();
for (const rect of rects) {
  console.log(`Rect at (${rect.x0}, ${rect.y0}) - (${rect.x1}, ${rect.y1})`);
  console.log(`  Fill:`, rect.fill, `Stroke:`, rect.stroke);
}

// Get curves (bezier paths)
const curves = await page.getCurves();
for (const curve of curves) {
  console.log(`Curve with ${curve.points?.length} points`);
}

// Get images
const images = await page.getImages();
for (const img of images) {
  console.log(`Image: ${img.width}x${img.height} at (${img.x0}, ${img.y0})`);
}

// Get annotations
const annots = await page.getAnnotations();
for (const annot of annots) {
  console.log(`Annotation: ${annot.subtype} - ${annot.contents}`);
}

// Get hyperlinks
const links = await page.getHyperlinks();
for (const link of links) {
  console.log(`Link: ${link.url} at (${link.x0}, ${link.y0})`);
}
```

### Precision Character Extraction

For maximum accuracy, PDFLens offers enhanced character extraction with full operator tracking:

```typescript
import {
  extractCharsWithColors,
  extractCharsWithSpacing,
  extractCharsWithPrecision,
  PDFStateTracker,
  createStateTracker,
  getTextStateAt,
} from 'pdflens';

// Extract characters with color information
const charsWithColors = await extractCharsWithColors(
  pdfPageProxy,
  pageNumber,
  pageHeight,
  doctopOffset
);

// Extract characters with spacing adjustments
// Uses charSpacing, wordSpacing, horizontalScale, textRise operators
const charsWithSpacing = await extractCharsWithSpacing(
  pdfPageProxy,
  pageNumber,
  pageHeight,
  doctopOffset
);

// Maximum precision extraction with full state machine
// Tracks all PDF operators for exact character positioning
const preciseChars = await extractCharsWithPrecision(
  pdfPageProxy,
  pageNumber,
  pageHeight,
  doctopOffset
);

// Use PDFStateTracker directly for advanced analysis
const tracker = new PDFStateTracker(pageHeight);
const opList = await pdfPageProxy.getOperatorList();
tracker.processOperatorList(opList);

// Get state at any position
const state = tracker.getStateAt(x, y);
if (state) {
  console.log('Text state:', state.textState);
  console.log('Graphics state:', state.graphicsState);
  console.log('Combined matrix:', state.combinedMatrix);
}

// Calculate precise position with all adjustments
const position = tracker.calculatePrecisePosition(x, y, fontSize, charWidth);
console.log('Position:', position.x, position.y);
console.log('Text rise:', position.textRise);
console.log('Rotation:', position.rotationAngle);

// Convenience function to create tracker
const tracker = await createStateTracker(pdfPageProxy, pageHeight);

// Get text state at specific position
const textState = await getTextStateAt(pdfPageProxy, x, y, pageHeight);
if (textState) {
  console.log('Char spacing:', textState.charSpacing);
  console.log('Word spacing:', textState.wordSpacing);
  console.log('Horizontal scale:', textState.horizontalScale);
  console.log('Text rise:', textState.textRise);
}
```

### Layout Analysis (LAParams)

PDFLens supports LAParams for precise control over text grouping:

```typescript
import { LayoutAnalyzer, analyzeLayout, DEFAULT_LAPARAMS } from 'pdflens';

// Use default parameters
console.log(DEFAULT_LAPARAMS);
// {
//   lineOverlap: 0.5,
//   charMargin: 2.0,
//   wordMargin: 0.1,
//   lineMargin: 0.5,
//   boxesFlow: 0.5,
//   detectVertical: true,
//   allTexts: false
// }

// Analyze layout with custom parameters
const chars = await page.chars;
const result = analyzeLayout(chars, {
  lineOverlap: 0.5,
  charMargin: 2.0,
  wordMargin: 0.1,
});
console.log(result.words);  // Grouped words
console.log(result.lines);  // Grouped lines
console.log(result.text);   // Reconstructed text

// Use LayoutAnalyzer class for more control
const analyzer = new LayoutAnalyzer({ detectVertical: true });
const words = analyzer.analyzeCharsToWords(chars);
const lines = analyzer.analyzeCharsToLines(chars);

// Page-level layout methods
const layoutResult = await page.analyzeLayout();
const wordsWithLayout = await page.getWordsWithLayout();
const linesWithLayout = await page.getLinesWithLayout();

// Detect text columns
import { detectTextColumns, detectReadingDirection, isVerticalText } from 'pdflens';

const columns = detectTextColumns(chars);
const direction = detectReadingDirection(chars); // 'ltr', 'rtl', or 'ttb'
const vertical = isVerticalText(chars);
```

### Table Extraction

```typescript
// Extract all tables
const tables = await page.extractTables();

for (const table of tables) {
  console.log(`Table at (${table.bbox.join(', ')})`);
  console.log(`Confidence: ${table.confidence}`);
  console.log(`Detection method: ${table.detectionMethod}`);
  for (const row of table.rows) {
    console.log(row.join(' | '));
  }
}

// Extract first table only
const table = await page.extractTable();

// With options
const tables = await page.extractTables({
  strategy: 'lines',        // 'lines' or 'text'
  snapTolerance: 3,
  minWordsVertical: 3,
  minWordsHorizontal: 1,
});

// Using TableFinder directly
import { TableFinder, findTables } from 'pdflens';

const finder = new TableFinder(chars, lines, rects);
const tables = finder.findTables();
```

### Enhanced Table Detection

PDFLens provides advanced table detection with confidence scoring, borderless table support, and nested table detection:

```typescript
import {
  extractTables,
  extractTablesEnhanced,
  detectBorderlessTables,
  findNestedTables,
  debugTableFinder,
} from 'pdflens';

// Enhanced extraction with all detection methods
const tables = extractTablesEnhanced(
  chars,
  lines,
  rects,
  pageNumber,
  options,
  detectNested  // Enable nested table detection
);

// Each table includes confidence and detection method
for (const table of tables) {
  console.log(`Confidence: ${table.confidence}`);  // 0-1, higher is better
  console.log(`Method: ${table.detectionMethod}`); // 'lines', 'text', 'explicit', 'hybrid'

  // Check for nested tables (tables within cells)
  if (table.nestedTables && table.nestedTables.length > 0) {
    for (const nested of table.nestedTables) {
      console.log(`Nested at row ${nested.parentCell?.row}, col ${nested.parentCell?.col}`);
    }
  }
}

// Detect borderless tables using projection profile analysis
// Great for tables without visible grid lines
const borderlessTables = detectBorderlessTables(chars, pageNumber, {
  minRows: 2,
  minCols: 2,
  gapThreshold: 10,
});

// Find nested tables within an existing table
const tableWithNested = findNestedTables(
  parentTable,
  chars,
  lines,
  rects,
  maxDepth,  // Maximum nesting level
  options
);

// Debug table detection
const debugInfo = debugTableFinder(chars, lines, rects);
console.log('Edges found:', debugInfo.edges.length);
console.log('Intersections:', debugInfo.intersections.length);
```

#### Confidence Scoring

Tables include a confidence score (0-1) based on:
- **Edge completeness**: How many expected edges are present
- **Content coverage**: How much of the table area contains text
- **Grid regularity**: How consistent row/column sizes are

```typescript
// Filter tables by confidence
const confidentTables = tables.filter(t => (t.confidence ?? 0) >= 0.7);

// Sort by confidence
tables.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
```

#### Detection Methods

- **lines**: Uses visible line graphics to detect table boundaries
- **text**: Analyzes text alignment to infer table structure
- **explicit**: Uses explicitly provided line positions
- **hybrid**: Combines multiple methods for best results

### Font Substitution

PDFLens automatically handles font substitution for the 14 PDF base fonts:

```typescript
import {
  findFontSubstitution,
  classifyFont,
  parseFontStyle,
  PDF_BASE_FONTS,
  STANDARD_FONT_METRICS,
  FontSubstitutionManager
} from 'pdflens';

// Find substitution for a font
const sub = findFontSubstitution('Arial');
console.log(sub.substituteFont);  // 'Helvetica'
console.log(sub.confidence);      // 0.95

// Classify font type
classifyFont('Times');      // 'serif'
classifyFont('Arial');      // 'sans-serif'
classifyFont('Courier');    // 'monospace'

// Parse font style
const style = parseFontStyle('Arial-BoldItalic');
console.log(style.bold);    // true
console.log(style.italic);  // true
console.log(style.weight);  // 700

// Access base font metrics
console.log(PDF_BASE_FONTS); // ['Helvetica', 'Times-Roman', 'Courier', ...]
console.log(STANDARD_FONT_METRICS['Helvetica']);
// { ascent: 718, descent: -207, avgWidth: 513, ... }

// Use FontSubstitutionManager for tracking
const manager = new FontSubstitutionManager();
manager.getSubstitution('Arial');
manager.getSubstitution('TimesNewRoman');
console.log(manager.getAllSubstitutions());

// Access font substitution map directly
import { FONT_SUBSTITUTION_MAP, getSubstituteFontMetrics } from 'pdflens';
console.log(FONT_SUBSTITUTION_MAP['Arial']); // 'Helvetica'
const metrics = getSubstituteFontMetrics('Helvetica');
```

### Font Utilities

Additional utilities for working with fonts in PDFs:

```typescript
import {
  extractFontMetrics,
  getCharWidth,
  getBaseline,
  getTypicalSpacing,
  getFontSubstitutions,
  getMissingFonts,
  resetFontSubstitutions,
} from 'pdflens';

// Extract font metrics from characters
const fontMetrics = extractFontMetrics(chars);

// Get character width for a specific font
const width = getCharWidth('A', 'Helvetica', 12);

// Get baseline position
const baseline = getBaseline('Helvetica', 12);

// Get typical character spacing
const spacing = getTypicalSpacing('Helvetica', 12);

// Track font substitutions made during extraction
const substitutions = getFontSubstitutions();

// Get list of fonts that couldn't be substituted
const missing = getMissingFonts();

// Reset substitution tracking
resetFontSubstitutions();
```

### CJK Text Support

Full support for Chinese, Japanese, and Korean text:

```typescript
import { isCJKFont, normalizeCJKText, getDefaultCMapConfig } from 'pdflens';

// Detect CJK fonts
isCJKFont('SimSun');     // true (Chinese)
isCJKFont('Meiryo');     // true (Japanese)
isCJKFont('Gulim');      // true (Korean)
isCJKFont('Arial');      // false

// Normalize fullwidth characters
normalizeCJKText('ABC');  // 'ABC'
normalizeCJKText('123');  // '123'

// Get CMap configuration (for pdf.js)
const cmapConfig = await getDefaultCMapConfig();
// { cMapUrl: '...', cMapPacked: true }
```

### Extracting Text from OCR'd PDFs

PDFs created by OCR software (like Adobe Paper Capture) often have character positions that don't follow a simple left-to-right, top-to-bottom order. For these documents, use `extractTextRaw()`:

```typescript
// Check if a page was OCR'd or is a scan
const needsOcr = await page.needsOCR();
const isScanned = await page.isScannedPage();

if (needsOcr) {
  // Page is a scanned image - needs OCR processing
  const text = await page.extractTextWithOCR();
} else {
  // Page has text - check if it's OCR'd
  const standardText = await page.extractText();
  const rawText = await page.extractTextRaw();

  // For OCR'd multi-column documents, rawText usually gives better results
  // because it preserves the PDF's natural text flow order
}

// extractTextRaw() options
const text = await page.extractTextRaw({
  detectLineBreaks: true,      // Add line breaks on y-position changes
  lineBreakThreshold: 5,       // Y-change threshold for line breaks (points)
  addSpaces: true,             // Add spaces between text items
  spaceThreshold: 10,          // X-gap threshold for adding spaces
});
```

Use `extractTextRaw()` when:
- The PDF was created by OCR software (Adobe Acrobat Paper Capture, etc.)
- Standard extraction produces scrambled text
- The document has multi-column layouts that get mixed together

Use standard `extractText()` when:
- The PDF was created digitally (Word, LaTeX, etc.)
- You need precise character positions
- You're doing layout analysis

### OCR Integration

For scanned documents, PDFLens can use Tesseract.js for OCR:

```typescript
import {
  isTesseractAvailable,
  OCREngine,
  OCR_LANGUAGES,
  PSM_MODES,
  OEM_MODES
} from 'pdflens';

// Check if Tesseract is available
const available = await isTesseractAvailable();

// Check if a page needs OCR
const needsOcr = await page.needsOCR();
const isScanned = await page.isScannedPage();

// Perform OCR on a page
if (needsOcr) {
  const result = await page.performOCR({
    lang: 'eng',           // Language code
    psm: PSM_MODES.AUTO,   // Page segmentation mode
    oem: OEM_MODES.DEFAULT // OCR engine mode
  });
  console.log(result.text);
  console.log(result.confidence);
}

// Extract text with OCR fallback
const text = await page.extractTextWithOCR();

// Available languages
console.log(OCR_LANGUAGES);
// { eng: 'English', jpn: 'Japanese', chi_sim: 'Chinese (Simplified)', ... }

// Use OCREngine directly
const engine = new OCREngine({ lang: 'eng+jpn' });
const isAvailable = await engine.isAvailable();

// Standalone OCR functions
import {
  performOCR,
  needsOCR,
  isLikelyScanned,
  terminateOCR
} from 'pdflens';

// Check if image buffer likely needs OCR
const likely = isLikelyScanned(imageBuffer);

// Perform OCR on image buffer directly
const result = await performOCR(imageBuffer, { lang: 'eng' });

// Clean up Tesseract workers when done
await terminateOCR();
```

### Region Selection (Cropping)

```typescript
// Crop to bounding box [x0, y0, x1, y1]
const cropped = page.crop([100, 100, 400, 400]);
const croppedText = await cropped.extractText();

// Get objects within bbox
const region = page.withinBBox([50, 50, 300, 300]);

// Get objects outside bbox
const outside = page.outsideBBox([100, 100, 200, 200]);

// Filter page objects with custom function
const filtered = page.filter(obj => obj.size > 12);  // Only large text
const filteredText = await filtered.extractText();

// Filter by color
const redText = page.filter(obj => {
  const color = obj.nonStrokingColor;
  return Array.isArray(color) && color[0] > 0.5;
});

// Combine filtering with cropping
const region = page.crop([0, 0, 300, 300]).filter(obj => obj.fontName?.includes('Bold'));
```

### Visual Debugging

Requires the `canvas` package:

```typescript
import { PageImage, createPageImage } from 'pdflens';

// Render page to PNG
const pageImage = await page.toImage({ scale: 2 });
const buffer = pageImage.toBuffer();
fs.writeFileSync('page.png', buffer);

// Render with custom resolution
const highRes = await page.toImage({ resolution: 300 });

// Draw rectangles for debugging using PageImage
const chars = await page.chars;
const pageImg = await page.toImage({ scale: 2 });
pageImg.drawRects(chars, {
  stroke: 'red',
  fill: 'rgba(255, 0, 0, 0.1)',
  strokeWidth: 1,
});
fs.writeFileSync('debug.png', pageImg.toBuffer());

// Highlight specific regions
const tables = await page.extractTables();
for (const table of tables) {
  pageImg.drawRects([{
    x0: table.bbox[0],
    y0: table.bbox[1],
    x1: table.bbox[2],
    y1: table.bbox[3]
  }], { stroke: 'blue', strokeWidth: 2 });
}

// Debug table detection
import { debugTableFinder } from 'pdflens';
const debugInfo = debugTableFinder(chars, lines, rects);

// Additional PageImage drawing methods
const img = await page.toImage({ scale: 2 });

// Draw a single rectangle
img.drawRect({ x0: 10, y0: 10, x1: 100, y1: 50 }, { stroke: 'red' });

// Draw lines
img.drawLine({ x0: 0, y0: 100, x1: 200, y1: 100 }, { stroke: 'blue' });

// Draw vertical/horizontal lines across full page
img.drawVLine(50, { stroke: 'green', dash: [5, 5] });  // Vertical at x=50
img.drawHLine(100, { stroke: 'green' });               // Horizontal at y=100

// Draw multiple lines at once
img.drawVLines([50, 100, 150], { stroke: 'gray' });
img.drawHLines([50, 100, 150], { stroke: 'gray' });

// Draw circles/points
img.drawCircle({ x: 100, y: 100 }, { fill: 'blue', radius: 10 });
img.drawPoints([{ x: 50, y: 50 }, { x: 75, y: 75 }], { fill: 'red' });

// Draw text annotations
img.drawText('Label', 10, 10, { font: '14px sans-serif', fill: 'black' });

// Debug table finder visualization
const tableResult = await page.debugTableFinder();
img.debugTableFinder(tableResult, {
  edgeColor: 'red',
  intersectionColor: 'blue',
  tableColor: 'lightgreen',
});

// Save or display
await img.save('output.png');
await img.show();  // Opens in default viewer

// Reset to original (remove all drawings)
img.reset();

// Create a copy for separate annotations
const imgCopy = img.copy();
```

### Utility Functions

```typescript
// Bounding box utilities
import {
  normalizeBBox,
  isValidBBox,
  pointInBBox,
  bboxOverlaps,
  bboxWithin,
  bboxOutside,
  bboxIntersection,
  bboxUnion,
  getBBox,
  bboxArea,
  bboxCenter,
  bboxExpand,
  filterWithinBBox,
  filterOverlapsBBox,
  filterOutsideBBox,
} from 'pdflens';

// Validate and normalize bounding boxes
const normalized = normalizeBBox([100, 100, 0, 0]); // [0, 0, 100, 100]
const valid = isValidBBox(bbox);  // true if x0 < x1 and y0 < y1

const bbox = [0, 0, 100, 100];
pointInBBox(50, 50, bbox);              // true
bboxOverlaps(bbox, [50, 50, 150, 150]); // true
bboxWithin(bbox, [0, 0, 200, 200]);     // true
bboxOutside(bbox, [200, 200, 300, 300]); // true
bboxArea(bbox);                          // 10000
bboxCenter(bbox);                        // [50, 50]
bboxExpand(bbox, 10);                    // [-10, -10, 110, 110]

// Get bounding box from objects with coordinates
const charsBBox = getBBox(chars);

// Filter objects by bounding box
const charsInRegion = filterWithinBBox(chars, [0, 0, 200, 200]);
const charsOverlapping = filterOverlapsBBox(chars, bbox);
const charsOutside = filterOutsideBBox(chars, bbox);

// Geometry utilities
import {
  isHorizontalLine,
  isVerticalLine,
  lineLength,
  linesIntersect,
  getHorizontalLines,
  getVerticalLines,
  groupHorizontalLines,
  groupVerticalLines,
  rectsToLines,
  getUniqueXPositions,
  getUniqueYPositions,
  clusterObjects,
  clusterObjectsByMean,
} from 'pdflens';

// Check line orientation
isHorizontalLine(line);  // true if horizontal
isVerticalLine(line);    // true if vertical
lineLength(line);        // length of line

// Extract lines from page objects
const hLines = getHorizontalLines(lines);
const vLines = getVerticalLines(lines);

// Group nearby lines
const groupedH = groupHorizontalLines(hLines, tolerance);
const groupedV = groupVerticalLines(vLines, tolerance);

// Convert rectangles to lines
const linesFromRects = rectsToLines(rects);

// Get unique positions (useful for table detection)
const xPositions = getUniqueXPositions(lines);
const yPositions = getUniqueYPositions(lines);

// Cluster objects by a numeric attribute with tolerance
const linesByY = clusterObjects(chars, c => c.y0, 3);  // Group chars into lines
const columns = clusterObjects(chars, c => c.x0, 10);  // Group into columns

// Cluster using mean-based linkage (more sophisticated)
const groups = clusterObjectsByMean(items, i => i.value, 5);
```

### Post-Processing Extracted Text

PDFLens extracts raw text with full fidelity. For structured documents, you may want to apply post-processing to clean up and organize the extracted content.

#### Grouping Words into Lines

Use `clusterObjects` to group words by their vertical position:

```typescript
import { clusterObjects } from 'pdflens';

const words = await page.extractWords();

// Group words into lines by y-position (3px tolerance)
const lines = clusterObjects(words, (w) => w.y0, 3);

for (const lineWords of lines) {
  // Sort words left-to-right within each line
  lineWords.sort((a, b) => a.x0 - b.x0);
  const lineText = lineWords.map(w => w.text).join(' ');
  console.log(lineText);
}
```

#### Header/Footer Removal

Filter out headers and footers based on position and content patterns:

```typescript
const HEADER_FOOTER_PATTERNS = [
  /^page\s+\d+\s*(of\s*\d+)?$/i,           // "Page 1 of 10"
  /confidential\s*[&]\s*proprietary/i,     // Common footer text
  /^[-–—_=\s]{10,}$/,                       // Separator lines
  /^\s*©\s*\d{4}/i,                         // Copyright lines
];

function isHeaderOrFooter(words: PDFWord[], pageHeight: number): boolean {
  const avgY = words.reduce((sum, w) => sum + w.y0, 0) / words.length;
  const text = words.map(w => w.text).join(' ');

  // Check if in header zone (top 5%) or footer zone (bottom 5%)
  const inHeaderZone = avgY < pageHeight * 0.05;
  const inFooterZone = avgY > pageHeight * 0.95;

  // Only filter if position AND content match
  if (inHeaderZone || inFooterZone) {
    return HEADER_FOOTER_PATTERNS.some(p => p.test(text));
  }
  return false;
}

// Filter out headers/footers
const contentLines = lines.filter(
  lineWords => !isHeaderOrFooter(lineWords, page.height)
);
```

#### Paragraph Detection

Group lines into paragraphs based on vertical spacing:

```typescript
interface Line {
  text: string;
  words: PDFWord[];
  top: number;
  bottom: number;
}

function groupIntoParagraphs(lines: Line[], gapThreshold = 15): Line[][] {
  if (!lines.length) return [];

  const paragraphs: Line[][] = [];
  let currentPara: Line[] = [lines[0]];

  for (let i = 1; i < lines.length; i++) {
    const prevLine = lines[i - 1];
    const currLine = lines[i];
    const gap = currLine.top - prevLine.bottom;

    if (gap > gapThreshold) {
      // Large gap = new paragraph
      paragraphs.push(currentPara);
      currentPara = [currLine];
    } else {
      currentPara.push(currLine);
    }
  }

  if (currentPara.length) {
    paragraphs.push(currentPara);
  }

  return paragraphs;
}
```

#### Sentence Detection

Split paragraphs into sentences:

```typescript
function splitIntoSentences(paragraphText: string): string[] {
  // Split on sentence-ending punctuation followed by space or end
  return paragraphText
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// Or detect sentence boundaries from lines
function detectSentenceBoundaries(lines: Line[]): string[] {
  const sentences: string[] = [];
  let currentSentence = '';

  for (const line of lines) {
    currentSentence += (currentSentence ? ' ' : '') + line.text;

    // Check if line ends with sentence-ending punctuation
    if (/[.!?]$/.test(line.text)) {
      sentences.push(currentSentence.trim());
      currentSentence = '';
    }
  }

  // Don't forget remaining text
  if (currentSentence.trim()) {
    sentences.push(currentSentence.trim());
  }

  return sentences;
}
```

#### Text Cleaning

Clean extracted text by removing noise and normalizing whitespace:

```typescript
function cleanText(text: string): string {
  if (!text) return '';

  // Remove horizontal separator lines
  text = text.replace(/[-–—_=]{6,}/g, '');

  // Remove lines with only symbols
  text = text.replace(/^[\s\-–—_=·•]+$/gm, '');

  // Remove common footer patterns
  text = text.replace(
    /Confidential\s*&\s*Proprietary.*Page\s+\d+\s+of\s+\d+/gi,
    ''
  );

  // Collapse multiple blank lines
  text = text.replace(/\n{3,}/g, '\n\n');

  // Normalize whitespace
  text = text.replace(/[ \t]+/g, ' ');

  return text.trim();
}
```

#### Computing Bounding Boxes

Calculate bounding boxes for grouped text:

```typescript
interface BBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function computeBBox(words: PDFWord[]): BBox {
  if (!words.length) {
    return { x0: 0, y0: 0, x1: 0, y1: 0 };
  }

  return {
    x0: Math.min(...words.map(w => w.x0)),
    y0: Math.min(...words.map(w => w.y0)),
    x1: Math.max(...words.map(w => w.x1)),
    y1: Math.max(...words.map(w => w.y1)),
  };
}

// Get bbox for a paragraph (multiple lines)
function computeParagraphBBox(lines: Line[]): BBox {
  const allWords = lines.flatMap(l => l.words);
  return computeBBox(allWords);
}
```

#### Character Correction

Fix common character encoding issues in extracted text:

```typescript
import { correctText, autoCorrectText, detectEncodingIssues } from 'pdflens';

// Auto-detect and fix encoding issues
const fixedText = autoCorrectText(extractedText);

// Or with specific options
const fixedText = correctText(extractedText, {
  numbersToLetters: true,    // Fix 0→o, 1→l, 3→e, etc.
  ligatures: true,           // Expand ﬁ→fi, ﬂ→fl
  quotes: true,              // Normalize quotes
  dashes: true,              // Normalize dashes
  whitespace: true,          // Fix whitespace issues
});

// Check if text has encoding issues
const issues = detectEncodingIssues(text);
if (issues.hasIssues) {
  console.log('Detected issues:', issues.types);
}
```

#### Complete Example: Structured Extraction

See `examples/structured-extract.ts` for a complete example that combines all these techniques to extract structured data with:
- Page content with bounding boxes
- Paragraphs with bounding boxes
- Sentences with bounding boxes
- Automatic header/footer removal
- Text cleaning

```bash
npx tsx examples/structured-extract.ts document.pdf > output.json
```

### Search

```typescript
// Search on a page
const matches = await page.search('keyword');
const regexMatches = await page.search(/pattern/gi);

// Search across all pages
const results = await pdf.search('term');
for (const result of results) {
  console.log(`Found on page ${result.pageNumber}:`, result.matches);
}
```

### Large PDF Processing

For large PDFs, use `processPages()` to control memory usage and CPU utilization:

```typescript
import type { ProcessingOptions, ProcessingResult } from 'pdflens';

// Process pages with controlled concurrency
const result = await pdf.processPages(
  async (page) => {
    const text = await page.extractText();
    return { pageNumber: page.pageNumber, charCount: text.length };
  },
  {
    concurrency: 2,           // Process 2 pages at a time (default: 4)
    flushAfterProcess: true,  // Free memory after each page
    onProgress: (done, total, pageNum) => {
      console.log(`Progress: ${done}/${total}`);
    },
  }
);

console.log(`Processed: ${result.pagesProcessed}`);
console.log(`Failed: ${result.pagesFailed}`);
console.log(`Duration: ${result.duration}ms`);

// Process sequentially (minimum memory usage)
const result = await pdf.processPagesSequential(
  async (page) => await page.extractTables()
);

// Handle errors gracefully
const result = await pdf.processPages(
  async (page) => await page.extractText(),
  {
    stopOnError: false,  // Continue even if some pages fail
  }
);

if (result.errors.length > 0) {
  for (const err of result.errors) {
    console.log(`Page ${err.pageNumber} failed: ${err.message}`);
  }
}

// Abort processing with AbortController
const controller = new AbortController();

// Abort after 30 seconds
setTimeout(() => controller.abort(), 30000);

const result = await pdf.processPages(
  async (page) => await page.extractText(),
  { signal: controller.signal }
);

if (result.aborted) {
  console.log(`Aborted after ${result.pagesProcessed} pages`);
}
```

#### Processing Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `concurrency` | number | 4 | Max pages to process in parallel |
| `flushAfterProcess` | boolean | auto | Free page cache after processing (auto-enabled for >20 pages) |
| `onProgress` | function | - | Called after each page completes |
| `signal` | AbortSignal | - | For cancelling long operations |
| `stopOnError` | boolean | false | Stop on first error vs continue and collect errors |

#### Processing Result

```typescript
interface ProcessingResult<T> {
  results: (T | undefined)[];  // undefined for failed pages
  pagesProcessed: number;      // Successfully processed
  pagesFailed: number;         // Failed count
  duration: number;            // Total time in ms
  aborted: boolean;            // Was processing aborted
  errors: ProcessingError[];   // Detailed error info
}
```

### Metadata

```typescript
const metadata = await pdf.metadata;

console.log(metadata.title);
console.log(metadata.author);
console.log(metadata.subject);
console.log(metadata.creator);
console.log(metadata.producer);
console.log(metadata.creationDate);
console.log(metadata.modificationDate);
console.log(metadata.pageCount);
console.log(metadata.pdfVersion);
console.log(metadata.isEncrypted);
```

### PDF Analysis & Repair

```typescript
import { PDFLens } from 'pdflens';

// Check if data looks like a PDF
const isPdf = PDFLens.isPDFLike(buffer);

// Analyze PDF structure
const analysis = PDFLens.analyzePDF(buffer);
console.log(analysis.version);      // '1.7'
console.log(analysis.encrypted);    // false
console.log(analysis.objectCount);  // 150
console.log(analysis.issues);       // ['Missing %%EOF marker']

// Extract raw text from severely damaged PDF
const rawTexts = PDFLens.extractRawText(buffer);
```

## CLI Tool

PDFLens includes a command-line interface for quick PDF extraction:

```bash
# Install globally
npm install -g pdflens

# Extract all objects from a PDF (default mode)
pdflens document.pdf

# Extract specific data types
pdflens text document.pdf              # Extract text
pdflens tables document.pdf            # Extract tables
pdflens chars document.pdf             # Extract character data
pdflens lines document.pdf             # Extract line graphics
pdflens rects document.pdf             # Extract rectangles
pdflens curves document.pdf            # Extract curves
pdflens images document.pdf            # Extract image metadata
pdflens annots document.pdf            # Extract annotations

# Options
pdflens document.pdf --pages 1-5       # Specific pages
pdflens document.pdf --format json     # Output as JSON
pdflens document.pdf --format csv      # Output as CSV (tables)
pdflens document.pdf --password secret # Password-protected PDF
pdflens document.pdf --layout          # Preserve layout in text

# Get help
pdflens --help
```

## Types

PDFLens is fully typed. Import types as needed:

```typescript
import type {
  // Core types
  BBox,
  RGBColor,
  CMYKColor,
  Color,
  Matrix,
  PDFMetadata,
  PageInfo,
  OpenOptions,
  LayoutParams,

  // PDF objects
  PDFChar,
  PDFWord,
  PDFTextLine,
  PDFLine,
  PDFRect,
  PDFCurve,
  PDFImage,
  PDFAnnotation,
  PDFHyperlink,
  PDFObject,

  // Table types
  TableCell,
  PDFTable,
  TableFinderResult,
  TableExtractionOptions,
  TableDetectionMethod,  // 'lines' | 'text' | 'explicit' | 'hybrid'

  // Options
  TextExtractionOptions,
  WordExtractionOptions,
  RenderOptions,
  DrawOptions,
  FilterFn,
  CropOptions,
  ProcessingOptions,
  ProcessingResult,
  ProcessingError,

  // OCR types
  OCROptions,
  OCRResult,

  // Font types
  FontSubstitution,
  FontClass,
  FontMetrics,

  // CMap
  CMapConfig,

  // Precision extraction types
  TextState,        // charSpacing, wordSpacing, horizontalScale, textRise
  GraphicsState,    // Full graphics state from state machine
  StateSnapshot,    // State at specific position
  PrecisePosition,  // Calculated position with all adjustments
} from 'pdflens';
```

## Requirements

- Node.js >= 18.0.0
- For visual features: `canvas` package
- For OCR: `tesseract.js` package

## License

MIT
