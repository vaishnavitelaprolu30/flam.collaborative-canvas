/**
 * SyncSketch shape library.
 *
 * Every diagram shape in the app is described here as data, not as a React
 * component or a `case` branch in the canvas renderer. One generic renderer in
 * `canvas/SketchCanvas.tsx` and one generic picker in
 * `components/DiagrammingShapesDrawer.tsx` both read from this file, which is
 * what keeps the picker preview and the canvas result identical: they draw the
 * same path data.
 *
 * Geometry convention
 * -------------------
 * All paths are authored inside a normalized 0..100 x 0..100 box. The renderer
 * scales that box to the element's actual width/height, so a shape only ever
 * needs to be drawn once, at one size.
 *
 * Adding shapes
 * -------------
 * Append a `ShapeDef` to `SHAPE_LIBRARY`. No other file needs to change.
 *
 * Vendor icon packs
 * -----------------
 * The cloud shapes below are original, vendor-neutral geometry tinted with each
 * vendor's brand color. They are deliberately NOT tracings of official icons.
 * To use the real vendor artwork, download the official packs, drop the SVGs in
 * `frontend/public/shapes/<vendor>/`, and give the shape an
 * `{ kind: 'image', src: '/shapes/aws/s3.svg' }` geometry — the renderer already
 * supports it. Review each vendor's terms before shipping:
 *   AWS Architecture Icons   https://aws.amazon.com/architecture/icons/
 *   Azure Architecture Icons https://learn.microsoft.com/azure/architecture/icons/
 *   Google Cloud Icons       https://cloud.google.com/icons
 * Do not copy shapes out of Miro or any other commercial whiteboard.
 */

export type ShapeCategoryId =
  | 'basic'
  | 'flowchart'
  | 'callouts'
  | 'uml'
  | 'aws'
  | 'azure'
  | 'gcp'
  | 'wireframe';

export type PortSide = 'top' | 'right' | 'bottom' | 'left';

/**
 * How a single path inside a shape is colored.
 *  body    - filled with the element's fill, outlined with its stroke
 *  accent  - filled with the shape's accent color (its "logo" mark)
 *  outline - no fill, stroke only (line art such as UML actors)
 *  white   - filled white, for cut-outs and screen glass
 */
export type PartRole = 'body' | 'accent' | 'outline' | 'white';

export interface ShapePart {
  /** SVG path data in the normalized 0..100 box. */
  d: string;
  role?: PartRole;
  /** Multiplier on the element's stroke width. 0 removes the outline. */
  strokeScale?: number;
  dashed?: boolean;
}

export type ShapeGeometry =
  | { kind: 'parts'; parts: ShapePart[] }
  /** Bitmap or SVG asset served from `public/`. Used for official icon packs. */
  | { kind: 'image'; src: string };

export interface ShapeDef {
  /** Stable id. Also written onto the element as `shapeId`. */
  id: string;
  category: ShapeCategoryId;
  label: string;
  /** Extra search terms beyond the label. */
  keywords: string[];
  geometry: ShapeGeometry;
  defaultWidth: number;
  defaultHeight: number;
  defaultFill: string;
  defaultStroke: string;
  accentColor?: string;
  /** Where the element's text label is drawn. */
  labelPlacement: 'inside' | 'below' | 'none';
  /** Sides a connector may attach to. */
  ports: PortSide[];
}

export interface ShapeCategory {
  id: ShapeCategoryId;
  title: string;
  /** Shown under the category title in the picker. */
  blurb: string;
  order: number;
}

const ALL_PORTS: PortSide[] = ['top', 'right', 'bottom', 'left'];

/* ------------------------------------------------------------------ */
/* Reusable geometry                                                    */
/* ------------------------------------------------------------------ */

const RECT = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
const ROUNDED_RECT =
  'M 12 0 L 88 0 Q 100 0 100 12 L 100 88 Q 100 100 88 100 L 12 100 Q 0 100 0 88 L 0 12 Q 0 0 12 0 Z';
const ELLIPSE = 'M 0 50 A 50 50 0 1 0 100 50 A 50 50 0 1 0 0 50 Z';
const DIAMOND = 'M 50 0 L 100 50 L 50 100 L 0 50 Z';
const HEXAGON = 'M 25 0 L 75 0 L 100 50 L 75 100 L 25 100 L 0 50 Z';
const PARALLELOGRAM = 'M 20 0 L 100 0 L 80 100 L 0 100 Z';
const STADIUM =
  'M 25 0 L 75 0 Q 100 0 100 50 Q 100 100 75 100 L 25 100 Q 0 100 0 50 Q 0 0 25 0 Z';
const DOCUMENT = 'M 0 0 L 100 0 L 100 82 Q 75 100 50 88 Q 25 76 0 92 Z';
const CYLINDER_BODY =
  'M 0 12 L 0 88 A 50 12 0 0 0 100 88 L 100 12 A 50 12 0 0 0 0 12 Z';
const CYLINDER_RIM = 'M 0 12 A 50 12 0 0 0 100 12 A 50 12 0 0 0 0 12 Z';

/** A single filled path, the common case. */
const solid = (d: string): ShapeGeometry => ({ kind: 'parts', parts: [{ d, role: 'body' }] });

/* ------------------------------------------------------------------ */
/* Basic shapes                                                         */
/* ------------------------------------------------------------------ */

