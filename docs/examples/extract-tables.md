# Table Extraction Examples

Code examples for extracting tables from PDFs.

## Basic Table Extraction

```typescript
import pdflens from 'pdflens';

async function extractAllTables(pdfPath: string) {
  const pdf = await pdflens.open(pdfPath);
  const allTables: { page: number; table: string[][] }[] = [];

  for (const page of pdf.pages) {
    const tables = await page.extractTables();

    for (const table of tables) {
      allTables.push({
        page: page.pageNumber + 1,
        table: table.rows
      });
    }
  }

  await pdf.close();
  return allTables;
}
```

## Convert Table to Objects

```typescript
function tableToObjects<T extends Record<string, string>>(table: { rows: string[][] }): T[] {
  const [headers, ...rows] = table.rows;

  return rows.map(row => {
    const obj = {} as T;
    headers.forEach((header, i) => {
      (obj as any)[header.trim()] = row[i]?.trim() || '';
    });
    return obj;
  });
}

// Usage
interface Employee {
  Name: string;
  Department: string;
  Salary: string;
}

const tables = await page.extractTables();
const employees = tableToObjects<Employee>(tables[0]);
// [{ Name: 'John', Department: 'IT', Salary: '50000' }, ...]
```

## Export to CSV

```typescript
function tableToCSV(table: { rows: string[][] }): string {
  return table.rows.map(row =>
    row.map(cell => {
      // Escape special characters
      const escaped = cell.replace(/"/g, '""');
      if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
        return `"${escaped}"`;
      }
      return escaped;
    }).join(',')
  ).join('\n');
}

async function exportTablesToCSV(pdfPath: string, outputDir: string) {
  const pdf = await pdflens.open(pdfPath);
  let tableCount = 0;

  for (const page of pdf.pages) {
    const tables = await page.extractTables();

    for (const table of tables) {
      tableCount++;
      const csv = tableToCSV(table);
      fs.writeFileSync(`${outputDir}/table_${tableCount}.csv`, csv);
    }
  }

  await pdf.close();
  console.log(`Exported ${tableCount} tables`);
}
```

## Export to HTML

```typescript
function tableToHTML(table: { rows: string[][] }): string {
  const [headers, ...rows] = table.rows;

  let html = '<table border="1">\n';

  // Headers
  html += '  <thead>\n    <tr>\n';
  headers.forEach(h => html += `      <th>${escapeHTML(h)}</th>\n`);
  html += '    </tr>\n  </thead>\n';

  // Body
  html += '  <tbody>\n';
  rows.forEach(row => {
    html += '    <tr>\n';
    row.forEach(cell => html += `      <td>${escapeHTML(cell)}</td>\n`);
    html += '    </tr>\n';
  });
  html += '  </tbody>\n</table>';

  return html;
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
```

## Export to Excel (JSON for xlsx)

```typescript
async function tablesToExcelData(pdfPath: string) {
  const pdf = await pdflens.open(pdfPath);
  const sheets: { name: string; data: string[][] }[] = [];

  for (const page of pdf.pages) {
    const tables = await page.extractTables();

    tables.forEach((table, i) => {
      sheets.push({
        name: `Page${page.pageNumber + 1}_Table${i + 1}`,
        data: table.rows
      });
    });
  }

  await pdf.close();
  return sheets;

  // Use with xlsx library:
  // const workbook = XLSX.utils.book_new();
  // sheets.forEach(s => {
  //   const ws = XLSX.utils.aoa_to_sheet(s.data);
  //   XLSX.utils.book_append_sheet(workbook, ws, s.name);
  // });
}
```

## Extract Specific Table

```typescript
async function extractTableByIndex(pdfPath: string, pageNum: number, tableIndex: number) {
  const pdf = await pdflens.open(pdfPath);
  const page = pdf.getPage(pageNum - 1);

  const tables = await page.extractTables();
  const table = tables[tableIndex];

  await pdf.close();
  return table;
}

// Get second table on page 3
const table = await extractTableByIndex('document.pdf', 3, 1);
```

