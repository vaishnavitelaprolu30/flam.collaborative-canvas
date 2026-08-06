import React from 'react';
import { X, Sparkles, Palette } from 'lucide-react';
import { useUIStore } from '../store/useUIStore';
import { useBoardStore } from '../store/useBoardStore';

interface StylesDrawerProps {
  onClose: () => void;
}

export const StylesDrawer: React.FC<StylesDrawerProps> = ({ onClose }) => {
  const { selectedElementIds, setActiveFill, setActiveStroke } = useUIStore();
  const { updateElement, elements } = useBoardStore();

  const colorPalettes = [
    { name: 'Dark Olive', bg: '#1c2819', accent: '#709038', secondary: '#c8ab37' },
    { name: 'Modern Slate', bg: '#1e293b', accent: '#3b82f6', secondary: '#94a3b8' },
    { name: 'Pastel Mint', bg: '#ecfdf5', accent: '#10b981', secondary: '#a7f3d0' },
    { name: 'Berry Sunset', bg: '#4c0519', accent: '#f43f5e', secondary: '#fb7185' },
    { name: 'Neon Cyber', bg: '#083344', accent: '#06b6d4', secondary: '#67e8f9' },
    { name: 'Midnight Indigo', bg: '#1e1b4b', accent: '#6366f1', secondary: '#a5b4fc' },
    { name: 'Warm Amber', bg: '#451a03', accent: '#f59e0b', secondary: '#fde68a' },
    { name: 'Soft Lavender', bg: '#3b0764', accent: '#a855f7', secondary: '#e9d5ff' },
    { name: 'Emerald Forest', bg: '#064e3b', accent: '#059669', secondary: '#6ee7b7' },
    { name: 'Coral Sunrise', bg: '#7c2d12', accent: '#ea580c', secondary: '#fdba74' },
    { name: 'Nordic Blue', bg: '#172554', accent: '#2563eb', secondary: '#93c5fd' },
    { name: 'Plum Violet', bg: '#581c87', accent: '#9333ea', secondary: '#d8b4fe' },
  ];

  const handleApplyPalette = (palette: typeof colorPalettes[0]) => {
    setActiveFill(palette.bg);
    setActiveStroke(palette.accent);

    if (selectedElementIds.length > 0) {
      selectedElementIds.forEach((id) => {
        updateElement(id, {
          fill: palette.bg,
          stroke: palette.accent,
        });
      });
    } else {
      // Apply palette to all frames on board
      elements.forEach((el) => {
        if (el.type === 'frame') {
          updateElement(el.id, {
            stroke: palette.accent,
          });
        }
      });
    }
  };

  return (
    <aside className="fixed right-2 sm:right-4 top-20 bottom-20 z-40 w-[min(20rem,calc(100vw-1rem))] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl rounded-3xl flex flex-col justify-between overflow-hidden select-none animate-in slide-in-from-right-4 duration-200 font-sans">
      {/* HEADER SECTION */}
      <div className="p-4 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette size={18} className="text-purple-600" />
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Styles</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* CONTENT SCROLL AREA (MATCHING SCREENSHOT 1) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">
        {/* Current Applied Style */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">No style applied</span>
          <button
            onClick={() => {
              setActiveFill('transparent');
              setActiveStroke('#3b82f6');
            }}
            className="text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
          >
            Remove styles
          </button>
        </div>

        {/* Brand Style Banner */}
        <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-2xl flex items-start gap-2.5">
          <Sparkles size={16} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="flex flex-col gap-1 text-xs">
            <span className="font-bold text-blue-900 dark:text-blue-200">Brand style</span>
            <span className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
              Keep your boards on-brand with curated color palettes and typography presets.
            </span>
          </div>
        </div>

        {/* All Styles Palette Grid */}
        <div className="space-y-3">
          <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider text-[10px]">
            All Styles
          </span>

          <div className="grid grid-cols-2 gap-2.5">
            {colorPalettes.map((p) => (
              <button
                key={p.name}
                onClick={() => handleApplyPalette(p)}
                className="group p-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 hover:border-purple-500 rounded-2xl transition-all hover:scale-105 flex flex-col gap-1.5 shadow-sm"
              >
                {/* 3-Color Swatch Strip */}
                <div className="w-full h-8 rounded-xl flex overflow-hidden border border-slate-200/60">
                  <div className="flex-1 h-full" style={{ backgroundColor: p.bg }} />
                  <div className="flex-1 h-full" style={{ backgroundColor: p.accent }} />
                  <div className="flex-1 h-full" style={{ backgroundColor: p.secondary }} />
                </div>
                <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 group-hover:text-purple-600 truncate">
                  {p.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
