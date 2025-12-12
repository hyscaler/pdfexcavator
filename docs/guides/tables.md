# Table Extraction Guide

Strategies and techniques for extracting tables from PDFs.

## Basic Extraction

```typescript
const tables = await page.extractTables();

for (const table of tables) {
  console.log(`Found table with ${table.rows.length} rows`);

  for (const row of table.rows) {
    console.log(row.join(' | '));
  }
}
```

## Detection Strategies

### Line-Based Detection (Default)

Uses visible lines/borders to detect table structure:

```typescript
const tables = await page.extractTables({
  verticalStrategy: 'lines',
  horizontalStrategy: 'lines'
});
```

Best for:
- Tables with visible borders
- Grid-style tables
- Well-structured documents

### Text-Based Detection

Analyzes text alignment to infer table structure:

```typescript
const tables = await page.extractTables({
  verticalStrategy: 'text',
  horizontalStrategy: 'text'
});
```

Best for:
- Borderless tables
- Tables with minimal lines
- Text-aligned data

## Borderless Tables

Tables without visible lines:

```typescript
import { detectBorderlessTables } from 'pdfexcavator';

const chars = await page.chars;
const tables = detectBorderlessTables(chars, page.pageNumber, {
  minRows: 2,
  minCols: 2,
  gapThreshold: 10
});
```

## Table Quality

### Confidence Scores

Tables include confidence scores (0-1):

```typescript
const tables = await page.extractTables();

// Filter by confidence
const goodTables = tables.filter(t => t.confidence >= 0.7);

// Sort by confidence
tables.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
```

### Detection Method

```typescript
for (const table of tables) {
  console.log(`Method: ${table.detectionMethod}`);
  // 'lines', 'text', 'explicit', or 'hybrid'
}
```

## Explicit Table Boundaries

When you know table boundaries:

```typescript
const tables = await page.extractTables({
  explicitVerticalLines: [50, 150, 250, 350],    // Column edges
  explicitHorizontalLines: [100, 130, 160, 190]  // Row edges
});
```

## Nested Tables

Tables within table cells:

```typescript
import { extractTablesEnhanced } from 'pdfexcavator';

const chars = await page.chars;
const lines = await page.getLines();
const rects = await page.getRects();

const tables = extractTablesEnhanced(
  chars, lines, rects,
  page.pageNumber,
  {},
  true  // Enable nested detection
);

for (const table of tables) {
  if (table.nestedTables?.length) {
    console.log(`Found ${table.nestedTables.length} nested tables`);
  }
}
```

## Converting Tables

### To JSON Objects

```typescript
function tableToObjects(table) {
  const [headers, ...rows] = table.rows;

  return rows.map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header.trim()] = row[i]?.trim() || '';
    });
    return obj;
  });
}

const tables = await page.extractTables();
const data = tableToObjects(tables[0]);
// [{ Name: 'John', Age: '30', City: 'NYC' }, ...]
```

### To CSV

```typescript
function tableToCSV(table) {
  return table.rows.map(row =>
    row.map(cell => {
      // Escape quotes and wrap if needed
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',')
  ).join('\n');
}
```

### To HTML

```typescript
function tableToHTML(table) {
  const [headers, ...rows] = table.rows;

  let html = '<table>\n<thead>\n<tr>';
  headers.forEach(h => html += `<th>${h}</th>`);
  html += '</tr>\n</thead>\n<tbody>\n';

  rows.forEach(row => {
    html += '<tr>';
    row.forEach(cell => html += `<td>${cell}</td>`);
    html += '</tr>\n';
  });

  html += '</tbody>\n</table>';
  return html;
}
```

## Handling Common Issues

### Merged Cells

```typescript
// Check for cell spans
const table = await page.extractTable();

if (table.cells) {
  for (let r = 0; r < table.cells.length; r++) {
    for (let c = 0; c < table.cells[r].length; c++) {
      const cell = table.cells[r][c];
      if (cell.rowSpan > 1 || cell.colSpan > 1) {
        console.log(`Merged cell at (${r},${c}): ${cell.rowSpan}x${cell.colSpan}`);
      }
    }
  }
}
```

### Missing Cells

```typescript
// Normalize rows to same length
function normalizeTable(table) {
  const maxCols = Math.max(...table.rows.map(r => r.length));

  return {
    ...table,
    rows: table.rows.map(row => {
      while (row.length < maxCols) {
        row.push('');
      }
      return row;
    })
  };
}
```

### Multi-Line Cells

```typescript
// Join multi-line cell content
function cleanTableCells(table) {
  return {
    ...table,
    rows: table.rows.map(row =>
      row.map(cell =>
        cell.replace(/\s+/g, ' ').trim()
      )
    )
  };
}
```

## Debugging

### Visual Debug

```typescript
const tables = await page.extractTables();
const image = await page.toImage({ scale: 2 });

// Draw table boundaries
for (const table of tables) {
  image.drawRect({
    x0: table.bbox[0],
    y0: table.bbox[1],
    x1: table.bbox[2],
    y1: table.bbox[3]
  }, { stroke: 'blue', strokeWidth: 2 });
}

image.save('debug-tables.png');
```

### Debug Table Finder

```typescript
import { debugTableFinder } from 'pdfexcavator';

const chars = await page.chars;
const lines = await page.getLines();
const rects = await page.getRects();

const debug = debugTableFinder(chars, lines, rects);
console.log('Edges found:', debug.edges.length);
console.log('Intersections:', debug.intersections.length);
console.log('Potential tables:', debug.tables.length);
```

## Tips

1. **Try both strategies**: Line-based fails? Try text-based.
2. **Check confidence**: Low confidence means uncertain detection.
3. **Use explicit lines**: If you know the structure, specify it.
4. **Pre-process**: Sometimes cropping helps isolate tables.
5. **Visual debugging**: Render and draw boundaries to verify.
