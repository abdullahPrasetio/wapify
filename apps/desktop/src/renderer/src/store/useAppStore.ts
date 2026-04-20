import { create } from 'zustand'

export type AppView = 'request-builder' | 'admin-users' | 'admin-teams'

interface AppState {
  // Navigation
  activeView: AppView
  setActiveView: (view: AppView) => void

  // Active Tab in Main Area (Request Builder)
  activeTab: 'Params' | 'Headers' | 'Body' | 'Auth'
  setActiveTab: (tab: 'Params' | 'Headers' | 'Body' | 'Auth') => void

  // Global Loading State
  isLoading: boolean
  setIsLoading: (isLoading: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeView: 'request-builder',
  setActiveView: (view) => set({ activeView: view }),

  activeTab: 'Body',
  setActiveTab: (tab) => set({ activeTab: tab }),

  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading })
}))
