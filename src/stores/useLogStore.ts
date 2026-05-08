// Store for activity logging
import { create } from 'zustand';

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: string;
  details?: string;
}

interface LogState {
  entries: LogEntry[];
  addLog: (level: LogLevel, message: string, details?: string) => void;
  clearLogs: () => void;
  exportLogs: () => string;
}

export const useLogStore = create<LogState>()((set, get) => ({
  entries: [],

  addLog: (level, message, details) =>
    set((state) => ({
      entries: [
        ...state.entries,
        {
          id: crypto.randomUUID(),
          level,
          message,
          timestamp: new Date().toISOString(),
          details,
        },
      ],
    })),

  clearLogs: () => set({ entries: [] }),

  exportLogs: () => {
    const { entries } = get();
    return entries
      .map(
        (e) =>
          `[${new Date(e.timestamp).toLocaleString()}] [${e.level.toUpperCase()}] ${e.message}${e.details ? `\n  ${e.details}` : ''}`
      )
      .join('\n');
  },
}));
