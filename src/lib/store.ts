// =============================================================================
// Client-side UI state (Zustand)
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewKey =
  | 'dashboard'
  | 'scheduler'
  | 'pir'
  | 'logs'
  | 'ai'
  | 'energy'
  | 'ota'
  | 'settings';

type UiState = {
  currentView: ViewKey;
  setView: (v: ViewKey) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      currentView: 'dashboard',
      setView: (v) => set({ currentView: v }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    {
      name: 'timer12-ui',
      partialize: (s) => ({ currentView: s.currentView, sidebarCollapsed: s.sidebarCollapsed }),
    }
  )
);
