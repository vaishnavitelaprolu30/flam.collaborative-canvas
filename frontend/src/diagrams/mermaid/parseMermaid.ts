/**
 * A focused Mermaid parser.
 *
 * This deliberately does not use the `mermaid` npm package. That library
 * renders to a flat SVG, which would land on the board as a single
 * uneditable image. Parsing the text ourselves lets each node become a real
 * shape and each edge a real connector, so a generated diagram can be dragged,
 * restyled and extended exactly like a hand-drawn one.
 *
 * Supported today:
 *   flowchart / graph  — all standard node shapes and link styles
 *   sequenceDiagram    — participants and messages
 *   classDiagram       — classes and relationships
 *   erDiagram          — entities and relationships
 *
 * Anything it cannot interpret is reported through `errors` rather than thrown,
 * so the editor can show a useful message while still drawing what it did
 * understand.
 */

export type MermaidDiagramType = 'flowchart' | 'sequence' | 'class' | 'er' | 'unknown';

export type MermaidDirection = 'TD' | 'TB' | 'BT' | 'LR' | 'RL';

/** Node shapes Mermaid can express, mapped to library shapes downstream. */
export type MermaidNodeShape =
  | 'rect'
  | 'round'
  | 'stadium'
  | 'subroutine'
  | 'cylinder'
  | 'circle'
  | 'rhombus'
  | 'hexagon'
  | 'parallelogram'
  | 'trapezoid'
  | 'asymmetric';

export interface MermaidNode {
  id: string;
  label: string;
  shape: MermaidNodeShape;
}

export type MermaidEdgeStyle = 'solid' | 'dotted' | 'thick';

export interface MermaidEdge {
  from: string;
  to: string;
  label?: string;
  style: MermaidEdgeStyle;
  /** False for `---` style links, which carry no arrowhead. */
  arrow: boolean;
}

/**
 * One message in a sequence diagram.
 *
 * Sequence diagrams are ordered in time, so unlike a flowchart edge these must
 * keep their declaration order — that order *is* the vertical axis.
 */
export interface SequenceMessage {
  from: string;
  to: string;
  label: string;
  /** `-->` and `-->>` render dashed, conventionally a reply. */
  dotted: boolean;
  /** `->` and `-->` carry no arrowhead. */
  arrow: boolean;
  /** `A->>+B` activates B. */
  activateTarget: boolean;
  /** `B-->>-A` deactivates B, the sender. */
  deactivateSource: boolean;
}

export interface MermaidSequence {
  participants: { id: string; label: string }[];
  messages: SequenceMessage[];
}

export interface ParsedMermaid {
  type: MermaidDiagramType;
  direction: MermaidDirection;
  nodes: MermaidNode[];
  edges: MermaidEdge[];
  /** Present only for sequenceDiagram; drives the dedicated layout. */
  sequence?: MermaidSequence;
  errors: string[];
}

/**
 * Node shape delimiters, longest-first.
 *
 * Order is load-bearing: `A[[x]]` and `A[(x)]` must be tested before `A[x]`,
 * otherwise the single-bracket pattern wins and eats the wrong text.
 */
const SHAPE_PATTERNS: { open: string; close: string; shape: MermaidNodeShape }[] = [
  { open: '([', close: '])', shape: 'stadium' },
  { open: '[[', close: ']]', shape: 'subroutine' },
  { open: '[(', close: ')]', shape: 'cylinder' },
  { open: '((', close: '))', shape: 'circle' },
  { open: '{{', close: '}}', shape: 'hexagon' },
  { open: '[/', close: '\\]', shape: 'trapezoid' },
  { open: '[\\', close: '/]', shape: 'trapezoid' },
  { open: '[/', close: '/]', shape: 'parallelogram' },
  { open: '[\\', close: '\\]', shape: 'parallelogram' },
  { open: '[', close: ']', shape: 'rect' },
  { open: '(', close: ')', shape: 'round' },
  { open: '{', close: '}', shape: 'rhombus' },
  { open: '>', close: ']', shape: 'asymmetric' },
];

