import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { apiClient, setAuthToken } from '../api/client'
import type { User, LoginResponse } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  isRehydrating: boolean
  error: string | null

  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  rehydrateAuth: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  subscribeWithSelector((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  isRehydrating: true,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await apiClient.post<LoginResponse>('/api/v1/auth/login', {
        email,
        password
      })

      if (response && response.status === 200 && (response.data as LoginResponse).token) {
        const { token, refresh_token, user } = response.data as LoginResponse
        setAuthToken(token)
        if (refresh_token && window.api) {
          await window.api.setToken(refresh_token)
        }
        set({ user, token, isAuthenticated: true, isLoading: false, error: null })
      } else {
        const errData = response?.data as { error?: string }
        set({ isLoading: false, error: errData?.error ?? 'Login gagal. Periksa kredensial Anda.' })
      }
    } catch {
      set({
        isLoading: false,
        error: 'Tidak dapat terhubung ke server. Pastikan backend sedang berjalan atau gunakan Electron.'
      })
    }
  },

  logout: async () => {
    setAuthToken(null)
    if (window.api) {
      await window.api.deleteToken()
    }
    set({ user: null, token: null, isAuthenticated: false, error: null })
  },

  rehydrateAuth: async () => {
    set({ isRehydrating: true })
    try {
      const refreshToken = window.api ? await window.api.getToken() : null
      if (refreshToken) {
        // Coba refresh token
        const response = await apiClient.post<LoginResponse>('/api/v1/auth/refresh', {
          refresh_token: refreshToken
        })

        if (response && response.status === 200) {
          const { token, refresh_token: newRefreshToken, user } = response.data as LoginResponse
          setAuthToken(token)
          if (newRefreshToken && window.api) {
            await window.api.setToken(newRefreshToken)
          }
          set({ user, token, isAuthenticated: true, isRehydrating: false })
          return
        }
      }
    } catch (err) {
      console.error('[Auth] Rehydration failed:', err)
    }
    set({ isRehydrating: false, isAuthenticated: false })
  },

  clearError: () => set({ error: null })
})))
