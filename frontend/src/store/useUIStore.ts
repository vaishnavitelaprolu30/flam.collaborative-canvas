import { create } from 'zustand';
import { ToolType } from '../types/canvas';
import { useBoardStore } from './useBoardStore';

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

  // Actions
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
}

let aiAbortController: AbortController | null = null;

export const useUIStore = create<UIState>((set) => ({
  activeTool: 'select',
  selectedElementIds: [],
  zoom: 1.0,
  pan: { x: 0, y: 0 },
  theme: 'system',
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
  setTheme: (theme) => set({ theme }),
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

      const response = await fetch('http://localhost:4000/api/ai/analyze', {
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
}));
