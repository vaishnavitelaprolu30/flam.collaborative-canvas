/**
 * SyncSketch slide layout library.
 *
 * Each layout is a pure function from a frame origin to the list of elements
 * that make up the slide. Nothing here touches the store, which means the same
 * `build()` output can be dropped onto the canvas *or* rendered as a preview
 * thumbnail — the picker never has to fake what a layout looks like.
 *
 * Adding a layout: append a `SlideLayoutDef`. No other file changes.
 */

import { CanvasElement } from '../types/canvas';

export type SlideCategoryId =
  | 'title'
  | 'content'
  | 'data'
  | 'diagram'
  | 'interactive'
  | 'team';

export interface SlideCategory {
  id: SlideCategoryId;
  title: string;
  order: number;
}

export interface SlideLayoutDef {
  id: string;
  name: string;
  category: SlideCategoryId;
  description: string;
  frameSize: { width: number; height: number };
  /**
   * Build the slide's child elements. Coordinates returned are absolute, based
   * on the frame origin passed in. `seed` keeps generated ids unique.
   */
  build: (originX: number, originY: number, seed: string) => CanvasElement[];
}

export const SLIDE_CATEGORIES: SlideCategory[] = [
  { id: 'title', title: 'Title & section', order: 1 },
  { id: 'content', title: 'Content', order: 2 },
  { id: 'data', title: 'Data & metrics', order: 3 },
  { id: 'diagram', title: 'Diagrams', order: 4 },
  { id: 'interactive', title: 'Workshop & interactive', order: 5 },
  { id: 'team', title: 'People', order: 6 },
];

/** Every slide frame is this size unless a layout overrides it. */
const SLIDE_W = 650;
const SLIDE_H = 420;

/* ------------------------------------------------------------------ */
/* Element factories                                                    */
/*                                                                      */
/* All coordinates below are offsets from the frame's top-left corner,  */
/* which keeps layout definitions readable and position-independent.    */
/* ------------------------------------------------------------------ */

interface Builder {
  text: (
    dx: number,
    dy: number,
    w: number,
    h: number,
    value: string,
    opts?: { size?: number; color?: string; align?: 'left' | 'center' | 'right'; weight?: string }
  ) => CanvasElement;
  rect: (
    dx: number,
    dy: number,
    w: number,
    h: number,
    opts?: { fill?: string; stroke?: string; strokeWidth?: number; rounded?: boolean }
  ) => CanvasElement;
  ellipse: (
    dx: number,
    dy: number,
    w: number,
    h: number,
    opts?: { fill?: string; stroke?: string; strokeWidth?: number; opacity?: number }
  ) => CanvasElement;
  sticky: (dx: number, dy: number, w: number, h: number, value: string, color: string) => CanvasElement;
  shape: (
    dx: number,
    dy: number,
    w: number,
    h: number,
    shapeId: string,
    label?: string,
    opts?: { fill?: string; stroke?: string }
  ) => CanvasElement;
  line: (dx: number, dy: number, dx2: number, dy2: number, opts?: { color?: string; width?: number }) => CanvasElement;
}

const makeBuilder = (ox: number, oy: number, seed: string): Builder => {
  let counter = 0;
  const nextId = (kind: string) => `${kind}_${seed}_${counter++}`;
  const now = Date.now();

  const common = {
    opacity: 1,
    rotation: 0,
    isLocked: false,
    createdBy: 'local-user',
    createdAt: now,
    updatedAt: now,
  };

  return {
    text: (dx, dy, w, h, value, opts = {}) =>
      ({
        id: nextId('text'),
        type: 'text',
        text: value,
        x: ox + dx,
        y: oy + dy,
        width: w,
        height: h,
        fontSize: opts.size ?? 16,
        fontFamily: 'Inter',
        fontWeight: opts.weight ?? 'bold',
        fontStyle: 'normal',
        align: opts.align ?? 'left',
        stroke: opts.color ?? '#0f172a',
        strokeWidth: 1,
        fill: 'transparent',
        ...common,
      }) as unknown as CanvasElement,

    rect: (dx, dy, w, h, opts = {}) =>
      ({
        id: nextId('rect'),
        type: opts.rounded ? 'rounded-rectangle' : 'rectangle',
        x: ox + dx,
        y: oy + dy,
        width: w,
        height: h,
        stroke: opts.stroke ?? '#cbd5e1',
        strokeWidth: opts.strokeWidth ?? 2,
        fill: opts.fill ?? '#f8fafc',
        ...common,
      }) as unknown as CanvasElement,

    ellipse: (dx, dy, w, h, opts = {}) =>
      ({
        id: nextId('ellipse'),
        type: 'ellipse',
        x: ox + dx,
        y: oy + dy,
        width: w,
        height: h,
        stroke: opts.stroke ?? '#3b82f6',
        strokeWidth: opts.strokeWidth ?? 2,
        fill: opts.fill ?? '#eff6ff',
        ...common,
        opacity: opts.opacity ?? 1,
      }) as unknown as CanvasElement,

    sticky: (dx, dy, w, h, value, color) =>
      ({
        id: nextId('sticky'),
        type: 'sticky',
        text: value,
        x: ox + dx,
        y: oy + dy,
        width: w,
        height: h,
        fontSize: 14,
        fontFamily: 'Inter',
        align: 'left',
        stickyColor: color,
        fill: color,
        stroke: 'transparent',
        strokeWidth: 1,
        ...common,
      }) as unknown as CanvasElement,

    shape: (dx, dy, w, h, shapeId, label, opts = {}) =>
      ({
        id: nextId('shape'),
        type: 'rectangle',
        shapeId,
        text: label,
        x: ox + dx,
        y: oy + dy,
        width: w,
        height: h,
        stroke: opts.stroke ?? '#3b82f6',
        strokeWidth: 2,
        fill: opts.fill ?? '#eff6ff',
        ...common,
      }) as unknown as CanvasElement,

    line: (dx, dy, dx2, dy2, opts = {}) =>
      ({
        id: nextId('line'),
        type: 'line',
        points: [0, 0, dx2 - dx, dy2 - dy],
        x: ox + dx,
        y: oy + dy,
        width: Math.abs(dx2 - dx),
        height: Math.abs(dy2 - dy),
        stroke: opts.color ?? '#cbd5e1',
        strokeWidth: opts.width ?? 2,
        fill: 'transparent',
        ...common,
      }) as unknown as CanvasElement,
  };
};

/* Palette shared across layouts so decks look like one deck. */
const INK = '#0f172a';
const MUTED = '#64748b';
const BRAND = '#4f46e5';

/* ------------------------------------------------------------------ */
/* Layouts                                                              */
/* ------------------------------------------------------------------ */

