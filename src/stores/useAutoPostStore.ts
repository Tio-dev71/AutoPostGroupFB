// Store for auto post session management
import { create } from 'zustand';

export type PostSessionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';
export type PostMode = 'continue' | 'restart';

export interface PostResult {
  groupId: string;
  groupName: string;
  groupUrl: string;
  status: 'success' | 'failed' | 'skipped';
  message?: string;
  postUrl?: string;
  timestamp: string;
}

interface AutoPostState {
  status: PostSessionStatus;
  mode: PostMode;
  groupsPerRun: number;
  minDelay: number; // minutes
  maxDelay: number; // minutes
  dailyLimit: number;
  postsToday: number;
  currentGroupIndex: number;
  totalGroups: number;
  currentGroupName: string;
  results: PostResult[];
  startTime?: string;

  setStatus: (status: PostSessionStatus) => void;
  setMode: (mode: PostMode) => void;
  setGroupsPerRun: (count: number) => void;
  setMinDelay: (minutes: number) => void;
  setMaxDelay: (minutes: number) => void;
  setDailyLimit: (limit: number) => void;
  startSession: (totalGroups: number) => void;
  updateProgress: (index: number, groupName: string) => void;
  addResult: (result: PostResult) => void;
  stopSession: () => void;
  resetSession: () => void;
  getProgress: () => number;
}

export const useAutoPostStore = create<AutoPostState>()((set, get) => ({
  status: 'idle',
  mode: 'continue',
  groupsPerRun: 0, // 0 = all
  minDelay: 5,
  maxDelay: 15,
  dailyLimit: 50,
  postsToday: 0,
  currentGroupIndex: 0,
  totalGroups: 0,
  currentGroupName: '',
  results: [],
  startTime: undefined,

  setStatus: (status) => set({ status }),
  setMode: (mode) => set({ mode }),
  setGroupsPerRun: (count) => set({ groupsPerRun: count }),
  setMinDelay: (minutes) => set({ minDelay: minutes }),
  setMaxDelay: (minutes) => set({ maxDelay: minutes }),
  setDailyLimit: (limit) => set({ dailyLimit: limit }),

  startSession: (totalGroups) =>
    set({
      status: 'running',
      totalGroups,
      currentGroupIndex: 0,
      results: [],
      startTime: new Date().toISOString(),
    }),

  updateProgress: (index, groupName) =>
    set({ currentGroupIndex: index, currentGroupName: groupName }),

  addResult: (result) =>
    set((state) => ({
      results: [...state.results, result],
      postsToday:
        result.status === 'success'
          ? state.postsToday + 1
          : state.postsToday,
    })),

  stopSession: () => set({ status: 'idle', currentGroupName: '' }),

  resetSession: () =>
    set({
      status: 'idle',
      currentGroupIndex: 0,
      totalGroups: 0,
      currentGroupName: '',
      results: [],
      startTime: undefined,
    }),

  getProgress: () => {
    const { currentGroupIndex, totalGroups } = get();
    if (totalGroups === 0) return 0;
    return Math.round((currentGroupIndex / totalGroups) * 100);
  },
}));
