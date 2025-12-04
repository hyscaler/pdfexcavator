/**
 * Table Extraction Example
 * Extract tables from PDF and export to CSV/JSON
 *
 * Run with: npx tsx examples/extract-tables.ts path/to/your.pdf [output-dir]
 */

import pdfexcavator from '../src/index.js';
import { writeFile } from 'fs/promises';
import { join } from 'path';

async function main() {
  const pdfPath = process.argv[2];
  const outputDir = process.argv[3] || '.';

  if (!pdfPath) {
    console.log('Usage: npx tsx examples/extract-tables.ts <pdf-file> [output-dir]');
    process.exit(1);
  }

  console.log(`Opening: ${pdfPath}\n`);

  const pdf = await pdfexcavator.open(pdfPath);
  let tableCount = 0;

  for (const page of pdf.pages) {
    const tables = await page.extractTables();

    if (tables.length === 0) {
      console.log(`Page ${page.pageNumber + 1}: No tables found`);
      continue;
    }

    console.log(`Page ${page.pageNumber + 1}: Found ${tables.length} table(s)`);

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      tableCount++;
      const baseName = `table-p${page.pageNumber + 1}-${i + 1}`;

      // Export as CSV
      const csv = table.rows
        .map(row =>
          row
            .map(cell => {
              const val = (cell || '').replace(/"/g, '""');
              return val.includes(',') || val.includes('"') || val.includes('\n')
                ? `"${val}"`
                : val;
            })
            .join(',')
        )
        .join('\n');

      await writeFile(join(outputDir, `${baseName}.csv`), csv);

      // Export as JSON
      const json = JSON.stringify(
        {
          page: page.pageNumber + 1,
          tableIndex: i,
          bbox: table.bbox,
          rows: table.rows.length,
          columns: table.rows[0]?.length || 0,
          data: table.rows,
        },
        null,
        2
      );

      await writeFile(join(outputDir, `${baseName}.json`), json);

      console.log(
        `  Table ${i + 1}: ${table.rows.length} rows x ${table.rows[0]?.length || 0} cols -> ${baseName}.csv, ${baseName}.json`
      );

      // Preview first 3 rows
      for (const row of table.rows.slice(0, 3)) {
        const preview = row.map(c => (c || '').slice(0, 20).padEnd(20)).join(' | ');
        console.log(`    ${preview}`);
      }
      if (table.rows.length > 3) {
        console.log(`    ... (${table.rows.length - 3} more rows)`);
      }
    }
  }

  await pdf.close();

  if (tableCount === 0) {
    console.log('\nNo tables found in the PDF.');
  } else {
    console.log(`\nExtracted ${tableCount} table(s) to ${outputDir}`);
  }
}

main().catch(console.error);
