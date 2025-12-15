# Utilities API

Helper functions for working with PDF content.

## Bounding Box Utilities

### Import

```typescript
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
} from 'pdfexcavator';
```

### normalizeBBox(bbox)

Normalize bbox to ensure x0 < x1 and y0 < y1.

```typescript
const normalized = normalizeBBox([100, 100, 0, 0]);
// [0, 0, 100, 100]
```

### isValidBBox(bbox)

Check if bbox is valid.

```typescript
isValidBBox([0, 0, 100, 100]); // true
isValidBBox([100, 100, 0, 0]); // false
```

### pointInBBox(x, y, bbox)

Check if point is inside bbox.

```typescript
pointInBBox(50, 50, [0, 0, 100, 100]); // true
pointInBBox(150, 50, [0, 0, 100, 100]); // false
```

### bboxOverlaps(bbox1, bbox2)

Check if two bboxes overlap.

```typescript
bboxOverlaps([0, 0, 100, 100], [50, 50, 150, 150]); // true
bboxOverlaps([0, 0, 100, 100], [200, 200, 300, 300]); // false
```

### bboxWithin(inner, outer)

Check if inner bbox is within outer bbox.

```typescript
bboxWithin([25, 25, 75, 75], [0, 0, 100, 100]); // true
```

### bboxOutside(bbox1, bbox2)

Check if bboxes don't overlap.

```typescript
bboxOutside([0, 0, 50, 50], [100, 100, 200, 200]); // true
```

### bboxIntersection(bbox1, bbox2)

Get intersection of two bboxes.

```typescript
bboxIntersection([0, 0, 100, 100], [50, 50, 150, 150]);
// [50, 50, 100, 100]
```

### bboxUnion(bbox1, bbox2)

Get union of two bboxes.

```typescript
bboxUnion([0, 0, 50, 50], [25, 25, 100, 100]);
// [0, 0, 100, 100]
```

### getBBox(obj)

Extract bounding box from a single object with x0, y0, x1, y1 properties.

```typescript
const chars = await page.chars;
const bbox = getBBox(chars[0]);  // Get bbox of first character
// Returns: [x0, y0, x1, y1]
```

### bboxArea(bbox)

Calculate area of bbox.

```typescript
bboxArea([0, 0, 100, 50]); // 5000
```

### bboxCenter(bbox)

Get center point of bbox.

```typescript
bboxCenter([0, 0, 100, 100]); // [50, 50]
```

### bboxExpand(bbox, amount)

Expand bbox by amount.

```typescript
bboxExpand([10, 10, 90, 90], 10);
// [0, 0, 100, 100]
```

### Filter Functions

```typescript
// Filter objects within bbox
const within = filterWithinBBox(chars, [0, 0, 200, 200]);

// Filter objects overlapping bbox
const overlapping = filterOverlapsBBox(chars, bbox);

// Filter objects outside bbox
const outside = filterOutsideBBox(chars, bbox);
```

## Geometry Utilities

### Import

```typescript
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
} from 'pdfexcavator';
```

### isHorizontalLine(line)

Check if line is horizontal.

```typescript
isHorizontalLine({ x0: 0, y0: 50, x1: 100, y1: 50 }); // true
```

### isVerticalLine(line)

Check if line is vertical.

```typescript
isVerticalLine({ x0: 50, y0: 0, x1: 50, y1: 100 }); // true
```

### lineLength(line)

Calculate line length.

```typescript
lineLength({ x0: 0, y0: 0, x1: 100, y1: 0 }); // 100
```

### linesIntersect(line1, line2)

Check if lines intersect.

```typescript
linesIntersect(
  { x0: 0, y0: 50, x1: 100, y1: 50 },
  { x0: 50, y0: 0, x1: 50, y1: 100 }
); // true
```

### getHorizontalLines(lines)

Filter horizontal lines.

```typescript
const horizontal = getHorizontalLines(lines);
```

### getVerticalLines(lines)

Filter vertical lines.

```typescript
const vertical = getVerticalLines(lines);
```

### groupHorizontalLines(lines, tolerance?)

Group nearby horizontal lines.

```typescript
const grouped = groupHorizontalLines(lines, 3);
```

### groupVerticalLines(lines, tolerance?)

Group nearby vertical lines.

```typescript
const grouped = groupVerticalLines(lines, 3);
```

### rectsToLines(rects)

Convert rectangles to lines.

```typescript
const lines = rectsToLines(rects);
```

### getUniqueXPositions(lines)

Get unique x positions from lines.

```typescript
const xPositions = getUniqueXPositions(lines);
```

### getUniqueYPositions(lines)

Get unique y positions from lines.