export const SLIDE_LAYOUTS: SlideLayoutDef[] = [
  /* -------------------------- Title & section ---------------------- */
  {
    id: 'title-slide',
    name: 'Title slide',
    category: 'title',
    description: 'Headline with a presenter byline',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      return [
        b.text(50, 140, 550, 50, 'One Line Slide Title', { size: 32, color: INK }),
        b.text(50, 200, 400, 30, 'Your Name • Role, Team or Company', {
          size: 16,
          color: MUTED,
          weight: 'normal',
        }),
      ];
    },
  },
  {
    id: 'title-image',
    name: 'Title and image',
    category: 'title',
    description: 'Headline left, media placeholder right',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      return [
        b.text(40, 120, 300, 60, 'Two Line Slide Title Overview', { size: 28, color: INK }),
        b.shape(360, 60, 250, 300, 'ui-image', undefined, { fill: '#eff6ff', stroke: '#3b82f6' }),
      ];
    },
  },
  {
    id: 'section-title',
    name: 'Section divider',
    category: 'title',
    description: 'Numbered section break with a rule',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      return [
        b.text(50, 150, 100, 60, '01', { size: 52, color: BRAND }),
        b.text(50, 220, 550, 46, 'Section Title', { size: 34, color: INK }),
        b.rect(50, 280, 120, 5, { fill: BRAND, stroke: BRAND, strokeWidth: 0 }),
        b.text(50, 300, 480, 30, 'A one-line description of what this section covers.', {
          size: 15,
          color: MUTED,
          weight: 'normal',
        }),
      ];
    },
  },
  {
    id: 'closing',
    name: 'Closing slide',
    category: 'title',
    description: 'Thank you, with contact and next steps',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      return [
        b.text(0, 150, SLIDE_W, 56, 'Thank you', { size: 40, color: INK, align: 'center' }),
        b.text(0, 215, SLIDE_W, 30, 'Questions, comments and next steps', {
          size: 16,
          color: MUTED,
          align: 'center',
          weight: 'normal',
        }),
        b.rect(215, 270, 220, 48, { fill: BRAND, stroke: BRAND, rounded: true }),
        b.text(215, 285, 220, 24, 'you@company.com', { size: 15, color: '#ffffff', align: 'center' }),
      ];
    },
  },

  /* ------------------------------ Content -------------------------- */
  {
    id: 'canva-pitch',
    name: 'Modern pitch deck',
    category: 'content',
    description: 'Hero title with three feature pillars',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const pillars = ['✨ Realtime Collaboration', '📊 Smart Diagramming', '⚡ Built-in AI Workflows'];
      const fills = ['#e0e7ff', '#fae8ff', '#dbeafe'];
      return [
        b.text(40, 40, 570, 50, '🚀 Transformative AI Canvas Platform', { size: 26, color: BRAND }),
        ...pillars.flatMap((pillar, i) => [
          b.rect(40 + i * 190, 110, 175, 220, { fill: fills[i], stroke: '#6366f1' }),
          b.text(50 + i * 190, 140, 155, 160, pillar, { size: 14, color: '#1e1b4b', align: 'center' }),
        ]),
      ];
    },
  },
  {
    id: 'agenda',
    name: 'Agenda',
    category: 'content',
    description: 'Numbered agenda items',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const items = ['Where we are today', 'What changed this quarter', 'The proposal', 'Risks and open questions', 'Next steps'];
      return [
        b.text(50, 45, 550, 40, 'Agenda', { size: 28, color: INK }),
        ...items.flatMap((item, i) => [
          b.ellipse(50, 110 + i * 56, 34, 34, { fill: '#eef2ff', stroke: BRAND }),
          b.text(50, 120 + i * 56, 34, 24, String(i + 1), { size: 14, color: BRAND, align: 'center' }),
          b.text(100, 118 + i * 56, 480, 30, item, { size: 16, color: INK, weight: 'normal' }),
        ]),
      ];
    },
  },
  {
    id: 'agenda-image',
    name: 'Agenda and image',
    category: 'content',
    description: 'Agenda list beside a media placeholder',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const items = ['Context', 'Proposal', 'Impact', 'Timeline'];
      return [
        b.text(40, 45, 300, 40, 'Agenda', { size: 26, color: INK }),
        ...items.map((item, i) =>
          b.text(40, 110 + i * 52, 280, 30, `${i + 1}.  ${item}`, {
            size: 16,
            color: INK,
            weight: 'normal',
          })
        ),
        b.shape(360, 60, 250, 300, 'ui-image', undefined, { fill: '#f1f5f9', stroke: '#94a3b8' }),
      ];
    },
  },
  {
    id: 'image-left',
    name: 'Image left, text right',
    category: 'content',
    description: 'Split media and copy layout',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      return [
        b.shape(40, 60, 260, 300, 'ui-image', undefined, { fill: '#f1f5f9', stroke: '#94a3b8' }),
        b.text(330, 100, 280, 44, 'Supporting headline', { size: 24, color: INK }),
        b.text(330, 155, 280, 160, 'Use this space for the argument that the image supports. Keep it to three or four short sentences so it stays readable at presentation distance.', {
          size: 14,
          color: MUTED,
          weight: 'normal',
        }),
      ];
    },
  },
  {
    id: 'two-column',
    name: 'Two columns',
    category: 'content',
    description: 'Two balanced text columns',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      return [
        b.text(45, 45, 560, 40, 'Two column layout', { size: 26, color: INK }),
        b.text(45, 110, 265, 30, 'Column one', { size: 17, color: BRAND }),
        b.text(45, 148, 265, 200, 'Supporting detail for the first column. Replace with your own copy.', {
          size: 14,
          color: MUTED,
          weight: 'normal',
        }),
        b.text(345, 110, 265, 30, 'Column two', { size: 17, color: BRAND }),
        b.text(345, 148, 265, 200, 'Supporting detail for the second column. Replace with your own copy.', {
          size: 14,
          color: MUTED,
          weight: 'normal',
        }),
      ];
    },
  },
  {
    id: 'three-column',
    name: 'Three columns',
    category: 'content',
    description: 'Three equal content columns',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const titles = ['Discover', 'Design', 'Deliver'];
      return [
        b.text(45, 45, 560, 40, 'Three column layout', { size: 26, color: INK }),
        ...titles.flatMap((title, i) => [
          b.rect(45 + i * 190, 110, 170, 4, { fill: BRAND, stroke: BRAND, strokeWidth: 0 }),
          b.text(45 + i * 190, 128, 170, 30, title, { size: 17, color: INK }),
          b.text(45 + i * 190, 164, 170, 170, 'One or two sentences of supporting detail for this column.', {
            size: 13,
            color: MUTED,
            weight: 'normal',
          }),
        ]),
      ];
    },
  },
  {
    id: 'quote',
    name: 'Quote',
    category: 'content',
    description: 'Pull quote with attribution',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      return [
        b.text(55, 95, 60, 70, '“', { size: 76, color: '#c7d2fe' }),
        b.text(60, 155, 530, 120, 'Put the single most quotable sentence from your research here, and nothing else.', {
          size: 24,
          color: INK,
        }),
        b.rect(60, 290, 60, 4, { fill: BRAND, stroke: BRAND, strokeWidth: 0 }),
        b.text(60, 306, 400, 26, 'Name, role — where the quote came from', {
          size: 14,
          color: MUTED,
          weight: 'normal',
        }),
      ];
    },
  },
  {
    id: 'bullet-icons',
    name: 'Bulleted list with icons',
    category: 'content',
    description: 'Four points with icon markers',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const points = [
        ['✅', 'Ship the shape library', 'One manifest, one renderer'],
        ['⚡', 'Cut load time in half', 'Zoom-to-fit on board open'],
        ['🎯', 'Make layouts discoverable', 'Surface them under Frames'],
        ['🔒', 'Remove borrowed branding', 'Own the product voice'],
      ];
      return [
        b.text(45, 40, 560, 40, 'Key points', { size: 26, color: INK }),
        ...points.flatMap(([icon, title, sub], i) => [
          b.rect(45, 100 + i * 72, 44, 44, { fill: '#eef2ff', stroke: '#c7d2fe', rounded: true }),
          b.text(45, 112 + i * 72, 44, 24, icon, { size: 18, align: 'center' }),
          b.text(105, 102 + i * 72, 480, 26, title, { size: 16, color: INK }),
          b.text(105, 124 + i * 72, 480, 24, sub, { size: 13, color: MUTED, weight: 'normal' }),
        ]),
      ];
    },
  },
  {
    id: 'image-grid',
    name: 'Image grid',
    category: 'content',
    description: 'Two-by-two media grid',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const cells = [
        [45, 95],
        [345, 95],
        [45, 255],
        [345, 255],
      ];
      return [
        b.text(45, 40, 560, 36, 'Gallery', { size: 24, color: INK }),
        ...cells.map(([dx, dy]) =>
          b.shape(dx, dy, 260, 140, 'ui-image', undefined, { fill: '#f1f5f9', stroke: '#94a3b8' })
        ),
      ];
    },
  },
  {
    id: 'full-image',
    name: 'Full-bleed image',
    category: 'content',
    description: 'Edge-to-edge media with a caption bar',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      return [
        b.shape(0, 0, SLIDE_W, 340, 'ui-image', undefined, { fill: '#e2e8f0', stroke: '#94a3b8' }),
        b.rect(0, 340, SLIDE_W, 80, { fill: INK, stroke: INK, strokeWidth: 0 }),
        b.text(30, 362, 480, 30, 'Caption describing what this image shows', {
          size: 16,
          color: '#ffffff',
        }),
      ];
    },
  },

  /* --------------------------- Data & metrics ---------------------- */
  {
    id: 'canva-metrics',
    name: 'Executive metrics',
    category: 'data',
    description: 'Three KPI callout cards',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const metrics = [
        { label: 'Annual Recurring Revenue', val: '$2.4M', color: '#ecfdf5', text: '#059669' },
        { label: 'Active Monthly Users', val: '185K+', color: '#eff6ff', text: '#2563eb' },
        { label: 'System Uptime SLA', val: '99.99%', color: '#fcf4ff', text: '#9333ea' },
      ];
      return [
        b.text(40, 35, 570, 40, '📊 Key Performance Indicators & Metrics', { size: 22, color: INK }),
        ...metrics.flatMap((m, i) => [
          b.rect(40 + i * 190, 95, 175, 240, { fill: m.color, stroke: m.text }),
          b.text(50 + i * 190, 155, 155, 50, m.val, { size: 32, color: m.text, align: 'center' }),
          b.text(50 + i * 190, 235, 155, 40, m.label, { size: 12, color: '#475569', align: 'center' }),
        ]),
      ];
    },
  },
  {
    id: 'big-number',
    name: 'Big number',
    category: 'data',
    description: 'One statistic, stated loudly',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      return [
        b.text(0, 130, SLIDE_W, 110, '73%', { size: 92, color: BRAND, align: 'center' }),
        b.text(0, 250, SLIDE_W, 34, 'of sessions end without the user finding the feature', {
          size: 19,
          color: INK,
          align: 'center',
        }),
        b.text(0, 292, SLIDE_W, 26, 'Source: product analytics, last 30 days', {
          size: 13,
          color: MUTED,
          align: 'center',
          weight: 'normal',
        }),
      ];
    },
  },
  {
    id: 'comparison',
    name: 'Before and after',
    category: 'data',
    description: 'Two-panel comparison',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      return [
        b.text(45, 40, 560, 36, 'Before and after', { size: 24, color: INK }),
        b.rect(45, 95, 270, 250, { fill: '#fef2f2', stroke: '#ef4444' }),
        b.text(60, 112, 240, 28, 'Before', { size: 17, color: '#991b1b' }),
        b.text(60, 148, 240, 180, 'What the experience looked like previously. Name the specific pain.', {
          size: 13,
          color: '#7f1d1d',
          weight: 'normal',
        }),
        b.rect(335, 95, 270, 250, { fill: '#f0fdf4', stroke: '#22c55e' }),
        b.text(350, 112, 240, 28, 'After', { size: 17, color: '#166534' }),
        b.text(350, 148, 240, 180, 'What changed, and the measurable difference it made.', {
          size: 13,
          color: '#14532d',
          weight: 'normal',
        }),
      ];
    },
  },
  {
    id: 'pros-cons',
    name: 'Pros and cons',
    category: 'data',
    description: 'Trade-off list for a decision',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const pros = ['Ships in one sprint', 'No schema migration', 'Reversible'];
      const cons = ['Adds a new dependency', 'Needs a backfill job'];
      return [
        b.text(45, 40, 560, 36, 'Trade-offs', { size: 24, color: INK }),
        b.text(60, 95, 240, 28, '👍  Pros', { size: 16, color: '#166534' }),
        ...pros.map((p, i) =>
          b.text(60, 135 + i * 34, 240, 26, `• ${p}`, { size: 14, color: INK, weight: 'normal' })
        ),
        b.line(325, 95, 325, 350, { color: '#e2e8f0' }),
        b.text(360, 95, 240, 28, '👎  Cons', { size: 16, color: '#991b1b' }),
        ...cons.map((c, i) =>
          b.text(360, 135 + i * 34, 240, 26, `• ${c}`, { size: 14, color: INK, weight: 'normal' })
        ),
      ];
    },
  },
  {
    id: 'chart-slide',
    name: 'Chart placeholder',
    category: 'data',
    description: 'Bar chart frame with axis and legend',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const bars = [110, 160, 90, 200, 150];
      return [
        b.text(45, 40, 560, 36, 'Metric over time', { size: 24, color: INK }),
        b.line(70, 100, 70, 330, { color: '#94a3b8' }),
        b.line(70, 330, 600, 330, { color: '#94a3b8' }),
        ...bars.flatMap((h, i) => [
          b.rect(100 + i * 95, 330 - h, 58, h, { fill: '#c7d2fe', stroke: BRAND, strokeWidth: 1 }),
          b.text(100 + i * 95, 338, 58, 22, `Q${i + 1}`, {
            size: 12,
            color: MUTED,
            align: 'center',
            weight: 'normal',
          }),
        ]),
      ];
    },
  },
  {
    id: 'table',
    name: 'Table',
    category: 'data',
    description: 'Header row plus four data rows',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const headers = ['Workstream', 'Owner', 'Status'];
      const rows = [
        ['Shape library', 'Alex', 'Done'],
        ['Slide layouts', 'Sarah', 'In progress'],
        ['Zoom to fit', 'David', 'In review'],
        ['Theme cleanup', 'Elena', 'Not started'],
      ];
      const colX = [45, 285, 460];
      const colW = [240, 175, 150];
      return [
        b.text(45, 40, 560, 36, 'Status table', { size: 24, color: INK }),
        b.rect(45, 95, 560, 42, { fill: '#1e293b', stroke: '#1e293b', strokeWidth: 0 }),
        ...headers.map((h, i) =>
          b.text(colX[i] + 12, 107, colW[i] - 20, 24, h, { size: 13, color: '#ffffff' })
        ),
        ...rows.flatMap((row, r) => [
          b.rect(45, 137 + r * 46, 560, 46, {
            fill: r % 2 === 0 ? '#ffffff' : '#f8fafc',
            stroke: '#e2e8f0',
            strokeWidth: 1,
          }),
          ...row.map((cell, c) =>
            b.text(colX[c] + 12, 151 + r * 46, colW[c] - 20, 24, cell, {
              size: 13,
              color: INK,
              weight: 'normal',
            })
          ),
        ]),
      ];
    },
  },

  /* ------------------------------ Diagrams ------------------------- */
  {
    id: 'matrix',
    name: '2x2 matrix',
    category: 'diagram',
    description: 'Quadrant chart with labelled axes',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const quads = [
        { dx: 120, dy: 90, fill: '#ecfdf5', label: 'Quick wins' },
        { dx: 360, dy: 90, fill: '#eff6ff', label: 'Big bets' },
        { dx: 120, dy: 225, fill: '#fefce8', label: 'Fill-ins' },
        { dx: 360, dy: 225, fill: '#fef2f2', label: 'Money pit' },
      ];
      return [
        b.text(45, 35, 560, 32, 'Impact vs. effort', { size: 22, color: INK }),
        ...quads.flatMap((q) => [
          b.rect(q.dx, q.dy, 235, 130, { fill: q.fill, stroke: '#cbd5e1', strokeWidth: 1 }),
          b.text(q.dx + 12, q.dy + 12, 210, 24, q.label, { size: 14, color: INK }),
        ]),
        b.text(45, 145, 70, 40, 'High impact', { size: 11, color: MUTED, weight: 'normal' }),
        b.text(45, 280, 70, 40, 'Low impact', { size: 11, color: MUTED, weight: 'normal' }),
        b.text(120, 362, 235, 22, 'Low effort', { size: 11, color: MUTED, align: 'center', weight: 'normal' }),
        b.text(360, 362, 235, 22, 'High effort', { size: 11, color: MUTED, align: 'center', weight: 'normal' }),
      ];
    },
  },
  {
    id: 'venn',
    name: 'Venn diagram',
    category: 'diagram',
    description: 'Three overlapping circles',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      return [
        b.text(45, 35, 560, 32, 'Where the three overlap', { size: 22, color: INK }),
        b.ellipse(175, 90, 190, 190, { fill: '#bfdbfe', stroke: '#3b82f6', opacity: 0.65 }),
        b.ellipse(290, 90, 190, 190, { fill: '#fecaca', stroke: '#ef4444', opacity: 0.65 }),
        b.ellipse(232, 185, 190, 190, { fill: '#bbf7d0', stroke: '#22c55e', opacity: 0.65 }),
        b.text(160, 60, 120, 24, 'Desirable', { size: 13, color: '#1d4ed8', align: 'center' }),
        b.text(375, 60, 120, 24, 'Viable', { size: 13, color: '#b91c1c', align: 'center' }),
        b.text(267, 385, 120, 24, 'Feasible', { size: 13, color: '#15803d', align: 'center' }),
      ];
    },
  },
  {
    id: 'timeline',
    name: 'Timeline',
    category: 'diagram',
    description: 'Horizontal milestone track',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const milestones = ['Kickoff', 'Alpha', 'Beta', 'GA'];
      const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981'];
      return [
        b.text(45, 40, 560, 36, 'Delivery timeline', { size: 24, color: INK }),
        b.line(60, 210, 590, 210, { color: '#cbd5e1', width: 3 }),
        ...milestones.flatMap((m, i) => [
          b.ellipse(78 + i * 145, 192, 36, 36, { fill: colors[i], stroke: colors[i] }),
          b.text(36 + i * 145, 150, 120, 26, m, { size: 15, color: INK, align: 'center' }),
          b.text(36 + i * 145, 245, 120, 60, `Q${i + 1} deliverable summary`, {
            size: 12,
            color: MUTED,
            align: 'center',
            weight: 'normal',
          }),
        ]),
      ];
    },
  },
  {
    id: 'roadmap',
    name: 'Roadmap',
    category: 'diagram',
    description: 'Swimlanes across four quarters',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const lanes = ['Platform', 'Canvas', 'AI'];
      const laneColors = ['#dbeafe', '#e0e7ff', '#dcfce7'];
      return [
        b.text(45, 35, 560, 32, 'Roadmap', { size: 22, color: INK }),
        ...['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) =>
          b.text(150 + i * 115, 78, 115, 24, q, { size: 13, color: MUTED, align: 'center' })
        ),
        ...lanes.flatMap((lane, r) => [
          b.text(45, 122 + r * 82, 95, 26, lane, { size: 14, color: INK }),
          b.rect(150 + (r % 2) * 60, 112 + r * 82, 230 + r * 40, 44, {
            fill: laneColors[r],
            stroke: '#94a3b8',
            strokeWidth: 1,
            rounded: true,
          }),
        ]),
      ];
    },
  },
  {
    id: 'swot',
    name: 'SWOT',
    category: 'diagram',
    description: 'Strengths, weaknesses, opportunities, threats',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const cells = [
        { dx: 45, dy: 90, fill: '#ecfdf5', stroke: '#10b981', label: 'Strengths' },
        { dx: 335, dy: 90, fill: '#fef2f2', stroke: '#ef4444', label: 'Weaknesses' },
        { dx: 45, dy: 235, fill: '#eff6ff', stroke: '#3b82f6', label: 'Opportunities' },
        { dx: 335, dy: 235, fill: '#fefce8', stroke: '#eab308', label: 'Threats' },
      ];
      return [
        b.text(45, 40, 560, 34, 'SWOT analysis', { size: 24, color: INK }),
        ...cells.flatMap((c) => [
          b.rect(c.dx, c.dy, 270, 130, { fill: c.fill, stroke: c.stroke }),
          b.text(c.dx + 14, c.dy + 12, 240, 26, c.label, { size: 15, color: INK }),
        ]),
      ];
    },
  },
  {
    id: 'process-steps',
    name: 'Process steps',
    category: 'diagram',
    description: 'Four chevron steps in sequence',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const steps = ['Collect', 'Validate', 'Transform', 'Publish'];
      return [
        b.text(45, 40, 560, 36, 'How it works', { size: 24, color: INK }),
        ...steps.map((step, i) =>
          b.shape(45 + i * 148, 180, 132, 76, 'arrow-right', step, {
            fill: '#e0e7ff',
            stroke: BRAND,
          })
        ),
      ];
    },
  },

  /* ------------------------- Workshop & interactive ---------------- */
  {
    id: 'alignment',
    name: 'Alignment scale',
    category: 'interactive',
    description: 'Five-point agree/disagree scale to vote on',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const scales = [
        { label: '1. Strongly Disagree', color: '#fef2f2', border: '#ef4444', text: '#991b1b' },
        { label: '2. Disagree', color: '#fff7ed', border: '#f97316', text: '#9a3412' },
        { label: '3. Neutral', color: '#fefce8', border: '#eab308', text: '#854d0e' },
        { label: '4. Agree', color: '#f0fdf4', border: '#22c55e', text: '#166534' },
        { label: '5. Strongly Agree', color: '#ecfdf5', border: '#10b981', text: '#065f46' },
      ];
      return [
        b.text(40, 40, 570, 40, 'Alignment Scale: How aligned are we on the product roadmap?', {
          size: 20,
          color: INK,
        }),
        ...scales.flatMap((s, i) => [
          b.rect(35 + i * 115, 140, 105, 180, { fill: s.color, stroke: s.border }),
          b.text(40 + i * 115, 220, 95, 40, s.label, { size: 12, color: s.text, align: 'center' }),
        ]),
      ];
    },
  },
  {
    id: 'feedback',
    name: 'Feedback wall',
    category: 'interactive',
    description: 'Sticky notes for collecting reactions',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const notes = [
        '"The presentation player feels buttery smooth!"',
        '"AI diagram generation saves us hours each sprint."',
        '"The slide deck thumbnail strip is genuinely useful."',
      ];
      const colors = ['#fef08a', '#bfdbfe', '#bbf7d0'];
      return [
        b.text(40, 35, 500, 35, 'User Feedback & Customer Insights', { size: 22, color: INK }),
        ...notes.map((note, i) => b.sticky(40 + i * 190, 100, 170, 180, note, colors[i])),
      ];
    },
  },
  {
    id: 'kanban',
    name: 'Kanban slide',
    category: 'interactive',
    description: 'Three-column board with starter cards',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const columns = [
        { title: 'To do', cards: ['Audit shapes', 'Draft copy'], color: '#fef08a' },
        { title: 'In progress', cards: ['Slide layouts'], color: '#bfdbfe' },
        { title: 'Done', cards: ['Shape manifest', 'Toolbar entry'], color: '#bbf7d0' },
      ];
      return [
        b.text(40, 35, 560, 34, 'Sprint board', { size: 22, color: INK }),
        ...columns.flatMap((col, c) => [
          b.rect(40 + c * 195, 85, 175, 300, { fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1 }),
          b.text(52 + c * 195, 98, 150, 24, col.title, { size: 14, color: INK }),
          ...col.cards.map((card, i) =>
            b.sticky(52 + c * 195, 132 + i * 78, 150, 66, card, col.color)
          ),
        ]),
      ];
    },
  },
  {
    id: 'spinner',
    name: 'Spinning wheel',
    category: 'interactive',
    description: 'Segmented wheel for picking a volunteer',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const names = ['Alex', 'Sarah', 'David', 'Elena', 'Sam', 'Nina'];
      const colors = ['#fecaca', '#fed7aa', '#fef08a', '#bbf7d0', '#bfdbfe', '#e9d5ff'];
      const cx = 325;
      const cy = 235;
      const r = 130;
      return [
        b.text(45, 35, 560, 32, "Who's presenting first?", { size: 22, color: INK }),
        b.ellipse(cx - r, cy - r, r * 2, r * 2, { fill: '#f8fafc', stroke: '#334155', strokeWidth: 3 }),
        ...names.flatMap((name, i) => {
          const angle = (i / names.length) * Math.PI * 2 - Math.PI / 2;
          const labelR = r * 0.62;
          return [
            b.ellipse(
              cx + Math.cos(angle) * labelR - 34,
              cy + Math.sin(angle) * labelR - 20,
              68,
              40,
              { fill: colors[i], stroke: colors[i] }
            ),
            b.text(
              cx + Math.cos(angle) * labelR - 34,
              cy + Math.sin(angle) * labelR - 8,
              68,
              22,
              name,
              { size: 12, color: '#1e293b', align: 'center' }
            ),
          ];
        }),
        b.shape(cx - 16, cy - 92, 32, 44, 'triangle', undefined, { fill: '#ef4444', stroke: '#b91c1c' }),
      ];
    },
  },
  {
    id: 'flip',
    name: 'Flip cards',
    category: 'interactive',
    description: 'Prompt cards to reveal one at a time',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const prompts = ['What surprised you?', 'What slowed us down?', 'What should we keep?'];
      return [
        b.text(45, 40, 560, 34, 'Flip a card and answer out loud', { size: 22, color: INK }),
        ...prompts.flatMap((prompt, i) => [
          b.rect(45 + i * 190, 110, 175, 230, { fill: '#eef2ff', stroke: BRAND, rounded: true }),
          b.text(60 + i * 190, 150, 145, 40, `Card ${i + 1}`, {
            size: 13,
            color: BRAND,
            align: 'center',
          }),
          b.text(60 + i * 190, 200, 145, 100, prompt, { size: 15, color: INK, align: 'center' }),
        ]),
      ];
    },
  },

  /* -------------------------------- People ------------------------- */
  {
    id: 'author',
    name: 'Author',
    category: 'team',
    description: 'Single presenter with avatar and bio',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      return [
        b.ellipse(80, 120, 120, 120, { fill: '#eff6ff', stroke: '#3b82f6', strokeWidth: 3 }),
        b.text(240, 120, 350, 40, 'Alex Morgan • Lead UX Architect', { size: 24, color: INK }),
        b.text(240, 170, 350, 80, 'Leading strategic design and AI canvas interactions for next-generation collaborative whiteboards.', {
          size: 14,
          color: MUTED,
          weight: 'normal',
        }),
      ];
    },
  },
  {
    id: 'team',
    name: 'Team',
    category: 'team',
    description: 'Row of team member avatars',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const members = ['Alex (Lead)', 'Sarah (Design)', 'David (Backend)', 'Elena (AI Research)'];
      return [
        b.text(40, 40, 500, 40, 'Meet the Product & Engineering Team', { size: 22, color: INK }),
        ...members.flatMap((name, i) => [
          b.ellipse(60 + i * 140, 120, 80, 80, {
            fill: i % 2 === 0 ? '#eff6ff' : '#ecfdf5',
            stroke: i % 2 === 0 ? '#3b82f6' : '#10b981',
          }),
          b.text(40 + i * 140, 215, 120, 40, name, { size: 12, color: '#334155', align: 'center' }),
        ]),
      ];
    },
  },
  /* ------------------- Additional title & section ------------------ */
  {
    id: 'cover-image',
    name: 'Cover with image',
    category: 'title',
    description: 'Full-bleed cover with a title band',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      return [
        b.shape(0, 0, SLIDE_W, SLIDE_H, 'ui-image', undefined, { fill: '#e2e8f0', stroke: '#94a3b8' }),
        b.rect(0, 250, SLIDE_W, 120, { fill: INK, stroke: INK, strokeWidth: 0 }),
        b.text(45, 272, 560, 44, 'Presentation title', { size: 30, color: '#ffffff' }),
        b.text(45, 322, 560, 28, 'Subtitle or date', { size: 15, color: '#cbd5e1', weight: 'normal' }),
      ];
    },
  },
  {
    id: 'chapter-number',
    name: 'Chapter number',
    category: 'title',
    description: 'Oversized numeral with a chapter name',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      return [
        b.text(0, 100, SLIDE_W, 140, '02', { size: 120, color: '#e2e8f0', align: 'center' }),
        b.text(0, 240, SLIDE_W, 44, 'Chapter name', { size: 30, color: INK, align: 'center' }),
        b.rect(275, 300, 100, 4, { fill: BRAND, stroke: BRAND, strokeWidth: 0 }),
      ];
    },
  },

  /* --------------------- Additional content ------------------------ */
  {
    id: 'definition',
    name: 'Definition',
    category: 'content',
    description: 'A term with its explanation',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      return [
        b.text(50, 120, 550, 46, 'Term', { size: 34, color: BRAND }),
        b.rect(50, 180, 80, 4, { fill: '#e2e8f0', stroke: '#e2e8f0', strokeWidth: 0 }),
        b.text(50, 205, 520, 140, 'The definition goes here. Keep it to two sentences so the room can absorb it while you speak.', {
          size: 16,
          color: INK,
          weight: 'normal',
        }),
      ];
    },
  },
  {
    id: 'four-column',
    name: 'Four columns',
    category: 'content',
    description: 'Four compact content columns',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const titles = ['Plan', 'Build', 'Test', 'Ship'];
      return [
        b.text(45, 45, 560, 36, 'Four column layout', { size: 24, color: INK }),
        ...titles.flatMap((title, i) => [
          b.rect(45 + i * 143, 105, 128, 4, { fill: BRAND, stroke: BRAND, strokeWidth: 0 }),
          b.text(45 + i * 143, 120, 128, 28, title, { size: 15, color: INK }),
          b.text(45 + i * 143, 152, 128, 180, 'Short supporting detail for this column.', {
            size: 12,
            color: MUTED,
            weight: 'normal',
          }),
        ]),
      ];
    },
  },
  {
    id: 'checklist',
    name: 'Checklist',
    category: 'content',
    description: 'Ticked list of items',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const items = ['Scope agreed', 'Design signed off', 'Tests written', 'Docs updated', 'Ready to ship'];
      return [
        b.text(50, 45, 550, 38, 'Definition of done', { size: 25, color: INK }),
        ...items.flatMap((item, i) => [
          b.shape(50, 108 + i * 56, 28, 28, 'ui-checkbox', undefined, { fill: '#ffffff', stroke: '#16a34a' }),
          b.text(94, 112 + i * 56, 480, 28, item, { size: 15, color: INK, weight: 'normal' }),
        ]),
      ];
    },
  },
  {
    id: 'hero-statement',
    name: 'Hero statement',
    category: 'content',
    description: 'One sentence, centred and large',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      return [
        b.text(60, 150, 530, 130, 'Say the one thing you want everyone to remember.', {
          size: 30,
          color: INK,
          align: 'center',
        }),
      ];
    },
  },
  {
    id: 'text-with-callout',
    name: 'Text with callout',
    category: 'content',
    description: 'Body copy beside a highlighted note',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      return [
        b.text(45, 45, 560, 36, 'Context', { size: 24, color: INK }),
        b.text(45, 105, 330, 240, 'The main narrative sits on the left. Give it enough room to breathe, and keep the callout on the right short.', {
          size: 14,
          color: MUTED,
          weight: 'normal',
        }),
        b.rect(400, 105, 205, 200, { fill: '#eef2ff', stroke: BRAND, rounded: true }),
        b.text(418, 125, 170, 26, 'Worth noting', { size: 14, color: BRAND }),
        b.text(418, 155, 170, 130, 'The single fact you do not want them to miss.', {
          size: 13,
          color: INK,
          weight: 'normal',
        }),
      ];
    },
  },

  /* ------------------ Additional data & metrics -------------------- */
  {
    id: 'kpi-row',
    name: 'KPI row',
    category: 'data',
    description: 'Four compact metric tiles',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const kpis = [
        { v: '2.4M', l: 'Revenue' },
        { v: '185K', l: 'Users' },
        { v: '99.9%', l: 'Uptime' },
        { v: '4.7', l: 'Rating' },
      ];
      return [
        b.text(45, 50, 560, 36, 'At a glance', { size: 24, color: INK }),
        ...kpis.flatMap((k, i) => [
          b.rect(45 + i * 143, 130, 128, 130, { fill: '#f8fafc', stroke: '#e2e8f0', rounded: true }),
          b.text(45 + i * 143, 160, 128, 44, k.v, { size: 26, color: BRAND, align: 'center' }),
          b.text(45 + i * 143, 210, 128, 24, k.l, { size: 12, color: MUTED, align: 'center' }),
        ]),
      ];
    },
  },
  {
    id: 'line-chart',
    name: 'Line chart',
    category: 'data',
    description: 'Trend line with axes',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const pts = [
        [90, 290],
        [190, 240],
        [290, 255],
        [390, 180],
        [490, 145],
        [580, 110],
      ];
      return [
        b.text(45, 40, 560, 36, 'Growth over time', { size: 24, color: INK }),
        b.line(80, 100, 80, 330, { color: '#94a3b8' }),
        b.line(80, 330, 600, 330, { color: '#94a3b8' }),
        ...pts.slice(0, -1).map((p, i) =>
          b.line(p[0], p[1], pts[i + 1][0], pts[i + 1][1], { color: BRAND, width: 3 })
        ),
        ...pts.map((p) => b.ellipse(p[0] - 5, p[1] - 5, 10, 10, { fill: BRAND, stroke: BRAND })),
      ];
    },
  },
  {
    id: 'progress-bars',
    name: 'Progress bars',
    category: 'data',
    description: 'Completion against several goals',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const rows = [
        { label: 'Shape library', pct: 1 },
        { label: 'Slide layouts', pct: 0.85 },
        { label: 'Mermaid import', pct: 0.6 },
        { label: 'Theme cleanup', pct: 0.35 },
      ];
      return [
        b.text(45, 45, 560, 36, 'Progress', { size: 24, color: INK }),
        ...rows.flatMap((row, i) => [
          b.text(45, 112 + i * 66, 260, 26, row.label, { size: 14, color: INK, weight: 'normal' }),
          b.rect(45, 140 + i * 66, 520, 16, { fill: '#e2e8f0', stroke: '#e2e8f0', strokeWidth: 0, rounded: true }),
          b.rect(45, 140 + i * 66, Math.max(16, 520 * row.pct), 16, {
            fill: BRAND,
            stroke: BRAND,
            strokeWidth: 0,
            rounded: true,
          }),
          b.text(500, 112 + i * 66, 65, 26, `${Math.round(row.pct * 100)}%`, {
            size: 13,
            color: MUTED,
            align: 'right',
          }),
        ]),
      ];
    },
  },
  {
    id: 'funnel',
    name: 'Funnel',
    category: 'data',
    description: 'Stage-by-stage drop-off',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const stages = [
        { label: 'Visitors — 100%', w: 520 },
        { label: 'Signed up — 42%', w: 420 },
        { label: 'Activated — 23%', w: 320 },
        { label: 'Paying — 9%', w: 220 },
      ];
      const fills = ['#dbeafe', '#c7d2fe', '#ddd6fe', '#e9d5ff'];
      return [
        b.text(45, 40, 560, 36, 'Conversion funnel', { size: 24, color: INK }),
        ...stages.flatMap((s, i) => [
          b.rect((SLIDE_W - s.w) / 2, 105 + i * 72, s.w, 58, {
            fill: fills[i],
            stroke: '#a5b4fc',
            rounded: true,
          }),
          b.text((SLIDE_W - s.w) / 2, 124 + i * 72, s.w, 26, s.label, {
            size: 14,
            color: '#312e81',
            align: 'center',
          }),
        ]),
      ];
    },
  },

  /* ---------------------- Additional diagrams ---------------------- */
  {
    id: 'pyramid',
    name: 'Pyramid',
    category: 'diagram',
    description: 'Layered hierarchy of priorities',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const tiers = [
        { label: 'Vision', w: 190, fill: '#ede9fe', stroke: '#7c3aed' },
        { label: 'Strategy', w: 330, fill: '#dbeafe', stroke: '#2563eb' },
        { label: 'Execution', w: 470, fill: '#dcfce7', stroke: '#16a34a' },
      ];
      return [
        b.text(45, 35, 560, 32, 'How it stacks up', { size: 22, color: INK }),
        ...tiers.flatMap((t, i) => [
          b.rect((SLIDE_W - t.w) / 2, 100 + i * 90, t.w, 76, { fill: t.fill, stroke: t.stroke }),
          b.text((SLIDE_W - t.w) / 2, 126 + i * 90, t.w, 28, t.label, {
            size: 15,
            color: INK,
            align: 'center',
          }),
        ]),
      ];
    },
  },
  {
    id: 'cycle',
    name: 'Cycle',
    category: 'diagram',
    description: 'Four repeating phases',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const nodes = [
        { label: 'Plan', dx: 265, dy: 90 },
        { label: 'Do', dx: 425, dy: 200 },
        { label: 'Check', dx: 265, dy: 310 },
        { label: 'Act', dx: 105, dy: 200 },
      ];
      const colors = ['#dbeafe', '#dcfce7', '#fef9c3', '#ffe4e6'];
      const strokes = ['#2563eb', '#16a34a', '#ca8a04', '#e11d48'];
      return [
        b.text(45, 30, 560, 30, 'Continuous cycle', { size: 21, color: INK }),
        ...nodes.flatMap((n, i) => [
          b.ellipse(n.dx - 15, n.dy - 40, 120, 80, { fill: colors[i], stroke: strokes[i] }),
          b.text(n.dx - 15, n.dy - 10, 120, 26, n.label, { size: 14, color: INK, align: 'center' }),
        ]),
      ];
    },
  },
  {
    id: 'hierarchy-tree',
    name: 'Hierarchy tree',
    category: 'diagram',
    description: 'One parent branching into four',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const leaves = ['Alpha', 'Beta', 'Gamma', 'Delta'];
      return [
        b.text(45, 32, 560, 30, 'Breakdown', { size: 21, color: INK }),
        b.rect(245, 90, 160, 62, { fill: '#ede9fe', stroke: '#7c3aed', rounded: true }),
        b.text(245, 110, 160, 26, 'Root', { size: 15, color: INK, align: 'center' }),
        b.line(325, 152, 325, 200, { color: '#cbd5e1' }),
        b.line(90, 200, 560, 200, { color: '#cbd5e1' }),
        ...leaves.flatMap((leaf, i) => [
          b.line(90 + i * 157, 200, 90 + i * 157, 250, { color: '#cbd5e1' }),
          b.rect(30 + i * 157, 250, 120, 60, { fill: '#dbeafe', stroke: '#2563eb', rounded: true }),
          b.text(30 + i * 157, 268, 120, 26, leaf, { size: 13, color: INK, align: 'center' }),
        ]),
      ];
    },
  },
  {
    id: 'journey-map',
    name: 'Journey map',
    category: 'diagram',
    description: 'Stages with what the user feels',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const stages = ['Discover', 'Evaluate', 'Adopt', 'Advocate'];
      const moods = ['😐', '🤔', '🙂', '😀'];
      return [
        b.text(45, 35, 560, 32, 'Customer journey', { size: 22, color: INK }),
        b.line(45, 210, 605, 210, { color: '#cbd5e1', width: 3 }),
        ...stages.flatMap((stage, i) => [
          b.ellipse(88 + i * 148, 192, 36, 36, { fill: '#ffffff', stroke: BRAND, strokeWidth: 3 }),
          b.text(46 + i * 148, 145, 120, 26, stage, { size: 14, color: INK, align: 'center' }),
          b.text(46 + i * 148, 240, 120, 40, moods[i], { size: 24, align: 'center' }),
          b.text(46 + i * 148, 285, 120, 60, 'What they think here', {
            size: 11,
            color: MUTED,
            align: 'center',
            weight: 'normal',
          }),
        ]),
      ];
    },
  },
  {
    id: 'stakeholder-map',
    name: 'Stakeholder map',
    category: 'diagram',
    description: 'Influence against interest',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const quads = [
        { dx: 130, dy: 90, fill: '#fee2e2', label: 'Manage closely' },
        { dx: 370, dy: 90, fill: '#dcfce7', label: 'Keep satisfied' },
        { dx: 130, dy: 225, fill: '#dbeafe', label: 'Keep informed' },
        { dx: 370, dy: 225, fill: '#f1f5f9', label: 'Monitor' },
      ];
      return [
        b.text(45, 35, 560, 30, 'Stakeholders', { size: 21, color: INK }),
        ...quads.flatMap((q) => [
          b.rect(q.dx, q.dy, 235, 130, { fill: q.fill, stroke: '#cbd5e1', strokeWidth: 1 }),
          b.text(q.dx + 12, q.dy + 12, 210, 24, q.label, { size: 13, color: INK }),
        ]),
        b.text(45, 145, 80, 40, 'High power', { size: 10, color: MUTED, weight: 'normal' }),
        b.text(45, 280, 80, 40, 'Low power', { size: 10, color: MUTED, weight: 'normal' }),
      ];
    },
  },

  /* ------------------- Additional workshop slides ------------------ */
  {
    id: 'start-stop-continue',
    name: 'Start, stop, continue',
    category: 'interactive',
    description: 'Three-column retro board',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const cols = [
        { title: 'Start', color: '#bbf7d0', border: '#16a34a' },
        { title: 'Stop', color: '#fecaca', border: '#dc2626' },
        { title: 'Continue', color: '#bfdbfe', border: '#2563eb' },
      ];
      return [
        b.text(45, 35, 560, 32, 'Retro', { size: 22, color: INK }),
        ...cols.flatMap((col, i) => [
          b.rect(45 + i * 190, 85, 175, 300, { fill: '#f8fafc', stroke: col.border, strokeWidth: 1 }),
          b.text(45 + i * 190, 98, 175, 26, col.title, { size: 15, color: INK, align: 'center' }),
          b.sticky(58 + i * 190, 132, 148, 78, 'Add a note', col.color),
        ]),
      ];
    },
  },
  {
    id: 'rose-bud-thorn',
    name: 'Rose, bud, thorn',
    category: 'interactive',
    description: 'Wins, potential and blockers',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const cols = [
        { title: '🌹 Rose', hint: 'What went well', color: '#fecdd3' },
        { title: '🌱 Bud', hint: 'What could grow', color: '#bbf7d0' },
        { title: '🌵 Thorn', hint: 'What hurt', color: '#fed7aa' },
      ];
      return [
        b.text(45, 35, 560, 32, 'Rose, bud, thorn', { size: 22, color: INK }),
        ...cols.flatMap((col, i) => [
          b.rect(45 + i * 190, 85, 175, 300, { fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1 }),
          b.text(45 + i * 190, 98, 175, 26, col.title, { size: 14, color: INK, align: 'center' }),
          b.text(45 + i * 190, 122, 175, 22, col.hint, {
            size: 11,
            color: MUTED,
            align: 'center',
            weight: 'normal',
          }),
          b.sticky(58 + i * 190, 150, 148, 78, 'Add a note', col.color),
        ]),
      ];
    },
  },
  {
    id: 'dot-voting',
    name: 'Dot voting',
    category: 'interactive',
    description: 'Options to vote on with stickers',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const options = ['Option A', 'Option B', 'Option C', 'Option D'];
      return [
        b.text(45, 38, 560, 32, 'Vote with dots — three each', { size: 21, color: INK }),
        ...options.flatMap((option, i) => [
          b.rect(45, 100 + i * 74, 400, 58, { fill: '#f8fafc', stroke: '#e2e8f0', rounded: true }),
          b.text(62, 118 + i * 74, 370, 26, option, { size: 14, color: INK, weight: 'normal' }),
          b.rect(465, 100 + i * 74, 140, 58, { fill: '#ffffff', stroke: '#cbd5e1', rounded: true }),
        ]),
      ];
    },
  },
  {
    id: 'parking-lot',
    name: 'Parking lot',
    category: 'interactive',
    description: 'Park off-topic items for later',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      return [
        b.text(45, 40, 560, 34, '🅿️ Parking lot', { size: 23, color: INK }),
        b.text(45, 78, 560, 24, 'Anything worth returning to, but not now', {
          size: 13,
          color: MUTED,
          weight: 'normal',
        }),
        b.rect(45, 115, 560, 265, { fill: '#f8fafc', stroke: '#cbd5e1', strokeWidth: 1, rounded: true }),
        b.sticky(70, 140, 150, 100, 'Topic to revisit', '#fef08a'),
        b.sticky(240, 140, 150, 100, 'Open question', '#bfdbfe'),
      ];
    },
  },

  /* ----------------------- Additional people ----------------------- */
  {
    id: 'team-grid',
    name: 'Team grid',
    category: 'team',
    description: 'Six people in two rows',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const members = ['Alex', 'Sarah', 'David', 'Elena', 'Sam', 'Nina'];
      return [
        b.text(45, 35, 560, 34, 'The team', { size: 23, color: INK }),
        ...members.flatMap((name, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const dx = 75 + col * 180;
          const dy = 105 + row * 145;
          return [
            b.ellipse(dx, dy, 84, 84, { fill: '#eef2ff', stroke: BRAND }),
            b.text(dx - 28, dy + 94, 140, 26, name, { size: 13, color: INK, align: 'center' }),
          ];
        }),
      ];
    },
  },
  {
    id: 'raci',
    name: 'RACI chart',
    category: 'team',
    description: 'Who is responsible for what',
    frameSize: { width: SLIDE_W, height: SLIDE_H },
    build: (x, y, seed) => {
      const b = makeBuilder(x, y, seed);
      const headers = ['Task', 'R', 'A', 'C', 'I'];
      const colX = [45, 320, 390, 460, 530];
      const colW = [275, 70, 70, 70, 75];
      const rows = [
        ['Design review', 'Sarah', 'Alex', 'David', 'Team'],
        ['Ship release', 'David', 'Alex', 'Sarah', 'Team'],
        ['Post-mortem', 'Alex', 'Alex', 'Team', 'Elena'],
      ];
      return [
        b.text(45, 40, 560, 34, 'RACI', { size: 23, color: INK }),
        b.rect(45, 100, 560, 40, { fill: '#1e293b', stroke: '#1e293b', strokeWidth: 0 }),
        ...headers.map((h, i) =>
          b.text(colX[i] + 10, 111, colW[i] - 16, 24, h, { size: 13, color: '#ffffff' })
        ),
        ...rows.flatMap((row, r) => [
          b.rect(45, 140 + r * 50, 560, 50, {
            fill: r % 2 === 0 ? '#ffffff' : '#f8fafc',
            stroke: '#e2e8f0',
            strokeWidth: 1,
          }),
          ...row.map((cell, c) =>
            b.text(colX[c] + 10, 155 + r * 50, colW[c] - 16, 24, cell, {
              size: 12,
              color: INK,
              weight: 'normal',
            })
          ),
        ]),
      ];
    },
  },

];

