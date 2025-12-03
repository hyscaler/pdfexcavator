/**
 * Bounding box utilities for region selection and filtering
 */

import type { BBox } from '../types.js';

/** Normalize a bounding box to ensure x0 <= x1 and y0 <= y1 */
export function normalizeBBox(bbox: BBox): BBox {
  const [x0, y0, x1, y1] = bbox;
  return [
    Math.min(x0, x1),
    Math.min(y0, y1),
    Math.max(x0, x1),
    Math.max(y0, y1),
  ];
}

/** Check if a bounding box is valid (has positive area) */
export function isValidBBox(bbox: BBox): boolean {
  const [x0, y0, x1, y1] = bbox;
  return x1 > x0 && y1 > y0;
}

/** Check if a point is within a bounding box */
export function pointInBBox(x: number, y: number, bbox: BBox): boolean {
  const [x0, y0, x1, y1] = normalizeBBox(bbox);
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

/** Check if two bounding boxes overlap */
export function bboxOverlaps(a: BBox, b: BBox): boolean {
  const [ax0, ay0, ax1, ay1] = a;
  const [bx0, by0, bx1, by1] = b;
  return ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0;
}

/** Check if bounding box A is completely within bounding box B */
export function bboxWithin(inner: BBox, outer: BBox): boolean {
  const [ix0, iy0, ix1, iy1] = inner;
  const [ox0, oy0, ox1, oy1] = outer;
  return ix0 >= ox0 && iy0 >= oy0 && ix1 <= ox1 && iy1 <= oy1;
}

/** Check if bounding box A is completely outside bounding box B */
export function bboxOutside(a: BBox, b: BBox): boolean {
  return !bboxOverlaps(a, b);
}

/** Get the intersection of two bounding boxes */
export function bboxIntersection(a: BBox, b: BBox): BBox | null {
  const [ax0, ay0, ax1, ay1] = a;
  const [bx0, by0, bx1, by1] = b;

  const x0 = Math.max(ax0, bx0);
  const y0 = Math.max(ay0, by0);
  const x1 = Math.min(ax1, bx1);
  const y1 = Math.min(ay1, by1);

  if (x0 >= x1 || y0 >= y1) {
    return null;
  }

  return [x0, y0, x1, y1];
}

/** Get the union (merged) bounding box of two boxes */
export function bboxUnion(a: BBox, b: BBox): BBox {
  return [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[2], b[2]),
    Math.max(a[3], b[3]),
  ];
}

/** Get bounding box from an object with x0, y0, x1, y1 properties */
export function getBBox(obj: { x0: number; y0: number; x1: number; y1: number }): BBox {
  return [obj.x0, obj.y0, obj.x1, obj.y1];
}

/** Calculate the area of a bounding box */
export function bboxArea(bbox: BBox): number {
  const [x0, y0, x1, y1] = bbox;
  return (x1 - x0) * (y1 - y0);
}

/** Get the center point of a bounding box */
export function bboxCenter(bbox: BBox): { x: number; y: number } {
  const [x0, y0, x1, y1] = bbox;
  return {
    x: (x0 + x1) / 2,
    y: (y0 + y1) / 2,
  };
}

/** Expand a bounding box by a margin */
export function bboxExpand(bbox: BBox, margin: number): BBox {
  const [x0, y0, x1, y1] = bbox;
  return [x0 - margin, y0 - margin, x1 + margin, y1 + margin];
}

/** Filter objects by bounding box - keep those within the bbox */
export function filterWithinBBox<T extends { x0: number; y0: number; x1: number; y1: number }>(
  objects: T[],
  bbox: BBox
): T[] {
  return objects.filter((obj) => bboxWithin(getBBox(obj), bbox));
}

/** Filter objects by bounding box - keep those overlapping the bbox */
export function filterOverlapsBBox<T extends { x0: number; y0: number; x1: number; y1: number }>(
  objects: T[],
  bbox: BBox
): T[] {
  return objects.filter((obj) => bboxOverlaps(getBBox(obj), bbox));
}

/** Filter objects by bounding box - keep those outside the bbox */
export function filterOutsideBBox<T extends { x0: number; y0: number; x1: number; y1: number }>(
  objects: T[],
  bbox: BBox
): T[] {
  return objects.filter((obj) => bboxOutside(getBBox(obj), bbox));
}
