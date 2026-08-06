/**
 * Sketch recognition for the smart drawing tool.
 *
 * Draw a rough shape freehand and this decides what you meant, so the stroke
 * can be replaced with a clean library shape. Everything here is pure geometry
 * on the stroke's points — no model, no network call.
 *
 * The approach: simplify the stroke to its corners with Ramer–Douglas–Peucker,
 * decide whether it closes, then classify by corner count, with a separate
 * roundness test that catches circles before corner counting can misfire on
 * them (a hand-drawn circle simplifies to a polygon with an arbitrary number
 * of vertices).
 */

export interface Point {
  x: number;
  y: number;
}

export interface RecognizedShape {
  /** Id in `shapes/shapeLibrary.ts`, or null for line-like results. */
  shapeId: string | null;
  /** Set instead of shapeId when the stroke was a straight line. */
  line?: { from: Point; to: Point };
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/** Perpendicular distance from p to the segment ab. */
const perpendicularDistance = (p: Point, a: Point, b: Point): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance(p, a);

  // Project p onto ab, clamped to the segment.
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
};

/** Ramer–Douglas–Peucker: drop points that do not change the shape's outline. */
const simplify = (points: Point[], epsilon: number): Point[] => {
  if (points.length < 3) return points;

  let maxDist = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist <= epsilon) return [first, last];

  const left = simplify(points.slice(0, index + 1), epsilon);
  const right = simplify(points.slice(index), epsilon);
  return [...left.slice(0, -1), ...right];
};

const pathLength = (points: Point[]): number => {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
  return total;
};

/**
 * Count the genuinely sharp corners of a closed polygon.
 *
 * This is what separates a polygon from a circle, and it is more reliable than
 * measuring how circular the stroke is: sampled around its perimeter, a square
 * varies its radius by only ~11%, which is close enough to a circle that a
 * roundness test misclassifies it. Turn angles are unambiguous — a square turns
 * 90° four times, while a circle turns a little at every step and never sharply.
 */
const countSharpCorners = (corners: Point[], thresholdDeg = 40): number => {
  if (corners.length < 3) return 0;
  const threshold = (thresholdDeg * Math.PI) / 180;
  let sharp = 0;

  for (let i = 0; i < corners.length; i++) {
    const prev = corners[(i - 1 + corners.length) % corners.length];
    const curr = corners[i];
    const next = corners[(i + 1) % corners.length];

    const inAngle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
    const outAngle = Math.atan2(next.y - curr.y, next.x - curr.x);

    // Normalise the turn into [-π, π].
    let turn = outAngle - inAngle;
    while (turn > Math.PI) turn -= 2 * Math.PI;
    while (turn < -Math.PI) turn += 2 * Math.PI;

    if (Math.abs(turn) > threshold) sharp++;
  }

  return sharp;
};

/**
 * How well the stroke fits an ellipse inscribed in its bounding box.
 *
 * Needed because a flat ellipse curves sharply at its two ends, and those ends
 * register as sharp corners — a 280x120 oval was being read as a triangle.
 * Returns the mean deviation from the ellipse equation, so 0 is a perfect fit.
 * A hexagon scores about 0.15 and a square about 0.35, well clear of the
 * threshold used below.
 */
const ellipseFit = (points: Point[], box: { x: number; y: number; width: number; height: number }): number => {
  const a = box.width / 2;
  const b = box.height / 2;
  if (a < 1 || b < 1) return 1;

  const cx = box.x + a;
  const cy = box.y + b;

  const deviations = points.map((p) => {
    const value = ((p.x - cx) / a) ** 2 + ((p.y - cy) / b) ** 2;
    return Math.abs(value - 1);
  });

  return deviations.reduce((sum, d) => sum + d, 0) / deviations.length;
};

/** True when every edge of a quad runs roughly horizontal or vertical. */
const isAxisAligned = (corners: Point[], tolerance = 0.32): boolean =>
  corners.every((corner, i) => {
    const next = corners[(i + 1) % corners.length];
    const dx = Math.abs(next.x - corner.x);
    const dy = Math.abs(next.y - corner.y);
    const longer = Math.max(dx, dy);
    return longer === 0 ? true : Math.min(dx, dy) / longer < tolerance;
  });

/**
 * Classify a freehand stroke.
 * Returns null when the stroke is too short or too irregular to be confident,
 * in which case the caller should keep the original drawing.
 */
export const recognizeShape = (rawPoints: number[]): RecognizedShape | null => {
  if (!rawPoints || rawPoints.length < 8) return null;

  const points: Point[] = [];
  for (let i = 0; i + 1 < rawPoints.length; i += 2) {
    points.push({ x: rawPoints[i], y: rawPoints[i + 1] });
  }
  if (points.length < 4) return null;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;
  const diagonal = Math.hypot(width, height);

  // Too small to be a deliberate shape.
  if (diagonal < 40) return null;

  const total = pathLength(points);
  const gap = distance(points[0], points[points.length - 1]);
  const closed = gap < total * 0.28;

  const box = { x: minX, y: minY, width: Math.max(width, 12), height: Math.max(height, 12) };

  /* ---- Open strokes: straight line, or leave alone ---- */
  if (!closed) {
    // A straight stroke's path length barely exceeds its endpoint distance.
    if (gap > 0 && total / gap < 1.12) {
      return {
        shapeId: null,
        line: { from: points[0], to: points[points.length - 1] },
        ...box,
        label: 'Line',
      };
    }
    return null;
  }

  /* ---- Closed strokes ---- */

  // A tight epsilon is deliberate. Simplifying hard enough to flatten a
  // circle's wobble also collapses it into a 6–8 sided polygon that is
  // indistinguishable from a real hexagon. Keeping it tight leaves a polygon's
  // genuinely straight edges as single segments while a circle keeps many
  // vertices — the sharp-corner count then separates them cleanly.
  const simplified = simplify(points, diagonal * 0.02);
  // The closing point duplicates the first, so drop it before counting.
  const corners = simplified.slice(0, -1);
  const sharp = countSharpCorners(corners);

  const ratio = width / Math.max(height, 1);
  const circle = (): RecognizedShape => ({
    shapeId: 'circle',
    ...box,
    label: ratio > 0.8 && ratio < 1.25 ? 'Circle' : 'Ellipse',
  });

  // Round first. A flat oval curves hard at its ends, and those ends read as
  // sharp corners, so the corner count alone would call it a triangle.
  if (ellipseFit(points, box) < 0.11) return circle();

  // No sharp turns anywhere: it is round.
  if (sharp === 0) return circle();

  if (sharp === 3) return { shapeId: 'triangle', ...box, label: 'Triangle' };

  if (sharp === 4) {
    // Take the four sharpest points as the quad's corners for the axis test.
    const quad = corners.length === 4 ? corners : simplified.slice(0, 4);
    if (isAxisAligned(quad)) {
      return {
        shapeId: 'square',
        ...box,
        label: ratio > 0.85 && ratio < 1.18 ? 'Square' : 'Rectangle',
      };
    }
    return { shapeId: 'diamond', ...box, label: 'Diamond' };
  }

  if (sharp === 5) return { shapeId: 'pentagon', ...box, label: 'Pentagon' };
  if (sharp === 6) return { shapeId: 'hexagon', ...box, label: 'Hexagon' };
  if (sharp === 7 || sharp === 8) return { shapeId: 'octagon', ...box, label: 'Octagon' };

  // Lots of sharp turns is a scribble, not a shape — leave the drawing alone.
  return null;
};

/** Ray casting: is a point inside the polygon traced by a lasso? */
export const pointInPolygon = (point: Point, polygon: Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1e-9) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
};
