/**
 * PDF Structure Analysis
 * Extracts document structure and text flow order from PDF tagged content
 */

import type { PDFPageProxy } from 'pdfjs-dist';
import type { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api.js';
import type { PDFChar } from '../types.js';
import { detectTextColumns } from './layout.js';

/** Structure element from PDF */
export interface StructureElement {
  /** Structure type (e.g., 'P', 'H1', 'Table', 'Span') */
  type: string;
  /** Alternative text (accessibility) */
  alt?: string;
  /** Actual text content */
  actualText?: string;
  /** Language */
  lang?: string;
  /** Marked content IDs associated with this element */
  mcids: number[];
  /** Child elements */
  children: StructureElement[];
  /** Page number */
  pageNumber?: number;
}

/** Text item with structure information */
export interface StructuredTextItem extends TextItem {
  /** Marked content ID */
  mcid?: number;
  /** Structure tag */
  tag?: string;
}

/**
 * Extract structure tree from a PDF page
 * Uses marked content and structure tree from pdf.js
 */
export async function extractStructureTree(
  page: PDFPageProxy
): Promise<StructureElement | null> {
  try {
    // pdf.js provides getStructTree() for accessing document structure
    const structTree = await (page as any).getStructTree?.();

    if (!structTree) {
      return null;
    }

    return parseStructureTree(structTree);
  } catch {
    // Structure tree not available or failed to parse
    return null;
  }
}

/**
 * Parse pdf.js structure tree into our format
 */
function parseStructureTree(node: any): StructureElement {
  const element: StructureElement = {
    type: node.role || node.type || 'unknown',
    mcids: [],
    children: [],
  };

  // Extract properties
  if (node.alt) element.alt = node.alt;
  if (node.actualText) element.actualText = node.actualText;
  if (node.lang) element.lang = node.lang;

  // Extract marked content IDs
  if (node.children) {
    for (const child of node.children) {
      if (typeof child === 'number') {
        // Direct MCID reference
        element.mcids.push(child);
      } else if (child.type === 'content') {
        // Content reference with MCID
        if (child.id !== undefined) {
          element.mcids.push(child.id);
        }
      } else if (typeof child === 'object') {
        // Nested structure element
        element.children.push(parseStructureTree(child));
      }
    }
  }

  return element;
}

/**
 * Extract marked content information from operator list
 * This provides the mapping between MCIDs and text content
 */
export async function extractMarkedContent(
  page: PDFPageProxy
): Promise<Map<number, { tag: string; pageNumber: number }>> {
  const mcidMap = new Map<number, { tag: string; pageNumber: number }>();

  try {
    const opList = await page.getOperatorList();

    // PDF operator codes for marked content
    const OPS = {
      beginMarkedContent: 69,      // BMC
      beginMarkedContentProps: 70, // BDC
      endMarkedContent: 71,        // EMC
    };

    for (let i = 0; i < opList.fnArray.length; i++) {
      const op = opList.fnArray[i];
      const args = opList.argsArray[i];

      if (op === OPS.beginMarkedContentProps && args) {
        const tag = args[0];
        const props = args[1];

        if (props && props.mcid !== undefined) {
          mcidMap.set(props.mcid, {
            tag: tag || 'unknown',
            pageNumber: page.pageNumber - 1,
          });
        }
      }
    }
  } catch {
    // Failed to extract marked content
  }

  return mcidMap;
}

/**
 * Get text items with their marked content IDs
 * This associates text with structure elements
 */
export async function getTextWithStructure(
  page: PDFPageProxy
): Promise<StructuredTextItem[]> {
  const textContent = await page.getTextContent({
    includeMarkedContent: true,
  } as any);

  const items: StructuredTextItem[] = [];
  let currentMcid: number | undefined;
  let currentTag: string | undefined;

  for (const item of textContent.items) {
    if ('type' in item) {
      // Marked content boundary
      const mcItem = item as any;
      if (mcItem.type === 'beginMarkedContent' || mcItem.type === 'beginMarkedContentProps') {
        currentMcid = mcItem.id;
        currentTag = mcItem.tag;
      } else if (mcItem.type === 'endMarkedContent') {
        currentMcid = undefined;
        currentTag = undefined;
      }
    } else if ('str' in item) {
      // Text item
      const textItem = item as TextItem;
      items.push({
        ...textItem,
        mcid: currentMcid,
        tag: currentTag,
      });
    }
  }

  return items;
}

/**
 * Sort characters by reading order using structure tree
 * Falls back to visual order if no structure is available
 */
export async function sortCharsByReadingOrder(
  page: PDFPageProxy,
  chars: PDFChar[]
): Promise<PDFChar[]> {
  // Get structure tree
  const structure = await extractStructureTree(page);

  if (!structure || structure.children.length === 0) {
    // No structure tree, fall back to visual sorting
    return sortCharsByVisualOrder(chars);
  }

  // Get marked content mapping
  const markedContent = await extractMarkedContent(page);

  if (markedContent.size === 0) {
    // No marked content, fall back to visual sorting
    return sortCharsByVisualOrder(chars);
  }

  // Get text items with structure info
  const structuredText = await getTextWithStructure(page);

  // Build MCID order from structure tree
  const mcidOrder = flattenMcidOrder(structure);

  if (mcidOrder.length === 0) {
    return sortCharsByVisualOrder(chars);
  }

  // Create position -> order mapping
  const charOrder = new Map<PDFChar, number>();
  let orderIndex = 0;

  // Map text items to order
  const textItemOrder = new Map<number, number>();
  for (const mcid of mcidOrder) {
    textItemOrder.set(mcid, orderIndex++);
  }

  // Assign order to characters based on their approximate position match with text items
  const sortedChars = [...chars];

  // Create a position-based lookup for structured text items
  const positionToMcid = new Map<string, number>();
  for (const item of structuredText) {
    if (item.mcid !== undefined && item.str) {
      const key = `${Math.round(item.transform[4])},${Math.round(item.transform[5])}`;
      positionToMcid.set(key, item.mcid);
    }
  }

  // Try to match chars to MCIDs
  for (const char of sortedChars) {
    // Look for nearby position matches
    for (let dx = -5; dx <= 5; dx += 5) {
      for (let dy = -5; dy <= 5; dy += 5) {
        const key = `${Math.round(char.x0 + dx)},${Math.round(char.y1 + dy)}`;
        const mcid = positionToMcid.get(key);
        if (mcid !== undefined) {
          const order = textItemOrder.get(mcid);
          if (order !== undefined) {
            charOrder.set(char, order);
            break;
          }
        }
      }
      if (charOrder.has(char)) break;
    }

    // If no match, assign a large order to push to end
    if (!charOrder.get(char)) {
      charOrder.set(char, 100000 + char.y0 * 1000 + char.x0);
    }
  }

  // Sort by order
  sortedChars.sort((a, b) => {
    const orderA = charOrder.get(a) ?? 100000;
    const orderB = charOrder.get(b) ?? 100000;
    if (orderA !== orderB) return orderA - orderB;
    // Secondary sort by position
    if (Math.abs(a.y0 - b.y0) > 3) return a.y0 - b.y0;
    return a.x0 - b.x0;
  });

  return sortedChars;
}

/**
 * Flatten structure tree into ordered list of MCIDs
 */
function flattenMcidOrder(element: StructureElement): number[] {
  const mcids: number[] = [];

  // Add this element's MCIDs
  mcids.push(...element.mcids);

  // Recursively add children's MCIDs
  for (const child of element.children) {
    mcids.push(...flattenMcidOrder(child));
  }

  return mcids;
}

/**
 * Sort characters by visual reading order (left-to-right, top-to-bottom)
 * This is the fallback when no structure information is available
 */
export function sortCharsByVisualOrder(
  chars: PDFChar[],
  yTolerance: number = 3
): PDFChar[] {
  return [...chars].sort((a, b) => {
    // Group by approximate y position (line)
    const yDiff = a.y0 - b.y0;
    if (Math.abs(yDiff) > yTolerance) {
      return yDiff;
    }
    // Within same line, sort by x
    return a.x0 - b.x0;
  });
}

/**
 * Detect text columns on a page
 * Returns column boundaries for multi-column layouts
 * @deprecated Use detectTextColumns from './layout.js' for more precise detection
 */
export function detectColumns(
  chars: PDFChar[],
  minGapRatio: number = 0.05
): Array<{ x0: number; x1: number }> {
  // Delegate to the more sophisticated implementation in layout.ts
  return detectTextColumns(chars, minGapRatio);
}

/**
 * Sort characters by column-aware reading order
 * Handles multi-column layouts properly
 */
export function sortCharsByColumnOrder(
  chars: PDFChar[],
  columns?: Array<{ x0: number; x1: number }>,
  yTolerance: number = 3
): PDFChar[] {
  if (chars.length === 0) return [];

  // Auto-detect columns if not provided
  const cols = columns || detectColumns(chars);

  if (cols.length <= 1) {
    return sortCharsByVisualOrder(chars, yTolerance);
  }

  // Assign each character to a column
  const charColumns = chars.map(char => {
    const centerX = (char.x0 + char.x1) / 2;
    for (let i = 0; i < cols.length; i++) {
      if (centerX >= cols[i].x0 && centerX <= cols[i].x1) {
        return { char, column: i };
      }
    }
    // Default to closest column
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < cols.length; i++) {
      const dist = Math.min(
        Math.abs(centerX - cols[i].x0),
        Math.abs(centerX - cols[i].x1)
      );
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    }
    return { char, column: closest };
  });

  // Sort by column, then by y, then by x
  return charColumns
    .sort((a, b) => {
      if (a.column !== b.column) return a.column - b.column;
      const yDiff = a.char.y0 - b.char.y0;
      if (Math.abs(yDiff) > yTolerance) return yDiff;
      return a.char.x0 - b.char.x0;
    })
    .map(c => c.char);
}
