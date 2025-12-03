/**
 * Large PDF Processing Example
 * Demonstrates resource-controlled processing for large PDFs
 *
 * Run with: npx tsx examples/large-pdf.ts path/to/large.pdf
 */

import pdflens from '../src/index.js';

async function main() {
  const pdfPath = process.argv[2];
  const concurrency = parseInt(process.argv[3] || '2', 10);

  if (!pdfPath) {
    console.log('Usage: npx tsx examples/large-pdf.ts <pdf-file> [concurrency]');
    console.log('');
    console.log('Options:');
    console.log('  concurrency  Number of pages to process at once (default: 2)');
    console.log('');
    console.log('Examples:');
    console.log('  npx tsx examples/large-pdf.ts large.pdf      # Process 2 pages at a time');
    console.log('  npx tsx examples/large-pdf.ts large.pdf 1    # Process 1 page at a time (min memory)');
    console.log('  npx tsx examples/large-pdf.ts large.pdf 4    # Process 4 pages at a time (faster)');
    process.exit(1);
  }

  console.log(`Opening: ${pdfPath}`);
  console.log(`Concurrency: ${concurrency} pages at a time\n`);

  const pdf = await pdflens.open(pdfPath);
  console.log(`Total pages: ${pdf.pageCount}\n`);

  // === Example 1: Extract text with progress tracking ===
  console.log('=== Extracting text with progress tracking ===');

  const textResult = await pdf.processPages(
    async (page) => {
      const text = await page.extractText();
      return { pageNumber: page.pageNumber + 1, charCount: text.length };
    },
    {
      concurrency,
      flushAfterProcess: true, // Free memory after each page
      onProgress: (done, total, pageNum) => {
        const percent = Math.round((done / total) * 100);
        process.stdout.write(`\rProgress: ${done}/${total} (${percent}%) - Page ${pageNum + 1}`);
      },
    }
  );

  console.log('\n');
  console.log(`Processed ${textResult.pagesProcessed} pages in ${textResult.duration}ms`);
  if (textResult.pagesFailed > 0) {
    console.log(`Failed pages: ${textResult.pagesFailed}`);
  }
  const totalChars = textResult.results
    .filter((r): r is { pageNumber: number; charCount: number } => r !== undefined)
    .reduce((sum, r) => sum + r.charCount, 0);
  console.log(`Total characters: ${totalChars.toLocaleString()}`);

  // === Example 2: Extract tables sequentially (most memory efficient) ===
  console.log('\n=== Extracting tables sequentially ===');

  const tableResult = await pdf.processPagesSequential(
    async (page) => {
      const tables = await page.extractTables();
      return { pageNumber: page.pageNumber + 1, tableCount: tables.length };
    },
    {
      onProgress: (done, total) => {
        process.stdout.write(`\rProgress: ${done}/${total}`);
      },
    }
  );

  console.log('\n');
  const totalTables = tableResult.results
    .filter((r): r is { pageNumber: number; tableCount: number } => r !== undefined)
    .reduce((sum, r) => sum + r.tableCount, 0);
  console.log(`Found ${totalTables} tables across ${pdf.pageCount} pages`);

  // === Example 3: Error handling (continue on errors) ===
  console.log('\n=== Error handling example ===');

  const errorResult = await pdf.processPages(
    async (page, index) => {
      // Simulate random errors for demonstration
      if (index === 2 && pdf.pageCount > 2) {
        throw new Error('Simulated error on page 3');
      }
      return await page.extractText();
    },
    {
      concurrency: 2,
      stopOnError: false, // Continue processing even if some pages fail
    }
  );

  console.log(`Successful: ${errorResult.pagesProcessed}, Failed: ${errorResult.pagesFailed}`);
  if (errorResult.errors.length > 0) {
    console.log('Errors:');
    for (const err of errorResult.errors) {
      console.log(`  Page ${err.pageNumber}: ${err.message}`);
    }
  }

  // === Example 4: Abort processing midway ===
  console.log('\n=== Abort example (stop after 5 pages) ===');

  const controller = new AbortController();
  let pagesStarted = 0;

  const abortResult = await pdf.processPages(
    async (page) => {
      pagesStarted++;
      if (pagesStarted >= 5) {
        controller.abort();
      }
      return await page.extractText();
    },
    {
      concurrency: 1,
      signal: controller.signal,
    }
  );

  console.log(`Aborted: ${abortResult.aborted}`);
  console.log(`Pages processed before abort: ${abortResult.pagesProcessed}`);

  // === Memory usage summary ===
  const memUsage = process.memoryUsage();
  console.log('\n=== Memory Usage ===');
  console.log(`Heap used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
  console.log(`Heap total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
  console.log(`RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`);

  await pdf.close();
  console.log('\nDone!');
}

main().catch(console.error);
