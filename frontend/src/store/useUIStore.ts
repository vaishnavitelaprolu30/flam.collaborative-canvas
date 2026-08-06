import { create } from 'zustand';
import { ToolType } from '../types/canvas';
import { useBoardStore } from './useBoardStore';
import { API_BASE_URL } from '../config';

interface DevMetrics {
  fps: number;
  objectCount: number;
  activeUsers: number;
  eventRate: number;
}

interface UIState {
  activeTool: ToolType;
  selectedElementIds: string[];
  zoom: number;
  pan: { x: number; y: number };
  theme: 'light' | 'dark' | 'system';
  /**
   * `theme` with 'system' already resolved. Components must read this rather
   * than comparing `theme === 'dark'` — that check silently failed for every
   * user on the default 'system' setting, which is how the board ended up with
   * dark chrome around a light canvas.
   */
  resolvedTheme: 'light' | 'dark';
  isMinimapOpen: boolean;
  isShortcutsOpen: boolean;
  isShareOpen: boolean;
  boardTitle: string;
  connectionStatus: 'saved' | 'saving' | 'offline' | 'reconnecting';
  isDevPanelOpen: boolean;
  devMetrics: DevMetrics;
  activeStroke: string;
  activeFill: string;
  activeStrokeWidth: number;
  
  // Dashboard & Advanced UI States
  currentBoardId: string | null;
  isHistoryOpen: boolean;
  eraserMode: 'object' | 'stroke';
  eraserSize: number; // 8, 16, or 32
  activeStickyStyle: 'classic' | 'rounded' | 'paper';
  recentlyUsedColors: string[];

  // Presentation & Styles Mode States
  isPresentationOpen: boolean;
  setPresentationOpen: (open: boolean) => void;
  isStylesDrawerOpen: boolean;
  setStylesDrawerOpen: (open: boolean) => void;
  isSlideLayoutsModalOpen: boolean;
  setSlideLayoutsModalOpen: (open: boolean) => void;
  isDiagrammingDrawerOpen: boolean;
  setDiagrammingDrawerOpen: (open: boolean) => void;
  /** Mermaid "build with code" editor. */
  isMermaidModalOpen: boolean;
  setMermaidModalOpen: (open: boolean) => void;
  /** Personal diary panel. */
  isDiaryOpen: boolean;
  setDiaryOpen: (open: boolean) => void;
  /** Shape id armed for the next canvas draw, or null. See ToolType 'diagram-shape'. */
  pendingShapeId: string | null;
  /** Arms a shape and switches to the diagram-shape tool; null disarms. */
  setPendingShapeId: (shapeId: string | null) => void;

  // AI Canvas Understanding States
  isAIPanelOpen: boolean;
  aiOutput: string;
  aiLoading: boolean;
  activeEmoji: string | null;

  // Grid & Menu States
  gridType: 'none' | 'dot' | 'line';
  snapToGrid: boolean;
  activeExpandableMenu: 'shapes' | 'lines' | 'frames' | 'more' | 'more-tools' | 'sticky-colors' | null;
  isFavorite: boolean;

  // Modals and modes
  isTemplateModalOpen: boolean;
  isExportModalOpen: boolean;
  isCommandPaletteOpen: boolean;
  isFrameDrawerOpen: boolean;
  isPresentationMode: boolean;
  currentFrameIndex: number;

  // Actions
  setTemplateModalOpen: (isOpen: boolean) => void;
  setExportModalOpen: (isOpen: boolean) => void;
  setCommandPaletteOpen: (isOpen: boolean) => void;
  setFrameDrawerOpen: (isOpen: boolean) => void;
  setPresentationMode: (isPres: boolean) => void;
  setCurrentFrameIndex: (idx: number) => void;

