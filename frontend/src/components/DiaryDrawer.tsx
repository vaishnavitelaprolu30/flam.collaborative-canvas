import React, { useMemo, useRef, useState } from 'react';
import {
  X,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Search,
  Smile,
  List,
  Download,
  Flame,
} from 'lucide-react';
import { useDiaryStore } from '../store/useDiaryStore';
import { STICKER_CATEGORIES, stickerMatches } from '../diary/stickers';

interface DiaryDrawerProps {
  onClose: () => void;
}

/** How the writer felt that day, shown next to the date. */
const MOODS = ['😊', '🥰', '😌', '🤔', '😴', '😢', '😤', '🥳'];

/** Openers offered on a blank page, so nobody stares at an empty sheet. */
const PROMPTS = [
  { label: 'Gratitude', text: 'Three things I was glad about today:\n1. \n2. \n3. ' },
  { label: 'Reflect', text: 'What went well:\n\nWhat I would do differently:\n\nWhat I learned:\n' },
  { label: 'Today', text: 'Today I…\n\nThe best moment was…\n\nTomorrow I want to…\n' },
  { label: 'Vent', text: 'What is on my mind:\n\nWhy it bothers me:\n\nWhat I can control:\n' },
];

/**
 * Consecutive days written, counting back from the most recent entry.
 * Only counts a run that reaches today or yesterday, so an old streak that
 * was broken does not keep showing a number.
 */
const computeStreak = (dates: string[]): number => {
  if (dates.length === 0) return 0;

  const unique = [...new Set(dates)].sort().reverse();
  const dayMs = 86400000;
  const startOfDay = (iso: string) => new Date(`${iso}T00:00:00`).getTime();

  const today = startOfDay(new Date().toISOString().slice(0, 10));
  const latest = startOfDay(unique[0]);

  // A streak is live only if the last entry is today or yesterday.
  if (today - latest > dayMs) return 0;

  let streak = 1;
  for (let i = 1; i < unique.length; i++) {
    if (startOfDay(unique[i - 1]) - startOfDay(unique[i]) === dayMs) streak++;
    else break;
  }
  return streak;
};

const countWords = (text: string): number =>
  text.trim() ? text.trim().split(/\s+/).length : 0;

