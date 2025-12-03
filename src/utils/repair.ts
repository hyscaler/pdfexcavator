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

  // Check size limit
  if (workingData.length > opts.maxSize) {
    return {
      repaired: false,
      issues: [`PDF size (${workingData.length}) exceeds maximum allowed (${opts.maxSize})`],
    };
  }

  // Check for PDF header
  const headerCheck = checkHeader(workingData);
  if (!headerCheck.valid) {
    issues.push(headerCheck.issue!);
    if (headerCheck.fixedData) {
      workingData = headerCheck.fixedData;
      repaired = true;
    }
  }

  // Check for EOF marker
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

  // Check for xref issues
  if (opts.rebuildXref) {
    const xrefCheck = checkXref(workingData);
    if (!xrefCheck.valid) {
      issues.push(xrefCheck.issue!);
      // Note: xref rebuilding is complex; we just flag the issue
      // pdf.js has built-in xref recovery that handles most cases
    }
  }

  // Check for common encoding issues
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

  // Check for %PDF- marker
  const pdfIndex = headerStr.indexOf('%PDF-');
  if (pdfIndex === -1) {
    return {
      valid: false,
      issue: 'Missing PDF header (%PDF-)',
    };
  }

  // If PDF marker is not at the start, try to fix by removing garbage
  if (pdfIndex > 0) {
    const fixedData = data.slice(pdfIndex);
    return {
      valid: false,
      issue: `PDF header found at offset ${pdfIndex}, garbage bytes removed`,
      fixedData,
    };
  }

  // Check version
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
  // Check last 1KB for %%EOF marker
  const tailSize = Math.min(1024, data.length);
  const tailStr = new TextDecoder().decode(data.slice(-tailSize));

  if (tailStr.includes('%%EOF')) {
    // Check for trailing garbage after %%EOF
    const eofIndex = tailStr.lastIndexOf('%%EOF');
    const afterEOF = tailStr.slice(eofIndex + 5).trim();

    if (afterEOF.length > 0) {
      // Has trailing garbage, but PDF is still valid
      return {
        valid: true,
        issue: 'Trailing garbage after %%EOF',
      };
    }

    return { valid: true };
  }

  // Missing %%EOF - try to add it
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

  // Look for xref keyword
  const xrefIndex = text.lastIndexOf('xref');
  const startxrefIndex = text.lastIndexOf('startxref');

  if (xrefIndex === -1 && startxrefIndex === -1) {
    // Might be using object streams (xref stream) which is valid
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

  // Check if startxref points to valid location
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
  // Check for null bytes in header region (common corruption)
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

  // Check for BOM markers that might confuse parsing
  if (data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
    // UTF-8 BOM - remove it
    return {
      valid: false,
      issue: 'UTF-8 BOM removed from start of file',
      fixedData: data.slice(3),
    };
  }

  if ((data[0] === 0xFF && data[1] === 0xFE) || (data[0] === 0xFE && data[1] === 0xFF)) {
    // UTF-16 BOM - file is likely corrupt
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

  // Check first 8KB for PDF markers
  const checkSize = Math.min(8192, bytes.length);
  const text = new TextDecoder().decode(bytes.slice(0, checkSize));

  // Look for PDF signature
  if (text.includes('%PDF-')) return true;

  // Look for PDF objects
  if (text.match(/\d+\s+\d+\s+obj/)) return true;

  // Look for PDF streams
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

  // Extract version
  const versionMatch = text.match(/%PDF-(\d+\.\d+)/);
  const version = versionMatch ? versionMatch[1] : undefined;

  // Check linearization
  const linearized = text.includes('/Linearized');

  // Check encryption
  const encrypted = text.includes('/Encrypt');

  // Check for xref stream
  const hasXrefStream = text.includes('/Type /XRef');

  // Count objects
  const objectMatches = text.match(/\d+\s+\d+\s+obj/g);
  const objectCount = objectMatches ? objectMatches.length : 0;

  // Count streams
  const streamMatches = text.match(/stream[\r\n]/g);
  const streamCount = streamMatches ? streamMatches.length : 0;

  // Common issue detection
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

  // Look for text in stream objects
  const streamRegex = /stream[\r\n]([\s\S]*?)[\r\n]?endstream/g;
  let match;

  while ((match = streamRegex.exec(text)) !== null) {
    const streamContent = match[1];

    // Try to find readable text in stream
    // Look for BT...ET (text blocks)
    const textBlockRegex = /BT[\s\S]*?ET/g;
    let textMatch;

    while ((textMatch = textBlockRegex.exec(streamContent)) !== null) {
      const textBlock = textMatch[0];

      // Extract string content (inside parentheses)
      const stringRegex = /\(((?:[^()\\]|\\[\\nrtbf()])*)\)/g;
      let stringMatch;

      while ((stringMatch = stringRegex.exec(textBlock)) !== null) {
        let str = stringMatch[1];
        // Unescape common PDF escapes
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

      // Also try hex strings
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
