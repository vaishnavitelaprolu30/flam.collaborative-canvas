import React, { useMemo, useState } from 'react';
import { X, Search, Layout } from 'lucide-react';
import { useBoardStore } from '../store/useBoardStore';
import { useUIStore } from '../store/useUIStore';
import {
  SLIDE_CATEGORIES,
  SLIDE_LAYOUTS,
  SlideCategoryId,
  SlideLayoutDef,
  buildSlide,
  slideLayoutMatchesQuery,
} from '../slides/slideLayouts';
import { SlidePreview } from '../slides/SlidePreview';

interface SlideLayoutsModalProps {
  onClose: () => void;
  targetX?: number;
  targetY?: number;
}

export const SlideLayoutsModal: React.FC<SlideLayoutsModalProps> = ({
  onClose,
  targetX = 300,
  targetY = 200,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<SlideCategoryId | 'all'>('all');
  const { addElements, elements } = useBoardStore();
  const { setSelectedElementIds } = useUIStore();

  const filtered = useMemo(
    () =>
      SLIDE_LAYOUTS.filter(
        (layout) =>
          (activeCategory === 'all' || layout.category === activeCategory) &&
          slideLayoutMatchesQuery(layout, searchQuery)
      ),
    [searchQuery, activeCategory]
  );

  const handleSelectLayout = (layout: SlideLayoutDef) => {
    // Cascade successive slides so they don't stack exactly on top of each other.
    const startX = targetX + (elements.length % 4) * 50;
    const startY = targetY + (elements.length % 4) * 30;

    const created = buildSlide(layout, startX, startY);
    addElements(created);

    setSelectedElementIds([created[0].id]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-6 font-sans">
      <div className="w-full max-w-5xl h-[92vh] sm:h-[80vh] bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-3 sm:p-5 border-b border-slate-100 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                <Layout size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Slide layouts</h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {SLIDE_LAYOUTS.length} layouts — each one drops a ready-made slide frame onto the board
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search slide layouts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-zinc-800/80 border border-transparent focus:border-blue-500 rounded-xl text-xs text-slate-900 dark:text-white outline-none font-medium transition-all"
              />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <CategoryChip
                label="All"
                active={activeCategory === 'all'}
                onClick={() => setActiveCategory('all')}
              />
              {SLIDE_CATEGORIES.slice()
                .sort((a, b) => a.order - b.order)
                .map((cat) => (
                  <CategoryChip
                    key={cat.id}
                    label={cat.title}
                    active={activeCategory === cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                  />
                ))}
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 scrollbar-thin">
          {filtered.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-20">
              No layouts match your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {filtered.map((layout) => (
                <button
                  key={layout.id}
                  onClick={() => handleSelectLayout(layout)}
                  className="group text-left bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="aspect-[65/42] bg-slate-50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 overflow-hidden">
                    {/* Rendered from the layout's own build() output */}
                    <SlidePreview layout={layout} className="w-full h-full" />
                  </div>
                  <div className="p-3">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors truncate">
                      {layout.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-snug line-clamp-2">
                      {layout.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CategoryChip: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({
  label,
  active,
  onClick,
}) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors ${
      active
        ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/25'
        : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
    }`}
  >
    {label}
  </button>
);
