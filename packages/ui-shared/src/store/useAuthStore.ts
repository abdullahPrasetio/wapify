import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { apiClient, setAuthToken, getBaseUrl } from '../api/client'
import { getAppMode } from '../config/appMode'
import type { User, LoginResponse } from '../types'

// §8 docs/local-app-design.md (revisi): mode local memakai login-sekali —
// sesi (refresh token + identitas akun) disimpan main process, kerja harian
// offline penuh. User object dibentuk dari sesi tersimpan; field yang tidak
// ikut disimpan diisi default.
function sessionToUser(sessionUser: Partial<User>): User {
  const epoch = new Date(0).toISOString()
  return {
    id: sessionUser.id ?? 1,
    email: sessionUser.email ?? 'local@wapbolt',
    name: sessionUser.name ?? 'Local User',
    is_super_admin: sessionUser.is_super_admin ?? false,
    is_premium: sessionUser.is_premium ?? false,
    has_password: true,
    premium_since: sessionUser.premium_since ?? null,
    created_at: sessionUser.created_at ?? epoch,
    updated_at: sessionUser.updated_at ?? epoch
  }
}

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

        // Mode local (§8 revisi): login pertama → simpan sesi + initial pull
        // seluruh data server ke SQLite, baru masuk workspace.
        if (getAppMode().mode === 'local' && window.api?.saveSyncSession && window.api?.syncNow) {
          await window.api.saveSyncSession({ serverUrl: getBaseUrl(), user })
          try {
            const summary = await window.api.syncNow(getBaseUrl())
            if (summary.errors.length > 0) {
              console.error('[Auth] Initial pull selesai dengan error:', summary.errors)
            }
          } catch (err) {
            // Login tetap sukses — data bisa ditarik ulang via "Sync Now".
            console.error('[Auth] Initial pull gagal:', err)
          }
          set({ user: sessionToUser(user), token, isAuthenticated: true, isLoading: false, error: null })
          return
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
    if (window.api?.deleteToken) {
      await window.api.deleteToken()
    }
    set({ user: null, token: null, isAuthenticated: false, error: null })
  },

  rehydrateAuth: async () => {
    // Mode local (§8 revisi): sesi login-sekali persisten. Ada sesi → langsung
    // masuk workspace TANPA network; tidak ada → layar login. Refresh token
    // hanya dipakai SyncEngine, bukan operasional harian.
    if (getAppMode().mode === 'local') {
      set({ isRehydrating: true })
      try {
        const session = window.api?.getSyncSession ? await window.api.getSyncSession() : null
        if (session) {
          set({
            user: sessionToUser(session.user as Partial<User>),
            token: null,
            isAuthenticated: true,
            isRehydrating: false
          })
          return
        }
      } catch (err) {
        console.error('[Auth] Local session check failed:', err)
      }
      set({ isRehydrating: false, isAuthenticated: false })
      return
    }

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
