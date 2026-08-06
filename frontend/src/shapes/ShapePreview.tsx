import React from 'react';
import { ShapeDef, resolvePartColors } from './shapeLibrary';

interface ShapePreviewProps {
  shape: ShapeDef;
  /** Rendered pixel size of the (square) preview box. */
  size?: number;
  /** Override the shape's own default colors, e.g. to follow the picker theme. */
  fill?: string;
  stroke?: string;
  className?: string;
}

/**
 * Draws a shape from the manifest as an inline SVG.
 *
 * The picker uses this for its swatches, so the icon a user clicks is generated
 * from exactly the same path data the canvas renderer uses. There is no second
 * set of hand-drawn icons that can drift out of sync.
 */
export const ShapePreview: React.FC<ShapePreviewProps> = ({
  shape,
  size = 26,
  fill,
  stroke,
  className,
}) => {
  const bodyFill = fill ?? shape.defaultFill;
  const bodyStroke = stroke ?? shape.defaultStroke;

  if (shape.geometry.kind === 'image') {
    return (
      <img
        src={shape.geometry.src}
        alt={shape.label}
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain' }}
      />
    );
  }

  return (
    <svg
      viewBox="-4 -4 108 108"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={shape.label}
      style={{ overflow: 'visible' }}
    >
      {shape.geometry.parts.map((part, i) => {
        const colors = resolvePartColors(part, shape, bodyFill, bodyStroke);
        return (
          <path
            key={i}
            d={part.d}
            fill={colors.fill}
            stroke={colors.stroke}
            strokeWidth={3 * (part.strokeScale ?? 1)}
            strokeDasharray={part.dashed ? '8 6' : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
};
