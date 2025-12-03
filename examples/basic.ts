/**
 * Basic PDFLens usage example
 *
 * Run with: npx tsx examples/basic.ts path/to/your.pdf
 */

import pdflens from '../src/index.js';

async function main() {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    console.log('Usage: npx tsx examples/basic.ts <pdf-file>');
    process.exit(1);
  }

  console.log(`Opening: ${pdfPath}\n`);

  const pdf = await pdflens.open(pdfPath);

  // === Metadata ===
  const metadata = await pdf.metadata;
  console.log('=== Metadata ===');
  console.log(`Title: ${metadata.title || 'N/A'}`);
  console.log(`Author: ${metadata.author || 'N/A'}`);
  console.log(`Pages: ${metadata.pageCount}`);
  console.log(`PDF Version: ${metadata.pdfVersion || 'N/A'}`);
  console.log();

  // Process first page in detail
  const page = pdf.pages[0];
  console.log(`=== Page 1 Details ===`);
  console.log(`Size: ${page.width.toFixed(2)} x ${page.height.toFixed(2)} pts`);

  // === Text Extraction ===
  const text = await page.extractText();
  const preview = text.slice(0, 200).replace(/\n/g, ' ');
  console.log(`\nText preview: ${preview}...`);

  // === Characters & Words ===
  const chars = await page.chars;
  const words = await page.words;
  const lines = await page.lines;
  console.log(`\nText elements: ${chars.length} chars, ${words.length} words, ${lines.length} lines`);

  // === Graphics Elements ===
  const rects = await page.rects;
  const lineObjs = await page.lineObjects;
  const curves = await page.curves;
  console.log(`Graphics: ${rects.length} rects, ${lineObjs.length} lines, ${curves.length} curves`);

  // === Images ===
  const images = await page.images;
  console.log(`Images: ${images.length}`);
  if (images.length > 0) {
    const img = images[0];
    console.log(`  First image: ${img.width}x${img.height} at (${img.x0.toFixed(1)}, ${img.y0.toFixed(1)})`);
  }

  // === Tables ===
  const tables = await page.extractTables();
  console.log(`\nTables found: ${tables.length}`);

  if (tables.length > 0) {
    const table = tables[0];
    console.log(`\nFirst table (${table.rows.length} rows x ${table.rows[0]?.length || 0} cols):`);
    for (const row of table.rows.slice(0, 3)) {
      const cells = row.map(c => (c || '').slice(0, 15).padEnd(15));
      console.log(`  | ${cells.join(' | ')} |`);
    }
    if (table.rows.length > 3) {
      console.log(`  ... (${table.rows.length - 3} more rows)`);
    }
  }

  // === Filtering Example ===
  // Get words in the top half of the page
  const topHalfWords = await page.filter({ y1: page.height / 2 }).words;
  console.log(`\nWords in top half: ${topHalfWords.length}`);

  // === Search Example ===
  const searchTerm = words[0]?.text || 'the';
  const found = await page.search(searchTerm);
  console.log(`Search for "${searchTerm}": ${found.length} matches`);

  // === Summary for all pages ===
  if (pdf.pages.length > 1) {
    console.log(`\n=== All Pages Summary ===`);
    for (const p of pdf.pages) {
      const pageChars = await p.chars;
      const pageTables = await p.extractTables();
      console.log(`Page ${p.pageNumber + 1}: ${pageChars.length} chars, ${pageTables.length} tables`);
    }
  }

  await pdf.close();
  console.log('\nDone!');
}

main().catch(console.error);
