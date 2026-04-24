import { create } from 'zustand'

export type AppView = 'request-builder' | 'admin-users' | 'admin-teams' | 'admin-licenses' | 'history-detail'

interface AppState {
  // Navigation
  activeView: AppView
  setActiveView: (view: AppView) => void
  activeHistoryId: number | null
  setActiveHistoryId: (id: number | null) => void

  // Active Tab in Main Area (Request Builder)
  activeTab:
    | 'Params'
    | 'Auth'
    | 'Headers'
    | 'Body'
    | 'Pre-request'
    | 'Tests'
    | 'Console'
    | 'Test Results'
    | 'Docs'
    | 'Settings'
  setActiveTab: (
    tab:
      | 'Params'
      | 'Auth'
      | 'Headers'
      | 'Body'
      | 'Pre-request'
      | 'Tests'
      | 'Console'
      | 'Test Results'
      | 'Docs'
      | 'Settings'
  ) => void

  // Global Loading State
  isLoading: boolean
  setIsLoading: (isLoading: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeView: 'request-builder',
  setActiveView: (view) => set({ activeView: view }),
  activeHistoryId: null,
  setActiveHistoryId: (id) =>
    set({ activeHistoryId: id, activeView: id ? 'history-detail' : 'request-builder' }),

  activeTab: 'Body',
  setActiveTab: (tab) => set({ activeTab: tab }),

  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading })
}))
