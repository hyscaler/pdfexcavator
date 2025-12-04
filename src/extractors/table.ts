/**
 * Table extraction utilities
 */

import type {
  BBox,
  PDFChar,
  PDFLine,
  PDFRect,
  PDFTable,
  PDFWord,
  TableCell,
  TableDetectionMethod,
  TableExtractionOptions,
  TableFinderResult,
} from '../types.js';
import { bboxOverlaps, filterOverlapsBBox } from '../utils/bbox.js';
import { extractText, extractWords } from './text.js';

/** Default table extraction options */
const DEFAULT_OPTIONS: Required<TableExtractionOptions> = {
  verticalStrategy: 'lines',
  horizontalStrategy: 'lines',
  explicitVerticalLines: [],
  explicitHorizontalLines: [],
  snapTolerance: 3,
  joinTolerance: 3,
  edgeMinLength: 3,
  minWordsVertical: 3,
  minWordsHorizontal: 1,
  keepBlankChars: false,
  textTolerance: 3,
  textXTolerance: null,
  textYTolerance: null,
  intersectionTolerance: 3,
  intersectionXTolerance: null,
  intersectionYTolerance: null,
};

/** Edge representation for table finding */
interface Edge {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  orientation: 'h' | 'v';
}

/** Intersection point */
interface Intersection {
  x: number;
  y: number;
}

/** TableFinder class - handles table detection logic */
export class TableFinder {
  private chars: PDFChar[];
  private lines: PDFLine[];
  private rects: PDFRect[];
  private pageNumber: number;
  private options: Required<TableExtractionOptions>;

  private edges: Edge[] = [];
  private intersections: Intersection[] = [];
  private detectionMethod: TableDetectionMethod = 'lines';
  private adaptiveTolerance: number;
  private avgCharWidth: number;
  private avgCharHeight: number;

  constructor(
    chars: PDFChar[],
    lines: PDFLine[],
    rects: PDFRect[],
    pageNumber: number,
    options: TableExtractionOptions = {}
  ) {
    this.chars = chars;
    this.lines = lines;
    this.rects = rects;
    this.pageNumber = pageNumber;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    const { avgWidth, avgHeight } = this.calculateAverageCharSize();
    this.avgCharWidth = avgWidth;
    this.avgCharHeight = avgHeight;
    this.adaptiveTolerance = Math.max(3, avgWidth * 0.5);

    if (options.snapTolerance === undefined) {
      this.options.snapTolerance = this.adaptiveTolerance;
    }
    if (options.joinTolerance === undefined) {
      this.options.joinTolerance = this.adaptiveTolerance;
    }
    if (options.intersectionTolerance === undefined) {
      this.options.intersectionTolerance = this.adaptiveTolerance;
    }

    this.detectionMethod = this.determineDetectionMethod();
  }

  /**
   * Calculate average character width and height
   */
  private calculateAverageCharSize(): { avgWidth: number; avgHeight: number } {
    if (this.chars.length === 0) {
      return { avgWidth: 6, avgHeight: 12 }; // Reasonable defaults
    }

    let totalWidth = 0;
    let totalHeight = 0;
    let count = 0;

    for (const char of this.chars) {
      if (char.text.trim() === '') continue;
      if (char.width > 0 && char.width < 100) {
        totalWidth += char.width;
        count++;
      }
      if (char.height > 0 && char.height < 100) {
        totalHeight += char.height;
      }
    }

    if (count === 0) {
      return { avgWidth: 6, avgHeight: 12 };
    }

    return {
      avgWidth: totalWidth / count,
      avgHeight: totalHeight / count,
    };
  }

  /**
   * Determine the detection method based on available edges
   */
  private determineDetectionMethod(): TableDetectionMethod {
    const hasExplicitV = (this.options.explicitVerticalLines?.length || 0) > 0;
    const hasExplicitH = (this.options.explicitHorizontalLines?.length || 0) > 0;

    if (hasExplicitV || hasExplicitH) {
      return 'explicit';
    }

    const usesLinesV = this.options.verticalStrategy === 'lines' ||
                       this.options.verticalStrategy === 'lines_strict';
    const usesLinesH = this.options.horizontalStrategy === 'lines' ||
                       this.options.horizontalStrategy === 'lines_strict';
    const usesTextV = this.options.verticalStrategy === 'text';
    const usesTextH = this.options.horizontalStrategy === 'text';

    if (usesLinesV && usesLinesH) {
      return 'lines';
    } else if (usesTextV && usesTextH) {
      return 'text';
    } else {
      return 'hybrid';
    }
  }

  /**
   * Find all tables on the page
   */
  findTables(): TableFinderResult {
    this.edges = this.collectEdges();
    this.edges = this.joinEdges(this.edges);
    this.intersections = this.findIntersections(this.edges);
    const tables = this.buildTables();

    return {
      tables,
      edges: this.edges.map((e) => this.edgeToLine(e)),
      intersections: this.intersections,
    };
  }

  /**
   * Collect edges based on the configured strategy
   */
  private collectEdges(): Edge[] {
    const edges: Edge[] = [];

    if (this.options.verticalStrategy === 'explicit') {
      edges.push(...this.getExplicitVerticalEdges());
    } else if (
      this.options.verticalStrategy === 'lines' ||
      this.options.verticalStrategy === 'lines_strict'
    ) {
      edges.push(...this.getVerticalLinesEdges());
    } else if (this.options.verticalStrategy === 'text') {
      edges.push(...this.getTextVerticalEdges());
    }

    if (this.options.horizontalStrategy === 'explicit') {
      edges.push(...this.getExplicitHorizontalEdges());
    } else if (
      this.options.horizontalStrategy === 'lines' ||
      this.options.horizontalStrategy === 'lines_strict'
    ) {
      edges.push(...this.getHorizontalLinesEdges());
    } else if (this.options.horizontalStrategy === 'text') {
      edges.push(...this.getTextHorizontalEdges());
    }

    return edges.filter((e) => this.edgeLength(e) >= this.options.edgeMinLength);
  }

  /**
   * Get vertical edges from explicit positions
   */
  private getExplicitVerticalEdges(): Edge[] {
    const lines = this.options.explicitVerticalLines;
    if (!lines || lines.length === 0) return [];

    const allY = [
      ...this.chars.map((c) => [c.y0, c.y1]).flat(),
      ...this.lines.map((l) => [l.y0, l.y1]).flat(),
      ...this.rects.map((r) => [r.y0, r.y1]).flat(),
    ];

    if (allY.length === 0) return [];

    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);

