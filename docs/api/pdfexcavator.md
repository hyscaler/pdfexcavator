# PDFExcavator Class

The main class for opening and working with PDF documents.

## Import

```typescript
import pdfexcavator, { PDFExcavator } from 'pdfexcavator';
```

## Opening PDFs

### pdfexcavator.open(path, options?)

Opens a PDF from a file path.

```typescript
const pdf = await pdfexcavator.open('document.pdf');

// With options
const pdf = await pdfexcavator.open('encrypted.pdf', {
  password: 'secret',
  repair: true
});
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| path | `string` | Path to the PDF file |
| options | `OpenOptions` | Optional settings |

**OpenOptions:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| password | `string` | - | Password for encrypted PDFs |
| repair | `boolean` | `false` | Attempt to repair malformed PDFs |
| basePath | `string` | - | Restrict file access to this directory (security) |
| unicodeNorm | `string` | - | Unicode normalization: 'NFC', 'NFD', 'NFKC', 'NFKD' |
| enableCMap | `boolean` | `true` | Enable CMap support for CJK characters |
| enableFontSubstitution | `boolean` | `true` | Enable font substitution for missing fonts |
| verbose | `boolean` | `false` | Enable verbose logging for debugging |

### PDFExcavator.fromBuffer(buffer, options?)

Opens a PDF from a Buffer.

```typescript
import { PDFExcavator } from 'pdfexcavator';
import fs from 'fs';

const buffer = fs.readFileSync('document.pdf');
const pdf = await PDFExcavator.fromBuffer(buffer);
```

### PDFExcavator.fromUint8Array(data, options?)

Opens a PDF from a Uint8Array.

```typescript
const pdf = await PDFExcavator.fromUint8Array(uint8Array);
```

## Properties

### pageCount

Number of pages in the PDF.

```typescript
console.log(pdf.pageCount); // 10
```

### pages

Array of Page objects for iteration.

```typescript
for (const page of pdf.pages) {
  console.log(`Page ${page.pageNumber}`);
}
```

### metadata

PDF metadata (async getter).

```typescript
const meta = await pdf.metadata;

console.log(meta.title);
console.log(meta.author);
console.log(meta.subject);
console.log(meta.creator);
console.log(meta.producer);
console.log(meta.creationDate);
console.log(meta.modificationDate);
console.log(meta.pageCount);
console.log(meta.pdfVersion);
console.log(meta.isEncrypted);
```

## Methods

### getPage(index)

Get a specific page by index (0-based).

```typescript
const page = pdf.getPage(0); // First page
const lastPage = pdf.getPage(pdf.pageCount - 1);
```

### extractText()

Extract text from all pages.

```typescript
const allText = await pdf.extractText();
```

### search(pattern, options?)

Search for text across all pages.

```typescript
// String search (literal, safe from ReDoS)
const results = await pdf.search('keyword');

// Regex search (use with caution on user input)
const regexResults = await pdf.search(/pattern/gi);

// Enable regex mode for string (not recommended for user input)
const unsafeResults = await pdf.search(userInput, { literal: false });

for (const result of results) {
  console.log(`Found on page ${result.pageNumber}:`, result.matches);
}
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| literal | `boolean` | `true` | Treat string as literal text (prevents ReDoS) |

### processPages(processor, options?)

Process pages with controlled concurrency.

```typescript
const result = await pdf.processPages(
  async (page) => {
    const text = await page.extractText();
    return { pageNumber: page.pageNumber, length: text.length };
  },
  {
    concurrency: 2,
    onProgress: (done, total) => console.log(`${done}/${total}`)
  }
);

console.log(result.results);
console.log(`Processed: ${result.pagesProcessed}`);
console.log(`Duration: ${result.duration}ms`);
```

**ProcessingOptions:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| concurrency | `number` | 4 | Max parallel pages |
| flushAfterProcess | `boolean` | auto | Free memory after each page |
| onProgress | `function` | - | Progress callback |
| signal | `AbortSignal` | - | For cancellation |
| stopOnError | `boolean` | false | Stop on first error |

### processPagesSequential(processor)

Process pages one at a time (minimum memory).

```typescript
const result = await pdf.processPagesSequential(
  async (page) => await page.extractTables()
);
```

### close()

Close the PDF and free resources.

```typescript
await pdf.close();
```

## Static Methods

### PDFExcavator.isPDFLike(buffer)

Check if data looks like a PDF.

```typescript
const isPdf = PDFExcavator.isPDFLike(buffer); // true/false
```

### PDFExcavator.analyzePDF(buffer)

Analyze PDF structure.

```typescript
const analysis = PDFExcavator.analyzePDF(buffer);
console.log(analysis.version);      // '1.7'
console.log(analysis.encrypted);    // false
console.log(analysis.objectCount);  // 150
console.log(analysis.issues);       // ['Missing %%EOF marker']
```

### PDFExcavator.extractRawText(buffer)

Extract raw text from severely damaged PDFs.

```typescript
const texts = PDFExcavator.extractRawText(buffer);
```

## Example: Complete Workflow

```typescript
import pdfexcavator from 'pdfexcavator';

async function processPDF(filePath: string) {
  const pdf = await pdfexcavator.open(filePath);

  try {
    // Get metadata
    const meta = await pdf.metadata;
    console.log(`Processing: ${meta.title || filePath}`);
    console.log(`Pages: ${pdf.pageCount}`);

    // Process each page
    for (const page of pdf.pages) {
      const text = await page.extractText();
      const tables = await page.extractTables();

      console.log(`Page ${page.pageNumber + 1}:`);
      console.log(`  Text length: ${text.length}`);
      console.log(`  Tables found: ${tables.length}`);
    }
  } finally {
    await pdf.close();
  }
}
```