## Extract Tables from Region

```typescript
async function extractTablesFromRegion(
  pdfPath: string,
  bbox: [number, number, number, number]
) {
  const pdf = await pdflens.open(pdfPath);
  const page = pdf.pages[0];

  // Crop to region
  const region = page.crop(bbox);
  const tables = await region.extractTables();

  await pdf.close();
  return tables;
}
```

## Filter Tables by Size

```typescript
async function extractLargeTables(pdfPath: string, minRows: number = 3) {
  const pdf = await pdflens.open(pdfPath);
  const largeTables: { page: number; rows: string[][] }[] = [];

  for (const page of pdf.pages) {
    const tables = await page.extractTables();

    for (const table of tables) {
      if (table.rows.length >= minRows) {
        largeTables.push({
          page: page.pageNumber + 1,
          rows: table.rows
        });
      }
    }
  }

  await pdf.close();
  return largeTables;
}
```

## Extract with Confidence Filter

```typescript
async function extractConfidentTables(pdfPath: string, minConfidence = 0.7) {
  const pdf = await pdflens.open(pdfPath);
  const goodTables: { page: number; confidence: number; rows: string[][] }[] = [];

  for (const page of pdf.pages) {
    const tables = await page.extractTables();

    for (const table of tables) {
      if ((table.confidence || 0) >= minConfidence) {
        goodTables.push({
          page: page.pageNumber + 1,
          confidence: table.confidence || 0,
          rows: table.rows
        });
      }
    }
  }

  await pdf.close();
  return goodTables;
}
```

## Merge Tables Across Pages

```typescript
async function mergeTablesAcrossPages(pdfPath: string) {
  const pdf = await pdflens.open(pdfPath);
  let mergedRows: string[][] = [];
  let headers: string[] | null = null;

  for (const page of pdf.pages) {
    const tables = await page.extractTables();

    for (const table of tables) {
      if (!headers) {
        // First table - use as headers
        headers = table.rows[0];
        mergedRows = [...table.rows];
      } else {
        // Check if same structure
        if (table.rows[0].length === headers.length) {
          // Skip header if it matches
          const startRow = table.rows[0].join() === headers.join() ? 1 : 0;
          mergedRows.push(...table.rows.slice(startRow));
        }
      }
    }
  }

  await pdf.close();
  return { rows: mergedRows };
}
```

## Extract Nested Tables

```typescript
import { extractTablesEnhanced } from 'pdflens';

async function extractWithNestedTables(pdfPath: string) {
  const pdf = await pdflens.open(pdfPath);
  const page = pdf.pages[0];

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
    console.log('Main table:', table.rows.length, 'rows');

    if (table.nestedTables?.length) {
      for (const nested of table.nestedTables) {
        console.log('  Nested table:', nested.rows.length, 'rows');
      }
    }
  }

  await pdf.close();
}
```

## Debug Table Detection

```typescript
import { debugTableFinder } from 'pdflens';

async function debugTables(pdfPath: string) {
  const pdf = await pdflens.open(pdfPath);
  const page = pdf.pages[0];

  const chars = await page.chars;
  const lines = await page.getLines();
  const rects = await page.getRects();

  const debug = debugTableFinder(chars, lines, rects);

  console.log('Debug info:');
  console.log('  Horizontal edges:', debug.edges.filter(e => e.type === 'horizontal').length);
  console.log('  Vertical edges:', debug.edges.filter(e => e.type === 'vertical').length);
  console.log('  Intersections:', debug.intersections.length);
  console.log('  Potential tables:', debug.tables.length);

  // Visualize
  const image = await page.toImage({ scale: 2 });
  image.debugTableFinder(debug, {
    edgeColor: 'red',
    intersectionColor: 'blue',
    tableColor: 'green'
  });
  await image.save('debug-tables.png');

  await pdf.close();
}
```
