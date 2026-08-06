import React from 'react';
import { Play, Plus, Maximize2 } from 'lucide-react';
import { useBoardStore } from '../store/useBoardStore';
import { useUIStore } from '../store/useUIStore';

export const SlideDeckBar: React.FC = () => {
  const { elements, addElement } = useBoardStore();
  const { setPan, setPresentationOpen, setSelectedElementIds, zoom } = useUIStore();

  // Get all frame elements on the canvas as presentation slides
  const slideFrames = elements.filter((el) => el.type === 'frame');

  const defaultSlides = slideFrames.length > 0 ? slideFrames : [
    { id: 'def_s1', title: 'Slide 1: Vision & Intro', width: 600, height: 380, x: 100, y: 100 },
    { id: 'def_s2', title: 'Slide 2: System Architecture', width: 600, height: 380, x: 750, y: 100 },
    { id: 'def_s3', title: 'Slide 3: User Journey & Insights', width: 600, height: 380, x: 1400, y: 100 },
    { id: 'def_s4', title: 'Slide 4: Roadmap & Milestones', width: 600, height: 380, x: 2050, y: 100 },
  ];

  const handleFocusSlide = (slide: any) => {
    const targetX = window.innerWidth / 2 - (slide.x + (slide.width || 600) / 2) * zoom;
    const targetY = window.innerHeight / 2 - (slide.y + (slide.height || 380) / 2) * zoom;
    setPan({ x: targetX, y: targetY });
    setSelectedElementIds([slide.id]);
  };

  const handleAddSlide = () => {
    const lastSlide = defaultSlides[defaultSlides.length - 1];
    const newX = (lastSlide?.x || 100) + (lastSlide?.width || 600) + 50;
    const newY = lastSlide?.y || 100;
    const slideNum = defaultSlides.length + 1;

    const newSlideId = `slide_frame_${Math.random().toString(36).substring(2, 9)}`;

    addElement({
      id: newSlideId,
      type: 'frame',
      title: `Slide ${slideNum}: New Topic`,
      frameType: 'slides',
      x: newX,
      y: newY,
      width: 650,
      height: 420,
      stroke: '#ef4444',
      strokeWidth: 2,
      fill: 'transparent',
      opacity: 1,
      rotation: 0,
      isLocked: false,
      createdBy: 'local-user',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as any);

    handleFocusSlide({ id: newSlideId, x: newX, y: newY, width: 650, height: 420 });
  };

  return (
    <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-white/95 dark:bg-zinc-900/95 border border-slate-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-2 select-none animate-in slide-in-from-bottom-3 duration-200 font-sans max-w-[85vw] overflow-x-auto scrollbar-none">
      {/* Slide Deck Strip Header Info */}
      <div className="flex items-center gap-2 px-2 py-1 border-r border-slate-200 dark:border-zinc-800 flex-shrink-0">
        <button
          onClick={handleAddSlide}
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl text-slate-600 dark:text-zinc-300 transition-colors flex items-center gap-1 text-xs font-semibold"
          title="Add New Slide Frame"
        >
          <Plus size={14} className="text-red-500" />
          <span className="hidden sm:inline">Add Slide</span>
        </button>
      </div>

      {/* Slide Thumbnails Scroll Row */}
      <div className="flex items-center gap-2 overflow-x-auto py-0.5 px-1 scrollbar-none">
        {defaultSlides.map((slide: any, idx: number) => (
          <div
            key={slide.id}
            onClick={() => handleFocusSlide(slide)}
            className="group relative w-36 h-20 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 hover:border-red-500 dark:hover:border-red-500 rounded-xl p-2 cursor-pointer transition-all flex flex-col justify-between flex-shrink-0 hover:scale-105 shadow-sm"
          >
            {/* Slide Header */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded-md truncate max-w-[80px]">
                {slide.title || `Slide ${idx + 1}`}
              </span>
              <span className="text-[9px] text-slate-400 font-mono">#{idx + 1}</span>
            </div>

            {/* Slide Content Preview Mock */}
            <div className="flex flex-col gap-1 my-auto opacity-70 group-hover:opacity-100 transition-opacity">
              <div className="w-3/4 h-1.5 bg-slate-300 dark:bg-zinc-700 rounded-full" />
              <div className="w-1/2 h-1 bg-slate-200 dark:bg-zinc-800 rounded-full" />
            </div>

            {/* Hover Floating Action Bar */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[1px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleFocusSlide(slide);
                }}
                className="p-1 hover:bg-white/20 rounded-lg text-white"
                title="Focus Slide View"
              >
                <Maximize2 size={13} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPresentationOpen(true);
                }}
                className="p-1 bg-red-600 hover:bg-red-700 rounded-lg text-white shadow-sm"
                title="Play Presentation Mode"
              >
                <Play size={13} className="fill-current" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
