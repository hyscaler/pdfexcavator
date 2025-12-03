/**
 * Visual Debugging Example
 * Demonstrates rendering pages and drawing annotations
 *
 * Requires: npm install canvas
 * Run with: npx tsx examples/visual-debug.ts path/to/your.pdf [output-dir]
 */

import pdflens from '../src/index.js';
import { join } from 'path';

async function main() {
  const pdfPath = process.argv[2];
  const outputDir = process.argv[3] || '.';

  if (!pdfPath) {
    console.log('Usage: npx tsx examples/visual-debug.ts <pdf-file> [output-dir]');
    process.exit(1);
  }

  console.log(`Opening: ${pdfPath}\n`);

  const pdf = await pdflens.open(pdfPath);
  const page = pdf.pages[0];

  // Render page to image
  console.log('Rendering page...');
  let pageImage;
  try {
    pageImage = await page.toImage({ resolution: 150 });
  } catch (e) {
    console.error('Error: canvas module required. Install with: npm install canvas');
    process.exit(1);
  }

  console.log(`Image size: ${pageImage.width}x${pageImage.height}`);

  // === Example 1: Highlight all words ===
  const words = await page.words;
  pageImage.drawRects(
    words.map(w => ({ x0: w.x0, y0: w.y0, x1: w.x1, y1: w.y1 })),
    { stroke: 'blue', strokeWidth: 1, strokeOpacity: 0.5 }
  );
  await pageImage.save(join(outputDir, 'debug-words.png'));
  console.log(`Saved: debug-words.png (${words.length} words highlighted)`);

  // === Example 2: Highlight tables ===
  pageImage.reset(); // Clear previous drawings
  const tables = await page.extractTables();
  if (tables.length > 0) {
    pageImage.drawRects(
      tables.map(t => ({ x0: t.bbox[0], y0: t.bbox[1], x1: t.bbox[2], y1: t.bbox[3] })),
      { fill: 'yellow', fillOpacity: 0.3, stroke: 'orange', strokeWidth: 2 }
    );
    await pageImage.save(join(outputDir, 'debug-tables.png'));
    console.log(`Saved: debug-tables.png (${tables.length} tables highlighted)`);
  }

  // === Example 3: Draw grid lines ===
  pageImage.reset();
  // Draw horizontal lines every 100 points
  const hLines = [];
  for (let y = 0; y < page.height; y += 100) {
    hLines.push(y);
  }
  pageImage.drawHLines(hLines, { stroke: 'gray', strokeOpacity: 0.3, dash: [5, 5] });

  // Draw vertical lines every 100 points
  const vLines = [];
  for (let x = 0; x < page.width; x += 100) {
    vLines.push(x);
  }
  pageImage.drawVLines(vLines, { stroke: 'gray', strokeOpacity: 0.3, dash: [5, 5] });
  await pageImage.save(join(outputDir, 'debug-grid.png'));
  console.log('Saved: debug-grid.png');

  // === Example 4: Highlight images and graphics ===
  pageImage.reset();
  const images = await page.images;
  const rects = await page.rects;

  if (images.length > 0) {
    pageImage.drawRects(
      images.map(i => ({ x0: i.x0, y0: i.y0, x1: i.x1, y1: i.y1 })),
      { stroke: 'green', strokeWidth: 2, fill: 'green', fillOpacity: 0.1 }
    );
  }

  if (rects.length > 0) {
    pageImage.drawRects(
      rects.slice(0, 50).map(r => ({ x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 })),
      { stroke: 'purple', strokeWidth: 1 }
    );
  }
  await pageImage.save(join(outputDir, 'debug-graphics.png'));
  console.log(`Saved: debug-graphics.png (${images.length} images, ${Math.min(rects.length, 50)} rects)`);

  // === Example 5: Search result highlighting ===
  pageImage.reset();
  const searchResults = await page.search('the');
  if (searchResults.length > 0) {
    pageImage.drawRects(
      searchResults.map(r => ({ x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 })),
      { fill: 'yellow', fillOpacity: 0.5, stroke: 'orange', strokeWidth: 1 }
    );
    await pageImage.save(join(outputDir, 'debug-search.png'));
    console.log(`Saved: debug-search.png (${searchResults.length} matches for "the")`);
  }

  await pdf.close();
  console.log('\nDone! Check the output images.');
}

main().catch(console.error);
