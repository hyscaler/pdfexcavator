# Performance Optimization

Tips and techniques for handling large PDFs efficiently.

## Memory Management

### Flush Page Cache

```typescript
const pdf = await pdfexcavator.open('large-document.pdf');

for (const page of pdf.pages) {
  const text = await page.extractText();
  processText(text);

  // Free memory after processing
  page.flush();
}

await pdf.close();
```

### Process Sequentially

For minimum memory usage:

```typescript
const result = await pdf.processPagesSequential(async (page) => {
  const text = await page.extractText();
  // Process immediately
  await saveToDatabase(text);
  return true;
});
```

## Concurrent Processing

### Controlled Concurrency

```typescript
const result = await pdf.processPages(
  async (page) => {
    return page.extractText();
  },
  {
    concurrency: 4,           // Process 4 pages at once
    flushAfterProcess: true   // Free memory after each page
  }
);
```

### Optimal Concurrency

```typescript
import os from 'os';

// Use number of CPU cores
const concurrency = os.cpus().length;

const result = await pdf.processPages(processor, {
  concurrency
});
```

## Progress Tracking

```typescript
const result = await pdf.processPages(
  async (page) => page.extractText(),
  {
    onProgress: (completed, total, currentPage) => {
      const percent = Math.round((completed / total) * 100);
      process.stdout.write(`\rProcessing: ${percent}% (page ${currentPage})`);
    }
  }
);
console.log('\nDone!');
```

## Cancellation

```typescript
const controller = new AbortController();

// Cancel after 30 seconds
setTimeout(() => controller.abort(), 30000);

try {
  const result = await pdf.processPages(
    async (page) => page.extractText(),
    { signal: controller.signal }
  );
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Processing cancelled');
  }
}
```

## Error Handling

### Continue on Error

```typescript
const result = await pdf.processPages(
  async (page) => page.extractText(),
  { stopOnError: false }
);

if (result.errors.length > 0) {
  console.log('Errors occurred:');
  for (const error of result.errors) {
    console.log(`  Page ${error.pageNumber}: ${error.message}`);
  }
}

console.log(`Processed: ${result.pagesProcessed}/${pdf.pageCount}`);
```

### Retry Failed Pages

```typescript
async function processWithRetry(pdf, processor, maxRetries = 3) {
  const results = new Array(pdf.pageCount);
  const failed: number[] = [];

  // First pass
  const firstResult = await pdf.processPages(processor, {
    stopOnError: false
  });

  // Collect failures
  firstResult.results.forEach((r, i) => {
    if (r === undefined) {
      failed.push(i);
    } else {
      results[i] = r;
    }
  });

  // Retry failed pages
  for (let retry = 0; retry < maxRetries && failed.length > 0; retry++) {
    const stillFailed: number[] = [];

    for (const pageIndex of failed) {
      try {
        const page = pdf.getPage(pageIndex);
        results[pageIndex] = await processor(page);
      } catch {
        stillFailed.push(pageIndex);
      }
    }

    failed.length = 0;
    failed.push(...stillFailed);
  }

  return { results, failed };
}
```

## Selective Processing

### Process Specific Pages

```typescript
async function processPages(pdf, pageNumbers: number[]) {
  const results = [];

  for (const num of pageNumbers) {
    const page = pdf.getPage(num - 1);
    results.push(await page.extractText());
  }

  return results;
}

// Only process pages 1, 5, 10
const texts = await processPages(pdf, [1, 5, 10]);
```

### Skip Empty Pages

```typescript
async function extractNonEmptyPages(pdf) {
  const results = [];

  for (const page of pdf.pages) {
    const chars = await page.chars;

    if (chars.length > 0) {
      results.push({
        page: page.pageNumber + 1,
        text: await page.extractText()
      });
    }
  }

  return results;
}
```

## Streaming Processing

### Process as Stream

```typescript
async function* streamPages(pdfPath: string) {
  const pdf = await pdfexcavator.open(pdfPath);

  try {
    for (const page of pdf.pages) {
      const text = await page.extractText();
      page.flush();
      yield { page: page.pageNumber + 1, text };
    }
  } finally {
    await pdf.close();
  }
}

// Usage
for await (const { page, text } of streamPages('document.pdf')) {
  console.log(`Page ${page}: ${text.length} chars`);
}
```

## Benchmarking

```typescript
async function benchmark(pdfPath: string) {
  const start = Date.now();
  const pdf = await pdfexcavator.open(pdfPath);

  const pageTimings: number[] = [];

  for (const page of pdf.pages) {
    const pageStart = Date.now();
    await page.extractText();
    pageTimings.push(Date.now() - pageStart);
    page.flush();
  }

  await pdf.close();
  const total = Date.now() - start;

  console.log(`Total time: ${total}ms`);
  console.log(`Pages: ${pdf.pageCount}`);
  console.log(`Avg per page: ${Math.round(total / pdf.pageCount)}ms`);
  console.log(`Min: ${Math.min(...pageTimings)}ms`);
  console.log(`Max: ${Math.max(...pageTimings)}ms`);
}
```

## Best Practices

### 1. Close PDFs

Always close when done:

```typescript
const pdf = await pdfexcavator.open('document.pdf');
try {
  // ... process
} finally {
  await pdf.close();
}
```

### 2. Flush Large Pages

```typescript
if (page.chars.length > 10000) {
  page.flush();
}
```

### 3. Use Appropriate Concurrency

| PDF Size | Concurrency |
|----------|-------------|
| Small (<10 pages) | 1-2 |
| Medium (10-100 pages) | 2-4 |
| Large (100+ pages) | 4-8 |

### 4. Monitor Memory

```typescript
function logMemory() {
  const used = process.memoryUsage();
  console.log(`Memory: ${Math.round(used.heapUsed / 1024 / 1024)}MB`);
}
```

### 5. Profile Before Optimizing

```typescript
console.time('extraction');
const text = await page.extractText();
console.timeEnd('extraction');
```

## Processing Results

```typescript
interface ProcessingResult<T> {
  results: (T | undefined)[];  // Results per page
  pagesProcessed: number;       // Successful count
  pagesFailed: number;          // Failed count
  duration: number;             // Total time in ms
  aborted: boolean;             // Was cancelled
  errors: ProcessingError[];    // Error details
}

interface ProcessingError {
  pageNumber: number;
  message: string;
  error: Error;
}
```
