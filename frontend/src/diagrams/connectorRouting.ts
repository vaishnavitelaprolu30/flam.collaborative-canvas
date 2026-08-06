/**
 * Connector geometry, shared by the canvas renderer and the Mermaid preview.
 *
 * Both surfaces import from here so a diagram can never look one way in the
 * preview and another way once it lands on the board — which is exactly what
 * happened while the canvas drew centre-to-centre lines and ignored ports.
 */

export type Port = 'top' | 'right' | 'bottom' | 'left';
export type RoutingStyle = 'straight' | 'elbow' | 'curved';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Where a port sits on a box's edge. */
export const portPoint = (box: Box, port: Port): Point => {
  switch (port) {
    case 'top':
      return { x: box.x + box.width / 2, y: box.y };
    case 'bottom':
      return { x: box.x + box.width / 2, y: box.y + box.height };
    case 'left':
      return { x: box.x, y: box.y + box.height / 2 };
    case 'right':
    default:
      return { x: box.x + box.width, y: box.y + box.height / 2 };
  }
};

/**
 * Pick the pair of ports that gives the shortest, least-crossing run between
 * two boxes. Used when a connector has no explicit ports, and by the diagram
 * generators so a back-edge does not leave from the same side as a forward one.
 */
export const choosePorts = (from: Box, to: Box): { fromPort: Port; toPort: Port } => {
  const fromCx = from.x + from.width / 2;
  const fromCy = from.y + from.height / 2;
  const toCx = to.x + to.width / 2;
  const toCy = to.y + to.height / 2;

  const dx = toCx - fromCx;
  const dy = toCy - fromCy;

  // Whichever axis dominates decides which faces are used.
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0 ? { fromPort: 'right', toPort: 'left' } : { fromPort: 'left', toPort: 'right' };
  }
  return dy >= 0 ? { fromPort: 'bottom', toPort: 'top' } : { fromPort: 'top', toPort: 'bottom' };
};

const isVertical = (port: Port) => port === 'top' || port === 'bottom';

/** How far a route steps away from a node before turning. */
const STUB = 22;

/**
 * Build the polyline for a connector.
 *
 * Returns a flat [x, y, x, y, ...] array, which is what Konva's Arrow wants and
 * is trivial to turn into an SVG path for the preview.
 */
export const routeConnector = (
  from: Box,
  to: Box,
  fromPort: Port,
  toPort: Port,
  style: RoutingStyle = 'elbow'
): number[] => {
  const a = portPoint(from, fromPort);
  const b = portPoint(to, toPort);

  if (style === 'straight') return [a.x, a.y, b.x, b.y];

  // Step out of each node along its port's normal, so the line leaves and
  // arrives perpendicular to the edge rather than clipping the corner.
  const aStub: Point = {
    x: a.x + (fromPort === 'left' ? -STUB : fromPort === 'right' ? STUB : 0),
    y: a.y + (fromPort === 'top' ? -STUB : fromPort === 'bottom' ? STUB : 0),
  };
  const bStub: Point = {
    x: b.x + (toPort === 'left' ? -STUB : toPort === 'right' ? STUB : 0),
    y: b.y + (toPort === 'top' ? -STUB : toPort === 'bottom' ? STUB : 0),
  };

  const points: number[] = [a.x, a.y, aStub.x, aStub.y];

  if (isVertical(fromPort) && isVertical(toPort)) {
    // Vertical run: meet at a shared horizontal band between the two stubs.
    const midY = (aStub.y + bStub.y) / 2;
    points.push(aStub.x, midY, bStub.x, midY);
  } else if (!isVertical(fromPort) && !isVertical(toPort)) {
    // Horizontal run: meet at a shared vertical band.
    const midX = (aStub.x + bStub.x) / 2;
    points.push(midX, aStub.y, midX, bStub.y);
  } else if (isVertical(fromPort)) {
    // Leaving vertically, arriving horizontally: one corner.
    points.push(bStub.x, aStub.y);
  } else {
    points.push(aStub.x, bStub.y);
  }

  points.push(bStub.x, bStub.y, b.x, b.y);
  return points;
};

/** Midpoint of a routed polyline, for placing the edge label. */
export const routeMidpoint = (points: number[]): Point => {
  if (points.length < 4) return { x: points[0] ?? 0, y: points[1] ?? 0 };

  // Walk the polyline to its halfway point by arc length.
  let total = 0;
  const segments: { x1: number; y1: number; x2: number; y2: number; len: number }[] = [];
  for (let i = 0; i + 3 < points.length; i += 2) {
    const x1 = points[i];
    const y1 = points[i + 1];
    const x2 = points[i + 2];
    const y2 = points[i + 3];
    const len = Math.hypot(x2 - x1, y2 - y1);
    segments.push({ x1, y1, x2, y2, len });
    total += len;
  }

  let travelled = 0;
  for (const seg of segments) {
    if (travelled + seg.len >= total / 2) {
      const t = seg.len === 0 ? 0 : (total / 2 - travelled) / seg.len;
      return { x: seg.x1 + (seg.x2 - seg.x1) * t, y: seg.y1 + (seg.y2 - seg.y1) * t };
    }
    travelled += seg.len;
  }

  return { x: points[points.length - 2], y: points[points.length - 1] };
};

/** Flat point array as an SVG path, for the Mermaid preview. */
export const pointsToSvgPath = (points: number[]): string => {
  if (points.length < 4) return '';
  let d = `M ${points[0]} ${points[1]}`;
  for (let i = 2; i + 1 < points.length; i += 2) {
    d += ` L ${points[i]} ${points[i + 1]}`;
  }
  return d;
};
