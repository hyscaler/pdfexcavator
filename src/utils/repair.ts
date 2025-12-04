/**
 * PDF Repair Utilities
 * Attempts to recover content from malformed PDF files
 */

/** PDF repair result */
export interface RepairResult {
  /** Whether repair was attempted */
  repaired: boolean;
  /** Description of issues found */
  issues: string[];
  /** The repaired data (if repair was performed) */
  data?: Uint8Array;
}

/** PDF repair options */
export interface RepairOptions {
  /** Try to fix missing EOF marker */
  fixEOF?: boolean;
  /** Try to fix corrupt xref table */
  rebuildXref?: boolean;
  /** Try to recover from linearization errors */
  ignoreLinearization?: boolean;
  /** Maximum size to process (default: 100MB) */
  maxSize?: number;
}

const DEFAULT_OPTIONS: Required<RepairOptions> = {
  fixEOF: true,
  rebuildXref: true,
  ignoreLinearization: true,
  maxSize: 100 * 1024 * 1024, // 100MB
};

/**
 * Attempt to repair a malformed PDF
 * Returns the original data if no repairs needed, or repaired data if fixes applied
 */
export function repairPDF(
  data: Uint8Array | Buffer,
  options: RepairOptions = {}
): RepairResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const issues: string[] = [];
  let repaired = false;
  let workingData = data instanceof Buffer ? new Uint8Array(data) : data;

  if (workingData.length > opts.maxSize) {
    return {
      repaired: false,
      issues: [`PDF size (${workingData.length}) exceeds maximum allowed (${opts.maxSize})`],
    };
  }

  const headerCheck = checkHeader(workingData);
  if (!headerCheck.valid) {
    issues.push(headerCheck.issue!);
    if (headerCheck.fixedData) {
      workingData = headerCheck.fixedData;
      repaired = true;
    }
  }

  if (opts.fixEOF) {
    const eofCheck = checkEOF(workingData);
    if (!eofCheck.valid) {
      issues.push(eofCheck.issue!);
      if (eofCheck.fixedData) {
        workingData = eofCheck.fixedData;
        repaired = true;
      }
    }
  }

  if (opts.rebuildXref) {
    const xrefCheck = checkXref(workingData);
    if (!xrefCheck.valid) {
      issues.push(xrefCheck.issue!);
    }
  }

  const encodingCheck = checkEncoding(workingData);
  if (!encodingCheck.valid) {
    issues.push(encodingCheck.issue!);
    if (encodingCheck.fixedData) {
      workingData = encodingCheck.fixedData;
      repaired = true;
    }
  }

  return {
    repaired,
    issues,
    data: repaired ? workingData : undefined,
  };
}

/**
 * Check PDF header
 */
