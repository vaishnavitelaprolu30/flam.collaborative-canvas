import React from 'react';
import { Frame, X, Play, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { useBoardStore } from '../store/useBoardStore';
import { useUIStore } from '../store/useUIStore';
import { FrameElement } from '../types/canvas';

interface FrameNavigationDrawerProps {
  onClose: () => void;
}

export const FrameNavigationDrawer: React.FC<FrameNavigationDrawerProps> = ({ onClose }) => {
  const { elements } = useBoardStore();
  const { 
    setPan, 
    setZoom, 
    isPresentationMode, 
    setPresentationMode, 
    currentFrameIndex, 
    setCurrentFrameIndex,
    setSelectedElementIds
  } = useUIStore();

  const frames = elements.filter(el => el.type === 'frame') as FrameElement[];

  const jumpToFrame = (frame: FrameElement, index: number) => {
    setCurrentFrameIndex(index);
    setSelectedElementIds([frame.id]);

    const targetZoom = Math.min(
      (window.innerWidth - 100) / frame.width,
      (window.innerHeight - 100) / frame.height,
      1.5
    );

    setZoom(targetZoom);
    setPan({
      x: -frame.x * targetZoom + (window.innerWidth - frame.width * targetZoom) / 2,
      y: -frame.y * targetZoom + (window.innerHeight - frame.height * targetZoom) / 2
    });
  };

  const handleNextFrame = () => {
    if (frames.length === 0) return;
    const nextIdx = (currentFrameIndex + 1) % frames.length;
    jumpToFrame(frames[nextIdx], nextIdx);
  };

  const handlePrevFrame = () => {
    if (frames.length === 0) return;
    const prevIdx = (currentFrameIndex - 1 + frames.length) % frames.length;
    jumpToFrame(frames[prevIdx], prevIdx);
  };

  return (
    <>
      {/* Fullscreen Presentation Navigation overlay */}
      {isPresentationMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white rounded-full p-2.5 px-6 shadow-2xl flex items-center gap-6 backdrop-blur-md border border-slate-700 font-sans text-xs">
          <span className="font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            Slide {currentFrameIndex + 1} of {frames.length} ({frames[currentFrameIndex]?.title || 'Untitled Frame'})
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevFrame}
              className="p-1.5 hover:bg-slate-800 rounded-full transition-colors"
              title="Previous Frame (Left Arrow)"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNextFrame}
              className="p-1.5 hover:bg-slate-800 rounded-full transition-colors"
              title="Next Frame (Right Arrow)"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={() => setPresentationMode(false)}
            className="bg-white/20 hover:bg-white/30 text-white font-bold px-3 py-1 rounded-full transition-colors"
          >
            Exit Slide Mode
          </button>
        </div>
      )}

      {/* Frame Sidebar Index Drawer */}
      {!isPresentationMode && (
        <aside className="fixed left-4 top-20 bottom-20 z-35 w-64 bg-white/95 dark:bg-zinc-900/95 border border-slate-200 dark:border-zinc-800 shadow-xl rounded-2xl p-4 flex flex-col gap-4 font-sans select-none animate-in slide-in-from-left-4 duration-150 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
            <div className="flex items-center gap-2">
              <Frame size={16} className="text-brand-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200">Frames & Slides</h2>
            </div>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X size={16} />
            </button>
          </div>

          {frames.length > 0 && (
            <button
              onClick={() => {
                setPresentationMode(true);
                jumpToFrame(frames[0], 0);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-brand-500 to-indigo-600 text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all shadow-md"
            >
              <Play size={14} className="fill-white" />
              <span>Present Slideshow</span>
            </button>
          )}

          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 scrollbar-thin">
            {frames.length === 0 ? (
              <div className="text-center text-xs text-slate-400 py-10">
                No frames created yet.<br />Use the Frame tool (F) to add slide frames.
              </div>
            ) : (
              frames.map((frame, idx) => (
                <button
                  key={frame.id}
                  onClick={() => jumpToFrame(frame, idx)}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between group ${
                    currentFrameIndex === idx
                      ? 'bg-brand-50 border-brand-300 dark:bg-brand-950/30 dark:border-brand-800 text-brand-700 dark:text-brand-300 font-bold'
                      : 'bg-slate-50 dark:bg-zinc-850 border-slate-200/50 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="w-5 h-5 rounded-md bg-white dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold shadow-sm">
                      {idx + 1}
                    </span>
                    <span className="text-xs truncate font-medium">{frame.title || `Frame ${idx + 1}`}</span>
                  </div>
                  <Maximize2 size={12} className="opacity-0 group-hover:opacity-100 text-brand-500 transition-opacity" />
                </button>
              ))
            )}
          </div>
        </aside>
      )}
    </>
  );
};
