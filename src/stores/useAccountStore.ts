// Store for Facebook account profiles
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AccountProfile {
  id: string;
  name: string;
  email: string;
  password: string;
  isActive: boolean;
  isConnected: boolean;
  avatarUrl?: string;
  lastLogin?: string;
  createdAt: string;
}

interface AccountState {
  profiles: AccountProfile[];
  activeProfileId: string | null;
  addProfile: (profile: Omit<AccountProfile, 'id' | 'createdAt'>) => void;
  updateProfile: (id: string, updates: Partial<AccountProfile>) => void;
  removeProfile: (id: string) => void;
  setActiveProfile: (id: string) => void;
  getActiveProfile: () => AccountProfile | undefined;
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeProfileId: null,

      addProfile: (profile) =>
        set((state) => ({
          profiles: [
            ...state.profiles,
            {
              ...profile,
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      updateProfile: (id, updates) =>
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),

      removeProfile: (id) =>
        set((state) => ({
          profiles: state.profiles.filter((p) => p.id !== id),
          activeProfileId:
            state.activeProfileId === id ? null : state.activeProfileId,
        })),

      setActiveProfile: (id) => set({ activeProfileId: id }),

      getActiveProfile: () => {
        const state = get();
        return state.profiles.find((p) => p.id === state.activeProfileId);
      },
    }),
    { name: 'autopost-accounts' }
  )
);