function checkHeader(data: Uint8Array): { valid: boolean; issue?: string; fixedData?: Uint8Array } {
  const headerStr = new TextDecoder().decode(data.slice(0, Math.min(1024, data.length)));

  const pdfIndex = headerStr.indexOf('%PDF-');
  if (pdfIndex === -1) {
    return {
      valid: false,
      issue: 'Missing PDF header (%PDF-)',
    };
  }

  if (pdfIndex > 0) {
    const fixedData = data.slice(pdfIndex);
    return {
      valid: false,
      issue: `PDF header found at offset ${pdfIndex}, garbage bytes removed`,
      fixedData,
    };
  }

  const versionMatch = headerStr.match(/%PDF-(\d+\.\d+)/);
  if (versionMatch) {
    const version = parseFloat(versionMatch[1]);
    if (version > 2.0) {
      return {
        valid: true, // Still valid but note unusual version
        issue: `Unusual PDF version: ${version}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Check EOF marker
 */
function checkEOF(data: Uint8Array): { valid: boolean; issue?: string; fixedData?: Uint8Array } {
  const tailSize = Math.min(1024, data.length);
  const tailStr = new TextDecoder().decode(data.slice(-tailSize));

  if (tailStr.includes('%%EOF')) {
    const eofIndex = tailStr.lastIndexOf('%%EOF');
    const afterEOF = tailStr.slice(eofIndex + 5).trim();

    if (afterEOF.length > 0) {
      return {
        valid: true,
        issue: 'Trailing garbage after %%EOF',
      };
    }

    return { valid: true };
  }

  const fixedData = new Uint8Array(data.length + 7);
  fixedData.set(data);
  fixedData.set(new TextEncoder().encode('\n%%EOF\n'), data.length);

  return {
    valid: false,
    issue: 'Missing %%EOF marker, added',
    fixedData,
  };
}

/**
 * Check xref table
 */
function checkXref(data: Uint8Array): { valid: boolean; issue?: string } {
  const text = new TextDecoder().decode(data);

  const xrefIndex = text.lastIndexOf('xref');
  const startxrefIndex = text.lastIndexOf('startxref');

  if (xrefIndex === -1 && startxrefIndex === -1) {
    if (text.includes('/Type /XRef')) {
      return { valid: true };
    }
    return {
      valid: false,
      issue: 'Missing xref table (pdf.js may still recover)',
    };
  }

  if (startxrefIndex === -1) {
    return {
      valid: false,
      issue: 'Missing startxref pointer (pdf.js may still recover)',
    };
  }

  const startxrefMatch = text.slice(startxrefIndex).match(/startxref\s*(\d+)/);
  if (startxrefMatch) {
    const offset = parseInt(startxrefMatch[1], 10);
    if (offset > data.length) {
      return {
        valid: false,
        issue: `startxref offset (${offset}) exceeds file size (pdf.js may still recover)`,
      };
    }
  }

  return { valid: true };
}

/**
 * Check for encoding issues
 */
function checkEncoding(data: Uint8Array): { valid: boolean; issue?: string; fixedData?: Uint8Array } {
  const headerRegion = data.slice(0, Math.min(100, data.length));
  let nullCount = 0;
  for (let i = 0; i < headerRegion.length; i++) {
    if (headerRegion[i] === 0) nullCount++;
  }

  if (nullCount > 5) {
    return {
      valid: false,
      issue: 'Excessive null bytes in header region (possible corruption)',
    };
  }

  if (data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
    return {
      valid: false,
      issue: 'UTF-8 BOM removed from start of file',
      fixedData: data.slice(3),
    };
  }

  if ((data[0] === 0xFF && data[1] === 0xFE) || (data[0] === 0xFE && data[1] === 0xFF)) {
    return {
      valid: false,
      issue: 'UTF-16 BOM found (file may be corrupted or encoded incorrectly)',
    };
  }

  return { valid: true };
}

/**
 * Detect if a file is likely a PDF (even if malformed)
 */
export function isPDFLike(data: Uint8Array | Buffer): boolean {
  const bytes = data instanceof Buffer ? new Uint8Array(data) : data;

  const checkSize = Math.min(8192, bytes.length);
  const text = new TextDecoder().decode(bytes.slice(0, checkSize));

  if (text.includes('%PDF-')) return true;
  if (text.match(/\d+\s+\d+\s+obj/)) return true;
  if (text.includes('stream') && text.includes('endstream')) return true;

  return false;
}

/**
 * Get information about PDF structure
 */
export function analyzePDF(data: Uint8Array | Buffer): {
  version?: string;
  linearized: boolean;
  encrypted: boolean;
  hasXrefStream: boolean;
  objectCount: number;
  streamCount: number;
  issues: string[];
} {
  const bytes = data instanceof Buffer ? new Uint8Array(data) : data;
  const text = new TextDecoder().decode(bytes);
  const issues: string[] = [];

  const versionMatch = text.match(/%PDF-(\d+\.\d+)/);
  const version = versionMatch ? versionMatch[1] : undefined;

  const linearized = text.includes('/Linearized');
  const encrypted = text.includes('/Encrypt');
  const hasXrefStream = text.includes('/Type /XRef');

  const objectMatches = text.match(/\d+\s+\d+\s+obj/g);
  const objectCount = objectMatches ? objectMatches.length : 0;

  const streamMatches = text.match(/stream[\r\n]/g);
  const streamCount = streamMatches ? streamMatches.length : 0;

  if (!version) {
    issues.push('Could not determine PDF version');
  }

  if (objectCount === 0) {
    issues.push('No PDF objects found');
  }

  if (!text.includes('%%EOF')) {
    issues.push('Missing %%EOF marker');
  }

  const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
  const pageCount = pageMatches ? pageMatches.length : 0;
  if (pageCount === 0 && objectCount > 0) {
    issues.push('No page objects found (may be embedded in object streams)');
  }

  return {
    version,
    linearized,
    encrypted,
    hasXrefStream,
    objectCount,
    streamCount,
    issues,
  };
}

/**
 * Try to extract recoverable content from a severely damaged PDF
 * This is a last-resort method that extracts raw text content
 */
export function extractRawText(data: Uint8Array | Buffer): string[] {
  const bytes = data instanceof Buffer ? new Uint8Array(data) : data;
  const text = new TextDecoder().decode(bytes);
  const extractedTexts: string[] = [];

  const streamRegex = /stream[\r\n]([\s\S]*?)[\r\n]?endstream/g;
  let match;

  while ((match = streamRegex.exec(text)) !== null) {
    const streamContent = match[1];

    const textBlockRegex = /BT[\s\S]*?ET/g;
    let textMatch;

    while ((textMatch = textBlockRegex.exec(streamContent)) !== null) {
      const textBlock = textMatch[0];

      const stringRegex = /\(((?:[^()\\]|\\[\\nrtbf()])*)\)/g;
      let stringMatch;

      while ((stringMatch = stringRegex.exec(textBlock)) !== null) {
        let str = stringMatch[1];
        str = str
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\\\/g, '\\')
          .replace(/\\([()])/g, '$1');

        if (str.trim()) {
          extractedTexts.push(str);
        }
      }

      const hexRegex = /<([0-9A-Fa-f]+)>/g;
      let hexMatch;

      while ((hexMatch = hexRegex.exec(textBlock)) !== null) {
        try {
          const hex = hexMatch[1];
          let str = '';
          for (let i = 0; i < hex.length; i += 2) {
            const byte = parseInt(hex.slice(i, i + 2), 16);
            if (byte >= 32 && byte < 127) {
              str += String.fromCharCode(byte);
            }
          }
          if (str.trim()) {
            extractedTexts.push(str);
          }
        } catch {
          // Ignore hex decode errors
        }
      }
    }
  }

  return extractedTexts;
}