const BASIC: ShapeDef[] = [
  ['square', 'Square', RECT, ['rectangle', 'box', 'block']],
  ['rounded-square', 'Rounded square', ROUNDED_RECT, ['rectangle', 'card', 'pill']],
  ['circle', 'Circle', ELLIPSE, ['ellipse', 'oval', 'round', 'dot']],
  ['triangle', 'Triangle', 'M 50 0 L 100 100 L 0 100 Z', ['delta', 'play']],
  ['right-triangle', 'Right triangle', 'M 0 0 L 0 100 L 100 100 Z', ['corner', 'wedge']],
  ['diamond', 'Diamond', DIAMOND, ['rhombus', 'decision']],
  ['pentagon', 'Pentagon', 'M 50 0 L 100 38 L 81 100 L 19 100 L 0 38 Z', ['polygon', 'five']],
  ['hexagon', 'Hexagon', HEXAGON, ['polygon', 'six', 'honeycomb']],
  [
    'octagon',
    'Octagon',
    'M 30 0 L 70 0 L 100 30 L 100 70 L 70 100 L 30 100 L 0 70 L 0 30 Z',
    ['polygon', 'eight', 'stop'],
  ],
  ['parallelogram', 'Parallelogram', PARALLELOGRAM, ['skew', 'slant', 'data']],
  ['trapezoid', 'Trapezoid', 'M 20 0 L 80 0 L 100 100 L 0 100 Z', ['polygon', 'taper']],
  [
    'star',
    'Star',
    'M 50 0 L 61 35 L 98 35 L 68 57 L 79 91 L 50 70 L 21 91 L 32 57 L 2 35 L 39 35 Z',
    ['favorite', 'rating', 'highlight'],
  ],
  [
    'arrow-right',
    'Block arrow',
    'M 0 30 L 60 30 L 60 5 L 100 50 L 60 95 L 60 70 L 0 70 Z',
    ['arrow', 'direction', 'next', 'pointer'],
  ],
  [
    'cross',
    'Cross',
    'M 35 0 L 65 0 L 65 35 L 100 35 L 100 65 L 65 65 L 65 100 L 35 100 L 35 65 L 0 65 L 0 35 L 35 35 Z',
    ['plus', 'add', 'medical'],
  ],
].map(([id, label, d, keywords]) => ({
  id: id as string,
  category: 'basic' as const,
  label: label as string,
  keywords: keywords as string[],
  geometry: solid(d as string),
  defaultWidth: 160,
  defaultHeight: 120,
  defaultFill: '#dbeafe',
  defaultStroke: '#2563eb',
  labelPlacement: 'inside' as const,
  ports: ALL_PORTS,
}));

/* ------------------------------------------------------------------ */
/* Flowchart shapes (ISO 5807 / ANSI symbols)                           */
/* ------------------------------------------------------------------ */

const FLOWCHART_GEOMETRY: Record<string, ShapePart[]> = {
  'fc-process': [{ d: RECT, role: 'body' }],
  'fc-decision': [{ d: DIAMOND, role: 'body' }],
  'fc-terminator': [{ d: STADIUM, role: 'body' }],
  'fc-data': [{ d: PARALLELOGRAM, role: 'body' }],
  'fc-predefined': [
    { d: RECT, role: 'body' },
    { d: 'M 12 0 L 12 100', role: 'outline' },
    { d: 'M 88 0 L 88 100', role: 'outline' },
  ],
  'fc-internal-storage': [
    { d: RECT, role: 'body' },
    { d: 'M 0 22 L 100 22', role: 'outline' },
    { d: 'M 20 0 L 20 100', role: 'outline' },
  ],
  'fc-document': [{ d: DOCUMENT, role: 'body' }],
  'fc-multi-document': [
    { d: 'M 10 0 L 100 0 L 100 70 L 10 70 Z', role: 'body' },
    { d: 'M 5 8 L 95 8 L 95 78 L 5 78 Z', role: 'body' },
    { d: 'M 0 16 L 90 16 L 90 82 Q 68 98 45 88 Q 22 78 0 92 Z', role: 'body' },
  ],
  'fc-manual-input': [{ d: 'M 0 20 L 100 0 L 100 100 L 0 100 Z', role: 'body' }],
  'fc-manual-operation': [{ d: 'M 0 0 L 100 0 L 80 100 L 20 100 Z', role: 'body' }],
  'fc-preparation': [{ d: HEXAGON, role: 'body' }],
  'fc-connector': [{ d: ELLIPSE, role: 'body' }],
  'fc-off-page': [{ d: 'M 0 0 L 100 0 L 100 65 L 50 100 L 0 65 Z', role: 'body' }],
  'fc-stored-data': [
    { d: CYLINDER_BODY, role: 'body' },
    { d: CYLINDER_RIM, role: 'accent' },
  ],
  'fc-display': [{ d: 'M 20 0 L 85 0 Q 100 50 85 100 L 20 100 Q 0 50 20 0 Z', role: 'body' }],
  'fc-delay': [{ d: 'M 0 0 L 60 0 Q 100 0 100 50 Q 100 100 60 100 L 0 100 Z', role: 'body' }],
};

