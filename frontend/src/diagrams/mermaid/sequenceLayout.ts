/**
 * Sequence diagram layout.
 *
 * A sequence diagram is not a node-and-edge graph: participants sit in columns
 * and messages run down a *time* axis, so their declaration order is the
 * layout. Running one through the generic layered graph placement collapsed
 * every message between the same two participants onto a single connector,
 * which is why four messages piled up on one arrow.
 *
 * Emits ordinary canvas elements — boxes, lines, arrows and text — so the
 * result stays editable rather than being a picture of a diagram.
 */

import { CanvasElement } from '../../types/canvas';
import { MermaidSequence } from './parseMermaid';

const BOX_W = 150;
const BOX_H = 52;
const COL_PITCH = 240;
const FIRST_MESSAGE_Y = 118;
const MESSAGE_GAP = 66;
const SELF_MESSAGE_GAP = 52;
const TAIL_GAP = 46;

const BOX_FILL = '#ede9fe';
const BOX_STROKE = '#7c3aed';
const LIFELINE = '#a5b4fc';
const MESSAGE = '#475569';
const ACTIVATION_FILL = '#c4b5fd';

export interface SequenceBuildResult {
  elements: CanvasElement[];
  width: number;
  height: number;
  nodeCount: number;
  edgeCount: number;
}

