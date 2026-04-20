import { useState, useEffect } from 'react'
import { apiClient } from '../../api/client'
import { Plus, Search, Trash2, Shield, User as UserIcon, X, Loader2, Building2 } from 'lucide-react'
import type { User as UserType, Team } from '../../types'
import { toast } from 'sonner'
import * as Dialog from '@radix-ui/react-dialog'

export const UserManagement = (): React.JSX.Element => {
  const [users, setUsers] = useState<UserType[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    is_super_admin: false,
    team_id: 0,
    role: 'Editor'
  })

  const fetchUsers = async (): Promise<void> => {
    setLoading(true)
    try {
      const response = await apiClient.get<UserType[]>('/api/v1/admin/users')
      if (response.status === 200) {
        setUsers(response.data as UserType[])
      }
    } catch {
      toast.error('Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  const fetchTeams = async (): Promise<void> => {
    try {
      const response = await apiClient.get<Team[]>('/api/v1/admin/teams')
      if (response.status === 200) {
        setTeams(response.data as Team[])
      }
    } catch {
      // silent
    }
  }

  const handleDeleteUser = async (id: number): Promise<void> => {
    if (!window.confirm('Are you sure you want to delete this user?')) return

    try {
      const response = await apiClient.delete(`/api/v1/admin/users/${id}`)
      if (response.status === 200) {
        toast.success('User deleted successfully')
        fetchUsers()
      } else {
        toast.error('Failed to delete user')
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || 'Failed to delete user')
    }
  }

  const handleCreateUser = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const payload = {
        ...formData,
        team_id: formData.team_id > 0 ? formData.team_id : undefined
      }
      const response = await apiClient.post('/api/v1/admin/users', payload)
      if (response.status === 201) {
        toast.success('User created successfully')
        setIsCreateModalOpen(false)
        setFormData({
          name: '',
          email: '',
          password: '',
          is_super_admin: false,
          team_id: 0,
          role: 'Editor'
        })
        fetchUsers()
      } else {
        toast.error('Failed to create user')
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || 'Failed to create user')
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    const load = async (): Promise<void> => {
      await Promise.all([fetchUsers(), fetchTeams()])
    }
    load()
  }, [])

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex-1 bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-border bg-surface/30 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">User Management</h1>
          <p className="text-sm text-muted">Manage all registered users in Wapify.</p>
        </div>

        <Dialog.Root open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <Dialog.Trigger asChild>
            <button className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all shadow-lg shadow-primary/20">
              <Plus size={16} /> Create User
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-300" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl z-50 p-6 animate-in zoom-in-95 fade-in duration-300">
              <div className="flex items-center justify-between mb-6">
                <Dialog.Title className="text-lg font-bold text-text">Create New User</Dialog.Title>
                <Dialog.Close className="text-muted hover:text-text transition-colors">
                  <X size={20} />
                </Dialog.Close>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">
                      Full Name
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm text-text focus:outline-none focus:border-primary transition-colors"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">
                      Email Address
                    </label>
                    <input
                      required
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm text-text focus:outline-none focus:border-primary transition-colors"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">
                    Initial Password
                  </label>
                  <input
                    required
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm text-text focus:outline-none focus:border-primary transition-colors"
                    placeholder="••••••••"
                  />
                </div>

                <div className="border-t border-border pt-4 mt-4">
                  <h3 className="text-xs font-bold text-text mb-3 flex items-center gap-2">
                    <Building2 size={14} className="text-primary" />
                    Team Assignment (Optional)
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">
                        Initial Team
                      </label>
                      <select
                        value={formData.team_id}
                        onChange={(e) =>
                          setFormData({ ...formData, team_id: Number(e.target.value) })
                        }
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                      >
                        <option value={0}>No Team Assignment</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">
                        Team Role
                      </label>
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        disabled={formData.team_id === 0}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary disabled:opacity-50"
                      >
                        <option value="Admin">Admin</option>
                        <option value="Editor">Editor</option>
                        <option value="Viewer">Viewer</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 py-2 border-t border-border pt-4">
                  <input
                    type="checkbox"
                    id="is_super_admin"
                    checked={formData.is_super_admin}
                    onChange={(e) => setFormData({ ...formData, is_super_admin: e.target.checked })}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary bg-background"
                  />
                  <label
                    htmlFor="is_super_admin"
                    className="text-sm text-text cursor-pointer select-none flex items-center gap-2"
                  >
                    <Shield size={14} className="text-warning" />
                    Grant Super Admin Privileges
                  </label>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-text hover:bg-background rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-lg shadow-lg shadow-primary/20 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Create User'}
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      {/* Search */}
      <div className="p-4 bg-surface/10 border-b border-border shrink-0">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 text-muted" size={16} />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-text focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted">
            <Loader2 size={24} className="animate-spin mr-3 text-primary" />
            <span>Loading users...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted italic">
            <UserIcon size={48} className="opacity-10 mb-4" />
            <p>No users found matching your search.</p>
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden bg-surface/50">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-background/50 text-xs font-bold text-muted uppercase tracking-wider border-b border-border">
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-surface/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <UserIcon size={18} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-text">{user.name}</div>
                          <div className="text-xs text-muted">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-full bg-success/10 text-success text-[10px] font-bold uppercase tracking-tight">
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {user.is_super_admin ? (
                        <div className="flex items-center gap-1.5 text-primary text-xs font-semibold">
                          <Shield size={12} />
                          Super Admin
                        </div>
                      ) : (
                        <span className="text-xs text-text">Standard User</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-muted hover:text-danger p-2 transition-colors"
                        title="Delete User"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
