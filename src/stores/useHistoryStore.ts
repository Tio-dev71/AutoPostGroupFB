// Store for post history
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface HistoryEntry {
  id: string;
  groupName: string;
  groupUrl: string;
  content: string;
  postUrl?: string;
  status: 'success' | 'failed';
  mediaCount: number;
  timestamp: string;
}

interface HistoryState {
  entries: HistoryEntry[];
  addEntry: (entry: Omit<HistoryEntry, 'id'>) => void;
  clearHistory: () => void;
  getEntriesByDate: (date: string) => HistoryEntry[];
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      entries: [],

      addEntry: (entry) =>
        set((state) => ({
          entries: [
            { ...entry, id: crypto.randomUUID() },
            ...state.entries,
          ],
        })),

      clearHistory: () => set({ entries: [] }),

      getEntriesByDate: (date) => {
        const { entries } = get();
        return entries.filter((e) => e.timestamp.startsWith(date));
      },
    }),
    { name: 'autopost-history' }
  )
);