const FLOWCHART_LABELS: [string, string, string[]][] = [
  ['fc-process', 'Process', ['step', 'action', 'task', 'rectangle']],
  ['fc-decision', 'Decision', ['branch', 'if', 'condition', 'diamond']],
  ['fc-terminator', 'Start / End', ['terminator', 'begin', 'stop', 'pill']],
  ['fc-data', 'Data', ['input', 'output', 'io', 'parallelogram']],
  ['fc-predefined', 'Predefined process', ['subroutine', 'function', 'call']],
  ['fc-internal-storage', 'Internal storage', ['memory', 'store']],
  ['fc-document', 'Document', ['report', 'file', 'paper']],
  ['fc-multi-document', 'Multi-document', ['files', 'reports', 'stack']],
  ['fc-manual-input', 'Manual input', ['keyboard', 'entry', 'form']],
  ['fc-manual-operation', 'Manual operation', ['human', 'hand', 'manual']],
  ['fc-preparation', 'Preparation', ['setup', 'init', 'hexagon']],
  ['fc-connector', 'Connector', ['jump', 'link', 'reference', 'circle']],
  ['fc-off-page', 'Off-page connector', ['continue', 'page', 'link']],
  ['fc-stored-data', 'Stored data', ['database', 'disk', 'cylinder', 'db']],
  ['fc-display', 'Display', ['screen', 'monitor', 'show']],
  ['fc-delay', 'Delay', ['wait', 'pause', 'queue']],
];

const FLOWCHART: ShapeDef[] = FLOWCHART_LABELS.map(([id, label, keywords]) => ({
  id,
  category: 'flowchart' as const,
  label,
  keywords,
  geometry: { kind: 'parts', parts: FLOWCHART_GEOMETRY[id] },
  defaultWidth: id === 'fc-connector' ? 90 : 170,
  defaultHeight: id === 'fc-connector' ? 90 : 100,
  defaultFill: '#ffffff',
  defaultStroke: '#334155',
  accentColor: '#e2e8f0',
  labelPlacement: 'inside' as const,
  ports: ALL_PORTS,
}));

/* ------------------------------------------------------------------ */
/* Callouts                                                             */
/* ------------------------------------------------------------------ */

const CALLOUTS: ShapeDef[] = [
  {
    id: 'callout-speech',
    label: 'Speech bubble',
    keywords: ['comment', 'talk', 'chat', 'quote', 'say'],
    parts: [
      {
        d: 'M 8 0 L 92 0 Q 100 0 100 8 L 100 62 Q 100 70 92 70 L 40 70 L 20 96 L 25 70 L 8 70 Q 0 70 0 62 L 0 8 Q 0 0 8 0 Z',
        role: 'body',
      },
    ],
  },
  {
    id: 'callout-thought',
    label: 'Thought cloud',
    keywords: ['idea', 'think', 'dream', 'cloud'],
    parts: [
      {
        d: 'M 24 66 A 15 15 0 0 1 26 36 A 21 21 0 0 1 64 27 A 17 17 0 0 1 90 50 A 14 14 0 0 1 80 66 Z',
        role: 'body',
      },
      { d: 'M 22 74 A 6 6 0 1 0 34 74 A 6 6 0 1 0 22 74 Z', role: 'body' },
      { d: 'M 12 90 A 4 4 0 1 0 20 90 A 4 4 0 1 0 12 90 Z', role: 'body' },
    ],
  },
  {
    id: 'callout-banner',
    label: 'Banner callout',
    keywords: ['ribbon', 'label', 'tag', 'header'],
    parts: [
      { d: 'M 0 20 L 88 20 L 100 50 L 88 80 L 0 80 Z', role: 'body' },
    ],
  },
  {
    id: 'callout-rect',
    label: 'Rectangular callout',
    keywords: ['note', 'annotation', 'pointer'],
    parts: [
      { d: 'M 0 0 L 100 0 L 100 72 L 58 72 L 44 100 L 40 72 L 0 72 Z', role: 'body' },
    ],
  },
  {
    id: 'callout-oval',
    label: 'Oval callout',
    keywords: ['bubble', 'round', 'comment'],
    parts: [
      { d: 'M 0 36 A 50 36 0 1 0 100 36 A 50 36 0 1 0 0 36 Z', role: 'body' },
      { d: 'M 30 66 L 22 100 L 52 70 Z', role: 'body' },
    ],
  },
  {
    id: 'callout-arrow',
    label: 'Arrow callout',
    keywords: ['point', 'indicate', 'direction'],
    parts: [
      { d: 'M 0 10 L 72 10 L 72 0 L 100 30 L 72 60 L 72 50 L 0 50 Z', role: 'body' },
    ],
  },
].map((s) => ({
  id: s.id,
  category: 'callouts' as const,
  label: s.label,
  keywords: s.keywords,
  geometry: { kind: 'parts' as const, parts: s.parts as ShapePart[] },
  defaultWidth: 190,
  defaultHeight: 130,
  defaultFill: '#fef9c3',
  defaultStroke: '#ca8a04',
  labelPlacement: 'inside' as const,
  ports: ALL_PORTS,
}));

/* ------------------------------------------------------------------ */
/* UML                                                                  */
/* ------------------------------------------------------------------ */

