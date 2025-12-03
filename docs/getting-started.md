# Getting Started

This guide will help you get up and running with PDFLens quickly.

## Installation

```bash
npm install pdflens
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
import pdflens from 'pdflens';

// From file path
const pdf = await pdflens.open('document.pdf');

// With password (encrypted PDFs)
const pdf = await pdflens.open('encrypted.pdf', { password: 'secret' });

// From Buffer
import { PDFLens } from 'pdflens';
import fs from 'fs';

const buffer = fs.readFileSync('document.pdf');
const pdf = await PDFLens.fromBuffer(buffer);
```

### Basic Information

```typescript
const pdf = await pdflens.open('document.pdf');

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

```javascript
const pdflens = require('pdflens');

async function main() {
  const pdf = await pdflens.default.open('document.pdf');
  // ... work with PDF
  await pdf.close();
}

main();
```

## CLI Quick Start

```bash
# Install globally
npm install -g pdflens

# Extract text
pdflens text document.pdf

# Extract tables
pdflens tables document.pdf

# Get help
pdflens --help
```

## Next Steps

- [API Reference](./api/pdflens.md) - Detailed API documentation
- [Basic Usage Guide](./guides/basic-usage.md) - Common patterns
- [Examples](./examples/extract-text.md) - Code examples
