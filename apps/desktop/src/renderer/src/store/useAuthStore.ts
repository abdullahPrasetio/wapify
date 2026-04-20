import { create } from 'zustand'
import { apiClient, setAuthToken } from '../api/client'
import type { User, LoginResponse } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await apiClient.post<LoginResponse>('/api/v1/auth/login', {
        email,
        password
      })

      if (response.status === 200 && (response.data as LoginResponse).token) {
        const { token, refresh_token, user } = response.data as LoginResponse
        setAuthToken(token)
        if (refresh_token) {
          await window.api.setToken(refresh_token)
        }
        set({ user, token, isAuthenticated: true, isLoading: false, error: null })
      } else {
        const errData = response.data as { error?: string }
        set({ isLoading: false, error: errData?.error ?? 'Login gagal. Periksa kredensial Anda.' })
      }
    } catch {
      set({
        isLoading: false,
        error: 'Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.'
      })
    }
  },

  logout: async () => {
    setAuthToken(null)
    await window.api.deleteToken()
    set({ user: null, token: null, isAuthenticated: false, error: null })
  },

  clearError: () => set({ error: null })
}))
