import React, { useState, useEffect } from 'react';
import { Search, MousePointer, Hand, StickyNote, Type, Square, Pencil, Frame, Sparkles, LayoutGrid, Download, Clock, Sun, Moon } from 'lucide-react';
import { useUIStore } from '../store/useUIStore';

interface CommandPaletteProps {
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const { 
    setActiveTool, 
    setTemplateModalOpen, 
    setExportModalOpen, 
    setHistoryOpen,
    setAIPanelOpen,
    resolvedTheme,
    setTheme,
    resetViewport,
    setDiagrammingDrawerOpen,
    setSlideLayoutsModalOpen,
    setMermaidModalOpen,
    fitViewportToContent
  } = useUIStore();

  const commands = [
    { id: 'select', name: 'Select Tool', category: 'Tools', icon: <MousePointer size={16} />, action: () => setActiveTool('select') },
    { id: 'hand', name: 'Hand / Pan Canvas', category: 'Tools', icon: <Hand size={16} />, action: () => setActiveTool('hand') },
    { id: 'sticky', name: 'Add Sticky Note', category: 'Tools', icon: <StickyNote size={16} />, action: () => setActiveTool('sticky') },
    { id: 'text', name: 'Add Text', category: 'Tools', icon: <Type size={16} />, action: () => setActiveTool('text') },
    { id: 'rectangle', name: 'Draw Rectangle', category: 'Tools', icon: <Square size={16} />, action: () => setActiveTool('rectangle') },
    { id: 'pencil', name: 'Pencil Brush', category: 'Tools', icon: <Pencil size={16} />, action: () => setActiveTool('pencil') },
    { id: 'frame', name: 'Create Frame', category: 'Tools', icon: <Frame size={16} />, action: () => setActiveTool('frame') },
    { id: 'templates', name: 'Open Template Library', category: 'Templates', icon: <LayoutGrid size={16} />, action: () => setTemplateModalOpen(true) },
    { id: 'ai', name: 'Ask Gemini AI Assistant', category: 'AI', icon: <Sparkles size={16} className="text-brand-500" />, action: () => setAIPanelOpen(true) },
    { id: 'export', name: 'Export Canvas (PNG / SVG / JSON)', category: 'Actions', icon: <Download size={16} />, action: () => setExportModalOpen(true) },
    { id: 'history', name: 'Version History Checkpoints', category: 'Actions', icon: <Clock size={16} />, action: () => setHistoryOpen(true) },
    { id: 'shapes', name: 'Open Diagramming Shape Library', category: 'Tools', icon: <Square size={16} />, action: () => setDiagrammingDrawerOpen(true) },
    { id: 'layouts', name: 'Browse Slide Layouts', category: 'Templates', icon: <LayoutGrid size={16} />, action: () => setSlideLayoutsModalOpen(true) },
    { id: 'mermaid', name: 'Build Diagram with Code (Mermaid)', category: 'Templates', icon: <Sparkles size={16} className="text-orange-500" />, action: () => setMermaidModalOpen(true) },
    { id: 'theme', name: `Switch Theme (Current: ${resolvedTheme})`, category: 'View', icon: resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />, action: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark') },
    { id: 'fit', name: 'Fit Board to Content', category: 'View', icon: <Frame size={16} />, action: () => fitViewportToContent() },
    { id: 'reset', name: 'Reset Viewport (100%)', category: 'View', icon: <Search size={16} />, action: () => resetViewport() }
  ];

  const filteredCommands = commands.filter(cmd => cmd.name.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-slate-900/50 backdrop-blur-sm p-4 font-sans animate-in fade-in duration-100">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col">
        {/* Search bar */}
        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-3">
          <Search size={18} className="text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search tools (Press Esc to exit)..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none font-medium"
            autoFocus
          />
          <span className="text-[10px] font-mono bg-slate-100 dark:bg-zinc-800 text-slate-400 px-2 py-0.5 rounded">
            ESC
          </span>
        </div>

        {/* Results list */}
        <div className="p-2 max-h-80 overflow-y-auto flex flex-col gap-1 scrollbar-thin">
          {filteredCommands.length === 0 ? (
            <div className="text-center text-xs text-slate-400 py-8">
              No matching commands found
            </div>
          ) : (
            filteredCommands.map((cmd) => (
              <button
                key={cmd.id}
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
                className="w-full text-left p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-between text-xs group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-50 dark:bg-zinc-850 group-hover:bg-white dark:group-hover:bg-zinc-700 rounded-lg text-slate-600 dark:text-zinc-300 transition-colors">
                    {cmd.icon}
                  </div>
                  <span className="font-semibold text-slate-800 dark:text-zinc-200">{cmd.name}</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                  {cmd.category}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
