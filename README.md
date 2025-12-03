# PDFLens

A powerful PDF extraction library for Node.js built on Mozilla's pdf.js.

**The JavaScript/TypeScript alternative to Python's [pdfplumber](https://github.com/jsvine/pdfplumber)** - extract text, tables, graphics, and visual elements from PDF files with precision.

If you're coming from Python and looking for pdfplumber-like functionality in Node.js, PDFLens is your drop-in solution with similar APIs and capabilities.

## Features

- **Text Extraction** - Character, word, line, and paragraph level with positions, fonts, colors
- **Table Extraction** - Bordered and borderless tables with confidence scoring
- **Graphics Extraction** - Lines, rectangles, curves, images, annotations
- **OCR Support** - Tesseract.js integration for scanned documents
- **Layout Analysis** - LAParams for precise text grouping
- **Multi-Column** - Column detection and reading order
- **CJK Support** - Chinese, Japanese, Korean text
- **Font Handling** - Automatic substitution for PDF base fonts
- **CLI Tool** - Command-line extraction
- **TypeScript** - Full type definitions

## Installation

```bash
npm install pdflens
```

### Optional Dependencies

```bash
# For rendering pages to images
npm install canvas

# For OCR support (scanned documents)
npm install tesseract.js
```

## Quick Start

```typescript
import pdflens from 'pdflens';

// Open a PDF
const pdf = await pdflens.open('document.pdf');

// Get metadata
const metadata = await pdf.metadata;
console.log(`Title: ${metadata.title}`);
console.log(`Pages: ${metadata.pageCount}`);

// Extract text from each page
for (const page of pdf.pages) {
  const text = await page.extractText();
  console.log(text);
}

// Extract tables
for (const page of pdf.pages) {
  const tables = await page.extractTables();
  for (const table of tables) {
    console.log(table.rows);
  }
}

// Close when done
await pdf.close();
```

## CLI

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

## Documentation

For detailed API reference and guides, see the [**Documentation**](./docs/README.md):

- [Getting Started](./docs/getting-started.md)
- [API Reference](./docs/api/pdflens.md)
- [Text Extraction](./docs/api/text-extraction.md)
- [Table Extraction](./docs/api/table-extraction.md)
- [OCR Integration](./docs/api/ocr.md)
- [Guides & Examples](./docs/guides/basic-usage.md)
- [Advanced Topics](./docs/advanced/performance.md)

## Requirements

- Node.js >= 18.0.0

## License

MIT