  setGridType: (type: 'none' | 'dot' | 'line') => void;
  setSnapToGrid: (snap: boolean) => void;
  setActiveExpandableMenu: (menu: 'shapes' | 'lines' | 'frames' | 'more' | 'more-tools' | 'sticky-colors' | null) => void;
  setFavorite: (fav: boolean) => void;
  setActiveEmoji: (emoji: string | null) => void;
  setActiveTool: (tool: ToolType) => void;
  setSelectedElementIds: (ids: string[]) => void;
  setZoom: (zoom: number | ((prev: number) => number)) => void;
  setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  /** Recompute `resolvedTheme` and apply the `dark` class to <html>. */
  syncTheme: () => void;
  setMinimapOpen: (isOpen: boolean) => void;
  setShortcutsOpen: (isOpen: boolean) => void;
  setShareOpen: (isOpen: boolean) => void;
  setBoardTitle: (title: string) => void;
  setConnectionStatus: (status: 'saved' | 'saving' | 'offline' | 'reconnecting') => void;
  setDevPanelOpen: (isOpen: boolean) => void;
  setDevMetrics: (metrics: Partial<DevMetrics>) => void;
  setActiveStroke: (color: string) => void;
  setActiveFill: (color: string) => void;
  setActiveStrokeWidth: (width: number) => void;
  setCurrentBoardId: (id: string | null) => void;
  setHistoryOpen: (isOpen: boolean) => void;
  setEraserMode: (mode: 'object' | 'stroke') => void;
  setEraserSize: (size: number) => void;
  setActiveStickyStyle: (style: 'classic' | 'rounded' | 'paper') => void;
  addRecentlyUsedColor: (color: string) => void;
  setAIPanelOpen: (isOpen: boolean) => void;
  setAIOutput: (output: string) => void;
  setAILoading: (loading: boolean) => void;
  triggerAIRequest: (action: 'explain' | 'summarize' | 'ask', promptText?: string) => Promise<void>;
  cancelAIRequest: () => void;
  resetViewport: () => void;
  fitViewportToContent: () => void;
}

let aiAbortController: AbortController | null = null;

const THEME_STORAGE_KEY = 'syncsketch-theme';

const readStoredTheme = (): 'light' | 'dark' | 'system' => {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
};

