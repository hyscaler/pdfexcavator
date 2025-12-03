#!/usr/bin/env node
/**
 * PDFLens CLI
 * Command-line interface for PDF extraction
 */

import { PDFLens } from './PDFLens.js';

interface CLIOptions {
  format: 'json' | 'csv' | 'text';
  pages?: number[];
  types: string[];
  precision: number;
  indent: number;
  password?: string;
  laparams?: Record<string, any>;
}

const HELP_TEXT = `
pdflens - Extract text, tables, and data from PDF files

Usage:
  pdflens <pdf-file> [options]           # Extract all objects
  pdflens <command> [options] <pdf-file> # Run specific command

Commands:
  text      Extract text from PDF
  tables    Extract tables as CSV or JSON
  chars     Extract character data
  words     Extract word data
  lines     Extract line objects
  rects     Extract rectangle objects
  curves    Extract curve objects
  images    Extract image metadata
  annots    Extract annotations
  metadata  Show PDF metadata
  info      Show page information

Options:
  -p, --pages <range>     Pages to process (e.g., "1,3-5,10")
  -f, --format <format>   Output format: json, csv, text (default: csv)
  -t, --types <types>     Object types: char,line,rect,curve,image,annot (default: all)
  --precision <n>         Decimal precision for coordinates (default: 2)
  --indent <n>            JSON indentation (default: 2)
  --password <pass>       Password for encrypted PDFs
  --laparams <json>       Layout parameters as JSON string
  -h, --help              Show this help message
  -v, --version           Show version

Examples:
  pdflens document.pdf                        # Extract all objects as CSV
  pdflens document.pdf -f json                # Output as JSON
  pdflens document.pdf -t char,line           # Only chars and lines
  pdflens text document.pdf                   # Extract text only
  pdflens tables document.pdf --format csv    # Tables as CSV
  pdflens chars document.pdf --pages 1-3      # Chars from pages 1-3
  pdflens metadata document.pdf               # Show metadata
`;

const COMMANDS = ['text', 'tables', 'chars', 'words', 'lines', 'rects', 'curves', 'images', 'annots', 'metadata', 'info'];

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (args.includes('-v') || args.includes('--version')) {
    console.log('pdflens 0.1.0');
    process.exit(0);
  }

  // Determine if first arg is a command or a PDF file
  const firstArg = args[0];
  const isCommand = COMMANDS.includes(firstArg);

  let command: string;
  let pdfPath: string;
  let optionArgs: string[];

  if (isCommand) {
    command = firstArg;
    optionArgs = args.slice(1);
    // Find the PDF file (last non-option argument)
    pdfPath = '';
    for (let i = optionArgs.length - 1; i >= 0; i--) {
      if (!optionArgs[i].startsWith('-') && optionArgs[i].endsWith('.pdf')) {
        pdfPath = optionArgs[i];
        break;
      }
    }
  } else {
    // Default mode: extract all objects from PDF
    command = 'all';
    pdfPath = firstArg.endsWith('.pdf') ? firstArg : '';
    optionArgs = args.slice(1);
    // If first arg isn't a PDF, try to find one
    if (!pdfPath) {
      for (const arg of args) {
        if (arg.endsWith('.pdf')) {
          pdfPath = arg;
          break;
        }
      }
    }
  }

  const options = parseOptions(optionArgs);

  if (!pdfPath) {
    console.error('Error: No PDF file specified');
    process.exit(1);
  }

  try {
    const pdf = await PDFLens.open(pdfPath, {
      password: options.password,
      laparams: options.laparams,
    });
    const pagesToProcess = options.pages || Array.from({ length: pdf.pageCount }, (_, i) => i);

    switch (command) {
      case 'all':
        await extractAll(pdf, pagesToProcess, options);
        break;

      case 'text':
        await extractText(pdf, pagesToProcess, options);
        break;

      case 'tables':
        await extractTables(pdf, pagesToProcess, options);
        break;

      case 'chars':
        await extractChars(pdf, pagesToProcess, options);
        break;

      case 'words':
        await extractWords(pdf, pagesToProcess, options);
        break;

      case 'lines':
        await extractLines(pdf, pagesToProcess, options);
        break;

      case 'rects':
        await extractRects(pdf, pagesToProcess, options);
        break;

      case 'curves':
        await extractCurves(pdf, pagesToProcess, options);
        break;

      case 'images':
        await extractImages(pdf, pagesToProcess, options);
        break;

      case 'annots':
        await extractAnnots(pdf, pagesToProcess, options);
        break;

      case 'metadata':
        await showMetadata(pdf, options);
        break;

      case 'info':
        await showInfo(pdf, pagesToProcess, options);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log(HELP_TEXT);
        process.exit(1);
    }

    await pdf.close();
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

function parseOptions(args: string[]): CLIOptions {
  const options: CLIOptions = {
    format: 'csv',
    types: ['char', 'line', 'rect', 'curve', 'image', 'annot'],
    precision: 2,
    indent: 2,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-f' || arg === '--format') {
      const format = args[++i];
      if (format === 'json' || format === 'csv' || format === 'text') {
        options.format = format;
      }
    } else if (arg === '-p' || arg === '--pages') {
      options.pages = parsePageRange(args[++i]);
    } else if (arg === '--precision') {
      options.precision = parseInt(args[++i], 10);
    } else if (arg === '--indent') {
      options.indent = parseInt(args[++i], 10);
    } else if (arg === '-t' || arg === '--types') {
      options.types = args[++i].split(',').map(t => t.trim());
    } else if (arg === '--password') {
      options.password = args[++i];
    } else if (arg === '--laparams') {
      try {
        options.laparams = JSON.parse(args[++i]);
      } catch {
        console.error('Invalid JSON for --laparams');
        process.exit(1);
      }
    }
  }

  return options;
}

