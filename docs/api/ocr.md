# OCR Integration API

PDFExcavator integrates with Tesseract.js for OCR support on scanned documents.

## Installation

```bash
npm install tesseract.js
```

## Page Methods

### needsOCR()

Check if a page needs OCR (has images but no/little text).

```typescript
const needsOcr = await page.needsOCR();
if (needsOcr) {
  console.log('This page needs OCR');
}
```

### isScannedPage()

Check if page appears to be scanned.

```typescript
const isScanned = await page.isScannedPage();
```

### performOCR(options?)

Perform OCR on the page.

```typescript
const result = await page.performOCR({
  lang: 'eng',           // Language code
  psm: PSM_MODES.AUTO,   // Page segmentation mode
  oem: OEM_MODES.DEFAULT // OCR engine mode
});

console.log(result.text);
console.log(result.confidence);
console.log(result.words);       // Word-level results
console.log(result.lines);       // Line-level results
```

### extractTextWithOCR()

Extract text with automatic OCR fallback.

```typescript
// Uses OCR if page needs it, otherwise normal extraction
const text = await page.extractTextWithOCR();
```

## OCR Functions

### isTesseractAvailable()

Check if Tesseract.js is installed.

```typescript
import { isTesseractAvailable } from 'pdfexcavator';

const available = await isTesseractAvailable();
if (!available) {
  console.log('Install tesseract.js for OCR support');
}
```

### performOCR(imageBuffer, pageNumber, pageHeight, doctopOffset, options?)

Perform OCR on an image buffer.

```typescript
import { performOCR } from 'pdfexcavator';

const result = await performOCR(
  imageBuffer,
  0,              // pageNumber
  792,            // pageHeight
  0,              // doctopOffset
  {
    lang: 'eng+fra',  // Multiple languages
    psm: 3
  }
);
```

### needsOCR(charCount, imageCount, pageArea, imageArea)

Check if content needs OCR based on character and image metrics.

```typescript
import { needsOCR } from 'pdfexcavator';

const chars = await page.chars;
const images = await page.getImages();
const { width, height } = await page.size;
const pageArea = width * height;
const imageArea = images.reduce((sum, img) => sum + img.width * img.height, 0);

const needs = needsOCR(chars.length, images.length, pageArea, imageArea);
```

### isLikelyScanned(charCount, images, pageWidth, pageHeight)

Check if a page is likely a scanned document.

```typescript
import { isLikelyScanned } from 'pdfexcavator';

const chars = await page.chars;
const images = await page.getImages();
const { width, height } = await page.size;

const isScanned = isLikelyScanned(chars.length, images, width, height);
```

### terminateOCR()

Clean up Tesseract workers.

```typescript
import { terminateOCR } from 'pdfexcavator';

// When done with OCR
await terminateOCR();
```

## OCREngine Class

Advanced OCR control.

```typescript
import { OCREngine } from 'pdfexcavator';

const engine = new OCREngine({
  lang: 'eng+jpn',
  psm: PSM_MODES.SINGLE_BLOCK
});

const available = await engine.isAvailable();
if (available) {
  const result = await engine.recognize(imageBuffer);
  console.log(result.text);
}
```

## OCR Options

### OCROptions

```typescript
interface OCROptions {
  lang?: string;                        // Language code(s) (default: 'eng')
  oem?: number;                         // OCR Engine Mode (0=Legacy, 1=LSTM, 2=Legacy+LSTM, 3=Default)
  psm?: number;                         // Page segmentation mode
  tesseractParams?: Record<string, string>;  // Custom tesseract parameters
  minConfidence?: number;               // Minimum confidence to include a word (0-100, default: 60)
  preserveWhitespace?: boolean;         // Whether to preserve whitespace
  workerCount?: number;                 // Worker pool size for parallel processing
  langPath?: string;                    // Path to trained data files (for Node.js)
  logger?: (message: string) => void;   // Whether to log progress
}
```

### OCRResult

