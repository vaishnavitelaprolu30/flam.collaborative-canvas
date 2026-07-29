import React, { useState, useEffect, useRef } from 'react';
import { 
  Trash2, Copy, Lock, Unlock, Link2, Sparkles, 
  MoreHorizontal, ChevronDown, Type, Bold, AlignLeft, 
  AlignCenter, AlignRight, Send, ArrowRight
} from 'lucide-react';
import { CanvasElement } from '../types/canvas';

interface FloatingToolbarProps {
  selectedIds: string[];
  elements: CanvasElement[];
  pan: { x: number; y: number };
  zoom: number;
  containerEl: HTMLDivElement | null;
  onUpdateElement: (id: string, updates: Partial<CanvasElement>) => void;
  onDeleteElement: (id: string) => void;
  onDuplicate: () => void;
  onTriggerAI: (action: 'explain' | 'summarize' | 'ask', prompt?: string) => void;
  onAddConnector?: (fromId: string, toId: string) => void;
}

const PASTEL_COLORS = [
  '#fef08a', // Yellow
  '#fbcfe8', // Pink
  '#bfdbfe', // Blue
  '#bbf7d0', // Green
  '#fed7aa', // Orange
  '#e9d5ff', // Purple
  '#e2e8f0', // Grey
  '#ffffff'  // White
];