function parsePageRange(range: string): number[] {
  const pages: number[] = [];
  const parts = range.split(',');

  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map((n) => parseInt(n, 10) - 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    } else {
      pages.push(parseInt(part, 10) - 1);
    }
  }

  return pages;
}

async function extractText(pdf: PDFLens, pages: number[], options: CLIOptions) {
  const results: string[] = [];

  for (const pageNum of pages) {
    const page = pdf.getPage(pageNum);
    const text = await page.extractText();
    results.push(text);
  }

  if (options.format === 'json') {
    console.log(JSON.stringify({ pages: results }, null, options.indent));
  } else {
    console.log(results.join('\n\n---\n\n'));
  }
}

async function extractTables(pdf: PDFLens, pages: number[], options: CLIOptions) {
  const allTables: any[] = [];

  for (const pageNum of pages) {
    const page = pdf.getPage(pageNum);
    const tables = await page.extractTables();

    for (const table of tables) {
      allTables.push({
        page: pageNum + 1,
        rows: table.rows,
        bbox: roundBBox(table.bbox, options.precision),
      });
    }
  }

  if (options.format === 'csv') {
    for (const table of allTables) {
      console.log(`# Page ${table.page}`);
      for (const row of table.rows) {
        console.log(row.map((cell: string | null) => escapeCSV(cell || '')).join(','));
      }
      console.log();
    }
  } else if (options.format === 'json') {
    console.log(JSON.stringify(allTables, null, options.indent));
  } else {
    for (const table of allTables) {
      console.log(`Page ${table.page}:`);
      for (const row of table.rows) {
        console.log('  ' + row.map((cell: string | null) => cell || '').join(' | '));
      }
      console.log();
    }
  }
}

async function extractChars(pdf: PDFLens, pages: number[], options: CLIOptions) {
  const allChars: any[] = [];

  for (const pageNum of pages) {
    const page = pdf.getPage(pageNum);
    const chars = await page.getChars();

    for (const char of chars) {
      allChars.push({
        text: char.text,
        page: pageNum + 1,
        x0: round(char.x0, options.precision),
        y0: round(char.y0, options.precision),
        x1: round(char.x1, options.precision),
        y1: round(char.y1, options.precision),
        fontName: char.fontName,
        size: round(char.size, options.precision),
      });
    }
  }

  if (options.format === 'csv') {
    console.log('text,page,x0,y0,x1,y1,fontName,size');
    for (const char of allChars) {
      console.log(
        [
          escapeCSV(char.text),
          char.page,
          char.x0,
          char.y0,
          char.x1,
          char.y1,
          escapeCSV(char.fontName),
          char.size,
        ].join(',')
      );
    }
  } else {
    console.log(JSON.stringify(allChars, null, options.indent));
  }
}