export const buildSequenceElements = (
  sequence: MermaidSequence,
  originX: number,
  originY: number,
  seed: string
): SequenceBuildResult => {
  const { participants, messages } = sequence;
  if (participants.length === 0) {
    return { elements: [], width: 0, height: 0, nodeCount: 0, edgeCount: 0 };
  }

  const now = Date.now();
  let counter = 0;
  const nextId = (kind: string) => `seq_${seed}_${kind}_${counter++}`;

  const common = {
    opacity: 1,
    rotation: 0,
    isLocked: false,
    createdBy: 'local-user',
    createdAt: now,
    updatedAt: now,
  };

  /** Centre-line x for a participant column. */
  const columnX = (id: string) => {
    const index = participants.findIndex((p) => p.id === id);
    return originX + index * COL_PITCH + BOX_W / 2;
  };

  const elements: CanvasElement[] = [];

  // Vertical position of each message, allowing self-messages extra room.
  const messageY: number[] = [];
  let cursorY = originY + FIRST_MESSAGE_Y;
  messages.forEach((m) => {
    messageY.push(cursorY);
    cursorY += m.from === m.to ? MESSAGE_GAP + SELF_MESSAGE_GAP : MESSAGE_GAP;
  });

  const lifelineBottom = cursorY + TAIL_GAP;
  const diagramWidth = (participants.length - 1) * COL_PITCH + BOX_W;

  /* Lifelines, drawn first so everything else sits on top. */
  participants.forEach((p) => {
    const x = columnX(p.id);
    elements.push({
      id: nextId('lifeline'),
      type: 'line',
      points: [0, 0, 0, lifelineBottom - (originY + BOX_H)],
      x,
      y: originY + BOX_H,
      width: 0,
      height: lifelineBottom - (originY + BOX_H),
      stroke: LIFELINE,
      strokeWidth: 2,
      strokeDash: 'dashed',
      fill: 'transparent',
      ...common,
    } as unknown as CanvasElement);
  });

  /* Activation bars.
     Mermaid's shorthand activates the message target on `+` and deactivates
     the sender on `-`, so track a stack of open spans per participant. */
  const openActivations = new Map<string, number[]>();
  messages.forEach((m, i) => {
    if (m.activateTarget) {
      const stack = openActivations.get(m.to) || [];
      stack.push(messageY[i]);
      openActivations.set(m.to, stack);
    }
    if (m.deactivateSource) {
      const stack = openActivations.get(m.from) || [];
      const start = stack.pop();
      openActivations.set(m.from, stack);
      if (start !== undefined) {
        elements.push({
          id: nextId('activation'),
          type: 'rectangle',
          x: columnX(m.from) - 6,
          y: start,
          width: 12,
          height: Math.max(18, messageY[i] - start),
          fill: ACTIVATION_FILL,
          stroke: BOX_STROKE,
          strokeWidth: 1,
          ...common,
        } as unknown as CanvasElement);
      }
    }
  });
  // Anything still open runs to the bottom of its lifeline.
  openActivations.forEach((stack, id) => {
    stack.forEach((start) => {
      elements.push({
        id: nextId('activation'),
        type: 'rectangle',
        x: columnX(id) - 6,
        y: start,
        width: 12,
        height: Math.max(18, lifelineBottom - TAIL_GAP - start),
        fill: ACTIVATION_FILL,
        stroke: BOX_STROKE,
        strokeWidth: 1,
        ...common,
      } as unknown as CanvasElement);
    });
  });

  /* Messages. */
  let edgeCount = 0;
  messages.forEach((m, i) => {
    const y = messageY[i];
    const fromX = columnX(m.from);
    const toX = columnX(m.to);
    edgeCount++;

    if (m.from === m.to) {
      // Self-message: a small loop out to the right and back.
      const loop = 60;
      elements.push({
        id: nextId('msg'),
        type: 'arrow',
        points: [0, 0, loop, 0, loop, SELF_MESSAGE_GAP, 6, SELF_MESSAGE_GAP],
        x: fromX,
        y,
        width: loop,
        height: SELF_MESSAGE_GAP,
        stroke: MESSAGE,
        strokeWidth: 2,
        strokeDash: m.dotted ? 'dashed' : 'solid',
        fill: MESSAGE,
        ...common,
      } as unknown as CanvasElement);

      elements.push({
        id: nextId('label'),
        type: 'text',
        text: m.label,
        x: fromX + loop + 12,
        y: y + SELF_MESSAGE_GAP / 2 - 10,
        width: COL_PITCH - loop - 24,
        height: 20,
        fontSize: 12,
        fontFamily: 'Inter',
        fontWeight: 'normal',
        fontStyle: 'normal',
        align: 'left',
        stroke: MESSAGE,
        strokeWidth: 1,
        fill: 'transparent',
        ...common,
      } as unknown as CanvasElement);
      return;
    }

    const goingRight = toX > fromX;
    // Stop short of the lifeline so the arrowhead is not buried in it.
    const startX = fromX + (goingRight ? 4 : -4);
    const endX = toX + (goingRight ? -4 : 4);

    elements.push({
      id: nextId('msg'),
      type: 'arrow',
      points: [0, 0, endX - startX, 0],
      x: startX,
      y,
      width: Math.abs(endX - startX),
      height: 0,
      stroke: MESSAGE,
      strokeWidth: 2,
      strokeDash: m.dotted ? 'dashed' : 'solid',
      fill: MESSAGE,
      ...common,
    } as unknown as CanvasElement);

    // Label centred just above its arrow, spanning the two columns.
    const left = Math.min(startX, endX);
    elements.push({
      id: nextId('label'),
      type: 'text',
      text: m.label,
      x: left,
      y: y - 24,
      width: Math.abs(endX - startX),
      height: 20,
      fontSize: 12,
      fontFamily: 'Inter',
      fontWeight: 'normal',
      fontStyle: 'normal',
      align: 'center',
      stroke: MESSAGE,
      strokeWidth: 1,
      fill: 'transparent',
      ...common,
    } as unknown as CanvasElement);
  });

  /* Participant boxes, top and bottom — the bottom row is what makes a long
     sequence readable without scrolling back up. */
  const addBoxRow = (rowY: number) => {
    participants.forEach((p, index) => {
      const x = originX + index * COL_PITCH;
      elements.push({
        id: nextId('box'),
        type: 'rounded-rectangle',
        shapeId: 'rounded-square',
        text: p.label,
        x,
        y: rowY,
        width: BOX_W,
        height: BOX_H,
        fill: BOX_FILL,
        stroke: BOX_STROKE,
        strokeWidth: 2,
        ...common,
      } as unknown as CanvasElement);
    });
  };

  addBoxRow(originY);
  addBoxRow(lifelineBottom);

  return {
    elements,
    width: diagramWidth,
    height: lifelineBottom + BOX_H - originY,
    nodeCount: participants.length * 2,
    edgeCount,
  };
};
