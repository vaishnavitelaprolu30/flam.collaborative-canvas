export type ElementType = 
  | 'pencil' 
  | 'rectangle' 
  | 'rounded-rectangle'
  | 'ellipse' 
  | 'triangle'
  | 'diamond'
  | 'hexagon'
  | 'star'
  | 'line' 
  | 'arrow' 
  | 'text' 
  | 'sticky' 
  | 'connector'
  | 'emoji'
  | 'frame';

export type ToolType = 
  | 'select' 
  | 'hand' 
  | 'pencil' 
  | 'rectangle' 
  | 'rounded-rectangle'
  | 'ellipse' 
  | 'triangle'
  | 'diamond'
  | 'hexagon'
  | 'star'
  | 'line' 
  | 'arrow' 
  | 'text' 
  | 'sticky' 
  | 'eraser' 
  | 'connector'
  | 'emoji'
  | 'frame';

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  stroke: string;
  strokeWidth: number;
  fill: string;
  isLocked: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  
  // Advanced Whiteboard Fields
  votes?: string[];
  reactions?: { [emoji: string]: number };
  cardStyle?: 'classic' | 'rounded' | 'paper';
  isImportant?: boolean;
}

export interface PencilElement extends BaseElement {
  type: 'pencil';
  points: number[]; // Flat array of [x, y, x, y, ...]
}

export interface RectangleElement extends BaseElement {
  type: 'rectangle' | 'rounded-rectangle';
  borderRadius?: number;
}

export interface PolygonElement extends BaseElement {
  type: 'triangle' | 'diamond' | 'hexagon' | 'star';
}

export interface EllipseElement extends BaseElement {
  type: 'ellipse';
}

export interface LineElement extends BaseElement {
  type: 'line';
  points: [number, number, number, number]; // [x1, y1, x2, y2]
}

export interface ArrowElement extends BaseElement {
  type: 'arrow';
  points: [number, number, number, number]; // [x1, y1, x2, y2]
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  align: 'left' | 'center' | 'right';
}

export interface StickyElement extends BaseElement {
  type: 'sticky';
  text: string;
  fontSize: number;
  fontFamily: string;
  align: 'left' | 'center' | 'right';
  stickyColor: string; // Background color for sticky note (hex)
}

export interface ConnectorElement extends BaseElement {
  type: 'connector';
  fromId: string;
  toId: string;
  fromPort: 'top' | 'right' | 'bottom' | 'left';
  toPort: 'top' | 'right' | 'bottom' | 'left';
  text?: string;
}

export interface EmojiElement extends BaseElement {
  type: 'emoji';
  emoji: string;
  fontSize: number;
}

export interface FrameElement extends BaseElement {
  type: 'frame';
  title: string;
  backgroundColor?: string;
}

export type CanvasElement = 
  | PencilElement 
  | RectangleElement 
  | EllipseElement 
  | LineElement 
  | ArrowElement 
  | TextElement 
  | StickyElement 
  | ConnectorElement
  | EmojiElement
  | FrameElement
  | PolygonElement;

export interface UserPresence {
  userId: string;
  userName: string;
  color: string;
  cursorX: number;
  cursorY: number;
  selectedElementId: string | null;
  lastActive: number;
}

export interface Board {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface HistoryAction {
  id: string; // Unique ID for undo/redo tracking
  type: 'create' | 'update' | 'delete';
  elementsBefore: CanvasElement[];
  elementsAfter: CanvasElement[];
}
