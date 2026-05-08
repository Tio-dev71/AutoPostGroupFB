// Store for application settings
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AIProvider = 'openai' | 'gemini' | 'grok';

export interface ProxyConfig {
  enabled: boolean;
  host: string;
  port: string;
  username: string;
  password: string;
}

interface SettingsState {
  aiProvider: AIProvider;
  aiApiKey: string;
  chromePath: string;
  proxy: ProxyConfig;
  defaultMinDelay: number;
  defaultMaxDelay: number;
  defaultDailyLimit: number;
  enableNotifications: boolean;
  enableSound: boolean;
  language: 'vi' | 'en';

  setAiProvider: (provider: AIProvider) => void;
  setAiApiKey: (key: string) => void;
  setChromePath: (path: string) => void;
  setProxy: (proxy: Partial<ProxyConfig>) => void;
  setDefaultMinDelay: (minutes: number) => void;
  setDefaultMaxDelay: (minutes: number) => void;
  setDefaultDailyLimit: (limit: number) => void;
  toggleNotifications: () => void;
  toggleSound: () => void;
  setLanguage: (lang: 'vi' | 'en') => void;
  exportConfig: () => string;
  importConfig: (json: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      aiProvider: 'openai',
      aiApiKey: '',
      chromePath: '',
      proxy: {
        enabled: false,
        host: '',
        port: '',
        username: '',
        password: '',
      },
      defaultMinDelay: 5,
      defaultMaxDelay: 15,
      defaultDailyLimit: 50,
      enableNotifications: true,
      enableSound: true,
      language: 'vi',

      setAiProvider: (provider) => set({ aiProvider: provider }),
      setAiApiKey: (key) => set({ aiApiKey: key }),
      setChromePath: (path) => set({ chromePath: path }),
      setProxy: (proxy) =>
        set((state) => ({ proxy: { ...state.proxy, ...proxy } })),
      setDefaultMinDelay: (minutes) => set({ defaultMinDelay: minutes }),
      setDefaultMaxDelay: (minutes) => set({ defaultMaxDelay: minutes }),
      setDefaultDailyLimit: (limit) => set({ defaultDailyLimit: limit }),
      toggleNotifications: () =>
        set((state) => ({ enableNotifications: !state.enableNotifications })),
      toggleSound: () =>
        set((state) => ({ enableSound: !state.enableSound })),
      setLanguage: (lang) => set({ language: lang }),

      exportConfig: () => {
        const state = get();
        return JSON.stringify(
          {
            aiProvider: state.aiProvider,
            chromePath: state.chromePath,
            proxy: state.proxy,
            defaultMinDelay: state.defaultMinDelay,
            defaultMaxDelay: state.defaultMaxDelay,
            defaultDailyLimit: state.defaultDailyLimit,
          },
          null,
          2
        );
      },

      importConfig: (json) => {
        try {
          const config = JSON.parse(json);
          set({
            aiProvider: config.aiProvider || 'openai',
            chromePath: config.chromePath || '',
            proxy: config.proxy || {
              enabled: false,
              host: '',
              port: '',
              username: '',
              password: '',
            },
            defaultMinDelay: config.defaultMinDelay || 5,
            defaultMaxDelay: config.defaultMaxDelay || 15,
            defaultDailyLimit: config.defaultDailyLimit || 50,
          });
        } catch (e) {
          console.error('Failed to import config:', e);
        }
      },
    }),
    { name: 'autopost-settings' }
  )
);
