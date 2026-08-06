import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Line, Rect, Ellipse, Arrow, Text, Group, Transformer, Circle, Path, Image as KonvaImage } from 'react-konva';
import Konva from 'konva';
import { useUIStore } from '../store/useUIStore';
import { useBoardStore, socketInstance } from '../store/useBoardStore';
import { usePresenceStore, Collaborator } from '../store/usePresenceStore';
import { useKeyboard } from '../hooks/useKeyboard';
import { FloatingToolbar } from '../components/FloatingToolbar';
import { worldToScreen } from '../utils/coordinate';
import { CanvasElement, PencilElement, RectangleElement, EllipseElement, LineElement, ArrowElement, TextElement, StickyElement, ConnectorElement, EmojiElement, PolygonElement, ImageElement, TableElement } from '../types/canvas';
import { getShapeDef, getShapeDefForLegacyType } from '../shapes/shapeLibrary';
import { recognizeShape, pointInPolygon } from '../diagrams/shapeRecognition';
import { LibraryShapeNode } from '../shapes/LibraryShapeNode';
import { DIAGRAM_TEMPLATES, buildDiagram } from '../diagrams/diagramTemplates';
import {
  choosePorts,
  routeConnector,
  routeMidpoint,
  Port,
  RoutingStyle,
} from '../diagrams/connectorRouting';
import { X, StickyNote, Type, Square, Smile, Frame, Sparkles } from 'lucide-react';

const snapPointToAngle = (start: { x: number; y: number }, end: { x: number; y: number }): { x: number; y: number } => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const angle = Math.atan2(dy, dx);
  const angleDeg = (angle * 180) / Math.PI;
  const snappedAngleDeg = Math.round(angleDeg / 45) * 45;
  const snappedAngleRad = (snappedAngleDeg * Math.PI) / 180;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return {
    x: start.x + distance * Math.cos(snappedAngleRad),
    y: start.y + distance * Math.sin(snappedAngleRad)
  };
};

const getContrastingTextColor = (bgColor: string): string => {
  if (!bgColor || bgColor === 'transparent') return '#1e293b';
  const hex = bgColor.replace('#', '');
  if (hex.length !== 6) return '#1e293b';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#1e293b' : '#ffffff';
};
const isElementIntersectedByCircle = (el: CanvasElement, center: { x: number; y: number }, radius: number): boolean => {
  if (el.isLocked) return false;

  if (el.type === 'connector') {
    return false; 
  }

  if (el.type === 'line' || el.type === 'arrow') {
    const pts = (el as LineElement).points;
    if (!pts || pts.length < 4) return false;
    const ox = el.x || 0;
    const oy = el.y || 0;
    return distanceToSegment(
      center, 
      { x: pts[0] + ox, y: pts[1] + oy }, 
      { x: pts[2] + ox, y: pts[3] + oy }
    ) <= radius;
  }

  if (el.type === 'pencil') {
    const pts = (el as PencilElement).points;
    const ox = el.x || 0;
    const oy = el.y || 0;
    for (let i = 0; i < pts.length; i += 2) {
      const dx = (pts[i] + ox) - center.x;
      const dy = (pts[i + 1] + oy) - center.y;
      if (Math.sqrt(dx * dx + dy * dy) <= radius + (el.strokeWidth || 3) / 2) {
        return true;
      }
    }
    return false;
  }

  const width = el.width || 0;
  const height = el.height || 0;

  const closestX = Math.max(el.x, Math.min(center.x, el.x + width));
  const closestY = Math.max(el.y, Math.min(center.y, el.y + height));

  const dx = center.x - closestX;
  const dy = center.y - closestY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  return dist <= radius;
};

const distanceToSegment = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  
  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
};

export const getElementBounds = (el: CanvasElement) => {
  if (el.type === 'pencil' || el.type === 'line' || el.type === 'arrow') {
    const pts = (el as any).points || [];
    if (pts.length === 0) return { x: el.x || 0, y: el.y || 0, width: 0, height: 0 };
    let minX = pts[0];
    let maxX = pts[0];
    let minY = pts[1];
    let maxY = pts[1];
    for (let i = 0; i < pts.length; i += 2) {
      const px = pts[i];
      const py = pts[i + 1];
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    return {
      x: minX + (el.x || 0),
      y: minY + (el.y || 0),
      width: maxX - minX,
      height: maxY - minY
    };
  }
  return {
    x: el.x || 0,
    y: el.y || 0,
    width: el.width || 0,
    height: el.height || 0
  };
};

const CanvasImageElement: React.FC<{ el: ImageElement; isDraggable: boolean; onDragEnd: any; onTransformEnd: any }> = ({ el, isDraggable, onDragEnd, onTransformEnd }) => {
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'Anonymous';
    img.src = el.src;
    img.onload = () => setImageObj(img);
  }, [el.src]);

  if (!imageObj) {
    return (
      <Rect
        x={el.x}
        y={el.y}
        width={el.width || 200}
        height={el.height || 150}
        fill="#f1f5f9"
        stroke="#cbd5e1"
        strokeWidth={1}
        cornerRadius={8}
      />
    );
  }

  return (
    <KonvaImage
      id={el.id}
      x={el.x}
      y={el.y}
      width={el.width || 200}
      height={el.height || 150}
      image={imageObj}
      opacity={el.opacity}
      rotation={el.rotation || 0}
      draggable={isDraggable}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
    />
  );
};

