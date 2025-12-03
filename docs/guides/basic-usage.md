# Basic Usage Guide

Common patterns and use cases for PDFLens.

## Opening PDFs

### From File Path

```typescript
import pdflens from 'pdflens';

const pdf = await pdflens.open('document.pdf');
// ... work with PDF
await pdf.close();
```

### From Buffer

```typescript
import { PDFLens } from 'pdflens';
import fs from 'fs';

const buffer = fs.readFileSync('document.pdf');
const pdf = await PDFLens.fromBuffer(buffer);
```

### From URL (fetch first)

```typescript
const response = await fetch('https://example.com/document.pdf');
const buffer = Buffer.from(await response.arrayBuffer());
const pdf = await PDFLens.fromBuffer(buffer);
```

### Encrypted PDFs

```typescript
const pdf = await pdflens.open('encrypted.pdf', {
  password: 'secret123'
});
```

## Extracting Text

### Basic Text Extraction

```typescript
const pdf = await pdflens.open('document.pdf');

for (const page of pdf.pages) {
  const text = await page.extractText();
  console.log(`Page ${page.pageNumber + 1}:`);
  console.log(text);
  console.log('---');
}

await pdf.close();
```

### With Layout Preservation

```typescript
const text = await page.extractText({ layout: true });
```

### Get All Text at Once

```typescript
const allText = await pdf.extractText();
```

### Get Words with Positions

```typescript
const words = await page.extractWords();

for (const word of words) {
  console.log(`"${word.text}" at (${word.x0}, ${word.y0})`);
}
```

## Extracting Tables

### Basic Table Extraction

```typescript
for (const page of pdf.pages) {
  const tables = await page.extractTables();

  tables.forEach((table, i) => {
    console.log(`Table ${i + 1}:`);
    for (const row of table.rows) {
      console.log(row.join(' | '));
    }
  });
}
```

### Convert Table to Objects

```typescript
function tableToObjects(table) {
  const [headers, ...rows] = table.rows;
  return rows.map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i] || '');
    return obj;
  });
}

const tables = await page.extractTables();
const data = tableToObjects(tables[0]);
// [{ Name: 'John', Age: '30' }, ...]
```

## Getting Metadata

```typescript
const pdf = await pdflens.open('document.pdf');
const meta = await pdf.metadata;

console.log('Title:', meta.title);
console.log('Author:', meta.author);
console.log('Pages:', meta.pageCount);
console.log('PDF Version:', meta.pdfVersion);
console.log('Encrypted:', meta.isEncrypted);
```

## Searching

### Search Single Page

```typescript
const matches = await page.search('keyword');
console.log(`Found ${matches.length} matches`);
```

### Search Entire PDF

```typescript
const results = await pdf.search('important');

for (const result of results) {
  console.log(`Page ${result.pageNumber}: ${result.matches.length} matches`);
}
```

### Regex Search

```typescript
const results = await pdf.search(/\d{3}-\d{3}-\d{4}/g); // Phone numbers
```

## Working with Regions

### Crop to Area

```typescript
// Extract text from specific region [x0, y0, x1, y1]
const cropped = page.crop([100, 100, 400, 400]);
const text = await cropped.extractText();
```

### Filter by Position

```typescript
// Get content in top half of page
const topHalf = page.withinBBox([0, 0, page.width, page.height / 2]);
const text = await topHalf.extractText();
```

### Filter by Properties

```typescript
// Get only large text
const largeText = page.filter(obj => obj.size > 14);

// Get bold text
const boldText = page.filter(obj => obj.fontName?.includes('Bold'));
```

## Processing Large PDFs

### With Progress Tracking

```typescript
const result = await pdf.processPages(
  async (page) => {
    const text = await page.extractText();
    return text.length;
  },
  {
    concurrency: 2,
    onProgress: (done, total) => {
      console.log(`Progress: ${done}/${total}`);
    }
  }
);

console.log('Character counts:', result.results);
```

### Sequential Processing (Low Memory)

```typescript
const result = await pdf.processPagesSequential(async (page) => {
  const text = await page.extractText();
  // Process immediately, don't store
  await saveToDatabase(page.pageNumber, text);
  return true;
});
```

## Error Handling

```typescript
import pdflens from 'pdflens';

async function safePDFOpen(path) {
  try {
    const pdf = await pdflens.open(path);
    return pdf;
  } catch (error) {
    if (error.message.includes('password')) {
      console.error('PDF is encrypted');
    } else if (error.message.includes('Invalid PDF')) {
      console.error('File is not a valid PDF');
    } else {
      console.error('Error opening PDF:', error.message);
    }
    return null;
  }
}
```

## Best Practices

### Always Close PDFs

```typescript
const pdf = await pdflens.open('document.pdf');
try {
  // ... work with PDF
} finally {
  await pdf.close();
}
```

### Use Appropriate Extraction Method

```typescript
// For normal PDFs
const text = await page.extractText();

// For OCR'd/scanned PDFs
const text = await page.extractTextRaw();

// For scanned images (no text layer)
const text = await page.extractTextWithOCR();
```

### Handle Empty Results

```typescript
const tables = await page.extractTables();
if (tables.length === 0) {
  console.log('No tables found on this page');
}

const text = await page.extractText();
if (!text.trim()) {
  console.log('No text on this page');
}
```
