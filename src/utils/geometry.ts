/**
 * Geometry utilities for line detection and table analysis
 */

import type { PDFLine, PDFRect } from '../types.js';

/** Tolerance for considering lines as aligned */
const DEFAULT_SNAP_TOLERANCE = 3;

/** Check if two numbers are approximately equal */
export function approxEqual(a: number, b: number, tolerance = DEFAULT_SNAP_TOLERANCE): boolean {
  return Math.abs(a - b) <= tolerance;
}

/** Check if a line is horizontal */
export function isHorizontalLine(line: PDFLine, tolerance = DEFAULT_SNAP_TOLERANCE): boolean {
  return approxEqual(line.y0, line.y1, tolerance);
}

/** Check if a line is vertical */
export function isVerticalLine(line: PDFLine, tolerance = DEFAULT_SNAP_TOLERANCE): boolean {
  return approxEqual(line.x0, line.x1, tolerance);
}

/** Get horizontal lines from a collection of line segments */
export function getHorizontalLines(
  lines: PDFLine[],
  tolerance = DEFAULT_SNAP_TOLERANCE
): PDFLine[] {
  return lines.filter((line) => isHorizontalLine(line, tolerance));
}

/** Get vertical lines from a collection of line segments */
export function getVerticalLines(
  lines: PDFLine[],
  tolerance = DEFAULT_SNAP_TOLERANCE
): PDFLine[] {
  return lines.filter((line) => isVerticalLine(line, tolerance));
}

/** Group lines by their Y position (for horizontal lines) */
export function groupHorizontalLines(
  lines: PDFLine[],
  tolerance = DEFAULT_SNAP_TOLERANCE
): Map<number, PDFLine[]> {
  const groups = new Map<number, PDFLine[]>();

  for (const line of lines) {
    if (!isHorizontalLine(line, tolerance)) continue;

    const y = line.y0;
    let foundGroup = false;

    for (const [groupY, groupLines] of groups) {
      if (approxEqual(y, groupY, tolerance)) {
        groupLines.push(line);
        foundGroup = true;
        break;
      }
    }

    if (!foundGroup) {
      groups.set(y, [line]);
    }
  }

  return groups;
}

/** Group lines by their X position (for vertical lines) */
export function groupVerticalLines(
  lines: PDFLine[],
  tolerance = DEFAULT_SNAP_TOLERANCE
): Map<number, PDFLine[]> {
  const groups = new Map<number, PDFLine[]>();

  for (const line of lines) {
    if (!isVerticalLine(line, tolerance)) continue;

    const x = line.x0;
    let foundGroup = false;

    for (const [groupX, groupLines] of groups) {
      if (approxEqual(x, groupX, tolerance)) {
        groupLines.push(line);
        foundGroup = true;
        break;
      }
    }

    if (!foundGroup) {
      groups.set(x, [line]);
    }
  }

  return groups;
}

/** Convert rectangles to line segments (for table detection) */
export function rectsToLines(rects: PDFRect[]): PDFLine[] {
  const lines: PDFLine[] = [];

  for (const rect of rects) {
    if (!rect.stroke) continue;

    const { x0, y0, x1, y1, lineWidth, strokingColor, pageNumber } = rect;
    const baseProps = {
      lineWidth,
      strokingColor,
      stroke: true,
      pageNumber,
    };

    // Top edge
    lines.push({
      x0, y0, x1, y1: y0,
      top: y0, bottom: y0, doctop: rect.doctop,
      ...baseProps,
    });
    // Bottom edge
    lines.push({
      x0, y0: y1, x1, y1,
      top: y1, bottom: y1, doctop: rect.doctop + rect.height,
      ...baseProps,
    });
    // Left edge
    lines.push({
      x0, y0, x1: x0, y1,
      top: y0, bottom: y1, doctop: rect.doctop,
      ...baseProps,
    });
    // Right edge
    lines.push({
      x0: x1, y0, x1, y1,
      top: y0, bottom: y1, doctop: rect.doctop,
      ...baseProps,
    });
  }

  return lines;
}

/** Find unique Y positions from horizontal lines (sorted) */
export function getUniqueYPositions(
  lines: PDFLine[],
  tolerance = DEFAULT_SNAP_TOLERANCE
): number[] {
  const horizontalLines = getHorizontalLines(lines, tolerance);
  const yPositions: number[] = [];

  for (const line of horizontalLines) {
    const y = line.y0;
    if (!yPositions.some((pos) => approxEqual(pos, y, tolerance))) {
      yPositions.push(y);
    }
  }

  return yPositions.sort((a, b) => a - b);
}