const UML: ShapeDef[] = [
  {
    id: 'uml-actor',
    label: 'Actor',
    keywords: ['user', 'person', 'stick figure', 'role'],
    w: 90,
    h: 130,
    parts: [
      { d: 'M 38 4 A 12 12 0 1 0 62 4 A 12 12 0 1 0 38 4 Z', role: 'body' },
      { d: 'M 50 28 L 50 66', role: 'outline', strokeScale: 1.4 },
      { d: 'M 22 40 L 78 40', role: 'outline', strokeScale: 1.4 },
      { d: 'M 50 66 L 26 100', role: 'outline', strokeScale: 1.4 },
      { d: 'M 50 66 L 74 100', role: 'outline', strokeScale: 1.4 },
    ],
  },
  {
    id: 'uml-class',
    label: 'Class',
    keywords: ['object', 'type', 'attributes', 'methods'],
    w: 190,
    h: 140,
    parts: [
      { d: RECT, role: 'body' },
      { d: 'M 0 30 L 100 30', role: 'outline' },
      { d: 'M 0 65 L 100 65', role: 'outline' },
    ],
  },
  {
    id: 'uml-interface',
    label: 'Interface',
    keywords: ['contract', 'lollipop', 'protocol'],
    w: 150,
    h: 100,
    parts: [
      { d: 'M 0 50 A 26 26 0 1 0 52 50 A 26 26 0 1 0 0 50 Z', role: 'body' },
      { d: 'M 52 50 L 100 50', role: 'outline', strokeScale: 1.4 },
    ],
  },
  {
    id: 'uml-package',
    label: 'Package',
    keywords: ['namespace', 'module', 'folder', 'group'],
    w: 190,
    h: 140,
    parts: [
      { d: 'M 0 0 L 40 0 L 46 14 L 0 14 Z', role: 'accent' },
      { d: 'M 0 14 L 100 14 L 100 100 L 0 100 Z', role: 'body' },
    ],
  },
  {
    id: 'uml-component',
    label: 'Component',
    keywords: ['module', 'service', 'part'],
    w: 190,
    h: 130,
    parts: [
      { d: 'M 12 0 L 100 0 L 100 100 L 12 100 Z', role: 'body' },
      { d: 'M 0 20 L 30 20 L 30 36 L 0 36 Z', role: 'accent' },
      { d: 'M 0 60 L 30 60 L 30 76 L 0 76 Z', role: 'accent' },
    ],
  },
  {
    id: 'uml-node',
    label: 'Node',
    keywords: ['device', 'host', 'server', 'deployment', '3d'],
    w: 180,
    h: 140,
    parts: [
      { d: 'M 0 22 L 78 22 L 78 100 L 0 100 Z', role: 'body' },
      { d: 'M 0 22 L 22 0 L 100 0 L 78 22 Z', role: 'accent' },
      { d: 'M 78 22 L 100 0 L 100 78 L 78 100 Z', role: 'accent' },
    ],
  },
  {
    id: 'uml-use-case',
    label: 'Use case',
    keywords: ['scenario', 'behavior', 'oval'],
    w: 180,
    h: 100,
    parts: [{ d: ELLIPSE, role: 'body' }],
  },
  {
    id: 'uml-note',
    label: 'Note',
    keywords: ['comment', 'annotation', 'memo'],
    w: 160,
    h: 120,
    parts: [
      { d: 'M 0 0 L 74 0 L 100 26 L 100 100 L 0 100 Z', role: 'body' },
      { d: 'M 74 0 L 74 26 L 100 26', role: 'outline' },
    ],
  },
  {
    id: 'uml-composition',
    label: 'Composition',
    keywords: ['relationship', 'filled diamond', 'owns', 'part of'],
    w: 120,
    h: 70,
    parts: [
      { d: 'M 0 35 L 22 12 L 44 35 L 22 58 Z', role: 'accent' },
      { d: 'M 44 35 L 100 35', role: 'outline', strokeScale: 1.4 },
    ],
  },
  {
    id: 'uml-aggregation',
    label: 'Aggregation',
    keywords: ['relationship', 'hollow diamond', 'has a'],
    w: 120,
    h: 70,
    parts: [
      { d: 'M 0 35 L 22 12 L 44 35 L 22 58 Z', role: 'white' },
      { d: 'M 44 35 L 100 35', role: 'outline', strokeScale: 1.4 },
    ],
  },
  {
    id: 'uml-generalization',
    label: 'Generalization',
    keywords: ['relationship', 'inheritance', 'extends', 'is a'],
    w: 120,
    h: 70,
    parts: [
      { d: 'M 0 12 L 34 35 L 0 58 Z', role: 'white' },
      { d: 'M 34 35 L 100 35', role: 'outline', strokeScale: 1.4 },
    ],
  },
  {
    id: 'uml-dependency',
    label: 'Dependency',
    keywords: ['relationship', 'uses', 'dashed', 'arrow'],
    w: 120,
    h: 70,
    parts: [
      { d: 'M 0 35 L 82 35', role: 'outline', strokeScale: 1.4, dashed: true },
      { d: 'M 62 18 L 96 35 L 62 52', role: 'outline', strokeScale: 1.4 },
    ],
  },
].map((s) => ({
  id: s.id,
  category: 'uml' as const,
  label: s.label,
  keywords: s.keywords,
  geometry: { kind: 'parts' as const, parts: s.parts as ShapePart[] },
  defaultWidth: s.w,
  defaultHeight: s.h,
  defaultFill: '#eef2ff',
  defaultStroke: '#4f46e5',
  accentColor: '#c7d2fe',
  labelPlacement: s.id.startsWith('uml-comp') || s.id.startsWith('uml-agg') || s.id.startsWith('uml-gen') || s.id === 'uml-dependency' ? ('below' as const) : ('inside' as const),
  ports: ALL_PORTS,
}));

/* ------------------------------------------------------------------ */
/* Cloud & infrastructure                                               */
/*                                                                      */
/* One set of original geometry, instantiated three times with each      */
/* vendor's brand palette and service naming. Swap in official icon      */
/* packs by changing a shape's geometry to { kind: 'image', src }.       */
/* ------------------------------------------------------------------ */

type CloudPrimitiveId =
  | 'compute'
  | 'object-store'
  | 'block-store'
  | 'function'
  | 'queue'
  | 'database'
  | 'warehouse'
  | 'cache'
  | 'cdn'
  | 'load-balancer'
  | 'api-gateway'
  | 'firewall'
  | 'container'
  | 'orchestrator'
  | 'network'
  | 'dns'
  | 'monitoring'
  | 'identity'
  | 'secrets'
  | 'ml';

