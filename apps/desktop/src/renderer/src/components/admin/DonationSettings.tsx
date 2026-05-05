import React, { useState, useEffect } from 'react'
import { Heart, Save, Send, Clock, ToggleLeft, ToggleRight, Loader2, User } from 'lucide-react'
import { apiClient } from '../../api/client'
import { toast } from 'sonner'
import type { User as UserType } from '../../types'

export const DonationSettings = (): React.JSX.Element => {
  const [config, setConfig] = useState({
    donation_active: 'false',
    donation_cooldown_days: '7',
    donation_message: ''
  })
  const [users, setUsers] = useState<UserType[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number>(0) // 0 for All
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTriggering, setIsTriggering] = useState(false)

  const fetchConfig = async () => {
    try {
      const res = await apiClient.get<Record<string, string>>('/api/v1/admin/donations/config')
      if (res.status === 200) {
        setConfig({
          donation_active: res.data.donation_active || 'false',
          donation_cooldown_days: res.data.donation_cooldown_days || '7',
          donation_message: res.data.donation_message || ''
        })
      }
    } catch (e) {
      toast.error('Failed to fetch donation settings')
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await apiClient.get<UserType[]>('/api/v1/admin/users')
      if (res.status === 200) {
        setUsers(res.data)
      }
    } catch (e) {
      console.error('Failed to fetch users')
    }
  }

  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      await Promise.all([fetchConfig(), fetchUsers()])
      setIsLoading(false)
    }
    init()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await apiClient.put('/api/v1/admin/donations/config', config)
      if (res.status === 200) {
        toast.success('Donation settings saved successfully')
      }
    } catch (e) {
      toast.error('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleTrigger = async () => {
    const targetName = selectedUserId === 0 ? 'ALL active users' : users.find(u => u.id === selectedUserId)?.name || 'this user'
    if (!confirm(`Broadcast donation prompt to ${targetName} immediately?`)) return
    
    setIsTriggering(true)
    try {
      const res = await apiClient.post('/api/v1/admin/donations/trigger', {
        user_id: selectedUserId,
        message: config.donation_message
      })
      if (res.status === 200) {
        toast.success(`Trigger sent to ${targetName}`)
      }
    } catch (e) {
      toast.error('Failed to trigger broadcast')
    } finally {
      setIsTriggering(false)
    }
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto">
      <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
        <h1 className="text-2xl font-bold flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <Heart className="text-red-500 fill-red-500" size={24} />
          </div>
          Donation Settings
        </h1>
        <p className="text-muted text-sm ml-1">Configure QRIS donation pop-ups for users.</p>
      </div>

      <div className="grid gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
        <div className="bg-surface border border-border rounded-2xl p-8 shadow-sm space-y-8">
          {/* Status Toggle */}
          <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/5">
            <div>
              <h3 className="text-sm font-bold mb-1">Pop-up Active</h3>
              <p className="text-xs text-muted">Enable or disable the automatic donation pop-up on login/refresh.</p>
            </div>
            <button
              onClick={() => setConfig(prev => ({ ...prev, donation_active: prev.donation_active === 'true' ? 'false' : 'true' }))}
              className={`transition-all duration-300 hover:scale-110 ${config.donation_active === 'true' ? 'text-primary' : 'text-muted'}`}
            >
              {config.donation_active === 'true' ? <ToggleRight size={48} /> : <ToggleLeft size={48} />}
            </button>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 flex items-center gap-2">
                  <Clock size={12} className="text-primary" /> Cooldown (Days)
                </label>
                <input
                  type="number"
                  value={config.donation_cooldown_days}
                  onChange={(e) => setConfig(prev => ({ ...prev, donation_cooldown_days: e.target.value }))}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-inner"
                  placeholder="e.g. 7"
                />
                <p className="mt-2 text-[10px] text-muted italic ml-1">Pop-up will reappear automatically after these many days since user last dismissed it.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3">
                Donation Message
              </label>
              <textarea
                value={config.donation_message}
                onChange={(e) => setConfig(prev => ({ ...prev, donation_message: e.target.value }))}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all min-h-[120px] resize-none shadow-inner"
                placeholder="Enter message to show in the donation modal..."
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full sm:w-auto px-8 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Save Configuration
            </button>
          </div>
        </div>

        {/* Trigger Section */}
        <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-8 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Send size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex flex-col gap-6">
              <div className="max-w-xl">
                <h3 className="text-sm font-bold text-red-500 mb-2 flex items-center gap-2 uppercase tracking-widest">
                  <Send size={16} /> Broadcast Trigger
                </h3>
                <p className="text-xs text-muted leading-relaxed">
                  Forcibly show the donation pop-up to users immediately, bypassing their local cooldown. Use this for special events or major updates.
                </p>
              </div>
              
              <div className="flex flex-col md:flex-row items-end gap-4 bg-black/20 p-4 rounded-xl border border-white/5">
                <div className="flex-1 w-full">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-2 flex items-center gap-2">
                    <User size={10} /> Target User
                  </label>
                  <select 
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(Number(e.target.value))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  >
                    <option value={0}>All Active Users</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleTrigger}
                  disabled={isTriggering}
                  className="w-full md:w-auto px-8 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-red-500/20"
                >
                  {isTriggering ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  {selectedUserId === 0 ? 'Broadcast to All' : 'Send to User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
