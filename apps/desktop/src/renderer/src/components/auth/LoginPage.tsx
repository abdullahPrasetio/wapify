import { useState, useEffect } from 'react'
import { Loader2, AlertCircle, Settings, Zap } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import { ServerSettingsModal } from '../modals/ServerSettingsModal'

export const LoginPage = (): React.JSX.Element => {
  const { login, loginWithGoogle, handleGoogleCallback, isLoading, error, clearError } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const [googleEnabled, setGoogleEnabled] = useState(false)

  useEffect(() => {
    window.api?.getAppVersion().then(setAppVersion)
  }, [])

  useEffect(() => {
    import('../../api/client').then(({ apiClient }) => {
      apiClient.get('/api/v1/auth/google/status')
        .then((res) => setGoogleEnabled(res.data?.enabled === true))
        .catch(() => setGoogleEnabled(false))
    })
  }, [])

  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [error, clearError])

  // Listen for Google OAuth deep link callback from Electron main process
  useEffect(() => {
    if (!window.api?.onGoogleAuthCallback) return undefined
    const unsub = window.api.onGoogleAuthCallback(({ token, refreshToken }) => {
      handleGoogleCallback(token, refreshToken)
    })
    return unsub
  }, [handleGoogleCallback])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!email || !password) return
    await login(email, password)
  }

  return (
    <div className="h-screen w-screen bg-background flex items-center justify-center font-sans overflow-hidden">
      {/* Settings Trigger (Top Right) */}
      <button
        onClick={() => setShowSettings(true)}
        className="absolute top-6 right-6 p-2 rounded-xl bg-surface border border-border text-muted hover:text-primary hover:border-primary/50 transition-all z-[60] shadow-lg shadow-black/20 cursor-pointer"
        title="Server Configuration"
      >
        <Settings size={20} />
      </button>

      {/* Background gradient decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo & Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-xl shadow-primary/30 mb-6 animate-pulse">
            <Zap size={32} fill="white" className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-text tracking-tighter italic uppercase">Wapbolt</h1>
          <p className="text-muted text-sm mt-1 font-medium">API Testing, Built for Teams</p>
        </div>

        {/* Login Card */}
        <div className="bg-surface border border-border rounded-xl p-8 shadow-2xl shadow-black/30">
          <h2 className="text-lg font-semibold text-text mb-6">Sign in to your account</h2>

          {/* Error Alert */}
          {error && (
            <div className="mb-4 flex items-start gap-3 bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 text-sm text-danger">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-xs font-medium text-muted uppercase tracking-wider block mb-1.5">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
                required
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text placeholder-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-medium text-muted uppercase tracking-wider block mb-1.5">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => { if (email && password) login(email, password) }}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text placeholder-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors shadow-md shadow-primary/30 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Divider + Google — only shown when enabled */}
          {googleEnabled && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <button
                type="button"
                disabled={isLoading}
                onClick={loginWithGoogle}
                className="w-full flex items-center justify-center gap-3 bg-background border border-border hover:border-primary/50 text-text font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M43.611 20.083H42V20H24v8h11.303C33.968 32.22 29.418 35 24 35c-6.075 0-11-4.925-11-11s4.925-11 11-11c2.797 0 5.352 1.06 7.28 2.78l5.657-5.657C33.9 7.37 29.21 5 24 5 12.954 5 4 13.954 4 25s8.954 20 20 20 20-8.954 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
                    <path d="M6.306 14.691l6.571 4.82C14.655 16.108 19.001 13 24 13c2.797 0 5.352 1.06 7.28 2.78l5.657-5.657C33.9 7.37 29.21 5 24 5 16.318 5 9.656 9.337 6.306 14.691z" fill="#FF3D00"/>
                    <path d="M24 45c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.21 36.023 26.715 37 24 37c-5.399 0-9.944-3.647-11.578-8.538l-6.522 5.025C9.505 40.556 16.227 45 24 45z" fill="#4CAF50"/>
                    <path d="M43.611 20.083H42V20H24v8h11.303a11.04 11.04 0 01-3.714 5.082l6.19 5.238C42.012 34.999 44 30.271 44 25c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
                  </svg>
                )}
                Continue with Google
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted mt-6">
          Tidak punya akun? Hubungi administrator.
        </p>
      </div>

      {appVersion && (
        <div className="absolute bottom-6 left-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted opacity-30 select-none">
          Wapbolt v{appVersion}
        </div>
      )}

      {showSettings && <ServerSettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
