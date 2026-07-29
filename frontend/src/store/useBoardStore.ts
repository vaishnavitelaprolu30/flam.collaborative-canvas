import { create } from 'zustand';
import { CanvasElement } from '../types/canvas';
import { useUIStore } from './useUIStore';
import { API_BASE_URL } from '../config';

// Simple helper to connect socket client
export let socketInstance: any = null;
export const setSocketForStore = (socket: any) => {
  socketInstance = socket;
};

interface BoardState {
  elements: CanvasElement[];
  history: CanvasElement[][];
  historyIndex: number;
  
  // Actions
  addElement: (element: CanvasElement, skipBroadcast?: boolean) => void;
  updateElement: (id: string, updates: Partial<CanvasElement>, skipBroadcast?: boolean) => void;
  deleteElement: (id: string, skipBroadcast?: boolean) => void;
  deleteElements: (ids: string[], skipBroadcast?: boolean) => void;
  setElements: (elements: CanvasElement[], skipHistory?: boolean) => void;
  clearBoard: () => void;
  
  // History Actions
  undo: () => void;
  redo: () => void;
  
  // REST API Actions
  loadBoard: (boardId: string) => Promise<void>;
  saveBoard: (boardId: string) => Promise<boolean>;
  triggerAutosave: (boardId: string) => void;
}

let saveTimeout: NodeJS.Timeout | null = null;

