import React, { useMemo } from 'react';
import { SlideLayoutDef } from './slideLayouts';
import { getShapeDef, resolvePartColors } from '../shapes/shapeLibrary';

interface SlidePreviewProps {
  layout: SlideLayoutDef;
  className?: string;
}

/**
 * Miniature of a slide layout, drawn from the layout's own `build()` output.
 *
 * Because it consumes the same element list the canvas does, a thumbnail can
 * never drift from the slide it inserts — editing a layout updates its preview
 * automatically.
 */
export const SlidePreview: React.FC<SlidePreviewProps> = ({ layout, className }) => {
  const { width, height } = layout.frameSize;

  // Built at origin (0,0) so the element coordinates are already frame-relative.
  const elements = useMemo(() => layout.build(0, 0, 'preview'), [layout]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${layout.name} preview`}
    >
      <rect x={0} y={0} width={width} height={height} fill="#ffffff" />

      {elements.map((raw) => {
        const el = raw as any;
        const shapeDef = getShapeDef(el.shapeId);

        // Library shapes: reuse the manifest path data, scaled into place.
        if (shapeDef && shapeDef.geometry.kind === 'parts') {
          return (
            <g
              key={el.id}
              transform={`translate(${el.x} ${el.y}) scale(${el.width / 100} ${el.height / 100})`}
            >
              {shapeDef.geometry.parts.map((part, i) => {
                const colors = resolvePartColors(part, shapeDef, el.fill, el.stroke);
                return (
                  <path
                    key={i}
                    d={part.d}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </g>
          );
        }

        switch (el.type) {
          case 'text':
            return (
              <text
                key={el.id}
                x={el.align === 'center' ? el.x + el.width / 2 : el.x}
                y={el.y + (el.fontSize || 16) * 0.85}
                textAnchor={el.align === 'center' ? 'middle' : 'start'}
                fontSize={el.fontSize || 16}
                fontWeight={el.fontWeight === 'normal' ? 400 : 700}
                fontFamily="Inter, sans-serif"
                fill={el.stroke}
              >
                {/* Trimmed so long body copy doesn't overflow the thumbnail */}
                {String(el.text).length > 42 ? `${String(el.text).slice(0, 42)}…` : el.text}
              </text>
            );

          case 'ellipse':
            return (
              <ellipse
                key={el.id}
                cx={el.x + el.width / 2}
                cy={el.y + el.height / 2}
                rx={el.width / 2}
                ry={el.height / 2}
                fill={el.fill}
                stroke={el.stroke}
                strokeWidth={el.strokeWidth}
                opacity={el.opacity ?? 1}
              />
            );

          case 'line':
            return (
              <line
                key={el.id}
                x1={el.x}
                y1={el.y}
                x2={el.x + (el.points?.[2] ?? 0)}
                y2={el.y + (el.points?.[3] ?? 0)}
                stroke={el.stroke}
                strokeWidth={el.strokeWidth}
              />
            );

          case 'sticky':
            return (
              <g key={el.id}>
                <rect
                  x={el.x}
                  y={el.y}
                  width={el.width}
                  height={el.height}
                  fill={el.stickyColor || el.fill}
                />
                <text x={el.x + 10} y={el.y + 24} fontSize={13} fontFamily="Inter, sans-serif" fill="#334155">
                  {String(el.text).slice(0, 18)}…
                </text>
              </g>
            );

          default:
            return (
              <rect
                key={el.id}
                x={el.x}
                y={el.y}
                width={el.width}
                height={el.height}
                rx={el.type === 'rounded-rectangle' ? 12 : 0}
                fill={el.fill}
                stroke={el.stroke}
                strokeWidth={el.strokeWidth}
              />
            );
        }
      })}
    </svg>
  );
};
