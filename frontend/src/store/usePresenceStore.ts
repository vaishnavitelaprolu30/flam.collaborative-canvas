import { create } from 'zustand';

export interface Collaborator {
  userId: string;
  displayName: string;
  avatar: string;
  presenceColor: string;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  activeTool: string;
  activity: 'idle' | 'drawing' | 'typing' | 'moving' | 'presenting';
  lastActive: number;
  trailPoints?: { x: number; y: number; opacity: number }[];
  drawingElement?: any;
  selectedElementIds?: string[];
  editingElementId?: string;
}

export interface LocalUser {
  userId: string;
  displayName: string;
  avatar: string;
  presenceColor: string;
}

interface PresenceState {
  collaborators: Record<string, Collaborator>;
  localUser: LocalUser;
  cursorTrails: boolean;
  followingUserId: string | null;

  // Actions
  updateCollaborator: (userId: string, updates: Partial<Collaborator>) => void;
  removeCollaborator: (userId: string) => void;
  setLocalUser: (updates: Partial<LocalUser>) => void;
  setCursorTrails: (enabled: boolean) => void;
  setFollowingUserId: (id: string | null) => void;
  clearCollaborators: () => void;
}

const colors = ['#f97316', '#10b981', '#8b5cf6', '#f43f5e', '#0ea5e9', '#f59e0b', '#14b8a6', '#ec4899'];
const animals = ['Fox', 'Panda', 'Owl', 'Koala', 'Eagle', 'Badger', 'Deer', 'Cat', 'Wolf'];
const adjectives = ['Design', 'Creative', 'Artistic', 'Sketch', 'Vector', 'Pixel', 'Drawing', 'Canvas', 'Draft'];

const generateRandomUser = (): LocalUser => {
  const userId = Math.random().toString(36).substring(2, 9);
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const displayName = `${adj} ${animal}`;
  const avatar = (displayName.match(/\b\w/g) || []).join('').toUpperCase();
  const presenceColor = colors[Math.floor(Math.random() * colors.length)];
  
  return { userId, displayName, avatar, presenceColor };
};

export const usePresenceStore = create<PresenceState>((set) => ({
  collaborators: {},
  localUser: generateRandomUser(),
  cursorTrails: true,
  followingUserId: null,

  updateCollaborator: (userId, updates) =>
    set((state) => {
      const current = state.collaborators[userId] || {
        userId,
        displayName: 'Guest',
        avatar: 'G',
        presenceColor: '#64748b',
        x: 0,
        y: 0,
        activeTool: 'select',
        activity: 'idle',
        lastActive: Date.now(),
        trailPoints: []
      };
      
      return {
        collaborators: {
          ...state.collaborators,
          [userId]: { ...current, ...updates, lastActive: Date.now() }
        }
      };
    }),

  removeCollaborator: (userId) =>
    set((state) => {
      const next = { ...state.collaborators };
      delete next[userId];
      
      // Stop following if the followed user left
      const followingUserId = state.followingUserId === userId ? null : state.followingUserId;
      
      return { collaborators: next, followingUserId };
    }),

  setLocalUser: (updates) =>
    set((state) => ({
      localUser: { ...state.localUser, ...updates }
    })),

  setCursorTrails: (cursorTrails) => set({ cursorTrails }),
  
  setFollowingUserId: (followingUserId) => set({ followingUserId }),

  clearCollaborators: () => set({ collaborators: {}, followingUserId: null })
}));
