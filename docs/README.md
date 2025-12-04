# PDFExcavator Documentation

A powerful PDF extraction library for Node.js built on Mozilla's pdf.js.

## Quick Navigation

### Getting Started
- [Installation & Quick Start](./getting-started.md)

### API Reference
- [PDFExcavator Class](./api/pdfexcavator.md) - Opening and managing PDFs
- [Page Class](./api/page.md) - Working with individual pages
- [Text Extraction](./api/text-extraction.md) - Extracting text content
- [Table Extraction](./api/table-extraction.md) - Extracting tables
- [OCR Integration](./api/ocr.md) - Working with scanned documents
- [Utilities](./api/utilities.md) - Helper functions

### Guides
- [Basic Usage](./guides/basic-usage.md) - Common use cases
- [OCR Documents](./guides/ocr-documents.md) - Scanned PDF handling
- [Multi-Column Layouts](./guides/multi-column.md) - Complex layouts
- [Table Extraction](./guides/tables.md) - Table detection strategies
- [Post-Processing](./guides/post-processing.md) - Text cleaning & structuring
- [CLI Tool](./guides/cli.md) - Command-line interface

### Examples
- [Text Extraction](./examples/extract-text.md) - Text extraction examples
- [Table Extraction](./examples/extract-tables.md) - Table examples
- [Structured Data](./examples/structured-data.md) - Structured extraction

### Advanced Topics
- [Precision Mode](./advanced/precision-mode.md) - Exact character positioning
- [Layout Analysis](./advanced/layout-analysis.md) - LAParams & layout control
- [Font Handling](./advanced/fonts.md) - Fonts & substitution
- [Performance](./advanced/performance.md) - Large PDF optimization

## Features Overview

| Feature | Description |
|---------|-------------|
| Text Extraction | Character, word, line, and paragraph level |
| Table Extraction | Bordered and borderless tables |
| OCR Support | Tesseract.js integration for scanned docs |
| Multi-Column | Column detection and reading order |
| CJK Support | Chinese, Japanese, Korean text |
| CLI Tool | Command-line extraction |
| TypeScript | Full type definitions |

## Installation

```bash
npm install pdfexcavator
```

## Basic Example

```typescript
import pdfexcavator from 'pdfexcavator';

const pdf = await pdfexcavator.open('document.pdf');

for (const page of pdf.pages) {
  const text = await page.extractText();
  console.log(text);
}

await pdf.close();
```

## Links

- [GitHub Repository](https://github.com/nicobrinkkemper/pdfexcavator)
- [npm Package](https://www.npmjs.com/package/pdfexcavator)
- [Issue Tracker](https://github.com/nicobrinkkemper/pdfexcavator/issues)
