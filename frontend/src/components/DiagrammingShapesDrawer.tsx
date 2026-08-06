import React, { useMemo, useState } from 'react';
import { X, Search, ChevronDown, ChevronUp, Sparkles, Upload } from 'lucide-react';
import { useUIStore } from '../store/useUIStore';
import { useBoardStore } from '../store/useBoardStore';
import {
  SHAPE_CATEGORIES,
  SHAPE_LIBRARY,
  ShapeDef,
  shapeMatchesQuery,
} from '../shapes/shapeLibrary';
import { ShapePreview } from '../shapes/ShapePreview';
import { DIAGRAM_TEMPLATES, DiagramTemplateDef, buildDiagram } from '../diagrams/diagramTemplates';

interface DiagrammingShapesDrawerProps {
  onClose: () => void;
}

/** Recolor presets applied to whatever shape is inserted next. */
const COLOR_THEMES = [
  { name: 'Shape default', hex: null },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Rose', hex: '#ef4444' },
  { name: 'Slate', hex: '#1e293b' },
];

/** Lighten a hex color toward white, for a fill that reads under dark text. */
const tint = (hex: string, amount = 0.82): string => {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  const r = mix(parseInt(clean.substring(0, 2), 16));
  const g = mix(parseInt(clean.substring(2, 4), 16));
  const b = mix(parseInt(clean.substring(4, 6), 16));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
};