const resolveTheme = (theme: 'light' | 'dark' | 'system'): 'light' | 'dark' => {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const useUIStore = create<UIState>((set) => ({
  activeTool: 'select',
  selectedElementIds: [],
  zoom: 1.0,
  pan: { x: 0, y: 0 },
  theme: readStoredTheme(),
  resolvedTheme: resolveTheme(readStoredTheme()),
  isPresentationOpen: false,
  setPresentationOpen: (open) => set({ isPresentationOpen: open }),
  isStylesDrawerOpen: false,
  setStylesDrawerOpen: (open) => set({ isStylesDrawerOpen: open }),
  isSlideLayoutsModalOpen: false,
  setSlideLayoutsModalOpen: (open) => set({ isSlideLayoutsModalOpen: open }),
  isDiagrammingDrawerOpen: false,
  setDiagrammingDrawerOpen: (open) => set({ isDiagrammingDrawerOpen: open }),
  isMermaidModalOpen: false,
  setMermaidModalOpen: (open) => set({ isMermaidModalOpen: open }),
  isDiaryOpen: false,
  setDiaryOpen: (open) => set({ isDiaryOpen: open }),
  pendingShapeId: null,
  setPendingShapeId: (shapeId) => {
    // Arming a shape takes over the canvas; disarming hands it back to select.
    if (shapeId) {
      set({ pendingShapeId: shapeId, activeTool: 'diagram-shape', selectedElementIds: [] });
    } else {
      set({ pendingShapeId: null, activeTool: 'select' });
    }
  },
  isMinimapOpen: true,
  isShortcutsOpen: false,
  isShareOpen: false,
  boardTitle: 'Untitled Board',
  connectionStatus: 'saved',
  isDevPanelOpen: false,
  devMetrics: {
    fps: 60,
    objectCount: 0,
    activeUsers: 1,
    eventRate: 0,
  },
  activeStroke: '#3b82f6',
  activeFill: 'transparent',
  activeStrokeWidth: 3,

  // Default advanced states
  currentBoardId: null,
  isHistoryOpen: false,
  eraserMode: 'object',
  eraserSize: 16,
  activeStickyStyle: 'classic',
  recentlyUsedColors: ['#fef08a', '#fbcfe8', '#bfdbfe'],
  isAIPanelOpen: false,
  aiOutput: '',
  aiLoading: false,
  activeEmoji: null,

  // Grid & Menu States
  gridType: (localStorage.getItem('syncsketch-grid-type') as any) || 'dot',
  snapToGrid: localStorage.getItem('syncsketch-snap-grid') === 'true',
  activeExpandableMenu: null,
  isFavorite: false,

  // Modal and mode initializers
  isTemplateModalOpen: false,
  isExportModalOpen: false,
  isCommandPaletteOpen: false,
  isFrameDrawerOpen: false,
  isPresentationMode: false,
  currentFrameIndex: 0,

  setTemplateModalOpen: (isTemplateModalOpen) => set({ isTemplateModalOpen }),
  setExportModalOpen: (isExportModalOpen) => set({ isExportModalOpen }),
  setCommandPaletteOpen: (isCommandPaletteOpen) => set({ isCommandPaletteOpen }),
  setFrameDrawerOpen: (isFrameDrawerOpen) => set({ isFrameDrawerOpen }),
  setPresentationMode: (isPresentationMode) => set({ isPresentationMode }),
  setCurrentFrameIndex: (currentFrameIndex) => set({ currentFrameIndex }),

  setGridType: (gridType) => {
    localStorage.setItem('syncsketch-grid-type', gridType);
    set({ gridType });
  },
  setSnapToGrid: (snapToGrid) => {
    localStorage.setItem('syncsketch-snap-grid', snapToGrid ? 'true' : 'false');
    set({ snapToGrid });
  },
  setActiveExpandableMenu: (menu) => set({ activeExpandableMenu: menu }),
  setFavorite: (fav) => set({ isFavorite: fav }),
  setActiveEmoji: (emoji) => set({ activeEmoji: emoji }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setSelectedElementIds: (ids) => set({ selectedElementIds: ids }),
  setZoom: (zoom) =>
    set((state) => ({
      zoom: typeof zoom === 'function' ? zoom(state.zoom) : zoom,
    })),
  setPan: (pan) =>
    set((state) => ({
      pan: typeof pan === 'function' ? pan(state.pan) : pan,
    })),
  setTheme: (theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    const resolved = resolveTheme(theme);
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    set({ theme, resolvedTheme: resolved });
  },
  syncTheme: () => {
    const resolved = resolveTheme(useUIStore.getState().theme);
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    set({ resolvedTheme: resolved });
  },
  setMinimapOpen: (isMinimapOpen) => set({ isMinimapOpen }),
  setShortcutsOpen: (isShortcutsOpen) => set({ isShortcutsOpen }),
  setShareOpen: (isShareOpen) => set({ isShareOpen }),
  setBoardTitle: (boardTitle) => set({ boardTitle }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setDevPanelOpen: (isDevPanelOpen) => set({ isDevPanelOpen }),
  setDevMetrics: (metrics) =>
    set((state) => ({
      devMetrics: { ...state.devMetrics, ...metrics },
    })),
  setActiveStroke: (activeStroke) => set({ activeStroke }),
  setActiveFill: (activeFill) => set({ activeFill }),
  setActiveStrokeWidth: (activeStrokeWidth) => set({ activeStrokeWidth }),
  setCurrentBoardId: (currentBoardId) => set({ currentBoardId }),
  setHistoryOpen: (isHistoryOpen) => set({ isHistoryOpen }),
  setEraserMode: (eraserMode) => set({ eraserMode }),
  setEraserSize: (eraserSize) => set({ eraserSize }),
  setActiveStickyStyle: (activeStickyStyle) => set({ activeStickyStyle }),
  addRecentlyUsedColor: (color) =>
    set((state) => {
      if (color === 'transparent' || state.recentlyUsedColors.includes(color)) return {};
      // Cap list to last 5 colors
      const newColors = [color, ...state.recentlyUsedColors.slice(0, 4)];
      return { recentlyUsedColors: newColors };
    }),
  setAIPanelOpen: (isAIPanelOpen) => set({ isAIPanelOpen }),
  setAIOutput: (aiOutput) => set({ aiOutput }),
  setAILoading: (aiLoading) => set({ aiLoading }),
  triggerAIRequest: async (action, promptText) => {
    const { selectedElementIds, boardTitle } = useUIStore.getState();
    const elements = useBoardStore.getState().elements;

    set({ aiLoading: true, isAIPanelOpen: true, isHistoryOpen: false, aiOutput: '' });

    if (aiAbortController) {
      aiAbortController.abort();
    }
    aiAbortController = new AbortController();

    try {
      const selectedElements = elements.filter(el => selectedElementIds.includes(el.id));
      const connectors = elements.filter(el => el.type === 'connector') as any[];
      
      const serializedElements = selectedElements.map(el => {
        const serialized: any = {
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
            role: conn.fromId === el.id ? 'from' : 'to'
          }));
        }
        return serialized;
      });

      const context = {
        boardTitle,
        selectedElements: serializedElements
      };

      const response = await fetch(`${API_BASE_URL}/api/ai/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, context, prompt: promptText }),
        signal: aiAbortController.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        set({ aiOutput: `⚠️ **AI Request failed**: ${errorText}` });
      } else {
        const data = await response.json();
        set({ aiOutput: data.result });
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        set({ aiOutput: `⚠️ **Connection Error**: ${err.message}` });
      }
    } finally {
      set({ aiLoading: false });
    }
  },
  cancelAIRequest: () => {
    if (aiAbortController) {
      aiAbortController.abort();
      aiAbortController = null;
    }
    set({ aiOutput: '✨ AI request cancelled by user.', aiLoading: false });
  },
  resetViewport: () => set({ zoom: 1.0, pan: { x: 0, y: 0 } }),

  /**
   * Frame everything on the board in the viewport.
   *
   * Opening a board used to land at world origin (0, 0), which showed an empty
   * canvas whenever the content happened to live elsewhere. Called after
   * `loadBoard` resolves; an empty board falls back to origin at 100%.
   */
  fitViewportToContent: () => {
    const elements = useBoardStore.getState().elements;
    if (elements.length === 0) {
      set({ zoom: 1.0, pan: { x: 0, y: 0 } });
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    elements.forEach((el) => {
      const e = el as any;
      const x = e.x ?? 0;
      const y = e.y ?? 0;

      // Freehand strokes, lines and arrows carry their extent in `points`
      // rather than width/height, so measure those explicitly.
      if (Array.isArray(e.points) && e.points.length >= 2) {
        for (let i = 0; i < e.points.length; i += 2) {
          minX = Math.min(minX, x + e.points[i]);
          maxX = Math.max(maxX, x + e.points[i]);
          minY = Math.min(minY, y + e.points[i + 1]);
          maxY = Math.max(maxY, y + e.points[i + 1]);
        }
        return;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + (e.width || 0));
      maxY = Math.max(maxY, y + (e.height || 0));
    });

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      set({ zoom: 1.0, pan: { x: 0, y: 0 } });
      return;
    }

    const padding = 120;
    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);
    // Leave room for the top bar and the left tool rail.
    const viewportWidth = Math.max(200, window.innerWidth - padding * 2);
    const viewportHeight = Math.max(200, window.innerHeight - padding * 2);

    // Never zoom past 100% — filling the screen with one sticky note is worse
    // than showing it at natural size.
    const nextZoom = Math.min(viewportWidth / contentWidth, viewportHeight / contentHeight, 1);
    const clampedZoom = Math.max(0.1, nextZoom);

    set({
      zoom: clampedZoom,
      pan: {
        x: window.innerWidth / 2 - (minX + contentWidth / 2) * clampedZoom,
        y: window.innerHeight / 2 - (minY + contentHeight / 2) * clampedZoom,
      },
    });
  },
}));