const CLOUD_GEOMETRY: Record<CloudPrimitiveId, ShapePart[]> = {
  compute: [
    { d: ROUNDED_RECT, role: 'body' },
    { d: 'M 24 26 L 76 26 L 76 44 L 24 44 Z', role: 'accent' },
    { d: 'M 24 56 L 76 56 L 76 74 L 24 74 Z', role: 'accent' },
  ],
  'object-store': [
    { d: 'M 10 14 L 90 14 L 78 96 L 22 96 Z', role: 'body' },
    { d: 'M 10 14 A 40 10 0 0 0 90 14 A 40 10 0 0 0 10 14 Z', role: 'accent' },
  ],
  'block-store': [
    { d: ROUNDED_RECT, role: 'body' },
    { d: 'M 50 20 A 30 30 0 1 0 50.1 20 Z', role: 'accent' },
    { d: 'M 50 42 A 8 8 0 1 0 50.1 42 Z', role: 'white' },
  ],
  function: [
    { d: ROUNDED_RECT, role: 'body' },
    { d: 'M 56 14 L 30 56 L 48 56 L 42 88 L 70 44 L 52 44 Z', role: 'accent' },
  ],
  queue: [
    { d: ROUNDED_RECT, role: 'body' },
    { d: 'M 16 36 L 36 36 L 36 64 L 16 64 Z', role: 'accent' },
    { d: 'M 42 36 L 62 36 L 62 64 L 42 64 Z', role: 'accent' },
    { d: 'M 68 36 L 88 36 L 88 64 L 68 64 Z', role: 'accent' },
  ],
  database: [
    { d: CYLINDER_BODY, role: 'body' },
    { d: CYLINDER_RIM, role: 'accent' },
    { d: 'M 0 46 A 50 12 0 0 0 100 46', role: 'outline' },
  ],
  warehouse: [
    { d: CYLINDER_BODY, role: 'body' },
    { d: CYLINDER_RIM, role: 'accent' },
    { d: 'M 22 40 L 32 40 L 32 80 L 22 80 Z', role: 'white' },
    { d: 'M 45 30 L 55 30 L 55 80 L 45 80 Z', role: 'white' },
    { d: 'M 68 50 L 78 50 L 78 80 L 68 80 Z', role: 'white' },
  ],
  cache: [
    { d: ROUNDED_RECT, role: 'body' },
    { d: 'M 22 30 L 78 30 L 78 46 L 22 46 Z', role: 'accent' },
    { d: 'M 22 54 L 60 54 L 60 70 L 22 70 Z', role: 'accent' },
  ],
  cdn: [
    { d: ELLIPSE, role: 'body' },
    { d: 'M 0 50 L 100 50', role: 'outline' },
    { d: 'M 50 0 Q 22 50 50 100 Q 78 50 50 0 Z', role: 'outline' },
  ],
  'load-balancer': [
    { d: ROUNDED_RECT, role: 'body' },
    { d: 'M 20 50 L 50 50 L 50 22 L 82 22', role: 'outline', strokeScale: 1.4 },
    { d: 'M 50 50 L 50 78 L 82 78', role: 'outline', strokeScale: 1.4 },
    { d: 'M 12 40 L 30 50 L 12 60 Z', role: 'accent' },
  ],
  'api-gateway': [
    { d: HEXAGON, role: 'body' },
    { d: 'M 30 42 L 70 42 L 70 52 L 30 52 Z', role: 'accent' },
    { d: 'M 30 60 L 56 60 L 56 70 L 30 70 Z', role: 'accent' },
  ],
  firewall: [
    { d: 'M 50 2 L 96 20 L 96 56 Q 96 88 50 100 Q 4 88 4 56 L 4 20 Z', role: 'body' },
    { d: 'M 50 26 L 74 36 L 74 58 Q 74 74 50 82 Q 26 74 26 58 L 26 36 Z', role: 'accent' },
  ],
  container: [
    { d: 'M 6 30 L 94 30 L 94 92 L 6 92 Z', role: 'body' },
    { d: 'M 0 12 L 100 12 L 94 30 L 6 30 Z', role: 'accent' },
    { d: 'M 40 50 L 60 50 L 60 62 L 40 62 Z', role: 'white' },
  ],
  orchestrator: [
    { d: 'M 50 2 L 92 26 L 92 74 L 50 98 L 8 74 L 8 26 Z', role: 'body' },
    { d: 'M 50 30 L 72 42 L 72 62 L 50 74 L 28 62 L 28 42 Z', role: 'accent' },
  ],
  network: [
    { d: ROUNDED_RECT, role: 'outline', dashed: true, strokeScale: 1.6 },
    { d: 'M 30 34 L 46 34 L 46 50 L 30 50 Z', role: 'accent' },
    { d: 'M 54 50 L 70 50 L 70 66 L 54 66 Z', role: 'accent' },
    { d: 'M 46 42 L 54 42 L 54 58', role: 'outline' },
  ],
  dns: [
    { d: ELLIPSE, role: 'body' },
    { d: 'M 20 34 L 80 34', role: 'outline' },
    { d: 'M 14 66 L 86 66', role: 'outline' },
    { d: 'M 50 0 Q 26 50 50 100', role: 'outline' },
  ],
  monitoring: [
    { d: ROUNDED_RECT, role: 'body' },
    { d: 'M 20 78 L 36 52 L 52 62 L 68 26 L 84 40', role: 'outline', strokeScale: 1.8 },
    { d: 'M 20 20 L 20 82 L 84 82', role: 'outline' },
  ],
  identity: [
    { d: ROUNDED_RECT, role: 'body' },
    { d: 'M 34 30 A 16 16 0 1 0 66 30 A 16 16 0 1 0 34 30 Z', role: 'accent' },
    { d: 'M 22 84 Q 22 56 50 56 Q 78 56 78 84 Z', role: 'accent' },
  ],
  secrets: [
    { d: ROUNDED_RECT, role: 'body' },
    { d: 'M 32 46 L 32 32 A 18 18 0 0 1 68 32 L 68 46', role: 'outline', strokeScale: 1.8 },
    { d: 'M 24 46 L 76 46 L 76 84 L 24 84 Z', role: 'accent' },
  ],
  ml: [
    { d: ROUNDED_RECT, role: 'body' },
    { d: 'M 28 28 L 72 28 L 72 72 L 28 72 Z', role: 'accent' },
    { d: 'M 40 0 L 40 28 M 60 0 L 60 28 M 40 72 L 40 100 M 60 72 L 60 100', role: 'outline' },
    { d: 'M 0 40 L 28 40 M 0 60 L 28 60 M 72 40 L 100 40 M 72 60 L 100 60', role: 'outline' },
  ],
};

