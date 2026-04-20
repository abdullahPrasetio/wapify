import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '../../api/client'
import { Plus, Search, Trash2, Building2, Users, X, Loader2, UserMinus } from 'lucide-react'
import type { Team, User, TeamMember } from '../../types'
import { toast } from 'sonner'
import * as Dialog from '@radix-ui/react-dialog'

interface ManageMembersModalProps {
  team: Team
  onClose: () => void
}

const ManageMembersModal = ({ team, onClose }: ManageMembersModalProps): React.JSX.Element => {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedRole, setSelectedRole] = useState('Editor')

  const fetchData = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const [membersRes, usersRes] = await Promise.all([
        apiClient.get<{ members: TeamMember[] }>(`/api/v1/teams/${team.id}`),
        apiClient.get<User[]>('/api/v1/admin/users')
      ])

      if (membersRes.status === 200) {
        setMembers(membersRes.data.members || [])
      }
      if (usersRes.status === 200) {
        setAllUsers(usersRes.data as User[])
      }
    } catch {
      toast.error('Failed to fetch team data')
    } finally {
      setLoading(false)
    }
  }, [team.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAddMember = async (): Promise<void> => {
    if (!selectedUserId) return
    setIsAdding(true)
    try {
      const response = await apiClient.post(`/api/v1/admin/teams/${team.id}/members`, {
        user_id: Number(selectedUserId),
        role: selectedRole
      })
      if (response.status === 200) {
        toast.success('Member added')
        fetchData()
        setSelectedUserId('')
      }
    } catch {
      toast.error('User is already in team')
    } finally {
      setIsAdding(false)
    }
  }

  const handleUpdateRole = async (userId: number, newRole: string): Promise<void> => {
    try {
      const response = await apiClient.put(`/api/v1/teams/${team.id}/members/${userId}`, {
        role: newRole
      })
      if (response.status === 200) {
        toast.success('Role updated')
        fetchData()
      }
    } catch {
      toast.error('Failed to update role')
    }
  }

  const handleRemoveMember = async (userId: number): Promise<void> => {
    try {
      const response = await apiClient.delete(`/api/v1/admin/teams/${team.id}/members/${userId}`)
      if (response.status === 200) {
        toast.success('Member removed')
        fetchData()
      }
    } catch {
      toast.error('Failed to remove member')
    }
  }

  // Filter out existing members from allUsers
  const availableUsers = allUsers.filter((u) => !members.some((m) => m.user_id === u.id))

  return (
    <Dialog.Root open={true} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-surface border border-border rounded-xl shadow-2xl z-50 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Building2 className="text-primary" size={24} />
              <div>
                <Dialog.Title className="text-lg font-bold text-text">
                  Manage Team: {team.name}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-muted">
                  View and manage team members and their roles.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close className="text-muted hover:text-text">
              <X size={20} />
            </Dialog.Close>
          </div>

          <div className="space-y-6">
            {/* Add Member Form */}
            <div className="bg-background/50 border border-border rounded-lg p-4">
              <h4 className="text-xs font-bold text-muted uppercase tracking-widest mb-3">
                Add New Member
              </h4>
              <div className="flex gap-3">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="flex-1 bg-surface border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                >
                  <option value="">Select User...</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-32 bg-surface border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                >
                  <option value="Admin">Admin</option>
                  <option value="Editor">Editor</option>
                  <option value="Viewer">Viewer</option>
                </select>
                <button
                  onClick={handleAddMember}
                  disabled={isAdding || !selectedUserId}
                  className="bg-primary hover:bg-primary-hover text-white px-4 rounded text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {isAdding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}{' '}
                  Add
                </button>
              </div>
            </div>

            {/* Members List */}
            <div className="border border-border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-surface border-b border-border text-[10px] font-bold text-muted uppercase tracking-widest">
                  <tr>
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-muted">
                        <Loader2 size={16} className="animate-spin inline mr-2" /> Loading...
                      </td>
                    </tr>
                  ) : members.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-muted italic">
                        No members in this team.
                      </td>
                    </tr>
                  ) : (
                    members.map((member) => (
                      <tr key={member.id} className="hover:bg-background/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                              {member.user?.name.charAt(0)}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-text">
                                {member.user?.name}
                              </div>
                              <div className="text-[10px] text-muted">{member.user?.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={member.role}
                            onChange={(e) => handleUpdateRole(member.user_id, e.target.value)}
                            className="bg-transparent border-none text-xs font-medium text-primary focus:ring-0 cursor-pointer hover:underline"
                          >
                            <option value="Admin">Admin</option>
                            <option value="Editor">Editor</option>
                            <option value="Viewer">Viewer</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleRemoveMember(member.user_id)}
                            className="text-muted hover:text-danger p-1 transition-colors"
                            title="Remove Member"
                          >
                            <UserMinus size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export const TeamManagement = (): React.JSX.Element => {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [managingTeam, setManagingTeam] = useState<Team | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })

  const fetchAllTeams = async (): Promise<void> => {
    setLoading(true)
    try {
      const response = await apiClient.get<Team[]>('/api/v1/admin/teams')
      if (response.status === 200) {
        setTeams(response.data as Team[])
      }
    } catch {
      toast.error('Failed to fetch teams')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTeam = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const response = await apiClient.post('/api/v1/teams', formData)
      if (response.status === 201) {
        toast.success('Team created successfully')
        setIsCreateModalOpen(false)
        setFormData({ name: '', description: '' })
        fetchAllTeams()
      }
    } catch {
      toast.error('Failed to create team')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteTeam = async (id: number): Promise<void> => {
    if (
      !window.confirm(
        'Are you sure you want to delete this team? All collections and requests inside it will be deleted!'
      )
    )
      return

    try {
      const response = await apiClient.delete(`/api/v1/teams/${id}`)
      if (response.status === 200) {
        toast.success('Team deleted successfully')
        fetchAllTeams()
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || 'Failed to delete team')
    }
  }

  useEffect(() => {
    const load = async (): Promise<void> => {
      await fetchAllTeams()
    }
    load()
  }, [])

  const filteredTeams = teams.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex-1 bg-background flex flex-col overflow-hidden">
      <div className="p-6 border-b border-border bg-surface/30 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Team Management</h1>
          <p className="text-sm text-muted">Manage all teams and their memberships.</p>
        </div>

        <Dialog.Root open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <Dialog.Trigger asChild>
            <button className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all shadow-lg shadow-primary/20">
              <Plus size={16} /> Create Team
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-300" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-surface border border-border rounded-xl shadow-2xl z-50 p-6 animate-in zoom-in-95 fade-in duration-300">
              <div className="flex items-center justify-between mb-6">
                <Dialog.Title className="text-lg font-bold text-text">Create New Team</Dialog.Title>
                <Dialog.Close className="text-muted hover:text-text transition-colors">
                  <X size={20} />
                </Dialog.Close>
              </div>

              <form onSubmit={handleCreateTeam} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-1.5">
                    Team Name
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm text-text focus:outline-none focus:border-primary transition-colors"
                    placeholder="Engineering Team"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full h-24 bg-background border border-border rounded-lg px-4 py-2 text-sm text-text focus:outline-none focus:border-primary transition-colors resize-none"
                    placeholder="Describe the purpose of this team..."
                  />
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
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Create Team'}
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      <div className="p-4 bg-surface/10 border-b border-border shrink-0">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 text-muted" size={16} />
          <input
            type="text"
            placeholder="Search teams by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-text focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted">
            <Loader2 size={24} className="animate-spin mr-3 text-primary" />
            <span>Loading teams...</span>
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted italic">
            <Building2 size={48} className="opacity-10 mb-4" />
            <p>No teams found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTeams.map((team) => (
              <div
                key={team.id}
                className="bg-surface/50 border border-border rounded-xl p-5 hover:border-primary transition-all group shadow-sm flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Building2 size={20} />
                  </div>
                  <button
                    onClick={() => handleDeleteTeam(team.id)}
                    className="text-muted hover:text-danger p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete Team"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <h3 className="text-sm font-bold text-text mb-1 truncate">{team.name}</h3>
                <p className="text-xs text-muted mb-4 line-clamp-2 min-h-[32px] flex-1">
                  {team.description || 'No description provided.'}
                </p>
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <Users size={12} />
                    <span>Active Team</span>
                  </div>
                  <button
                    onClick={() => setManagingTeam(team)}
                    className="text-[10px] font-bold text-primary uppercase tracking-widest cursor-pointer hover:underline"
                  >
                    Manage Members
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {managingTeam && (
        <ManageMembersModal team={managingTeam} onClose={() => setManagingTeam(null)} />
      )}
    </div>
  )
}
