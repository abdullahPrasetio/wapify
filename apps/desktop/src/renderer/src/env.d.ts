/// <reference types="vite/client" />

// Extend the Window interface to include our custom APIs
// exposed via contextBridge in the preload script
interface Window {
  api: {
    wapifyRequest: (config: {
      method: string
      url: string
      headers?: Record<string, string>
      body?: string
    }) => Promise<{
      status: number
      headers: Record<string, string[]>
      data: unknown
      timing: number
    }>
    setToken: (token: string) => Promise<void>
    getToken: () => Promise<string | null>
    deleteToken: () => Promise<void>
  }
}