const stripQuotes = (raw: string): string => {
  const t = raw.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
};

/** Mermaid allows <br/> inside labels; turn it into a real newline. */
const normalizeLabel = (raw: string): string =>
  stripQuotes(raw).replace(/<br\s*\/?>/gi, '\n').trim();

/**
 * Read one node reference starting at `index`.
 * Returns the node plus the index just past it, or null if there is no node here.
 */
const readNode = (
  text: string,
  index: number
): { node: MermaidNode; next: number } | null => {
  // An id runs until a shape delimiter or whitespace.
  const idMatch = /^[A-Za-z0-9_.-]+/.exec(text.slice(index));
  if (!idMatch) return null;

  const id = idMatch[0];
  let cursor = index + id.length;

  for (const pattern of SHAPE_PATTERNS) {
    if (!text.startsWith(pattern.open, cursor)) continue;

    const labelStart = cursor + pattern.open.length;
    const closeAt = text.indexOf(pattern.close, labelStart);
    if (closeAt === -1) continue;

    return {
      node: {
        id,
        label: normalizeLabel(text.slice(labelStart, closeAt)) || id,
        shape: pattern.shape,
      },
      next: closeAt + pattern.close.length,
    };
  }

  // A bare id: a node referenced without re-declaring its shape.
  return { node: { id, label: id, shape: 'rect' }, next: cursor };
};

/**
 * Match a link operator at `index`.
 * Handles `-->`, `---`, `-.->`, `==>`, `--o`, `--x` and their labelled forms.
 */
const readLink = (
  text: string,
  index: number
): { style: MermaidEdgeStyle; arrow: boolean; label?: string; next: number } | null => {
  const rest = text.slice(index);

  // `-- label -->` / `-. label .->` / `== label ==>`
  const inlineLabel = /^(-{2,}|-\.-|={2,})\s+([^->=.|]+?)\s+(-{2,}>|-\.->|={2,}>|-{3,}|-\.-|={3,})/.exec(rest);
  if (inlineLabel) {
    const tail = inlineLabel[3];
    return {
      style: tail.includes('.') ? 'dotted' : tail.startsWith('=') ? 'thick' : 'solid',
      arrow: tail.endsWith('>'),
      label: normalizeLabel(inlineLabel[2]),
      next: index + inlineLabel[0].length,
    };
  }

  // `-->|label|`
  const opMatch = /^(-\.-+>|-\.-|={2,}>|={3,}|-{2,}>|-{3,}|-{2,}[ox])/.exec(rest);
  if (!opMatch) return null;

  const op = opMatch[0];
  let next = index + op.length;
  let label: string | undefined;

  const pipe = /^\|([^|]*)\|/.exec(text.slice(next));
  if (pipe) {
    label = normalizeLabel(pipe[1]);
    next += pipe[0].length;
  }

  return {
    style: op.includes('.') ? 'dotted' : op.startsWith('=') ? 'thick' : 'solid',
    arrow: op.endsWith('>') || op.endsWith('o') || op.endsWith('x'),
    label,
    next,
  };
};

/** Strip comments and blank lines, and drop directives Mermaid allows. */
const cleanLines = (source: string): string[] =>
  source
    .split('\n')
    .map((line) => {
      const commentAt = line.indexOf('%%');
      return (commentAt === -1 ? line : line.slice(0, commentAt)).trim();
    })
    .filter((line) => line.length > 0);