const formatLongDate = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export const DiaryDrawer: React.FC<DiaryDrawerProps> = ({ onClose }) => {
  const {
    entries,
    activeEntryId,
    setActiveEntry,
    createEntry,
    updateEntry,
    deleteEntry,
    addSticker,
    moveSticker,
    updateSticker,
    removeSticker,
  } = useDiaryStore();

  const [stickerQuery, setStickerQuery] = useState('');
  const [stickerCategory, setStickerCategory] = useState(STICKER_CATEGORIES[0].id);
  const [showStickers, setShowStickers] = useState(true);
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  const [showIndex, setShowIndex] = useState(false);
  const [entryQuery, setEntryQuery] = useState('');

  const streak = useMemo(() => computeStreak(entries.map((e) => e.date)), [entries]);

  const matchingEntries = useMemo(() => {
    const q = entryQuery.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.body.toLowerCase().includes(q) ||
        e.date.includes(q)
    );
  }, [entries, entryQuery]);

  /** Export the whole diary as one Markdown file. */
  const handleExport = () => {
    const doc = entries
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => {
        const stickers = e.stickers.map((s) => s.emoji).join(' ');
        return [
          `## ${e.date}${e.mood ? `  ${e.mood}` : ''}`,
          e.title ? `### ${e.title}` : '',
          e.body,
          stickers ? `\n${stickers}` : '',
        ]
          .filter(Boolean)
          .join('\n\n');
      })
      .join('\n\n---\n\n');

    const blob = new Blob([`# My Diary\n\n${doc}\n`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diary-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  const entry = entries.find((e) => e.id === activeEntryId);
  const index = entries.findIndex((e) => e.id === activeEntryId);

  const visibleStickers = useMemo(() => {
    if (stickerQuery.trim()) {
      return STICKER_CATEGORIES.flatMap((c) => c.stickers).filter((s) =>
        stickerMatches(s, stickerQuery)
      );
    }
    return STICKER_CATEGORIES.find((c) => c.id === stickerCategory)?.stickers ?? [];
  }, [stickerQuery, stickerCategory]);

  /** Drag a sticker around the page; coordinates are stored as percentages. */
  const handleStickerPointerDown = (e: React.PointerEvent, stickerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedSticker(stickerId);
    const rect = pageRef.current?.getBoundingClientRect();
    if (!rect) return;

    const sticker = entry?.stickers.find((s) => s.id === stickerId);
    if (!sticker) return;

    dragRef.current = {
      id: stickerId,
      offsetX: e.clientX - (rect.left + (sticker.x / 100) * rect.width),
      offsetY: e.clientY - (rect.top + (sticker.y / 100) * rect.height),
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleStickerPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const rect = pageRef.current?.getBoundingClientRect();
    if (!drag || !rect || !entry) return;

    moveSticker(
      entry.id,
      drag.id,
      ((e.clientX - drag.offsetX - rect.left) / rect.width) * 100,
      ((e.clientY - drag.offsetY - rect.top) / rect.height) * 100
    );
  };

  const handleStickerPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Capture may already be gone if the pointer left the window.
    }
  };

  return (
    <aside className="fixed left-2 sm:left-20 top-20 bottom-6 z-40 w-[min(27.5rem,calc(100vw-1rem))] sm:w-[min(27.5rem,calc(100vw-6rem))] flex flex-col rounded-3xl overflow-hidden shadow-2xl border border-amber-900/20 dark:border-zinc-800 bg-[#f5efe1] dark:bg-[#1c1a16] select-none animate-in slide-in-from-left-4 duration-200">
      {/* Cover strip */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#8b5e3c] to-[#a9714a] dark:from-[#3f2f22] dark:to-[#54402e] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">📔</span>
          <div>
            <h3 className="text-sm font-bold text-amber-50 leading-tight flex items-center gap-2">
              My Diary
              {streak > 0 && (
                <span
                  title={`${streak} day writing streak`}
                  className="flex items-center gap-0.5 text-[10px] font-bold bg-orange-500/90 text-white px-1.5 py-0.5 rounded-full"
                >
                  <Flame size={9} className="fill-current" />
                  {streak}
                </span>
              )}
            </h3>
            <p className="text-[10px] text-amber-100/70">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'} · saved on this device
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowIndex(!showIndex)}
            title="All entries"
            className={`p-1.5 rounded-xl transition-colors ${
              showIndex ? 'bg-white/25 text-amber-50' : 'text-amber-50 hover:bg-white/15'
            }`}
          >
            <List size={16} />
          </button>
          <button
            onClick={handleExport}
            disabled={entries.length === 0}
            title="Export diary as Markdown"
            className="p-1.5 rounded-xl text-amber-50 hover:bg-white/15 disabled:opacity-40 transition-colors"
          >
            <Download size={15} />
          </button>
          <button
            onClick={() => {
              createEntry();
              setShowIndex(false);
            }}
            title="New entry"
            className="p-1.5 rounded-xl text-amber-50 hover:bg-white/15 transition-colors"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={onClose}
            title="Close diary"
            className="p-1.5 rounded-xl text-amber-50 hover:bg-white/15 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {showIndex ? (
        /* Entry index: searchable list of every page written. */
        <div className="flex-1 min-h-0 flex flex-col bg-[#f5efe1] dark:bg-[#1c1a16]">
          <div className="p-3 border-b border-amber-900/10 dark:border-zinc-800 flex-shrink-0">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-amber-900/40"
              />
              <input
                value={entryQuery}
                onChange={(e) => setEntryQuery(e.target.value)}
                placeholder="Search everything you have written"
                className="w-full pl-8 pr-2 py-2 rounded-xl bg-white/70 dark:bg-zinc-900/70 text-[11px] text-amber-950 dark:text-amber-50 outline-none border border-transparent focus:border-amber-700/40"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1.5">
            {matchingEntries.length === 0 ? (
              <p className="text-center text-[11px] text-amber-900/40 dark:text-amber-100/30 py-10">
                Nothing matches “{entryQuery}”.
              </p>
            ) : (
              matchingEntries.map((e) => (
                <button
                  key={e.id}
                  onClick={() => {
                    setActiveEntry(e.id);
                    setShowIndex(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors border ${
                    e.id === activeEntryId
                      ? 'bg-[#e5d9bf] dark:bg-[#2e2a22] border-amber-700/40'
                      : 'bg-white/50 dark:bg-zinc-900/40 border-transparent hover:bg-white/80 dark:hover:bg-zinc-900/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-amber-900/60 dark:text-amber-100/50">
                      {e.date}
                    </span>
                    <span className="text-sm leading-none">{e.mood ?? ''}</span>
                  </div>
                  <div className="diary-hand text-[15px] text-[#3b2f24] dark:text-amber-50 truncate mt-0.5">
                    {e.title || 'Untitled page'}
                  </div>
                  <div className="text-[10px] text-amber-900/45 dark:text-amber-100/35 truncate mt-0.5">
                    {e.body.replace(/\n/g, ' ').slice(0, 70) || 'Empty'}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[9px] text-amber-900/40 dark:text-amber-100/30">
                    <span>{countWords(e.body)} words</span>
                    {e.stickers.length > 0 && <span>· {e.stickers.length} stickers</span>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : !entry ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <span className="text-4xl">🕯️</span>
          <p className="text-sm font-semibold text-amber-900/70 dark:text-amber-100/60">
            Nothing written yet
          </p>
          <p className="text-xs text-amber-900/50 dark:text-amber-100/40 leading-relaxed">
            Start a page and write whatever the day was like. Only you can see this — it stays
            on this device and never syncs to the board.
          </p>
          <button
            onClick={() => createEntry()}
            className="mt-1 px-4 py-2 rounded-xl bg-[#8b5e3c] hover:bg-[#7a5133] text-amber-50 text-xs font-bold transition-colors"
          >
            Write the first page
          </button>
        </div>
      ) : (
        <>
          {/* Date navigation */}
          <div className="flex items-center justify-between px-3 py-2 bg-[#e9dfc9] dark:bg-[#26231d] border-b border-amber-900/10 dark:border-zinc-800 flex-shrink-0">
            <button
              onClick={() => setActiveEntry(entries[index + 1]?.id ?? entry.id)}
              disabled={index >= entries.length - 1}
              title="Older entry"
              className="p-1 rounded-lg text-amber-900/60 dark:text-amber-100/50 hover:bg-amber-900/10 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={15} />
            </button>

            <input
              type="date"
              value={entry.date}
              onChange={(e) => updateEntry(entry.id, { date: e.target.value })}
              className="bg-transparent text-[11px] font-bold text-amber-900/80 dark:text-amber-100/70 outline-none text-center"
            />

            <button
              onClick={() => setActiveEntry(entries[index - 1]?.id ?? entry.id)}
              disabled={index <= 0}
              title="Newer entry"
              className="p-1 rounded-lg text-amber-900/60 dark:text-amber-100/50 hover:bg-amber-900/10 disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* The page */}
          <div className="flex-1 min-h-0 flex overflow-hidden">
            {/* Punched binding edge */}
            <div className="w-7 flex-shrink-0 bg-[#e2d6bd] dark:bg-[#211f1a] diary-binding" />

            <div
              ref={pageRef}
              className="diary-page flex-1 min-w-0 relative overflow-y-auto scrollbar-thin"
              onPointerMove={handleStickerPointerMove}
              onPointerUp={handleStickerPointerUp}
              onClick={() => setSelectedSticker(null)}
            >
              {/* Washi tape, purely decorative */}
              <div className="diary-tape absolute -top-1 left-16 w-24 h-6 rotate-[-4deg] pointer-events-none" />

              <div className="relative px-4 pt-8 pb-6 pl-[68px]">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="diary-hand text-[13px] text-amber-900/60 dark:text-amber-100/45">
                    {formatLongDate(entry.date)}
                  </span>
                  <span className="text-lg leading-none">{entry.mood ?? ''}</span>
                </div>

                <input
                  value={entry.title}
                  onChange={(e) => updateEntry(entry.id, { title: e.target.value })}
                  placeholder="Dear diary…"
                  className="diary-hand diary-title w-full bg-transparent text-2xl text-[#3b2f24] dark:text-amber-50 outline-none mb-2 placeholder:text-amber-900/25 dark:placeholder:text-amber-100/20"
                />

                <textarea
                  value={entry.body}
                  onChange={(e) => updateEntry(entry.id, { body: e.target.value })}
                  placeholder="How did today go?"
                  spellCheck
                  rows={14}
                  className="diary-hand diary-body w-full resize-none bg-transparent text-[17px] text-[#3b2f24] dark:text-amber-50/90 outline-none placeholder:text-amber-900/25 dark:placeholder:text-amber-100/20"
                />

                {/* Openers, offered only while the page is still blank. */}
                {!entry.body && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {PROMPTS.map((prompt) => (
                      <button
                        key={prompt.label}
                        onClick={() => updateEntry(entry.id, { body: prompt.text })}
                        className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-900/10 hover:bg-amber-900/20 text-amber-900/70 dark:bg-amber-100/10 dark:hover:bg-amber-100/20 dark:text-amber-100/60 transition-colors"
                      >
                        {prompt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Stickers layer */}
              {entry.stickers.map((sticker) => (
                <div
                  key={sticker.id}
                  onPointerDown={(e) => handleStickerPointerDown(e, sticker.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="diary-sticker absolute"
                  style={{
                    left: `${sticker.x}%`,
                    top: `${sticker.y}%`,
                    fontSize: `${28 * sticker.scale}px`,
                    transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg)`,
                    outline: selectedSticker === sticker.id ? '2px dashed rgba(139,94,60,0.6)' : 'none',
                    outlineOffset: '4px',
                    borderRadius: '6px',
                  }}
                >
                  {sticker.emoji}

                  {selectedSticker === sticker.id && (
                    <div
                      className="absolute -top-3 -right-3 flex gap-0.5"
                      style={{ transform: `rotate(${-sticker.rotation}deg)` }}
                    >
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateSticker(entry.id, sticker.id, {
                            scale: sticker.scale >= 1.8 ? 0.7 : sticker.scale + 0.35,
                          });
                        }}
                        title="Resize"
                        className="w-5 h-5 rounded-full bg-[#8b5e3c] text-amber-50 text-[10px] font-bold leading-none shadow"
                      >
                        ⤢
                      </button>
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSticker(entry.id, sticker.id);
                          setSelectedSticker(null);
                        }}
                        title="Remove sticker"
                        className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold leading-none shadow"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Mood + delete */}
          <div className="flex items-center justify-between px-3 py-2 bg-[#e9dfc9] dark:bg-[#26231d] border-t border-amber-900/10 dark:border-zinc-800 flex-shrink-0">
            <div className="flex items-center gap-1">
              {MOODS.map((mood) => (
                <button
                  key={mood}
                  onClick={() =>
                    updateEntry(entry.id, { mood: entry.mood === mood ? null : mood })
                  }
                  className={`w-7 h-7 rounded-lg text-base leading-none transition-all ${
                    entry.mood === mood
                      ? 'bg-[#8b5e3c] scale-110 shadow'
                      : 'hover:bg-amber-900/10 opacity-60 hover:opacity-100'
                  }`}
                  title={`Mood: ${mood}`}
                >
                  {mood}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                if (confirm('Delete this diary entry? This cannot be undone.')) {
                  deleteEntry(entry.id);
                }
              }}
              title="Delete entry"
              className="p-1.5 rounded-lg text-red-700/70 hover:text-red-700 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {/* Sticker tray */}
          <div className="flex-shrink-0 bg-[#f0e7d3] dark:bg-[#1f1d18] border-t border-amber-900/15 dark:border-zinc-800">
            <button
              onClick={() => setShowStickers(!showStickers)}
              className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold text-amber-900/70 dark:text-amber-100/60 hover:bg-amber-900/5"
            >
              <span className="flex items-center gap-1.5">
                <Smile size={13} />
                Stickers
              </span>
              <span className="opacity-60">{showStickers ? '▾' : '▸'}</span>
            </button>

            {showStickers && (
              <div className="px-3 pb-3">
                <div className="relative mb-2">
                  <Search
                    size={13}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-amber-900/40"
                  />
                  <input
                    value={stickerQuery}
                    onChange={(e) => setStickerQuery(e.target.value)}
                    placeholder="Search stickers"
                    className="w-full pl-8 pr-2 py-1.5 rounded-lg bg-white/70 dark:bg-zinc-900/70 text-[11px] text-amber-950 dark:text-amber-50 outline-none border border-transparent focus:border-amber-700/40"
                  />
                </div>

                {!stickerQuery && (
                  <div className="flex gap-1 overflow-x-auto scrollbar-none mb-2 pb-0.5">
                    {STICKER_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setStickerCategory(cat.id)}
                        title={cat.label}
                        className={`flex-shrink-0 px-2 py-1 rounded-lg text-sm transition-all ${
                          stickerCategory === cat.id
                            ? 'bg-[#8b5e3c] shadow scale-105'
                            : 'bg-white/60 dark:bg-zinc-900/60 hover:bg-white'
                        }`}
                      >
                        {cat.icon}
                      </button>
                    ))}
                  </div>
                )}

                {/* Capped at roughly two rows so the tray never crowds out the
                    page itself — it scrolls for the rest. */}
                <div className="grid grid-cols-9 gap-1 max-h-[76px] overflow-y-auto scrollbar-thin">
                  {visibleStickers.map((sticker, i) => (
                    <button
                      key={`${sticker.emoji}_${i}`}
                      onClick={() => addSticker(entry.id, sticker.emoji)}
                      title={sticker.name}
                      className="aspect-square rounded-lg text-lg leading-none flex items-center justify-center hover:bg-white dark:hover:bg-zinc-800 hover:scale-125 transition-transform"
                    >
                      {sticker.emoji}
                    </button>
                  ))}
                  {visibleStickers.length === 0 && (
                    <div className="col-span-9 text-center text-[11px] text-amber-900/40 py-4">
                      No stickers match “{stickerQuery}”
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
};
