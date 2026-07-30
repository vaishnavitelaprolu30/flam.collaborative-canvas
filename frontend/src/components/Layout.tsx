import React, { useState, useEffect } from 'react';
import { 
  MousePointer, Hand, Pencil, Square, Minus, 
  Type, StickyNote, Eraser, Share2, Undo2, Redo2, HelpCircle, Smile,
  Sun, Moon, Plus, Maximize, Map, X, Copy, 
  Trash2, Layers, BringToFront, SendToBack,
  ChevronDown, Cpu, Clock, Folder, ArrowLeft, Sparkles,
  Star, FileText, Check, Loader2, Settings, Frame
} from 'lucide-react';
import { useUIStore } from '../store/useUIStore';
import { useBoardStore } from '../store/useBoardStore';
import { usePresenceStore } from '../store/usePresenceStore';
import { EmojiPicker } from './EmojiPicker';
import { ToolType, CanvasElement, TextElement } from '../types/canvas';
import { API_BASE_URL } from '../config';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileToolbarOpen, setMobileToolbarOpen] = useState(false);
  const {
    activeTool, setActiveTool,
    selectedElementIds, setSelectedElementIds,
    zoom, setZoom,
    theme, setTheme,
    isMinimapOpen, setMinimapOpen,
    isShortcutsOpen, setShortcutsOpen,
    isShareOpen, setShareOpen,
    boardTitle, setBoardTitle,
    connectionStatus,
    isDevPanelOpen, setDevPanelOpen,
    devMetrics,
    resetViewport,
    activeStroke, setActiveStroke,
    activeFill, setActiveFill,
    activeStrokeWidth, setActiveStrokeWidth,
    recentlyUsedColors, addRecentlyUsedColor,
    eraserMode, setEraserMode,
    eraserSize, setEraserSize,
    isHistoryOpen, setHistoryOpen,
    setPan, pan,
    isAIPanelOpen, setAIPanelOpen,
    aiOutput,
    aiLoading,
    triggerAIRequest, cancelAIRequest,
    currentBoardId, setCurrentBoardId,
    activeEmoji, setActiveEmoji,
    gridType, setGridType,
    snapToGrid, setSnapToGrid,
    isFavorite, setFavorite,
    activeExpandableMenu, setActiveExpandableMenu
  } = useUIStore();

  const { 
    localUser, 
    collaborators, 
    followingUserId, 
    setFollowingUserId
  } = usePresenceStore();

  const {
    elements,
    addElement,
    updateElement,
    deleteElement,
    setElements,
    undo,
    redo,
    loadBoard,
    saveBoard
  } = useBoardStore();

  const [originalElements, setOriginalElements] = useState<CanvasElement[] | null>(null);
  const [isStickyColorOpen, setIsStickyColorOpen] = useState(false);
  const [activeAvatarMenuId, setActiveAvatarMenuId] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');

  const handleCreateFrame = (presetName: string, w: number, h: number) => {
    const center = {
      x: (window.innerWidth / 2 - pan.x) / zoom - w / 2,
      y: (window.innerHeight / 2 - pan.y) / zoom - h / 2
    };

    const newFrame: any = {
      id: Math.random().toString(36).substring(2, 9),
      type: 'frame',
      title: `${presetName}`,
      x: Math.round(center.x),
      y: Math.round(center.y),
      width: w,
      height: h,
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
    setActiveExpandableMenu(null);
    setActiveTool('select');
  };

  // Follow User Viewport Sync Effect
  useEffect(() => {
    if (!followingUserId) return;
    const peer = collaborators[followingUserId];
    if (!peer) {
      setFollowingUserId(null);
      return;
    }
    setPan({
      x: -peer.x * zoom + window.innerWidth / 2,
      y: -peer.y * zoom + window.innerHeight / 2
    });
  }, [followingUserId, collaborators, zoom, setPan, setFollowingUserId]);

  const handleAIRequest = (action: 'explain' | 'summarize' | 'ask', promptText?: string) => {
    triggerAIRequest(action, promptText);
  };

  const handleCancelAI = () => {
    cancelAIRequest();
  };

  const handleColorHoverEnter = (color: string) => {
    if (selectedElementIds.length === 0) return;
    if (!originalElements) {
      setOriginalElements(elements);
    }
    setElements(elements.map(el => 
      selectedElementIds.includes(el.id) 
        ? { ...el, fill: color, stickyColor: color } as any 
        : el
    ), true);
  };

  const handleColorHoverLeave = () => {
    if (originalElements) {
      setElements(originalElements, true);
      setOriginalElements(null);
    }
  };

  const handleColorCommit = (color: string) => {
    setOriginalElements(null);
    selectedElementIds.forEach(id => {
      updateElement(id, { fill: color, stickyColor: color });
    });
    addRecentlyUsedColor(color);
  };

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(boardTitle);

  // Sync title changes
  useEffect(() => {
    setTitleInput(boardTitle);
  }, [boardTitle]);

  const handleTitleSave = () => {
    setIsEditingTitle(false);
    if (titleInput.trim()) {
      setBoardTitle(titleInput.trim());
      if (currentBoardId) {
        useBoardStore.getState().triggerAutosave(currentBoardId);
      }
    } else {
      setTitleInput(boardTitle);
    }
  };

  // 1. Keyboard Shortcut Cmd/Ctrl + S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (currentBoardId) {
          saveBoard(currentBoardId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentBoardId, saveBoard]);

  // 2. Version History states
  const [versions, setVersions] = useState<any[]>([]);
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);
  const [previewVersionName, setPreviewVersionName] = useState<string>('');

  const fetchVersions = async () => {
    if (!currentBoardId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/boards/${currentBoardId}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isHistoryOpen) {
      fetchVersions();
    }
  }, [isHistoryOpen, currentBoardId]);

  const handleCreateVersion = async () => {
    if (!currentBoardId) return;
    const name = prompt('Enter a name for this checkpoint:');
    if (!name || !name.trim()) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/boards/${currentBoardId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          elements,
          isAutosave: false
        })
      });
      if (response.ok) {
        fetchVersions();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePreviewVersion = async (version: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/boards/${currentBoardId}/versions/${version.id}`);
      if (res.ok) {
        const data = await res.json();
        setPreviewVersionId(version.id);
        setPreviewVersionName(version.name || new Date(version.created_at).toLocaleString());
        setElements(data.elements || [], true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExitPreview = async () => {
    setPreviewVersionId(null);
    setPreviewVersionName('');
    if (currentBoardId) {
      await loadBoard(currentBoardId);
    }
  };

  const handleRestoreVersion = async () => {
    if (!currentBoardId || !previewVersionId) return;
    if (!confirm('Restore this version? Your current board state will be saved in history before restoring.')) return;
    
    try {
      await fetch(`${API_BASE_URL}/api/boards/${currentBoardId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Safety Backup (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
          elements,
          isAutosave: false
        })
      });

      await fetch(`${API_BASE_URL}/api/boards/${currentBoardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elements
        })
      });

      setPreviewVersionId(null);
      setPreviewVersionName('');
      await loadBoard(currentBoardId);
      alert('Version restored successfully!');
    } catch (err) {
      console.error(err);
    }
  };

  // Theme Syncing
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // System
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      if (systemTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [theme]);

  // Active presence collaborators list (Local user first)
  const allCollaborators = [
    { 
      name: `${localUser.displayName} (You)`, 
      initial: localUser.avatar, 
      color: localUser.presenceColor,
      isLocal: true,
      userId: localUser.userId,
      activity: 'idle' as const,
      lastActive: Date.now()
    },
    ...Object.values(collaborators).map(p => ({
      name: p.displayName,
      initial: p.avatar,
      color: p.presenceColor,
      isLocal: false,
      userId: p.userId,
      activity: p.activity,
      lastActive: p.lastActive
    }))
  ];

  const tools: { type: ToolType; label: string; icon: React.ReactNode; shortcut: string }[] = [
    { type: 'select', label: 'Select', icon: <MousePointer size={18} />, shortcut: 'V' },
    { type: 'hand', label: 'Hand / Pan', icon: <Hand size={18} />, shortcut: 'H' },
    { type: 'sticky', label: 'Sticky Note', icon: <StickyNote size={18} />, shortcut: 'S' },
    { type: 'text', label: 'Text', icon: <Type size={18} />, shortcut: 'T' },
    { type: 'rectangle', label: 'Shapes', icon: <Square size={18} />, shortcut: 'R' },
    { type: 'line', label: 'Lines / Pen', icon: <Pencil size={18} />, shortcut: 'P' },
    { type: 'frame', label: 'Frame', icon: <Frame size={18} />, shortcut: 'F' },
    { type: 'emoji', label: 'Emoji', icon: <Smile size={18} />, shortcut: 'J' },
    { type: 'connector', label: 'Connector', icon: <ChevronDown size={18} className="-rotate-90" />, shortcut: 'C' },
    { type: 'eraser', label: 'Eraser', icon: <Eraser size={18} />, shortcut: 'E' },
  ];



  const parseInlineMarkdown = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-slate-900 dark:text-zinc-100">{part.slice(2, -2)}</strong>;
      }
      const subparts = part.split(/(`.*?`)/g);
      return subparts.map((subpart, j) => {
        if (subpart.startsWith('`') && subpart.endsWith('`')) {
          return <code key={j} className="px-1 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-mono text-[10px] text-pink-600 dark:text-pink-400">{subpart.slice(1, -1)}</code>;
        }
        return subpart;
      });
    });
  };

  const renderMarkdown = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return <h3 key={idx} className="text-sm font-bold text-slate-800 dark:text-zinc-200 mt-4 mb-2">{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('#### ')) {
        return <h4 key={idx} className="text-xs font-bold text-slate-700 dark:text-zinc-300 mt-3 mb-1.5">{line.replace('#### ', '')}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={idx} className="text-base font-bold text-slate-900 dark:text-zinc-100 mt-5 mb-2.5 border-b border-slate-150 dark:border-zinc-800 pb-1">{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('# ')) {
        return <h1 key={idx} className="text-lg font-bold text-brand-600 dark:text-brand-400 mt-6 mb-3">{line.replace('# ', '')}</h1>;
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <li key={idx} className="ml-4 list-disc text-xs text-slate-600 dark:text-zinc-350 py-0.5 leading-relaxed">
            {parseInlineMarkdown(line.substring(2))}
          </li>
        );
      }
      const numMatch = line.match(/^(\d+)\.\s(.*)/);
      if (numMatch) {
        return (
          <li key={idx} className="ml-4 list-decimal text-xs text-slate-600 dark:text-zinc-350 py-0.5 leading-relaxed">
            {parseInlineMarkdown(numMatch[2])}
          </li>
        );
      }
      if (line.startsWith('⚠️')) {
        return (
          <div key={idx} className="my-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <span>{line}</span>
          </div>
        );
      }
      if (line.trim() === '') {
        return <div key={idx} className="h-2" />;
      }
      return <p key={idx} className="text-xs text-slate-600 dark:text-zinc-350 py-0.5 leading-relaxed">{parseInlineMarkdown(line)}</p>;
    });
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-lightbg-canvas dark:bg-darkbg-canvas text-slate-800 dark:text-slate-100 flex flex-col">
      {/* Historical Version Preview Banner */}
      {previewVersionId && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-amber-500 text-white rounded-2xl p-3 px-6 flex items-center gap-6 shadow-xl select-none font-sans text-xs">
          <span className="font-bold">Viewing historical checkpoint: {previewVersionName}</span>
          <div className="flex gap-2">
            <button
              onClick={handleRestoreVersion}
              className="bg-white hover:bg-slate-50 text-amber-700 font-bold p-1 px-3 rounded-lg shadow transition-colors"
            >
              Restore this version
            </button>
            <button
              onClick={handleExitPreview}
              className="bg-amber-600/50 hover:bg-amber-700/60 text-white font-bold p-1 px-3 rounded-lg transition-colors"
            >
              Return to current
            </button>
          </div>
        </div>
      )}

      {/* Lock Interaction Cover Overlay */}
      {previewVersionId && (
        <div className="absolute inset-0 z-20 cursor-not-allowed bg-transparent" title="Editing is disabled while previewing checkpoints"></div>
      )}

      {/* Follow Indicator Banner */}
      {followingUserId && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-brand-500 text-white rounded-2xl p-2.5 px-5 flex items-center gap-4 shadow-xl select-none font-sans text-xs animate-bounce">
          <span className="font-bold">Following {collaborators[followingUserId]?.displayName || 'Collaborator'}</span>
          <button
            onClick={() => setFollowingUserId(null)}
            className="bg-white/25 hover:bg-white/35 text-white font-bold p-1 px-3 rounded-lg text-[10px] transition-colors"
          >
            Stop Following
          </button>
        </div>
      )}

      {/* Version History sidebar */}
      {isHistoryOpen && (
        <aside className="absolute right-4 top-1/2 -translate-y-1/2 z-35 w-64 floating-panel rounded-2xl p-4 flex flex-col gap-4 select-none max-h-[80vh] overflow-y-auto font-sans border border-slate-200 dark:border-zinc-800">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/60 pb-2">
            <div className="flex items-center gap-1.5">
              <Clock size={16} className="text-slate-400 dark:text-zinc-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Version History</h2>
            </div>
            <button onClick={() => setHistoryOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X size={16} />
            </button>
          </div>

          <button
            onClick={handleCreateVersion}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl text-xs font-bold transition-all shadow-sm border border-slate-200/40 dark:border-zinc-750"
          >
            <Plus size={14} />
            <span>Create Checkpoint</span>
          </button>

          <div className="flex flex-col gap-2 overflow-y-auto pr-1">
            {versions.length === 0 ? (
              <div className="text-center text-[10px] text-slate-450 dark:text-zinc-550 py-6">
                No checkpoints taken yet
              </div>
            ) : (
              versions.map((ver) => (
                <button
                  key={ver.id}
                  onClick={() => handlePreviewVersion(ver)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all flex flex-col gap-1 ${
                    previewVersionId === ver.id
                      ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 text-amber-900 dark:text-amber-200 shadow-sm'
                      : 'bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-855 border-slate-200/50 dark:border-zinc-800/80 text-slate-750 dark:text-zinc-300'
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-bold text-xs truncate max-w-[120px]">{ver.name || 'Checkpoint'}</span>
                    <span className="text-[9px] px-1.5 rounded-md font-bold bg-slate-200/60 dark:bg-zinc-800 text-slate-500">
                      {ver.is_autosave ? 'Auto' : 'User'}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-400 dark:text-zinc-500">
                    {new Date(ver.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>
      )}
            {/* 1. TOP BAR */}
      <header className="absolute top-4 left-4 right-4 z-30 h-14 flex items-center justify-between floating-panel rounded-2xl px-4 select-none">
        {/* Left: Logo & Board Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentBoardId(null)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800/80 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors flex items-center justify-center gap-1"
            title="Back to My Boards"
          >
            <ArrowLeft size={16} />
            <Folder size={16} />
          </button>
          
          <div className="h-6 w-px bg-slate-200 dark:bg-zinc-800"></div>
          
          {/* Logo */}
          <span className="hidden sm:inline-block font-extrabold text-xs tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-indigo-500 select-none">
            SYNCSKETCH
          </span>
          
          <FileText size={16} className="text-slate-400 dark:text-zinc-650" />
          
          {isEditingTitle ? (
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
              className="px-2 py-1 text-sm bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-slate-100 font-medium"
              autoFocus
            />
          ) : (
            <h1 
              onClick={() => setIsEditingTitle(true)}
              className="px-2 py-1 text-sm font-medium hover:bg-slate-100 dark:hover:bg-zinc-800/60 rounded-md cursor-pointer transition-colors max-w-[150px] sm:max-w-xs truncate"
              title="Click to rename"
            >
              {boardTitle}
            </h1>
          )}

          {/* Favorite Star */}
          <button
            onClick={() => {
              const nextFav = !isFavorite;
              setFavorite(nextFav);
              if (currentBoardId) {
                useBoardStore.getState().triggerAutosave(currentBoardId);
              }
            }}
            className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800/80 rounded-lg text-slate-400 hover:text-amber-500 transition-colors"
            title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
          >
            <Star size={16} className={isFavorite ? "fill-amber-400 text-amber-400" : ""} />
          </button>
        </div>

        {/* Center: Quick Undo/Redo & Zoom Indicator */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button 
            onClick={undo}
            className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800/80 rounded-xl text-slate-600 dark:text-zinc-300 disabled:opacity-30 transition-colors"
            title="Undo (Cmd+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button 
            onClick={redo}
            className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800/80 rounded-xl text-slate-600 dark:text-zinc-300 disabled:opacity-30 transition-colors"
            title="Redo (Cmd+Shift+Z)"
          >
            <Redo2 size={16} />
          </button>
          <div className="h-4 w-px bg-slate-200 dark:bg-zinc-800"></div>
          
          {/* Zoom controls */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setZoom((z) => Math.max(0.1, z - 0.1))}
              className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              title="Zoom Out"
            >
              <Minus size={13} />
            </button>
            <span 
              onClick={() => resetViewport()}
              className="text-xs font-semibold px-2 py-1 bg-slate-100 dark:bg-zinc-800/60 rounded-lg text-slate-600 dark:text-zinc-400 cursor-pointer hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors"
              title="Click to reset view (100%)"
            >
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(10, z + 0.1))}
              className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              title="Zoom In"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>

        {/* Right: Status, Avatars, Actions */}
        <div className="flex items-center gap-3">
          {/* Saved Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-2 py-1 bg-slate-50 dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800 rounded-lg">
            {connectionStatus === 'saved' ? (
              <>
                <Check size={12} className="text-emerald-500" />
                <span className="text-[10px] font-medium text-slate-500 dark:text-zinc-400">Saved</span>
              </>
            ) : connectionStatus === 'saving' ? (
              <>
                <Loader2 size={12} className="animate-spin text-amber-500" />
                <span className="text-[10px] font-medium text-slate-500 dark:text-zinc-400">Saving</span>
              </>
            ) : connectionStatus === 'reconnecting' ? (
              <>
                <Loader2 size={12} className="animate-spin text-amber-500" />
                <span className="text-[10px] font-medium text-amber-500">Reconnecting</span>
              </>
            ) : (
              <>
                <X size={12} className="text-rose-500" />
                <span className="text-[10px] font-medium text-rose-500">Offline</span>
              </>
            )}
          </div>

          {/* Avatars */}
          <div className="hidden sm:flex items-center -space-x-1.5 relative">
            {allCollaborators.map((user, idx) => (
              <div key={user.userId || idx} className="relative z-10">
                <button 
                  onClick={() => !user.isLocal && setActiveAvatarMenuId(activeAvatarMenuId === user.userId ? null : user.userId)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm cursor-pointer border border-white dark:border-zinc-900 transition-transform hover:scale-105"
                  style={{ backgroundColor: user.color }}
                  title={user.name}
                >
                  {user.initial}
                  <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white dark:border-zinc-900 ${
                    (user.isLocal || Date.now() - user.lastActive < 20000) ? 'bg-emerald-500' : 'bg-amber-400'
                  }`} />
                </button>

                {/* Collaborator drop menu popover */}
                {!user.isLocal && activeAvatarMenuId === user.userId && (
                  <div className="absolute top-9 right-0 z-45 w-44 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 flex flex-col gap-2.5 shadow-xl animate-in fade-in zoom-in-95 duration-100 font-sans text-xs">
                    <div className="font-bold text-slate-800 dark:text-zinc-200 truncate">{user.name}</div>
                    <div className="text-[10px] text-slate-450 dark:text-zinc-550 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>Online</span>
                    </div>

                    <div className="flex flex-col gap-1 border-t border-slate-100 dark:border-zinc-800/85 pt-2">
                      <button
                        onClick={() => {
                          const peer = collaborators[user.userId];
                          if (peer) {
                            setPan({
                              x: -peer.x * zoom + window.innerWidth / 2,
                              y: -peer.y * zoom + window.innerHeight / 2
                            });
                          }
                          setActiveAvatarMenuId(null);
                        }}
                        className="w-full text-left py-1.5 px-2 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg font-medium text-slate-700 dark:text-zinc-300 transition-colors"
                      >
                        Find on Board
                      </button>
                      <button
                        onClick={() => {
                          setFollowingUserId(followingUserId === user.userId ? null : user.userId);
                          setActiveAvatarMenuId(null);
                        }}
                        className={`w-full text-left py-1.5 px-2 rounded-lg font-semibold transition-colors ${
                          followingUserId === user.userId
                            ? 'bg-amber-500 text-white hover:bg-amber-600'
                            : 'hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-750 dark:text-zinc-350'
                        }`}
                      >
                        {followingUserId === user.userId ? 'Stop Following' : 'Follow User'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-zinc-800 hidden sm:block"></div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            {/* Ask AI button */}
            <button 
              onClick={() => {
                setAIPanelOpen(!isAIPanelOpen);
                setHistoryOpen(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm hover:shadow transition-all ${
                isAIPanelOpen
                  ? 'bg-brand-600 text-white hover:bg-brand-700'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-770 dark:text-zinc-300'
              }`}
              title="Ask AI (Cmd+K)"
            >
              <Sparkles size={13} className="text-brand-500 animate-pulse" />
              <span className="hidden lg:inline">Ask AI</span>
            </button>

            {/* Share button */}
            <button 
              onClick={() => setShareOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow transition-all"
              title="Share Board with Collaborators"
            >
              <Share2 size={13} />
              <span className="hidden md:inline">Share</span>
            </button>

            {/* Version History toggle */}
            <button
              onClick={() => setHistoryOpen(!isHistoryOpen)}
              className={`p-2 rounded-xl transition-colors ${
                isHistoryOpen 
                  ? 'bg-brand-50 text-brand-600 dark:bg-brand-950/20 dark:text-brand-400' 
                  : 'hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Version History Timeline"
            >
              <Clock size={16} />
            </button>

            {/* View Grid Settings Popover */}
            <div className="relative">
              <button
                onClick={() => {
                  setActiveExpandableMenu(activeExpandableMenu === 'more' ? null : 'more');
                }}
                className={`p-2 rounded-xl transition-colors ${
                  activeExpandableMenu === 'more'
                    ? 'bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-slate-200'
                    : 'hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-slate-550 hover:text-slate-850 dark:hover:text-slate-200'
                }`}
                title="Grid & Workspace Settings"
              >
                <Settings size={16} />
              </button>

              {activeExpandableMenu === 'more' && (
                <div className="absolute right-0 top-11 z-45 w-52 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 flex flex-col gap-2.5 shadow-xl animate-in fade-in zoom-in-95 duration-100 font-sans text-xs">
                  <div className="font-bold text-slate-800 dark:text-zinc-200 border-b border-slate-100 dark:border-zinc-800 pb-1.5">View Settings</div>
                  
                  {/* Grid selector */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-550 uppercase tracking-wider">Canvas Grid</span>
                    <div className="grid grid-cols-3 gap-1">
                      {(['none', 'dot', 'line'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setGridType(type)}
                          className={`py-1 text-[10px] font-semibold capitalize rounded-lg border transition-colors ${
                            gridType === type
                              ? 'bg-slate-100 border-slate-300 dark:bg-zinc-800 dark:border-zinc-700 text-slate-900 dark:text-zinc-100'
                              : 'border-transparent text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-850'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="flex flex-col gap-2 pt-1 border-t border-slate-100 dark:border-zinc-850">
                    {/* Snap to Grid */}
                    <label className="flex items-center justify-between cursor-pointer py-0.5">
                      <span className="text-slate-700 dark:text-zinc-300 font-medium">Snap to Grid</span>
                      <input 
                        type="checkbox"
                        checked={snapToGrid}
                        onChange={(e) => setSnapToGrid(e.target.checked)}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-3.5 h-3.5"
                      />
                    </label>

                    {/* Developer Metrics Panel */}
                    <label className="flex items-center justify-between cursor-pointer py-0.5">
                      <span className="text-slate-700 dark:text-zinc-300 font-medium">Dev Metrics Panel</span>
                      <input 
                        type="checkbox"
                        checked={isDevPanelOpen}
                        onChange={(e) => setDevPanelOpen(e.target.checked)}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-3.5 h-3.5"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800/80 rounded-xl text-slate-600 dark:text-zinc-300 transition-colors"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Help Shortcuts toggle */}
            <button 
              onClick={() => setShortcutsOpen(true)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800/80 rounded-xl text-slate-600 dark:text-zinc-300 transition-colors"
              title="Keyboard Shortcuts Help (?)"
            >
              <HelpCircle size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* 2. LEFT FLOATING TOOLBAR */}
      <div className={`fixed inset-y-0 left-0 z-40 flex items-center select-none transform transition-transform ${mobileToolbarOpen ? 'translate-x-0' : '-translate-x-full'} sm:relative sm:translate-x-0 sm:transform-none`}>
        <nav className="flex flex-col gap-1.5 p-1.5 floating-panel rounded-2xl relative max-h-[80vh] overflow-y-auto sm:max-h-[80vh] sm:overflow-y-auto">
          {tools.map((t) => {
            const isActive = 
              (t.type === activeTool) ||
              (t.type === 'rectangle' && ['rectangle', 'rounded-rectangle', 'ellipse', 'triangle', 'diamond', 'hexagon', 'star'].includes(activeTool)) ||
              (t.type === 'line' && ['pencil', 'line', 'arrow'].includes(activeTool));
            
            return (
              <button
                key={t.type}
                onClick={() => {
                  setSelectedElementIds([]);
                  if (t.type === 'emoji') {
                    if (activeTool === 'emoji') {
                      setActiveEmoji(null);
                      setActiveExpandableMenu(null);
                    } else {
                      setActiveTool('emoji');
                      setActiveExpandableMenu(null);
                    }
                  } else if (t.type === 'rectangle') {
                    setActiveTool('rectangle');
                    setActiveExpandableMenu(activeExpandableMenu === 'shapes' ? null : 'shapes');
                  } else if (t.type === 'line') {
                    setActiveTool('pencil');
                    setActiveExpandableMenu(activeExpandableMenu === 'lines' ? null : 'lines');
                  } else if (t.type === 'frame') {
                    setActiveTool('select');
                    setActiveExpandableMenu(activeExpandableMenu === 'frames' ? null : 'frames');
                  } else if (t.type === 'sticky') {
                    setActiveTool('sticky');
                    setActiveExpandableMenu(activeExpandableMenu === 'sticky-colors' ? null : 'sticky-colors');
                  } else {
                    setActiveTool(t.type);
                    setActiveExpandableMenu(null);
                  }
                }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 relative group ${
                  isActive 
                    ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20' 
                    : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80'
                }`}
                title={`${t.label} (${t.shortcut})`}
              >
                {t.icon}
                {/* Premium Tooltip */}
                <div className="absolute left-14 hidden group-hover:flex items-center pointer-events-none z-45">
                  <div className="bg-slate-900/90 dark:bg-zinc-900/95 text-white text-[10px] font-medium px-2 py-1 rounded shadow-md whitespace-nowrap backdrop-blur-sm border border-slate-800/30">
                    {t.label} <span className="ml-1 text-slate-400 font-bold">{t.shortcut}</span>
                  </div>
                </div>
              </button>
            );
          })}
          
          {/* More (+) button */}
          <button
            onClick={() => setActiveExpandableMenu(activeExpandableMenu === 'more-tools' ? null : 'more-tools')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 relative group ${
              activeExpandableMenu === 'more-tools'
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20' 
                : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80'
            }`}
            title="More Tools"
          >
            <Plus size={18} />
          </button>
        </nav>

        {/* 2A. Shapes Submenu */}
        {activeExpandableMenu === 'shapes' && (
          <div className="ml-3 flex flex-col gap-1 p-2 bg-white/95 dark:bg-zinc-900/95 border border-slate-200 dark:border-zinc-800 shadow-xl rounded-2xl animate-in slide-in-from-left-2 duration-100 w-36 font-sans">
            <div className="text-[9px] font-bold text-slate-400 dark:text-zinc-550 uppercase tracking-wider px-2 py-0.5 border-b border-slate-100 dark:border-zinc-850 pb-1">Select Shape</div>
            {[
              { type: 'rectangle', label: 'Rectangle' },
              { type: 'rounded-rectangle', label: 'Rounded Rect' },
              { type: 'ellipse', label: 'Ellipse' },
              { type: 'triangle', label: 'Triangle' },
              { type: 'diamond', label: 'Diamond' },
              { type: 'hexagon', label: 'Hexagon' },
              { type: 'star', label: 'Star' }
            ].map((shape) => (
              <button
                key={shape.type}
                onClick={() => {
                  setActiveTool(shape.type as any);
                  setActiveExpandableMenu(null);
                  setSelectedElementIds([]);
                }}
                className={`w-full text-left py-1.5 px-2 rounded-lg font-medium text-xs transition-colors ${
                  activeTool === shape.type
                    ? 'bg-slate-100 dark:bg-zinc-800 text-brand-600 dark:text-brand-400 font-semibold'
                    : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-855/60'
                }`}
              >
                {shape.label}
              </button>
            ))}
          </div>
        )}

        {/* 2B. Lines Submenu */}
        {activeExpandableMenu === 'lines' && (
          <div className="ml-3 flex flex-col gap-1 p-2 bg-white/95 dark:bg-zinc-900/95 border border-slate-200 dark:border-zinc-800 shadow-xl rounded-2xl animate-in slide-in-from-left-2 duration-100 w-36 font-sans">
            <div className="text-[9px] font-bold text-slate-400 dark:text-zinc-550 uppercase tracking-wider px-2 py-0.5 border-b border-slate-100 dark:border-zinc-850 pb-1">Select Line</div>
            {[
              { type: 'pencil', label: 'Pen (Freehand)' },
              { type: 'line', label: 'Straight Line' },
              { type: 'arrow', label: 'Arrow' }
            ].map((line) => (
              <button
                key={line.type}
                onClick={() => {
                  setActiveTool(line.type as any);
                  setActiveExpandableMenu(null);
                  setSelectedElementIds([]);
                }}
                className={`w-full text-left py-1.5 px-2 rounded-lg font-medium text-xs transition-colors ${
                  activeTool === line.type
                    ? 'bg-slate-100 dark:bg-zinc-800 text-brand-600 dark:text-brand-400 font-semibold'
                    : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-855/60'
                }`}
              >
                {line.label}
              </button>
            ))}
          </div>
        )}

        {/* 2C. Frames Preset Submenu */}
        {activeExpandableMenu === 'frames' && (
          <div className="ml-3 flex flex-col gap-1 p-2 bg-white/95 dark:bg-zinc-900/95 border border-slate-200 dark:border-zinc-800 shadow-xl rounded-2xl animate-in slide-in-from-left-2 duration-100 w-44 font-sans max-h-80 overflow-y-auto scrollbar-thin">
            <div className="text-[9px] font-bold text-slate-400 dark:text-zinc-550 uppercase tracking-wider px-2 py-0.5 border-b border-slate-100 dark:border-zinc-855 pb-1">Preset Frames</div>
            {[
              { name: 'A4 Page', w: 800, h: 1130 },
              { name: 'Letter Page', w: 850, h: 1100 },
              { name: 'Slide (16:9)', w: 1200, h: 675 },
              { name: 'Square (1:1)', w: 600, h: 600 },
              { name: 'Mobile Screen', w: 390, h: 844 },
              { name: 'Tablet Screen', w: 768, h: 1024 },
              { name: 'Custom Frame', w: 800, h: 600 }
            ].map((frame) => (
              <button
                key={frame.name}
                onClick={() => handleCreateFrame(frame.name, frame.w, frame.h)}
                className="w-full text-left py-1.5 px-2 hover:bg-slate-50 dark:hover:bg-zinc-855/60 rounded-lg text-slate-700 dark:text-zinc-300 text-xs transition-colors flex items-center justify-between"
              >
                <span>{frame.name}</span>
                <span className="text-[9px] text-slate-400">{frame.w}×{frame.h}</span>
              </button>
            ))}
          </div>
        )}

        {/* 2D. Sticky Color Palette */}
        {activeExpandableMenu === 'sticky-colors' && (
          <div className="ml-3 flex flex-col gap-3.5 p-3 bg-white/98 dark:bg-zinc-900/98 border border-slate-200 dark:border-zinc-850 shadow-xl rounded-2xl animate-in slide-in-from-left-2 duration-100 w-48 font-sans">
            <div className="text-[9px] font-bold text-slate-400 dark:text-zinc-550 uppercase tracking-wider pb-1 border-b border-slate-100 dark:border-zinc-850">Sticky Note Color</div>
            
            <div className="grid grid-cols-4 gap-2">
              {[
                { hex: '#fef08a', name: 'Yellow' },
                { hex: '#fbcfe8', name: 'Pink' },
                { hex: '#bfdbfe', name: 'Blue' },
                { hex: '#bbf7d0', name: 'Green' },
                { hex: '#fed7aa', name: 'Orange' },
                { hex: '#ddd6fe', name: 'Purple' },
                { hex: '#c5e1a5', name: 'Lime' },
                { hex: '#80deea', name: 'Cyan' },
                { hex: '#ffe082', name: 'Amber' },
                { hex: '#ffab91', name: 'Peach' },
                { hex: '#f48fb1', name: 'Rose' },
                { hex: '#ce93d8', name: 'Plum' },
                { hex: '#b2dfdb', name: 'Teal' },
                { hex: '#e6ee9c', name: 'Sage' },
                { hex: '#cfd8dc', name: 'Slate' },
                { hex: '#ffffff', name: 'White' }
              ].map((color) => (
                <button
                  key={color.hex}
                  onClick={() => {
                    setActiveFill(color.hex);
                    setActiveTool('sticky');
                    setActiveExpandableMenu(null);
                  }}
                  className={`w-7 h-7 rounded-full border border-slate-200 dark:border-zinc-800 transition-transform hover:scale-110 shadow-sm`}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                />
              ))}
            </div>
            
            <button
              onClick={() => {
                setActiveExpandableMenu(null);
                setAIPanelOpen(true);
                useUIStore.getState().setAIOutput('✨ Please describe what topic you would like to generate sticky ideas for in the prompt below!');
              }}
              className="w-full py-1.5 bg-gradient-to-r from-brand-500 to-indigo-500 text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
            >
              <Sparkles size={11} />
              <span>Generate Ideas</span>
            </button>
          </div>
        )}

        {/* 2E. More Tools searchable Panel */}
        {activeExpandableMenu === 'more-tools' && (
          <div className="ml-3 flex flex-col gap-3 p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl rounded-2xl animate-in slide-in-from-left-2 duration-150 w-72 h-[400px] font-sans">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
              <span className="font-bold text-slate-800 dark:text-zinc-205 text-sm">More Tools</span>
              <button onClick={() => setActiveExpandableMenu(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-400">
                <X size={14} />
              </button>
            </div>

            <input 
              type="text"
              placeholder="Search tools..."
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-750 rounded-lg focus:outline-none focus:ring-1.5 focus:ring-brand-500 text-xs text-slate-855 dark:text-zinc-200"
            />

            <div className="flex gap-1 border-b border-slate-100 dark:border-zinc-800/80 pb-1 text-[11px] font-semibold">
              <span className="px-2 py-0.5 text-brand-600 border-b border-brand-500 cursor-pointer">Tools</span>
              <span className="px-2 py-0.5 text-slate-400 cursor-pointer hover:text-slate-600">Workspace</span>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5 scrollbar-thin">
              {[
                { title: 'Diagram', desc: 'Create flowcharts & diagrams' },
                { title: 'Table', desc: 'Organize data in structural grid' },
                { title: 'Timeline', desc: 'Plan projects & events' },
                { title: 'Kanban', desc: 'Track tasks using board stages' },
                { title: 'Document', desc: 'Write structured notes & writeups' },
                { title: 'Slides', desc: 'Design slide presentations' }
              ].map((item) => (
                <div key={item.title} className="p-2 border border-slate-100 dark:border-zinc-850 hover:bg-slate-50 dark:hover:bg-zinc-850/60 rounded-xl cursor-pointer transition-colors flex flex-col">
                  <span className="font-semibold text-xs text-slate-850 dark:text-zinc-200">{item.title}</span>
                  <span className="text-[10px] text-slate-450 dark:text-zinc-550">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {activeTool === 'emoji' && !activeEmoji && (
        <div className="absolute left-16 top-1/2 -translate-y-1/2 z-30">
          <EmojiPicker 
            onSelectEmoji={(emoji) => setActiveEmoji(emoji)}
            onClose={() => {
              setActiveTool('select');
              setActiveEmoji(null);
            }}
          />
        </div>
      )}

      {/* 3. RIGHT CONTEXT PANEL */}
      {(() => {
        const hasSelection = selectedElementIds.length > 0;
        const drawTools = ['pencil', 'rectangle', 'ellipse', 'line', 'arrow', 'text', 'sticky'];
        const showPanel = hasSelection || drawTools.includes(activeTool);

        if (!showPanel) return null;

        const firstSelected = hasSelection ? elements.find(el => el.id === selectedElementIds[0]) : null;
        
        // Active Styles resolution
        const currentStroke = firstSelected?.stroke || activeStroke;
        const currentFill = firstSelected
          ? (firstSelected.type === 'sticky' ? (firstSelected.fill === 'transparent' ? '#fef08a' : firstSelected.fill) : firstSelected.fill)
          : (activeTool === 'sticky' ? (activeFill === 'transparent' ? '#fef08a' : activeFill) : activeFill);
        const currentStrokeWidth = firstSelected?.strokeWidth || activeStrokeWidth;
        const currentOpacity = firstSelected ? Math.round((firstSelected.opacity || 1) * 100) : 100;
        
        const isPencilOrLine = firstSelected 
          ? ['pencil', 'line', 'arrow'].includes(firstSelected.type)
          : ['pencil', 'line', 'arrow'].includes(activeTool);

        const isTextEl = firstSelected 
          ? firstSelected.type === 'text'
          : activeTool === 'text';

        const textElement = firstSelected as TextElement | null;
        const currentFontSize = textElement?.fontSize || 16;
        const currentAlign = textElement?.align || 'left';

        const hasStickySelected = hasSelection && elements.some(el => selectedElementIds.includes(el.id) && el.type === 'sticky');
        const isStickyMode = (firstSelected?.type === 'sticky') || (activeTool === 'sticky');

        // Color Palettes
        const palette = isStickyMode ? [
          { name: 'Yellow', value: '#fef08a' },
          { name: 'Pink', value: '#fbcfe8' },
          { name: 'Blue', value: '#bfdbfe' },
          { name: 'Green', value: '#bbf7d0' },
          { name: 'Purple', value: '#e9d5ff' },
          { name: 'Orange', value: '#fed7aa' }
        ] : [
          { name: 'Transparent', value: 'transparent' },
          { name: 'White', value: '#ffffff' },
          { name: 'Gray', value: '#64748b' },
          { name: 'Black', value: '#0f172a' },
          { name: 'Red', value: '#ef4444' },
          { name: 'Orange', value: '#f97316' },
          { name: 'Yellow', value: '#facc15' },
          { name: 'Green', value: '#22c55e' },
          { name: 'Blue', value: '#3b82f6' },
          { name: 'Purple', value: '#a855f7' },
          { name: 'Pink', value: '#ec4899' }
        ];

        const handleStrokeChange = (color: string) => {
          setActiveStroke(color);
          if (hasSelection) {
            selectedElementIds.forEach(id => {
              updateElement(id, { stroke: color });
            });
          }
        };

        const handleFillChange = (color: string) => {
          setActiveFill(color);
          if (hasSelection) {
            selectedElementIds.forEach(id => {
              const el = elements.find(item => item.id === id);
              if (el && el.type !== 'pencil') {
                updateElement(id, { fill: color });
              }
            });
          }
        };

        const handleStrokeWidthChange = (width: number) => {
          setActiveStrokeWidth(width);
          if (hasSelection) {
            selectedElementIds.forEach(id => {
              updateElement(id, { strokeWidth: width });
            });
          }
        };

        const handleOpacityChange = (opacity: number) => {
          if (hasSelection) {
            selectedElementIds.forEach(id => {
              updateElement(id, { opacity: opacity / 100 });
            });
          }
        };

        const handleFontSizeChange = (size: number) => {
          if (hasSelection) {
            selectedElementIds.forEach(id => {
              const el = elements.find(item => item.id === id);
              if (el && el.type === 'text') {
                updateElement(id, { fontSize: size });
              }
            });
          }
        };

        const handleAlignChange = (align: 'left' | 'center' | 'right') => {
          if (hasSelection) {
            selectedElementIds.forEach(id => {
              const el = elements.find(item => item.id === id);
              if (el && (el.type === 'text' || el.type === 'sticky')) {
                updateElement(id, { align });
              }
            });
          }
        };

        const handleDeleteSelected = () => {
          selectedElementIds.forEach(id => deleteElement(id));
          setSelectedElementIds([]);
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
                x: el.x + 30, // Offset duplicate
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

        // Z-Index layer ordering manipulations
        const handleLayerOrder = (action: 'front' | 'forward' | 'backward' | 'back') => {
          if (!hasSelection) return;
          const currentId = selectedElementIds[0];
          const index = elements.findIndex(el => el.id === currentId);
          if (index === -1) return;

          const updatedElements = [...elements];
          const [removed] = updatedElements.splice(index, 1);

          switch (action) {
            case 'front':
              updatedElements.push(removed);
              break;
            case 'back':
              updatedElements.unshift(removed);
              break;
            case 'forward': {
              const targetIdx = Math.min(elements.length - 1, index + 1);
              updatedElements.splice(targetIdx, 0, removed);
              break;
            }
            case 'backward': {
              const targetIdx = Math.max(0, index - 1);
              updatedElements.splice(targetIdx, 0, removed);
              break;
            }
          }
          setElements(updatedElements);
        };

        return (
          <aside className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-64 floating-panel rounded-2xl p-4 flex flex-col gap-4 select-none max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/60 pb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {hasSelection ? 'Element Properties' : 'Tool Styling'}
              </h2>
              {hasSelection && (
                <span className="text-[10px] bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono text-slate-500">
                  {selectedElementIds.length} selected
                </span>
              )}
            </div>

            <div className="flex flex-col gap-4 text-xs">
              {/* STROKE COLOR SELECTOR */}
              <div className="flex flex-col gap-1.5">
                <span className="font-semibold text-slate-500">Stroke Color</span>
                <div className="grid grid-cols-6 gap-1">
                  {palette.map((c) => {
                    if (c.value === 'transparent') return null; // Stroke cannot be transparent
                    const isSelected = currentStroke === c.value;
                    return (
                      <button
                        key={`stroke-${c.value}`}
                        onClick={() => handleStrokeChange(c.value)}
                        className={`w-6 h-6 rounded-full border shadow-sm transition-all hover:scale-110 flex items-center justify-center`}
                        style={{ backgroundColor: c.value, borderColor: isSelected ? '#3b82f6' : 'transparent' }}
                        title={c.name}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white mix-blend-difference"></span>}
                      </button>
                    );
                  })}
                  {/* Custom Hex Stroke Input */}
                  <label className="w-6 h-6 rounded-full border border-slate-300 dark:border-zinc-700 cursor-pointer flex items-center justify-center bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100" title="Custom color">
                    <span className="text-[9px] font-bold text-slate-500">#</span>
                    <input 
                      type="color" 
                      value={currentStroke.startsWith('#') ? currentStroke : '#3b82f6'} 
                      onChange={(e) => handleStrokeChange(e.target.value)}
                      className="hidden" 
                    />
                  </label>
                </div>
              </div>

              {/* FILL COLOR SELECTOR / STICKY COLOR PICKER */}
              {!isPencilOrLine && (
                <div className="flex flex-col gap-1.5 relative">
                  <span className="font-semibold text-slate-500">
                    {hasStickySelected ? 'Sticky Background' : 'Fill Color'}
                  </span>
                  
                  {hasStickySelected ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setIsStickyColorOpen(!isStickyColorOpen)}
                          className="w-12 h-7 rounded-lg border border-slate-300 dark:border-zinc-700 shadow-sm flex items-center justify-center hover:scale-105 transition-all text-[10px] font-bold bg-white dark:bg-zinc-850"
                          style={{ backgroundColor: currentFill === 'transparent' ? '#fef08a' : currentFill }}
                        >
                          Select
                        </button>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {currentFill === 'transparent' ? '#FEF08A' : currentFill.toUpperCase()}
                        </span>
                      </div>

                      {/* STICKY PASTEL POPOVER MENU */}
                      {isStickyColorOpen && (
                        <div className="absolute right-0 top-8 z-50 border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl p-3 shadow-xl flex flex-col gap-2 w-52 select-none animate-in fade-in slide-in-from-top-1 duration-150">
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-700/60 pb-1">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Pastel Colors</span>
                            <button onClick={() => setIsStickyColorOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                              <X size={12} />
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-6 gap-1">
                            {[
                              // Yellow / Oranges
                              '#fef08a', '#fef9c3', '#facc15', '#fed7aa', '#ffedd5', '#fca5a5',
                              // Pinks / Magentas
                              '#fbcfe8', '#fecdd3', '#ffe4e6', '#f472b6', '#e9d5ff', '#d8b4fe',
                              // Blues / Cyans
                              '#bae6fd', '#bfdbfe', '#a5f3fc', '#99f6e4', '#a7f3d0', '#bbf7d0',
                              // Greens / Neutrals
                              '#d1fae5', '#bef264', '#fef3c7', '#fafaf9', '#e2e8f0', '#cbd5e1'
                            ].map((color) => {
                              const isSel = currentFill === color;
                              return (
                                <button
                                  key={color}
                                  onMouseEnter={() => handleColorHoverEnter(color)}
                                  onMouseLeave={handleColorHoverLeave}
                                  onClick={() => {
                                    handleColorCommit(color);
                                    setIsStickyColorOpen(false);
                                  }}
                                  className="w-5 h-5 rounded-full border border-slate-200 dark:border-zinc-750 shadow-sm transition-transform hover:scale-110 flex items-center justify-center"
                                  style={{ backgroundColor: color }}
                                >
                                  {isSel && <span className="w-1.5 h-1.5 rounded-full bg-slate-800 mix-blend-difference"></span>}
                                </button>
                              );
                            })}
                          </div>

                          {/* RECENTLY USED */}
                          {recentlyUsedColors.length > 0 && (
                            <div className="flex flex-col gap-1 border-t border-slate-100 dark:border-zinc-700/60 pt-1.5">
                              <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Recently Used</span>
                              <div className="flex gap-1.5">
                                {recentlyUsedColors.map(color => (
                                  <button
                                    key={`recent-${color}`}
                                    onMouseEnter={() => handleColorHoverEnter(color)}
                                    onMouseLeave={handleColorHoverLeave}
                                    onClick={() => {
                                      handleColorCommit(color);
                                      setIsStickyColorOpen(false);
                                    }}
                                    className="w-5 h-5 rounded-full border border-slate-200 shadow-sm hover:scale-105 transition-transform"
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* CUSTOM COLOR PICKER */}
                          <div className="flex items-center justify-between border-t border-slate-100 dark:border-zinc-700/60 pt-1.5">
                            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Custom Hex</span>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <div className="w-5 h-5 rounded border border-slate-350 dark:border-zinc-650 flex items-center justify-center text-[10px] text-slate-500 font-bold bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100">
                                +
                              </div>
                              <input
                                type="color"
                                value={currentFill.startsWith('#') ? currentFill : '#fef08a'}
                                onChange={(e) => handleColorCommit(e.target.value)}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-6 gap-1">
                      {palette.map((c) => {
                        const isSelected = currentFill === c.value;
                        return (
                          <button
                            key={`fill-${c.value}`}
                            onClick={() => handleFillChange(c.value)}
                            className={`w-6 h-6 rounded-full border shadow-sm transition-all hover:scale-110 flex items-center justify-center ${
                              c.value === 'transparent' ? 'border-dashed border-slate-400 dark:border-zinc-600 bg-transparent' : ''
                            }`}
                            style={{ 
                              backgroundColor: c.value === 'transparent' ? undefined : c.value, 
                              borderColor: isSelected ? '#3b82f6' : (c.value === 'transparent' ? undefined : 'transparent')
                            }}
                            title={c.name}
                          >
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white mix-blend-difference"></span>}
                            {c.value === 'transparent' && !isSelected && <span className="text-[14px] text-slate-400 -rotate-45 font-light">/</span>}
                          </button>
                        );
                      })}
                      {/* Custom Hex Fill Input */}
                      <label className="w-6 h-6 rounded-full border border-slate-300 dark:border-zinc-700 cursor-pointer flex items-center justify-center bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100" title="Custom fill">
                        <span className="text-[9px] font-bold text-slate-500">#</span>
                        <input 
                          type="color" 
                          value={currentFill.startsWith('#') ? currentFill : '#ffffff'} 
                          onChange={(e) => handleFillChange(e.target.value)}
                          className="hidden" 
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* STROKE WIDTH */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-semibold text-slate-500">
                  <span>Stroke Width</span>
                  <span>{currentStrokeWidth}px</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="12" 
                  value={currentStrokeWidth} 
                  onChange={(e) => handleStrokeWidthChange(Number(e.target.value))}
                  className="w-full h-1 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-brand-500" 
                />
              </div>

              {/* OPACITY SLIDER */}
              {hasSelection && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-semibold text-slate-500">
                    <span>Opacity</span>
                    <span>{currentOpacity}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="100" 
                    value={currentOpacity} 
                    onChange={(e) => handleOpacityChange(Number(e.target.value))}
                    className="w-full h-1 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-brand-500" 
                  />
                </div>
              )}

              {/* TEXT PROPERTIES OPTION */}
              {isTextEl && (
                <div className="flex flex-col gap-2 border-t border-slate-100 dark:border-zinc-800/60 pt-2.5">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-500">Font Size</span>
                    <select 
                      value={currentFontSize}
                      onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                      className="bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-1.5 py-0.5 rounded text-[11px] focus:outline-none"
                    >
                      {[12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64].map(sz => (
                        <option key={sz} value={sz}>{sz}px</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-500">Align</span>
                    <div className="flex bg-slate-100 dark:bg-zinc-800 rounded-lg p-0.5 border border-slate-200 dark:border-zinc-700">
                      {(['left', 'center', 'right'] as const).map(dir => (
                        <button
                          key={dir}
                          onClick={() => handleAlignChange(dir)}
                          className={`px-2 py-0.5 rounded capitalize text-[10px] font-bold ${
                            currentAlign === dir 
                              ? 'bg-white dark:bg-zinc-700 shadow-sm text-slate-800 dark:text-white' 
                              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                          }`}
                        >
                          {dir}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* LAYERING AND ACTIONS (ONLY WHEN SELECTED) */}
              {hasSelection && (
                <div className="flex flex-col gap-2 border-t border-slate-100 dark:border-zinc-800/60 pt-2.5">
                  <span className="font-semibold text-slate-500">Layers & Order</span>
                  <div className="grid grid-cols-4 gap-1">
                    <button onClick={() => handleLayerOrder('front')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800/80 rounded-lg flex justify-center text-slate-600 dark:text-zinc-300 border border-slate-200/50 dark:border-zinc-800" title="Bring to Front">
                      <BringToFront size={14} />
                    </button>
                    <button onClick={() => handleLayerOrder('forward')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800/80 rounded-lg flex justify-center text-slate-600 dark:text-zinc-300 border border-slate-200/50 dark:border-zinc-800" title="Bring Forward">
                      <Layers size={14} className="rotate-180" />
                    </button>
                    <button onClick={() => handleLayerOrder('backward')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800/80 rounded-lg flex justify-center text-slate-600 dark:text-zinc-300 border border-slate-200/50 dark:border-zinc-800" title="Send Backward">
                      <Layers size={14} />
                    </button>
                    <button onClick={() => handleLayerOrder('back')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800/80 rounded-lg flex justify-center text-slate-600 dark:text-zinc-300 border border-slate-200/50 dark:border-zinc-800" title="Send to Back">
                      <SendToBack size={14} />
                    </button>
                  </div>

                  <div className="flex gap-2 mt-1">
                    <button 
                      onClick={handleDuplicateSelected}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/50 rounded-xl text-[11px] font-semibold text-slate-600 dark:text-zinc-300 transition-colors"
                    >
                      <Copy size={12} />
                      <span>Duplicate</span>
                    </button>
                    <button 
                      onClick={handleDeleteSelected}
                      className="p-1.5 border border-rose-200 dark:border-rose-950 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-colors"
                      title="Delete Object"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}

              {/* STICKY NOTE ADVANCED ACTIONS */}
              {hasSelection && elements.some(el => selectedElementIds.includes(el.id) && el.type === 'sticky') && (
                <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-zinc-800/60 pt-2.5 text-xs">
                  {/* CARD STYLE */}
                  <div className="flex flex-col gap-1.5">
                    <span className="font-semibold text-slate-500 font-sans text-[11px]">Card Style</span>
                    <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-zinc-800 rounded-lg p-0.5 border border-slate-200 dark:border-zinc-700">
                      {(['classic', 'rounded', 'paper'] as const).map(style => {
                        const firstSticky = elements.find(el => selectedElementIds.includes(el.id) && el.type === 'sticky');
                        const activeStyle = firstSticky ? ((firstSticky as any).cardStyle || 'classic') : 'classic';
                        return (
                          <button
                            key={style}
                            onClick={() => {
                              selectedElementIds.forEach(id => {
                                updateElement(id, { cardStyle: style } as any);
                              });
                            }}
                            className={`py-1 rounded capitalize text-[10px] font-bold ${
                              activeStyle === style 
                                ? 'bg-white dark:bg-zinc-700 shadow-sm text-slate-800 dark:text-white' 
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                            }`}
                          >
                            {style}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* PRESET SIZES */}
                  <div className="flex flex-col gap-1.5">
                    <span className="font-semibold text-slate-500 font-sans text-[11px]">Size Preset</span>
                    <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-zinc-800 rounded-lg p-0.5 border border-slate-200 dark:border-zinc-700">
                      {[
                        { label: 'Small', w: 100, h: 100 },
                        { label: 'Medium', w: 140, h: 140 },
                        { label: 'Large', w: 200, h: 200 }
                      ].map(preset => {
                        return (
                          <button
                            key={preset.label}
                            onClick={() => {
                              selectedElementIds.forEach(id => {
                                updateElement(id, { width: preset.w, height: preset.h });
                              });
                            }}
                            className="py-1 rounded text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 hover:bg-white/50"
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* MARK IMPORTANT */}
                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-zinc-800/60 pt-2 flex-row">
                    <span className="font-semibold text-slate-500 font-sans text-[11px]">Mark Important</span>
                    <button
                      onClick={() => {
                        const firstSticky = elements.find(el => selectedElementIds.includes(el.id) && el.type === 'sticky');
                        const isImportant = !((firstSticky as any)?.isImportant);
                        selectedElementIds.forEach(id => {
                          updateElement(id, { isImportant } as any);
                        });
                      }}
                      className={`p-1 px-3 rounded-lg border text-[10px] font-bold transition-colors ${
                        elements.some(el => selectedElementIds.includes(el.id) && (el as any).isImportant)
                          ? 'bg-yellow-50 dark:bg-yellow-950/20 text-yellow-600 border-yellow-200'
                          : 'bg-transparent text-slate-500 border-slate-200 dark:border-zinc-700'
                      }`}
                    >
                      ★ {elements.some(el => selectedElementIds.includes(el.id) && (el as any).isImportant) ? 'Important' : 'Normal'}
                    </button>
                  </div>

                  {/* REACTION SYSTEM */}
                  <div className="flex flex-col gap-1.5 border-t border-slate-100 dark:border-zinc-800/60 pt-2">
                    <span className="font-semibold text-slate-500 font-sans text-[11px]">Reactions</span>
                    <div className="flex gap-1">
                      {['👍', '❤️', '💡', '✅', '❓'].map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => {
                            selectedElementIds.forEach(id => {
                              const sticky = elements.find(el => el.id === id);
                              if (sticky) {
                                const currentReactions = { ...(sticky as any).reactions };
                                currentReactions[emoji] = (currentReactions[emoji] || 0) + 1;
                                updateElement(id, { reactions: currentReactions });
                              }
                            });
                          }}
                          className="flex-1 py-1 rounded bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm hover:scale-110 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-transform"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        );
      })()}

      {/* 4. CANVAS AREA */}
      <main className="flex-1 w-full h-full relative outline-none overflow-hidden">
        {children}
      </main>
        {/* Mobile Bottom Action Bar */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-zinc-900/95 p-2 flex justify-center gap-2 border-t border-slate-200 dark:border-zinc-800">
          <button
            onClick={() => {
              // Delete selected elements
              selectedElementIds.forEach(id => deleteElement(id));
              setSelectedElementIds([]);
            }}
            className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800/80 rounded-xl"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={() => {
              // Duplicate selected elements (simple shallow copy)
              const dupes = elements.filter(el => selectedElementIds.includes(el.id)).map(el => ({
                ...el,
                id: Math.random().toString(36).substring(2, 9),
                x: el.x + 20,
                y: el.y + 20,
                createdAt: Date.now(),
                updatedAt: Date.now()
              }));
              dupes.forEach(d => addElement(d));
            }}
            className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800/80 rounded-xl"
            title="Duplicate"
          >
            <Copy size={16} />
          </button>
          <button
            onClick={() => setEraserMode(!eraserMode)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800/80 rounded-xl"
            title="Toggle Eraser"
          >
            {eraserMode ? <Eraser size={16} /> : <Eraser size={16} />}
          </button>
        </div>

      {/* 5. BOTTOM CONTROLS */}
      <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2">
        {/* Viewport Control Panel */}
        <div className="flex items-center gap-1 p-1 floating-panel rounded-2xl h-11">
          <button 
            onClick={() => setZoom(z => Math.max(0.1, z - 0.1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors"
            title="Zoom Out"
          >
            <Minus size={14} />
          </button>
          <button 
            onClick={resetViewport}
            className="px-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            title="Reset Zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button 
            onClick={() => setZoom(z => Math.min(10, z + 0.1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors"
            title="Zoom In"
          >
            <Plus size={14} />
          </button>
          <div className="w-px h-4 bg-slate-200 dark:bg-zinc-800 mx-1"></div>
          <button 
            onClick={resetViewport}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors"
            title="Fit to Content"
          >
            <Maximize size={14} />
          </button>
        </div>

        {/* Minimap Toggle */}
        <button
          onClick={() => setMinimapOpen(!isMinimapOpen)}
          className={`w-11 h-11 floating-panel rounded-2xl flex items-center justify-center transition-all ${
            isMinimapOpen 
              ? 'bg-brand-50 text-brand-600 border-brand-200 dark:bg-brand-950/40 dark:text-brand-400 dark:border-brand-900/50' 
              : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80'
          }`}
          title="Toggle Minimap"
        >
          <Map size={16} />
        </button>
      </div>

      {/* 6. DEV METRICS PANEL */}
      {isDevPanelOpen && (
        <div className="absolute bottom-4 right-4 z-30 w-64 floating-panel rounded-2xl p-4 flex flex-col gap-2.5 text-xs select-none font-mono">
          <div className="flex items-center gap-1.5 text-slate-400 font-bold border-b border-slate-100 dark:border-zinc-800/60 pb-1.5 uppercase tracking-wider text-[10px]">
            <Cpu size={12} className="text-brand-500" />
            <span>Developer Metrics</span>
          </div>
          <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[11px]">
            <span className="text-slate-400">Frame Rate:</span>
            <span className="text-right font-bold text-emerald-500">{devMetrics.fps} FPS</span>

            <span className="text-slate-400">Canvas Nodes:</span>
            <span className="text-right font-bold">{devMetrics.objectCount}</span>

            <span className="text-slate-400">Active Peers:</span>
            <span className="text-right font-bold text-indigo-500">{devMetrics.activeUsers}</span>

            <span className="text-slate-400">WebSocket State:</span>
            <span className="text-right font-bold uppercase text-emerald-500">Connected</span>

            <span className="text-slate-400">Sync Ingest:</span>
            <span className="text-right font-bold">{devMetrics.eventRate} msg/s</span>
          </div>
        </div>
      )}

      {/* 7. SHARE MODAL */}
      {isShareOpen && (
        <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="w-full max-w-md bg-white dark:bg-darkbg-panel border border-slate-200 dark:border-zinc-800/80 rounded-2xl shadow-floating dark:shadow-floating-dark p-6 m-4 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h2 className="text-lg font-bold tracking-tight">Share Board</h2>
              <button 
                onClick={() => setShareOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500">Invite Link</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={window.location.href}
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 rounded-xl text-xs font-mono focus:outline-none"
                />
                <button 
                  onClick={() => navigator.clipboard.writeText(window.location.href)}
                  className="px-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <Copy size={13} />
                  <span>Copy</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500">Access Permissions</label>
              <select className="px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none">
                <option value="edit">Anyone with the link can edit</option>
                <option value="view">Anyone with the link can view only</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-zinc-800 pt-3 mt-1">
              <button 
                onClick={() => setShareOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs font-semibold rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. KEYBOARD SHORTCUTS MODAL */}
      {isShortcutsOpen && (
        <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="w-full max-w-lg bg-white dark:bg-darkbg-panel border border-slate-200 dark:border-zinc-800/80 rounded-2xl shadow-floating dark:shadow-floating-dark p-6 m-4 flex flex-col gap-4 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h2 className="text-lg font-bold tracking-tight">Keyboard Shortcuts</h2>
              <button 
                onClick={() => setShortcutsOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            {/* List of shortcuts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-xs">
              <div className="flex flex-col gap-2">
                <h3 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Tools</h3>
                <div className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-zinc-800/30">
                  <span className="text-slate-600 dark:text-zinc-300">Select Tool</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-mono text-[10px] font-bold">V</kbd>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-zinc-800/30">
                  <span className="text-slate-600 dark:text-zinc-300">Hand / Pan Tool</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-mono text-[10px] font-bold">H</kbd>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-zinc-800/30">
                  <span className="text-slate-600 dark:text-zinc-300">Pencil Tool</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-mono text-[10px] font-bold">P</kbd>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-zinc-800/30">
                  <span className="text-slate-600 dark:text-zinc-300">Rectangle Tool</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-mono text-[10px] font-bold">R</kbd>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-zinc-800/30">
                  <span className="text-slate-600 dark:text-zinc-300">Ellipse Tool</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-mono text-[10px] font-bold">O</kbd>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-zinc-800/30">
                  <span className="text-slate-600 dark:text-zinc-300">Line Tool</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-mono text-[10px] font-bold">L</kbd>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-zinc-800/30">
                  <span className="text-slate-600 dark:text-zinc-300">Arrow Tool</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-mono text-[10px] font-bold">A</kbd>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-zinc-800/30">
                  <span className="text-slate-600 dark:text-zinc-300">Text Tool</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-mono text-[10px] font-bold">T</kbd>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Operations</h3>
                <div className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-zinc-800/30">
                  <span className="text-slate-600 dark:text-zinc-300">Undo Action</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-mono text-[10px] font-bold">Cmd + Z</kbd>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-zinc-800/30">
                  <span className="text-slate-600 dark:text-zinc-300">Redo Action</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-mono text-[10px] font-bold">Cmd + Shift + Z</kbd>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-zinc-800/30">
                  <span className="text-slate-600 dark:text-zinc-300">Copy Element</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-mono text-[10px] font-bold">Cmd + C</kbd>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-zinc-800/30">
                  <span className="text-slate-600 dark:text-zinc-300">Paste Element</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-mono text-[10px] font-bold">Cmd + V</kbd>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-zinc-800/30">
                  <span className="text-slate-600 dark:text-zinc-300">Duplicate Element</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-mono text-[10px] font-bold">Cmd + D</kbd>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-zinc-800/30">
                  <span className="text-slate-600 dark:text-zinc-300">Select All</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-mono text-[10px] font-bold">Cmd + A</kbd>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-zinc-800/30">
                  <span className="text-slate-600 dark:text-zinc-300">Delete Selected</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-mono text-[10px] font-bold">Delete</kbd>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-zinc-800/30">
                  <span className="text-slate-600 dark:text-zinc-300">Pan Viewport</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-mono text-[10px] font-bold">Space + Drag</kbd>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-zinc-800 pt-3 mt-1">
              <button 
                onClick={() => setShortcutsOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white text-xs font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. ERASER OPTIONS FLOATING PANEL */}
      {activeTool === 'eraser' && (
        <div className="absolute left-20 top-1/2 -translate-y-1/2 z-30 floating-panel rounded-2xl p-3.5 flex flex-col gap-3 w-40 select-none border border-slate-200 dark:border-zinc-800">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Eraser Mode</div>
          <div className="flex bg-slate-100 dark:bg-zinc-800 rounded-lg p-0.5 border border-slate-200 dark:border-zinc-700">
            {(['object', 'stroke'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setEraserMode(mode)}
                className={`flex-1 py-1 rounded capitalize text-[10px] font-bold transition-all ${
                  eraserMode === mode 
                    ? 'bg-white dark:bg-zinc-700 shadow-sm text-slate-800 dark:text-white' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 border-t border-slate-100 dark:border-zinc-800 pt-2.5">Radius</div>
          <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-zinc-800 rounded-lg p-0.5 border border-slate-200 dark:border-zinc-700">
            {[
              { label: 'S', size: 8 },
              { label: 'M', size: 16 },
              { label: 'L', size: 32 }
            ].map(item => (
              <button
                key={item.size}
                onClick={() => setEraserSize(item.size)}
                className={`py-1 rounded text-[10px] font-bold transition-all ${
                  eraserSize === item.size 
                    ? 'bg-white dark:bg-zinc-700 shadow-sm text-slate-800 dark:text-white' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 10. AI CANVAS UNDERSTANDING SIDEBAR PANEL */}
      {isAIPanelOpen && (
        <aside className="absolute right-4 top-1/2 -translate-y-1/2 z-35 w-80 floating-panel rounded-2xl p-4 flex flex-col gap-4 select-none max-h-[85vh] overflow-y-auto font-sans border border-slate-200 dark:border-zinc-800">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/60 pb-2.5">
            <div className="flex items-center gap-1.5">
              <Sparkles size={16} className="text-brand-500 animate-pulse" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">AI Assistant</h2>
            </div>
            <button onClick={() => setAIPanelOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X size={16} />
            </button>
          </div>

          {/* Context elements warning */}
          <div className="text-[10px] text-slate-450 dark:text-zinc-550 bg-slate-50 dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800 p-2.5 rounded-xl">
            Selected elements: <span className="font-bold text-slate-700 dark:text-zinc-300">{selectedElementIds.length}</span>
            {selectedElementIds.length === 0 && (
              <p className="text-amber-500 dark:text-amber-400 font-medium mt-1">⚠️ Please select elements on canvas to analyze.</p>
            )}
          </div>

          {/* AI Output Box */}
          <div className="flex-1 overflow-y-auto min-h-[150px] max-h-[45vh] bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/40 dark:border-zinc-850 p-3 rounded-2xl flex flex-col gap-2">
            {aiLoading ? (
              <div className="flex flex-col gap-2.5 py-4 items-center justify-center">
                <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-[10px] text-slate-400 font-medium animate-pulse">Consulting Gemini models...</span>
                <button
                  onClick={handleCancelAI}
                  className="mt-2 py-1 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg text-[10px] font-bold text-slate-655 dark:text-zinc-300"
                >
                  Cancel
                </button>
              </div>
            ) : aiOutput ? (
              <div className="markdown-content select-text select-none overflow-y-auto pr-1">
                {renderMarkdown(aiOutput)}
              </div>
            ) : (
              <div className="text-center text-[10px] text-slate-450 dark:text-zinc-550 my-auto py-8">
                Click an action below or enter a custom prompt to begin selection analysis.
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col gap-2">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Quick Actions</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={selectedElementIds.length === 0 || aiLoading}
                onClick={() => handleAIRequest('explain')}
                className="py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-850 dark:hover:bg-zinc-750 text-slate-705 dark:text-zinc-300 rounded-xl text-xs font-bold transition-all border border-slate-200/50 dark:border-zinc-750 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ✨ Explain Selection
              </button>
              <button
                disabled={selectedElementIds.length === 0 || aiLoading}
                onClick={() => handleAIRequest('summarize')}
                className="py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-850 dark:hover:bg-zinc-750 text-slate-705 dark:text-zinc-300 rounded-xl text-xs font-bold transition-all border border-slate-200/50 dark:border-zinc-750 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ✨ Summarize
              </button>
            </div>
          </div>

          {/* Ask Custom Prompt */}
          <div className="flex flex-col gap-2 border-t border-slate-100 dark:border-zinc-800/60 pt-3">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-550">Ask Custom Question</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && customPrompt.trim() && !aiLoading && selectedElementIds.length > 0 && (
                  handleAIRequest('ask', customPrompt),
                  setCustomPrompt('')
                )}
                placeholder={selectedElementIds.length === 0 ? "Select elements first..." : "e.g. Find design flaws..."}
                disabled={selectedElementIds.length === 0 || aiLoading}
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 dark:text-zinc-100"
              />
              <button
                disabled={selectedElementIds.length === 0 || !customPrompt.trim() || aiLoading}
                onClick={() => {
                  handleAIRequest('ask', customPrompt);
                  setCustomPrompt('');
                }}
                className="px-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Send
              </button>
            </div>
          </div>
        </header>
        {/* Mobile Hamburger */}
        <div className="sm:hidden flex items-center p-2 bg-white/95 dark:bg-zinc-900/95 border-b border-slate-200 dark:border-zinc-800">
          <button
            onClick={() => setMobileToolbarOpen(!mobileToolbarOpen)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800/80 rounded-xl"
            title="Toggle Toolbar"
          >
            <Menu size={20} />
          </button>
          <h1 className="ml-2 text-lg font-semibold">{boardTitle}</h1>
        </div>
      )}
    </div>
  );
};
