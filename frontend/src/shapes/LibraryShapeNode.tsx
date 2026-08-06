import React, { useEffect, useState } from 'react';
import { Group, Path, Text, Image as KonvaImage } from 'react-konva';
import Konva from 'konva';
import { CanvasElement } from '../types/canvas';
import { ShapeDef, resolvePartColors } from './shapeLibrary';

const getContrastingTextColor = (bgColor: string): string => {
  if (!bgColor || bgColor === 'transparent') return '#1e293b';
  const hex = bgColor.replace('#', '');
  if (hex.length !== 6) return '#1e293b';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? '#1e293b' : '#ffffff';
};

/** Loads an <img> for shapes whose geometry is a vendor icon asset. */
const ImageGeometry: React.FC<{ src: string; width: number; height: number }> = ({
  src,
  width,
  height,
}) => {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.src = src;
    const onLoad = () => setImg(image);
    image.addEventListener('load', onLoad);
    return () => image.removeEventListener('load', onLoad);
  }, [src]);

  if (!img) return null;
  return <KonvaImage image={img} width={width} height={height} listening={false} />;
};

interface LibraryShapeNodeProps {
  element: CanvasElement;
  shape: ShapeDef;
  draggable: boolean;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void;
  /** Double-click opens the caption for editing, as on text and sticky notes. */
  onDblClick?: () => void;
}

/**
 * The single renderer for every shape in the manifest.
 *
 * Paths are authored in a 0..100 box and scaled to the element's real size, so
 * one component covers all ~120 library shapes. Stroke scaling is disabled so
 * outlines stay a consistent weight no matter how far a shape is stretched.
 */
export const LibraryShapeNode: React.FC<LibraryShapeNodeProps> = ({
  element,
  shape,
  draggable,
  onDragEnd,
  onTransformEnd,
  onDblClick,
}) => {
  const el = element as any;
  const width = el.width || shape.defaultWidth;
  const height = el.height || shape.defaultHeight;
  const fill = el.fill && el.fill !== 'transparent' ? el.fill : shape.defaultFill;
  const stroke = el.stroke || shape.defaultStroke;
  const strokeWidth = el.strokeWidth || 2;
  const label = el.text as string | undefined;

  return (
    <Group
      id={el.id}
      x={el.x}
      y={el.y}
      width={width}
      height={height}
      rotation={el.rotation || 0}
      opacity={el.opacity ?? 1}
      draggable={draggable}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
      onDblClick={onDblClick}
    >
      {shape.geometry.kind === 'image' ? (
        <ImageGeometry src={shape.geometry.src} width={width} height={height} />
      ) : (
        shape.geometry.parts.map((part, i) => {
          const colors = resolvePartColors(part, shape, fill, stroke);
          return (
            <Path
              key={i}
              data={part.d}
              scaleX={width / 100}
              scaleY={height / 100}
              fill={colors.fill}
              stroke={colors.stroke}
              strokeWidth={strokeWidth * (part.strokeScale ?? 1)}
              strokeScaleEnabled={false}
              dash={part.dashed ? [8, 6] : undefined}
              lineCap="round"
              lineJoin="round"
            />
          );
        })
      )}

      {label && shape.labelPlacement === 'inside' && (
        <Text
          x={8}
          y={height / 2 - 9}
          width={width - 16}
          text={label}
          fontSize={13}
          fontFamily="sans-serif"
          fontStyle="bold"
          fill={getContrastingTextColor(fill)}
          align="center"
          listening={false}
        />
      )}

      {label && shape.labelPlacement === 'below' && (
        <Text
          x={-10}
          y={height + 8}
          width={width + 20}
          text={label}
          fontSize={12}
          fontFamily="sans-serif"
          fontStyle="bold"
          fill={stroke}
          align="center"
          listening={false}
        />
      )}
    </Group>
  );
};