interface VendorTheme {
  category: ShapeCategoryId;
  prefix: string;
  fill: string;
  stroke: string;
  accent: string;
  /** Service name per primitive. Omitted primitives are skipped. */
  names: Partial<Record<CloudPrimitiveId, string>>;
}

const VENDORS: VendorTheme[] = [
  {
    category: 'aws',
    prefix: 'aws',
    fill: '#fff7ed',
    stroke: '#ea580c',
    accent: '#fdba74',
    names: {
      compute: 'EC2 Instance',
      'object-store': 'S3 Bucket',
      'block-store': 'EBS Volume',
      function: 'Lambda Function',
      queue: 'SQS Queue',
      database: 'RDS Database',
      warehouse: 'Redshift',
      cache: 'ElastiCache',
      cdn: 'CloudFront',
      'load-balancer': 'Elastic Load Balancer',
      'api-gateway': 'API Gateway',
      firewall: 'WAF',
      container: 'ECS Task',
      orchestrator: 'EKS Cluster',
      network: 'VPC',
      dns: 'Route 53',
      monitoring: 'CloudWatch',
      identity: 'IAM',
      secrets: 'Secrets Manager',
      ml: 'SageMaker',
    },
  },
  {
    category: 'azure',
    prefix: 'azure',
    fill: '#eff6ff',
    stroke: '#0078d4',
    accent: '#93c5fd',
    names: {
      compute: 'Virtual Machine',
      'object-store': 'Blob Storage',
      'block-store': 'Managed Disk',
      function: 'Azure Functions',
      queue: 'Service Bus Queue',
      database: 'Azure SQL Database',
      warehouse: 'Synapse Analytics',
      cache: 'Cache for Redis',
      cdn: 'Azure CDN',
      'load-balancer': 'Load Balancer',
      'api-gateway': 'API Management',
      firewall: 'Azure Firewall',
      container: 'Container Instance',
      orchestrator: 'AKS Cluster',
      network: 'Virtual Network',
      dns: 'Azure DNS',
      monitoring: 'Azure Monitor',
      identity: 'Entra ID',
      secrets: 'Key Vault',
      ml: 'Azure Machine Learning',
    },
  },
  {
    category: 'gcp',
    prefix: 'gcp',
    fill: '#f0fdf4',
    stroke: '#16a34a',
    accent: '#86efac',
    names: {
      compute: 'Compute Engine',
      'object-store': 'Cloud Storage',
      'block-store': 'Persistent Disk',
      function: 'Cloud Functions',
      queue: 'Pub/Sub Topic',
      database: 'Cloud SQL',
      warehouse: 'BigQuery',
      cache: 'Memorystore',
      cdn: 'Cloud CDN',
      'load-balancer': 'Cloud Load Balancing',
      'api-gateway': 'API Gateway',
      firewall: 'Cloud Armor',
      container: 'Cloud Run',
      orchestrator: 'GKE Cluster',
      network: 'VPC Network',
      dns: 'Cloud DNS',
      monitoring: 'Cloud Monitoring',
      identity: 'Cloud IAM',
      secrets: 'Secret Manager',
      ml: 'Vertex AI',
    },
  },
];

const CLOUD_KEYWORDS: Record<CloudPrimitiveId, string[]> = {
  compute: ['vm', 'server', 'instance', 'host', 'compute'],
  'object-store': ['bucket', 'blob', 'storage', 'object', 's3'],
  'block-store': ['disk', 'volume', 'block', 'ssd'],
  function: ['serverless', 'lambda', 'faas', 'trigger'],
  queue: ['message', 'broker', 'sqs', 'pubsub', 'event'],
  database: ['db', 'sql', 'relational', 'rds', 'store'],
  warehouse: ['analytics', 'olap', 'bigquery', 'redshift', 'data'],
  cache: ['redis', 'memcached', 'memory', 'fast'],
  cdn: ['edge', 'content', 'delivery', 'global'],
  'load-balancer': ['lb', 'traffic', 'distribute', 'proxy'],
  'api-gateway': ['api', 'rest', 'endpoint', 'gateway'],
  firewall: ['security', 'waf', 'shield', 'protect'],
  container: ['docker', 'pod', 'image', 'runtime'],
  orchestrator: ['kubernetes', 'k8s', 'cluster', 'scheduler'],
  network: ['vpc', 'subnet', 'vnet', 'private'],
  dns: ['domain', 'resolve', 'route', 'name'],
  monitoring: ['metrics', 'logs', 'observability', 'alerts'],
  identity: ['iam', 'auth', 'user', 'permission', 'sso'],
  secrets: ['vault', 'key', 'credential', 'password'],
  ml: ['ai', 'machine learning', 'model', 'training'],
};

