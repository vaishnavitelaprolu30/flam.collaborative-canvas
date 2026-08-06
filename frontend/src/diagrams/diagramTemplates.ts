/**
 * Auto-generated diagrams.
 *
 * Same shape as the slide layouts: each template is a pure function from an
 * origin to a list of elements, so a template can be dropped on the canvas or
 * previewed without touching the store.
 *
 * Nodes reference `shapes/shapeLibrary.ts` by id, and connectors are wired up
 * by node id, so a generated flowchart behaves exactly like one drawn by hand —
 * you can drag a node and its arrows follow.
 */

import { CanvasElement } from '../types/canvas';
import { getShapeDef } from '../shapes/shapeLibrary';

export type DiagramCategoryId = 'flowchart' | 'process' | 'org' | 'architecture';

export interface DiagramTemplateDef {
  id: string;
  name: string;
  category: DiagramCategoryId;
  description: string;
  build: (originX: number, originY: number, seed: string) => CanvasElement[];
}

/** A node placed by a template, before it becomes a CanvasElement. */
interface NodeSpec {
  key: string;
  shapeId: string;
  label: string;
  dx: number;
  dy: number;
  w?: number;
  h?: number;
  fill?: string;
  stroke?: string;
}

interface EdgeSpec {
  from: string;
  to: string;
  label?: string;
  fromPort?: 'top' | 'right' | 'bottom' | 'left';
  toPort?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * Turn node/edge specs into canvas elements.
 *
 * Sizes fall back to the shape's own defaults from the manifest, so templates
 * only specify a size when they deliberately differ.
 */
const assemble = (
  ox: number,
  oy: number,
  seed: string,
  nodes: NodeSpec[],
  edges: EdgeSpec[]
): CanvasElement[] => {
  const now = Date.now();
  const idFor = (key: string) => `dg_${seed}_${key}`;

  const nodeElements = nodes.map((node) => {
    const def = getShapeDef(node.shapeId);
    return {
      id: idFor(node.key),
      type: 'rectangle',
      shapeId: node.shapeId,
      text: node.label,
      x: ox + node.dx,
      y: oy + node.dy,
      width: node.w ?? def?.defaultWidth ?? 160,
      height: node.h ?? def?.defaultHeight ?? 90,
      fill: node.fill ?? def?.defaultFill ?? '#eff6ff',
      stroke: node.stroke ?? def?.defaultStroke ?? '#3b82f6',
      strokeWidth: 2,
      opacity: 1,
      rotation: 0,
      isLocked: false,
      createdBy: 'local-user',
      createdAt: now,
      updatedAt: now,
    } as unknown as CanvasElement;
  });

  const edgeElements = edges.map((edge, i) => ({
    id: `${idFor('conn')}_${i}`,
    type: 'connector',
    fromId: idFor(edge.from),
    toId: idFor(edge.to),
    fromPort: edge.fromPort ?? 'right',
    toPort: edge.toPort ?? 'left',
    text: edge.label,
    routingStyle: 'elbow',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    stroke: '#64748b',
    strokeWidth: 2,
    fill: 'transparent',
    opacity: 1,
    rotation: 0,
    isLocked: false,
    createdBy: 'local-user',
    createdAt: now,
    updatedAt: now,
  })) as unknown as CanvasElement[];

  return [...nodeElements, ...edgeElements];
};

const GREEN = { fill: '#dcfce7', stroke: '#16a34a' };
const AMBER = { fill: '#fef9c3', stroke: '#ca8a04' };
const RED = { fill: '#fee2e2', stroke: '#dc2626' };
const BLUE = { fill: '#dbeafe', stroke: '#2563eb' };
const VIOLET = { fill: '#ede9fe', stroke: '#7c3aed' };

export const DIAGRAM_TEMPLATES: DiagramTemplateDef[] = [
  {
    id: 'basic-flow',
    name: 'Basic flowchart',
    category: 'flowchart',
    description: 'Start, process, decision and two outcomes',
    build: (x, y, seed) =>
      assemble(
        x,
        y,
        seed,
        [
          { key: 'start', shapeId: 'fc-terminator', label: 'Start', dx: 0, dy: 120, ...GREEN },
          { key: 'process', shapeId: 'fc-process', label: 'Do the work', dx: 240, dy: 120, ...BLUE },
          { key: 'decide', shapeId: 'fc-decision', label: 'Looks right?', dx: 490, dy: 105, w: 190, h: 130, ...AMBER },
          { key: 'yes', shapeId: 'fc-terminator', label: 'Done', dx: 760, dy: 20, ...GREEN },
          { key: 'no', shapeId: 'fc-terminator', label: 'Fix and retry', dx: 760, dy: 230, ...RED },
        ],
        [
          { from: 'start', to: 'process' },
          { from: 'process', to: 'decide' },
          { from: 'decide', to: 'yes', label: 'Yes' },
          { from: 'decide', to: 'no', label: 'No' },
          { from: 'no', to: 'process', fromPort: 'bottom', toPort: 'bottom' },
        ]
      ),
  },
  {
    id: 'decision-tree',
    name: 'Decision tree',
    category: 'flowchart',
    description: 'Two chained decisions with three outcomes',
    build: (x, y, seed) =>
      assemble(
        x,
        y,
        seed,
        [
          { key: 'q1', shapeId: 'fc-decision', label: 'Is it urgent?', dx: 0, dy: 160, w: 190, h: 130, ...AMBER },
          { key: 'q2', shapeId: 'fc-decision', label: 'Is it blocking?', dx: 270, dy: 20, w: 190, h: 130, ...AMBER },
          { key: 'now', shapeId: 'fc-terminator', label: 'Handle now', dx: 540, dy: 0, ...RED },
          { key: 'sprint', shapeId: 'fc-terminator', label: 'This sprint', dx: 540, dy: 150, ...BLUE },
          { key: 'backlog', shapeId: 'fc-terminator', label: 'Backlog', dx: 270, dy: 320, ...GREEN },
        ],
        [
          { from: 'q1', to: 'q2', label: 'Yes', fromPort: 'top', toPort: 'left' },
          { from: 'q1', to: 'backlog', label: 'No', fromPort: 'bottom', toPort: 'top' },
          { from: 'q2', to: 'now', label: 'Yes' },
          { from: 'q2', to: 'sprint', label: 'No', fromPort: 'bottom', toPort: 'left' },
        ]
      ),
  },
  {
    id: 'approval-workflow',
    name: 'Approval workflow',
    category: 'process',
    description: 'Submit, review, approve or send back',
    build: (x, y, seed) =>
      assemble(
        x,
        y,
        seed,
        [
          { key: 'submit', shapeId: 'fc-manual-input', label: 'Submit request', dx: 0, dy: 130, ...BLUE },
          { key: 'review', shapeId: 'fc-process', label: 'Manager review', dx: 240, dy: 130, ...VIOLET },
          { key: 'gate', shapeId: 'fc-decision', label: 'Approved?', dx: 490, dy: 115, w: 190, h: 130, ...AMBER },
          { key: 'ok', shapeId: 'fc-process', label: 'Provision access', dx: 760, dy: 30, ...GREEN },
          { key: 'back', shapeId: 'fc-document', label: 'Send back with notes', dx: 760, dy: 240, ...RED },
          { key: 'log', shapeId: 'fc-stored-data', label: 'Audit log', dx: 1010, dy: 30, ...BLUE },
        ],
        [
          { from: 'submit', to: 'review' },
          { from: 'review', to: 'gate' },
          { from: 'gate', to: 'ok', label: 'Yes' },
          { from: 'gate', to: 'back', label: 'No' },
          { from: 'ok', to: 'log' },
          { from: 'back', to: 'submit', fromPort: 'bottom', toPort: 'bottom' },
        ]
      ),
  },
  {
    id: 'swimlane',
    name: 'Swimlane process',
    category: 'process',
    description: 'Three lanes handing work across teams',
    build: (x, y, seed) => {
      const lanes = [
        { key: 'cust', label: 'Customer', color: BLUE, dy: 0 },
        { key: 'supp', label: 'Support', color: VIOLET, dy: 160 },
        { key: 'eng', label: 'Engineering', color: GREEN, dy: 320 },
      ];

      const laneHeaders: NodeSpec[] = lanes.map((lane) => ({
        key: `lane_${lane.key}`,
        shapeId: 'square',
        label: lane.label,
        dx: 0,
        dy: lane.dy,
        w: 140,
        h: 110,
        ...lane.color,
      }));

      const steps: NodeSpec[] = [
        { key: 'report', shapeId: 'fc-manual-input', label: 'Report issue', dx: 200, dy: 0, ...BLUE },
        { key: 'triage', shapeId: 'fc-process', label: 'Triage ticket', dx: 200, dy: 160, ...VIOLET },
        { key: 'fix', shapeId: 'fc-process', label: 'Ship a fix', dx: 440, dy: 320, ...GREEN },
        { key: 'verify', shapeId: 'fc-decision', label: 'Verified?', dx: 690, dy: 145, w: 180, h: 130, ...AMBER },
        { key: 'close', shapeId: 'fc-terminator', label: 'Close ticket', dx: 940, dy: 160, ...GREEN },
      ];

      return assemble(x, y, seed, [...laneHeaders, ...steps], [
        { from: 'report', to: 'triage', fromPort: 'bottom', toPort: 'top' },
        { from: 'triage', to: 'fix', fromPort: 'bottom', toPort: 'left' },
        { from: 'fix', to: 'verify', fromPort: 'right', toPort: 'bottom' },
        { from: 'verify', to: 'close', label: 'Yes' },
        { from: 'verify', to: 'triage', label: 'No', fromPort: 'top', toPort: 'right' },
      ]);
    },
  },
  {
    id: 'org-chart',
    name: 'Org chart',
    category: 'org',
    description: 'One lead with three reports',
    build: (x, y, seed) =>
      assemble(
        x,
        y,
        seed,
        [
          { key: 'lead', shapeId: 'uml-actor', label: 'Head of Product', dx: 330, dy: 0, ...VIOLET },
          { key: 'a', shapeId: 'uml-actor', label: 'Design Lead', dx: 100, dy: 240, ...BLUE },
          { key: 'b', shapeId: 'uml-actor', label: 'Engineering Lead', dx: 330, dy: 240, ...BLUE },
          { key: 'c', shapeId: 'uml-actor', label: 'Research Lead', dx: 560, dy: 240, ...BLUE },
        ],
        [
          { from: 'lead', to: 'a', fromPort: 'bottom', toPort: 'top' },
          { from: 'lead', to: 'b', fromPort: 'bottom', toPort: 'top' },
          { from: 'lead', to: 'c', fromPort: 'bottom', toPort: 'top' },
        ]
      ),
  },
  {
    id: 'web-architecture',
    name: 'Web app architecture',
    category: 'architecture',
    description: 'Client through gateway to services and data',
    build: (x, y, seed) =>
      assemble(
        x,
        y,
        seed,
        [
          { key: 'client', shapeId: 'ui-card', label: 'Web client', dx: 0, dy: 140, w: 150, h: 130 },
          { key: 'cdn', shapeId: 'aws-cdn', label: 'CDN', dx: 220, dy: 140 },
          { key: 'gw', shapeId: 'aws-api-gateway', label: 'API Gateway', dx: 440, dy: 140 },
          { key: 'svc', shapeId: 'aws-compute', label: 'App service', dx: 660, dy: 20 },
          { key: 'fn', shapeId: 'aws-function', label: 'Background jobs', dx: 660, dy: 280 },
          { key: 'db', shapeId: 'aws-database', label: 'Primary database', dx: 890, dy: 20 },
          { key: 'cache', shapeId: 'aws-cache', label: 'Cache', dx: 890, dy: 280 },
        ],
        [
          { from: 'client', to: 'cdn' },
          { from: 'cdn', to: 'gw' },
          { from: 'gw', to: 'svc' },
          { from: 'gw', to: 'fn' },
          { from: 'svc', to: 'db' },
          { from: 'fn', to: 'cache' },
        ]
      ),
  },
];

export const getDiagramTemplate = (id: string): DiagramTemplateDef | undefined =>
  DIAGRAM_TEMPLATES.find((t) => t.id === id);

/** Build a template's elements at a given origin. */
export const buildDiagram = (
  template: DiagramTemplateDef,
  originX: number,
  originY: number
): CanvasElement[] =>
  template.build(originX, originY, Math.random().toString(36).substring(2, 8));