const STANDARD_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Green
  '#f59e0b', // Orange
  '#8b5cf6', // Purple
  '#09090b', // Black
  '#f4f4f5'  // White
];

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  selectedIds,
  elements,
  pan,
  zoom,
  containerEl,
  onUpdateElement,
  onDeleteElement,
  onDuplicate,
  onTriggerAI,
  onAddConnector
}) => {
  const [activeMenu, setActiveMenu] = useState<'fill' | 'stroke' | 'border' | 'font' | 'size' | 'align' | 'sticky-color' | 'reactions' | 'convert' | 'more' | 'emoji-change' | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [isLinkLabelOpen, setIsLinkLabelOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Close menus on clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
        setIsLinkLabelOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  if (selectedIds.length === 0 || !containerEl) return null;

  // 1. Calculate selection bounding box in canvas space
  const selectedElements = elements.filter(el => selectedIds.includes(el.id));
  if (selectedElements.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  selectedElements.forEach(el => {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + (el.width || 0));
    maxY = Math.max(maxY, el.y + (el.height || 0));
  });

  // Calculate midpoints in screen coordinates
  const rect = containerEl.getBoundingClientRect();
  const screenMinX = minX * zoom + pan.x + rect.left;
  const screenMinY = minY * zoom + pan.y + rect.top;
  const screenMaxX = maxX * zoom + pan.x + rect.left;
  const screenMaxY = maxY * zoom + pan.y + rect.top;

  const width = screenMaxX - screenMinX;
  const toolbarWidth = selectedIds.length > 1 ? 380 : 320;
  const toolbarHeight = 44;

  let left = screenMinX + width / 2 - toolbarWidth / 2;
  let top = screenMinY - toolbarHeight - 12;

  // Viewport constraints: place below selection if too close to top
  if (top < rect.top + 60) {
    top = screenMaxY + 12;
  }
  // Keep horizontally within viewport bounds
  left = Math.max(rect.left + 16, Math.min(rect.right - toolbarWidth - 16, left));

  const isMulti = selectedIds.length > 1;
  const firstElement = selectedElements[0];
  const primaryType = firstElement.type;



  // Contextual helper classes
  const btnClass = "p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-655 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors flex items-center gap-1 font-semibold text-xs disabled:opacity-40 disabled:cursor-not-allowed";

  // Actions
  const handleLockToggle = () => {
    selectedElements.forEach(el => {
      onUpdateElement(el.id, { isLocked: !el.isLocked });
    });
    setActiveMenu(null);
  };

  const handleAlign = (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (selectedElements.length < 2) return;
    
    switch (alignment) {
      case 'left': {
        const targetX = Math.min(...selectedElements.map(el => el.x));
        selectedElements.forEach(el => onUpdateElement(el.id, { x: targetX }));
        break;
      }
      case 'center': {
        const centers = selectedElements.map(el => el.x + el.width / 2);
        const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
        selectedElements.forEach(el => onUpdateElement(el.id, { x: avgCenter - el.width / 2 }));
        break;
      }
      case 'right': {
        const targetX = Math.max(...selectedElements.map(el => el.x + el.width));
        selectedElements.forEach(el => onUpdateElement(el.id, { x: targetX - el.width }));
        break;
      }
      case 'top': {
        const targetY = Math.min(...selectedElements.map(el => el.y));
        selectedElements.forEach(el => onUpdateElement(el.id, { y: targetY }));
        break;
      }
      case 'middle': {
        const centersY = selectedElements.map(el => el.y + el.height / 2);
        const avgCenterY = centersY.reduce((a, b) => a + b, 0) / centersY.length;
        selectedElements.forEach(el => onUpdateElement(el.id, { y: avgCenterY - el.height / 2 }));
        break;
      }
      case 'bottom': {
        const targetY = Math.max(...selectedElements.map(el => el.y + el.height));
        selectedElements.forEach(el => onUpdateElement(el.id, { y: targetY - el.height }));
        break;
      }
    }
  };

  const handleDistribute = (axis: 'horizontal' | 'vertical') => {
    if (selectedElements.length < 3) return;
    const sorted = [...selectedElements].sort((a, b) => axis === 'horizontal' ? a.x - b.x : a.y - b.y);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    if (axis === 'horizontal') {
      const firstCenter = first.x + first.width / 2;
      const lastCenter = last.x + last.width / 2;
      const step = (lastCenter - firstCenter) / (sorted.length - 1);
      for (let i = 1; i < sorted.length - 1; i++) {
        const targetCenter = firstCenter + i * step;
        onUpdateElement(sorted[i].id, { x: targetCenter - sorted[i].width / 2 });
      }
    } else {
      const firstCenter = first.y + first.height / 2;
      const lastCenter = last.y + last.height / 2;
      const step = (lastCenter - firstCenter) / (sorted.length - 1);
      for (let i = 1; i < sorted.length - 1; i++) {
        const targetCenter = firstCenter + i * step;
        onUpdateElement(sorted[i].id, { y: targetCenter - sorted[i].height / 2 });
      }
    }
  };

  const handleConvertType = (type: 'rectangle' | 'sticky' | 'text') => {
    selectedElements.forEach(el => {
      if (el.type === 'connector') return;
      onUpdateElement(el.id, { type: type as any });
    });
    setActiveMenu(null);
  };

  const handleAddReaction = (emoji: string) => {
    selectedElements.forEach(el => {
      if (el.type === 'sticky') {
        const reactions = { ...(el as any).reactions };
        reactions[emoji] = (reactions[emoji] || 0) + 1;
        onUpdateElement(el.id, { reactions });
      }
    });
    setActiveMenu(null);
  };

  const handleVote = () => {
    selectedElements.forEach(el => {
      if (el.type === 'sticky') {
        const votes = [...((el as any).votes || [])];
        const hasVoted = votes.includes('local-user');
        const nextVotes = hasVoted 
          ? votes.filter(id => id !== 'local-user')
          : [...votes, 'local-user'];
        onUpdateElement(el.id, { votes: nextVotes });
      }
    });
  };

  const handleBatchColor = (color: string) => {
    selectedElements.forEach(el => {
      if (el.type === 'sticky') {
        onUpdateElement(el.id, { fill: color, stickyColor: color });
      } else if (el.type === 'text') {
        onUpdateElement(el.id, { stroke: color });
      } else {
        onUpdateElement(el.id, { fill: color });
      }
    });
    setActiveMenu(null);
  };

  const handleApplyLink = () => {
    selectedElements.forEach(el => {
      onUpdateElement(el.id, { isImportant: !!linkUrl }); // Using isImportant as proxy flag or storing inside custom properties
    });
    setIsLinkLabelOpen(false);
  };

  return (
    <div 
      ref={toolbarRef}
      className="fixed z-40 bg-white/95 dark:bg-zinc-900/95 border border-slate-200 dark:border-zinc-800 shadow-xl rounded-2xl p-1.5 flex items-center gap-1 text-slate-800 dark:text-zinc-100 backdrop-blur-md select-none animate-in fade-in slide-in-from-bottom-2 duration-150"
      style={{
        left: `${left}px`,
        top: `${top - window.scrollY}px`,
        height: `${toolbarHeight}px`
      }}
    >
      {/* 1. Homogeneous Multi Selection Toolbar */}
      {isMulti ? (
        <>
          {/* Alignment Tools (SVGs to ensure premium Miro/Figma likeness) */}
          <button onClick={() => handleAlign('left')} className={btnClass} title="Align Left">
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <rect x="2" y="2" width="2" height="12" rx="0.5"/>
              <rect x="6" y="4" width="8" height="2" rx="0.5"/>
              <rect x="6" y="9" width="5" height="2" rx="0.5"/>
            </svg>
          </button>
          <button onClick={() => handleAlign('center')} className={btnClass} title="Align Center">
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <rect x="7" y="2" width="2" height="12" rx="0.5"/>
              <rect x="4" y="4" width="8" height="2" rx="0.5"/>
              <rect x="5" y="9" width="6" height="2" rx="0.5"/>
            </svg>
          </button>
          <button onClick={() => handleAlign('right')} className={btnClass} title="Align Right">
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <rect x="12" y="2" width="2" height="12" rx="0.5"/>
              <rect x="2" y="4" width="8" height="2" rx="0.5"/>
              <rect x="5" y="9" width="5" height="2" rx="0.5"/>
            </svg>
          </button>
          
          <div className="h-4 w-px bg-slate-200 dark:bg-zinc-800 mx-1"></div>

          <button onClick={() => handleAlign('top')} className={btnClass} title="Align Top">
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <rect x="2" y="2" width="12" height="2" rx="0.5"/>
              <rect x="4" y="6" width="2" height="8" rx="0.5"/>
              <rect x="9" y="6" width="2" height="5" rx="0.5"/>
            </svg>
          </button>
          <button onClick={() => handleAlign('middle')} className={btnClass} title="Align Middle">
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <rect x="2" y="7" width="12" height="2" rx="0.5"/>
              <rect x="4" y="4" width="2" height="8" rx="0.5"/>
              <rect x="9" y="5" width="2" height="6" rx="0.5"/>
            </svg>
          </button>
          <button onClick={() => handleAlign('bottom')} className={btnClass} title="Align Bottom">
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <rect x="2" y="12" width="12" height="2" rx="0.5"/>
              <rect x="4" y="2" width="2" height="8" rx="0.5"/>
              <rect x="9" y="5" width="2" height="5" rx="0.5"/>
            </svg>
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-zinc-800 mx-1"></div>

          {/* Distribute Tools */}
          <button onClick={() => handleDistribute('horizontal')} className={btnClass} title="Distribute Horizontally">
            <span className="text-[10px] font-bold">H-Dist</span>
          </button>
          <button onClick={() => handleDistribute('vertical')} className={btnClass} title="Distribute Vertically">
            <span className="text-[10px] font-bold">V-Dist</span>
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-zinc-800 mx-1"></div>

          {/* Connect Selected Elements */}
          {selectedIds.length === 2 && onAddConnector && (
            <button 
              onClick={() => onAddConnector(selectedIds[0], selectedIds[1])}
              className={btnClass}
              title="Connect elements with Connector"
            >
              <ArrowRight size={13} />
              <span>Connect</span>
            </button>
          )}

          {/* Batch Color Change */}
          <button 
            onClick={() => setActiveMenu(activeMenu === 'fill' ? null : 'fill')} 
            className={btnClass}
            title="Batch Set Color"
          >
            <span className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-zinc-700 bg-brand-500"></span>
          </button>
        </>
      ) : (
        /* 2. Single Selection Toolbars */
        <>
          {/* TYPE A: STICKY NOTE */}
          {primaryType === 'sticky' && (
            <>
              {/* Sticky Colors */}
              <button 
                onClick={() => setActiveMenu(activeMenu === 'sticky-color' ? null : 'sticky-color')} 
                className={btnClass}
                title="Sticky Color"
              >
                <span 
                  className="w-3.5 h-3.5 rounded-md border border-slate-300 dark:border-zinc-700" 
                  style={{ backgroundColor: firstElement.fill && firstElement.fill !== 'transparent' ? firstElement.fill : '#fef08a' }}
                ></span>
              </button>

              {/* Reaction Emojis */}
              <button 
                onClick={() => setActiveMenu(activeMenu === 'reactions' ? null : 'reactions')}
                className={btnClass}
                title="Add Reaction"
              >
                <span>👍</span>
              </button>

              {/* Voting Button */}
              <button onClick={handleVote} className={btnClass} title="Vote note">
                <span className="font-mono">▲ {((firstElement as any).votes || []).length}</span>
              </button>

              {/* Convert Dropdown */}
              <button 
                onClick={() => setActiveMenu(activeMenu === 'convert' ? null : 'convert')} 
                className={btnClass}
                title="Convert Sticky to Shape/Text"
              >
                <span>Convert</span>
                <ChevronDown size={10} />
              </button>
            </>
          )}

          {/* TYPE B: SHAPES (Rectangle, Rounded Rectangle, Ellipse, Triangle, Diamond, Hexagon, Star, Line, Arrow) */}
          {['rectangle', 'rounded-rectangle', 'ellipse', 'triangle', 'diamond', 'hexagon', 'star', 'line', 'arrow'].includes(primaryType) && (
            <>
              {/* Fill Color */}
              {!['line', 'arrow'].includes(primaryType) && (
                <button 
                  onClick={() => setActiveMenu(activeMenu === 'fill' ? null : 'fill')} 
                  className={btnClass}
                  title="Fill Color"
                >
                  <span className="text-[10px] font-bold">Fill</span>
                  <span 
                    className="w-2.5 h-2.5 rounded-full border border-slate-300 dark:border-zinc-700" 
                    style={{ backgroundColor: firstElement.fill && firstElement.fill !== 'transparent' ? firstElement.fill : 'transparent' }}
                  ></span>
                </button>
              )}

              {/* Stroke / Border Color */}
              <button 
                onClick={() => setActiveMenu(activeMenu === 'stroke' ? null : 'stroke')} 
                className={btnClass}
                title="Stroke Color"
              >
                <span className="text-[10px] font-bold">Stroke</span>
                <span 
                  className="w-2.5 h-2.5 rounded-full border border-slate-300 dark:border-zinc-700" 
                  style={{ backgroundColor: firstElement.stroke }}
                ></span>
              </button>

              {/* Border Width Selection */}
              <button 
                onClick={() => setActiveMenu(activeMenu === 'border' ? null : 'border')} 
                className={btnClass}
                title="Border Settings"
              >
                <span className="text-[10px] font-bold">Border</span>
                <span className="text-[9px] font-mono font-bold">({firstElement.strokeWidth}px)</span>
              </button>
            </>
          )}

          {/* TYPE C: TEXT ELEMENT */}
          {primaryType === 'text' && (
            <>
              {/* Font Family selector */}
              <button 
                onClick={() => setActiveMenu(activeMenu === 'font' ? null : 'font')}
                className={btnClass}
                title="Font Family"
              >
                <Type size={13} />
                <span className="capitalize text-[10px] truncate max-w-[50px]">{(firstElement as any).fontFamily || 'Sans'}</span>
              </button>

              {/* Text Size adjusters */}
              <button 
                onClick={() => setActiveMenu(activeMenu === 'size' ? null : 'size')}
                className={btnClass}
                title="Font Size"
              >
                <span className="font-mono text-[10px]">{Math.round((firstElement as any).fontSize || 16)}px</span>
              </button>

              {/* Text Bold style */}
              <button 
                onClick={() => {
                  const isBold = (firstElement as any).fontWeight === 'bold';
                  onUpdateElement(firstElement.id, { fontWeight: isBold ? 'normal' : 'bold' });
                }} 
                className={`${btnClass} ${(firstElement as any).fontWeight === 'bold' ? 'bg-slate-200 dark:bg-zinc-800' : ''}`}
                title="Bold"
              >
                <Bold size={13} />
              </button>

              {/* Text Color (using stroke) */}
              <button 
                onClick={() => setActiveMenu(activeMenu === 'stroke' ? null : 'stroke')}
                className={btnClass}
                title="Text Color"
              >
                <span 
                  className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-zinc-700"
                  style={{ backgroundColor: firstElement.stroke }}
                ></span>
              </button>

              {/* Alignments */}
              <button 
                onClick={() => {
                  const aligns: ('left' | 'center' | 'right')[] = ['left', 'center', 'right'];
                  const curIndex = aligns.indexOf((firstElement as any).align || 'left');
                  const nextAlign = aligns[(curIndex + 1) % aligns.length];
                  onUpdateElement(firstElement.id, { align: nextAlign });
                }}
                className={btnClass}
                title="Align"
              >
                {((firstElement as any).align === 'center') ? <AlignCenter size={13} /> :
                 ((firstElement as any).align === 'right') ? <AlignRight size={13} /> : <AlignLeft size={13} />}
              </button>
            </>
          )}
          {/* TYPE D: EMOJI ELEMENT */}
          {primaryType === 'emoji' && (
            <>
              {/* Change Emoji */}
              <button 
                onClick={() => setActiveMenu(activeMenu === 'emoji-change' ? null : 'emoji-change')}
                className={btnClass}
                title="Change Emoji"
              >
                <span className="text-[13px]">{(firstElement as any).emoji}</span>
                <span className="text-[10px] font-bold">Change</span>
              </button>

              {/* Size Button */}
              <button 
                onClick={() => setActiveMenu(activeMenu === 'size' ? null : 'size')}
                className={btnClass}
                title="Emoji Size"
              >
                <span className="text-[10px] font-bold">Size</span>
                <span className="text-[9px] font-mono font-bold">({Math.round((firstElement as any).fontSize || 48)}px)</span>
              </button>
            </>
          )}

          {/* TYPE E: FRAME AREA */}
          {primaryType === 'frame' && (
            <>
              {/* Background Color */}
              <button 
                onClick={() => setActiveMenu(activeMenu === 'fill' ? null : 'fill')} 
                className={btnClass}
                title="Frame Background Color"
              >
                <span className="text-[10px] font-bold">Fill</span>
                <span 
                  className="w-2.5 h-2.5 rounded border border-slate-300 dark:border-zinc-700" 
                  style={{ backgroundColor: firstElement.fill && firstElement.fill !== 'transparent' ? firstElement.fill : 'transparent' }}
                ></span>
              </button>
            </>
          )}

          {/* Duplicator button */}
          <button onClick={onDuplicate} className={btnClass} title="Duplicate Selected Shape">
            <Copy size={13} />
          </button>

          {/* Link button */}
          <button onClick={() => setIsLinkLabelOpen(!isLinkLabelOpen)} className={btnClass} title="Add link URL">
            <Link2 size={13} />
          </button>
        </>
      )}

      <div className="h-4 w-px bg-slate-200 dark:bg-zinc-800 mx-1"></div>

      {/* Shared Actions: Lock Toggle */}
      <button onClick={handleLockToggle} className={btnClass} title={firstElement.isLocked ? "Unlock" : "Lock"}>
        {firstElement.isLocked ? <Unlock size={13} /> : <Lock size={13} />}
      </button>

      {/* Shared Actions: AI Helper */}
      <button 
        onClick={() => onTriggerAI('explain')}
        disabled={firstElement.isLocked}
        className="p-1.5 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/20 dark:hover:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-lg font-bold transition-colors flex items-center gap-1 text-xs"
        title="Explain with AI"
      >
        <Sparkles size={12} className="animate-pulse" />
      </button>

      {/* More actions Menu */}
      <button 
        onClick={() => setActiveMenu(activeMenu === 'more' ? null : 'more')}
        className={btnClass}
        title="More Actions"
      >
        <MoreHorizontal size={13} />
      </button>

      {/* ==========================================
          POPOVER SUB-MENUS
          ========================================== */}
      {activeMenu === 'fill' && (
        <div className="absolute left-0 bottom-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-2.5 shadow-xl flex gap-1.5 animate-in fade-in duration-100">
          {PASTEL_COLORS.map(color => (
            <button 
              key={color}
              onClick={() => handleBatchColor(color)}
              className="w-5 h-5 rounded-full border border-slate-200 hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
            />
          ))}
          <button 
            onClick={() => handleBatchColor('transparent')}
            className="w-5 h-5 rounded-full border border-slate-200 hover:scale-110 transition-transform bg-slate-50 flex items-center justify-center font-bold text-[9px] text-slate-400"
          >
            ∅
          </button>
        </div>
      )}

      {activeMenu === 'stroke' && (
        <div className="absolute left-0 bottom-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-2.5 shadow-xl flex gap-1.5 animate-in fade-in duration-100">
          {STANDARD_COLORS.map(color => (
            <button 
              key={color}
              onClick={() => handleBatchColor(color)}
              className="w-5 h-5 rounded-full border border-slate-200 hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      )}

      {activeMenu === 'border' && (
        <div className="absolute left-1/4 bottom-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-2 flex flex-col gap-2 shadow-xl animate-in fade-in duration-100 font-sans">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1">Stroke Width</div>
          <div className="flex gap-1.5">
            {[1, 2, 4, 8].map(w => (
              <button 
                key={w}
                onClick={() => {
                  selectedElements.forEach(el => onUpdateElement(el.id, { strokeWidth: w }));
                  setActiveMenu(null);
                }}
                className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border ${
                  firstElement.strokeWidth === w 
                    ? 'bg-slate-100 border-slate-300 dark:bg-zinc-850 dark:border-zinc-700' 
                    : 'border-transparent hover:bg-slate-50 dark:hover:bg-zinc-800'
                }`}
              >
                {w}px
              </button>
            ))}
          </div>
        </div>
      )}

      {activeMenu === 'sticky-color' && (
        <div className="absolute left-0 bottom-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-2.5 shadow-xl flex gap-1.5 animate-in fade-in duration-100">
          {PASTEL_COLORS.map(color => (
            <button 
              key={color}
              onClick={() => handleBatchColor(color)}
              className="w-5 h-5 rounded-full border border-slate-200 hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      )}

      {activeMenu === 'reactions' && (
        <div className="absolute left-0 bottom-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-2 shadow-xl flex gap-2 animate-in fade-in duration-100">
          {['👍', '❤️', '🔥', '👏', '💡', '🎉', '😆', '😮', '😢', '🤔', '🚀', '👀'].map(emoji => (
            <button 
              key={emoji}
              onClick={() => handleAddReaction(emoji)}
              className="hover:scale-125 transition-transform text-sm"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {activeMenu === 'convert' && (
        <div className="absolute left-1/3 bottom-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-1 shadow-xl flex flex-col gap-0.5 animate-in fade-in duration-100 w-32 font-sans">
          <button 
            onClick={() => handleConvertType('rectangle')}
            className="w-full text-left py-1.5 px-3 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg text-xs font-medium"
          >
            Shape (Rect)
          </button>
          <button 
            onClick={() => handleConvertType('text')}
            className="w-full text-left py-1.5 px-3 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg text-xs font-medium"
          >
            Plain Text
          </button>
        </div>
      )}

      {activeMenu === 'font' && (
        <div className="absolute left-0 bottom-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-1 shadow-xl flex flex-col gap-0.5 animate-in fade-in duration-100 w-32 font-sans">
          {[
            { label: 'Sans-Serif', val: 'sans-serif' },
            { label: 'Serif', val: 'Georgia, serif' },
            { label: 'Monospace', val: 'Courier New, monospace' },
            { label: 'Comic', val: 'Comic Sans MS, cursive' }
          ].map(f => (
            <button 
              key={f.val}
              onClick={() => {
                onUpdateElement(firstElement.id, { fontFamily: f.val });
                setActiveMenu(null);
              }}
              className="w-full text-left py-1.5 px-3 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg text-xs font-medium"
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {activeMenu === 'size' && (
        <div className="absolute left-12 bottom-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-2.5 shadow-xl flex flex-col gap-2 animate-in fade-in duration-100 font-sans">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-550 px-1">Font Size</div>
          <div className="grid grid-cols-4 gap-1 w-44">
            {[12, 14, 16, 18, 24, 32, 48, 64].map(sz => (
              <button 
                key={sz}
                onClick={() => {
                  if (firstElement.type === 'emoji') {
                    onUpdateElement(firstElement.id, { fontSize: sz, width: sz, height: sz } as any);
                  } else {
                    onUpdateElement(firstElement.id, { fontSize: sz });
                  }
                  setActiveMenu(null);
                }}
                className={`py-1 text-[10px] font-mono font-bold rounded-lg border ${
                  (firstElement as any).fontSize === sz 
                    ? 'bg-slate-100 border-slate-300 dark:bg-zinc-850 dark:border-zinc-700' 
                    : 'border-transparent hover:bg-slate-50 dark:hover:bg-zinc-800'
                }`}
              >
                {sz}px
              </button>
            ))}
          </div>
        </div>
      )}

      {activeMenu === 'emoji-change' && (
        <div className="absolute left-0 bottom-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-2.5 shadow-xl grid grid-cols-8 gap-1 animate-in fade-in duration-100 max-h-36 overflow-y-auto w-56">
          {['😀', '😃', '😄', '😂', '😊', '😍', '😎', '🤔', '👍', '👎', '❤️', '🔥', '👏', '🎉', '💯', '⭐', '💡', '🚀', '🎯', '🧠', '💻', '📌', '📍', '✅', '❌', '⚠️', '❓', '✨', '👑'].map(emoji => (
            <button 
              key={emoji}
              onClick={() => {
                onUpdateElement(firstElement.id, { emoji } as any);
                setActiveMenu(null);
              }}
              className="w-6 h-6 flex items-center justify-center text-sm hover:bg-slate-100 dark:hover:bg-zinc-800 rounded transition-transform hover:scale-110"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {activeMenu === 'more' && (
        <div className="absolute right-0 bottom-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-1 shadow-xl flex flex-col gap-0.5 animate-in fade-in duration-100 w-36 font-sans">
          <button 
            onClick={() => {
              selectedElements.forEach(el => onDeleteElement(el.id));
              setActiveMenu(null);
            }}
            className="w-full text-left py-1.5 px-3 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 dark:hover:text-red-400 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <Trash2 size={12} />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Link URL prompt menu */}
      {isLinkLabelOpen && (
        <div className="absolute right-0 bottom-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-2.5 shadow-xl flex gap-2 animate-in fade-in duration-100 font-sans w-52">
          <input
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="Paste Link URL..."
            className="flex-1 px-2.5 py-1 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none"
          />
          <button 
            onClick={handleApplyLink}
            className="p-1 bg-brand-500 text-white rounded-lg hover:bg-brand-600"
          >
            <Send size={11} />
          </button>
        </div>
      )}
    </div>
  );
};
