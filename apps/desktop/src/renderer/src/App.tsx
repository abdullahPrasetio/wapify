import { useEffect } from 'react'
import { useAuthStore } from './store/useAuthStore'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './components/auth/LoginPage'
import { Toaster } from 'sonner'

function App(): React.JSX.Element {
  const { isAuthenticated, logout } = useAuthStore()

  useEffect(() => {
    const handleAuthExpired = () => {
      logout()
    }
    window.addEventListener('wapify:auth-expired', handleAuthExpired)
    return () => window.removeEventListener('wapify:auth-expired', handleAuthExpired)
  }, [logout])

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