const parseFlowchart = (lines: string[], direction: MermaidDirection): ParsedMermaid => {
  const nodes = new Map<string, MermaidNode>();
  const edges: MermaidEdge[] = [];
  const errors: string[] = [];

  /** Later declarations with a real label win over bare-id placeholders. */
  const remember = (node: MermaidNode) => {
    const existing = nodes.get(node.id);
    if (!existing || (existing.label === existing.id && node.label !== node.id)) {
      nodes.set(node.id, node);
    }
  };

  for (const line of lines) {
    // subgraph/end are structural; nodes inside are kept, grouping is flattened.
    if (/^(subgraph|end|direction|classDef|class|style|linkStyle|click)\b/i.test(line)) continue;

    let cursor = 0;
    let previousId: string | null = null;
    let pendingLink: { style: MermaidEdgeStyle; arrow: boolean; label?: string } | null = null;
    let consumedAnything = false;

    while (cursor < line.length) {
      if (line[cursor] === ' ' || line[cursor] === '\t') {
        cursor++;
        continue;
      }

      const link = readLink(line, cursor);
      if (link) {
        pendingLink = { style: link.style, arrow: link.arrow, label: link.label };
        cursor = link.next;
        consumedAnything = true;
        continue;
      }

      const read = readNode(line, cursor);
      if (!read) {
        cursor++;
        continue;
      }

      remember(read.node);
      consumedAnything = true;

      if (previousId && pendingLink) {
        edges.push({
          from: previousId,
          to: read.node.id,
          label: pendingLink.label,
          style: pendingLink.style,
          arrow: pendingLink.arrow,
        });
        pendingLink = null;
      }

      previousId = read.node.id;
      cursor = read.next;
    }

    if (!consumedAnything) errors.push(`Could not read: "${line}"`);
  }

  return { type: 'flowchart', direction, nodes: [...nodes.values()], edges, errors };
};

/**
 * Sequence participant ids are plain identifiers.
 *
 * Critically this must NOT include `-`. When it did, the greedy match ate the
 * arrow's own dashes and `John-->>-Alice` parsed as a participant called
 * `John-` talking to one called `-Alice`.
 */
const SEQ_ID = '[A-Za-z0-9_]+';

const parseSequence = (lines: string[]): ParsedMermaid => {
  const participants = new Map<string, { id: string; label: string }>();
  const messages: SequenceMessage[] = [];
  const errors: string[] = [];

  const remember = (id: string, label?: string) => {
    const existing = participants.get(id);
    if (!existing) participants.set(id, { id, label: label || id });
    else if (label) participants.set(id, { id, label });
  };

  // `Alice->>+John: text` — dashes, arrowhead, optional activation marker.
  const messageRe = new RegExp(
    `^(${SEQ_ID})\\s*(--?)(>>|>|x|\\))\\s*([+-]?)\\s*(${SEQ_ID})\\s*:\\s*(.*)$`
  );
  const participantRe = new RegExp(`^(?:participant|actor)\\s+(${SEQ_ID})(?:\\s+as\\s+(.+))?$`, 'i');

  for (const line of lines) {
    const participant = participantRe.exec(line);
    if (participant) {
      remember(participant[1], participant[2] ? normalizeLabel(participant[2]) : undefined);
      continue;
    }

    const message = messageRe.exec(line);
    if (message) {
      const [, from, dashes, head, activation, to, label] = message;
      remember(from);
      remember(to);
      messages.push({
        from,
        to,
        label: normalizeLabel(label),
        dotted: dashes === '--',
        arrow: head !== '>',
        activateTarget: activation === '+',
        deactivateSource: activation === '-',
      });
      continue;
    }

    // Block keywords and notes are structural; skip without complaining.
    if (
      /^(sequenceDiagram|autonumber|loop|alt|else|opt|par|and|critical|option|break|end|note|activate|deactivate|rect|box|links?|participant|actor)\b/i.test(
        line
      )
    ) {
      continue;
    }

    errors.push(`Could not read: "${line}"`);
  }

  const ordered = [...participants.values()];

  return {
    type: 'sequence',
    direction: 'LR',
    // Kept so anything reading the generic graph still works.
    nodes: ordered.map((p) => ({ id: p.id, label: p.label, shape: 'rect' as MermaidNodeShape })),
    edges: messages.map((m) => ({
      from: m.from,
      to: m.to,
      label: m.label,
      style: m.dotted ? ('dotted' as const) : ('solid' as const),
      arrow: m.arrow,
    })),
    sequence: { participants: ordered, messages },
    errors,
  };
};

