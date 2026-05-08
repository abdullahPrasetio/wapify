import { useEffect, useState } from 'react'
import { useAuthStore } from './store/useAuthStore'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './components/auth/LoginPage'
import { Toaster, toast } from 'sonner'
import { initWebSocketIntegration } from './api/websocket'
import { Key, AlertCircle, RefreshCw } from 'lucide-react'
import { DonationModal } from './components/modals/DonationModal'
import { apiClient } from './api/client'
import { useAppStore } from './store/useAppStore'

// Initialize WebSocket sync logic
initWebSocketIntegration()

function App(): React.JSX.Element {
  const { isAuthenticated, logout, rehydrateAuth, isLoading } = useAuthStore()
  const { theme } = useAppStore()
  const [licenseError, setLicenseError] = useState<{ message: string; code: string } | null>(null)

  useEffect(() => {
    rehydrateAuth()
  }, [])

  // Theme Management
  useEffect(() => {
    const root = window.document.documentElement

    const applyTheme = (t: 'light' | 'dark' | 'system') => {
      root.classList.remove('light', 'dark')

      if (t === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        root.classList.add(systemTheme)
      } else {
        root.classList.add(t)
      }
    }

    applyTheme(theme)

    // Listen for system theme changes if theme is 'system'
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => applyTheme('system')
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    return undefined
  }, [theme])

  useEffect(() => {
    const handleAuthExpired = () => {
      logout()
    }
    const handleLicenseInvalid = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setLicenseError(detail)
    }
    const handleLicenseWarning = (e: Event) => {
      const detail = (e as CustomEvent).detail
      toast.warning(`${detail.message} Visit wapbolt.temancode.my.id to renew.`, {
        id: 'license-warning', // Prevent duplicates
        duration: 10000,
        action: {
          label: 'Renew',
          onClick: () => window.open('https://wapbolt.temancode.my.id', '_blank')
        }
      })
    }
    const handleAccessDenied = (e: Event) => {
      const detail = (e as CustomEvent).detail
      toast.error(detail.message, {
        id: 'access-denied',
        duration: 5000
      })
    }

    window.addEventListener('wapbolt:auth-expired', handleAuthExpired)
    window.addEventListener('wapbolt:license-invalid', handleLicenseInvalid)
    window.addEventListener('wapbolt:license-warning', handleLicenseWarning)
    window.addEventListener('wapbolt:access-denied', handleAccessDenied)

    return () => {
      window.removeEventListener('wapbolt:auth-expired', handleAuthExpired)
      window.removeEventListener('wapbolt:license-invalid', handleLicenseInvalid)
      window.removeEventListener('wapbolt:license-warning', handleLicenseWarning)
      window.removeEventListener('wapbolt:access-denied', handleAccessDenied)
    }
  }, [logout])

  useEffect(() => {
    if (isAuthenticated) {
      const checkDonation = async () => {
        try {
          const res = await apiClient.get<{ show: boolean; message: string }>('/api/v1/donations/check')
          if (res.status === 200 && res.data.show) {
            const appStore = useAppStore.getState()
            appStore.setDonationMessage(res.data.message)
            appStore.setDonationModalOpen(true)
          }
        } catch (e) {
          console.error('Failed to check donation status:', e)
        }
      }
      checkDonation()
    }
  }, [isAuthenticated])

  if (licenseError) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background blobs for aesthetics */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-danger/5 rounded-full blur-[120px]" />

        <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 shadow-2xl relative z-10 animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 bg-danger/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
            <Key size={32} className="text-danger" />
          </div>

          <h1 className="text-2xl font-bold text-center mb-2">License Required</h1>
          <p className="text-muted text-center text-sm mb-8 leading-relaxed">
            {licenseError.message}
          </p>

          <div className="bg-background/50 border border-border rounded-xl p-4 mb-8 flex items-start gap-3">
            <AlertCircle size={16} className="text-warning shrink-0 mt-0.5" />
            <div className="text-[11px] text-muted leading-normal">
              To renew your license or get a new key, please visit our portal at <a href="https://wapbolt.temancode.my.id" target="_blank" rel="noreferrer" className="text-primary hover:underline font-bold">wapbolt.temancode.my.id</a> or update your server configuration.
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              <RefreshCw size={16} />
              Check Again
            </button>
            <a
              href="https://wapbolt.temancode.my.id"
              target="_blank"
              rel="noreferrer"
              className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2 border border-white/10"
            >
              Get New License
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading && !isAuthenticated) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="text-muted text-sm font-medium animate-pulse">
            Initializing Wapbolt...
          </span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <>
        <Toaster position="bottom-right" theme={theme} richColors />
        <LoginPage />
      </>
    )
  }

  return (
    <>
      <Toaster position="bottom-right" theme={theme} richColors />
      <AppLayout />
      <DonationModal />
    </>
  )
}

export default App
