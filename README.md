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

## PDFLens vs pdfplumber

| Feature | PDFLens (Node.js) | pdfplumber (Python) |
|---------|-------------------|---------------------|
| **Text Extraction** | ✅ Full support | ✅ Full support |
| **Table Extraction** | ✅ With confidence scoring | ✅ Basic |
| **Borderless Tables** | ✅ Projection profile analysis | ✅ Basic |
| **Nested Tables** | ✅ Supported | ❌ Not supported |
| **Character-level Data** | ✅ With colors, fonts | ✅ Basic |
| **Word Extraction** | ✅ Configurable tolerance | ✅ Basic |
| **Graphics (lines/rects/curves)** | ✅ Full support | ✅ Full support |
| **Image Extraction** | ✅ Metadata + render | ✅ Basic |
| **Annotations** | ✅ Full support | ✅ Basic |
| **OCR Integration** | ✅ Tesseract.js | ⚠️ External only |
| **Layout Analysis (LAParams)** | ✅ Full pdfminer-style | ✅ Full support |
| **Multi-Column Detection** | ✅ Auto-detect & extract | ❌ Manual |
| **CJK Text Support** | ✅ Full CMap support | ✅ Full support |
| **Font Substitution** | ✅ Auto for 14 base fonts | ❌ Not available |
| **Precision Mode** | ✅ Full state tracking | ❌ Not available |
| **Visual Debugging** | ✅ Render + draw annotations | ✅ Similar |
| **PDF Repair** | ✅ Built-in | ❌ Not available |
| **CLI Tool** | ✅ Built-in | ❌ Not built-in |
| **TypeScript Types** | ✅ Full definitions | N/A (Python) |
| **Async/Streaming** | ✅ Native async | ⚠️ Synchronous |
| **Large PDF Handling** | ✅ Concurrent processing | ⚠️ Sequential |

### Why Choose PDFLens?

- **Node.js/TypeScript native** - No Python dependency, seamless JavaScript integration
- **Modern async API** - Non-blocking operations, concurrent page processing
- **Enhanced table detection** - Confidence scoring, nested tables, borderless detection
- **Built-in CLI** - Quick extraction without writing code
- **Active maintenance** - Built on Mozilla's pdf.js

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