async function extractWords(pdf: PDFLens, pages: number[], options: CLIOptions) {
  const allWords: any[] = [];

  for (const pageNum of pages) {
    const page = pdf.getPage(pageNum);
    const words = await page.extractWords();

    for (const word of words) {
      allWords.push({
        text: word.text,
        page: pageNum + 1,
        x0: round(word.x0, options.precision),
        y0: round(word.y0, options.precision),
        x1: round(word.x1, options.precision),
        y1: round(word.y1, options.precision),
      });
    }
  }

  if (options.format === 'csv') {
    console.log('text,page,x0,y0,x1,y1');
    for (const word of allWords) {
      console.log(
        [escapeCSV(word.text), word.page, word.x0, word.y0, word.x1, word.y1].join(',')
      );
    }
  } else {
    console.log(JSON.stringify(allWords, null, options.indent));
  }
}

async function extractLines(pdf: PDFLens, pages: number[], options: CLIOptions) {
  const allLines: any[] = [];

  for (const pageNum of pages) {
    const page = pdf.getPage(pageNum);
    const lines = await page.getLines();

    for (const line of lines) {
      allLines.push({
        object_type: 'line',
        page: pageNum + 1,
        x0: round(line.x0, options.precision),
        y0: round(line.y0, options.precision),
        x1: round(line.x1, options.precision),
        y1: round(line.y1, options.precision),
        lineWidth: round(line.lineWidth, options.precision),
      });
    }
  }

  if (options.format === 'csv') {
    console.log('object_type,page,x0,y0,x1,y1,lineWidth');
    for (const line of allLines) {
      console.log([line.object_type, line.page, line.x0, line.y0, line.x1, line.y1, line.lineWidth].join(','));
    }
  } else {
    console.log(JSON.stringify(allLines, null, options.indent));
  }
}

async function extractRects(pdf: PDFLens, pages: number[], options: CLIOptions) {
  const allRects: any[] = [];

  for (const pageNum of pages) {
    const page = pdf.getPage(pageNum);
    const rects = await page.getRects();

    for (const rect of rects) {
      allRects.push({
        object_type: 'rect',
        page: pageNum + 1,
        x0: round(rect.x0, options.precision),
        y0: round(rect.y0, options.precision),
        x1: round(rect.x1, options.precision),
        y1: round(rect.y1, options.precision),
        width: round(rect.width, options.precision),
        height: round(rect.height, options.precision),
        lineWidth: round(rect.lineWidth, options.precision),
        fill: rect.fill,
        stroke: rect.stroke,
      });
    }
  }

  if (options.format === 'csv') {
    console.log('object_type,page,x0,y0,x1,y1,width,height,lineWidth,fill,stroke');
    for (const rect of allRects) {
      console.log([rect.object_type, rect.page, rect.x0, rect.y0, rect.x1, rect.y1, rect.width, rect.height, rect.lineWidth, rect.fill, rect.stroke].join(','));
    }
  } else {
    console.log(JSON.stringify(allRects, null, options.indent));
  }
}

async function extractCurves(pdf: PDFLens, pages: number[], options: CLIOptions) {
  const allCurves: any[] = [];

  for (const pageNum of pages) {
    const page = pdf.getPage(pageNum);
    const curves = await page.getCurves();

    for (const curve of curves) {
      allCurves.push({
        object_type: 'curve',
        page: pageNum + 1,
        x0: round(curve.x0, options.precision),
        y0: round(curve.y0, options.precision),
        x1: round(curve.x1, options.precision),
        y1: round(curve.y1, options.precision),
        lineWidth: round(curve.lineWidth, options.precision),
        points: curve.pts.length,
      });
    }
  }

  if (options.format === 'csv') {
    console.log('object_type,page,x0,y0,x1,y1,lineWidth,points');
    for (const curve of allCurves) {
      console.log([curve.object_type, curve.page, curve.x0, curve.y0, curve.x1, curve.y1, curve.lineWidth, curve.points].join(','));
    }
  } else {
    console.log(JSON.stringify(allCurves, null, options.indent));
  }
}