/* ------------------------------------------------------------------ */
/* Public API                                                           */
/* ------------------------------------------------------------------ */

export const getSlideLayout = (id: string): SlideLayoutDef | undefined =>
  SLIDE_LAYOUTS.find((l) => l.id === id);

export const slideLayoutMatchesQuery = (layout: SlideLayoutDef, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    layout.name.toLowerCase().includes(q) ||
    layout.description.toLowerCase().includes(q) ||
    layout.category.toLowerCase().includes(q)
  );
};

/**
 * Build a complete slide: the frame plus its contents.
 *
 * Callers just push the result through `addElement`, which keeps frame styling
 * consistent no matter which surface inserted the slide (Frames flyout, the
 * layouts modal, or the on-canvas frame toolbar).
 */
export const buildSlide = (
  layout: SlideLayoutDef,
  originX: number,
  originY: number
): CanvasElement[] => {
  const seed = Math.random().toString(36).substring(2, 8);
  const now = Date.now();

  const frame = {
    id: `slide_frame_${seed}`,
    type: 'frame',
    title: layout.name,
    frameType: 'slides',
    x: originX,
    y: originY,
    width: layout.frameSize.width,
    height: layout.frameSize.height,
    stroke: '#ef4444',
    strokeWidth: 2,
    fill: '#ffffff',
    opacity: 1,
    rotation: 0,
    isLocked: false,
    createdBy: 'local-user',
    createdAt: now,
    updatedAt: now,
  } as unknown as CanvasElement;

  return [frame, ...layout.build(originX, originY, seed)];
};
