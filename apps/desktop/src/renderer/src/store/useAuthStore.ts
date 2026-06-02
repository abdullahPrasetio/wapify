import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { apiClient, setAuthToken, getBaseUrl } from '../api/client'
import type { User, LoginResponse } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  isRehydrating: boolean
  error: string | null

  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  handleGoogleCallback: (token: string, refreshToken: string) => Promise<void>
  logout: () => Promise<void>
  rehydrateAuth: () => Promise<void>
  refreshUser: () => Promise<void>
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
        // Fetch fresh user to get latest fields (e.g. is_premium)
        try {
          const meRes = await apiClient.get<User>('/api/v1/auth/me')
          if (meRes.status === 200) set({ user: meRes.data as User })
        } catch { /* silent */ }
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
          // Fetch fresh user data to get latest is_premium status
          try {
            const meRes = await apiClient.get<User>('/api/v1/auth/me')
            if (meRes.status === 200) {
              set({ user: meRes.data as User, token, isAuthenticated: true, isRehydrating: false })
              return
            }
          } catch { /* fallback to token user */ }
          set({ user, token, isAuthenticated: true, isRehydrating: false })
          return
        }
      }
    } catch (err) {
      console.error('[Auth] Rehydration failed:', err)
    }
    set({ isRehydrating: false, isAuthenticated: false })
  },

  refreshUser: async () => {
    try {
      const meRes = await apiClient.get<User>('/api/v1/auth/me')
      if (meRes.status === 200) {
        set({ user: meRes.data as User })
      }
    } catch { /* silent */ }
  },

  loginWithGoogle: async () => {
    if (!window.api?.openGoogleAuth) return
    const url = `${getBaseUrl()}/api/v1/auth/google`
    await window.api.openGoogleAuth(url)
  },

  handleGoogleCallback: async (token: string, refreshToken: string) => {
    set({ isLoading: true, error: null })
    try {
      if (window.api) {
        await window.api.setToken(refreshToken)
      }
      setAuthToken(token)
      const meRes = await apiClient.get<User>('/api/v1/auth/me')
      set({ user: meRes.data as User, token, isAuthenticated: true, isLoading: false })
    } catch {
      setAuthToken('')
      set({ isLoading: false, error: 'Google login gagal. Coba lagi.' })
    }
  },

  clearError: () => set({ error: null })
})))