async function extractImages(pdf: PDFLens, pages: number[], options: CLIOptions) {
  const allImages: any[] = [];

  for (const pageNum of pages) {
    const page = pdf.getPage(pageNum);
    const images = await page.getImages();

    for (const image of images) {
      allImages.push({
        object_type: 'image',
        page: pageNum + 1,
        x0: round(image.x0, options.precision),
        y0: round(image.y0, options.precision),
        x1: round(image.x1, options.precision),
        y1: round(image.y1, options.precision),
        width: round(image.width, options.precision),
        height: round(image.height, options.precision),
        srcWidth: image.srcSize[0],
        srcHeight: image.srcSize[1],
      });
    }
  }

  if (options.format === 'csv') {
    console.log('object_type,page,x0,y0,x1,y1,width,height,srcWidth,srcHeight');
    for (const image of allImages) {
      console.log([image.object_type, image.page, image.x0, image.y0, image.x1, image.y1, image.width, image.height, image.srcWidth, image.srcHeight].join(','));
    }
  } else {
    console.log(JSON.stringify(allImages, null, options.indent));
  }
}

async function extractAnnots(pdf: PDFLens, pages: number[], options: CLIOptions) {
  const allAnnots: any[] = [];

  for (const pageNum of pages) {
    const page = pdf.getPage(pageNum);
    const annots = await page.getAnnotations();

    for (const annot of annots) {
      allAnnots.push({
        object_type: 'annot',
        page: pageNum + 1,
        x0: round(annot.x0, options.precision),
        y0: round(annot.y0, options.precision),
        x1: round(annot.x1, options.precision),
        y1: round(annot.y1, options.precision),
        type: annot.annotationType,
        uri: annot.uri || '',
      });
    }
  }

  if (options.format === 'csv') {
    console.log('object_type,page,x0,y0,x1,y1,type,uri');
    for (const annot of allAnnots) {
      console.log([annot.object_type, annot.page, annot.x0, annot.y0, annot.x1, annot.y1, annot.type, escapeCSV(annot.uri)].join(','));
    }
  } else {
    console.log(JSON.stringify(allAnnots, null, options.indent));
  }
}