const CLOUD: ShapeDef[] = VENDORS.flatMap((vendor) =>
  (Object.keys(CLOUD_GEOMETRY) as CloudPrimitiveId[])
    .filter((primitive) => vendor.names[primitive])
    .map((primitive) => ({
      id: `${vendor.prefix}-${primitive}`,
      category: vendor.category,
      label: vendor.names[primitive] as string,
      keywords: [...CLOUD_KEYWORDS[primitive], vendor.prefix, primitive],
      geometry: { kind: 'parts' as const, parts: CLOUD_GEOMETRY[primitive] },
      defaultWidth: 150,
      defaultHeight: 130,
      defaultFill: vendor.fill,
      defaultStroke: vendor.stroke,
      accentColor: vendor.accent,
      labelPlacement: 'below' as const,
      ports: ALL_PORTS,
    }))
);

/* ------------------------------------------------------------------ */
/* Wireframe / UI                                                       */
/* ------------------------------------------------------------------ */

const WIREFRAME: ShapeDef[] = [
  {
    id: 'ui-button',
    label: 'Button',
    keywords: ['cta', 'action', 'click', 'submit'],
    w: 150,
    h: 52,
    parts: [
      { d: ROUNDED_RECT, role: 'accent' },
      { d: 'M 26 44 L 74 44 L 74 56 L 26 56 Z', role: 'white' },
    ],
  },
  {
    id: 'ui-input',
    label: 'Text input',
    keywords: ['field', 'form', 'textbox', 'entry'],
    w: 200,
    h: 52,
    parts: [
      { d: ROUNDED_RECT, role: 'body' },
      { d: 'M 10 44 L 14 44 L 14 56 L 10 56 Z', role: 'accent' },
      { d: 'M 22 46 L 60 46 L 60 54 L 22 54 Z', role: 'accent' },
    ],
  },
  {
    id: 'ui-card',
    label: 'Card',
    keywords: ['tile', 'panel', 'container', 'box'],
    w: 180,
    h: 200,
    parts: [
      { d: ROUNDED_RECT, role: 'body' },
      { d: 'M 8 8 L 92 8 L 92 44 L 8 44 Z', role: 'accent' },
      { d: 'M 8 54 L 74 54 L 74 62 L 8 62 Z', role: 'accent' },
      { d: 'M 8 70 L 60 70 L 60 78 L 8 78 Z', role: 'accent' },
    ],
  },
  {
    id: 'ui-navbar',
    label: 'Navigation bar',
    keywords: ['header', 'menu', 'topbar', 'nav'],
    w: 320,
    h: 56,
    parts: [
      { d: RECT, role: 'body' },
      { d: 'M 4 34 L 20 34 L 20 66 L 4 66 Z', role: 'accent' },
      { d: 'M 58 40 L 72 40 L 72 60 L 58 60 Z', role: 'accent' },
      { d: 'M 76 40 L 90 40 L 90 60 L 76 60 Z', role: 'accent' },
    ],
  },
  {
    id: 'ui-avatar',
    label: 'Avatar',
    keywords: ['profile', 'user', 'photo', 'person'],
    w: 80,
    h: 80,
    parts: [
      { d: ELLIPSE, role: 'body' },
      { d: 'M 34 34 A 16 16 0 1 0 66 34 A 16 16 0 1 0 34 34 Z', role: 'accent' },
      { d: 'M 22 90 Q 22 58 50 58 Q 78 58 78 90 Z', role: 'accent' },
    ],
  },
  {
    id: 'ui-checkbox',
    label: 'Checkbox',
    keywords: ['tick', 'select', 'option', 'form'],
    w: 150,
    h: 44,
    parts: [
      { d: 'M 2 16 L 32 16 L 32 84 L 2 84 Z', role: 'body' },
      { d: 'M 8 52 L 16 68 L 28 30', role: 'outline', strokeScale: 2 },
      { d: 'M 44 40 L 96 40 L 96 60 L 44 60 Z', role: 'accent' },
    ],
  },
  {
    id: 'ui-dropdown',
    label: 'Dropdown',
    keywords: ['select', 'picker', 'combobox', 'menu'],
    w: 200,
    h: 52,
    parts: [
      { d: ROUNDED_RECT, role: 'body' },
      { d: 'M 12 44 L 56 44 L 56 56 L 12 56 Z', role: 'accent' },
      { d: 'M 78 42 L 92 42 L 85 58 Z', role: 'accent' },
    ],
  },
  {
    id: 'ui-image',
    label: 'Image placeholder',
    keywords: ['photo', 'picture', 'media', 'thumbnail'],
    w: 190,
    h: 140,
    parts: [
      { d: RECT, role: 'body' },
      { d: 'M 0 0 L 100 100 M 100 0 L 0 100', role: 'outline' },
    ],
  },
  {
    id: 'ui-toggle',
    label: 'Toggle',
    keywords: ['switch', 'on off', 'boolean', 'setting'],
    w: 110,
    h: 50,
    parts: [
      { d: 'M 25 0 L 75 0 Q 100 0 100 50 Q 100 100 75 100 L 25 100 Q 0 100 0 50 Q 0 0 25 0 Z', role: 'accent' },
      { d: 'M 45 50 A 26 26 0 1 0 97 50 A 26 26 0 1 0 45 50 Z', role: 'white' },
    ],
  },
  {
    id: 'ui-slider',
    label: 'Slider',
    keywords: ['range', 'control', 'volume', 'track'],
    w: 200,
    h: 44,
    parts: [
      { d: 'M 0 42 L 100 42 L 100 58 L 0 58 Z', role: 'body' },
      { d: 'M 0 42 L 62 42 L 62 58 L 0 58 Z', role: 'accent' },
      { d: 'M 46 50 A 18 18 0 1 0 82 50 A 18 18 0 1 0 46 50 Z', role: 'white' },
    ],
  },
].map((s) => ({
  id: s.id,
  category: 'wireframe' as const,
  label: s.label,
  keywords: s.keywords,
  geometry: { kind: 'parts' as const, parts: s.parts as ShapePart[] },
  defaultWidth: s.w,
  defaultHeight: s.h,
  defaultFill: '#f8fafc',
  defaultStroke: '#64748b',
  accentColor: '#cbd5e1',
  labelPlacement: 'none' as const,
  ports: ALL_PORTS,
}));

