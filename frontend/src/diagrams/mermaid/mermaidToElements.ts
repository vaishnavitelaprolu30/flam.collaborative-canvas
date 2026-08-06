/**
 * Turns a parsed Mermaid graph into positioned canvas elements.
 *
 * Mermaid itself relies on dagre for layout. Rather than pull that in, this
 * uses a layered (Sugiyama-style) placement, which is what dagre does for the
 * directed graphs people actually write as flowcharts: assign each node a rank
 * by longest path from a root, then space ranks along the flow direction and
 * spread nodes across it.
 */

import { CanvasElement } from '../../types/canvas';
import { getShapeDef } from '../../shapes/shapeLibrary';
import { MermaidEdge, MermaidNode, MermaidNodeShape, ParsedMermaid } from './parseMermaid';
import { choosePorts } from '../connectorRouting';
import { buildSequenceElements } from './sequenceLayout';

/** Mermaid node shapes onto ids in the shape library. */
const SHAPE_MAP: Record<MermaidNodeShape, string> = {
  rect: 'fc-process',
  round: 'rounded-square',
  stadium: 'fc-terminator',
  subroutine: 'fc-predefined',
  cylinder: 'fc-stored-data',
  circle: 'fc-connector',
  rhombus: 'fc-decision',
  hexagon: 'fc-preparation',
  parallelogram: 'fc-data',
  trapezoid: 'fc-manual-operation',
  asymmetric: 'fc-document',
};

/** Palette cycled per rank so long flows stay readable. */
const RANK_COLORS = [
  { fill: '#dcfce7', stroke: '#16a34a' },
  { fill: '#dbeafe', stroke: '#2563eb' },
  { fill: '#ede9fe', stroke: '#7c3aed' },
  { fill: '#fef9c3', stroke: '#ca8a04' },
  { fill: '#ffe4e6', stroke: '#e11d48' },
  { fill: '#ccfbf1', stroke: '#0d9488' },
];

const NODE_GAP_ALONG = 120; // between ranks
const NODE_GAP_ACROSS = 48; // between siblings in a rank

/** Roughly size a node to its longest line of text. */
const measureNode = (node: MermaidNode): { width: number; height: number } => {
  const def = getShapeDef(SHAPE_MAP[node.shape]);
  const lines = node.label.split('\n');
  const longest = lines.reduce((max, l) => Math.max(max, l.length), 0);

  const width = Math.max(def?.defaultWidth ?? 160, Math.min(320, longest * 8.6 + 48));
  const height = Math.max(def?.defaultHeight ?? 90, lines.length * 22 + 52);

  // Decisions and circles read better with more vertical room / square-ish.
  if (node.shape === 'rhombus') return { width: Math.max(width, 180), height: Math.max(height, 130) };
  if (node.shape === 'circle') {
    const d = Math.max(100, Math.min(width, 150));
    return { width: d, height: d };
  }
  return { width, height };
};

/**
 * Assign each node a rank: 0 for sources, otherwise one past its deepest
 * predecessor. Cycles (a retry arrow looping back) are broken by capping the
 * number of relaxation passes at the node count.
 */
