// Store for Facebook group management
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FacebookGroup {
  id: string;
  name: string;
  url: string;
  status: 'joined' | 'pending' | 'unknown';
  isSelected: boolean;
  memberCount?: number;
  lastPosted?: string;
  addedAt: string;
}

interface GroupState {
  groups: FacebookGroup[];
  searchQuery: string;
  filterStatus: 'all' | 'joined' | 'pending' | 'unknown';

  addGroups: (urls: string[]) => void;
  removeGroup: (id: string) => void;
  toggleGroupSelection: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  updateGroup: (id: string, updates: Partial<FacebookGroup>) => void;
  setSearchQuery: (query: string) => void;
  setFilterStatus: (status: 'all' | 'joined' | 'pending' | 'unknown') => void;
  getFilteredGroups: () => FacebookGroup[];
  getSelectedGroups: () => FacebookGroup[];
  importFromText: (text: string) => void;
}

export const useGroupStore = create<GroupState>()(
  persist(
    (set, get) => ({
      groups: [],
      searchQuery: '',
      filterStatus: 'all',

      addGroups: (urls) =>
        set((state) => {
          const existingUrls = new Set(state.groups.map((g) => g.url));
          const newGroups = urls
            .filter((url) => url.trim() && !existingUrls.has(url.trim()))
            .map((url) => ({
              id: crypto.randomUUID(),
              name: extractGroupName(url.trim()),
              url: url.trim(),
              status: 'unknown' as const,
              isSelected: false,
              addedAt: new Date().toISOString(),
            }));
          return { groups: [...state.groups, ...newGroups] };
        }),

      removeGroup: (id) =>
        set((state) => ({
          groups: state.groups.filter((g) => g.id !== id),
        })),

      toggleGroupSelection: (id) =>
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === id ? { ...g, isSelected: !g.isSelected } : g
          ),
        })),

      selectAll: () =>
        set((state) => ({
          groups: state.groups.map((g) => ({ ...g, isSelected: true })),
        })),

      deselectAll: () =>
        set((state) => ({
          groups: state.groups.map((g) => ({ ...g, isSelected: false })),
        })),

      updateGroup: (id, updates) =>
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === id ? { ...g, ...updates } : g
          ),
        })),

      setSearchQuery: (query) => set({ searchQuery: query }),

      setFilterStatus: (status) => set({ filterStatus: status }),

      getFilteredGroups: () => {
        const { groups, searchQuery, filterStatus } = get();
        return groups.filter((g) => {
          const matchesSearch =
            !searchQuery ||
            g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            g.url.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesFilter =
            filterStatus === 'all' || g.status === filterStatus;
          return matchesSearch && matchesFilter;
        });
      },

      getSelectedGroups: () => get().groups.filter((g) => g.isSelected),

      importFromText: (text) => {
        const urls = text
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.startsWith('http'));
        get().addGroups(urls);
      },
    }),
    { name: 'autopost-groups' }
  )
);

function extractGroupName(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('groups');
    if (idx !== -1 && parts[idx + 1]) {
      return decodeURIComponent(parts[idx + 1]).replace(/[.-]/g, ' ');
    }
    return parts[parts.length - 1] || 'Unknown Group';
  } catch {
    return 'Unknown Group';
  }
}