const parseClass = (lines: string[]): ParsedMermaid => {
  const nodes = new Map<string, MermaidNode>();
  const edges: MermaidEdge[] = [];
  const errors: string[] = [];

  const remember = (id: string) => {
    if (!nodes.has(id)) nodes.set(id, { id, label: id, shape: 'rect' });
  };

  for (const line of lines) {
    if (/^classDiagram/i.test(line)) continue;

    // `A <|-- B : label`, `A *-- B`, `A o-- B`, `A ..> B`
    const rel = /^([A-Za-z0-9_.-]+)\s*(<\|--|--\|>|\*--|--\*|o--|--o|<\.\.|\.\.>|-->|<--|--|\.\.)\s*([A-Za-z0-9_.-]+)\s*(?::\s*(.+))?$/.exec(line);
    if (rel) {
      remember(rel[1]);
      remember(rel[3]);
      edges.push({
        from: rel[1],
        to: rel[3],
        label: rel[4] ? normalizeLabel(rel[4]) : undefined,
        style: rel[2].includes('.') ? 'dotted' : 'solid',
        arrow: true,
      });
      continue;
    }

    // `class Foo {` opens a member block; keep the class, skip its members.
    const cls = /^class\s+([A-Za-z0-9_.-]+)/.exec(line);
    if (cls) {
      remember(cls[1]);
      continue;
    }

    if (/^[}{]/.test(line) || /^[+\-#~]/.test(line)) continue;

    errors.push(`Could not read: "${line}"`);
  }

  return { type: 'class', direction: 'TD', nodes: [...nodes.values()], edges, errors };
};

const parseEr = (lines: string[]): ParsedMermaid => {
  const nodes = new Map<string, MermaidNode>();
  const edges: MermaidEdge[] = [];
  const errors: string[] = [];
  let inAttributeBlock = false;

  const remember = (id: string) => {
    if (!nodes.has(id)) nodes.set(id, { id, label: id, shape: 'rect' });
  };

  for (const line of lines) {
    if (/^erDiagram/i.test(line)) continue;

    if (inAttributeBlock) {
      if (line.startsWith('}')) inAttributeBlock = false;
      continue;
    }

    // `CUSTOMER ||--o{ ORDER : places`
    const rel = /^([A-Za-z0-9_.-]+)\s+([|}o][|}o{.-]*[|{o-])\s+([A-Za-z0-9_.-]+)\s*:\s*(.+)$/.exec(line);
    if (rel) {
      remember(rel[1]);
      remember(rel[3]);
      edges.push({
        from: rel[1],
        to: rel[3],
        label: normalizeLabel(rel[4]),
        style: rel[2].includes('..') ? 'dotted' : 'solid',
        arrow: true,
      });
      continue;
    }

    const entityBlock = /^([A-Za-z0-9_.-]+)\s*\{$/.exec(line);
    if (entityBlock) {
      remember(entityBlock[1]);
      inAttributeBlock = true;
      continue;
    }

    errors.push(`Could not read: "${line}"`);
  }

  return { type: 'er', direction: 'LR', nodes: [...nodes.values()], edges, errors };
};

/** Parse Mermaid source into a node/edge graph. Never throws. */
export const parseMermaid = (source: string): ParsedMermaid => {
  const lines = cleanLines(source);

  if (lines.length === 0) {
    return { type: 'unknown', direction: 'TD', nodes: [], edges: [], errors: [] };
  }

  const header = lines[0];

  const flow = /^(?:flowchart|graph)\s*(TD|TB|BT|LR|RL)?/i.exec(header);
  if (flow) {
    const direction = (flow[1]?.toUpperCase() as MermaidDirection) || 'TD';
    return parseFlowchart(lines.slice(1), direction);
  }

  if (/^sequenceDiagram/i.test(header)) return parseSequence(lines.slice(1));
  if (/^classDiagram/i.test(header)) return parseClass(lines);
  if (/^erDiagram/i.test(header)) return parseEr(lines);

  return {
    type: 'unknown',
    direction: 'TD',
    nodes: [],
    edges: [],
    errors: [
      `Unrecognised diagram type. Start your code with "flowchart TD", "sequenceDiagram", "classDiagram" or "erDiagram".`,
    ],
  };
};
