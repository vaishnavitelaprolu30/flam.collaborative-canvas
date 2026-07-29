export interface Point {
  x: number;
  y: number;
}

/**
 * Converts screen/client coordinates (from mouse events) to world coordinates (absolute canvas coordinates)
 */
export const screenToWorld = (
  clientX: number,
  clientY: number,
  pan: { x: number; y: number },
  zoom: number,
  containerEl: HTMLDivElement | null
): Point => {
  if (!containerEl) {
    return {
      x: (clientX - pan.x) / zoom,
      y: (clientY - pan.y) / zoom
    };
  }

  // Get exact relative bounding client coordinates
  const rect = containerEl.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  return {
    x: (x - pan.x) / zoom,
    y: (y - pan.y) / zoom
  };
};

/**
 * Converts absolute world canvas coordinates to screen coordinates
 */
export const worldToScreen = (
  worldX: number,
  worldY: number,
  pan: { x: number; y: number },
  zoom: number,
  containerEl: HTMLDivElement | null
): Point => {
  const x = worldX * zoom + pan.x;
  const y = worldY * zoom + pan.y;

  if (!containerEl) {
    return { x, y };
  }

  const rect = containerEl.getBoundingClientRect();
  return {
    x: x + rect.left,
    y: y + rect.top
  };
};