async function extractAll(pdf: PDFLens, pages: number[], options: CLIOptions) {
  const allObjects: any[] = [];
  const types = options.types;

  for (const pageNum of pages) {
    const page = pdf.getPage(pageNum);

    if (types.includes('char')) {
      const chars = await page.getChars();
      for (const char of chars) {
        allObjects.push({
          object_type: 'char',
          page: pageNum + 1,
          text: char.text,
          x0: round(char.x0, options.precision),
          y0: round(char.y0, options.precision),
          x1: round(char.x1, options.precision),
          y1: round(char.y1, options.precision),
          fontName: char.fontName,
          size: round(char.size, options.precision),
        });
      }
    }

    if (types.includes('line')) {
      const lines = await page.getLines();
      for (const line of lines) {
        allObjects.push({
          object_type: 'line',
          page: pageNum + 1,
          x0: round(line.x0, options.precision),
          y0: round(line.y0, options.precision),
          x1: round(line.x1, options.precision),
          y1: round(line.y1, options.precision),
          lineWidth: round(line.lineWidth, options.precision),
        });
      }
    }

    if (types.includes('rect')) {
      const rects = await page.getRects();
      for (const rect of rects) {
        allObjects.push({
          object_type: 'rect',
          page: pageNum + 1,
          x0: round(rect.x0, options.precision),
          y0: round(rect.y0, options.precision),
          x1: round(rect.x1, options.precision),
          y1: round(rect.y1, options.precision),
          width: round(rect.width, options.precision),
          height: round(rect.height, options.precision),
        });
      }
    }

    if (types.includes('curve')) {
      const curves = await page.getCurves();
      for (const curve of curves) {
        allObjects.push({
          object_type: 'curve',
          page: pageNum + 1,
          x0: round(curve.x0, options.precision),
          y0: round(curve.y0, options.precision),
          x1: round(curve.x1, options.precision),
          y1: round(curve.y1, options.precision),
        });
      }
    }

    if (types.includes('image')) {
      const images = await page.getImages();
      for (const image of images) {
        allObjects.push({
          object_type: 'image',
          page: pageNum + 1,
          x0: round(image.x0, options.precision),
          y0: round(image.y0, options.precision),
          x1: round(image.x1, options.precision),
          y1: round(image.y1, options.precision),
          width: round(image.width, options.precision),
          height: round(image.height, options.precision),
        });
      }
    }

    if (types.includes('annot')) {
      const annots = await page.getAnnotations();
      for (const annot of annots) {
        allObjects.push({
          object_type: 'annot',
          page: pageNum + 1,
          x0: round(annot.x0, options.precision),
          y0: round(annot.y0, options.precision),
          x1: round(annot.x1, options.precision),
          y1: round(annot.y1, options.precision),
          type: annot.annotationType,
        });
      }
    }
  }

  if (options.format === 'json') {
    console.log(JSON.stringify(allObjects, null, options.indent));
  } else if (options.format === 'csv' && allObjects.length > 0) {
    // Collect all columns
    const columnsSet = new Set<string>();
    for (const obj of allObjects) {
      for (const key of Object.keys(obj)) {
        columnsSet.add(key);
      }
    }
    const columns = Array.from(columnsSet);

    // Header
    console.log(columns.join(','));

    // Rows
    for (const obj of allObjects) {
      const row = columns.map(col => {
        const val = obj[col];
        if (val === undefined || val === null) return '';
        if (typeof val === 'string') return escapeCSV(val);
        return String(val);
      });
      console.log(row.join(','));
    }
  } else {
    // Text format - just output text
    for (const pageNum of pages) {
      const page = pdf.getPage(pageNum);
      const text = await page.extractText();
      console.log(text);
    }
  }
}

async function showMetadata(pdf: PDFLens, options: CLIOptions) {
  const metadata = await pdf.getMetadata();

  if (options.format === 'json') {
    console.log(JSON.stringify(metadata, null, options.indent));
  } else {
    console.log('PDF Metadata:');
    console.log(`  Title: ${metadata.title || 'N/A'}`);
    console.log(`  Author: ${metadata.author || 'N/A'}`);
    console.log(`  Subject: ${metadata.subject || 'N/A'}`);
    console.log(`  Creator: ${metadata.creator || 'N/A'}`);
    console.log(`  Producer: ${metadata.producer || 'N/A'}`);
    console.log(`  Creation Date: ${metadata.creationDate?.toISOString() || 'N/A'}`);
    console.log(`  Modification Date: ${metadata.modificationDate?.toISOString() || 'N/A'}`);
    console.log(`  Page Count: ${metadata.pageCount}`);
    console.log(`  PDF Version: ${metadata.pdfVersion || 'N/A'}`);
  }
}

async function showInfo(pdf: PDFLens, pages: number[], options: CLIOptions) {
  const info: any[] = [];

  for (const pageNum of pages) {
    const page = pdf.getPage(pageNum);
    info.push({
      page: pageNum + 1,
      width: round(page.width, options.precision),
      height: round(page.height, options.precision),
      rotation: page.rotation,
    });
  }

  if (options.format === 'json') {
    console.log(JSON.stringify(info, null, options.indent));
  } else {
    console.log('Page Information:');
    for (const p of info) {
      console.log(`  Page ${p.page}: ${p.width} x ${p.height} (rotation: ${p.rotation}°)`);
    }
  }
}

function round(n: number, precision: number): number {
  const factor = Math.pow(10, precision);
  return Math.round(n * factor) / factor;
}

function roundBBox(bbox: [number, number, number, number], precision: number): number[] {
  return bbox.map((n) => round(n, precision));
}

function escapeCSV(str: string): string {
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

main().catch(console.error);
