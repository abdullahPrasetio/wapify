import { ChevronDown, Play, Users, Loader2, Save, Keyboard, Crown } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import { useDataStore } from '../../store/useDataStore'
import { EnvironmentModal } from '../modals/EnvironmentModal'
import { useState } from 'react'

export const Header = (): React.JSX.Element => {
  const { user } = useAuthStore()
  const {
    tabs,
    activeTabId,
    environments,
    activeEnvironmentId,
    setActiveEnvironment,
    executeActiveRequest,
    saveActiveRequest
  } = useDataStore()

  const [isSaving, setIsSaving] = useState(false)

  const activeTabRequest = tabs.find((t) => t.requestId === activeTabId)
  const isSending = activeTabRequest?.isSending || false
  const activeEnvironment = environments.find((e) => e.id === activeEnvironmentId)

  const handleSend = async (): Promise<void> => {
    await executeActiveRequest()
  }

  const handleSave = async (): Promise<void> => {
    setIsSaving(true)
    await saveActiveRequest()
    setTimeout(() => setIsSaving(false), 500)
  }

  return (
    <div className="h-14 border-b border-border bg-background flex items-center justify-between px-4 shrink-0">
      {/* Left side: Active Request Title */}
      <div className="flex items-center gap-4">
        {activeTabRequest ? (
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-black ${getMethodColor(activeTabRequest.method)}`}>
              {activeTabRequest.method}
            </span>
            <span className="text-sm font-medium text-text truncate max-w-xs">
              {activeTabRequest.name}
              {activeTabRequest.isDirty && (
                <span className="ml-1 text-primary animate-pulse">•</span>
              )}
            </span>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="ml-2 text-muted hover:text-primary transition-colors p-1"
              title="Save Request (Ctrl+S)"
            >
              <Save size={14} className={isSaving ? 'animate-pulse text-primary' : ''} />
            </button>
          </div>
        ) : (
          <span className="text-sm text-muted italic">Open a request from the sidebar</span>
        )}
      </div>

      {/* Right side: Environments, Team, Send */}
      <div className="flex items-center gap-3">
        {/* Environment Selector */}
        <div className="flex items-center gap-1">
          <div className="flex items-center cursor-pointer hover:bg-surface px-3 py-1.5 rounded border border-border transition-colors gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeEnvironment ? 'bg-success' : 'bg-muted'}`}
            />
            <select
              value={activeEnvironmentId ?? ''}
              onChange={(e): void => setActiveEnvironment(Number(e.target.value))}
              className="bg-transparent text-sm text-text focus:outline-none cursor-pointer pr-1"
            >
              {environments.length === 0 && <option value="">No Environment</option>}
              {environments.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="text-muted" />
          </div>
          <EnvironmentModal />
        </div>

        {/* Keyboard shortcuts hint */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('wapbolt:open-shortcuts'))}
          className="text-muted hover:text-text transition-colors p-1"
          title="Keyboard Shortcuts (Shift+?)"
        >
          <Keyboard size={14} />
        </button>

        {/* User / Team indicator */}
        <div className="flex items-center gap-1.5 text-muted">
          <Users size={14} />
          <span className="text-xs truncate max-w-24">{user?.name ?? 'Unknown'}</span>
          {user?.is_premium && (
            <Crown size={12} className="text-yellow-400 shrink-0" aria-label="Premium Member" />
          )}
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={isSending || !activeTabRequest}
          className="bg-primary hover:bg-primary-hover text-white px-4 py-1.5 rounded text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed w-24 justify-center"
        >
          {isSending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <>
              <Play size={13} fill="currentColor" />
              Send
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: 'text-success',
    POST: 'text-warning',
    PUT: 'text-info',
    PATCH: 'text-secondary',
    DELETE: 'text-danger'
  }
  return colors[method] ?? 'text-muted'
}
