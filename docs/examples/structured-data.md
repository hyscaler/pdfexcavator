# Structured Data Extraction Examples

Extract structured data with paragraphs, sentences, and bounding boxes.

## Complete Structured Extraction

```typescript
import pdfexcavator, { clusterObjects } from 'pdfexcavator';

interface BBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Sentence {
  text: string;
  bbox: BBox;
}

interface Paragraph {
  text: string;
  bbox: BBox;
  sentences: Sentence[];
}

interface PageData {
  pageNumber: number;
  content: string;
  bbox: BBox;
  paragraphs: Paragraph[];
}

interface DocumentData {
  metadata: {
    title?: string;
    author?: string;
    pageCount: number;
  };
  pages: PageData[];
  fullText: string;
}

async function extractStructuredDocument(pdfPath: string): Promise<DocumentData> {
  const pdf = await pdfexcavator.open(pdfPath);
  const meta = await pdf.metadata;

  const result: DocumentData = {
    metadata: {
      title: meta.title,
      author: meta.author,
      pageCount: meta.pageCount
    },
    pages: [],
    fullText: ''
  };

  const allTexts: string[] = [];

  for (const page of pdf.pages) {
    const pageData = await extractPageStructure(page);
    result.pages.push(pageData);
    allTexts.push(pageData.content);
  }

  result.fullText = allTexts.join('\n\n');
  await pdf.close();
  return result;
}

async function extractPageStructure(page): Promise<PageData> {
  const words = await page.extractWords();

  if (!words.length) {
    return {
      pageNumber: page.pageNumber + 1,
      content: '',
      bbox: { x0: 0, y0: 0, x1: 0, y1: 0 },
      paragraphs: []
    };
  }

  // Group into lines
  const lineGroups = clusterObjects(words, w => w.y0, 3);
  const lines = lineGroups.map(lineWords => {
    lineWords.sort((a, b) => a.x0 - b.x0);
    return {
      text: lineWords.map(w => w.text).join(' '),
      words: lineWords,
      bbox: computeBBox(lineWords)
    };
  });

  // Sort top to bottom
  lines.sort((a, b) => a.bbox.y0 - b.bbox.y0);

  // Filter headers/footers
  const contentLines = lines.filter(line =>
    !isHeaderOrFooter(line, page.height)
  );

  // Group into paragraphs
  const paragraphs = groupIntoParagraphs(contentLines);

  // Build page content
  const content = paragraphs.map(p => p.text).join('\n\n');
  const pageBBox = computeBBox(contentLines.flatMap(l => l.words));

  return {
    pageNumber: page.pageNumber + 1,
    content,
    bbox: pageBBox,
    paragraphs
  };
}

function computeBBox(objects: { x0: number; y0: number; x1: number; y1: number }[]): BBox {
  if (!objects.length) return { x0: 0, y0: 0, x1: 0, y1: 0 };

  return {
    x0: Math.min(...objects.map(o => o.x0)),
    y0: Math.min(...objects.map(o => o.y0)),
    x1: Math.max(...objects.map(o => o.x1)),
    y1: Math.max(...objects.map(o => o.y1))
  };
}

function isHeaderOrFooter(line, pageHeight: number): boolean {
  const y = line.bbox.y0;
  const text = line.text.toLowerCase();

  // Position check
  const inHeader = y < pageHeight * 0.08;
  const inFooter = y > pageHeight * 0.92;

  if (!inHeader && !inFooter) return false;

  // Content patterns
  const patterns = [
    /^page\s+\d+/i,
    /confidential/i,
    /^[-_=]{5,}$/
  ];

  return patterns.some(p => p.test(text));
}

function groupIntoParagraphs(lines): Paragraph[] {
  if (!lines.length) return [];

  const paragraphs: Paragraph[] = [];
  let currentLines = [lines[0]];
  const GAP_THRESHOLD = 15;

  for (let i = 1; i < lines.length; i++) {
    const prevLine = lines[i - 1];
    const currLine = lines[i];
    const gap = currLine.bbox.y0 - prevLine.bbox.y1;

    if (gap > GAP_THRESHOLD) {
      paragraphs.push(createParagraph(currentLines));
      currentLines = [currLine];
    } else {
      currentLines.push(currLine);
    }
  }

  if (currentLines.length) {
    paragraphs.push(createParagraph(currentLines));
  }

  return paragraphs;
}

function createParagraph(lines): Paragraph {
  const text = lines.map(l => l.text).join(' ');
  const bbox = computeBBox(lines.flatMap(l => l.words));
  const sentences = extractSentences(lines);

  return { text, bbox, sentences };
}

function extractSentences(lines): Sentence[] {
  const sentences: Sentence[] = [];
  let currentWords = [];
  let currentText = '';

  for (const line of lines) {
    currentWords.push(...line.words);
    currentText += (currentText ? ' ' : '') + line.text;

    if (/[.!?]$/.test(line.text)) {
      sentences.push({
        text: currentText.trim(),
        bbox: computeBBox(currentWords)
      });
      currentWords = [];
      currentText = '';
    }
  }

  if (currentText.trim()) {
    sentences.push({
      text: currentText.trim(),
      bbox: computeBBox(currentWords)
    });
  }

  return sentences;
}
```

