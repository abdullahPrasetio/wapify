import type { IpcResponse } from '../types'

// Base URL untuk Wapify backend
const BASE_URL = 'http://localhost:8000'

interface RequestConfig {
  method: string
  url: string
  headers?: Record<string, string>
  body?: string
  skipAuth?: boolean
}

// Token disimpan di memory (bukan localStorage) — lebih aman
let authToken: string | null = null

export const setAuthToken = (token: string | null): void => {
  authToken = token
}

export const getAuthToken = (): string | null => authToken

/**
 * HTTP client yang mengirimkan request via Electron IPC ke Main Process.
 * Ini memastikan semua request BEBAS CORS karena dikirim dari Node.js.
 */
async function ipcRequest<T>(config: RequestConfig): Promise<IpcResponse<T>> {
  const headers: Record<string, string> = {
    ...config.headers
  }

  // Hanya tambahkan Content-Type JSON jika belum ada dan ada body
  if (!headers['Content-Type'] && config.body) {
    headers['Content-Type'] = 'application/json'
  }

  // Hanya tambahkan Authorization Wapify jika merequest ke backend Wapify dan tidak skipAuth
  if (authToken && config.url.startsWith(BASE_URL) && !config.skipAuth) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  let response = await window.api.wapifyRequest({
    ...config,
    headers
  })

  // Auto-refresh token if 401 Unauthorized
  if (response.status === 401 && config.url.startsWith(BASE_URL) && !config.url.includes('/auth/login') && !config.url.includes('/auth/refresh')) {
    const refreshToken = await window.api.getToken()
    if (refreshToken) {
      // Try to refresh
      const refreshResponse = await window.api.wapifyRequest({
        method: 'POST',
        url: `${BASE_URL}/api/v1/auth/refresh`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      })

      if (refreshResponse.status === 200) {
        // Success refresh, update token
        const newAuthToken = (refreshResponse.data as any).token
        setAuthToken(newAuthToken)
        
        // Retry original request
        headers['Authorization'] = `Bearer ${newAuthToken}`
        response = await window.api.wapifyRequest({
          ...config,
          headers
        })
      } else {
        // Refresh failed, clear tokens and let the UI handle logout (e.g. via zustand listener or just let it fail)
        setAuthToken(null)
        await window.api.deleteToken()
        window.dispatchEvent(new Event('wapify:auth-expired'))
      }
    }
  }

  return response as IpcResponse<T>
}

// ─── API Client Methods ───────────────────────────────────────────────────────
export const apiClient = {
  get: <T>(path: string, headers?: Record<string, string>) =>
    ipcRequest<T>({ method: 'GET', url: `${BASE_URL}${path}`, headers }),

  post: <T>(path: string, body: unknown, headers?: Record<string, string>) =>
    ipcRequest<T>({
      method: 'POST',
      url: `${BASE_URL}${path}`,
      body: JSON.stringify(body),
      headers
    }),

  put: <T>(path: string, body: unknown, headers?: Record<string, string>) =>
    ipcRequest<T>({
      method: 'PUT',
      url: `${BASE_URL}${path}`,
      body: JSON.stringify(body),
      headers
    }),

  delete: <T>(path: string, headers?: Record<string, string>) =>
    ipcRequest<T>({ method: 'DELETE', url: `${BASE_URL}${path}`, headers }),

  /**
   * Untuk mengirim request ke Target API arbitrary (bukan hanya backend Wapify).
   * Digunakan saat user menekan tombol "Send" di request builder.
   */
  executeRequest: <T>(
    method: string,
    url: string,
    headers?: Record<string, string>,
    body?: string
  ) => ipcRequest<T>({ method, url, headers, body, skipAuth: true })
}
