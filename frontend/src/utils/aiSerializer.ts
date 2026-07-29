import { CanvasElement } from '../types/canvas';

export interface AISerializedElement {
  id: string;
  type: string;
  text?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  connections?: { elementId: string; role: 'from' | 'to' }[];
}

export interface AISerializedContext {
  boardTitle: string;
  selectedElements: AISerializedElement[];
}

export const serializeCanvasSelection = (
  elements: CanvasElement[],
  selectedIds: string[],
  boardTitle: string
): AISerializedContext => {
  const selectedElements = elements.filter(el => selectedIds.includes(el.id));
  const connectors = elements.filter(el => el.type === 'connector') as any[];

  const serializedElements: AISerializedElement[] = selectedElements.map(el => {
    const serialized: AISerializedElement = {
      id: el.id,
      type: el.type,
      x: Math.round(el.x),
      y: Math.round(el.y),
      width: Math.round(el.width),
      height: Math.round(el.height),
      color: el.fill !== 'transparent' ? el.fill : el.stroke
    };

    if ('text' in el) {
      serialized.text = (el as any).text;
    }

    const elementConnectors = connectors.filter(conn => conn.fromId === el.id || conn.toId === el.id);
    if (elementConnectors.length > 0) {
      serialized.connections = elementConnectors.map(conn => ({
        elementId: conn.fromId === el.id ? conn.toId : conn.fromId,
        role: conn.fromId === el.id ? 'from' as const : 'to' as const
      }));
    }

    return serialized;
  });

  return {
    boardTitle,
    selectedElements: serializedElements
  };
};