```typescript
interface OCRResult {
  text: string;           // Full extracted text
  chars: PDFChar[];       // Extracted characters with positions
  words: PDFWord[];       // Extracted words with positions
  lines: PDFTextLine[];   // Extracted lines with positions
  confidence: number;     // Average confidence (0-100)
  processingTime: number; // Time taken in ms
  ocrPerformed: boolean;  // Whether OCR was actually performed
}
```

## Language Codes

Common language codes:

```typescript
import { OCR_LANGUAGES } from 'pdfexcavator';

console.log(OCR_LANGUAGES);
// {
//   eng: 'English',
//   fra: 'French',
//   deu: 'German',
//   spa: 'Spanish',
//   ita: 'Italian',
//   por: 'Portuguese',
//   rus: 'Russian',
//   jpn: 'Japanese',
//   chi_sim: 'Chinese (Simplified)',
//   chi_tra: 'Chinese (Traditional)',
//   kor: 'Korean',
//   ara: 'Arabic',
//   hin: 'Hindi',
//   ...
// }

// Multiple languages
const result = await page.performOCR({ lang: 'eng+fra+deu' });
```

## Page Segmentation Modes (PSM)

```typescript
import { PSM_MODES } from 'pdfexcavator';

// PSM_MODES values:
// 0  - Orientation and script detection only
// 1  - Automatic page segmentation with OSD
// 3  - Fully automatic page segmentation (default)
// 4  - Assume a single column of text
// 5  - Assume a single uniform block of vertically aligned text
// 6  - Assume a single uniform block of text
// 7  - Treat image as a single text line
// 8  - Treat image as a single word
// 9  - Treat image as a single word in a circle
// 10 - Treat image as a single character
// 11 - Sparse text. Find as much text as possible
// 12 - Sparse text with OSD
// 13 - Raw line. Treat image as a single text line

const result = await page.performOCR({
  psm: PSM_MODES.SINGLE_COLUMN  // 4
});
```

## OCR Engine Modes (OEM)

```typescript
import { OEM_MODES } from 'pdfexcavator';

// OEM_MODES values:
// 0 - Legacy engine only
// 1 - Neural nets LSTM engine only
// 2 - Legacy + LSTM engines
// 3 - Default (based on what is available)

const result = await page.performOCR({
  oem: OEM_MODES.LSTM_ONLY  // 1
});
```

## Example: Process Scanned PDF

```typescript
import pdfexcavator, { isTesseractAvailable, terminateOCR } from 'pdfexcavator';

async function processScannedPDF(pdfPath: string) {
  // Check OCR availability
  const ocrAvailable = await isTesseractAvailable();
  if (!ocrAvailable) {
    throw new Error('Install tesseract.js: npm install tesseract.js');
  }

  const pdf = await pdfexcavator.open(pdfPath);
  const results: string[] = [];

  for (const page of pdf.pages) {
    const needsOcr = await page.needsOCR();

    if (needsOcr) {
      console.log(`Page ${page.pageNumber + 1}: Running OCR...`);
      const result = await page.performOCR({ lang: 'eng' });
      results.push(result.text);
      console.log(`  Confidence: ${result.confidence}%`);
    } else {
      console.log(`Page ${page.pageNumber + 1}: Extracting text...`);
      const text = await page.extractText();
      results.push(text);
    }
  }

  await pdf.close();
  await terminateOCR();  // Clean up

  return results.join('\n\n');
}
```

## Example: OCR with Confidence Check

```typescript
async function ocrWithConfidenceCheck(page, minConfidence = 70) {
  const result = await page.performOCR({ lang: 'eng' });

  if (result.confidence < minConfidence) {
    console.warn(`Low OCR confidence: ${result.confidence}%`);
    // Maybe try different language or PSM
    const retry = await page.performOCR({
      lang: 'eng',
      psm: PSM_MODES.SINGLE_BLOCK
    });
    return retry.confidence > result.confidence ? retry : result;
  }

  return result;
}
```