const CanvasTableElement: React.FC<{ el: TableElement; isDraggable: boolean; onDragEnd: any; onTransformEnd: any }> = ({ el, isDraggable, onDragEnd, onTransformEnd }) => {
  const rows = el.rows || 3;
  const cols = el.cols || 3;
  const width = el.width || 320;
  const height = el.height || 180;
  const cellW = width / cols;
  const cellH = height / rows;

  return (
    <Group
      id={el.id}
      x={el.x}
      y={el.y}
      width={width}
      height={height}
      rotation={el.rotation || 0}
      opacity={el.opacity}
      draggable={isDraggable}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
    >
      <Rect
        width={width}
        height={height}
        fill={el.fill && el.fill !== 'transparent' ? el.fill : '#ffffff'}
        stroke={el.stroke || '#94a3b8'}
        strokeWidth={el.strokeWidth || 2}
        cornerRadius={8}
        shadowColor="rgba(0,0,0,0.06)"
        shadowBlur={6}
        perfectDrawEnabled={false}
      />
      {/* Table Column Dividers */}
      {Array.from({ length: cols - 1 }).map((_, c) => (
        <Line
          key={`col-${c}`}
          points={[(c + 1) * cellW, 0, (c + 1) * cellW, height]}
          stroke="#cbd5e1"
          strokeWidth={1}
        />
      ))}
      {/* Table Row Dividers */}
      {Array.from({ length: rows - 1 }).map((_, r) => (
        <Line
          key={`row-${r}`}
          points={[0, (r + 1) * cellH, width, (r + 1) * cellH]}
          stroke="#cbd5e1"
          strokeWidth={1}
        />
      ))}
      {/* Header Row Background */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={cellH}
        fill={el.headerBg || 'rgba(59, 130, 246, 0.1)'}
        cornerRadius={[8, 8, 0, 0]}
      />
      {/* Cell Texts */}
      {el.cellsData?.map((row, rIdx) =>
        row.map((cellText, cIdx) => (
          <Text
            key={`cell-${rIdx}-${cIdx}`}
            x={cIdx * cellW + 8}
            y={rIdx * cellH + 8}
            width={cellW - 16}
            height={cellH - 16}
            text={cellText || `Cell ${rIdx + 1},${cIdx + 1}`}
            fontSize={12}
            fontStyle={rIdx === 0 ? 'bold' : 'normal'}
            fill="#1e293b"
            verticalAlign="middle"
          />
        ))
      )}
    </Group>
  );
};

export const SketchCanvas: React.FC = () => {
  const {
    activeTool,
    setActiveTool,
    zoom,
    setZoom,
    pan,
    setPan,
    resolvedTheme,
    selectedElementIds,
    setSelectedElementIds,
    isDevPanelOpen,
    activeStroke,
    activeFill,
    activeStrokeWidth,
    eraserSize,
    eraserMode,
    currentBoardId,
    triggerAIRequest,
    activeEmoji,
    setActiveEmoji,
    gridType,
    snapToGrid,
    pendingShapeId,
    setPendingShapeId,
    setDiagrammingDrawerOpen,
    setMermaidModalOpen
  } = useUIStore();

  const {
    elements,
    addElement,
    updateElement,
    deleteElements,
    setElements
  } = useBoardStore();

  const {
    collaborators,
    localUser,
    cursorTrails
  } = usePresenceStore();

  const lastCursorBroadcastRef = useRef<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  const isElementLockedByPeer = (elementId: string): boolean => {
    if (!localUser) return false;
    return Object.values(collaborators).some(
      peer => peer.editingElementId === elementId && peer.userId !== localUser.userId
    );
  };
  const transformerRef = useRef<Konva.Transformer>(null);
  const isSpacePressed = useRef(false);

  // Dimensions
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Viewport Panning State
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const stageStartPanRef = useRef({ x: 0, y: 0 });

  // Drawing Synchronizer Refs (Solves Stale Closures in Canvas Loops)
  const isDrawingRef = useRef(false);
  const activeElementRef = useRef<CanvasElement | null>(null);
  const drawStartRef = useRef({ x: 0, y: 0 });

  // Multi-Element Selection Box
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const selectionStartRef = useRef({ x: 0, y: 0 });
  const [quickCreatePos, setQuickCreatePos] = useState<{ x: number; y: number; screenX: number; screenY: number } | null>(null);
  const isSelectingRef = useRef(false);

  // Text/Sticky Editor State
  interface EditingText {
    id: string;
    x: number;
    y: number;
    text: string;
    /** 'label' edits the caption on an existing shape or connector in place. */
    type: 'text' | 'sticky' | 'label';
    width: number;
    height: number;
    isNew: boolean;
  }
  const [editingText, setEditingText] = useState<EditingText | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Connector Creation State
  const [connectorPreview, setConnectorPreview] = useState<{ fromX: number; fromY: number; toX: number; toY: number } | null>(null);
  const connectorFromIdRef = useRef<string | null>(null);
  const lassoPointsRef = useRef<number[]>([]);
  const [lassoPath, setLassoPath] = useState<number[] | null>(null);
  const [smartDrawHint, setSmartDrawHint] = useState<string | null>(null);
  /** Which edge a port-drag started from, so the arrow leaves the right side. */
  const connectorFromPortRef = useRef<'top' | 'right' | 'bottom' | 'left'>('right');
  const [hoveredPortShapeId, setHoveredPortShapeId] = useState<string | null>(null);

  // Track transient rendering trigger states
  const [activeElementState, setActiveElementState] = useState<CanvasElement | null>(null);

  // Debug Stats state
  const [debugStats, setDebugStats] = useState({
    pointerX: 0,
    pointerY: 0,
    worldX: 0,
    worldY: 0
  });

  // Circular Eraser and Animations State
  const [eraserPointer, setEraserPointer] = useState<{ x: number; y: number } | null>(null);
  const [emojiHoverPos, setEmojiHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredEraserId, setHoveredEraserId] = useState<string | null>(null);
  const [fadingElements, setFadingElements] = useState<{ el: CanvasElement; progress: number }[]>([]);
  const [particles, setParticles] = useState<{ id: string; x: number; y: number; color: string; size: number; velocity: { x: number; y: number } }[]>([]);
  const [draggingElementId, setDraggingElementId] = useState<string | null>(null);
  const erasedIdsRef = useRef<string[]>([]);
  const [animationFrame, setAnimationFrame] = useState(0);

  // Initialize keyboards
  useKeyboard(isSpacePressed);

  // Register "/" keyboard listener for Quick Create
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.getAttribute('contenteditable') === 'true'
      );
      
      if (isTyping) return;
      
      if (e.key === '/') {
        e.preventDefault();
        const stage = stageRef.current;
        if (!stage) return;
        
        const pointerPos = stage.getPointerPosition() || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const rawX = (pointerPos.x - pan.x) / zoom;
        const rawY = (pointerPos.y - pan.y) / zoom;
        
        setQuickCreatePos({
          x: rawX,
          y: rawY,
          screenX: pointerPos.x,
          screenY: pointerPos.y
        });
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [pan, zoom]);

  // Image Paste Event Listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (!file) continue;

          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            const now = Date.now();
            const center = {
              x: (window.innerWidth / 2 - pan.x) / zoom - 150,
              y: (window.innerHeight / 2 - pan.y) / zoom - 100
            };

            const newImg: ImageElement = {
              id: Math.random().toString(36).substring(2, 9),
              type: 'image',
              src: dataUrl,
              x: Math.round(center.x),
              y: Math.round(center.y),
              width: 300,
              height: 200,
              rotation: 0,
              opacity: 1,
              stroke: 'transparent',
              strokeWidth: 0,
              fill: 'transparent',
              isLocked: false,
              createdBy: localUser.userId,
              createdAt: now,
              updatedAt: now
            };

            addElement(newImg);
            setSelectedElementIds([newImg.id]);
          };
          reader.readAsDataURL(file);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [pan, zoom, localUser.userId, addElement, setSelectedElementIds]);

  // Send typing notifications to board collaborators
  useEffect(() => {
    if (socketInstance && currentBoardId) {
      socketInstance.emit('presence-typing', {
        boardId: currentBoardId,
        userId: localUser.userId,
        isTyping
      });
    }
  }, [isTyping, currentBoardId, localUser.userId]);

  // Synchronize active tool changes
  useEffect(() => {
    if (socketInstance && currentBoardId) {
      socketInstance.emit('cursor-move', {
        boardId: currentBoardId,
        userId: localUser.userId,
        displayName: localUser.displayName,
        presenceColor: localUser.presenceColor,
        x: 0,
        y: 0,
        activeTool,
        activity: 'idle'
      });
    }
  }, [activeTool, currentBoardId, localUser]);

  // Interpolation & Trails Animation loop
  useEffect(() => {
    let animId: number;

    const tick = () => {
      const state = usePresenceStore.getState();
      const collabs = state.collaborators;
      const trailsActive = state.cursorTrails;

      Object.values(collabs).forEach((peer) => {
        let changed = false;
        const updates: Partial<Collaborator> = {};
        
        // 1. Interpolation
        if (peer.targetX !== undefined && peer.targetY !== undefined) {
          const dx = peer.targetX - peer.x;
          const dy = peer.targetY - peer.y;
          
          if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
            updates.x = peer.x + dx * 0.25;
            updates.y = peer.y + dy * 0.25;
            changed = true;
          }
        }

        // 2. Trails
        if (trailsActive) {
          const currentPoints = peer.trailPoints ? [...peer.trailPoints] : [];
          
          if (changed) {
            currentPoints.push({ x: peer.x, y: peer.y, opacity: 0.6 });
          }
          
          const nextPoints = currentPoints
            .map(pt => ({ ...pt, opacity: pt.opacity - 0.05 }))
            .filter(pt => pt.opacity > 0.05);

          if (changed || nextPoints.length !== (peer.trailPoints?.length || 0)) {
            updates.trailPoints = nextPoints.slice(-5);
            changed = true;
          }
        }

        if (changed) {
          state.updateCollaborator(peer.userId, updates);
        }
      });

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Broadcast local selection and text locks to peers instantly on changes
  useEffect(() => {
    if (socketInstance && currentBoardId && localUser) {
      const stage = stageRef.current;
      const pointerPos = stage ? stage.getPointerPosition() : null;
      const worldPos = pointerPos ? {
        x: (pointerPos.x - pan.x) / zoom,
        y: (pointerPos.y - pan.y) / zoom
      } : { x: 0, y: 0 };

      socketInstance.emit('cursor-move', {
        boardId: currentBoardId,
        userId: localUser.userId,
        displayName: localUser.displayName,
        presenceColor: localUser.presenceColor,
        x: worldPos.x,
        y: worldPos.y,
        activeTool,
        activity: editingText ? 'typing' : 'idle',
        selectedElementIds,
        editingElementId: editingText ? editingText.id : undefined
      });
    }
  }, [selectedElementIds, editingText, activeTool, currentBoardId]);

  // Stage resizing
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        // A container can momentarily measure 0 — during layout, when a tab is
        // restored, or on orientation change. Sizing the stage to zero makes
        // Konva draw from a zero-size canvas and throw, so hold the last good
        // size until a real one arrives.
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 1. Particle physics loop
  useEffect(() => {
    if (particles.length === 0) return;
    const id = requestAnimationFrame(() => {
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.velocity.x,
            y: p.y + p.velocity.y,
            velocity: {
              ...p.velocity,
              y: p.velocity.y + 0.15
            }
          }))
      );
    });
    return () => cancelAnimationFrame(id);
  }, [particles]);

  // 2. Fading elements exit loop
  useEffect(() => {
    if (fadingElements.length === 0) return;
    const id = requestAnimationFrame(() => {
      setFadingElements((prev) =>
        prev
          .map((item) => ({ ...item, progress: item.progress + 0.08 }))
          .filter((item) => item.progress < 1)
      );
    });
    return () => cancelAnimationFrame(id);
  }, [fadingElements]);

  // 3. Creation pop render tick loop
  useEffect(() => {
    const hasNewElements = elements.some((el) => Date.now() - el.createdAt < 200);
    if (!hasNewElements) return;
    const id = requestAnimationFrame(() => {
      setAnimationFrame((prev) => prev + 1);
    });
    return () => cancelAnimationFrame(id);
  }, [elements, animationFrame]);

  // Sparkles Particle Spawner
  const spawnSparkles = (x: number, y: number, color: string) => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const newParticles = Array.from({ length: 5 }).map(() => ({
      id: Math.random().toString(),
      x,
      y,
      color: color && color !== 'transparent' ? color : '#facc15',
      size: 2 + Math.random() * 4,
      velocity: {
        x: (Math.random() - 0.5) * 5,
        y: (Math.random() - 0.5) * 5 - 2
      }
    }));
    setParticles((prev) => [...prev, ...newParticles]);

    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newParticles.some((np) => np.id === p.id)));
    }, 600);
  };

  // Update cursors
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (isPanning) {
      container.style.cursor = 'grabbing';
      return;
    }

    if (isSpacePressed.current || activeTool === 'hand') {
      container.style.cursor = 'grab';
    } else if (activeTool === 'select') {
      container.style.cursor = 'default';
    } else if (activeTool === 'eraser') {
      container.style.cursor = 'cell';
    } else if (activeTool === 'text') {
      container.style.cursor = 'text';
    } else {
      container.style.cursor = 'crosshair';
    }
  }, [activeTool, isPanning]);

  // Bind Selected Node Targets to Transformer
  useEffect(() => {
    if (!transformerRef.current) return;
    const stage = stageRef.current;
    if (!stage) return;

    if (selectedElementIds.length === 0) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
      return;
    }

    const nodes = selectedElementIds
      .map((id) => stage.findOne(`#${id}`))
      .filter(Boolean) as Konva.Node[];

    transformerRef.current.nodes(nodes);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedElementIds, elements]);

  // Screen Coordinates -> Absolute World Coordinate Mapper (Step 9)
  const getCanvasPointerPosition = (evt?: any): { x: number; y: number } | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    let pos = stage.getPointerPosition();
    
    // Fallback if Konva Stage pointer registration lags on initial Down events
    if (!pos && evt) {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const clientX = evt.clientX !== undefined ? evt.clientX : (evt.touches?.[0]?.clientX || 0);
        const clientY = evt.clientY !== undefined ? evt.clientY : (evt.touches?.[0]?.clientY || 0);
        pos = {
          x: clientX - rect.left,
          y: clientY - rect.top
        };
      }
    }
    
    if (!pos) return null;
    const rawX = (pos.x - pan.x) / zoom;
    const rawY = (pos.y - pan.y) / zoom;
    
    if (snapToGrid) {
      const gridSize = gridType === 'line' ? 40 : 20;
      return {
        x: Math.round(rawX / gridSize) * gridSize,
        y: Math.round(rawY / gridSize) * gridSize
      };
    }
    
    return {
      x: rawX,
      y: rawY
    };
  };

  const handleDuplicateSelected = () => {
    const newIds: string[] = [];
    selectedElementIds.forEach(id => {
      const el = elements.find(item => item.id === id);
      if (el && el.type !== 'connector') {
        const newId = Math.random().toString(36).substring(2, 9);
        const duplicated: CanvasElement = {
          ...el,
          id: newId,
          x: el.x + 30,
          y: el.y + 30,
          createdAt: Date.now(),
          updatedAt: Date.now()
        } as any;
        addElement(duplicated);
        newIds.push(newId);
      }
    });
    if (newIds.length > 0) {
      setSelectedElementIds(newIds);
    }
  };

  const handleAddConnector = (fromId: string, toId: string) => {
    const connId = Math.random().toString(36).substring(2, 9);
    const newConnector: ConnectorElement = {
      id: connId,
      type: 'connector',
      fromId,
      toId,
      fromPort: 'right',
      toPort: 'left',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
      opacity: 1,
      stroke: '#64748b',
      strokeWidth: 2,
      fill: 'transparent',
      isLocked: false,
      createdBy: 'local-user',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    addElement(newConnector);
  };

  const handleStageDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;

    if (e.target === stage) {
      const pointerPos = stage.getPointerPosition();
      const worldPos = getCanvasPointerPosition(e.evt);
      if (pointerPos && worldPos) {
        setQuickCreatePos({
          x: worldPos.x,
          y: worldPos.y,
          screenX: pointerPos.x,
          screenY: pointerPos.y
        });
      }
    }
  };


  /**
   * Partial eraser: rub out only the bit of ink under the cursor.
   *
   * Walks each freehand stroke and keeps the runs of points that fall outside
   * the eraser circle, so a stroke crossed in the middle becomes two strokes
   * rather than vanishing entirely. Only ink is affected — shapes and text are
   * left alone, which is what separates this from the object eraser.
   *
   * Writes with `setElements(..., true)` to skip history: a drag would
   * otherwise push a hundred undo steps. One entry is committed on release.
   */
  const erasePartialStrokes = (worldPos: { x: number; y: number }) => {
    const radius = eraserSize;
    const current = useBoardStore.getState().elements;
    let changed = false;
    const next: CanvasElement[] = [];

    current.forEach((el) => {
      if (el.type !== 'pencil' || el.isLocked) {
        next.push(el);
        return;
      }

      const stroke = el as any;
      const pts: number[] = stroke.points || [];
      const ox = stroke.x || 0;
      const oy = stroke.y || 0;

      const runs: number[][] = [];
      let run: number[] = [];

      for (let i = 0; i + 1 < pts.length; i += 2) {
        const px = pts[i] + ox;
        const py = pts[i + 1] + oy;
        const hit = Math.hypot(px - worldPos.x, py - worldPos.y) <= radius;

        if (hit) {
          // Runs of one point cannot be drawn, so drop them.
          if (run.length >= 4) runs.push(run);
          run = [];
        } else {
          run.push(pts[i], pts[i + 1]);
        }
      }
      if (run.length >= 4) runs.push(run);

      const untouched = runs.length === 1 && runs[0].length === pts.length;
      if (untouched) {
        next.push(el);
        return;
      }

      changed = true;
      runs.forEach((points, i) => {
        next.push(
          i === 0
            ? ({ ...stroke, points } as CanvasElement)
            : ({
                ...stroke,
                id: `${stroke.id}_s${i}_${Math.random().toString(36).slice(2, 6)}`,
                points,
              } as CanvasElement)
        );
      });
    });

    if (changed) setElements(next, true);
  };

  /** Open the inline editor over an existing element's caption. */
  const beginLabelEdit = (el: any, box?: { x: number; y: number; width: number; height: number }) => {
    if (isElementLockedByPeer(el.id)) return;
    const area = box ?? {
      x: el.x,
      y: el.y,
      width: el.width || 160,
      height: el.height || 60,
    };
    setEditingText({
      id: el.id,
      x: area.x,
      y: area.y,
      text: el.text || '',
      type: 'label',
      width: Math.max(90, area.width),
      height: Math.max(38, Math.min(area.height, 90)),
      isNew: false,
    });
  };


  /**
   * Pinch to zoom and two-finger pan.
   *
   * Konva forwards touch events but implements no gestures, so on a phone or
   * tablet there was no way to zoom or pan at all — only the on-screen buttons.
   * Anchoring the zoom to the midpoint between the fingers keeps the board
   * still under them rather than jumping to a corner.
   */
  const pinchRef = useRef<{ dist: number; centre: { x: number; y: number } } | null>(null);

  const touchDistance = (a: Touch, b: Touch) =>
    Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);

  const handleTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches;
    if (touches.length !== 2) return;

    // A two-finger gesture is never a draw: cancel anything in progress.
    e.evt.preventDefault();
    isDrawingRef.current = false;
    activeElementRef.current = null;

    const [a, b] = [touches[0], touches[1]];
    const dist = touchDistance(a, b);
    const centre = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };

    const previous = pinchRef.current;
    if (!previous) {
      pinchRef.current = { dist, centre };
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    const localX = centre.x - (rect?.left ?? 0);
    const localY = centre.y - (rect?.top ?? 0);

    const scale = dist / (previous.dist || dist);
    const nextZoom = Math.max(0.1, Math.min(10, zoom * scale));

    // Keep the world point under the fingers fixed while scaling, then apply
    // whatever the fingers also travelled as a pan.
    const worldX = (localX - pan.x) / zoom;
    const worldY = (localY - pan.y) / zoom;

    setZoom(nextZoom);
    setPan({
      x: localX - worldX * nextZoom + (centre.x - previous.centre.x),
      y: localY - worldY * nextZoom + (centre.y - previous.centre.y),
    });

    pinchRef.current = { dist, centre };
  };

  const handleTouchEnd = () => {
    pinchRef.current = null;
  };

  // Stage Pointer Down Handler (Step 4 & 5)
  const handlePointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (usePresenceStore.getState().followingUserId) {
      usePresenceStore.getState().setFollowingUserId(null);
    }
    console.log("DOWN", activeTool); // Instrument trace (Step 4)
    
    const clientX = e.evt.clientX !== undefined ? e.evt.clientX : ((e.evt as any).touches?.[0]?.clientX || 0);
    const clientY = e.evt.clientY !== undefined ? e.evt.clientY : ((e.evt as any).touches?.[0]?.clientY || 0);
    panStartRef.current = { x: clientX, y: clientY };

    const isMiddleClick = e.evt.button === 1;
    const isHandTool = activeTool === 'hand';
    const isSpacePan = isSpacePressed.current;

    // 1. Panning Activation
    if (isMiddleClick || isHandTool || isSpacePan) {
      setIsPanning(true);
      stageStartPanRef.current = { ...pan };
      e.evt.preventDefault();
      return;
    }

    // Commit existing text editing block
    if (editingText) {
      commitEditingText();
    }

    const worldPos = getCanvasPointerPosition(e.evt);
    if (!worldPos) return;

    // 2. Select Tool Actions
    if (activeTool === 'select') {
      const clickedStage = e.target === stageRef.current;
      if (clickedStage) {
        // Multi-select bounding box
        setSelectedElementIds([]);
        isSelectingRef.current = true;
        selectionStartRef.current = worldPos;
        setSelectionRect({ x: worldPos.x, y: worldPos.y, w: 0, h: 0 });
      } else {
        // Clicked a shape
        const clickedId = e.target.id() || e.target.getParent()?.id();
        if (clickedId && clickedId !== 'transformer') {
          if (isElementLockedByPeer(clickedId)) {
            setSelectedElementIds([]);
            return;
          }
          const isShiftPressed = e.evt.shiftKey;
          if (isShiftPressed) {
            if (selectedElementIds.includes(clickedId)) {
              setSelectedElementIds(selectedElementIds.filter((id) => id !== clickedId));
            } else {
              setSelectedElementIds([...selectedElementIds, clickedId]);
            }
          } else {
            if (!selectedElementIds.includes(clickedId)) {
              setSelectedElementIds([clickedId]);
            }
          }
        }
      }
      return;
    }

    // 3. Eraser Tool Actions (Drag / Click Eraser)
    if (activeTool === 'eraser') {
      isDrawingRef.current = true;
      erasedIdsRef.current = [];

      if (eraserMode === 'stroke') {
        erasePartialStrokes(worldPos);
        return;
      }
      
      const touched = elements.filter(el => isElementIntersectedByCircle(el, worldPos, eraserSize));
      if (touched.length > 0) {
        const touchedIds = touched.map(el => el.id);
        erasedIdsRef.current = touchedIds;
        
        setFadingElements(prev => [
          ...prev,
          ...touched.map(el => ({ el, progress: 0 }))
        ]);
        
        setElements(elements.filter(el => !touchedIds.includes(el.id)), true);
      }
      return;
    }

    // 4. Connector Tool Actions
    if (activeTool === 'connector') {
      const clickedId = e.target.id() || e.target.getParent()?.id();
      if (clickedId && clickedId !== 'transformer') {
        const clickedShape = elements.find(el => el.id === clickedId);
        if (clickedShape) {
          connectorFromIdRef.current = clickedId;
          const fromX = clickedShape.x + (clickedShape.width || 0) / 2;
          const fromY = clickedShape.y + (clickedShape.height || 0) / 2;
          setConnectorPreview({ fromX, fromY, toX: fromX, toY: fromY });
        }
      }
      return;
    }

    // Shape library: the picker armed a shape, now draw it out by dragging.
    // Handled before the built-in tools because it carries its own geometry.
    if (activeTool === 'diagram-shape' && pendingShapeId) {
      const def = getShapeDef(pendingShapeId);
      if (def) {
        isDrawingRef.current = true;
        drawStartRef.current = worldPos;

        const newEl = {
          id: Math.random().toString(36).substring(2, 9),
          type: 'rectangle',
          shapeId: def.id,
          text: def.labelPlacement === 'none' ? undefined : def.label,
          x: worldPos.x,
          y: worldPos.y,
          width: 0,
          height: 0,
          rotation: 0,
          opacity: 1,
          stroke: def.defaultStroke,
          strokeWidth: 2,
          fill: def.defaultFill,
          isLocked: false,
          createdBy: 'local-user',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } as unknown as CanvasElement;

        activeElementRef.current = newEl;
        setActiveElementState(newEl);
      }
      return;
    }

    // Lasso: collect a freeform region, then select what falls inside it.
    if (activeTool === 'lasso') {
      isDrawingRef.current = true;
      drawStartRef.current = worldPos;
      lassoPointsRef.current = [worldPos.x, worldPos.y];
      setLassoPath([worldPos.x, worldPos.y]);
      return;
    }

    // Smart draw records a normal freehand stroke; the recognition happens on
    // release so the user sees their own line while drawing.
    const drawingTools = ['pencil', 'smart-draw', 'highlighter', 'rectangle', 'rounded-rectangle', 'ellipse', 'triangle', 'diamond', 'hexagon', 'star', 'line', 'arrow'];
    if (drawingTools.includes(activeTool)) {
      isDrawingRef.current = true;
      drawStartRef.current = worldPos;

      const elementId = Math.random().toString(36).substring(2, 9);
      // Freehand and line tools store their geometry as absolute world points,
      // so the element origin must stay at 0,0. Leaving highlighter and
      // smart-draw out of this list gave them an origin AND world-space points,
      // drawing every stroke at twice its intended position — off-screen.
      const isVectorPath = ['pencil', 'smart-draw', 'highlighter', 'line', 'arrow'].includes(
        activeTool
      );
      
      const baseProperties = {
        id: elementId,
        type: activeTool as any,
        x: isVectorPath ? 0 : worldPos.x,
        y: isVectorPath ? 0 : worldPos.y,
        width: 0,
        height: 0,
        rotation: 0,
        opacity: 1,
        stroke: activeStroke,
        strokeWidth: activeStrokeWidth,
        fill: isVectorPath ? 'transparent' : activeFill,
        isLocked: false,
        createdBy: 'local-user',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      let newEl: CanvasElement;

      switch (activeTool) {
        case 'pencil':
        case 'smart-draw':
          newEl = {
            ...baseProperties,
            type: 'pencil',
            brush: 'pen',
            points: [worldPos.x, worldPos.y]
          } as PencilElement;
          break;
        case 'highlighter':
          newEl = {
            ...baseProperties,
            type: 'pencil',
            brush: 'highlighter',
            // A highlighter lays down a wide, translucent band; the shared
            // stroke width would otherwise give it a ballpoint's thickness.
            strokeWidth: Math.max(16, activeStrokeWidth * 5),
            opacity: 0.38,
            points: [worldPos.x, worldPos.y]
          } as PencilElement;
          break;
        case 'rectangle':
          newEl = {
            ...baseProperties,
            type: 'rectangle',
            borderRadius: 4
          } as RectangleElement;
          break;
        case 'ellipse':
          newEl = {
            ...baseProperties,
            type: 'ellipse'
          } as EllipseElement;
          break;
        case 'triangle':
          newEl = {
            ...baseProperties,
            type: 'triangle',
            width: 100,
            height: 100
          } as PolygonElement;
          break;
        case 'diamond':
          newEl = {
            ...baseProperties,
            type: 'diamond',
            width: 100,
            height: 100
          } as PolygonElement;
          break;
        case 'hexagon':
          newEl = {
            ...baseProperties,
            type: 'hexagon',
            width: 100,
            height: 100
          } as PolygonElement;
          break;
        case 'star':
          newEl = {
            ...baseProperties,
            type: 'star',
            width: 100,
            height: 100
          } as PolygonElement;
          break;
        case 'line':
          newEl = {
            ...baseProperties,
            type: 'line',
            points: [worldPos.x, worldPos.y, worldPos.x, worldPos.y]
          } as LineElement;
          break;
        case 'arrow':
          newEl = {
            ...baseProperties,
            type: 'arrow',
            points: [worldPos.x, worldPos.y, worldPos.x, worldPos.y]
          } as ArrowElement;
          break;
        default:
          return;
      }

      activeElementRef.current = newEl;
      setActiveElementState(newEl);
    }
  };

  // Stage Pointer Move Handler (Step 4 & 6)
  const handlePointerMove = (e: Konva.KonvaEventObject<PointerEvent>) => {
    // 1. Drag Panning
    if (isPanning) {
      const dx = e.evt.clientX - panStartRef.current.x;
      const dy = e.evt.clientY - panStartRef.current.y;
      setPan({
        x: stageStartPanRef.current.x + dx,
        y: stageStartPanRef.current.y + dy
      });
      return;
    }

    const worldPos = getCanvasPointerPosition(e.evt);
    if (!worldPos) return;

    // Update diagnostic stats panel coordinates
    const stage = stageRef.current;
    if (stage) {
      const pointer = stage.getPointerPosition() || { x: 0, y: 0 };
      setDebugStats({
        pointerX: Math.round(pointer.x),
        pointerY: Math.round(pointer.y),
        worldX: Math.round(worldPos.x),
        worldY: Math.round(worldPos.y)
      });
    }

    // Broadcast cursor position (Throttled to 33ms / 30Hz)
    const nowMove = Date.now();
    if (nowMove - lastCursorBroadcastRef.current > 33) {
      lastCursorBroadcastRef.current = nowMove;
      if (socketInstance && currentBoardId) {
        socketInstance.emit('cursor-move', {
          boardId: currentBoardId,
          userId: localUser.userId,
          displayName: localUser.displayName,
          presenceColor: localUser.presenceColor,
          x: worldPos.x,
          y: worldPos.y,
          activeTool,
          activity: isDrawingRef.current ? 'drawing' : 'idle',
          drawingElement: isDrawingRef.current ? activeElementRef.current : undefined,
          selectedElementIds,
          editingElementId: editingText ? editingText.id : undefined
        });
      }
    }

    // Emoji hover guide update
    if (activeTool === 'emoji') {
      setEmojiHoverPos(worldPos);
    } else if (emojiHoverPos) {
      setEmojiHoverPos(null);
    }

    // Track which shape the cursor is over so its connection ports can appear.
    // Hit-tested here rather than with per-node handlers so built-in shapes and
    // library shapes behave identically. Topmost element wins.
    if (activeTool === 'select' && !isDrawingRef.current && !isSelectingRef.current) {
      let hovered: string | null = null;
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (el.type === 'connector' || el.type === 'frame' || el.isLocked) continue;
        const b = getElementBounds(el);
        if (
          worldPos.x >= b.x &&
          worldPos.x <= b.x + b.width &&
          worldPos.y >= b.y &&
          worldPos.y <= b.y + b.height
        ) {
          hovered = el.id;
          break;
        }
      }
      if (hovered !== hoveredPortShapeId) setHoveredPortShapeId(hovered);
    }

    // Eraser hover & drag update
    if (activeTool === 'eraser') {
      setEraserPointer(worldPos);

      if (eraserMode === 'stroke') {
        if (isDrawingRef.current) erasePartialStrokes(worldPos);
        return;
      }

      if (!isDrawingRef.current) {
        const hovered = elements.find(el => isElementIntersectedByCircle(el, worldPos, eraserSize));
        setHoveredEraserId(hovered ? hovered.id : null);
      } else {
        const intersected = elements.filter(el => isElementIntersectedByCircle(el, worldPos, eraserSize));
        if (intersected.length > 0) {
          const newIds = intersected.map(el => el.id).filter(id => !erasedIdsRef.current.includes(id));
          if (newIds.length > 0) {
            erasedIdsRef.current = [...erasedIdsRef.current, ...newIds];
            
            setFadingElements(prev => [
              ...prev,
              ...intersected.map(el => ({ el, progress: 0 }))
            ]);
            
            setElements(elements.filter(el => !erasedIdsRef.current.includes(el.id)), true);
          }
        }
      }
      return;
    }

    // 2. Select Tool: Drag Multi-selection outline
    if (activeTool === 'select' && isSelectingRef.current && selectionRect) {
      const start = selectionStartRef.current;
      const w = worldPos.x - start.x;
      const h = worldPos.y - start.y;
      setSelectionRect({
        x: w < 0 ? worldPos.x : start.x,
        y: h < 0 ? worldPos.y : start.y,
        w: Math.abs(w),
        h: Math.abs(h)
      });
      return;
    }

    // 3. Connector preview updates
    if (activeTool === 'connector' && connectorFromIdRef.current && connectorPreview) {
      setConnectorPreview({
        ...connectorPreview,
        toX: worldPos.x,
        toY: worldPos.y
      });
      return;
    }

    // Lasso region grows with the pointer.
    if (activeTool === 'lasso' && isDrawingRef.current) {
      lassoPointsRef.current = [...lassoPointsRef.current, worldPos.x, worldPos.y];
      setLassoPath(lassoPointsRef.current);
      return;
    }

    // 4. Shape Drawing drag updates
    if (!isDrawingRef.current || !activeElementRef.current) return;

    const start = drawStartRef.current;
    let updated = { ...activeElementRef.current };

    switch (updated.type) {
      case 'pencil': {
        const p = updated as PencilElement;
        p.points = [...p.points, worldPos.x, worldPos.y];
        break;
      }
      case 'rectangle':
      case 'rounded-rectangle':
      case 'ellipse':
      case 'triangle':
      case 'diamond':
      case 'hexagon':
      case 'star': {
        // Fix: Coordinates Normalization in Real-Time (Allows reverse drawing!)
        const x = Math.min(start.x, worldPos.x);
        const y = Math.min(start.y, worldPos.y);
        const w = Math.abs(worldPos.x - start.x);
        const h = Math.abs(worldPos.y - start.y);
        
        updated.x = x;
        updated.y = y;
        updated.width = w;
        updated.height = h;
        break;
      }
      case 'line':
      case 'arrow': {
        const l = updated as LineElement | ArrowElement;
        let targetPos = worldPos;
        if (e.evt.shiftKey) {
          targetPos = snapPointToAngle(start, worldPos);
        }
        l.points = [start.x, start.y, targetPos.x, targetPos.y];
        break;
      }
    }

    activeElementRef.current = updated as CanvasElement;
    setActiveElementState(updated as CanvasElement);
  };

  // Stage Pointer Up Handler (Step 4 & 6)
  const handlePointerUp = (e: Konva.KonvaEventObject<PointerEvent>) => {
    console.log("UP", activeTool); // Instrument trace (Step 4)
    const worldPos = getCanvasPointerPosition(e.evt);

    if (activeTool === 'eraser') {
      isDrawingRef.current = false;

      if (eraserMode === 'stroke') {
        // The drag edited elements with history skipped; commit it as one step.
        setElements(useBoardStore.getState().elements, false);
        setEraserPointer(null);
        setHoveredEraserId(null);
        return;
      }

      if (erasedIdsRef.current.length > 0) {
        deleteElements(erasedIdsRef.current);
        erasedIdsRef.current = [];
      }
      setHoveredEraserId(null);
      return;
    }

    if (isPanning) {
      setIsPanning(false);
      return;
    }

    // 1. Finalize Multi-select Box
    if (activeTool === 'select' && isSelectingRef.current && selectionRect) {
      isSelectingRef.current = false;
      const box = selectionRect;

      const matches = elements
        .filter((el) => {
          if (el.type === 'connector') return false;
          const bounds = getElementBounds(el);
          
          return !(
            bounds.x + bounds.width < box.x ||
            box.x + box.w < bounds.x ||
            bounds.y + bounds.height < box.y ||
            box.y + box.h < bounds.y
          );
        })
        .map((el) => el.id);

      setSelectedElementIds(matches);
      setSelectionRect(null);
      return;
    }

    // 2. Finalize Connector Connection
    if (activeTool === 'connector' && connectorFromIdRef.current && connectorPreview) {
      const clickedId = e.target.id() || e.target.getParent()?.id();
      
      if (clickedId && clickedId !== connectorFromIdRef.current && clickedId !== 'transformer') {
        const connId = Math.random().toString(36).substring(2, 9);
        const newConnector: ConnectorElement = {
          id: connId,
          type: 'connector',
          fromId: connectorFromIdRef.current,
          toId: clickedId,
          // Leave from whichever port was dragged; the connector tool used
          // without ports still defaults to a left-to-right run.
          fromPort: connectorFromPortRef.current,
          toPort:
            connectorFromPortRef.current === 'left'
              ? 'right'
              : connectorFromPortRef.current === 'top'
                ? 'bottom'
                : connectorFromPortRef.current === 'bottom'
                  ? 'top'
                  : 'left',
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          rotation: 0,
          opacity: 1,
          stroke: '#64748b',
          strokeWidth: 2,
          fill: 'transparent',
          isLocked: false,
          createdBy: 'local-user',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        addElement(newConnector);
      }
      setConnectorPreview(null);
      connectorFromIdRef.current = null;
      connectorFromPortRef.current = 'right';
      setActiveTool('select');
      return;
    }

    // Finalise a lasso: select every element whose centre falls inside it.
    if (activeTool === 'lasso' && isDrawingRef.current) {
      isDrawingRef.current = false;
      const pts = lassoPointsRef.current;
      lassoPointsRef.current = [];
      setLassoPath(null);

      if (pts.length >= 8) {
        const polygon: { x: number; y: number }[] = [];
        for (let i = 0; i + 1 < pts.length; i += 2) polygon.push({ x: pts[i], y: pts[i + 1] });

        const hits = elements
          .filter((el) => {
            if (el.type === 'connector' || el.isLocked) return false;
            const b = getElementBounds(el);
            return pointInPolygon(
              { x: b.x + b.width / 2, y: b.y + b.height / 2 },
              polygon
            );
          })
          .map((el) => el.id);

        setSelectedElementIds(hits);
      }

      setActiveTool('select');
      return;
    }

    // 3. Finalize Shape Drawing (Step 6)
    if (isDrawingRef.current && activeElementRef.current) {
      let final = { ...activeElementRef.current };

      // A library shape clicked rather than dragged out gets its default size,
      // so a single click places a correctly proportioned shape instead of
      // being discarded as a zero-size drag.
      const pendingDef = getShapeDef((final as any).shapeId);
      if (pendingDef && Math.abs(final.width) < 6 && Math.abs(final.height) < 6) {
        final.width = pendingDef.defaultWidth;
        final.height = pendingDef.defaultHeight;
        final.x = drawStartRef.current.x - pendingDef.defaultWidth / 2;
        final.y = drawStartRef.current.y - pendingDef.defaultHeight / 2;
      }

      // Smart draw: swap the raw stroke for the shape it resembles. If nothing
      // is recognised confidently the freehand line is kept as drawn.
      if (activeTool === 'smart-draw' && final.type === 'pencil') {
        const recognised = recognizeShape((final as PencilElement).points);

        if (recognised) {
          const now = Date.now();
          const base = {
            id: final.id,
            x: recognised.x,
            y: recognised.y,
            width: recognised.width,
            height: recognised.height,
            rotation: 0,
            opacity: 1,
            stroke: activeStroke,
            strokeWidth: activeStrokeWidth,
            fill: activeFill && activeFill !== 'transparent' ? activeFill : '#ffffff',
            isLocked: false,
            createdBy: 'local-user',
            createdAt: now,
            updatedAt: now,
          };

          const snapped = recognised.line
            ? ({
                ...base,
                type: 'line',
                x: 0,
                y: 0,
                points: [
                  recognised.line.from.x,
                  recognised.line.from.y,
                  recognised.line.to.x,
                  recognised.line.to.y,
                ],
                fill: 'transparent',
              } as unknown as CanvasElement)
            : ({ ...base, type: 'rectangle', shapeId: recognised.shapeId } as unknown as CanvasElement);

          addElement(snapped);
          setSelectedElementIds([final.id]);
          setSmartDrawHint(recognised.label);
          setTimeout(() => setSmartDrawHint(null), 1400);

          isDrawingRef.current = false;
          activeElementRef.current = null;
          setActiveElementState(null);
          return;
        }
      }

      const limit = final.type === 'pencil' ? 4 : 5;
      const isValid = 
        final.type === 'pencil'
          ? (final as PencilElement).points.length > limit
          : (final.type === 'line' || final.type === 'arrow')
            ? (() => {
                const pts = (final as LineElement).points;
                if (!pts || pts.length < 4) return false;
                const dx = pts[2] - pts[0];
                const dy = pts[3] - pts[1];
                return Math.sqrt(dx * dx + dy * dy) > limit;
              })()
            : Math.abs(final.width) > limit || Math.abs(final.height) > limit;

      if (isValid) {
        addElement(final);
        setSelectedElementIds([final.id]); // Auto-select shape after creation
      }

      isDrawingRef.current = false;
      activeElementRef.current = null;
      setActiveElementState(null);

      if (socketInstance && currentBoardId && worldPos) {
        socketInstance.emit('cursor-move', {
          boardId: currentBoardId,
          userId: localUser.userId,
          displayName: localUser.displayName,
          presenceColor: localUser.presenceColor,
          x: worldPos.x,
          y: worldPos.y,
          activeTool,
          activity: 'idle'
        });
      }

      if (activeTool === 'diagram-shape') {
        // Disarm after one placement, matching every other shape tool.
        setPendingShapeId(null);
      } else if (activeTool !== 'pencil' && activeTool !== 'smart-draw' && activeTool !== 'highlighter') {
        setActiveTool('select');
      }
      return;
    }

    // 4. Click Text/Sticky note spawn placements
    const wasClick = Math.abs(e.evt.clientX - (panStartRef.current.x || 0)) < 5 && 
                     Math.abs(e.evt.clientY - (panStartRef.current.y || 0)) < 5;

    if (wasClick && (activeTool === 'text' || activeTool === 'sticky')) {
      if (!worldPos) return;

      const isSticky = activeTool === 'sticky';
      const width = isSticky ? 140 : 180;
      const height = isSticky ? 140 : 40;
      
      const posX = isSticky ? worldPos.x - width / 2 : worldPos.x;
      const posY = isSticky ? worldPos.y - height / 2 : worldPos.y;

      setEditingText({
        id: Math.random().toString(36).substring(2, 9),
        x: posX,
        y: posY,
        text: '',
        type: activeTool,
        width,
        height,
        isNew: true
      });
    }

    if (wasClick && activeTool === 'emoji' && activeEmoji) {
      if (!worldPos) return;
      const size = 64;
      const newEmojiId = Math.random().toString(36).substring(2, 9);
      const newEmoji: any = {
        id: newEmojiId,
        type: 'emoji',
        emoji: activeEmoji,
        x: worldPos.x - size / 2,
        y: worldPos.y - size / 2,
        width: size,
        height: size,
        fontSize: size * 0.8,
        rotation: 0,
        opacity: 1,
        stroke: 'transparent',
        strokeWidth: 0,
        fill: 'transparent',
        isLocked: false,
        createdBy: 'local-user',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      addElement(newEmoji);
      setSelectedElementIds([newEmojiId]);
      setActiveTool('select');
      setActiveEmoji(null);
    }
  };

  // Wheel stage transforms
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    if (usePresenceStore.getState().followingUserId) {
      usePresenceStore.getState().setFollowingUserId(null);
    }
    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const scaleBy = 1.1;
    const delta = e.evt.deltaY;
    const isPinchOrCommand = e.evt.ctrlKey || e.evt.metaKey;

    if (!isPinchOrCommand && Math.abs(delta) < 120) {
      setPan((prev) => ({
        x: prev.x - e.evt.deltaX,
        y: prev.y - e.evt.deltaY
      }));
      return;
    }

    const oldScale = zoom;
    const newScale = delta < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const boundedScale = Math.min(10, Math.max(0.1, newScale));

    const mousePointTo = {
      x: (pointer.x - pan.x) / oldScale,
      y: (pointer.y - pan.y) / oldScale
    };

    setZoom(boundedScale);
    setPan({
      x: pointer.x - mousePointTo.x * boundedScale,
      y: pointer.y - mousePointTo.y * boundedScale
    });
  };

  // Commit dynamic textbox edits
  const commitEditingText = () => {
    if (!editingText) return;

    // Labels belong to an element that already exists, so there is nothing to
    // build — write the caption back and stop. An emptied label is allowed:
    // clearing a shape's text is a legitimate edit.
    if (editingText.type === 'label') {
      updateElement(editingText.id, { text: editingText.text } as any);
      setEditingText(null);
      return;
    }

    if (editingText.text.trim()) {
      const stickyBg = activeFill === 'transparent' ? '#fef08a' : activeFill;
      
      const baseProperties = {
        id: editingText.id,
        x: editingText.x,
        y: editingText.y,
        width: editingText.width,
        height: editingText.height,
        rotation: 0,
        opacity: 1,
        stroke: editingText.type === 'sticky' ? 'transparent' : activeStroke,
        strokeWidth: 1,
        fill: editingText.type === 'sticky' ? stickyBg : 'transparent',
        isLocked: false,
        createdBy: 'local-user',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      if (editingText.type === 'text') {
        const textEl: TextElement = {
          ...baseProperties,
          type: 'text',
          text: editingText.text,
          fontSize: 16,
          fontFamily: 'Inter',
          fontWeight: 'normal',
          fontStyle: 'normal',
          align: 'left'
        };
        if (editingText.isNew) {
          addElement(textEl);
          setSelectedElementIds([textEl.id]);
        } else {
          updateElement(editingText.id, { text: editingText.text });
        }
      } else {
        const stickyEl: StickyElement = {
          ...baseProperties,
          type: 'sticky',
          text: editingText.text,
          fontSize: 14,
          fontFamily: 'Outfit',
          align: 'center',
          stickyColor: stickyBg
        };
        if (editingText.isNew) {
          addElement(stickyEl);
          setSelectedElementIds([stickyEl.id]);
        } else {
          updateElement(editingText.id, { text: editingText.text });
        }
      }
    }

    setEditingText(null);
    setActiveTool('select');
  };

  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitEditingText();
    }
    if (e.key === 'Escape') {
      setEditingText(null);
      setActiveTool('select');
    }
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>, id: string) => {
    let targetX = e.target.x();
    let targetY = e.target.y();

    if (snapToGrid) {
      const gridSize = gridType === 'line' ? 40 : 20;
      targetX = Math.round(targetX / gridSize) * gridSize;
      targetY = Math.round(targetY / gridSize) * gridSize;
      e.target.x(targetX);
      e.target.y(targetY);
    }

    const currentEl = elements.find(el => el.id === id);
    if (currentEl && currentEl.type === 'frame') {
      const dx = targetX - currentEl.x;
      const dy = targetY - currentEl.y;

      if (dx !== 0 || dy !== 0) {
        const frameX = currentEl.x;
        const frameY = currentEl.y;
        const frameW = currentEl.width || 0;
        const frameH = currentEl.height || 0;

        elements.forEach(child => {
          if (child.id === id || child.type === 'frame') return;

          const childBounds = getElementBounds(child);
          const childCenterX = childBounds.x + childBounds.width / 2;
          const childCenterY = childBounds.y + childBounds.height / 2;

          const isInside = 
            childCenterX >= frameX &&
            childCenterX <= frameX + frameW &&
            childCenterY >= frameY &&
            childCenterY <= frameY + frameH;

          if (isInside) {
            updateElement(child.id, {
              x: child.x + dx,
              y: child.y + dy
            });
          }
        });
      }
    }

    updateElement(id, {
      x: targetX,
      y: targetY
    });
  };

  // Transformer scaling modifications
  const handleTransformEnd = (e: Konva.KonvaEventObject<Event>, el: CanvasElement) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    node.scaleX(1);
    node.scaleY(1);

    const updates: Partial<CanvasElement> = {
      x: node.x(),
      y: node.y(),
      rotation: node.rotation()
    };

    const isLibraryShape = Boolean(getShapeDef(el.shapeId) || getShapeDefForLegacyType(el.type));

    if (isLibraryShape || ['rectangle', 'rounded-rectangle', 'ellipse', 'triangle', 'diamond', 'hexagon', 'star', 'text', 'sticky', 'emoji', 'frame'].includes(el.type)) {
      if (el.type === 'emoji') {
        const newSize = Math.max(10, (el.width || 64) * scaleX);
        updates.width = newSize;
        updates.height = newSize;
        (updates as any).fontSize = newSize * 0.8;
      } else {
        updates.width = Math.max(5, (el.width || 0) * scaleX);
        updates.height = Math.max(5, (el.height || 0) * scaleY);
      }
    }

    if (['pencil', 'line', 'arrow'].includes(el.type)) {
      const pts = (el as any).points || [];
      const nextPoints = [];
      for (let i = 0; i < pts.length; i += 2) {
        nextPoints.push(pts[i] * scaleX, pts[i + 1] * scaleY);
      }
      (updates as any).points = nextPoints;
    }

    updateElement(el.id, updates);
  };

  const textareaScreenPos = editingText 
    ? worldToScreen(editingText.x, editingText.y, pan, zoom, containerRef.current) 
    : { x: 0, y: 0 };

  const gridStyle = {
    backgroundPosition: `${pan.x}px ${pan.y}px`,
    backgroundSize: `${40 * zoom}px ${40 * zoom}px`
  };

  // Renders individual vector nodes inside canvas stage (Step 7)
  const renderElement = (el: CanvasElement) => {
    const isDraggable = activeTool === 'select' && !el.isLocked;
    const key = el.id;

    // Shape-library elements are drawn from the manifest in shapes/shapeLibrary.ts.
    // Elements saved before the library existed have no shapeId and fall through
    // to the legacy branches below, so old boards keep rendering exactly as before.
    const libraryShape = getShapeDef(el.shapeId);
    if (libraryShape) {
      return (
        <LibraryShapeNode
          key={key}
          element={el}
          shape={libraryShape}
          draggable={isDraggable}
          onDragEnd={(e) => handleDragEnd(e, el.id)}
          onTransformEnd={(e) => handleTransformEnd(e, el)}
          onDblClick={() => beginLabelEdit(el)}
        />
      );
    }

    switch (el.type) {
      case 'pencil': {
        const p = el as any;
        const isHighlighter = p.brush === 'highlighter';
        return (
          <Line
            key={key}
            id={p.id}
            points={p.points}
            x={p.x || 0}
            y={p.y || 0}
            rotation={p.rotation || 0}
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            opacity={p.opacity}
            // Chisel tip rather than a pen's round nib. Deliberately no
            // globalCompositeOperation: a non-default blend pushes Konva onto
            // its buffer-canvas path, which is where the "drawImage on a canvas
            // with width or height of 0" failure comes from. Translucency alone
            // reads as highlighter ink and keeps rendering on the fast path.
            lineCap={isHighlighter ? 'butt' : 'round'}
            lineJoin="round"
            tension={isHighlighter ? 0 : 0.5}
            draggable={isDraggable}
            onDragEnd={(e) => handleDragEnd(e, p.id)}
            onTransformEnd={(e) => handleTransformEnd(e, p)}
          />
        );
      }
      case 'rectangle':
      case 'rounded-rectangle': {
        const r = el as any;
        return (
          <Group
            key={key}
            id={r.id}
            x={r.x}
            y={r.y}
            width={r.width}
            height={r.height}
            rotation={r.rotation || 0}
            opacity={r.opacity || 1}
            draggable={isDraggable}
            onDragEnd={(e) => handleDragEnd(e, r.id)}
            onTransformEnd={(e) => handleTransformEnd(e, r)}
          >
            <Rect
              width={r.width}
              height={r.height}
              stroke={r.stroke}
              strokeWidth={r.strokeWidth}
              fill={r.fill}
              cornerRadius={el.type === 'rounded-rectangle' ? 12 : (r.borderRadius || 0)}
            />
            {r.text && (
              <Text
                x={10}
                y={r.height / 2 - 10}
                width={r.width - 20}
                text={r.text}
                fontSize={13}
                fontFamily="sans-serif"
                fontStyle="bold"
                fill="#ffffff"
                align="center"
              />
            )}
          </Group>
        );
      }
      case 'triangle':
      case 'diamond':
      case 'hexagon':
      case 'star': {
        const shape = el as any;
        const pathData = el.type === 'triangle' ? 'M 50 0 L 100 100 L 0 100 Z'
          : el.type === 'diamond' ? 'M 50 0 L 100 50 L 50 100 L 0 50 Z'
          : el.type === 'hexagon' ? 'M 30 0 L 70 0 L 100 50 L 70 100 L 30 100 L 0 50 Z'
          : 'M 50 0 L 65 35 L 100 38 L 75 62 L 80 100 L 50 80 L 20 100 L 25 62 L 0 38 L 35 35 Z';
        
        return (
          <Group
            key={key}
            id={shape.id}
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            rotation={shape.rotation || 0}
            opacity={shape.opacity || 1}
            draggable={isDraggable}
            onDragEnd={(e) => handleDragEnd(e, shape.id)}
            onTransformEnd={(e) => handleTransformEnd(e, shape)}
          >
            <Path
              scaleX={shape.width / 100}
              scaleY={shape.height / 100}
              data={pathData}
              stroke={shape.stroke}
              strokeWidth={shape.strokeWidth}
              fill={shape.fill}
            />
            {shape.text && (
              <Text
                x={10}
                y={shape.height / 2 - 10}
                width={shape.width - 20}
                text={shape.text}
                fontSize={13}
                fontFamily="sans-serif"
                fontStyle="bold"
                fill="#ffffff"
                align="center"
              />
            )}
          </Group>
        );
      }
      case 'frame': {
        const f = el as any;
        const width = f.width || 600;
        const height = f.height || 380;
        const fType = f.frameType || (f.title?.toLowerCase().includes('diagram') ? 'diagram' : f.title?.toLowerCase().includes('slide') ? 'slides' : f.title?.toLowerCase().includes('engage') ? 'engage-activities' : 'preset');

        return (
          <Group
            key={key}
            id={f.id}
            x={f.x}
            y={f.y}
            draggable={isDraggable}
            onDragEnd={(e) => handleDragEnd(e, f.id)}
            onTransformEnd={(e) => handleTransformEnd(e, f)}
          >
            {/* Header Badge Above Frame Container (Matching Screenshots 3, 4, 5) */}
            <Group x={0} y={-32}>
              <Rect
                x={0}
                y={0}
                width={fType === 'engage-activities' ? 220 : 160}
                height={26}
                fill="#ffffff"
                stroke="#cbd5e1"
                strokeWidth={1}
                cornerRadius={8}
                shadowColor="rgba(0,0,0,0.08)"
                shadowBlur={6}
                perfectDrawEnabled={false}
              />
              <Text
                x={8}
                y={6}
                text={fType === 'slides' ? '📕 Slides' : fType === 'diagram' ? '📙 Diagram' : fType === 'engage-activities' ? '📘 Engage activities' : `♯ ${f.title || 'Frame'}`}
                fontSize={11}
                fontFamily="sans-serif"
                fontStyle="bold"
                fill="#1e293b"
              />

              {/* Header Action Icons: Play Presentation ▶, Expand ⤢, Menu ⋮ */}
              {fType === 'engage-activities' && (
                <Group
                  x={145}
                  y={4}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    useUIStore.getState().setPresentationOpen(true);
                  }}
                >
                  <Rect width={18} height={18} fill="#2563eb" cornerRadius={4} />
                  <Text x={5} y={3} text="▶" fontSize={10} fill="#ffffff" />
                </Group>
              )}
            </Group>

            {/* Container Outer Rect Boundary */}
            <Rect
              x={0}
              y={0}
              width={width}
              height={height}
              stroke={selectedElementIds.includes(f.id) ? '#2563eb' : (resolvedTheme === 'dark' ? '#3f3f46' : '#cbd5e1')}
              strokeWidth={selectedElementIds.includes(f.id) ? 2.5 : 1.5}
              // A slide is a document, so it keeps its own opaque surface in both
              // themes — otherwise dark mode turns the frame translucent and the
              // slide's dark body text becomes unreadable against the canvas.
              fill={
                f.fill && f.fill !== 'transparent'
                  ? f.fill
                  : resolvedTheme === 'dark'
                    ? '#18181b40'
                    : '#ffffff80'
              }
              cornerRadius={12}
              shadowColor="rgba(0, 0, 0, 0.05)"
              shadowBlur={10}
              perfectDrawEnabled={false}
            />

            {/* Diagram frame empty state. These were decorative rectangles with
                no handlers at all; each card now does what it says. The whole
                block steps aside once the frame actually holds something. */}
            {fType === 'diagram' && !frameHasContent(f) && (
              <Group>
                {/* Drop zone. The canvas-level onDrop accepts shapes dragged
                    out of the diagramming panel anywhere, including here. */}
                <Rect
                  x={30}
                  y={40}
                  width={width - 60}
                  height={height - 80}
                  stroke="#cbd5e1"
                  strokeWidth={1.5}
                  dash={[7, 6]}
                  cornerRadius={10}
                  fill="transparent"
                  listening={false}
                />
                <Text
                  x={0}
                  y={height / 2 - 96}
                  width={width}
                  text="Drag and drop shapes here or choose another quick start option"
                  fontSize={13}
                  fill="#64748b"
                  align="center"
                  listening={false}
                />

                {[
                  {
                    key: 'ai',
                    icon: '\u2728',
                    label: 'Create with AI',
                    fill: '#ffffff',
                    tint: '#7c3aed',
                    badge: null as string | null,
                    onPick: () => {
                      // Reuses the existing board-wide AI assistant.
                      setSelectedElementIds([f.id]);
                      triggerAIRequest(
                        'ask',
                        'Suggest a clear flowchart for this diagram frame. Reply with Mermaid code only.'
                      );
                    },
                  },
                  {
                    key: 'freeform',
                    icon: '\u21F2',
                    label: 'Start with freeform',
                    fill: '#ffffff',
                    tint: '#0f172a',
                    badge: null,
                    onPick: () => setDiagrammingDrawerOpen(true),
                  },
                  {
                    key: 'code',
                    icon: '</>',
                    label: 'Build with code',
                    fill: '#ffffff',
                    tint: '#c2410c',
                    badge: 'Beta',
                    onPick: () => setMermaidModalOpen(true),
                  },
                ].map((card, i) => (
                  <Group
                    key={card.key}
                    x={width / 2 - 219 + i * 150}
                    y={height / 2 - 60}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      card.onPick();
                    }}
                    onMouseEnter={() => { if (stageRef.current) stageRef.current.container().style.cursor = 'pointer'; }}
                    onMouseLeave={() => { if (stageRef.current) stageRef.current.container().style.cursor = 'default'; }}
                  >
                    <Rect
                      width={138}
                      height={112}
                      fill={card.fill}
                      stroke="#e2e8f0"
                      strokeWidth={1}
                      cornerRadius={10}
                      shadowColor="rgba(0, 0, 0, 0.06)"
                      shadowBlur={8}
                      perfectDrawEnabled={false}
                    />
                    <Text x={0} y={32} width={138} text={card.icon} fontSize={19} fill={card.tint} align="center" />
                    <Text x={0} y={70} width={138} text={card.label} fontSize={12} fontStyle="bold" fill="#0f172a" align="center" />
                    {card.badge && (
                      <Group x={98} y={8}>
                        <Rect width={32} height={16} fill="#f1f5f9" cornerRadius={4} />
                        <Text x={0} y={4} width={32} text={card.badge} fontSize={8} fontStyle="bold" fill="#64748b" align="center" />
                      </Group>
                    )}
                  </Group>
                ))}

                {/* Ready-made diagrams, below the three cards */}
                <Text
                  x={0}
                  y={height / 2 + 68}
                  width={width}
                  text="or insert a ready-made diagram"
                  fontSize={11}
                  fill="#94a3b8"
                  align="center"
                  listening={false}
                />
                {DIAGRAM_TEMPLATES.slice(0, 3).map((template, i) => (
                  <Group
                    key={template.id}
                    x={width / 2 - 195 + i * 134}
                    y={height / 2 + 88}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      const created = buildDiagram(template, f.x + 40, f.y + 60);
                      useBoardStore.getState().addElements(created);
                      setSelectedElementIds(created.map((el) => el.id));
                    }}
                    onMouseEnter={() => { if (stageRef.current) stageRef.current.container().style.cursor = 'pointer'; }}
                    onMouseLeave={() => { if (stageRef.current) stageRef.current.container().style.cursor = 'default'; }}
                  >
                    <Rect width={122} height={28} fill="#f8fafc" stroke="#e2e8f0" strokeWidth={1} cornerRadius={7} />
                    <Text x={0} y={9} width={122} text={template.name} fontSize={10} fontStyle="bold" fill="#475569" align="center" />
                  </Group>
                ))}
              </Group>
            )}

            {/* SLIDES CONTAINER INNER DYNAMIC ACTIONS & CONTENT (MATCHING USER DEMAND) */}
            {fType === 'slides' && (
              <Group x={width / 2 - 120} y={height / 2 - 45}>
                <Rect
                  width={240}
                  height={90}
                  fill={resolvedTheme === 'dark' ? '#18181b' : '#ffffff'}
                  stroke="#cbd5e1"
                  strokeWidth={1}
                  cornerRadius={16}
                  shadowColor="rgba(0, 0, 0, 0.08)"
                  shadowBlur={12}
                  perfectDrawEnabled={false}
                />
                {/* 4 Interactive Dynamic Slide Buttons */}
                <Group
                  x={15}
                  y={15}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    // Add New Slide Frame to Canvas
                    const now = Date.now();
                    const baseId = Math.random().toString(36).substring(2, 7);
                    const newX = f.x + width + 60;
                    const newY = f.y;
                    useBoardStore.getState().addElement({
                      id: `slide_frame_${baseId}`,
                      type: 'frame',
                      title: `Slide ${elements.filter((el) => el.type === 'frame').length + 1}`,
                      frameType: 'slides',
                      x: newX,
                      y: newY,
                      width: 650,
                      height: 420,
                      stroke: '#ef4444',
                      strokeWidth: 2,
                      fill: '#ffffff',
                      opacity: 1,
                      rotation: 0,
                      isLocked: false,
                      createdBy: 'local-user',
                      createdAt: now,
                      updatedAt: now,
                    } as any);
                    useBoardStore.getState().addElement({
                      id: `text_slide_${baseId}`,
                      type: 'text',
                      text: `Slide ${elements.filter((el) => el.type === 'frame').length + 1} Title`,
                      x: newX + 40,
                      y: newY + 120,
                      width: 400,
                      height: 40,
                      fontSize: 28,
                      fontFamily: 'Inter',
                      fontWeight: 'bold',
                      align: 'left',
                      stroke: '#0f172a',
                      strokeWidth: 1,
                      fill: 'transparent',
                      opacity: 1,
                      rotation: 0,
                      isLocked: false,
                      createdBy: 'local-user',
                      createdAt: now,
                      updatedAt: now,
                    });
                    useUIStore.getState().setPan({
                      x: window.innerWidth / 2 - (newX + 300) * zoom,
                      y: window.innerHeight / 2 - (newY + 200) * zoom,
                    });
                  }}
                >
                  <Rect width={100} height={30} fill="#fef2f2" cornerRadius={8} />
                  <Text x={15} y={8} text="+ Add Slide" fontSize={11} fontStyle="bold" fill="#ef4444" />
                </Group>

                <Group
                  x={125}
                  y={15}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    useUIStore.getState().setSlideLayoutsModalOpen(true);
                  }}
                >
                  <Rect width={100} height={30} fill="#eff6ff" cornerRadius={8} />
                  <Text x={18} y={8} text="🖼️ Layouts" fontSize={11} fontStyle="bold" fill="#2563eb" />
                </Group>

                <Group
                  x={15}
                  y={50}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    useUIStore.getState().setStylesDrawerOpen(true);
                  }}
                >
                  <Rect width={100} height={30} fill="#fcf4ff" cornerRadius={8} />
                  <Text x={15} y={8} text="🎨 Fill Color" fontSize={11} fontStyle="bold" fill="#9333ea" />
                </Group>

                <Group
                  x={125}
                  y={50}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    useUIStore.getState().setPresentationOpen(true);
                  }}
                >
                  <Rect width={100} height={30} fill="#f0fdf4" cornerRadius={8} />
                  <Text x={18} y={8} text="▶ Present" fontSize={11} fontStyle="bold" fill="#166534" />
                </Group>
              </Group>
            )}

            {/* ENGAGE ACTIVITIES CONTAINER INNER CARDS (MATCHING SCREENSHOT 5) */}
            {fType === 'engage-activities' && (
              <Group x={15} y={15}>
                {/* Left Dark Card: Join Us QR & Code */}
                <Group x={0} y={0}>
                  <Rect
                    width={width / 2 - 25}
                    height={height - 30}
                    fill="#18181b"
                    cornerRadius={16}
                    shadowColor="rgba(0,0,0,0.15)"
                    shadowBlur={10}
                    perfectDrawEnabled={false}
                  />
                  <Text x={20} y={25} text="Join us" fontSize={18} fontStyle="bold" fill="#ffffff" />
                  <Text
                    x={20}
                    y={50}
                    width={width / 2 - 160}
                    text="Scan the QR code or open the board link and enter the code"
                    fontSize={10}
                    fill="#a1a1aa"
                  />
                  {/* QR Code Mock Box */}
                  <Rect x={width / 2 - 120} y={25} width={80} height={80} fill="#ffffff" cornerRadius={10} />
                  <Text x={width / 2 - 110} y={50} text="🏁 QR" fontSize={14} fill="#18181b" fontStyle="bold" />

                  {/* Code Input Badges */}
                  <Group x={20} y={height - 75}>
                    {['4', '9', '2', '-', '8', '1', '0'].map((char, idx) => (
                      <Group key={idx} x={idx * 22}>
                        <Rect width={18} height={22} fill="#27272a" cornerRadius={4} />
                        <Text x={4} y={4} text={char} fontSize={11} fontStyle="bold" fill="#38bdf8" />
                      </Group>
                    ))}
                  </Group>
                </Group>

                {/* Right Light Card: Engage Your Audience Options */}
                <Group x={width / 2 - 10} y={0}>
                  <Rect
                    width={width / 2 - 10}
                    height={height - 30}
                    fill="#eff6ff"
                    stroke="#bfdbfe"
                    strokeWidth={1}
                    cornerRadius={16}
                  />
                  <Text x={20} y={20} text="Engage your audience" fontSize={14} fontStyle="bold" fill="#1e3a8a" />
                  <Text
                    x={20}
                    y={40}
                    width={width / 2 - 50}
                    text="Unlock live feedback in meetings with mobile-friendly activities"
                    fontSize={9}
                    fill="#3b82f6"
                  />

                  {/* Grid of Interactive Activity Badges */}
                  <Group x={20} y={65}>
                    {[
                      { name: 'Multiple choice', color: '#fef08a' },
                      { name: 'Open-ended', color: '#bbf7d0' },
                      { name: 'Word cloud', color: '#fed7aa' },
                      { name: 'Scales', color: '#bfdbfe' },
                      { name: 'Ranking', color: '#ddd6fe' },
                      { name: 'Quiz', color: '#fbcfe8' },
                    ].map((act, idx) => {
                      const col = idx % 3;
                      const row = Math.floor(idx / 3);
                      return (
                        <Group key={act.name} x={col * 105} y={row * 45}>
                          <Rect width={95} height={36} fill="#ffffff" stroke="#dbeafe" strokeWidth={1} cornerRadius={8} />
                          <Rect x={6} y={6} width={8} height={24} fill={act.color} cornerRadius={3} />
                          <Text x={18} y={12} width={72} text={act.name} fontSize={9} fontStyle="bold" fill="#1e293b" />
                        </Group>
                      );
                    })}
                  </Group>
                </Group>
              </Group>
            )}
          </Group>
        );
      }
      case 'ellipse': {
        const c = el as EllipseElement;
        const radiusX = Math.abs(c.width / 2);
        const radiusY = Math.abs(c.height / 2);
        const centerX = c.x + radiusX;
        const centerY = c.y + radiusY;
        return (
          <Ellipse
            key={key}
            id={c.id}
            x={centerX}
            y={centerY}
            radiusX={radiusX}
            radiusY={radiusY}
            stroke={c.stroke}
            strokeWidth={c.strokeWidth}
            fill={c.fill}
            opacity={c.opacity}
            rotation={c.rotation}
            draggable={isDraggable}
            onDragEnd={(e) => {
              updateElement(c.id, {
                x: e.target.x() - radiusX,
                y: e.target.y() - radiusY
              });
            }}
            onTransformEnd={(e) => handleTransformEnd(e, c)}
          />
        );
      }
      case 'line': {
        const l = el as any;
        return (
          <Line
            key={key}
            id={l.id}
            points={l.points}
            x={l.x || 0}
            y={l.y || 0}
            rotation={l.rotation || 0}
            stroke={l.stroke}
            strokeWidth={l.strokeWidth}
            opacity={l.opacity}
            dash={l.strokeDash === 'dashed' ? [7, 6] : undefined}
            lineCap="round"
            lineJoin="round"
            draggable={isDraggable}
            onDragEnd={(e) => handleDragEnd(e, l.id)}
            onTransformEnd={(e) => handleTransformEnd(e, l)}
          />
        );
      }
      case 'arrow': {
        const a = el as any;
        return (
          <Arrow
            key={key}
            id={a.id}
            points={a.points}
            x={a.x || 0}
            y={a.y || 0}
            rotation={a.rotation || 0}
            stroke={a.stroke}
            strokeWidth={a.strokeWidth}
            fill={a.stroke}
            opacity={a.opacity}
            dash={a.strokeDash === 'dashed' ? [7, 6] : undefined}
            lineCap="round"
            lineJoin="round"
            pointerLength={10}
            pointerWidth={10}
            draggable={isDraggable}
            onDragEnd={(e) => handleDragEnd(e, a.id)}
            onTransformEnd={(e) => handleTransformEnd(e, a)}
          />
        );
      }
      case 'text': {
        const t = el as TextElement;
        return (
          <Text
            key={key}
            id={t.id}
            x={t.x}
            y={t.y}
            width={t.width || 150}
            height={t.height || 30}
            text={t.text}
            fontSize={t.fontSize}
            fontFamily={t.fontFamily}
            fill={t.stroke}
            align={t.align}
            opacity={t.opacity}
            fontStyle={`${t.fontStyle} ${t.fontWeight}`}
            draggable={isDraggable}
            onDragEnd={(e) => handleDragEnd(e, t.id)}
            onTransformEnd={(e) => handleTransformEnd(e, t)}
            onDblClick={() => {
              if (isElementLockedByPeer(t.id)) return;
              setEditingText({
                id: t.id,
                x: t.x,
                y: t.y,
                text: t.text,
                type: 'text',
                width: t.width || 150,
                height: t.height || 40,
                isNew: false
              });
            }}
          />
        );
      }
      case 'sticky': {
        const s = el as StickyElement;
        const bgColor = s.fill && s.fill !== 'transparent' ? s.fill : (s.stickyColor || '#fef08a');
        
        // 1. Drag Lift shadow
        const isDragging = s.id === draggingElementId;
        const shadowBlur = isDragging ? 18 : 8;
        const shadowOffset = isDragging ? { x: 5, y: 8 } : { x: 2, y: 3 };
        const shadowOpacity = isDragging ? 0.4 : 0.25;

        // 2. Creation Pop animations
        const age = Date.now() - s.createdAt;
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const creationProgress = prefersReducedMotion ? 1 : Math.min(1, age / 200);
        const scale = 0.96 + creationProgress * 0.04;
        const opacity = creationProgress;

        // 3. Card Styles
        const cardStyle = (s as any).cardStyle || 'classic';
        const cornerRadius = cardStyle === 'rounded' ? 16 : (cardStyle === 'paper' ? 0 : 2);
        
        // 4. Reactions & Votes Data
        const reactionsList = Object.entries((s as any).reactions || {}).filter(([_, count]) => (count as number) > 0) as [string, number][];
        const votesList = (s as any).votes || [];
        const hasVoted = votesList.includes('local-user');

        const width = s.width || 140;
        const height = s.height || 140;

        return (
          <Group 
            key={key} 
            id={s.id}
            x={s.x}
            y={s.y}
            scaleX={scale}
            scaleY={scale}
            opacity={opacity}
            draggable={isDraggable}
            onDragStart={() => setDraggingElementId(s.id)}
            onDragEnd={(e) => {
              handleDragEnd(e, s.id);
              setDraggingElementId(null);
            }}
            onTransformEnd={(e) => handleTransformEnd(e, s)}
            onDblClick={() => {
              if (isElementLockedByPeer(s.id)) return;
              setEditingText({
                id: s.id,
                x: s.x,
                y: s.y,
                text: s.text,
                type: 'sticky',
                width,
                height,
                isNew: false
              });
            }}
          >
            {/* Sticky Card Background */}
            <Rect
              width={width}
              height={height}
              fill={bgColor}
              shadowColor="rgba(0,0,0,0.25)"
              shadowBlur={shadowBlur}
              perfectDrawEnabled={false}
              shadowOffset={shadowOffset}
              shadowOpacity={shadowOpacity}
              cornerRadius={cornerRadius}
              stroke={(s as any).isImportant ? '#eab308' : 'transparent'}
              strokeWidth={(s as any).isImportant ? 2.5 : 0}
            />

            {/* Paper Curling Line */}
            {cardStyle === 'paper' && (
              <Line
                points={[width - 15, height, width, height - 15]}
                stroke="rgba(0,0,0,0.1)"
                strokeWidth={1.5}
              />
            )}

            {/* Sticky Text Content */}
            <Text
              x={10}
              y={22}
              width={width - 20}
              height={height - 44}
              text={s.text}
              fontSize={s.fontSize}
              fontFamily={s.fontFamily}
              fill={getContrastingTextColor(bgColor)}
              align={s.align}
              verticalAlign="middle"
            />

            {/* Voting Mode Upvote Badge */}
            <Group 
              x={width - 42} 
              y={6}
              onClick={(e) => {
                e.cancelBubble = true;
                const nextVotes = hasVoted 
                  ? votesList.filter((id: string) => id !== 'local-user')
                  : [...votesList, 'local-user'];
                updateElement(s.id, { votes: nextVotes });
                spawnSparkles(s.x + width - 20, s.y + 15, '#3b82f6');
              }}
            >
              <Rect
                width={36}
                height={15}
                fill={hasVoted ? 'rgba(59, 130, 246, 0.9)' : 'rgba(0,0,0,0.06)'}
                cornerRadius={4}
              />
              <Text
                x={2}
                y={3}
                width={32}
                text={`▲ ${votesList.length}`}
                fontSize={8}
                fontFamily="monospace"
                fontStyle="bold"
                fill={hasVoted ? '#ffffff' : '#475569'}
                align="center"
              />
            </Group>

            {/* Important Star Badge */}
            {(s as any).isImportant && (
              <Text
                x={8}
                y={4}
                text="★"
                fontSize={12}
                fill="#eab308"
              />
            )}

            {/* Reactions Badges at bottom */}
            {reactionsList.length > 0 && (
              <Group x={6} y={height - 22}>
                {reactionsList.slice(0, 3).map(([emoji, count], index) => {
                  const rx = index * 32;
                  return (
                    <Group 
                      key={emoji} 
                      x={rx}
                      onClick={(e) => {
                        e.cancelBubble = true;
                        const nextReactions = { ...(s as any).reactions };
                        nextReactions[emoji] = Math.max(0, (nextReactions[emoji] || 0) - 1);
                        updateElement(s.id, { reactions: nextReactions });
                      }}
                    >
                      <Rect
                        width={28}
                        height={15}
                        fill="rgba(255,255,255,0.7)"
                        stroke="rgba(0,0,0,0.05)"
                        strokeWidth={1}
                        cornerRadius={4}
                      />
                      <Text
                        x={2}
                        y={3}
                        width={24}
                        text={`${emoji}${count}`}
                        fontSize={8}
                        fill="#1e293b"
                        align="center"
                      />
                    </Group>
                  );
                })}
              </Group>
            )}
          </Group>
        );
      }
      case 'connector': {
        const conn = el as any;
        const fromNode = elements.find((node) => node.id === conn.fromId);
        const toNode = elements.find((node) => node.id === conn.toId);
        if (!fromNode || !toNode) return null;

        const fromBox = {
          x: fromNode.x,
          y: fromNode.y,
          width: fromNode.width || 0,
          height: fromNode.height || 0,
        };
        const toBox = {
          x: toNode.x,
          y: toNode.y,
          width: toNode.width || 0,
          height: toNode.height || 0,
        };

        // This used to draw centre-to-centre and ignore the stored ports, so
        // every arrow cut through both shapes and its head was hidden inside
        // the target. Route edge-to-edge instead, falling back to the best
        // pair when a connector carries no ports.
        const auto = choosePorts(fromBox, toBox);
        const fromPort = (conn.fromPort as Port) || auto.fromPort;
        const toPort = (conn.toPort as Port) || auto.toPort;

        const points = routeConnector(
          fromBox,
          toBox,
          fromPort,
          toPort,
          (conn.routingStyle as RoutingStyle) || 'elbow'
        );
        const mid = routeMidpoint(points);
        const labelWidth = conn.text ? String(conn.text).length * 6.6 + 14 : 0;

        return (
          <Group
            key={key}
            id={conn.id}
            onDblClick={() =>
              beginLabelEdit(conn, { x: mid.x - 60, y: mid.y - 19, width: 120, height: 38 })
            }
          >
            <Arrow
              points={points}
              stroke={conn.stroke}
              strokeWidth={conn.strokeWidth}
              fill={conn.stroke}
              opacity={conn.opacity}
              dash={conn.strokeDash === 'dashed' ? [8, 6] : undefined}
              lineCap="round"
              lineJoin="round"
              pointerLength={9}
              pointerWidth={9}
              hitStrokeWidth={12}
            />
            {/* Edge labels were never rendered at all, so Mermaid's Yes/No
                branch labels silently vanished once applied to the board. */}
            {conn.text && (
              <>
                <Rect
                  x={mid.x - labelWidth / 2}
                  y={mid.y - 10}
                  width={labelWidth}
                  height={20}
                  fill={resolvedTheme === 'dark' ? '#18181b' : '#ffffff'}
                  cornerRadius={5}
                  opacity={0.95}
                  listening={false}
                />
                <Text
                  x={mid.x - labelWidth / 2}
                  y={mid.y - 4}
                  width={labelWidth}
                  text={conn.text}
                  fontSize={11}
                  fontFamily="sans-serif"
                  fontStyle="bold"
                  fill={resolvedTheme === 'dark' ? '#d4d4d8' : '#475569'}
                  align="center"
                  listening={false}
                />
              </>
            )}
          </Group>
        );
      }
      case 'emoji': {
        const em = el as EmojiElement;
        return (
          <Text
            key={key}
            id={em.id}
            x={em.x}
            y={em.y}
            width={em.width}
            height={em.height}
            text={em.emoji}
            fontSize={em.fontSize}
            align="center"
            verticalAlign="middle"
            opacity={em.opacity}
            rotation={em.rotation}
            draggable={isDraggable}
            onDragEnd={(e) => handleDragEnd(e, em.id)}
            onTransformEnd={(e) => handleTransformEnd(e, em)}
          />
        );
      }
      case 'image': {
        const img = el as ImageElement;
        return (
          <CanvasImageElement
            key={key}
            el={img}
            isDraggable={isDraggable}
            onDragEnd={(e: any) => handleDragEnd(e, img.id)}
            onTransformEnd={(e: any) => handleTransformEnd(e, img)}
          />
        );
      }
      case 'table': {
        const tbl = el as TableElement;
        return (
          <CanvasTableElement
            key={key}
            el={tbl}
            isDraggable={isDraggable}
            onDragEnd={(e: any) => handleDragEnd(e, tbl.id)}
            onTransformEnd={(e: any) => handleTransformEnd(e, tbl)}
          />
        );
      }
      case 'comment': {
        const cm = el as any;
        return (
          <Group
            key={key}
            id={cm.id}
            x={cm.x}
            y={cm.y}
            draggable={isDraggable}
            onDragEnd={(e) => handleDragEnd(e, cm.id)}
          >
            <Circle
              radius={16}
              fill="#3b82f6"
              shadowColor="rgba(0,0,0,0.25)"
              shadowBlur={6}
              perfectDrawEnabled={false}
              shadowOffset={{ x: 2, y: 3 }}
            />
            <Text
              x={-16}
              y={-16}
              width={32}
              height={32}
              text={cm.avatar || '💬'}
              fontSize={12}
              align="center"
              verticalAlign="middle"
              fill="#ffffff"
            />
          </Group>
        );
      }
      case 'cylinder':
      case 'database':
      case 'aws-rds':
      case 'azure-sql': {
        const shape = el as any;
        const width = shape.width || 140;
        const height = shape.height || 120;
        const fillColor = shape.fill && shape.fill !== 'transparent' ? shape.fill : '#eff6ff';
        const strokeColor = shape.stroke || '#3b82f6';

        return (
          <Group
            key={key}
            id={shape.id}
            x={shape.x}
            y={shape.y}
            width={width}
            height={height}
            rotation={shape.rotation || 0}
            opacity={shape.opacity || 1}
            draggable={isDraggable}
            onDragEnd={(e) => handleDragEnd(e, shape.id)}
            onTransformEnd={(e) => handleTransformEnd(e, shape)}
          >
            {/* 3D Cylinder Base Rect */}
            <Rect
              x={0}
              y={20}
              width={width}
              height={height - 40}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={2}
            />
            {/* Top Rim Ellipse */}
            <Ellipse
              x={width / 2}
              y={20}
              radiusX={width / 2}
              radiusY={20}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={2}
            />
            {/* Bottom Curve Ellipse */}
            <Ellipse
              x={width / 2}
              y={height - 20}
              radiusX={width / 2}
              radiusY={20}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={2}
            />
            <Text
              x={10}
              y={height / 2 - 10}
              width={width - 20}
              text={shape.text || (shape.type || 'DB').toUpperCase()}
              fontSize={12}
              fontFamily="sans-serif"
              fontStyle="bold"
              fill={strokeColor}
              align="center"
            />
          </Group>
        );
      }
      case 'cloud': {
        const shape = el as any;
        const width = shape.width || 180;
        const height = shape.height || 110;
        const fillColor = shape.fill && shape.fill !== 'transparent' ? shape.fill : '#e0f2fe';
        const strokeColor = shape.stroke || '#0284c7';

        return (
          <Group
            key={key}
            id={shape.id}
            x={shape.x}
            y={shape.y}
            width={width}
            height={height}
            rotation={shape.rotation || 0}
            opacity={shape.opacity || 1}
            draggable={isDraggable}
            onDragEnd={(e) => handleDragEnd(e, shape.id)}
            onTransformEnd={(e) => handleTransformEnd(e, shape)}
          >
            <Path
              data={`M 20 ${height - 20} 
                     A 25 25 0 0 1 40 35 
                     A 35 35 0 0 1 110 25 
                     A 30 30 0 0 1 160 50 
                     A 25 25 0 0 1 ${width - 10} ${height - 20} Z`}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={2}
              shadowColor="rgba(0, 0, 0, 0.1)"
              shadowBlur={6}
              perfectDrawEnabled={false}
            />
            <Text
              x={20}
              y={height / 2 - 5}
              width={width - 40}
              text={shape.text || 'CLOUD'}
              fontSize={11}
              fontStyle="bold"
              fill={strokeColor}
              align="center"
            />
          </Group>
        );
      }
      case 'parallelogram': {
        const shape = el as any;
        const width = shape.width || 160;
        const height = shape.height || 90;
        const fillColor = shape.fill && shape.fill !== 'transparent' ? shape.fill : '#fef3c7';
        const strokeColor = shape.stroke || '#d97706';

        return (
          <Group
            key={key}
            id={shape.id}
            x={shape.x}
            y={shape.y}
            width={width}
            height={height}
            rotation={shape.rotation || 0}
            opacity={shape.opacity || 1}
            draggable={isDraggable}
            onDragEnd={(e) => handleDragEnd(e, shape.id)}
            onTransformEnd={(e) => handleTransformEnd(e, shape)}
          >
            <Line
              points={[30, 0, width, 0, width - 30, height, 0, height]}
              closed={true}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={2}
            />
            <Text
              x={20}
              y={height / 2 - 8}
              width={width - 40}
              text={shape.text || 'PARALLELOGRAM'}
              fontSize={10}
              fontStyle="bold"
              fill={strokeColor}
              align="center"
            />
          </Group>
        );
      }
      case 'speech-bubble': {
        const shape = el as any;
        const width = shape.width || 180;
        const height = shape.height || 110;
        const fillColor = shape.fill && shape.fill !== 'transparent' ? shape.fill : '#fef08a';
        const strokeColor = shape.stroke || '#ca8a04';

        return (
          <Group
            key={key}
            id={shape.id}
            x={shape.x}
            y={shape.y}
            width={width}
            height={height}
            rotation={shape.rotation || 0}
            opacity={shape.opacity || 1}
            draggable={isDraggable}
            onDragEnd={(e) => handleDragEnd(e, shape.id)}
            onTransformEnd={(e) => handleTransformEnd(e, shape)}
          >
            <Path
              data={`M 15 0 L ${width - 15} 0 Q ${width} 0 ${width} 15 L ${width} ${height - 35} Q ${width} ${height - 20} ${width - 15} ${height - 20} L 50 ${height - 20} L 25 ${height} L 30 ${height - 20} L 15 ${height - 20} Q 0 ${height - 20} 0 ${height - 35} L 0 15 Q 0 0 15 0 Z`}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={2}
            />
            <Text
              x={15}
              y={20}
              width={width - 30}
              text={shape.text || 'Comment / Callout...'}
              fontSize={12}
              fontStyle="bold"
              fill="#713f12"
              align="center"
            />
          </Group>
        );
      }
      case 'aws-lambda':
      case 'azure-func': {
        const shape = el as any;
        const width = shape.width || 150;
        const height = shape.height || 100;

        return (
          <Group
            key={key}
            id={shape.id}
            x={shape.x}
            y={shape.y}
            width={width}
            height={height}
            rotation={shape.rotation || 0}
            opacity={shape.opacity || 1}
            draggable={isDraggable}
            onDragEnd={(e) => handleDragEnd(e, shape.id)}
            onTransformEnd={(e) => handleTransformEnd(e, shape)}
          >
            <Rect
              width={width}
              height={height}
              fill="#fff7ed"
              stroke="#ea580c"
              strokeWidth={2}
              cornerRadius={12}
              shadowColor="rgba(234, 88, 12, 0.2)"
              shadowBlur={8}
              perfectDrawEnabled={false}
            />
            <Rect x={12} y={12} width={36} height={36} fill="#ea580c" cornerRadius={8} />
            <Text x={22} y={18} text="λ" fontSize={22} fontStyle="bold" fill="#ffffff" />
            <Text x={56} y={22} text={shape.type === 'aws-lambda' ? 'AWS Lambda' : 'Azure Function'} fontSize={12} fontStyle="bold" fill="#c2410c" />
          </Group>
        );
      }
      case 'aws-ec2':
      case 'vmware-vm': {
        const shape = el as any;
        const width = shape.width || 160;
        const height = shape.height || 100;

        return (
          <Group
            key={key}
            id={shape.id}
            x={shape.x}
            y={shape.y}
            width={width}
            height={height}
            rotation={shape.rotation || 0}
            opacity={shape.opacity || 1}
            draggable={isDraggable}
            onDragEnd={(e) => handleDragEnd(e, shape.id)}
            onTransformEnd={(e) => handleTransformEnd(e, shape)}
          >
            <Rect
              width={width}
              height={height}
              fill="#eff6ff"
              stroke="#2563eb"
              strokeWidth={2}
              cornerRadius={12}
              shadowColor="rgba(37, 99, 235, 0.2)"
              shadowBlur={8}
              perfectDrawEnabled={false}
            />
            <Rect x={12} y={12} width={36} height={36} fill="#2563eb" cornerRadius={8} />
            <Text x={18} y={22} text="CPU" fontSize={11} fontStyle="bold" fill="#ffffff" />
            <Text x={56} y={22} text={shape.type === 'aws-ec2' ? 'AWS EC2' : 'VMware Virtual Machine'} fontSize={11} fontStyle="bold" fill="#1e40af" />
          </Group>
        );
      }
      case 'server':
      case 'container':
      case 'aws-s3': {
        const shape = el as any;
        const width = shape.width || 160;
        const height = shape.height || 100;

        return (
          <Group
            key={key}
            id={shape.id}
            x={shape.x}
            y={shape.y}
            width={width}
            height={height}
            rotation={shape.rotation || 0}
            opacity={shape.opacity || 1}
            draggable={isDraggable}
            onDragEnd={(e) => handleDragEnd(e, shape.id)}
            onTransformEnd={(e) => handleTransformEnd(e, shape)}
          >
            <Rect
              width={width}
              height={height}
              fill="#fef2f2"
              stroke="#ef4444"
              strokeWidth={2}
              cornerRadius={12}
              shadowColor="rgba(239, 68, 68, 0.2)"
              shadowBlur={8}
              perfectDrawEnabled={false}
            />
            <Rect x={12} y={12} width={36} height={36} fill="#ef4444" cornerRadius={8} />
            <Text x={22} y={22} text="S3" fontSize={14} fontStyle="bold" fill="#ffffff" />
            <Text x={56} y={22} text="Amazon S3 Storage" fontSize={11} fontStyle="bold" fill="#991b1b" />
          </Group>
        );
      }
      case 'embed': {
        const emb = el as any;
        return (
          <Group
            key={key}
            id={emb.id}
            x={emb.x}
            y={emb.y}
            width={emb.width || 320}
            height={emb.height || 200}
            draggable={isDraggable}
            onDragEnd={(e) => handleDragEnd(e, emb.id)}
            onTransformEnd={(e) => handleTransformEnd(e, emb)}
          >
            <Rect
              width={emb.width || 320}
              height={emb.height || 200}
              fill="#1e293b"
              stroke="#38bdf8"
              strokeWidth={2}
              cornerRadius={16}
              shadowColor="rgba(0, 0, 0, 0.2)"
              shadowBlur={12}
              perfectDrawEnabled={false}
            />
            <Text
              x={20}
              y={20}
              width={(emb.width || 320) - 40}
              text={`🎬 Embedded Media: ${emb.title || 'Web Card'}`}
              fontSize={14}
              fontStyle="bold"
              fill="#f8fafc"
            />
            <Text
              x={20}
              y={50}
              width={(emb.width || 320) - 40}
              text={emb.url || 'https://youtube.com'}
              fontSize={11}
              fill="#94a3b8"
            />
          </Group>
        );
      }
      default: {
        // Element types that predate the shape library (uml-*, ui-*, azure-*, …)
        // used to land on the plain rectangle below. Route them through the
        // manifest first so they draw as the shape their name implies.
        const legacyLibraryShape = getShapeDefForLegacyType(el.type);
        if (legacyLibraryShape) {
          return (
            <LibraryShapeNode
              key={key}
              element={el}
              shape={legacyLibraryShape}
              draggable={isDraggable}
              onDragEnd={(e) => handleDragEnd(e, el.id)}
              onTransformEnd={(e) => handleTransformEnd(e, el)}
              onDblClick={() => beginLabelEdit(el)}
            />
          );
        }

        // Universal Fallback Renderer for Any Custom Shape Element Type
        const genShape = el as any;
        const width = genShape.width || 160;
        const height = genShape.height || 100;

        return (
          <Group
            key={key}
            id={genShape.id}
            x={genShape.x || 100}
            y={genShape.y || 100}
            width={width}
            height={height}
            rotation={genShape.rotation || 0}
            opacity={genShape.opacity || 1}
            draggable={isDraggable}
            onDragEnd={(e) => handleDragEnd(e, genShape.id)}
            onTransformEnd={(e) => handleTransformEnd(e, genShape)}
          >
            <Rect
              width={width}
              height={height}
              fill={genShape.fill && genShape.fill !== 'transparent' ? genShape.fill : '#3b82f6'}
              stroke={genShape.stroke || '#1d4ed8'}
              strokeWidth={genShape.strokeWidth || 2}
              cornerRadius={10}
              shadowColor="rgba(0, 0, 0, 0.12)"
              shadowBlur={8}
              perfectDrawEnabled={false}
            />
          </Group>
        );
      }
    }
  };

  /**
   * True when anything sits inside the frame, so an empty-state prompt can step
   * aside. Uses element centres, which is forgiving of shapes that overhang the
   * frame edge slightly.
   */
  const frameHasContent = (frame: any): boolean =>
    elements.some((el) => {
      if (el.id === frame.id || el.type === 'frame' || el.type === 'connector') return false;
      const e = el as any;
      const cx = e.x + (e.width || 0) / 2;
      const cy = e.y + (e.height || 0) / 2;
      return (
        cx >= frame.x &&
        cx <= frame.x + (frame.width || 0) &&
        cy >= frame.y &&
        cy <= frame.y + (frame.height || 0)
      );
    });

  /**
   * Connection ports, the way a diagramming tool is expected to work: hover a
   * shape and four dots appear on its edges; press one and drag to another
   * shape to wire them together.
   *
   * Rendered as an overlay rather than inside LibraryShapeNode so the dots
   * always paint above neighbouring shapes and never get clipped.
   */
  const renderConnectionPorts = (el: CanvasElement) => {
    if (activeTool !== 'select' && activeTool !== 'connector') return null;
    if (el.isLocked) return null;
    if (hoveredPortShapeId !== el.id && !selectedElementIds.includes(el.id)) return null;

    // Only shapes worth connecting: library shapes and the built-in primitives.
    const isConnectable =
      Boolean(getShapeDef(el.shapeId) || getShapeDefForLegacyType(el.type)) ||
      ['rectangle', 'rounded-rectangle', 'ellipse', 'triangle', 'diamond', 'hexagon', 'star', 'sticky'].includes(el.type);
    if (!isConnectable) return null;

    const e = el as any;
    const w = e.width || 0;
    const h = e.height || 0;
    if (w < 8 || h < 8) return null;

    const ports: { side: 'top' | 'right' | 'bottom' | 'left'; x: number; y: number }[] = [
      { side: 'top', x: e.x + w / 2, y: e.y },
      { side: 'right', x: e.x + w, y: e.y + h / 2 },
      { side: 'bottom', x: e.x + w / 2, y: e.y + h },
      { side: 'left', x: e.x, y: e.y + h / 2 },
    ];

    return (
      <Group key={`ports_${el.id}`} listening>
        {ports.map((port) => (
          <Circle
            key={`${el.id}_${port.side}`}
            x={port.x}
            y={port.y}
            radius={6 / zoom}
            fill="#ffffff"
            stroke="#2563eb"
            strokeWidth={2 / zoom}
            onMouseEnter={() => {
              if (stageRef.current) stageRef.current.container().style.cursor = 'crosshair';
            }}
            onMouseLeave={() => {
              if (stageRef.current) stageRef.current.container().style.cursor = 'default';
            }}
            onPointerDown={(evt) => {
              // Keep the stage handler from starting a selection rectangle.
              evt.cancelBubble = true;
              connectorFromIdRef.current = el.id;
              connectorFromPortRef.current = port.side;
              setConnectorPreview({ fromX: port.x, fromY: port.y, toX: port.x, toY: port.y });
              setActiveTool('connector');
            }}
          />
        ))}
      </Group>
    );
  };

  const renderEraserHighlight = (el: CanvasElement) => {
    if (activeTool !== 'eraser' || hoveredEraserId !== el.id) return null;
    
    if (el.type === 'pencil' || el.type === 'line') {
      const l = el as PencilElement | LineElement;
      return (
        <Line
          points={l.points}
          stroke="#ef4444"
          strokeWidth={l.strokeWidth + 4}
          opacity={0.5}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      );
    }
    if (el.type === 'arrow' || el.type === 'connector') {
      const a = el as ArrowElement;
      return (
        <Arrow
          points={a.points}
          stroke="#ef4444"
          strokeWidth={a.strokeWidth + 4}
          fill="#ef4444"
          opacity={0.5}
          pointerLength={10}
          pointerWidth={10}
          listening={false}
        />
      );
    }
    
    return (
      <Rect
        x={el.x}
        y={el.y}
        width={el.width || 100}
        height={el.height || 100}
        stroke="#ef4444"
        strokeWidth={2 / zoom}
        dash={[4, 4]}
        listening={false}
      />
    );
  };

  return (
    <div
      ref={containerRef}
      id="canvas-container"
      style={gridStyle}
      // Accept shapes dragged out of the diagramming panel.
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/x-syncsketch-shape')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData('application/x-syncsketch-shape');
        if (!raw) return;
        e.preventDefault();

        let payload: { shapeId: string; color?: string | null };
        try {
          payload = JSON.parse(raw);
        } catch {
          return;
        }

        const def = getShapeDef(payload.shapeId);
        if (!def) return;

        // Drop point in world space, with the shape centred on the cursor.
        const rect = containerRef.current?.getBoundingClientRect();
        const worldX = (e.clientX - (rect?.left ?? 0) - pan.x) / zoom;
        const worldY = (e.clientY - (rect?.top ?? 0) - pan.y) / zoom;

        const id = Math.random().toString(36).substring(2, 9);
        addElement({
          id,
          type: 'rectangle',
          shapeId: def.id,
          text: def.labelPlacement === 'none' ? undefined : def.label,
          x: worldX - def.defaultWidth / 2,
          y: worldY - def.defaultHeight / 2,
          width: def.defaultWidth,
          height: def.defaultHeight,
          stroke: payload.color || def.defaultStroke,
          strokeWidth: 2,
          fill: def.defaultFill,
          opacity: 1,
          rotation: 0,
          isLocked: false,
          createdBy: 'local-user',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } as any);
        setSelectedElementIds([id]);
      }}
      className={`w-full h-full relative overflow-hidden transition-colors duration-200 select-none ${
        resolvedTheme === 'dark' ? `grid-${gridType}-dark` : `grid-${gridType}-light`
      }`}
    >
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        scaleX={zoom}
        scaleY={zoom}
        x={pan.x}
        y={pan.y}
        onDblClick={handleStageDblClick}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          setIsPanning(false);
          setEraserPointer(null);
          setHoveredEraserId(null);
          if (activeTool === 'eraser') {
            isDrawingRef.current = false;
            if (erasedIdsRef.current.length > 0) {
              deleteElements(erasedIdsRef.current);
              erasedIdsRef.current = [];
            }
          }
        }}
        onWheel={handleWheel}
      >
        <Layer>
          {/* 1. Render elements */}
          {elements.map((el) => renderElement(el))}

          {/* Hover Eraser outlines warning */}
          {elements.map((el) => renderEraserHighlight(el))}

          {/* Connection ports on hover / selection */}
          {elements.map((el) => renderConnectionPorts(el))}

          {/* 2. Render Selection Bounding Box */}
          {selectionRect && (
            <Rect
              x={selectionRect.x}
              y={selectionRect.y}
              width={selectionRect.w}
              height={selectionRect.h}
              fill="rgba(59, 130, 246, 0.04)"
              stroke="#3b82f6"
              strokeWidth={1}
              dash={[5, 5]}
            />
          )}

          {/* Lasso region while dragging */}
          {lassoPath && lassoPath.length >= 4 && (
            <Line
              points={lassoPath}
              stroke="#8b5cf6"
              strokeWidth={1.5 / zoom}
              dash={[6 / zoom, 4 / zoom]}
              closed
              fill="rgba(139, 92, 246, 0.08)"
              listening={false}
            />
          )}

          {/* 3. Render Connector Line Preview */}
          {connectorPreview && (
            <Arrow
              points={[connectorPreview.fromX, connectorPreview.fromY, connectorPreview.toX, connectorPreview.toY]}
              stroke="#64748b"
              strokeWidth={2}
              fill="#64748b"
              dash={[4, 4]}
              pointerLength={8}
              pointerWidth={8}
            />
          )}

          {/* 4. Render active drawing elements */}
          {activeElementState && renderElement(activeElementState)}

          {/* Fading Erased Elements exit pop */}
          {fadingElements.map((item) => {
            const scale = 1 - item.progress * 0.15;
            const opacity = 1 - item.progress;
            return (
              <Group
                key={`fade-${item.el.id}-${item.progress}`}
                x={item.el.x}
                y={item.el.y}
                scaleX={scale}
                scaleY={scale}
                opacity={opacity}
                offsetX={item.el.width ? item.el.width / 2 : 0}
                offsetY={item.el.height ? item.el.height / 2 : 0}
              >
                {renderElement({
                  ...item.el,
                  x: item.el.width ? item.el.width / 2 : 0,
                  y: item.el.height ? item.el.height / 2 : 0
                })}
              </Group>
            );
          })}

          {/* Sparkles Particle physics */}
          {particles.map((p) => (
            <Circle
              key={p.id}
              x={p.x}
              y={p.y}
              radius={p.size}
              fill={p.color}
              opacity={0.8}
              listening={false}
            />
          ))}
          {/* Eraser Cursor circle overlay */}
          {activeTool === 'eraser' && eraserPointer && (
            <Circle
              x={eraserPointer.x}
              y={eraserPointer.y}
              radius={eraserSize}
              stroke="#ef4444"
              strokeWidth={1.5 / zoom}
              dash={[4, 4]}
              listening={false}
            />
          )}
          {/* Emoji placement preview overlay */}
          {activeTool === 'emoji' && activeEmoji && emojiHoverPos && (
            <Text
              x={emojiHoverPos.x - 32}
              y={emojiHoverPos.y - 32}
              width={64}
              height={64}
              text={activeEmoji}
              fontSize={48}
              align="center"
              verticalAlign="middle"
              opacity={0.5}
              listening={false}
            />
          )}
          {/* 6. Render Remote Selections & Soft Locks */}
          {Object.values(collaborators).map((peer) => {
            if (!peer.selectedElementIds || peer.userId === localUser?.userId) return null;
            return peer.selectedElementIds.map((elementId) => {
              const el = elements.find(item => item.id === elementId);
              if (!el) return null;
              
              const isEditing = peer.editingElementId === el.id;
              
              const bounds = getElementBounds(el);
              
              return (
                <Group key={`remote-select-${peer.userId}-${el.id}`}>
                  <Rect
                    x={bounds.x}
                    y={bounds.y}
                    width={bounds.width}
                    height={bounds.height}
                    rotation={el.rotation || 0}
                    stroke={peer.presenceColor}
                    strokeWidth={isEditing ? 2 / zoom : 1.5 / zoom}
                    dash={isEditing ? undefined : [4, 4]}
                    listening={false}
                  />
                  {/* Name tag */}
                  <Group
                    x={bounds.x}
                    y={bounds.y - (18 / zoom)}
                    listening={false}
                  >
                    <Rect
                      fill={peer.presenceColor}
                      height={14 / zoom}
                      width={(peer.displayName.length * 6 + 12) / zoom}
                      cornerRadius={2 / zoom}
                    />
                    <Text
                      x={6 / zoom}
                      y={3 / zoom}
                      text={isEditing ? `🔒 ${peer.displayName} editing` : peer.displayName}
                      fontSize={8 / zoom}
                      fill="#ffffff"
                      fontStyle="bold"
                    />
                  </Group>
                </Group>
              );
            });
          })}

          {/* 5. Transformer Controls */}
          {activeTool === 'select' && (
            <Transformer
              ref={transformerRef}
              id="transformer"
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 5 || newBox.height < 5) return oldBox;
                return newBox;
              }}
              anchorStroke={(() => {
                const firstSelected = elements.find(el => el.id === selectedElementIds[0]);
                return (firstSelected?.type === 'sticky') 
                  ? (firstSelected.fill !== 'transparent' ? firstSelected.fill : '#3b82f6')
                  : '#3b82f6';
              })()}
              anchorFill="#ffffff"
              anchorSize={8}
              borderStroke={(() => {
                const firstSelected = elements.find(el => el.id === selectedElementIds[0]);
                return (firstSelected?.type === 'sticky') 
                  ? (firstSelected.fill !== 'transparent' ? firstSelected.fill : '#3b82f6')
                  : '#3b82f6';
              })()}
              borderStrokeWidth={1.5}
              keepRatio={(() => {
                const firstSelected = elements.find(el => el.id === selectedElementIds[0]);
                return firstSelected?.type === 'emoji';
              })()}
            />
          )}
        </Layer>

        {/* Ephemeral Multiplayer Cursors Layer */}
        <Layer>
          {Object.values(collaborators).map((peer) => {
            if (peer.activity === 'drawing' && peer.drawingElement) {
              return (
                <Group key={`draw-${peer.userId}`}>
                  {renderElement(peer.drawingElement)}
                </Group>
              );
            }
            return null;
          })}

          {Object.values(collaborators).map((peer) => {
            if (!peer.x && !peer.y) return null;
            return (
              <Group key={peer.userId} x={peer.x} y={peer.y}>
                {/* Subtle cursor trails */}
                {cursorTrails && peer.trailPoints && peer.trailPoints.map((pt, idx) => (
                  <Circle
                    key={idx}
                    x={pt.x - peer.x}
                    y={pt.y - peer.y}
                    radius={3 / zoom}
                    fill={peer.presenceColor}
                    opacity={pt.opacity}
                    listening={false}
                  />
                ))}
                
                {/* Cursor Pointer Arrow */}
                <Path
                  data="M0,0 L0,15 L4,11 L9,11 Z"
                  fill={peer.presenceColor}
                  stroke="white"
                  strokeWidth={1.5 / zoom}
                  scale={{ x: 1 / zoom, y: 1 / zoom }}
                  shadowColor="black"
                  shadowBlur={3}
                  perfectDrawEnabled={false}
                  shadowOffset={{ x: 1, y: 1 }}
                  shadowOpacity={0.3}
                  listening={false}
                />
                
                {/* Username label card */}
                <Group x={12 / zoom} y={12 / zoom} scale={{ x: 1 / zoom, y: 1 / zoom }}>
                  <Rect
                    fill={peer.presenceColor}
                    cornerRadius={4}
                    height={16}
                    width={peer.displayName.length * 6 + 12}
                    listening={false}
                  />
                  <Text
                    text={peer.displayName}
                    fill="white"
                    fontSize={10}
                    fontStyle="bold"
                    x={6}
                    y={3}
                    listening={false}
                  />
                  
                  {/* Activity status badge */}
                  {peer.activity && peer.activity !== 'idle' && (
                    <Group y={18}>
                      <Rect
                        fill="#1e293b"
                        cornerRadius={4}
                        height={14}
                        width={90}
                        opacity={0.8}
                        listening={false}
                      />
                      <Text
                        text={
                          peer.activity === 'drawing' ? '✏ Drawing...' :
                          peer.activity === 'typing' ? '💬 Typing...' :
                          peer.activity === 'moving' ? '↔ Moving...' :
                          peer.activity === 'presenting' ? '👁 Presenting...' : ''
                        }
                        fill="white"
                        fontSize={9}
                        x={6}
                        y={2.5}
                        listening={false}
                      />
                    </Group>
                  )}
                </Group>
              </Group>
            );
          })}
        </Layer>
      </Stage>

      {/* Confirms what the sketch was turned into, so the snap never feels
          like the drawing was simply lost. */}
      {smartDrawHint && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 px-3.5 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold shadow-lg shadow-violet-600/30 flex items-center gap-2 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-150">
          <Sparkles size={13} className="fill-current" />
          Snapped to {smartDrawHint}
        </div>
      )}

      {/* Floating Contextual Toolbar */}
      {selectedElementIds.length > 0 && activeTool === 'select' && (
        <FloatingToolbar
          selectedIds={selectedElementIds}
          elements={elements}
          pan={pan}
          zoom={zoom}
          containerEl={containerRef.current}
          onUpdateElement={updateElement}
          onDeleteElement={(id) => deleteElements([id])}
          onDuplicate={handleDuplicateSelected}
          onTriggerAI={triggerAIRequest}
          onAddConnector={handleAddConnector}
        />
      )}

      {/* HTML textarea Overlay */}
      {editingText && (
        <textarea
          value={editingText.text}
          onChange={(e) => {
            setEditingText({ ...editingText, text: e.target.value });
            setIsTyping(true);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 800);
            
            if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && Math.random() < 0.35) {
              const targetColor = editingText.type === 'sticky' 
                ? (activeFill === 'transparent' ? '#fef08a' : activeFill)
                : '#3b82f6';
              spawnSparkles(
                editingText.x + Math.random() * editingText.width,
                editingText.y + Math.random() * editingText.height,
                targetColor
              );
            }
          }}
          onBlur={() => {
            const targetColor = editingText.type === 'sticky' 
              ? (activeFill === 'transparent' ? '#fef08a' : activeFill)
              : '#3b82f6';
            spawnSparkles(editingText.x + editingText.width / 2, editingText.y + editingText.height / 2, targetColor);
            commitEditingText();
            setIsTyping(false);
          }}
          onKeyDown={handleTextKeyDown}
          className="absolute focus:outline-none p-2 resize-none shadow-floating font-sans border focus:ring-2 focus:ring-brand-500 rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-zinc-700 transition-shadow duration-200"
          style={{
            left: `${textareaScreenPos.x}px`,
            top: `${textareaScreenPos.y}px`,
            width: `${editingText.width * zoom}px`,
            height: `${editingText.height * zoom}px`,
            fontSize: `${(editingText.type === 'sticky' ? 14 : 16) * zoom}px`,
            lineHeight: 1.4,
            transformOrigin: 'top left',
            backgroundColor: editingText.type === 'sticky' ? (activeFill === 'transparent' ? '#fef08a' : activeFill) : undefined,
            color: editingText.type === 'sticky' ? getContrastingTextColor(activeFill === 'transparent' ? '#fef08a' : activeFill) : undefined,
            borderColor: editingText.type === 'sticky' ? 'transparent' : undefined,
            boxShadow: (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && isTyping && editingText.type === 'sticky')
              ? `0 0 16px 4px ${(activeFill === 'transparent' ? '#fef08a' : activeFill)}80`
              : undefined
          }}
          autoFocus
        />
      )}

      {/* Quick Create menu overlay popup */}
      {quickCreatePos && (
        <div 
          className="absolute z-50 w-44 bg-white/95 dark:bg-zinc-900/95 border border-slate-200/60 dark:border-zinc-800 shadow-2xl rounded-2xl p-2 font-sans text-xs animate-in zoom-in-95 duration-100"
          style={{
            left: `${quickCreatePos.screenX}px`,
            top: `${quickCreatePos.screenY}px`,
            transform: 'translate(-20px, 10px)'
          }}
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-850 pb-1.5 mb-1 px-1.5">
            <span className="font-bold text-slate-400 dark:text-zinc-550 uppercase tracking-wider text-[9px]">Quick Create</span>
            <button onClick={() => setQuickCreatePos(null)} className="p-0.5 hover:bg-slate-105 dark:hover:bg-zinc-800 rounded text-slate-400">
              <X size={10} />
            </button>
          </div>
          
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => {
                const elementId = Math.random().toString(36).substring(2, 9);
                const newSticky: StickyElement = {
                  id: elementId,
                  type: 'sticky',
                  x: quickCreatePos.x - 75,
                  y: quickCreatePos.y - 75,
                  width: 150,
                  height: 150,
                  rotation: 0,
                  opacity: 1,
                  stroke: 'transparent',
                  strokeWidth: 0,
                  fill: '#fef08a',
                  isLocked: false,
                  createdBy: 'local-user',
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  text: 'Double click to edit',
                  fontSize: 16,
                  fontFamily: 'sans-serif',
                  align: 'center',
                  stickyColor: '#fef08a'
                };
                addElement(newSticky);
                setSelectedElementIds([newSticky.id]);
                setQuickCreatePos(null);
                setActiveTool('select');
              }}
              className="w-full text-left py-1.5 px-2 hover:bg-slate-50 dark:hover:bg-zinc-850/60 rounded-lg text-slate-700 dark:text-zinc-300 font-medium transition-colors flex items-center gap-2"
            >
              <StickyNote size={14} className="text-amber-500" />
              <span>Sticky Note</span>
            </button>

            <button
              onClick={() => {
                const elementId = Math.random().toString(36).substring(2, 9);
                const newText: TextElement = {
                  id: elementId,
                  type: 'text',
                  x: quickCreatePos.x - 50,
                  y: quickCreatePos.y - 15,
                  width: 100,
                  height: 30,
                  rotation: 0,
                  opacity: 1,
                  stroke: 'transparent',
                  strokeWidth: 0,
                  fill: '#2563eb',
                  isLocked: false,
                  createdBy: 'local-user',
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  text: 'Type text here',
                  fontSize: 16,
                  fontFamily: 'sans-serif',
                  fontWeight: 'normal',
                  fontStyle: 'normal',
                  align: 'left'
                };
                addElement(newText);
                setSelectedElementIds([newText.id]);
                setQuickCreatePos(null);
                setActiveTool('select');
              }}
              className="w-full text-left py-1.5 px-2 hover:bg-slate-50 dark:hover:bg-zinc-850/60 rounded-lg text-slate-700 dark:text-zinc-300 font-medium transition-colors flex items-center gap-2"
            >
              <Type size={14} className="text-indigo-500" />
              <span>Text Box</span>
            </button>

            <button
              onClick={() => {
                const elementId = Math.random().toString(36).substring(2, 9);
                const newShape: RectangleElement = {
                  id: elementId,
                  type: 'rectangle',
                  x: quickCreatePos.x - 60,
                  y: quickCreatePos.y - 45,
                  width: 120,
                  height: 90,
                  rotation: 0,
                  opacity: 1,
                  stroke: '#3b82f6',
                  strokeWidth: 3,
                  fill: 'transparent',
                  isLocked: false,
                  createdBy: 'local-user',
                  createdAt: Date.now(),
                  updatedAt: Date.now()
                };
                addElement(newShape);
                setSelectedElementIds([newShape.id]);
                setQuickCreatePos(null);
                setActiveTool('select');
              }}
              className="w-full text-left py-1.5 px-2 hover:bg-slate-50 dark:hover:bg-zinc-850/60 rounded-lg text-slate-700 dark:text-zinc-300 font-medium transition-colors flex items-center gap-2"
            >
              <Square size={14} className="text-emerald-500" />
              <span>Rectangle Shape</span>
            </button>

            <button
              onClick={() => {
                const elementId = Math.random().toString(36).substring(2, 9);
                const newEmoji: EmojiElement = {
                  id: elementId,
                  type: 'emoji',
                  x: quickCreatePos.x - 32,
                  y: quickCreatePos.y - 32,
                  width: 64,
                  height: 64,
                  rotation: 0,
                  opacity: 1,
                  stroke: 'transparent',
                  strokeWidth: 0,
                  fill: 'transparent',
                  isLocked: false,
                  createdBy: 'local-user',
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  emoji: '🚀',
                  fontSize: 50
                };
                addElement(newEmoji);
                setSelectedElementIds([newEmoji.id]);
                setQuickCreatePos(null);
                setActiveTool('select');
              }}
              className="w-full text-left py-1.5 px-2 hover:bg-slate-50 dark:hover:bg-zinc-850/60 rounded-lg text-slate-700 dark:text-zinc-300 font-medium transition-colors flex items-center gap-2"
            >
              <Smile size={14} className="text-yellow-500" />
              <span>Rocket Emoji</span>
            </button>

            <button
              onClick={() => {
                const elementId = Math.random().toString(36).substring(2, 9);
                const newFrame: any = {
                  id: elementId,
                  type: 'frame',
                  title: 'New Frame',
                  x: Math.round(quickCreatePos.x - 200),
                  y: Math.round(quickCreatePos.y - 150),
                  width: 400,
                  height: 300,
                  stroke: '#94a3b8',
                  strokeWidth: 2,
                  fill: 'transparent',
                  opacity: 1,
                  rotation: 0,
                  isLocked: false,
                  createdBy: 'local-user',
                  createdAt: Date.now(),
                  updatedAt: Date.now()
                };
                addElement(newFrame);
                setSelectedElementIds([newFrame.id]);
                setQuickCreatePos(null);
                setActiveTool('select');
              }}
              className="w-full text-left py-1.5 px-2 hover:bg-slate-50 dark:hover:bg-zinc-850/60 rounded-lg text-slate-700 dark:text-zinc-300 font-medium transition-colors flex items-center gap-2"
            >
              <Frame size={14} className="text-pink-500" />
              <span>Frame Area</span>
            </button>

            <button
              onClick={() => {
                setQuickCreatePos(null);
                triggerAIRequest('explain');
              }}
              className="w-full text-left py-1.5 px-2 hover:bg-slate-50 dark:hover:bg-zinc-850/60 rounded-lg text-slate-700 dark:text-zinc-300 font-semibold transition-colors flex items-center gap-2 border-t border-slate-100 dark:border-zinc-850 mt-1 pt-1.5 text-brand-600 dark:text-brand-400"
            >
              <Sparkles size={14} className="text-brand-500 animate-pulse" />
              <span>Ask AI ✨</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 20: Diagnostic Debug overlay panel */}
      {isDevPanelOpen && (
        <div className="absolute top-20 right-4 z-40 bg-slate-900/90 dark:bg-zinc-900/95 text-white font-mono text-[10px] p-3 rounded-xl border border-slate-700/50 shadow-lg pointer-events-none flex flex-col gap-1 w-48">
          <div className="font-bold border-b border-slate-700 pb-1 mb-1 text-[11px] text-brand-400">CANVAS DEBUG INFO</div>
          <div>Tool: <span className="text-emerald-400">{activeTool}</span></div>
          <div>Pointer: {debugStats.pointerX}, {debugStats.pointerY}</div>
          <div>World: {debugStats.worldX}, {debugStats.worldY}</div>
          <div>Drawing: <span className={isDrawingRef.current ? "text-emerald-400" : "text-slate-400"}>{String(isDrawingRef.current)}</span></div>
          <div>Elements: {elements.length}</div>
          <div>Zoom: {zoom.toFixed(2)}x</div>
        </div>
      )}

      {/* Guide details */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-[10px] font-mono text-slate-400/20 dark:text-zinc-500/10">
        (0, 0)
      </div>
    </div>
  );
};