export const DiagrammingShapesDrawer: React.FC<DiagrammingShapesDrawerProps> = ({ onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<string[]>([]);
  const [themeColor, setThemeColor] = useState<string | null>(null);
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const { addElement, addElements } = useBoardStore();
  const { setSelectedElementIds, pendingShapeId, setPendingShapeId, setMermaidModalOpen } =
    useUIStore();

  const toggleCategory = (cat: string) =>
    setCollapsedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );

  /** Group the manifest by category once per search term. */
  const grouped = useMemo(
    () =>
      SHAPE_CATEGORIES.slice()
        .sort((a, b) => a.order - b.order)
        .map((category) => ({
          category,
          shapes: SHAPE_LIBRARY.filter(
            (s) => s.category === category.id && shapeMatchesQuery(s, searchQuery)
          ),
          total: SHAPE_LIBRARY.filter((s) => s.category === category.id).length,
        }))
        .filter((group) => group.shapes.length > 0),
    [searchQuery]
  );

  const totalMatches = grouped.reduce((sum, g) => sum + g.shapes.length, 0);

  /**
   * Arm the shape rather than dropping it on the board.
   *
   * This is the behaviour people expect from a diagramming panel: pick a shape,
   * then drag on the canvas to draw it at the size you want (a plain click
   * places it at its default size). Clicking the armed shape again disarms it.
   */
  const handlePickShape = (shape: ShapeDef) => {
    setPendingShapeId(pendingShapeId === shape.id ? null : shape.id);
  };

  /** Dragging a swatch onto the canvas drops the shape where you release it. */
  const handleDragStart = (e: React.DragEvent, shape: ShapeDef) => {
    e.dataTransfer.setData(
      'application/x-syncsketch-shape',
      JSON.stringify({ shapeId: shape.id, color: themeColor })
    );
    e.dataTransfer.effectAllowed = 'copy';
  };

  /** Drops a ready-made, fully wired diagram at the centre of the viewport. */
  const handleInsertTemplate = (template: DiagramTemplateDef) => {
    const { pan, zoom } = useUIStore.getState();
    const originX = (window.innerWidth / 2 - pan.x) / zoom - 450;
    const originY = (window.innerHeight / 2 - pan.y) / zoom - 200;

    const created = buildDiagram(template, Math.round(originX), Math.round(originY));
    addElements(created);

    setSelectedElementIds(created.map((el) => el.id));
    setShowTemplates(false);
  };

  const handleUploadSvg = (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const now = Date.now();
      const id = `svg_${Math.random().toString(36).substring(2, 9)}`;
      addElement({
        id,
        type: 'image',
        src: evt.target?.result as string,
        x: 350,
        y: 250,
        width: 200,
        height: 200,
        rotation: 0,
        opacity: 1,
        stroke: 'transparent',
        strokeWidth: 0,
        fill: 'transparent',
        isLocked: false,
        createdBy: 'local-user',
        createdAt: now,
        updatedAt: now,
      } as any);
      setSelectedElementIds([id]);
    };
    reader.readAsDataURL(file);
  };

  return (
    <aside className="fixed left-2 sm:left-20 top-20 bottom-20 z-40 w-[min(20rem,calc(100vw-1rem))] sm:w-[min(20rem,calc(100vw-6rem))] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl rounded-3xl flex flex-col justify-between overflow-hidden select-none animate-in slide-in-from-left-4 duration-200 font-sans">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 dark:border-zinc-800/80 flex flex-col gap-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Diagramming shapes</h3>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
              {SHAPE_LIBRARY.length} shapes across {SHAPE_CATEGORIES.length} categories
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Close panel"
          >
            <X size={16} />
          </button>
        </div>

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search shapes"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-zinc-800/80 border border-transparent focus:border-blue-500 rounded-xl text-xs text-slate-900 dark:text-white outline-none font-medium transition-all"
          />
        </div>

        {/* Color theme applied to the next inserted shape */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
            Apply color
          </span>
          <div className="flex items-center gap-1.5">
            {COLOR_THEMES.map((c) => (
              <button
                key={c.name}
                onClick={() => setThemeColor(c.hex)}
                className={`w-4 h-4 rounded-full border transition-transform ${
                  themeColor === c.hex
                    ? 'scale-125 ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-zinc-900'
                    : 'hover:scale-110'
                } ${c.hex ? 'border-transparent' : 'border-slate-300 dark:border-zinc-600'}`}
                style={c.hex ? { backgroundColor: c.hex } : undefined}
                title={c.name}
              >
                {!c.hex && <span className="block text-[8px] leading-none text-slate-400">✕</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Armed-shape hint: without this the mode change is invisible */}
      {pendingShapeId && (
        <div className="mx-4 mb-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl flex items-center justify-between gap-2 flex-shrink-0">
          <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 leading-tight">
            Drag on the canvas to draw it, or click once to place it.
          </span>
          <button
            onClick={() => setPendingShapeId(null)}
            className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Categories */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {totalMatches === 0 && (
          <div className="text-center text-xs text-slate-400 py-12">
            No shapes match “{searchQuery}”.
          </div>
        )}

        {grouped.map(({ category, shapes, total }) => {
          const isOpen = !collapsedCategories.includes(category.id);

          return (
            <div key={category.id} className="border-b border-slate-100 dark:border-zinc-800/60 pb-3">
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between py-1 text-xs font-bold text-slate-800 dark:text-zinc-200 hover:text-blue-600 transition-colors"
              >
                <div className="flex items-center gap-2 text-left">
                  <span>{category.title}</span>
                  <span className="text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 font-medium px-1.5 py-0.5 rounded-full">
                    {searchQuery ? `${shapes.length} of ${total}` : total}
                  </span>
                </div>
                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {isOpen && (
                <>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 mb-2.5">
                    {category.blurb}
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {shapes.map((shape) => (
                      <button
                        key={shape.id}
                        onClick={() => handlePickShape(shape)}
                        draggable
                        onDragStart={(e) => handleDragStart(e, shape)}
                        onMouseEnter={() => setHoveredShapeId(shape.id)}
                        onMouseLeave={() => setHoveredShapeId(null)}
                        title={`${shape.label} — click then drag on the canvas, or drag this onto the board`}
                        className={`relative aspect-square p-2 rounded-xl flex items-center justify-center transition-all hover:scale-105 cursor-grab active:cursor-grabbing border ${
                          pendingShapeId === shape.id
                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/40'
                            : 'bg-slate-50 dark:bg-zinc-950 border-slate-200/80 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20'
                        }`}
                      >
                        {/* Same path data the canvas uses, so preview == result */}
                        <ShapePreview
                          shape={shape}
                          size={26}
                          fill={themeColor ? tint(themeColor) : undefined}
                          stroke={themeColor || undefined}
                        />

                        {hoveredShapeId === shape.id && (
                          <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-[10px] font-bold px-2.5 py-1 rounded-md shadow-xl whitespace-nowrap pointer-events-none">
                            {shape.label}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* Custom SVG upload */}
        <div className="pt-1">
          <div className="text-xs font-bold text-slate-800 dark:text-zinc-200 mb-2">My shapes</div>
          <input
            type="file"
            accept=".svg,image/svg+xml,image/*"
            id="svg-file-picker"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUploadSvg(file);
              e.target.value = '';
            }}
          />
          <label
            htmlFor="svg-file-picker"
            className="w-full py-2.5 bg-slate-50 dark:bg-zinc-950 border border-dashed border-slate-300 dark:border-zinc-700 hover:border-blue-500 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-300 flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Upload size={14} className="text-blue-500" />
            <span>Upload an SVG or image</span>
          </label>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-950/50 space-y-2 flex-shrink-0 relative">
        {/* Ready-made diagrams, wired with connectors */}
        {showTemplates && (
          <div className="absolute bottom-full left-4 right-4 mb-2 p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-h-72 overflow-y-auto scrollbar-thin space-y-1">
            {DIAGRAM_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => handleInsertTemplate(template)}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors group"
              >
                <div className="text-xs font-bold text-slate-800 dark:text-zinc-100 group-hover:text-blue-600">
                  {template.name}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-zinc-400 leading-snug">
                  {template.description}
                </div>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setCollapsedCategories([])}
          className="w-full py-2 bg-slate-200/80 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 font-bold text-xs rounded-xl transition-colors"
        >
          Expand all categories
        </button>

        <div className="flex gap-2">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all"
          >
            <Sparkles size={15} />
            <span>Create diagram ({DIAGRAM_TEMPLATES.length})</span>
          </button>
          <button
            onClick={() => setMermaidModalOpen(true)}
            title="Build with code (Mermaid)"
            className="px-3 py-2.5 bg-slate-200/80 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold text-xs rounded-xl transition-colors font-mono"
          >
            {'</>'}
          </button>
        </div>
      </div>
    </aside>
  );
};
