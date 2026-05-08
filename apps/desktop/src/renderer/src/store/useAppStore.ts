import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type AppView = 'request-builder' | 'admin-users' | 'admin-teams' | 'admin-licenses' | 'admin-donations' | 'history-detail'

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

  // UI Settings
  fontSize: number
  setFontSize: (size: number) => void
  theme: 'light' | 'dark' | 'system'
  setTheme: (theme: 'light' | 'dark' | 'system') => void

  // Donation Modal
  isDonationModalOpen: boolean
  setDonationModalOpen: (open: boolean) => void
  donationMessage: string
  setDonationMessage: (message: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeView: 'request-builder',
      setActiveView: (view) => set({ activeView: view }),
      activeHistoryId: null,
      setActiveHistoryId: (id) =>
        set({ activeHistoryId: id, activeView: id ? 'history-detail' : 'request-builder' }),

      activeTab: 'Body',
      setActiveTab: (tab) => set({ activeTab: tab }),

      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),

      fontSize: 13,
      setFontSize: (size) => set({ fontSize: size }),

      theme: 'dark',
      setTheme: (theme) => set({ theme }),

      isDonationModalOpen: false,
      setDonationModalOpen: (open) => set({ isDonationModalOpen: open }),
      donationMessage: '',
      setDonationMessage: (msg) => set({ donationMessage: msg })
    }),
    {
      name: 'wapbolt-app-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        fontSize: state.fontSize,
        theme: state.theme
      })
    }
  )
)
