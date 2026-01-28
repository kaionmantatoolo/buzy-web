import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppSettings, DEFAULT_SETTINGS } from '@/lib/types';

interface SettingsState extends AppSettings {
  // Actions
  setDiscoveryRange: (range: number) => void;
  setUseCTBInfo: (use: boolean) => void;
  setLocale: (locale: 'en' | 'zh-Hant') => void;
  setDebugUseMockLocation: (use: boolean) => void;
  setDebugMockLocation: (lat: number, lng: number) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      
      setDiscoveryRange: (range: number) => {
        set({ discoveryRange: range });
      },
      
      setUseCTBInfo: (use: boolean) => {
        set({ useCTBInfoForJointRoutes: use });
      },
      
      setLocale: (locale: 'en' | 'zh-Hant') => {
        set({ locale });
      },

      setDebugUseMockLocation: (use: boolean) => {
        set({ debugUseMockLocation: use });
      },

      setDebugMockLocation: (lat: number, lng: number) => {
        set({ debugMockLat: lat, debugMockLng: lng });
      },
      
      resetSettings: () => {
        set(DEFAULT_SETTINGS);
      },
    }),
    {
      name: 'buzy-settings',
    }
  )
);
