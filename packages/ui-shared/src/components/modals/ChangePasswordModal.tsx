import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Key, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { apiClient } from '../../api/client'
import { useAuthStore } from '../../store/useAuthStore'
import { toast } from 'sonner'

interface ChangePasswordModalProps {
  isOpen: boolean
  onClose: () => void
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuthStore()
  const isGoogleUser = !user?.has_password

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    setLoading(true)
    try {
      const res = await apiClient.put('/api/v1/auth/change-password', {
        old_password: isGoogleUser ? undefined : oldPassword,
        new_password: newPassword
      })

      if (res.status === 200) {
        toast.success(isGoogleUser ? 'Password set successfully' : 'Password updated successfully')
        onClose()
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to update password'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] animate-in fade-in duration-300" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl z-[101] p-0 overflow-hidden animate-in zoom-in-95 fade-in duration-300 text-slate-100">
          <div className="bg-primary/10 px-6 py-8 flex flex-col items-center border-b border-primary/20">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white shadow-xl shadow-primary/30 mb-4">
              <Key size={32} />
            </div>
            <Dialog.Title className="text-xl font-bold text-text">
              {isGoogleUser ? 'Set Password' : 'Change Password'}
            </Dialog.Title>
            <Dialog.Description className="text-xs text-muted mt-1">
              {isGoogleUser
                ? 'Set a password so you can also sign in with email'
                : 'Keep your account secure with a strong password'}
            </Dialog.Description>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                <AlertCircle size={14} className="shrink-0" />
                {error}
              </div>
            )}

            {!isGoogleUser && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">Old Password</label>
                <input
                  required
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-all font-mono"
                  placeholder="••••••••"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">New Password</label>
              <input
                required
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-all font-mono"
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">Confirm New Password</label>
              <input
                required
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-all font-mono"
                placeholder="••••••••"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-muted border border-white/10 hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {isGoogleUser ? 'Set Password' : 'Update Password'}
              </button>
            </div>
          </form>

          <Dialog.Close className="absolute top-4 right-4 p-1.5 rounded-lg text-muted hover:text-text hover:bg-white/5 transition-colors">
            <X size={18} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
