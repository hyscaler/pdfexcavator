# Text Extraction Examples

Code examples for extracting text from PDFs.

## Basic Text Extraction

```typescript
import pdflens from 'pdflens';

async function extractAllText(pdfPath: string): Promise<string> {
  const pdf = await pdflens.open(pdfPath);
  const texts: string[] = [];

  for (const page of pdf.pages) {
    const text = await page.extractText();
    texts.push(text);
  }

  await pdf.close();
  return texts.join('\n\n');
}

// Usage
const text = await extractAllText('document.pdf');
console.log(text);
```

## Extract with Page Numbers

```typescript
async function extractWithPageNumbers(pdfPath: string) {
  const pdf = await pdflens.open(pdfPath);
  const result: { page: number; text: string }[] = [];

  for (const page of pdf.pages) {
    result.push({
      page: page.pageNumber + 1,
      text: await page.extractText()
    });
  }

  await pdf.close();
  return result;
}
```

## Extract Specific Pages

```typescript
async function extractPages(pdfPath: string, pageNumbers: number[]) {
  const pdf = await pdflens.open(pdfPath);
  const texts: string[] = [];

  for (const pageNum of pageNumbers) {
    const page = pdf.getPage(pageNum - 1); // 0-indexed
    texts.push(await page.extractText());
  }

  await pdf.close();
  return texts;
}

// Usage
const texts = await extractPages('document.pdf', [1, 3, 5]);
```

## Extract with Layout

```typescript
async function extractWithLayout(pdfPath: string) {
  const pdf = await pdflens.open(pdfPath);

  for (const page of pdf.pages) {
    // Preserves visual layout with spacing
    const text = await page.extractText({ layout: true });
    console.log(text);
  }

  await pdf.close();
}
```

## Extract Words with Positions

```typescript
async function extractWordsWithPositions(pdfPath: string) {
  const pdf = await pdflens.open(pdfPath);
  const page = pdf.pages[0];

  const words = await page.extractWords();

  for (const word of words) {
    console.log({
      text: word.text,
      position: { x: word.x0, y: word.y0 },
      size: { width: word.x1 - word.x0, height: word.y1 - word.y0 }
    });
  }

  await pdf.close();
}
```

## Extract from Region

```typescript
async function extractRegion(pdfPath: string, bbox: [number, number, number, number]) {
  const pdf = await pdflens.open(pdfPath);
  const page = pdf.pages[0];

  // Crop to region [x0, y0, x1, y1]
  const region = page.crop(bbox);
  const text = await region.extractText();

  await pdf.close();
  return text;
}

// Extract from top-left quadrant
const text = await extractRegion('document.pdf', [0, 0, 300, 400]);
```

## Extract by Font Size

```typescript
async function extractLargeText(pdfPath: string, minSize: number = 14) {
  const pdf = await pdflens.open(pdfPath);
  const page = pdf.pages[0];

  // Filter to only large text
  const filtered = page.filter(obj => obj.size >= minSize);
  const text = await filtered.extractText();

  await pdf.close();
  return text;
}

// Get headers (large text)
const headers = await extractLargeText('document.pdf', 16);
```

## Extract for OCR'd Documents

```typescript
async function extractOCRDocument(pdfPath: string) {
  const pdf = await pdflens.open(pdfPath);
  const texts: string[] = [];

  for (const page of pdf.pages) {
    // Use raw extraction for OCR'd docs
    const text = await page.extractTextRaw();
    texts.push(text);
  }

  await pdf.close();
  return texts.join('\n\n');
}
```

## Search and Extract Context

```typescript
async function searchWithContext(pdfPath: string, query: string, contextChars = 50) {
  const pdf = await pdflens.open(pdfPath);
  const results: { page: number; context: string }[] = [];

  for (const page of pdf.pages) {
    const text = await page.extractText();
    let index = text.toLowerCase().indexOf(query.toLowerCase());

    while (index !== -1) {
      const start = Math.max(0, index - contextChars);
      const end = Math.min(text.length, index + query.length + contextChars);
      const context = text.substring(start, end);

      results.push({
        page: page.pageNumber + 1,
        context: `...${context}...`
      });

      index = text.toLowerCase().indexOf(query.toLowerCase(), index + 1);
    }
  }

  await pdf.close();
  return results;
}
```

## Extract to JSON

```typescript
async function extractToJSON(pdfPath: string) {
  const pdf = await pdflens.open(pdfPath);
  const meta = await pdf.metadata;

  const result = {
    metadata: {
      title: meta.title,
      author: meta.author,
      pageCount: meta.pageCount
    },
    pages: [] as { number: number; text: string; wordCount: number }[]
  };

  for (const page of pdf.pages) {
    const text = await page.extractText();
    result.pages.push({
      number: page.pageNumber + 1,
      text,
      wordCount: text.split(/\s+/).filter(w => w).length
    });
  }

  await pdf.close();
  return result;
}

// Usage
const data = await extractToJSON('document.pdf');
console.log(JSON.stringify(data, null, 2));
```

## Batch Processing

```typescript
import fs from 'fs';
import path from 'path';

async function batchExtract(directory: string) {
  const files = fs.readdirSync(directory).filter(f => f.endsWith('.pdf'));

  for (const file of files) {
    const pdfPath = path.join(directory, file);
    const outputPath = path.join(directory, file.replace('.pdf', '.txt'));

    try {
      const pdf = await pdflens.open(pdfPath);
      const text = await pdf.extractText();
      fs.writeFileSync(outputPath, text);
      await pdf.close();
      console.log(`Extracted: ${file}`);
    } catch (error) {
      console.error(`Failed: ${file} - ${error.message}`);
    }
  }
}
```

## Extract with Progress

```typescript
async function extractWithProgress(pdfPath: string) {
  const pdf = await pdflens.open(pdfPath);

  const result = await pdf.processPages(
    async (page) => {
      return page.extractText();
    },
    {
      concurrency: 2,
      onProgress: (done, total) => {
        const percent = Math.round((done / total) * 100);
        process.stdout.write(`\rProgress: ${percent}%`);
      }
    }
  );

  console.log('\nDone!');
  await pdf.close();
  return result.results.join('\n\n');
}
```