    return lines.map((line): Edge => {
      const x = typeof line === 'number' ? line : line.x0;
      return { x0: x, y0: minY, x1: x, y1: maxY, orientation: 'v' };
    });
  }

  /**
   * Get horizontal edges from explicit positions
   */
  private getExplicitHorizontalEdges(): Edge[] {
    const lines = this.options.explicitHorizontalLines;
    if (!lines || lines.length === 0) return [];

    const allX = [
      ...this.chars.map((c) => [c.x0, c.x1]).flat(),
      ...this.lines.map((l) => [l.x0, l.x1]).flat(),
      ...this.rects.map((r) => [r.x0, r.x1]).flat(),
    ];

    if (allX.length === 0) return [];

    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);

    return lines.map((line): Edge => {
      const y = typeof line === 'number' ? line : line.y0;
      return { x0: minX, y0: y, x1: maxX, y1: y, orientation: 'h' };
    });
  }

  /**
   * Get vertical edges from graphical lines and rectangles
   */
  private getVerticalLinesEdges(): Edge[] {
    const edges: Edge[] = [];
    const tolerance = this.options.snapTolerance;

    for (const line of this.lines) {
      if (Math.abs(line.x0 - line.x1) <= tolerance) {
        edges.push({
          x0: (line.x0 + line.x1) / 2,
          y0: Math.min(line.y0, line.y1),
          x1: (line.x0 + line.x1) / 2,
          y1: Math.max(line.y0, line.y1),
          orientation: 'v',
        });
      }
    }

    for (const rect of this.rects) {
      if (rect.stroke || rect.fill) {
        edges.push({
          x0: rect.x0,
          y0: rect.y0,
          x1: rect.x0,
          y1: rect.y1,
          orientation: 'v',
        });
        edges.push({
          x0: rect.x1,
          y0: rect.y0,
          x1: rect.x1,
          y1: rect.y1,
          orientation: 'v',
        });
      }
    }

    return edges;
  }

  /**
   * Get horizontal edges from graphical lines and rectangles
   */
  private getHorizontalLinesEdges(): Edge[] {
    const edges: Edge[] = [];
    const tolerance = this.options.snapTolerance;

    for (const line of this.lines) {
      if (Math.abs(line.y0 - line.y1) <= tolerance) {
        edges.push({
          x0: Math.min(line.x0, line.x1),
          y0: (line.y0 + line.y1) / 2,
          x1: Math.max(line.x0, line.x1),
          y1: (line.y0 + line.y1) / 2,
          orientation: 'h',
        });
      }
    }

    for (const rect of this.rects) {
      if (rect.stroke || rect.fill) {
        edges.push({
          x0: rect.x0,
          y0: rect.y0,
          x1: rect.x1,
          y1: rect.y0,
          orientation: 'h',
        });
        edges.push({
          x0: rect.x0,
          y0: rect.y1,
          x1: rect.x1,
          y1: rect.y1,
          orientation: 'h',
        });
      }
    }

    return edges;
  }

  /**
   * Get vertical edges from text alignment
   * Enhanced to detect whitespace gaps and column structure
   */
  private getTextVerticalEdges(): Edge[] {
    const words = extractWords(this.chars, {
      xTolerance: this.options.textXTolerance ?? this.options.textTolerance,
      yTolerance: this.options.textYTolerance ?? this.options.textTolerance,
      keepBlankChars: this.options.keepBlankChars,
    });

    if (words.length < this.options.minWordsVertical) return [];

    const tolerance = this.options.snapTolerance;
    const edges: Edge[] = [];

    edges.push(...this.getAlignedTextEdges(words, tolerance, 'v'));
    edges.push(...this.getWhitespaceColumnEdges(words, tolerance));
    edges.push(...this.getCellCenterEdges(words, tolerance, 'v'));

    return this.deduplicateEdges(edges, tolerance);
  }

  /**
   * Get aligned text edges (left/right alignment detection)
   */
  private getAlignedTextEdges(
    words: PDFWord[],
    tolerance: number,
    orientation: 'h' | 'v'
  ): Edge[] {
    const edges: Edge[] = [];

    if (orientation === 'v') {
      // Group words by left edge (x0) position
      const leftEdgeGroups = this.groupByPosition(words, (w) => w.x0, tolerance);

      for (const [x, group] of leftEdgeGroups) {
        if (group.length >= this.options.minWordsVertical) {
          // Check if words are from different rows (more likely to be table columns)
          const uniqueRows = new Set(group.map((w) => Math.round(w.y0 / tolerance)));
          if (uniqueRows.size >= this.options.minWordsVertical) {
            const minY = Math.min(...group.map((w) => w.y0));
            const maxY = Math.max(...group.map((w) => w.y1));
            edges.push({ x0: x, y0: minY, x1: x, y1: maxY, orientation: 'v' });
          }
        }
      }

      // Group words by right edge (x1) position
      const rightEdgeGroups = this.groupByPosition(words, (w) => w.x1, tolerance);

      for (const [x, group] of rightEdgeGroups) {
        if (group.length >= this.options.minWordsVertical) {
          const uniqueRows = new Set(group.map((w) => Math.round(w.y0 / tolerance)));
          if (uniqueRows.size >= this.options.minWordsVertical) {
            const minY = Math.min(...group.map((w) => w.y0));
            const maxY = Math.max(...group.map((w) => w.y1));
            edges.push({ x0: x, y0: minY, x1: x, y1: maxY, orientation: 'v' });
          }
        }
      }
    } else {
      // Group words by top edge (y0) position
      const topEdgeGroups = this.groupByPosition(words, (w) => w.y0, tolerance);

      for (const [y, group] of topEdgeGroups) {
        if (group.length >= this.options.minWordsHorizontal) {
          const minX = Math.min(...group.map((w) => w.x0));
          const maxX = Math.max(...group.map((w) => w.x1));
          edges.push({ x0: minX, y0: y, x1: maxX, y1: y, orientation: 'h' });
        }
      }

      // Group words by bottom edge (y1) position
      const bottomEdgeGroups = this.groupByPosition(words, (w) => w.y1, tolerance);

      for (const [y, group] of bottomEdgeGroups) {
        if (group.length >= this.options.minWordsHorizontal) {
          const minX = Math.min(...group.map((w) => w.x0));
          const maxX = Math.max(...group.map((w) => w.x1));
          edges.push({ x0: minX, y0: y, x1: maxX, y1: y, orientation: 'h' });
        }
      }
    }

    return edges;
  }

  /**
   * Detect column separators by finding consistent whitespace gaps
   */
  private getWhitespaceColumnEdges(words: PDFWord[], tolerance: number): Edge[] {
    if (words.length < 4) return [];

    const edges: Edge[] = [];

    // Group words by row (y position)
    const rowGroups = this.groupByPosition(words, (w) => w.y0, tolerance * 2);

    // For each row, find gaps between words
    const gapPositions = new Map<number, { count: number; minY: number; maxY: number }>();

    for (const [_, rowWords] of rowGroups) {
      if (rowWords.length < 2) continue;

      // Sort words by x position
      const sortedWords = [...rowWords].sort((a, b) => a.x0 - b.x0);

      for (let i = 0; i < sortedWords.length - 1; i++) {
        const currentWord = sortedWords[i];
        const nextWord = sortedWords[i + 1];
        const gap = nextWord.x0 - currentWord.x1;

        // Significant gap (larger than typical word spacing)
        const avgCharWidth = currentWord.chars.length > 0
          ? (currentWord.x1 - currentWord.x0) / currentWord.chars.length
          : 5;

        if (gap > avgCharWidth * 2) {
          // Gap center as column separator
          const gapCenter = Math.round((currentWord.x1 + nextWord.x0) / 2 / tolerance) * tolerance;

          if (gapPositions.has(gapCenter)) {
            const pos = gapPositions.get(gapCenter)!;
            pos.count++;
            pos.minY = Math.min(pos.minY, Math.min(currentWord.y0, nextWord.y0));
            pos.maxY = Math.max(pos.maxY, Math.max(currentWord.y1, nextWord.y1));
          } else {
            gapPositions.set(gapCenter, {
              count: 1,
              minY: Math.min(currentWord.y0, nextWord.y0),
              maxY: Math.max(currentWord.y1, nextWord.y1),
            });
          }
        }
      }
    }

    // Create edges from consistent gaps (appearing in multiple rows)
    for (const [x, data] of gapPositions) {
      if (data.count >= Math.min(3, rowGroups.size * 0.5)) {
        edges.push({ x0: x, y0: data.minY, x1: x, y1: data.maxY, orientation: 'v' });
      }
    }

    return edges;
  }

  /**
   * Detect edges by cell center clustering
   * Useful for tables with consistent column/row structure
   */
  private getCellCenterEdges(
    words: PDFWord[],
    tolerance: number,
    orientation: 'h' | 'v'
  ): Edge[] {
    if (words.length < 6) return [];

    const edges: Edge[] = [];

    // Group words by row
    const rowGroups = this.groupByPosition(words, (w) => w.y0, tolerance * 2);

    if (rowGroups.size < 3) return [];

    // Find consistent column positions across rows
    const columnCenters = new Map<number, number>();

    for (const [_, rowWords] of rowGroups) {
      for (const word of rowWords) {
        const center = Math.round((word.x0 + word.x1) / 2 / tolerance) * tolerance;
        columnCenters.set(center, (columnCenters.get(center) || 0) + 1);
      }
    }

    // Find the most common column center positions
    const sortedCenters = Array.from(columnCenters.entries())
      .filter(([_, count]) => count >= Math.min(3, rowGroups.size * 0.5))
      .sort((a, b) => a[0] - b[0]);

    if (sortedCenters.length < 2) return [];

    // Create edges between column centers (at midpoints)
    const allY = words.flatMap((w) => [w.y0, w.y1]);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);

    // Add left boundary
    const leftMost = Math.min(...words.map((w) => w.x0));
    edges.push({ x0: leftMost, y0: minY, x1: leftMost, y1: maxY, orientation: 'v' });

    // Add midpoints between column centers as separators
    for (let i = 0; i < sortedCenters.length - 1; i++) {
      const midX = (sortedCenters[i][0] + sortedCenters[i + 1][0]) / 2;
      edges.push({ x0: midX, y0: minY, x1: midX, y1: maxY, orientation: 'v' });
    }

    // Add right boundary
    const rightMost = Math.max(...words.map((w) => w.x1));
    edges.push({ x0: rightMost, y0: minY, x1: rightMost, y1: maxY, orientation: 'v' });

    return edges;
  }

  /**
   * Helper to group items by a position value
   */
  private groupByPosition<T>(
    items: T[],
    getPos: (item: T) => number,
    tolerance: number
  ): Map<number, T[]> {
    const groups = new Map<number, T[]>();

    for (const item of items) {
      const pos = getPos(item);
      let foundGroup = false;

      for (const [groupPos, group] of groups) {
        if (Math.abs(pos - groupPos) <= tolerance) {
          group.push(item);
          foundGroup = true;
          break;
        }
      }

      if (!foundGroup) {
        groups.set(pos, [item]);
      }
    }

    return groups;
  }

  /**
   * Remove duplicate edges
   */
  private deduplicateEdges(edges: Edge[], tolerance: number): Edge[] {
    const unique: Edge[] = [];

    for (const edge of edges) {
      const isDuplicate = unique.some((e) =>
        e.orientation === edge.orientation &&
        Math.abs(e.x0 - edge.x0) <= tolerance &&
        Math.abs(e.y0 - edge.y0) <= tolerance &&
        Math.abs(e.x1 - edge.x1) <= tolerance &&
        Math.abs(e.y1 - edge.y1) <= tolerance
      );

      if (!isDuplicate) {
        unique.push(edge);
      }
    }

    return unique;
  }

  /**
   * Get horizontal edges from text alignment
   * Enhanced to detect row boundaries and consistent spacing
   */
  private getTextHorizontalEdges(): Edge[] {
    const words = extractWords(this.chars, {
      xTolerance: this.options.textXTolerance ?? this.options.textTolerance,
      yTolerance: this.options.textYTolerance ?? this.options.textTolerance,
      keepBlankChars: this.options.keepBlankChars,
    });

    if (words.length < this.options.minWordsHorizontal) return [];

    const tolerance = this.options.snapTolerance;
    const edges: Edge[] = [];

    // Method 1: Aligned text edges
    edges.push(...this.getAlignedTextEdges(words, tolerance, 'h'));

    // Method 2: Row boundary detection (above/below text rows)
    edges.push(...this.getRowBoundaryEdges(words, tolerance));

    // Deduplicate edges
    return this.deduplicateEdges(edges, tolerance);
  }

  /**
   * Detect row boundaries based on text row positions
   */
  private getRowBoundaryEdges(words: PDFWord[], tolerance: number): Edge[] {
    if (words.length < 4) return [];

    const edges: Edge[] = [];

    // Group words by row (y position)
    const rowGroups = this.groupByPosition(words, (w) => w.y0, tolerance * 2);

    if (rowGroups.size < 2) return [];

    // Sort row positions
    const rowPositions = Array.from(rowGroups.entries())
      .map(([y, words]) => ({
        y0: Math.min(...words.map((w) => w.y0)),
        y1: Math.max(...words.map((w) => w.y1)),
        x0: Math.min(...words.map((w) => w.x0)),
        x1: Math.max(...words.map((w) => w.x1)),
        wordCount: words.length,
      }))
      .sort((a, b) => a.y0 - b.y0);

    // Find table-like regions (rows with consistent X bounds)
    const tableRegions = this.findTableRegionsFromRows(rowPositions, tolerance);

    for (const region of tableRegions) {
      const regionRows = rowPositions.slice(region.startRow, region.endRow + 1);
      const x0 = Math.min(...regionRows.map((r) => r.x0));
      const x1 = Math.max(...regionRows.map((r) => r.x1));

      // Add top boundary
      edges.push({
        x0, y0: regionRows[0].y0, x1, y1: regionRows[0].y0, orientation: 'h',
      });

      // Add boundaries between rows
      for (let i = 0; i < regionRows.length - 1; i++) {
        const midY = (regionRows[i].y1 + regionRows[i + 1].y0) / 2;
        edges.push({ x0, y0: midY, x1, y1: midY, orientation: 'h' });
      }

      // Add bottom boundary
      edges.push({
        x0,
        y0: regionRows[regionRows.length - 1].y1,
        x1,
        y1: regionRows[regionRows.length - 1].y1,
        orientation: 'h',
      });
    }

    return edges;
  }

  /**
   * Find table-like regions from row data
   */
  private findTableRegionsFromRows(
    rows: Array<{ y0: number; y1: number; x0: number; x1: number; wordCount: number }>,
    tolerance: number
  ): Array<{ startRow: number; endRow: number }> {
    if (rows.length < 3) return [];

    const regions: Array<{ startRow: number; endRow: number }> = [];

    // Look for consecutive rows with:
    // 1. Similar x bounds (within tolerance)
    // 2. Multiple words per row
    // 3. Consistent row spacing

    let regionStart = -1;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Check if this could be part of a table row
      const isTableLike = row.wordCount >= 2;

      if (isTableLike) {
        if (regionStart === -1) {
          regionStart = i;
        }
      } else {
        if (regionStart !== -1 && i - regionStart >= 3) {
          regions.push({ startRow: regionStart, endRow: i - 1 });
        }
        regionStart = -1;
      }
    }

    // Handle region at end
    if (regionStart !== -1 && rows.length - regionStart >= 3) {
      regions.push({ startRow: regionStart, endRow: rows.length - 1 });
    }

    return regions;
  }

  /**
   * Join nearby collinear edges
   */
  private joinEdges(edges: Edge[]): Edge[] {
    const tolerance = this.options.joinTolerance;
    const result: Edge[] = [];

    // Separate by orientation
    const vertical = edges.filter((e) => e.orientation === 'v');
    const horizontal = edges.filter((e) => e.orientation === 'h');

    // Join vertical edges
    result.push(...this.joinCollinearEdges(vertical, 'v', tolerance));

    // Join horizontal edges
    result.push(...this.joinCollinearEdges(horizontal, 'h', tolerance));

    return result;
  }

  private joinCollinearEdges(
    edges: Edge[],
    orientation: 'h' | 'v',
    tolerance: number
  ): Edge[] {
    if (edges.length === 0) return [];

    // Sort edges
    const sorted = [...edges].sort((a, b) => {
      if (orientation === 'v') {
        return a.x0 - b.x0 || a.y0 - b.y0;
      } else {
        return a.y0 - b.y0 || a.x0 - b.x0;
      }
    });

    const result: Edge[] = [];
    let current = { ...sorted[0] };

    for (let i = 1; i < sorted.length; i++) {
      const edge = sorted[i];

      if (orientation === 'v') {
        // Check if edges are on same vertical line and can be joined
        if (
          Math.abs(edge.x0 - current.x0) <= tolerance &&
          edge.y0 <= current.y1 + tolerance
        ) {
          // Extend current edge
          current.y1 = Math.max(current.y1, edge.y1);
        } else {
          result.push(current);
          current = { ...edge };
        }
      } else {
        // Check if edges are on same horizontal line and can be joined
        if (
          Math.abs(edge.y0 - current.y0) <= tolerance &&
          edge.x0 <= current.x1 + tolerance
        ) {
          // Extend current edge
          current.x1 = Math.max(current.x1, edge.x1);
        } else {
          result.push(current);
          current = { ...edge };
        }
      }
    }

    result.push(current);
    return result;
  }

  /**
   * Find intersections between edges
   */
  private findIntersections(edges: Edge[]): Intersection[] {
    const intersections: Intersection[] = [];
    const xTol = this.options.intersectionXTolerance ?? this.options.intersectionTolerance;
    const yTol = this.options.intersectionYTolerance ?? this.options.intersectionTolerance;

    const vertical = edges.filter((e) => e.orientation === 'v');
    const horizontal = edges.filter((e) => e.orientation === 'h');

    for (const v of vertical) {
      for (const h of horizontal) {
        // Check if they intersect
        if (
          v.x0 >= h.x0 - xTol &&
          v.x0 <= h.x1 + xTol &&
          h.y0 >= v.y0 - yTol &&
          h.y0 <= v.y1 + yTol
        ) {
          // Snap to grid
          const x = this.snapValue(v.x0, xTol);
          const y = this.snapValue(h.y0, yTol);

          // Check if we already have this intersection
          const exists = intersections.some(
            (i) => Math.abs(i.x - x) < xTol && Math.abs(i.y - y) < yTol
          );

          if (!exists) {
            intersections.push({ x, y });
          }
        }
      }
    }

    return intersections;
  }

  /**
   * Build tables from intersections
   */
  private buildTables(): PDFTable[] {
    if (this.intersections.length < 4) return [];

    // First, find separate table regions by clustering intersections
    const tableRegions = this.findTableRegions();
    const tables: PDFTable[] = [];

    for (const regionIntersections of tableRegions) {
      const table = this.buildTableFromIntersections(regionIntersections);
      if (table) {
        tables.push(table);
      }
    }

    // Sort tables by position (top to bottom, left to right)
    tables.sort((a, b) => {
      const yDiff = a.bbox[1] - b.bbox[1];
      if (Math.abs(yDiff) > this.options.snapTolerance) return yDiff;
      return a.bbox[0] - b.bbox[0];
    });

    return tables;
  }

  /**
   * Find separate table regions by clustering intersections
   */
  private findTableRegions(): Intersection[][] {
    if (this.intersections.length === 0) return [];

    const tolerance = this.options.snapTolerance * 2;
    const regions: Intersection[][] = [];
    const assigned = new Set<number>();

    // Helper to check if two intersections could be in the same table
    const areConnected = (a: Intersection, b: Intersection): boolean => {
      // Check if there's an edge connecting these intersections
      const xTol = this.options.intersectionXTolerance ?? this.options.intersectionTolerance;
      const yTol = this.options.intersectionYTolerance ?? this.options.intersectionTolerance;

      // Same row (horizontal edge)
      if (Math.abs(a.y - b.y) <= yTol) {
        // Check if there's a horizontal edge between them
        for (const edge of this.edges) {
          if (edge.orientation === 'h' &&
              Math.abs(edge.y0 - a.y) <= yTol &&
              Math.min(a.x, b.x) >= edge.x0 - xTol &&
              Math.max(a.x, b.x) <= edge.x1 + xTol) {
            return true;
          }
        }
      }

      // Same column (vertical edge)
      if (Math.abs(a.x - b.x) <= xTol) {
        // Check if there's a vertical edge between them
        for (const edge of this.edges) {
          if (edge.orientation === 'v' &&
              Math.abs(edge.x0 - a.x) <= xTol &&
              Math.min(a.y, b.y) >= edge.y0 - yTol &&
              Math.max(a.y, b.y) <= edge.y1 + yTol) {
            return true;
          }
        }
      }

      return false;
    };

    // Use flood-fill to find connected components
    for (let i = 0; i < this.intersections.length; i++) {
      if (assigned.has(i)) continue;

      const region: Intersection[] = [];
      const queue: number[] = [i];

      while (queue.length > 0) {
        const idx = queue.shift()!;
        if (assigned.has(idx)) continue;

        assigned.add(idx);
        region.push(this.intersections[idx]);

        // Find all connected intersections
        for (let j = 0; j < this.intersections.length; j++) {
          if (!assigned.has(j) && areConnected(this.intersections[idx], this.intersections[j])) {
            queue.push(j);
          }
        }
      }

      if (region.length >= 4) {
        regions.push(region);
      }
    }

    return regions;
  }

  /** Calculate confidence score for a table */
  private calculateConfidence(
    table: PDFTable,
    xPositions: number[],
    yPositions: number[],
    intersections: Intersection[]
  ): number {
    let score = 0;
    let factors = 0;

    const numRows = yPositions.length - 1;
    const numCols = xPositions.length - 1;
    const totalCells = numRows * numCols;

    if (totalCells === 0) return 0;

    // Factor 1: Edge completeness (0.3 weight)
    // Count how many expected intersections actually exist
    const expectedIntersections = xPositions.length * yPositions.length;
    const edgeCompleteness = Math.min(1, intersections.length / expectedIntersections);
    score += edgeCompleteness * 0.3;
    factors += 0.3;

    // Factor 2: Cell content coverage (0.25 weight)
    // Count cells with actual text content
    let cellsWithContent = 0;
    let totalValidCells = 0;
    for (const row of table.cells) {
      for (const cell of row) {
        if (cell !== null) {
          totalValidCells++;
          if (cell.text && cell.text.trim().length > 0) {
            cellsWithContent++;
          }
        }
      }
    }
    const contentCoverage = totalValidCells > 0 ? cellsWithContent / totalValidCells : 0;
    // Tables typically should have >50% content coverage
    const contentScore = Math.min(1, contentCoverage / 0.5);
    score += contentScore * 0.25;
    factors += 0.25;

    // Factor 3: Grid regularity (0.2 weight)
    // Check if column widths are reasonably consistent
    const colWidths: number[] = [];
    for (let i = 0; i < xPositions.length - 1; i++) {
      colWidths.push(xPositions[i + 1] - xPositions[i]);
    }
    const rowHeights: number[] = [];
    for (let i = 0; i < yPositions.length - 1; i++) {
      rowHeights.push(yPositions[i + 1] - yPositions[i]);
    }

    // Calculate coefficient of variation (lower = more regular)
    const calcCV = (arr: number[]): number => {
      if (arr.length === 0) return 1;
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      if (mean === 0) return 1;
      const variance = arr.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / arr.length;
      return Math.sqrt(variance) / mean;
    };

    const colCV = calcCV(colWidths);
    const rowCV = calcCV(rowHeights);
    // CV of 0 = perfect regularity (score 1), CV of 1+ = irregular (score 0)
    const regularityScore = Math.max(0, 1 - (colCV + rowCV) / 2);
    score += regularityScore * 0.2;
    factors += 0.2;

    // Factor 4: Detection method reliability (0.15 weight)
    // Lines-based is most reliable, text-based less so
    let methodScore = 0;
    switch (this.detectionMethod) {
      case 'lines':
        methodScore = 1.0;
        break;
      case 'explicit':
        methodScore = 0.95;
        break;
      case 'hybrid':
        methodScore = 0.7;
        break;
      case 'text':
        methodScore = 0.5;
        break;
    }
    score += methodScore * 0.15;
    factors += 0.15;

    // Factor 5: Table size sanity (0.1 weight)
    // Very small (1x1) or very large tables are less likely to be real
    let sizeScore = 1.0;
    if (numRows < 2 || numCols < 2) {
      sizeScore = 0.3; // Minimum viable table
    } else if (numRows >= 2 && numCols >= 2) {
      sizeScore = 1.0;
    }
    if (numRows > 100 || numCols > 50) {
      sizeScore *= 0.5; // Unusually large table
    }
    score += sizeScore * 0.1;
    factors += 0.1;

    // Normalize to 0-1 range
    return Math.min(1, Math.max(0, score / factors));
  }

  /**
   * Build a single table from a set of intersections
   * Enhanced with merged cell detection and confidence scoring
   */
  private buildTableFromIntersections(intersections: Intersection[]): PDFTable | null {
    if (intersections.length < 4) return null;

    // Get unique x and y positions for this region
    const xPositions = [...new Set(intersections.map((i) => i.x))].sort(
      (a, b) => a - b
    );
    const yPositions = [...new Set(intersections.map((i) => i.y))].sort(
      (a, b) => a - b
    );

    if (xPositions.length < 2 || yPositions.length < 2) return null;

    const tolerance = this.options.intersectionTolerance;
    const xTol = this.options.intersectionXTolerance ?? tolerance;
    const yTol = this.options.intersectionYTolerance ?? tolerance;

    // Helper to check if intersection exists
    const hasIntersection = (x: number, y: number): boolean => {
      return intersections.some(
        (i) => Math.abs(i.x - x) <= tolerance && Math.abs(i.y - y) <= tolerance
      );
    };

    const hasHorizontalEdge = (x0: number, x1: number, y: number): boolean => {
      return this.edges.some((e) =>
        e.orientation === 'h' &&
        Math.abs(e.y0 - y) <= yTol &&
        e.x0 <= x0 + xTol &&
        e.x1 >= x1 - xTol
      );
    };

    const hasPartialHorizontalEdge = (x0: number, x1: number, y: number): boolean => {
      const spanWidth = x1 - x0;
      return this.edges.some((e) => {
        if (e.orientation !== 'h' || Math.abs(e.y0 - y) > yTol) return false;
        // Check if edge overlaps at least 30% of the span
        const overlapStart = Math.max(e.x0, x0);
        const overlapEnd = Math.min(e.x1, x1);
        const overlapWidth = overlapEnd - overlapStart;
        return overlapWidth > spanWidth * 0.3;
      });
    };

    const hasVerticalEdge = (y0: number, y1: number, x: number): boolean => {
      return this.edges.some((e) =>
        e.orientation === 'v' &&
        Math.abs(e.x0 - x) <= xTol &&
        e.y0 <= y0 + yTol &&
        e.y1 >= y1 - yTol
      );
    };

    const hasPartialVerticalEdge = (y0: number, y1: number, x: number): boolean => {
      const spanHeight = y1 - y0;
      return this.edges.some((e) => {
        if (e.orientation !== 'v' || Math.abs(e.x0 - x) > xTol) return false;
        // Check if edge overlaps at least 30% of the span
        const overlapStart = Math.max(e.y0, y0);
        const overlapEnd = Math.min(e.y1, y1);
        const overlapHeight = overlapEnd - overlapStart;
        return overlapHeight > spanHeight * 0.3;
      });
    };

    const hasCellBoundary = (
      x: number, y: number, direction: 'h' | 'v', span: { start: number; end: number }
    ): boolean => {
      if (direction === 'h') {
        // Horizontal boundary at y, spanning from span.start to span.end in x
        return hasHorizontalEdge(span.start, span.end, y) ||
               hasPartialHorizontalEdge(span.start, span.end, y);
      } else {
        // Vertical boundary at x, spanning from span.start to span.end in y
        return hasVerticalEdge(span.start, span.end, x) ||
               hasPartialVerticalEdge(span.start, span.end, x);
      }
    };

    // Build cells
    const numRows = yPositions.length - 1;
    const numCols = xPositions.length - 1;

    const rows: (string | null)[][] = [];
    const cells: (TableCell | null)[][] = [];

    // Track which cells are covered by merged cells (row, col) -> true if covered
    const coveredCells = new Set<string>();

    for (let row = 0; row < numRows; row++) {
      const rowData: (string | null)[] = [];
      const rowCells: (TableCell | null)[] = [];

      for (let col = 0; col < numCols; col++) {
        // Check if this cell is covered by a previous merged cell
        if (coveredCells.has(`${row},${col}`)) {
          rowData.push(null);
          rowCells.push(null);
          continue;
        }

        const x0 = xPositions[col];
        const y0 = yPositions[row];
        const rowBottom = yPositions[row + 1];

        let colSpan = 1;
        for (let c = col + 1; c < numCols; c++) {
          const checkX = xPositions[c];

          // Method 1: Check for vertical edge
          const hasFullEdge = hasVerticalEdge(y0, rowBottom, checkX);

          // Method 2: Check for partial edge (for tables with broken lines)
          const hasPartialEdge = hasPartialVerticalEdge(y0, rowBottom, checkX);

          // Method 3: Check for intersection at this column boundary
          const hasCorner = hasIntersection(checkX, y0) || hasIntersection(checkX, rowBottom);

          // If ANY boundary indicator exists, stop the colspan
          if (hasFullEdge || hasPartialEdge || hasCorner) {
            break;
          }

          colSpan++;
        }

        let rowSpan = 1;
        for (let r = row + 1; r < numRows; r++) {
          const checkY = yPositions[r];

          // For rowspan, we need to check across ALL columns of the current colspan
          let hasAnyBoundary = false;
          for (let c = col; c < col + colSpan && c + 1 < xPositions.length; c++) {
            const cellX0 = xPositions[c];
            const cellX1 = xPositions[c + 1];

            // Method 1: Check for horizontal edge
            const hasFullEdge = hasHorizontalEdge(cellX0, cellX1, checkY);

            // Method 2: Check for partial edge
            const hasPartialEdge = hasPartialHorizontalEdge(cellX0, cellX1, checkY);

            // Method 3: Check for intersection at left or right boundary
            const hasCorner = hasIntersection(cellX0, checkY) || hasIntersection(cellX1, checkY);

            if (hasFullEdge || hasPartialEdge || hasCorner) {
              hasAnyBoundary = true;
              break;
            }
          }

          if (hasAnyBoundary) {
            break;
          }

          rowSpan++;
        }

        if (colSpan > 1 || rowSpan > 1) {
          const fullCellBBox: BBox = [x0, y0, xPositions[col + colSpan], yPositions[row + rowSpan]];
          const cellChars = filterOverlapsBBox(this.chars, fullCellBBox);

          if (cellChars.length > 0) {
            // Check if content is concentrated in one area (sign of true merge)
            // vs spread across (sign of false merge)
            const contentMinX = Math.min(...cellChars.map(c => c.x0));
            const contentMaxX = Math.max(...cellChars.map(c => c.x1));
            const contentMinY = Math.min(...cellChars.map(c => c.y0));
            const contentMaxY = Math.max(...cellChars.map(c => c.y1));

            const contentWidth = contentMaxX - contentMinX;
            const contentHeight = contentMaxY - contentMinY;
            const cellWidth = fullCellBBox[2] - fullCellBBox[0];
            const cellHeight = fullCellBBox[3] - fullCellBBox[1];

            // If content spans more than 80% of cell width/height, might be false merge
            // (but only reduce span if we have strong evidence)
            const contentSpansFullWidth = contentWidth > cellWidth * 0.8;
            const contentSpansFullHeight = contentHeight > cellHeight * 0.8;

            // Additional check: if content is in distinct grid positions, reduce span
            if (colSpan > 1 && !contentSpansFullWidth) {
              // Content is concentrated, span is likely correct
            } else if (colSpan > 1 && contentSpansFullWidth) {
              // Check if there's content in each potential column
              let hasContentInMultipleCols = false;
              for (let c = col + 1; c < col + colSpan && c + 1 < xPositions.length; c++) {
                const colMidX = (xPositions[c - 1] + xPositions[c]) / 2;
                const nextColMidX = (xPositions[c] + xPositions[c + 1]) / 2;
                const hasContentInThisCol = cellChars.some(ch =>
                  ch.x0 >= colMidX && ch.x1 <= nextColMidX
                );
                if (hasContentInThisCol) {
                  hasContentInMultipleCols = true;
                }
              }
              // If content is truly in separate columns, don't merge
              // But we can't easily detect this without disrupting valid merges
              // So we leave the span as-is and rely on edge detection
            }
          }
        }

        // Calculate actual cell boundaries (with bounds check)
        const x1Idx = Math.min(col + colSpan, xPositions.length - 1);
        const y1Idx = Math.min(row + rowSpan, yPositions.length - 1);
        const x1 = xPositions[x1Idx];
        const y1 = yPositions[y1Idx];

        // Mark covered cells
        for (let r = row; r < row + rowSpan; r++) {
          for (let c = col; c < col + colSpan; c++) {
            if (r !== row || c !== col) {
              coveredCells.add(`${r},${c}`);
            }
          }
        }

        // Check if at least the corners exist
        if (!hasIntersection(x0, y0) || !hasIntersection(x1, y1)) {
          rowData.push(null);
          rowCells.push(null);
          continue;
        }

        const cellBBox: BBox = [x0, y0, x1, y1];

        // Get chars in this cell
        const cellChars = filterOverlapsBBox(this.chars, cellBBox);
        const cellText = cellChars.length > 0 ? extractText(cellChars).trim() : null;

        rowData.push(cellText);
        rowCells.push(
          cellText !== null || (rowSpan > 1 || colSpan > 1)
            ? {
                text: cellText || '',
                x0: cellBBox[0],
                y0: cellBBox[1],
                x1: cellBBox[2],
                y1: cellBBox[3],
                top: cellBBox[1],
                bottom: cellBBox[3],
                rowSpan: rowSpan > 1 ? rowSpan : undefined,
                colSpan: colSpan > 1 ? colSpan : undefined,
              }
            : null
        );
      }

      rows.push(rowData);
      cells.push(rowCells);
    }

    const bbox: BBox = [
      xPositions[0],
      yPositions[0],
      xPositions[xPositions.length - 1],
      yPositions[yPositions.length - 1],
    ];

    // Create table object first (without confidence for calculation)
    const table: PDFTable = {
      rows,
      cells,
      bbox,
      pageNumber: this.pageNumber,
      detectionMethod: this.detectionMethod,
    };

    const confidence = this.calculateConfidence(table, xPositions, yPositions, intersections);
    table.confidence = Math.round(confidence * 100) / 100; // Round to 2 decimal places

    return table;
  }

  private edgeLength(edge: Edge): number {
    const dx = edge.x1 - edge.x0;
    const dy = edge.y1 - edge.y0;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private snapValue(value: number, tolerance: number): number {
    return Math.round(value / tolerance) * tolerance;
  }

  private edgeToLine(edge: Edge): PDFLine {
    return {
      x0: edge.x0,
      y0: edge.y0,
      x1: edge.x1,
      y1: edge.y1,
      top: Math.min(edge.y0, edge.y1),
      bottom: Math.max(edge.y0, edge.y1),
      doctop: Math.min(edge.y0, edge.y1),
      lineWidth: 1,
      strokingColor: null,
      stroke: true,
      pageNumber: this.pageNumber,
    };
  }

  /** Detect borderless tables using projection profile analysis */
  detectByProjectionProfile(): PDFTable[] {
    if (this.chars.length < 10) return [];

    const tables: PDFTable[] = [];

    // Get the bounds of all characters
    const allX = this.chars.map(c => [c.x0, c.x1]).flat();
    const allY = this.chars.map(c => [c.y0, c.y1]).flat();

    if (allX.length === 0 || allY.length === 0) return [];

    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);

    // Create horizontal projection (character density by Y position)
    // This helps identify row boundaries
    const horizontalBins = this.createProjectionProfile(
      this.chars,
      'horizontal',
      minY,
      maxY,
      this.avgCharHeight
    );

    // Create vertical projection (character density by X position)
    // This helps identify column boundaries
    const verticalBins = this.createProjectionProfile(
      this.chars,
      'vertical',
      minX,
      maxX,
      this.avgCharWidth
    );

    // Find row boundaries from horizontal projection (valleys in the profile)
    const rowBoundaries = this.findBoundariesFromProfile(horizontalBins, minY, this.avgCharHeight);

    // Find column boundaries from vertical projection (valleys in the profile)
    const colBoundaries = this.findBoundariesFromProfile(verticalBins, minX, this.avgCharWidth);

    // Need at least 2 rows and 2 columns to form a table
    if (rowBoundaries.length < 3 || colBoundaries.length < 3) return [];

    // Validate that this looks like a table (consistent row/column structure)
    const isValidTable = this.validateProjectionTable(rowBoundaries, colBoundaries);

    if (!isValidTable) return [];

    // Build table from projection boundaries
    const table = this.buildTableFromProjection(rowBoundaries, colBoundaries);

    if (table) {
      table.detectionMethod = 'text';
      tables.push(table);
    }

    return tables;
  }

  /**
   * Create a projection profile (histogram) of character density
   */
  private createProjectionProfile(
    chars: PDFChar[],
    direction: 'horizontal' | 'vertical',
    min: number,
    max: number,
    binSize: number
  ): number[] {
    const numBins = Math.ceil((max - min) / binSize) + 1;
    const bins = new Array(numBins).fill(0);

    for (const char of chars) {
      if (char.text.trim() === '') continue;

      const pos = direction === 'horizontal'
        ? (char.y0 + char.y1) / 2
        : (char.x0 + char.x1) / 2;

      const binIndex = Math.floor((pos - min) / binSize);
      if (binIndex >= 0 && binIndex < numBins) {
        bins[binIndex]++;
      }
    }

    return bins;
  }

  /**
   * Find boundaries (peaks and valleys) in a projection profile
   */
  private findBoundariesFromProfile(
    profile: number[],
    offset: number,
    binSize: number
  ): number[] {
    const boundaries: number[] = [];
    const threshold = Math.max(1, Math.max(...profile) * 0.1); // 10% of max

    // Add start boundary
    boundaries.push(offset);

    // Find valleys (low points) in the profile
    for (let i = 1; i < profile.length - 1; i++) {
      const prev = profile[i - 1];
      const curr = profile[i];
      const next = profile[i + 1];

      // Valley: current is lower than neighbors and below threshold
      if (curr <= prev && curr <= next && curr < threshold) {
        const boundaryPos = offset + (i + 0.5) * binSize;
        boundaries.push(boundaryPos);
      }
    }

    // Add end boundary
    boundaries.push(offset + profile.length * binSize);

    // Remove duplicate/close boundaries
    return this.deduplicateBoundaries(boundaries, binSize * 0.5);
  }

  /**
   * Remove boundaries that are too close together
   */
  private deduplicateBoundaries(boundaries: number[], minGap: number): number[] {
    if (boundaries.length === 0) return [];

    const sorted = [...boundaries].sort((a, b) => a - b);
    const result: number[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - result[result.length - 1] >= minGap) {
        result.push(sorted[i]);
      }
    }

    return result;
  }

  /**
   * Validate that projection boundaries form a valid table structure
   */
  private validateProjectionTable(rowBoundaries: number[], colBoundaries: number[]): boolean {
    // Need at least 2 rows and 2 columns
    const numRows = rowBoundaries.length - 1;
    const numCols = colBoundaries.length - 1;

    if (numRows < 2 || numCols < 2) return false;

    // Check that most cells have content
    let cellsWithContent = 0;
    const totalCells = numRows * numCols;

    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const cellBBox: BBox = [
          colBoundaries[c],
          rowBoundaries[r],
          colBoundaries[c + 1],
          rowBoundaries[r + 1],
        ];

        const cellChars = filterOverlapsBBox(this.chars, cellBBox);
        if (cellChars.length > 0) {
          cellsWithContent++;
        }
      }
    }

    // At least 30% of cells should have content
    return cellsWithContent >= totalCells * 0.3;
  }

  /**
   * Build a table from projection boundaries
   */
  private buildTableFromProjection(
    rowBoundaries: number[],
    colBoundaries: number[]
  ): PDFTable | null {
    const numRows = rowBoundaries.length - 1;
    const numCols = colBoundaries.length - 1;

    const rows: (string | null)[][] = [];
    const cells: (TableCell | null)[][] = [];

    for (let r = 0; r < numRows; r++) {
      const rowData: (string | null)[] = [];
      const rowCells: (TableCell | null)[] = [];

      for (let c = 0; c < numCols; c++) {
        const x0 = colBoundaries[c];
        const y0 = rowBoundaries[r];
        const x1 = colBoundaries[c + 1];
        const y1 = rowBoundaries[r + 1];

        const cellBBox: BBox = [x0, y0, x1, y1];
        const cellChars = filterOverlapsBBox(this.chars, cellBBox);
        const cellText = cellChars.length > 0 ? extractText(cellChars).trim() : null;

        rowData.push(cellText);
        rowCells.push(
          cellText !== null
            ? {
                text: cellText,
                x0, y0, x1, y1,
                top: y0,
                bottom: y1,
              }
            : null
        );
      }

      rows.push(rowData);
      cells.push(rowCells);
    }

    const bbox: BBox = [
      colBoundaries[0],
      rowBoundaries[0],
      colBoundaries[colBoundaries.length - 1],
      rowBoundaries[rowBoundaries.length - 1],
    ];

    const table: PDFTable = {
      rows,
      cells,
      bbox,
      pageNumber: this.pageNumber,
      detectionMethod: 'text',
    };

    // Calculate confidence for projection-based table (generally lower)
    const confidence = this.calculateProjectionConfidence(table, rowBoundaries, colBoundaries);
    table.confidence = Math.round(confidence * 100) / 100;

    return table;
  }

  /**
   * Calculate confidence for projection-based table detection
   */
  private calculateProjectionConfidence(
    table: PDFTable,
    rowBoundaries: number[],
    colBoundaries: number[]
  ): number {
    let score = 0;

    const numRows = rowBoundaries.length - 1;
    const numCols = colBoundaries.length - 1;

    // Factor 1: Cell content coverage (most important for borderless tables)
    let cellsWithContent = 0;
    let totalCells = 0;
    for (const row of table.cells) {
      for (const cell of row) {
        totalCells++;
        if (cell && cell.text && cell.text.trim().length > 0) {
          cellsWithContent++;
        }
      }
    }
    const contentCoverage = totalCells > 0 ? cellsWithContent / totalCells : 0;
    score += Math.min(1, contentCoverage / 0.4) * 0.4; // 40% weight

    // Factor 2: Column alignment consistency
    const alignmentScore = this.calculateColumnAlignmentScore(table);
    score += alignmentScore * 0.25; // 25% weight

    // Factor 3: Row regularity (similar heights)
    const rowHeights = [];
    for (let i = 0; i < rowBoundaries.length - 1; i++) {
      rowHeights.push(rowBoundaries[i + 1] - rowBoundaries[i]);
    }
    const heightVariance = this.calculateVarianceCoefficient(rowHeights);
    const regularityScore = Math.max(0, 1 - heightVariance);
    score += regularityScore * 0.2; // 20% weight

    // Factor 4: Table size (penalize very small or very large)
    let sizeScore = 1.0;
    if (numRows < 3 || numCols < 2) sizeScore = 0.5;
    if (numRows > 50 || numCols > 20) sizeScore = 0.7;
    score += sizeScore * 0.15; // 15% weight

    // Projection-based detection starts with lower base confidence
    return Math.min(0.85, score); // Cap at 0.85 since no graphical evidence
  }

  /**
   * Calculate column alignment score
   */
  private calculateColumnAlignmentScore(table: PDFTable): number {
    const numCols = table.cells[0]?.length || 0;
    if (numCols === 0) return 0;

    let alignedCols = 0;

    for (let c = 0; c < numCols; c++) {
      const leftEdges: number[] = [];
      for (const row of table.cells) {
        const cell = row[c];
        if (cell && cell.text && cell.text.trim()) {
          leftEdges.push(cell.x0);
        }
      }

      if (leftEdges.length >= 2) {
        // Check if left edges are aligned (low variance)
        const variance = this.calculateVarianceCoefficient(leftEdges);
        if (variance < 0.1) alignedCols++;
      }
    }

    return numCols > 0 ? alignedCols / numCols : 0;
  }

  /**
   * Calculate coefficient of variation (standard deviation / mean)
   * Returns 1 (high irregularity) for edge cases to indicate low confidence
   */
  private calculateVarianceCoefficient(values: number[]): number {
    if (values.length < 2) return 1; // Need at least 2 values for meaningful variance
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean <= 0) return 1; // Cannot calculate CV for zero or negative mean
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / mean;
  }

  /** Find nested tables within cells of a parent table */
  findNestedTables(parentTable: PDFTable, maxDepth: number = 2): PDFTable {
    if (maxDepth <= 0) return parentTable;

    const nestedTables: PDFTable[] = [];

    for (let r = 0; r < parentTable.cells.length; r++) {
      for (let c = 0; c < parentTable.cells[r].length; c++) {
        const cell = parentTable.cells[r][c];
        if (!cell) continue;

        // Get characters within this cell
        const cellBBox: BBox = [cell.x0, cell.y0, cell.x1, cell.y1];
        const cellChars = filterOverlapsBBox(this.chars, cellBBox);

        // Need enough content to potentially form a table
        if (cellChars.length < 10) continue;

        // Get lines and rects within this cell
        const cellLines = this.lines.filter(l =>
          l.x0 >= cell.x0 && l.x1 <= cell.x1 && l.y0 >= cell.y0 && l.y1 <= cell.y1
        );
        const cellRects = this.rects.filter(r =>
          r.x0 >= cell.x0 && r.x1 <= cell.x1 && r.y0 >= cell.y0 && r.y1 <= cell.y1
        );

        // Try to find tables within this cell
        const cellFinder = new TableFinder(
          cellChars,
          cellLines,
          cellRects,
          this.pageNumber,
          { ...this.options, minWordsVertical: 2, minWordsHorizontal: 1 }
        );

        const cellResult = cellFinder.findTables();

        for (const nestedTable of cellResult.tables) {
          // Only consider tables that are significantly smaller than the cell
          const tableBBox = nestedTable.bbox;
          const tableWidth = tableBBox[2] - tableBBox[0];
          const tableHeight = tableBBox[3] - tableBBox[1];
          const cellWidth = cell.x1 - cell.x0;
          const cellHeight = cell.y1 - cell.y0;

          // Table should be at least 20% smaller than cell in both dimensions
          // to avoid detecting the parent cell's content as a nested table
          if (tableWidth < cellWidth * 0.8 || tableHeight < cellHeight * 0.8) {
            nestedTable.parentCell = { row: r, col: c };
            // Recursively find nested tables (with depth limit)
            const tableWithNested = this.findNestedTables(nestedTable, maxDepth - 1);
            nestedTables.push(tableWithNested);
          }
        }
      }
    }

    if (nestedTables.length > 0) {
      parentTable.nestedTables = nestedTables;
    }

    return parentTable;
  }
}

