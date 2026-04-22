import type { IpcResponse } from '../types'

// Base URL untuk Wapify backend - Bisa dikonfigurasi via settings
export const getBaseUrl = (): string => {
  const savedUrl = localStorage.getItem('wapify_server_url')
  return savedUrl || 'http://localhost:8000'
}

export const setBaseUrl = (url: string): void => {
  // Ensure no trailing slash
  const cleanUrl = url.replace(/\/$/, '')
  localStorage.setItem('wapify_server_url', cleanUrl)
}

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
  if (authToken && config.url.startsWith(getBaseUrl()) && !config.skipAuth) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  if (!window.api) {
    if (config.url.startsWith(getBaseUrl())) {
      console.warn('Running in Browser Mode: Using standard fetch for Wapify API')
      const res = await fetch(config.url, {
        method: config.method,
        headers,
        body: config.body
      })
      const raw = await res.text()
      let data: unknown
      try { data = JSON.parse(raw) } catch { data = raw }
      return { status: res.status, headers: {}, data, timing: 0 } as IpcResponse<T>
    } else {
      console.error('Wapify IPC is not available. Are you running in Chrome instead of Electron?')
      throw new Error('This app requires Electron to run.')
    }
  }

  let response = await window.api.wapifyRequest({
    ...config,
    headers
  })

  // Handle License Warnings
  const licenseWarning = response.headers?.['x-wapify-license-warning']
  if (licenseWarning) {
    window.dispatchEvent(
      new CustomEvent('wapify:license-warning', {
        detail: { message: licenseWarning }
      })
    )
  }

  // Handle License Issues (402 Payment Required or 403 License Expired/Invalid)
  if (config.url.startsWith(getBaseUrl()) && (response.status === 402 || response.status === 403)) {
    const errorData = response.data as any
    if (errorData?.code === 'LICENSE_REQUIRED' || errorData?.code === 'INVALID_LICENSE') {
      window.dispatchEvent(
        new CustomEvent('wapify:license-invalid', {
          detail: {
            message: errorData.error || 'Your license is invalid or has expired.',
            code: errorData.code
          }
        })
      )
    } else if (errorData?.code === 'FORBIDDEN') {
      window.dispatchEvent(
        new CustomEvent('wapify:access-denied', {
          detail: { message: errorData.error || 'You do not have permission to perform this action.' }
        })
      )
    }
  }

  // Auto-refresh token if 401 Unauthorized
  if (
    response.status === 401 &&
    config.url.startsWith(getBaseUrl()) &&
    !config.url.includes('/auth/login') &&
    !config.url.includes('/auth/refresh')
  ) {
    const refreshToken = await window.api.getToken()
    if (refreshToken) {
      // Try to refresh
      const refreshResponse = await window.api.wapifyRequest({
        method: 'POST',
        url: `${getBaseUrl()}/api/v1/auth/refresh`,
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
    ipcRequest<T>({ method: 'GET', url: `${getBaseUrl()}${path}`, headers }),

  post: <T>(path: string, body: unknown, headers?: Record<string, string>) =>
    ipcRequest<T>({
      method: 'POST',
      url: `${getBaseUrl()}${path}`,
      body: JSON.stringify(body),
      headers
    }),

  put: <T>(path: string, body: unknown, headers?: Record<string, string>) =>
    ipcRequest<T>({
      method: 'PUT',
      url: `${getBaseUrl()}${path}`,
      body: JSON.stringify(body),
      headers
    }),

  delete: <T>(path: string, headers?: Record<string, string>) =>
    ipcRequest<T>({ method: 'DELETE', url: `${getBaseUrl()}${path}`, headers }),

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
