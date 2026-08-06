import { useEffect } from 'react';
import { useUIStore } from '../store/useUIStore';

export const useKeyboard = (isSpacePressedRef: React.MutableRefObject<boolean>) => {
  const {
    activeTool,
    setActiveTool,
    setZoom,
    resetViewport,
    setSelectedElementIds,
    setShortcutsOpen,
    isDiagrammingDrawerOpen,
    setDiagrammingDrawerOpen,
    isDiaryOpen,
    setDiaryOpen
  } = useUIStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts when editing text fields
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      // Check spacebar (Pan trigger)
      if (e.code === 'Space' && !e.repeat) {
        isSpacePressedRef.current = true;
        // Adjust cursor style on canvas container if exists
        const canvasContainer = document.getElementById('canvas-container');
        if (canvasContainer) {
          canvasContainer.style.cursor = 'grab';
        }
        e.preventDefault();
        return;
      }

      // Single-key tool selectors
      switch (e.key.toLowerCase()) {
        case 'v':
          setActiveTool('select');
          break;
        case 'h':
          setActiveTool('hand');
          break;
        case 'p':
          setActiveTool('pencil');
          break;
        case 'r':
          setActiveTool('rectangle');
          break;
        case 'o':
          setActiveTool('ellipse');
          break;
        case 'l':
          setActiveTool('line');
          break;
        case 'a':
          setActiveTool('arrow');
          break;
        case 't':
          setActiveTool('text');
          break;
        case 's':
          setActiveTool('sticky');
          break;
        case 'c':
          setActiveTool('connector');
          break;
        case 'j':
          setActiveTool('emoji');
          break;
        case 'e':
          setActiveTool('eraser');
          break;
        case 'd': // Diagramming shape library
          setDiagrammingDrawerOpen(!isDiagrammingDrawerOpen);
          break;
        case 'y': // Personal diary
          setDiaryOpen(!isDiaryOpen);
          break;
        case '=': // Zoom In
        case '+':
          setZoom((z) => Math.min(10, z + 0.1));
          break;
        case '-': // Zoom Out
          setZoom((z) => Math.max(0.1, z - 0.1));
          break;
        case '0':
          if (e.metaKey || e.ctrlKey) {
            resetViewport();
            e.preventDefault();
          }
          break;
        case '?':
          setShortcutsOpen(true);
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        const canvasContainer = document.getElementById('canvas-container');
        if (canvasContainer) {
          // Reset cursor based on current tool
          canvasContainer.style.cursor = activeTool === 'hand' ? 'grab' : 'default';
        }
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeTool, setActiveTool, setZoom, resetViewport, setSelectedElementIds, setShortcutsOpen, isDiagrammingDrawerOpen, setDiagrammingDrawerOpen, isDiaryOpen, setDiaryOpen, isSpacePressedRef]);
};
