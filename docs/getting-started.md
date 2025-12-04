# Getting Started

This guide will help you get up and running with PDFExcavator quickly.

## Installation

```bash
npm install pdfexcavator
```

### Optional Dependencies

For rendering pages to images:
```bash
npm install canvas
```

For OCR support (scanned documents):
```bash
npm install tesseract.js
```

## Requirements

- Node.js >= 18.0.0
- TypeScript (optional, but recommended)

## Quick Start

### Opening a PDF

```typescript
import pdfexcavator from 'pdfexcavator';

// From file path
const pdf = await pdfexcavator.open('document.pdf');

// With password (encrypted PDFs)
const pdf = await pdfexcavator.open('encrypted.pdf', { password: 'secret' });

// From Buffer
import { PDFExcavator } from 'pdfexcavator';
import fs from 'fs';

const buffer = fs.readFileSync('document.pdf');
const pdf = await PDFExcavator.fromBuffer(buffer);
```

### Basic Information

```typescript
const pdf = await pdfexcavator.open('document.pdf');

console.log('Page count:', pdf.pageCount);

const metadata = await pdf.metadata;
console.log('Title:', metadata.title);
console.log('Author:', metadata.author);
```

### Extracting Text

```typescript
// From a single page
const page = pdf.pages[0];
const text = await page.extractText();
console.log(text);

// From all pages
for (const page of pdf.pages) {
  console.log(`--- Page ${page.pageNumber + 1} ---`);
  console.log(await page.extractText());
}

// From entire PDF at once
const allText = await pdf.extractText();
```

### Extracting Tables

```typescript
for (const page of pdf.pages) {
  const tables = await page.extractTables();

  for (const table of tables) {
    console.log('Table found:');
    for (const row of table.rows) {
      console.log(row.join(' | '));
    }
  }
}
```

### Closing the PDF

Always close the PDF when done to free resources:

```typescript
await pdf.close();
```

## CommonJS Usage

PDFExcavator is an ESM-only package. To use it in CommonJS projects, use dynamic import:

```javascript
async function main() {
  const { default: pdfexcavator } = await import('pdfexcavator');
  const pdf = await pdfexcavator.open('document.pdf');
  // ... work with PDF
  await pdf.close();
}

main();
```

Alternatively, rename your file to `.mjs` or set `"type": "module"` in your `package.json`.

## CLI Quick Start

```bash
# Install globally
npm install -g pdfexcavator

# Extract text
pdfexcavator text document.pdf

# Extract tables
pdfexcavator tables document.pdf

# Get help
pdfexcavator --help
```

## Security Considerations

When processing user-uploaded PDFs, use the `basePath` option to prevent path traversal attacks:

```typescript
// Restrict file access to uploads directory
const pdf = await pdfexcavator.open(userProvidedPath, {
  basePath: '/app/uploads'
});
```

The `search()` method is safe by default - string patterns are escaped to prevent ReDoS attacks:

```typescript
// Safe - user input is escaped
const results = await page.search(userInput);
```

## Next Steps

- [API Reference](./api/pdfexcavator.md) - Detailed API documentation
- [Basic Usage Guide](./guides/basic-usage.md) - Common patterns
- [Examples](./examples/extract-text.md) - Code examples
