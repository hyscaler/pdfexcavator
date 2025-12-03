# Table Extraction API

Functions for detecting and extracting tables from PDFs.

## Page Methods

### extractTables(options?)

Extract all tables from a page.

```typescript
const tables = await page.extractTables();

for (const table of tables) {
  console.log(`Rows: ${table.rows.length}`);
  console.log(`Confidence: ${table.confidence}`);
  console.log(`Method: ${table.detectionMethod}`);

  for (const row of table.rows) {
    console.log(row.join(' | '));
  }
}
```

### extractTable(options?)

Extract the first/main table.

```typescript
const table = await page.extractTable();
if (table) {
  console.log(table.rows);
}
```

## Low-Level Functions

### TableFinder

Class for advanced table detection.

```typescript
import { TableFinder } from 'pdflens';

const chars = await page.chars;
const lines = await page.getLines();
const rects = await page.getRects();

const finder = new TableFinder(chars, lines, rects, page.pageNumber, {
  verticalStrategy: 'lines',
  horizontalStrategy: 'lines'
});
const result = finder.findTables();
console.log(result.tables);
```

### findTables(chars, lines, rects, pageNumber, options?)

Find tables in page content with debug information.

```typescript
import { findTables } from 'pdflens';

const result = findTables(chars, lines, rects, 0, {
  snapTolerance: 3,
  minWordsVertical: 3,
  minWordsHorizontal: 1
});

console.log(result.tables);       // Found tables
console.log(result.edges);        // Detected edges
console.log(result.intersections); // Edge intersections
```

### extractTables(chars, lines, rects, pageNumber, options?)

Extract tables with page number.

```typescript
import { extractTables } from 'pdflens';

const tables = extractTables(chars, lines, rects, 0, options);
```

### extractTablesEnhanced(chars, lines, rects, pageNumber, options?, detectNested?)

Enhanced extraction with nested table support.

```typescript
import { extractTablesEnhanced } from 'pdflens';

const tables = extractTablesEnhanced(
  chars, lines, rects, 0,
  options,
  true  // Detect nested tables
);

for (const table of tables) {
  if (table.nestedTables?.length) {
    console.log('Has nested tables');
  }
}
```

### detectBorderlessTables(chars, pageNumber, options?)

Detect tables without visible borders.

```typescript
import { detectBorderlessTables } from 'pdflens';

const tables = detectBorderlessTables(chars, 0, {
  minRows: 2,
  minCols: 2,
  gapThreshold: 10
});
```

### findNestedTables(parentTable, chars, lines, rects, maxDepth?, options?)

Find tables within table cells.

```typescript
import { findNestedTables } from 'pdflens';

const tableWithNested = findNestedTables(
  parentTable,
  chars, lines, rects,
  2  // Max nesting depth
);
```

### debugTableFinder(chars, lines, rects)

Debug table detection.

```typescript
import { debugTableFinder } from 'pdflens';

const debug = debugTableFinder(chars, lines, rects);
console.log('Edges:', debug.edges.length);
console.log('Intersections:', debug.intersections.length);
```

## Table Options

### TableExtractionOptions

```typescript
interface TableExtractionOptions {
  verticalStrategy?: 'lines' | 'lines_strict' | 'text' | 'explicit';   // Vertical edge detection strategy
  horizontalStrategy?: 'lines' | 'lines_strict' | 'text' | 'explicit'; // Horizontal edge detection strategy
  explicitVerticalLines?: number[];   // Explicit column positions
  explicitHorizontalLines?: number[]; // Explicit row positions
  snapTolerance?: number;             // Edge alignment tolerance (default: 3)
  joinTolerance?: number;             // Tolerance for joining nearby edges (default: 3)
  edgeMinLength?: number;             // Minimum edge length (default: 3)
  minWordsVertical?: number;          // Min words for column detection (default: 3)
  minWordsHorizontal?: number;        // Min words for row detection (default: 1)
  keepBlankChars?: boolean;           // Keep blank characters in text extraction
  textTolerance?: number;             // Text grouping tolerance (default: 3)
  textXTolerance?: number | null;     // Horizontal text tolerance (overrides textTolerance)
  textYTolerance?: number | null;     // Vertical text tolerance (overrides textTolerance)
  intersectionTolerance?: number;     // Intersection detection tolerance (default: 3)
  intersectionXTolerance?: number | null; // Horizontal intersection tolerance
  intersectionYTolerance?: number | null; // Vertical intersection tolerance
}
```

## Table Structure

### PDFTable

```typescript
interface PDFTable {
  bbox: [number, number, number, number];  // [x0, y0, x1, y1]
  rows: string[][];                        // Table data
  cells?: TableCell[][];                   // Detailed cell info
  pageNumber: number;
  confidence?: number;                     // 0-1, higher is better
  detectionMethod?: TableDetectionMethod;  // How it was detected
  nestedTables?: PDFTable[];              // Tables within cells
}
```

### TableCell

```typescript
interface TableCell {
  text: string;
  x0: number;           // Left position
  y0: number;           // Top position
  x1: number;           // Right position
  y1: number;           // Bottom position
  top: number;          // Top position (alias for y0)
  bottom: number;       // Bottom position (alias for y1)
  rowSpan?: number;     // Number of rows this cell spans
  colSpan?: number;     // Number of columns this cell spans
}
```

### TableDetectionMethod

```typescript
type TableDetectionMethod = 'lines' | 'text' | 'explicit' | 'hybrid';
```

- **lines**: Uses visible line graphics
- **text**: Analyzes text alignment
- **explicit**: Uses provided line positions
- **hybrid**: Combines multiple methods

## Confidence Scoring

Tables include confidence scores based on:

- **Edge completeness**: How many expected edges are present
- **Content coverage**: How much area contains text
- **Grid regularity**: Consistency of row/column sizes

```typescript
// Filter by confidence
const goodTables = tables.filter(t => (t.confidence ?? 0) >= 0.7);

// Sort by confidence
tables.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
```

## Example: Export to CSV

```typescript
import pdflens from 'pdflens';
import fs from 'fs';

async function tablesToCSV(pdfPath: string, outputPath: string) {
  const pdf = await pdflens.open(pdfPath);
  let csv = '';

  for (const page of pdf.pages) {
    const tables = await page.extractTables();

    for (const table of tables) {
      csv += `\n--- Page ${page.pageNumber + 1} ---\n`;

      for (const row of table.rows) {
        // Escape commas and quotes
        const escaped = row.map(cell => {
          if (cell.includes(',') || cell.includes('"')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        });
        csv += escaped.join(',') + '\n';
      }
    }
  }

  fs.writeFileSync(outputPath, csv);
  await pdf.close();
}
```

## Example: Table with Headers

```typescript
async function extractTableWithHeaders(page) {
  const tables = await page.extractTables();

  return tables.map(table => {
    const [headers, ...dataRows] = table.rows;

    return dataRows.map(row => {
      const obj: Record<string, string> = {};
      headers.forEach((header, i) => {
        obj[header] = row[i] || '';
      });
      return obj;
    });
  });
}

// Result: [{ Name: 'John', Age: '30' }, { Name: 'Jane', Age: '25' }]
```
