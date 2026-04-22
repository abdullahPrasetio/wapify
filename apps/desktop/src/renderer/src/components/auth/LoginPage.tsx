import { useState, useEffect } from 'react'
import { Loader2, AlertCircle, Settings } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import { ServerSettingsModal } from '../modals/ServerSettingsModal'

export const LoginPage = (): React.JSX.Element => {
  const { login, isLoading, error, clearError } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    window.api.getAppVersion().then(setAppVersion)
  }, [])

  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [error, clearError])

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
        className="absolute top-6 right-6 p-2 rounded-xl bg-surface border border-border text-muted hover:text-primary hover:border-primary/50 transition-all z-[60] shadow-lg shadow-black/20"
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
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary shadow-lg shadow-primary/30 mb-4">
            <span className="text-white font-black text-2xl tracking-tight">W</span>
          </div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Wapify</h1>
          <p className="text-muted text-sm mt-1">API Testing, Built for Teams</p>
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
              className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors shadow-md shadow-primary/30 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
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
        </div>

        <p className="text-center text-xs text-muted mt-6">
          Tidak punya akun? Hubungi administrator.
        </p>
      </div>

      {appVersion && (
        <div className="absolute bottom-6 left-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted opacity-30 select-none">
          Wapify v{appVersion}
        </div>
      )}

      {showSettings && <ServerSettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