## Usage

```typescript
const data = await extractStructuredDocument('document.pdf');

// Output to JSON
console.log(JSON.stringify(data, null, 2));

// Access specific data
console.log('Title:', data.metadata.title);
console.log('Pages:', data.metadata.pageCount);

for (const page of data.pages) {
  console.log(`\nPage ${page.pageNumber}:`);
  console.log(`  Paragraphs: ${page.paragraphs.length}`);

  for (const para of page.paragraphs) {
    console.log(`  - ${para.sentences.length} sentences`);
  }
}
```

## Output Format

```json
{
  "metadata": {
    "title": "Document Title",
    "author": "Author Name",
    "pageCount": 10
  },
  "pages": [
    {
      "pageNumber": 1,
      "content": "Full page text...",
      "bbox": { "x0": 50, "y0": 100, "x1": 550, "y1": 750 },
      "paragraphs": [
        {
          "text": "First paragraph text...",
          "bbox": { "x0": 50, "y0": 100, "x1": 550, "y1": 150 },
          "sentences": [
            {
              "text": "First sentence.",
              "bbox": { "x0": 50, "y0": 100, "x1": 200, "y1": 120 }
            },
            {
              "text": "Second sentence.",
              "bbox": { "x0": 210, "y0": 100, "x1": 400, "y1": 120 }
            }
          ]
        }
      ]
    }
  ],
  "fullText": "All text from document..."
}
```

## Extract Sections by Heading

```typescript
interface Section {
  heading: string;
  content: string;
  level: number;
  bbox: BBox;
}

async function extractSections(pdfPath: string): Promise<Section[]> {
  const pdf = await pdfexcavator.open(pdfPath);
  const sections: Section[] = [];

  for (const page of pdf.pages) {
    const words = await page.extractWords();
    const lineGroups = clusterObjects(words, w => w.y0, 3);

    for (const lineWords of lineGroups) {
      lineWords.sort((a, b) => a.x0 - b.x0);
      const text = lineWords.map(w => w.text).join(' ');
      const avgSize = lineWords.reduce((s, w) => s + (w.chars?.[0]?.size || 12), 0) / lineWords.length;

      // Detect headings by size
      if (avgSize > 14) {
        sections.push({
          heading: text,
          content: '',
          level: avgSize > 18 ? 1 : 2,
          bbox: computeBBox(lineWords)
        });
      } else if (sections.length > 0) {
        // Add to last section content
        sections[sections.length - 1].content += text + ' ';
      }
    }
  }

  await pdf.close();
  return sections;
}
```

## Extract Key-Value Pairs

```typescript
interface KeyValue {
  key: string;
  value: string;
  bbox: BBox;
}

async function extractKeyValuePairs(pdfPath: string): Promise<KeyValue[]> {
  const pdf = await pdfexcavator.open(pdfPath);
  const pairs: KeyValue[] = [];

  for (const page of pdf.pages) {
    const words = await page.extractWords();
    const lines = clusterObjects(words, w => w.y0, 3);

    for (const lineWords of lines) {
      lineWords.sort((a, b) => a.x0 - b.x0);
      const text = lineWords.map(w => w.text).join(' ');

      // Look for "Key: Value" pattern
      const match = text.match(/^(.+?):\s*(.+)$/);
      if (match) {
        pairs.push({
          key: match[1].trim(),
          value: match[2].trim(),
          bbox: computeBBox(lineWords)
        });
      }
    }
  }

  await pdf.close();
  return pairs;
}

// Usage
const pairs = await extractKeyValuePairs('form.pdf');
// [{ key: 'Name', value: 'John Doe' }, { key: 'Date', value: '2024-01-15' }]
```

## Extract with Coordinates for Annotation

```typescript
interface AnnotatedText {
  text: string;
  page: number;
  bbox: BBox;
  type: 'heading' | 'paragraph' | 'list-item';
}

async function extractForAnnotation(pdfPath: string): Promise<AnnotatedText[]> {
  const pdf = await pdfexcavator.open(pdfPath);
  const annotations: AnnotatedText[] = [];

  for (const page of pdf.pages) {
    const words = await page.extractWords();
    const lines = clusterObjects(words, w => w.y0, 3);

    for (const lineWords of lines) {
      lineWords.sort((a, b) => a.x0 - b.x0);
      const text = lineWords.map(w => w.text).join(' ');
      const bbox = computeBBox(lineWords);

      // Classify content
      let type: 'heading' | 'paragraph' | 'list-item' = 'paragraph';

      const avgSize = lineWords.reduce((s, w) => s + (w.chars?.[0]?.size || 12), 0) / lineWords.length;
      if (avgSize > 14) {
        type = 'heading';
      } else if (/^[•\-\*\d+\.]\s/.test(text)) {
        type = 'list-item';
      }

      annotations.push({
        text,
        page: page.pageNumber + 1,
        bbox,
        type
      });
    }
  }

  await pdf.close();
  return annotations;
}
```