/* ------------------------------------------------------------------ */
/* Public API                                                           */
/* ------------------------------------------------------------------ */

export const SHAPE_LIBRARY: ShapeDef[] = [
  ...BASIC,
  ...FLOWCHART,
  ...CALLOUTS,
  ...UML,
  ...CLOUD,
  ...WIREFRAME,
];

export const SHAPE_CATEGORIES: ShapeCategory[] = [
  { id: 'basic', title: 'Basic shapes', blurb: 'Rectangles, polygons and arrows', order: 1 },
  { id: 'flowchart', title: 'Flowchart', blurb: 'Standard ANSI process symbols', order: 2 },
  { id: 'callouts', title: 'Callouts', blurb: 'Speech bubbles and annotations', order: 3 },
  { id: 'uml', title: 'UML', blurb: 'Class, component and deployment notation', order: 4 },
  { id: 'aws', title: 'AWS architecture', blurb: 'Amazon Web Services building blocks', order: 5 },
  { id: 'azure', title: 'Azure cloud', blurb: 'Microsoft Azure building blocks', order: 6 },
  { id: 'gcp', title: 'Google Cloud', blurb: 'Google Cloud Platform building blocks', order: 7 },
  { id: 'wireframe', title: 'Wireframe & UI', blurb: 'Low-fidelity interface elements', order: 8 },
];

const SHAPE_INDEX: Record<string, ShapeDef> = SHAPE_LIBRARY.reduce(
  (acc, shape) => {
    acc[shape.id] = shape;
    return acc;
  },
  {} as Record<string, ShapeDef>
);

/** Look a shape up by its id. Returns undefined for unknown ids. */
export const getShapeDef = (id?: string | null): ShapeDef | undefined =>
  id ? SHAPE_INDEX[id] : undefined;

/**
 * `ElementType` values that predate the shape library and never had a renderer
 * of their own — they used to fall through to a plain blue rectangle. Mapping
 * them onto library entries means old boards containing them finally draw
 * something meaningful. Types that already have a bespoke renderer in
 * SketchCanvas (cylinder, cloud, aws-s3, …) are deliberately absent so their
 * appearance does not change.
 */
const LEGACY_TYPE_ALIASES: Record<string, string> = {
  'azure-sql': 'azure-database',
  'azure-func': 'azure-function',
  'azure-app': 'azure-compute',
  'azure-vault': 'azure-secrets',
  'azure-cosmos': 'azure-warehouse',
  'vmware-laptop': 'ui-card',
  'vmware-host': 'aws-compute',
  'vmware-storage': 'aws-block-store',
  'vmware-vm': 'aws-orchestrator',
};

/**
 * Last-resort lookup for an element that carries no `shapeId`. Matches the
 * element's `type` against library ids (uml-actor, ui-button and friends line
 * up exactly) and then against the legacy alias table.
 */
export const getShapeDefForLegacyType = (type?: string | null): ShapeDef | undefined => {
  if (!type) return undefined;
  return SHAPE_INDEX[type] || SHAPE_INDEX[LEGACY_TYPE_ALIASES[type]];
};

export const getShapesByCategory = (category: ShapeCategoryId): ShapeDef[] =>
  SHAPE_LIBRARY.filter((s) => s.category === category);

export const countShapesInCategory = (category: ShapeCategoryId): number =>
  getShapesByCategory(category).length;

/** Case-insensitive match across label, id and keywords. */
export const shapeMatchesQuery = (shape: ShapeDef, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    shape.label.toLowerCase().includes(q) ||
    shape.id.toLowerCase().includes(q) ||
    shape.keywords.some((k) => k.toLowerCase().includes(q))
  );
};

/**
 * Resolve the concrete color for a part, given the element's own styling.
 * Shared by the canvas renderer and the picker so previews always match.
 */
export const resolvePartColors = (
  part: ShapePart,
  shape: ShapeDef,
  fill: string,
  stroke: string
): { fill: string; stroke: string } => {
  switch (part.role) {
    case 'accent':
      return { fill: shape.accentColor || stroke, stroke };
    case 'outline':
      return { fill: 'transparent', stroke };
    case 'white':
      return { fill: '#ffffff', stroke };
    case 'body':
    default:
      return { fill, stroke };
  }
};