/** Find unique X positions from vertical lines (sorted) */
export function getUniqueXPositions(
  lines: PDFLine[],
  tolerance = DEFAULT_SNAP_TOLERANCE
): number[] {
  const verticalLines = getVerticalLines(lines, tolerance);
  const xPositions: number[] = [];

  for (const line of verticalLines) {
    const x = line.x0;
    if (!xPositions.some((pos) => approxEqual(pos, x, tolerance))) {
      xPositions.push(x);
    }
  }

  return xPositions.sort((a, b) => a - b);
}

/** Calculate line length */
export function lineLength(line: PDFLine): number {
  const dx = line.x1 - line.x0;
  const dy = line.y1 - line.y0;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Check if two line segments intersect */
export function linesIntersect(a: PDFLine, b: PDFLine): boolean {
  const { x0: ax0, y0: ay0, x1: ax1, y1: ay1 } = a;
  const { x0: bx0, y0: by0, x1: bx1, y1: by1 } = b;

  const d1 = direction(bx0, by0, bx1, by1, ax0, ay0);
  const d2 = direction(bx0, by0, bx1, by1, ax1, ay1);
  const d3 = direction(ax0, ay0, ax1, ay1, bx0, by0);
  const d4 = direction(ax0, ay0, ax1, ay1, bx1, by1);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  if (d1 === 0 && onSegment(bx0, by0, bx1, by1, ax0, ay0)) return true;
  if (d2 === 0 && onSegment(bx0, by0, bx1, by1, ax1, ay1)) return true;
  if (d3 === 0 && onSegment(ax0, ay0, ax1, ay1, bx0, by0)) return true;
  if (d4 === 0 && onSegment(ax0, ay0, ax1, ay1, bx1, by1)) return true;

  return false;
}

function direction(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  px: number,
  py: number
): number {
  return (x1 - x0) * (py - y0) - (y1 - y0) * (px - x0);
}

function onSegment(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  px: number,
  py: number
): boolean {
  return (
    Math.min(x0, x1) <= px &&
    px <= Math.max(x0, x1) &&
    Math.min(y0, y1) <= py &&
    py <= Math.max(y0, y1)
  );
}

/**
 * Cluster objects by a numeric key with tolerance
 * Groups objects where adjacent values (after sorting) are within tolerance
 *
 * @param objects - Array of objects to cluster
 * @param keyFn - Function to extract numeric key from object
 * @param tolerance - Maximum difference between adjacent values in a cluster
 * @returns Array of clusters, each cluster is an array of objects
 *
 * @example
 * ```ts
 * // Cluster characters by their y position (group into lines)
 * const lines = clusterObjects(chars, c => c.y0, 3);
 *
 * // Cluster by x position (group into columns)
 * const columns = clusterObjects(chars, c => c.x0, 10);
 * ```
 */
export function clusterObjects<T>(
  objects: T[],
  keyFn: (obj: T) => number,
  tolerance: number = DEFAULT_SNAP_TOLERANCE
): T[][] {
  if (objects.length === 0) return [];

  // Sort objects by their key value
  const sorted = [...objects].sort((a, b) => keyFn(a) - keyFn(b));

  const clusters: T[][] = [];
  let currentCluster: T[] = [sorted[0]];
  let currentKey = keyFn(sorted[0]);

  for (let i = 1; i < sorted.length; i++) {
    const obj = sorted[i];
    const key = keyFn(obj);

    if (key - currentKey <= tolerance) {
      // Within tolerance, add to current cluster
      currentCluster.push(obj);
    } else {
      // Start new cluster
      clusters.push(currentCluster);
      currentCluster = [obj];
    }
    currentKey = key;
  }

  // Don't forget the last cluster
  clusters.push(currentCluster);

  return clusters;
}

/**
 * Cluster objects into groups using average linkage
 * More sophisticated clustering that considers the cluster's centroid
 *
 * @param objects - Array of objects to cluster
 * @param keyFn - Function to extract numeric key from object
 * @param tolerance - Maximum distance from cluster centroid
 * @returns Array of clusters
 */
export function clusterObjectsByMean<T>(
  objects: T[],
  keyFn: (obj: T) => number,
  tolerance: number = DEFAULT_SNAP_TOLERANCE
): T[][] {
  if (objects.length === 0) return [];

  // Sort objects by their key value
  const sorted = [...objects].sort((a, b) => keyFn(a) - keyFn(b));

  const clusters: { items: T[]; sum: number; mean: number }[] = [];

  for (const obj of sorted) {
    const key = keyFn(obj);
    let added = false;

    // Find a cluster whose mean is within tolerance
    for (const cluster of clusters) {
      if (Math.abs(key - cluster.mean) <= tolerance) {
        cluster.items.push(obj);
        cluster.sum += key;
        cluster.mean = cluster.sum / cluster.items.length;
        added = true;
        break;
      }
    }

    if (!added) {
      clusters.push({ items: [obj], sum: key, mean: key });
    }
  }

  return clusters.map(c => c.items);
}
