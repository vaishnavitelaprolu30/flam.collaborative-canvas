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
  | 'frame'
  | 'image'
  | 'table'
  | 'comment'
  | 'cloud'
  | 'parallelogram'
  | 'cylinder'
  | 'database'
  | 'server'
  | 'speech-bubble'
  | 'bracket'
  | 'container'
  | 'aws-ec2'
  | 'aws-s3'
  | 'aws-rds'
  | 'aws-lambda'
  | 'azure-sql'
  | 'azure-func'
  | 'azure-app'
  | 'azure-vault'
  | 'azure-cosmos'
  | 'vmware-laptop'
  | 'vmware-host'
  | 'vmware-storage'
  | 'vmware-vm'
  | 'uml-actor'
  | 'uml-class'
  | 'uml-interface'
  | 'uml-package'
  | 'uml-component'
  | 'uml-composition'
  | 'uml-aggregation'
  | 'ui-button'
  | 'ui-input'
  | 'ui-card'
  | 'embed';

export type ToolType = 
  | 'select' 
  | 'hand' 
  | 'pencil' 
  | 'highlighter'
  | 'marker'
  | 'brush'
  | 'calligraphy'
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
  | 'frame'
  | 'image'
  | 'table'
  | 'laser'
  | 'comment'
  | 'mindmap'
  | 'diagram'
  /**
   * Armed with a shape from the library: the next drag on the canvas draws that
   * shape, and a plain click drops it at its default size. Which shape is armed
   * lives in `useUIStore.pendingShapeId`.
   */
  | 'diagram-shape'
  /** Freehand stroke that snaps to a clean shape on release. */
  | 'smart-draw'
  /** Freeform selection region. */
  | 'lasso'
  | 'diary'
  | 'cloud'
  | 'parallelogram'
  | 'cylinder'
  | 'database'
  | 'server'
  | 'speech-bubble'
  | 'aws'
  | 'wireframe'
  | 'embed';

export interface BaseElement {
  id: string;
  type: ElementType;
  /**
   * Id of an entry in `shapes/shapeLibrary.ts`. When present the canvas draws
   * the element from that manifest entry instead of a hardcoded renderer.
   * Absent on elements created before the shape library existed — those still
   * render through the legacy per-type branches in SketchCanvas.
   */
  shapeId?: string;
  /** Optional caption drawn on/under library shapes. */
  text?: string;
  /**
   * Which drawing implement produced a freehand stroke. Highlighter strokes
   * render translucent with a chisel tip and multiply blending so overlapping
   * passes darken, the way real highlighter ink does.
   */
  brush?: 'pen' | 'highlighter';
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
  routingStyle?: 'straight' | 'elbow' | 'curved';
  isAnimated?: boolean;
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

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  alt?: string;
  aspectRatio?: number;
}

export interface TableElement extends BaseElement {
  type: 'table';
  rows: number;
  cols: number;
  cellsData: string[][];
  headerBg?: string;
}

export interface CommentElement extends BaseElement {
  type: 'comment';
  text: string;
  author: string;
  avatar: string;
  resolved: boolean;
  replies?: { author: string; avatar: string; text: string; createdAt: number }[];
}

export interface EmbedElement extends BaseElement {
  type: 'embed';
  url: string;
  embedType: 'youtube' | 'website' | 'figma';
  title?: string;
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
  | PolygonElement
  | ImageElement
  | TableElement
  | CommentElement
  | EmbedElement
  | BaseElement;

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