export const useBoardStore = create<BoardState>((set, get) => ({
  elements: [],
  history: [[]],
  historyIndex: 0,

  addElement: (element, skipBroadcast = false) => {
    set((state) => {
      const nextElements = [...state.elements, element];
      const nextHistory = state.history.slice(0, state.historyIndex + 1);
      
      // Realtime websocket sync
      if (!skipBroadcast && socketInstance) {
        const boardId = useUIStore.getState().currentBoardId;
        if (boardId) {
          socketInstance.emit('element-sync', {
            boardId,
            type: 'create',
            element
          });
        }
      }

      return {
        elements: nextElements,
        history: [...nextHistory, nextElements],
        historyIndex: nextHistory.length
      };
    });
    
    // Trigger Autosave
    const boardId = useUIStore.getState().currentBoardId;
    if (boardId) get().triggerAutosave(boardId);
  },

  updateElement: (id, updates, skipBroadcast = false) => {
    set((state) => {
      const nextElements = state.elements.map((el) =>
        el.id === id ? ({ ...el, ...updates, updatedAt: Date.now() } as CanvasElement) : el
      );
      
      // Prevent pushing duplicate history on continuous drags (dragEnd / transformEnd trigger this)
      const nextHistory = state.history.slice(0, state.historyIndex + 1);
      
      // Realtime websocket sync
      if (!skipBroadcast && socketInstance) {
        const boardId = useUIStore.getState().currentBoardId;
        const updatedNode = nextElements.find(el => el.id === id);
        if (boardId && updatedNode) {
          socketInstance.emit('element-sync', {
            boardId,
            type: 'update',
            element: updatedNode
          });
        }
      }

      return {
        elements: nextElements,
        history: [...nextHistory, nextElements],
        historyIndex: nextHistory.length
      };
    });

    const boardId = useUIStore.getState().currentBoardId;
    if (boardId) get().triggerAutosave(boardId);
  },

  deleteElement: (id, skipBroadcast = false) => {
    set((state) => {
      const nextElements = state.elements.filter((el) => el.id !== id);
      const nextHistory = state.history.slice(0, state.historyIndex + 1);

      // Realtime websocket sync
      if (!skipBroadcast && socketInstance) {
        const boardId = useUIStore.getState().currentBoardId;
        if (boardId) {
          socketInstance.emit('element-sync', {
            boardId,
            type: 'delete',
            elementId: id
          });
        }
      }

      return {
        elements: nextElements,
        history: [...nextHistory, nextElements],
        historyIndex: nextHistory.length
      };
    });

    const boardId = useUIStore.getState().currentBoardId;
    if (boardId) get().triggerAutosave(boardId);
  },

  deleteElements: (ids, skipBroadcast = false) => {
    if (ids.length === 0) return;
    set((state) => {
      const nextElements = state.elements.filter((el) => !ids.includes(el.id));
      const nextHistory = state.history.slice(0, state.historyIndex + 1);

      // Realtime websocket sync
      if (!skipBroadcast && socketInstance) {
        const boardId = useUIStore.getState().currentBoardId;
        if (boardId) {
          ids.forEach(id => {
            socketInstance.emit('element-sync', {
              boardId,
              type: 'delete',
              elementId: id
            });
          });
        }
      }

      return {
        elements: nextElements,
        history: [...nextHistory, nextElements],
        historyIndex: nextHistory.length
      };
    });

    const boardId = useUIStore.getState().currentBoardId;
    if (boardId) get().triggerAutosave(boardId);
  },

  setElements: (elements, skipHistory = false) => {
    set((state) => {
      if (skipHistory) {
        return { elements };
      }
      const nextHistory = state.history.slice(0, state.historyIndex + 1);
      return {
        elements,
        history: [...nextHistory, elements],
        historyIndex: nextHistory.length
      };
    });
  },

  clearBoard: () => {
    set((state) => {
      const nextHistory = state.history.slice(0, state.historyIndex + 1);
      return {
        elements: [],
        history: [...nextHistory, []],
        historyIndex: nextHistory.length
      };
    });
  },

  undo: () => {
    set((state) => {
      if (state.historyIndex > 0) {
        const nextIndex = state.historyIndex - 1;
        const nextElements = state.history[nextIndex];
        
        // Sync full board to other clients on undo/redo changes
        if (socketInstance) {
          const boardId = useUIStore.getState().currentBoardId;
          if (boardId) {
            socketInstance.emit('board-restored', { boardId, elements: nextElements });
          }
        }

        return {
          historyIndex: nextIndex,
          elements: nextElements
        };
      }
      return {};
    });

    const boardId = useUIStore.getState().currentBoardId;
    if (boardId) get().triggerAutosave(boardId);
  },

  redo: () => {
    set((state) => {
      if (state.historyIndex < state.history.length - 1) {
        const nextIndex = state.historyIndex + 1;
        const nextElements = state.history[nextIndex];
        
        if (socketInstance) {
          const boardId = useUIStore.getState().currentBoardId;
          if (boardId) {
            socketInstance.emit('board-restored', { boardId, elements: nextElements });
          }
        }

        return {
          historyIndex: nextIndex,
          elements: nextElements
        };
      }
      return {};
    });

    const boardId = useUIStore.getState().currentBoardId;
    if (boardId) get().triggerAutosave(boardId);
  },

  loadBoard: async (boardId: string) => {
    const { setConnectionStatus, setBoardTitle, setFavorite } = useUIStore.getState();
    setConnectionStatus('saving');
    try {
      const response = await fetch(`${API_BASE_URL}/api/boards/${boardId}`);
      if (!response.ok) throw new Error('Fetch failed');
      const data = await response.json();
      setBoardTitle(data.title || 'Untitled Board');
      setFavorite(data.favorite === 1);
      set({
        elements: data.elements || [],
        history: [data.elements || []],
        historyIndex: 0
      });
      setConnectionStatus('saved');
    } catch (err) {
      console.error('Fetch board failed:', err);
      setConnectionStatus('offline');
    }
  },

  saveBoard: async (boardId: string) => {
    const { setConnectionStatus, boardTitle, isFavorite } = useUIStore.getState();
    setConnectionStatus('saving');
    try {
      const { elements } = get();
      const response = await fetch(`${API_BASE_URL}/api/boards/${boardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: boardTitle,
          favorite: isFavorite ? 1 : 0,
          elements
        })
      });
      if (!response.ok) throw new Error('Save failed');
      setConnectionStatus('saved');
      return true;
    } catch (err) {
      console.error('Manual save failed:', err);
      setConnectionStatus('offline');
      return false;
    }
  },

  triggerAutosave: (boardId: string) => {
    if (saveTimeout) clearTimeout(saveTimeout);
    
    const { setConnectionStatus } = useUIStore.getState();
    setConnectionStatus('saving');
    
    saveTimeout = setTimeout(async () => {
      try {
        const { elements } = get();
        const { boardTitle, isFavorite } = useUIStore.getState();
        
        const response = await fetch(`${API_BASE_URL}/api/boards/${boardId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: boardTitle,
            favorite: isFavorite ? 1 : 0,
            elements
          })
        });
        
        if (!response.ok) throw new Error('Autosave failed');
        setConnectionStatus('saved');
      } catch (err) {
        console.error('Autosave server sync failed:', err);
        setConnectionStatus('offline');
      }
    }, 1500);
  }
}));