```typescript
const yPositions = getUniqueYPositions(lines);
```

## Clustering

### clusterObjects(objects, accessor, tolerance)

Cluster objects by a numeric attribute.

```typescript
// Group chars into lines by y-position
const lines = clusterObjects(chars, c => c.y0, 3);

// Group into columns by x-position
const columns = clusterObjects(chars, c => c.x0, 10);
```

### clusterObjectsByMean(objects, accessor, tolerance)

Cluster using mean-based linkage (more sophisticated).

```typescript
const groups = clusterObjectsByMean(items, i => i.value, 5);
```

## Character Correction

### Import

```typescript
import {
  correctText,
  createTextCorrector,
  detectEncodingIssues,
  autoCorrectText,
  NUMBER_TO_LETTER,
  LETTER_TO_NUMBER,
  LIGATURES,
  QUOTES,
  DASHES,
  WHITESPACE,
  COMMON_WORDS,
  WORD_PATTERNS,
} from 'pdfexcavator';
```

### correctText(text, options?)

Fix common character encoding issues.

```typescript
const fixed = correctText(text, {
  numberToLetter: true,       // 0→o, 1→l, 3→e, 5→s, 8→b
  expandLigatures: true,      // ﬁ→fi, ﬂ→fl
  normalizeQuotes: true,      // Normalize quotes
  normalizeDashes: true,      // Normalize dashes
  normalizeWhitespace: true   // Fix whitespace
});
```

### autoCorrectText(text, threshold?)

Auto-detect and fix encoding issues. Returns an object with the corrected text.

```typescript
const result = autoCorrectText(text);
console.log(result.text);           // Corrected text
console.log(result.corrected);      // boolean - was correction applied?
console.log(result.issuesDetected); // Array of detected issues
```

### detectEncodingIssues(text)

Detect encoding issues in text.

```typescript
const issues = detectEncodingIssues(text);
console.log('Issues:', issues.issues);
console.log('Score:', issues.score);
console.log('Suggestions:', issues.suggestions);
```

### createTextCorrector(options)

Create reusable corrector function.

```typescript
const corrector = createTextCorrector({
  numberToLetter: true,
  expandLigatures: true
});

const fixed1 = corrector(text1);
const fixed2 = corrector(text2);
```

### Character Maps

```typescript
// Number to letter substitutions
console.log(NUMBER_TO_LETTER);
// { '0': 'o', '1': 'l', '3': 'e', '5': 's', '8': 'b' }

// Letter to number (reverse)
console.log(LETTER_TO_NUMBER);

// Ligature expansions
console.log(LIGATURES);
// { 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬀ': 'ff', ... }

// Quote normalizations
console.log(QUOTES);

// Dash normalizations
console.log(DASHES);

// Whitespace normalizations
console.log(WHITESPACE);
```

## Font Utilities

### Import

```typescript
import {
  findFontSubstitution,
  classifyFont,
  parseFontStyle,
  getSubstituteFontMetrics,
  PDF_BASE_FONTS,
  FONT_SUBSTITUTION_MAP,
  STANDARD_FONT_METRICS,
} from 'pdfexcavator';
```

### findFontSubstitution(fontName)

Find substitute for a font.

```typescript
const sub = findFontSubstitution('Arial');
console.log(sub.substituteFont);  // 'Helvetica'
console.log(sub.confidence);      // 0.95
```

### classifyFont(fontName)

Classify font type.

```typescript
classifyFont('Times');      // 'serif'
classifyFont('Arial');      // 'sans-serif'
classifyFont('Courier');    // 'monospace'
```

### parseFontStyle(fontName)

Parse font style from name.

```typescript
const style = parseFontStyle('Arial-BoldItalic');
console.log(style.bold);    // true
console.log(style.italic);  // true
console.log(style.weight);  // 700
```

## CJK Utilities

### Import

```typescript
import {
  getDefaultCMapConfig,
  isCJKFont,
  normalizeCJKText,
} from 'pdfexcavator';
```

### isCJKFont(fontName)

Check if font is CJK.

```typescript
isCJKFont('SimSun');   // true (Chinese)
isCJKFont('Meiryo');   // true (Japanese)
isCJKFont('Gulim');    // true (Korean)
isCJKFont('Arial');    // false
```

### normalizeCJKText(text)

Normalize fullwidth characters.

```typescript
normalizeCJKText('ABC');  // 'ABC'
normalizeCJKText('123');  // '123'
```

### getDefaultCMapConfig()

Get CMap configuration for pdf.js.

```typescript
const config = await getDefaultCMapConfig();
// { cMapUrl: '...', cMapPacked: true }
```