/**
 * Extract all tables from a page
 */
export function extractTables(
  chars: PDFChar[],
  lines: PDFLine[],
  rects: PDFRect[],
  pageNumber: number,
  options: TableExtractionOptions = {}
): PDFTable[] {
  const finder = new TableFinder(chars, lines, rects, pageNumber, options);
  const result = finder.findTables();
  return result.tables;
}

/**
 * Find tables with debug information
 */
export function findTables(
  chars: PDFChar[],
  lines: PDFLine[],
  rects: PDFRect[],
  pageNumber: number,
  options: TableExtractionOptions = {}
): TableFinderResult {
  const finder = new TableFinder(chars, lines, rects, pageNumber, options);
  return finder.findTables();
}

/**
 * Extract a single table (first one found)
 */
export function extractTable(
  chars: PDFChar[],
  lines: PDFLine[],
  rects: PDFRect[],
  pageNumber: number,
  options: TableExtractionOptions = {}
): PDFTable | null {
  const tables = extractTables(chars, lines, rects, pageNumber, options);
  return tables[0] || null;
}

/**
 * Debug table finder - returns visual debugging data
 */
export function debugTableFinder(
  chars: PDFChar[],
  lines: PDFLine[],
  rects: PDFRect[],
  pageNumber: number,
  options: TableExtractionOptions = {}
): TableFinderResult {
  return findTables(chars, lines, rects, pageNumber, options);
}