const rankNodes = (nodes: MermaidNode[], edges: MermaidEdge[]): Map<string, number> => {
  const rank = new Map<string, number>();
  nodes.forEach((n) => rank.set(n.id, 0));

  const incoming = new Map<string, string[]>();
  nodes.forEach((n) => incoming.set(n.id, []));
  edges.forEach((e) => {
    if (incoming.has(e.to) && rank.has(e.from)) incoming.get(e.to)!.push(e.from);
  });

  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const node of nodes) {
      const preds = incoming.get(node.id) || [];
      for (const pred of preds) {
        if (pred === node.id) continue; // self-loop
        const candidate = (rank.get(pred) ?? 0) + 1;
        if (candidate > (rank.get(node.id) ?? 0)) {
          rank.set(node.id, candidate);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  return rank;
};

export interface MermaidBuildResult {
  elements: CanvasElement[];
  /** Bounding size of the generated diagram, for centring and preview. */
  width: number;
  height: number;
  nodeCount: number;
  edgeCount: number;
}

/**
 * Build canvas elements for a parsed diagram, positioned from `originX/Y`.
 * Returns an empty result when there is nothing to draw.
 */
export const mermaidToElements = (
  parsed: ParsedMermaid,
  originX: number,
  originY: number,
  seed = Math.random().toString(36).substring(2, 8)
): MermaidBuildResult => {
  // Sequence diagrams need their own placement — see sequenceLayout.ts.
  if (parsed.type === 'sequence' && parsed.sequence) {
    return buildSequenceElements(parsed.sequence, originX, originY, seed);
  }

  const { nodes, edges, direction } = parsed;
  if (nodes.length === 0) {
    return { elements: [], width: 0, height: 0, nodeCount: 0, edgeCount: 0 };
  }

  const isHorizontal = direction === 'LR' || direction === 'RL';
  const isReversed = direction === 'RL' || direction === 'BT';

  const rank = rankNodes(nodes, edges);
  const sizes = new Map(nodes.map((n) => [n.id, measureNode(n)]));

  // Group by rank, preserving declaration order within each.
  const byRank = new Map<number, MermaidNode[]>();
  nodes.forEach((n) => {
    const r = rank.get(n.id) ?? 0;
    if (!byRank.has(r)) byRank.set(r, []);
    byRank.get(r)!.push(n);
  });
  const rankKeys = [...byRank.keys()].sort((a, b) => a - b);

  // Extent of each rank along the flow axis, and across it.
  const rankExtent = new Map<number, number>();
  const rankSpread = new Map<number, number>();
  rankKeys.forEach((r) => {
    const group = byRank.get(r)!;
    const along = group.reduce(
      (max, n) => Math.max(max, isHorizontal ? sizes.get(n.id)!.width : sizes.get(n.id)!.height),
      0
    );
    const across = group.reduce(
      (sum, n) => sum + (isHorizontal ? sizes.get(n.id)!.height : sizes.get(n.id)!.width),
      0
    );
    rankExtent.set(r, along);
    rankSpread.set(r, across + NODE_GAP_ACROSS * Math.max(0, group.length - 1));
  });

  const widestSpread = Math.max(...rankKeys.map((r) => rankSpread.get(r)!));

  // Walk the ranks, laying each one out centred on the widest.
  const positions = new Map<string, { x: number; y: number; width: number; height: number }>();
  /**
   * Colour by visual row, not by raw rank. A cycle (a retry arrow looping back)
   * inflates rank numbers without changing where a node is drawn, so keying the
   * palette off the raw value made colours jump around unpredictably.
   */
  const rowOfNode = new Map<string, number>();
  let alongCursor = 0;

  const orderedRanks = isReversed ? [...rankKeys].reverse() : rankKeys;

  orderedRanks.forEach((r, rowIndex) => {
    byRank.get(r)!.forEach((node) => rowOfNode.set(node.id, rowIndex));
  });

  orderedRanks.forEach((r) => {
    const group = byRank.get(r)!;
    let acrossCursor = (widestSpread - rankSpread.get(r)!) / 2;

    group.forEach((node) => {
      const size = sizes.get(node.id)!;
      const alongSize = isHorizontal ? size.width : size.height;
      const acrossSize = isHorizontal ? size.height : size.width;

      // Centre each node within its rank's band along the flow axis.
      const alongOffset = alongCursor + (rankExtent.get(r)! - alongSize) / 2;

      positions.set(node.id, {
        x: originX + (isHorizontal ? alongOffset : acrossCursor),
        y: originY + (isHorizontal ? acrossCursor : alongOffset),
        width: size.width,
        height: size.height,
      });

      acrossCursor += acrossSize + NODE_GAP_ACROSS;
    });

    alongCursor += rankExtent.get(r)! + NODE_GAP_ALONG;
  });

  const now = Date.now();
  const idFor = (nodeId: string) => `mmd_${seed}_${nodeId}`;

  const nodeElements = nodes.map((node) => {
    const pos = positions.get(node.id)!;
    const shapeId = SHAPE_MAP[node.shape];
    const color = RANK_COLORS[(rowOfNode.get(node.id) ?? 0) % RANK_COLORS.length];

    return {
      id: idFor(node.id),
      type: 'rectangle',
      shapeId,
      text: node.label,
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      width: Math.round(pos.width),
      height: Math.round(pos.height),
      fill: color.fill,
      stroke: color.stroke,
      strokeWidth: 2,
      opacity: 1,
      rotation: 0,
      isLocked: false,
      createdBy: 'local-user',
      createdAt: now,
      updatedAt: now,
    } as unknown as CanvasElement;
  });

  const edgeElements = edges
    .filter((e) => positions.has(e.from) && positions.has(e.to))
    .map((edge, i) => {
      // Ports are chosen per edge from the nodes' actual placement. A single
      // global pair broke back-edges: a retry arrow looping upward would still
      // leave from the bottom and cut straight back through the diagram.
      const { fromPort, toPort } = choosePorts(
        positions.get(edge.from)!,
        positions.get(edge.to)!
      );

      return {
      id: `mmd_${seed}_edge_${i}`,
      type: 'connector',
      fromId: idFor(edge.from),
      toId: idFor(edge.to),
      fromPort,
      toPort,
      text: edge.label,
      routingStyle: 'elbow',
      isAnimated: false,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      stroke: edge.style === 'thick' ? '#334155' : '#64748b',
      strokeWidth: edge.style === 'thick' ? 3 : 2,
      strokeDash: edge.style === 'dotted' ? 'dashed' : 'solid',
      fill: 'transparent',
      opacity: 1,
      rotation: 0,
      isLocked: false,
      createdBy: 'local-user',
      createdAt: now,
      updatedAt: now,
      };
    }) as unknown as CanvasElement[];

  const allPositions = [...positions.values()];
  const maxX = Math.max(...allPositions.map((p) => p.x + p.width));
  const maxY = Math.max(...allPositions.map((p) => p.y + p.height));

  return {
    elements: [...nodeElements, ...edgeElements],
    width: maxX - originX,
    height: maxY - originY,
    nodeCount: nodeElements.length,
    edgeCount: edgeElements.length,
  };
};

/** Starter snippets offered under "or start with a template". */
export const MERMAID_TEMPLATES: { id: string; label: string; code: string }[] = [
  {
    id: 'flowchart',
    label: 'Flowchart',
    code: `flowchart TD
    A([Start]) --> B[Collect user input]
    B --> C{Input valid?}
    C -->|Yes| D[Save to database]
    C -->|No| E[Show error message]
    E --> B
    D --> F([Done])`,
  },
  {
    id: 'er',
    label: 'ER diagram',
    code: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    PRODUCT ||--o{ LINE_ITEM : "ordered in"
    CUSTOMER ||--o{ ADDRESS : has`,
  },
  {
    id: 'class',
    label: 'Class',
    code: `classDiagram
    Animal <|-- Duck : extends
    Animal <|-- Fish : extends
    Animal <|-- Zebra : extends
    Animal *-- Habitat : lives in
    Duck ..> Pond : uses`,
  },
  {
    id: 'sequence',
    label: 'Sequence',
    code: `sequenceDiagram
    participant U as User
    participant A as API
    participant D as Database
    U->>A: POST /login
    A->>D: find user
    D-->>A: user record
    A-->>U: session token`,
  },
];
