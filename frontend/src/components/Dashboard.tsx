import React, { useEffect, useState } from 'react';
import { useUIStore } from '../store/useUIStore';
import { useBoardStore } from '../store/useBoardStore';
import { Plus, Search, Star, Trash2, Copy, Edit3, ArrowUpDown, Folder, X, Sparkles, LayoutGrid, GitBranch, Trello, ShieldAlert } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface BoardItem {
  id: string;
  title: string;
  favorite: number;
  created_at: number;
  updated_at: number;
}

export const Dashboard: React.FC = () => {
  const { setCurrentBoardId, fitViewportToContent } = useUIStore();
  const { loadBoard } = useBoardStore();

  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recently_edited');
  const [loading, setLoading] = useState(true);
  
  // Renaming Modal State
  const [renamingBoardId, setRenamingBoardId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');

  // Fetch Boards
  const fetchBoards = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/boards?search=${encodeURIComponent(search)}&sort=${sort}`);
      if (response.ok) {
        const data = await response.json();
        setBoards(data);
      }
    } catch (err) {
      console.error('Fetch boards failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoards();
  }, [search, sort]);

  // Create new board
  const handleCreateBoard = async () => {
    try {
      const id = Math.random().toString(36).substring(2, 9);
      const title = `Brainstorm - ${new Date().toLocaleDateString()}`;
      const response = await fetch(`${API_BASE_URL}/api/boards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title })
      });
      if (response.ok) {
        await loadBoard(id);
        setCurrentBoardId(id);
        fitViewportToContent();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle favorite
  const handleToggleFavorite = async (board: BoardItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const nextFav = board.favorite ? 0 : 1;
      const response = await fetch(`${API_BASE_URL}/api/boards/${board.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite: nextFav })
      });
      if (response.ok) {
        fetchBoards();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Duplicate board
  const handleDuplicateBoard = async (board: BoardItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // 1. Fetch current board elements
      const getRes = await fetch(`${API_BASE_URL}/api/boards/${board.id}`);
      if (!getRes.ok) return;
      const fullBoard = await getRes.json();

      // 2. Create duplicated board
      const newId = Math.random().toString(36).substring(2, 9);
      const newTitle = `${board.title} (Copy)`;
      const createRes = await fetch(`${API_BASE_URL}/api/boards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newId, title: newTitle })
      });

      if (createRes.ok) {
        // 3. Save elements to duplicated board
        await fetch(`${API_BASE_URL}/api/boards/${newId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ elements: fullBoard.elements })
        });
        fetchBoards();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete board
  const handleDeleteBoard = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this board?')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/boards/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchBoards();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Rename board
  const handleRenameBoard = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!renamingBoardId || !renameInput.trim()) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/boards/${renamingBoardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: renameInput.trim() })
      });
      if (response.ok) {
        setRenamingBoardId(null);
        setRenameInput('');
        fetchBoards();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="w-screen h-screen overflow-y-auto bg-slate-50 dark:bg-zinc-950 font-sans p-6 md:p-12 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      
      {/* Header Container */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-8 mb-8 select-none">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-500 to-indigo-500 flex items-center justify-center text-white font-black shadow-md shadow-brand-500/10">
            S
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">SyncSketch</h1>
            <p className="text-xs text-slate-400 dark:text-zinc-500">Collaborative Visual Whiteboard Canvas</p>
          </div>
        </div>

        <button
          onClick={handleCreateBoard}
          className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-brand-500 dark:hover:bg-brand-400 text-white font-bold p-2.5 px-5 rounded-xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all text-xs"
        >
          <Plus size={16} />
          <span>Create Board</span>
        </button>
      </div>

      {/* Quick Template Starters Banner */}
      <div className="max-w-6xl mx-auto mb-8 bg-gradient-to-r from-brand-600/10 via-indigo-500/10 to-purple-500/10 border border-brand-500/20 dark:border-brand-500/30 rounded-3xl p-6 select-none">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              <Sparkles size={16} className="text-brand-500" />
              <span>Start with a template</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Launch a pre-formatted canvas with Retrospectives, Mind Maps, Kanban, or SWOT matrices</p>
          </div>
          <button
            onClick={() => handleCreateBoard()}
            className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
          >
            Blank Canvas →
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { id: 'retro', title: 'Sprint Retro', icon: <LayoutGrid size={18} className="text-emerald-500" />, desc: '3 Columns' },
            { id: 'mindmap', title: 'Mind Map', icon: <GitBranch size={18} className="text-brand-500" />, desc: 'Radial Tree' },
            { id: 'kanban', title: 'Kanban Board', icon: <Trello size={18} className="text-purple-500" />, desc: 'Task Stages' },
            { id: 'swot', title: 'SWOT Matrix', icon: <ShieldAlert size={18} className="text-amber-500" />, desc: 'Strategy Grid' }
          ].map((tmpl) => (
            <button
              key={tmpl.id}
              onClick={async () => {
                const id = Math.random().toString(36).substring(2, 9);
                const title = `${tmpl.title} - ${new Date().toLocaleDateString()}`;
                const res = await fetch(`${API_BASE_URL}/api/boards`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id, title })
                });
                if (res.ok) {
                  await loadBoard(id);
                  setCurrentBoardId(id);
                  fitViewportToContent();
                  useUIStore.getState().setTemplateModalOpen(true);
                }
              }}
              className="p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-brand-500 dark:hover:border-brand-500 rounded-2xl transition-all hover:scale-[1.02] text-left group shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-slate-50 dark:bg-zinc-850 rounded-xl">
                  {tmpl.icon}
                </div>
                <span className="text-[9px] font-bold text-slate-400">{tmpl.desc}</span>
              </div>
              <div className="font-bold text-xs text-slate-800 dark:text-zinc-200 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                {tmpl.title}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Control Filters Bar */}
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center gap-3 mb-6 select-none">
        
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" size={16} />
          <input
            type="text"
            placeholder="Search boards..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-xs text-slate-700 dark:text-slate-200 transition-all shadow-sm"
          />
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <ArrowUpDown size={14} className="text-slate-400 dark:text-zinc-500" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-2 px-4 focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-xs text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer"
          >
            <option value="recently_edited">Recently Edited</option>
            <option value="recently_created">Recently Created</option>
            <option value="alphabetical">A — Z</option>
          </select>
        </div>
      </div>

      {/* Boards Grid View */}
      <div className="max-w-6xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-semibold">Loading boards library...</span>
          </div>
        ) : boards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-zinc-650 bg-white dark:bg-zinc-900/40 border border-slate-250/40 dark:border-zinc-900 rounded-2xl gap-3 select-none">
            <Folder size={40} className="stroke-[1.5] text-slate-350" />
            <div className="text-center">
              <p className="text-xs font-bold text-slate-500 dark:text-zinc-400">No boards found</p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-550 mt-0.5">Try a different search query or create a new visual space.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {boards.map((board) => (
              <div
                key={board.id}
                onClick={async () => {
                  await loadBoard(board.id);
                  setCurrentBoardId(board.id);
                  fitViewportToContent();
                }}
                className="group relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-2xl overflow-hidden hover:shadow-xl hover:border-slate-300 dark:hover:border-zinc-700 transition-all cursor-pointer flex flex-col h-48 select-none"
              >
                
                {/* Abstract Premium Whiteboard Thumbnail */}
                <div className="h-28 bg-gradient-to-br from-slate-50 to-indigo-50/20 dark:from-zinc-900/60 dark:to-zinc-800/20 border-b border-slate-100 dark:border-zinc-800 relative flex items-center justify-center overflow-hidden">
                  
                  {/* Decorative geometrical canvas accents */}
                  <div className="absolute inset-0 opacity-15 dark:opacity-[0.05] grid-bg-light"></div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-400/20 rotate-12 flex items-center justify-center transition-transform group-hover:scale-110 duration-300">
                    <Star size={18} className="text-indigo-500/40 dark:text-indigo-400/20 fill-indigo-500/10" />
                  </div>
                  
                  {/* Favorite Star badge trigger */}
                  <button
                    onClick={(e) => handleToggleFavorite(board, e)}
                    className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-white/80 dark:bg-zinc-800/80 hover:bg-white dark:hover:bg-zinc-700 hover:scale-110 shadow-sm border border-slate-200/40 dark:border-zinc-750 transition-all"
                  >
                    <Star
                      size={13}
                      className={board.favorite ? "fill-amber-400 stroke-amber-400" : "text-slate-400 dark:text-zinc-500"}
                    />
                  </button>
                </div>

                {/* Metadata Details Card footer */}
                <div className="p-3.5 flex flex-col justify-between flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-xs truncate max-w-[160px] text-slate-800 dark:text-slate-200" title={board.title}>
                      {board.title}
                    </h3>
                    
                    {/* Inline actions menu */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingBoardId(board.id);
                          setRenameInput(board.title);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                        title="Rename"
                      >
                        <Edit3 size={11} />
                      </button>
                      <button
                        onClick={(e) => handleDuplicateBoard(board, e)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                        title="Duplicate"
                      >
                        <Copy size={11} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteBoard(board.id, e)}
                        className="p-1 rounded text-slate-400 hover:text-rose-500"
                        title="Delete"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-zinc-500 pt-1">
                    <span>ID: {board.id}</span>
                    <span>Edited {getRelativeTime(board.updated_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RENAME BOARD MODAL */}
      {renamingBoardId && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleRenameBoard}
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl w-full max-w-sm flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="font-bold text-sm">Rename Board</h3>
              <button
                type="button"
                onClick={() => setRenamingBoardId(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>
            
            <input
              type="text"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
              autoFocus
            />

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setRenamingBoardId(null)}
                className="px-4 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-brand-500 dark:hover:bg-brand-400 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/10"
              >
                Rename
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