/** Detect borderless tables using projection profile analysis */
export function detectBorderlessTables(
  chars: PDFChar[],
  pageNumber: number,
  options: TableExtractionOptions = {}
): PDFTable[] {
  const finder = new TableFinder(chars, [], [], pageNumber, options);
  return finder.detectByProjectionProfile();
}

/** Find nested tables within cells of existing tables */
export function findNestedTables(
  table: PDFTable,
  chars: PDFChar[],
  lines: PDFLine[],
  rects: PDFRect[],
  maxDepth: number = 2,
  options: TableExtractionOptions = {}
): PDFTable {
  const finder = new TableFinder(chars, lines, rects, table.pageNumber, options);
  return finder.findNestedTables(table, maxDepth);
}

/** Extract tables with all detection methods combined */
export function extractTablesEnhanced(
  chars: PDFChar[],
  lines: PDFLine[],
  rects: PDFRect[],
  pageNumber: number,
  options: TableExtractionOptions = {},
  detectNested: boolean = false
): PDFTable[] {
  const finder = new TableFinder(chars, lines, rects, pageNumber, options);
  const result = finder.findTables();

  let tables = result.tables;

  // If no tables found with lines, try projection profile
  if (tables.length === 0 && chars.length > 10) {
    const projectionTables = finder.detectByProjectionProfile();
    tables = projectionTables;
  }

  // Optionally detect nested tables
  if (detectNested && tables.length > 0) {
    tables = tables.map(table => finder.findNestedTables(table, 2));
  }

  return tables;
}
