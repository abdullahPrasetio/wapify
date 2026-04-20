import { useEffect } from 'react'
import { useAuthStore } from './store/useAuthStore'
import { useDataStore } from './store/useDataStore'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './components/auth/LoginPage'
import { Toaster } from 'sonner'

function App(): React.JSX.Element {
  const { isAuthenticated, logout, rehydrateAuth, isLoading } = useAuthStore()
  const { fetchHistory } = useDataStore()

  useEffect(() => {
    rehydrateAuth()
  }, [])

  useEffect(() => {
    const handleAuthExpired = () => {
      logout()
    }
    window.addEventListener('wapify:auth-expired', handleAuthExpired)
    return () => window.removeEventListener('wapify:auth-expired', handleAuthExpired)
  }, [logout])

  if (isLoading && !isAuthenticated) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="text-muted text-sm font-medium animate-pulse">Initializing Wapify...</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <>
        <Toaster position="bottom-right" theme="dark" richColors />
        <LoginPage />
      </>
    )
  }

  return (
    <>
      <Toaster position="bottom-right" theme="dark" richColors />
      <AppLayout />
    </>
  )
}

export default App
