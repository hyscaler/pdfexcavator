# Working with OCR'd Documents

Guide for handling scanned PDFs and OCR'd documents.

## Types of PDFs

### Digital PDFs
Created by software (Word, LaTeX, etc.). Text is embedded and extraction is straightforward.

### Scanned PDFs
Images of paper documents. No text layer - requires OCR.

### OCR'd PDFs
Scanned documents that have been processed with OCR. Have a text layer but may have quality issues.

## Detecting Document Type

```typescript
import pdfexcavator from 'pdfexcavator';

const pdf = await pdfexcavator.open('document.pdf');
const page = pdf.pages[0];

// Check if page is scanned (image only)
const isScanned = await page.isScannedPage();

// Check if OCR is needed
const needsOcr = await page.needsOCR();

if (isScanned && needsOcr) {
  console.log('Scanned page - needs OCR');
} else if (isScanned && !needsOcr) {
  console.log('OCR\'d page - has text layer');
} else {
  console.log('Digital PDF');
}
```

## Extracting from OCR'd PDFs

OCR'd PDFs often have character positioning issues. Use `extractTextRaw()`:

```typescript
// Standard extraction may scramble text
const badText = await page.extractText();
// Result: "T h i s   i s   s c r a m b l e d"

// Raw extraction preserves PDF order
const goodText = await page.extractTextRaw();
// Result: "This is correct text"
```

### Why This Happens

OCR software places characters at exact visual positions. When PDFExcavator tries to sort by position, overlapping coordinates cause scrambling. `extractTextRaw()` preserves the original order.

## Performing OCR

For scanned pages without text:

### Setup

```bash
npm install tesseract.js
```

### Basic OCR

```typescript
import { isTesseractAvailable } from 'pdfexcavator';

// Check if OCR is available
const available = await isTesseractAvailable();
if (!available) {
  throw new Error('Install tesseract.js for OCR');
}

// Perform OCR
const result = await page.performOCR({ lang: 'eng' });
console.log(result.text);
console.log(`Confidence: ${result.confidence}%`);
```

### Automatic OCR Fallback

```typescript
// Uses OCR if needed, otherwise normal extraction
const text = await page.extractTextWithOCR();
```

### Multiple Languages

```typescript
// OCR with multiple languages
const result = await page.performOCR({
  lang: 'eng+fra+deu'  // English, French, German
});
```

## Processing Mixed Documents

Some PDFs have both digital and scanned pages:

```typescript
async function extractMixedPDF(pdfPath) {
  const pdf = await pdfexcavator.open(pdfPath);
  const results = [];

  for (const page of pdf.pages) {
    const needsOcr = await page.needsOCR();

    let text;
    if (needsOcr) {
      // Scanned page
      const ocrResult = await page.performOCR({ lang: 'eng' });
      text = ocrResult.text;
      console.log(`Page ${page.pageNumber + 1}: OCR (${ocrResult.confidence}%)`);
    } else {
      // Try raw extraction first (for OCR'd pages)
      text = await page.extractTextRaw();

      // Fall back to standard if raw is empty
      if (!text.trim()) {
        text = await page.extractText();
      }
      console.log(`Page ${page.pageNumber + 1}: Text extraction`);
    }

    results.push(text);
  }

  await pdf.close();
  return results;
}
```

## Handling OCR Quality Issues

### Character Substitution

OCR often confuses similar characters:

```typescript
import { correctText } from 'pdfexcavator';

const ocrText = await page.extractTextRaw();

// Fix common OCR errors
const fixed = correctText(ocrText, {
  numbersToLetters: true,  // 0→o, 1→l, 3→e
  ligatures: true,         // ﬁ→fi
  whitespace: true         // Fix spacing
});
```

### Low Confidence Handling

```typescript
const result = await page.performOCR({ lang: 'eng' });

if (result.confidence < 70) {
  console.warn('Low OCR quality - consider manual review');

  // Try different settings
  const retry = await page.performOCR({
    lang: 'eng',
    psm: 6  // Assume uniform text block
  });

  if (retry.confidence > result.confidence) {
    return retry.text;
  }
}

return result.text;
```

## Multi-Column OCR'd Documents

OCR'd multi-column documents are tricky:

```typescript
// For multi-column OCR'd PDFs
const text = await page.extractTextRaw({
  detectLineBreaks: true,
  lineBreakThreshold: 10,  // Adjust based on document
  addSpaces: true,
  spaceThreshold: 15
});
```

## Best Practices

### 1. Detect Before Processing

```typescript
const needsOcr = await page.needsOCR();
const method = needsOcr ? 'OCR' : 'extraction';
```

### 2. Use Appropriate Method

| PDF Type | Method |
|----------|--------|
| Digital | `extractText()` |
| OCR'd | `extractTextRaw()` |
| Scanned | `performOCR()` |
| Unknown | `extractTextWithOCR()` |

### 3. Clean Up OCR Results

```typescript
import { autoCorrectText } from 'pdfexcavator';

const raw = await page.extractTextRaw();
const clean = autoCorrectText(raw);
```

### 4. Handle Errors Gracefully

```typescript
try {
  const result = await page.performOCR({ lang: 'eng' });
  return result.text;
} catch (error) {
  console.error('OCR failed:', error.message);
  // Fall back to image extraction or skip
  return null;
}
```

### 5. Clean Up Resources

```typescript
import { terminateOCR } from 'pdfexcavator';

// After all OCR is complete
await terminateOCR();
```
