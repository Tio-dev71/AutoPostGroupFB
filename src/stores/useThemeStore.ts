// Store for theme/dark mode management
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
  setDark: (dark: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDark: true, // dark mode default
      toggleTheme: () =>
        set((state) => {
          const newDark = !state.isDark;
          document.documentElement.classList.toggle('dark', newDark);
          return { isDark: newDark };
        }),
      setDark: (dark: boolean) =>
        set(() => {
          document.documentElement.classList.toggle('dark', dark);
          return { isDark: dark };
        }),
    }),
    { name: 'autopost-theme' }
  )
);
