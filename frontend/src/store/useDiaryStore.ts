import { create } from 'zustand';

/**
 * The diary is deliberately personal and local.
 *
 * Board elements sync to every collaborator over the socket; a diary should
 * not. Entries live in localStorage under one key for the whole app, so the
 * same diary follows you between boards rather than fragmenting per board.
 */
const STORAGE_KEY = 'syncsketch-diary';

export interface DiarySticker {
  id: string;
  emoji: string;
  /** Position as a percentage of the page, so it survives resizing. */
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

export interface DiaryEntry {
  id: string;
  /** ISO date (yyyy-mm-dd) — one entry can be written per day, or several. */
  date: string;
  title: string;
  body: string;
  mood: string | null;
  stickers: DiarySticker[];
  createdAt: number;
  updatedAt: number;
}

interface DiaryState {
  entries: DiaryEntry[];
  activeEntryId: string | null;

  setActiveEntry: (id: string | null) => void;
  createEntry: () => string;
  updateEntry: (id: string, patch: Partial<Omit<DiaryEntry, 'id'>>) => void;
  deleteEntry: (id: string) => void;

  addSticker: (entryId: string, emoji: string) => void;
  moveSticker: (entryId: string, stickerId: string, x: number, y: number) => void;
  updateSticker: (entryId: string, stickerId: string, patch: Partial<DiarySticker>) => void;
  removeSticker: (entryId: string, stickerId: string) => void;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const readStored = (): DiaryEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // A corrupted diary should not take the whole board down.
    return [];
  }
};

let writeTimer: ReturnType<typeof setTimeout> | null = null;
/** Debounced so typing does not hit localStorage on every keystroke. */
const persist = (entries: DiaryEntry[]) => {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Out of quota, private mode — keep the session usable regardless.
    }
  }, 400);
};

const makeEntry = (): DiaryEntry => ({
  id: `diary_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
  date: todayIso(),
  title: '',
  body: '',
  mood: null,
  stickers: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const initial = readStored();

export const useDiaryStore = create<DiaryState>((set) => ({
  entries: initial,
  // Newest first, so opening the diary lands on the most recent page.
  activeEntryId: initial.length > 0 ? initial[0].id : null,

  setActiveEntry: (id) => set({ activeEntryId: id }),

  createEntry: () => {
    const entry = makeEntry();
    set((state) => {
      const entries = [entry, ...state.entries];
      persist(entries);
      return { entries, activeEntryId: entry.id };
    });
    return entry.id;
  },

  updateEntry: (id, patch) =>
    set((state) => {
      const entries = state.entries.map((e) =>
        e.id === id ? { ...e, ...patch, updatedAt: Date.now() } : e
      );
      persist(entries);
      return { entries };
    }),

  deleteEntry: (id) =>
    set((state) => {
      const entries = state.entries.filter((e) => e.id !== id);
      persist(entries);
      return {
        entries,
        activeEntryId:
          state.activeEntryId === id ? (entries.length > 0 ? entries[0].id : null) : state.activeEntryId,
      };
    }),

  addSticker: (entryId, emoji) =>
    set((state) => {
      const entries = state.entries.map((e) => {
        if (e.id !== entryId) return e;
        const sticker: DiarySticker = {
          id: `stk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          emoji,
          // Scatter new stickers a little so a run of them does not stack.
          x: 55 + Math.random() * 30,
          y: 12 + Math.random() * 65,
          // A slight tilt is what makes a page read as a scrapbook.
          rotation: Math.round((Math.random() - 0.5) * 26),
          scale: 1,
        };
        return { ...e, stickers: [...e.stickers, sticker], updatedAt: Date.now() };
      });
      persist(entries);
      return { entries };
    }),

  moveSticker: (entryId, stickerId, x, y) =>
    set((state) => {
      const entries = state.entries.map((e) =>
        e.id === entryId
          ? {
              ...e,
              stickers: e.stickers.map((s) =>
                s.id === stickerId
                  ? { ...s, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
                  : s
              ),
            }
          : e
      );
      persist(entries);
      return { entries };
    }),

  updateSticker: (entryId, stickerId, patch) =>
    set((state) => {
      const entries = state.entries.map((e) =>
        e.id === entryId
          ? { ...e, stickers: e.stickers.map((s) => (s.id === stickerId ? { ...s, ...patch } : s)) }
          : e
      );
      persist(entries);
      return { entries };
    }),

  removeSticker: (entryId, stickerId) =>
    set((state) => {
      const entries = state.entries.map((e) =>
        e.id === entryId ? { ...e, stickers: e.stickers.filter((s) => s.id !== stickerId) } : e
      );
      persist(entries);
      return { entries };
    }),
}));

/** Convenience selector used by the drawer header. */
export const selectActiveEntry = (state: DiaryState): DiaryEntry | undefined =>
  state.entries.find((e) => e.id === state.activeEntryId);
