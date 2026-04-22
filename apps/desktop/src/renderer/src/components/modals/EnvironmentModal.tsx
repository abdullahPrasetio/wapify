import * as Dialog from '@radix-ui/react-dialog'
import { X, Plus, Trash2, Settings, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useDataStore } from '../../store/useDataStore'
import { KeyValueEditor } from '../ui/KeyValueEditor'
import type { Environment } from '../../types'

export const EnvironmentModal = (): React.JSX.Element => {
  const { environments, createEnvironment, updateEnvironment, deleteEnvironment } = useDataStore()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedEnvId, setSelectedEnvId] = useState<number | null>(null)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newEnvName, setNewEnvName] = useState('')

  const selectedEnv = environments.find((e) => e.id === selectedEnvId)

  const handleCreate = async (): Promise<void> => {
    if (!newEnvName.trim()) return
    await createEnvironment(newEnvName.trim())
    setIsAddingNew(false)
    setNewEnvName('')
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <button
          className="text-muted hover:text-text transition-colors p-1 rounded hover:bg-surface"
          title="Manage Environments"
        >
          <Settings size={14} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl max-h-[85vh] bg-surface border border-border rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between p-4 border-b border-border bg-background/50">
            <Dialog.Title className="text-lg font-bold text-text flex items-center gap-2">
              Manage Environments
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-muted hover:text-text transition-colors">
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar List */}
            <div className="w-64 border-r border-border bg-background/30 p-4 flex flex-col gap-2">
              {isAddingNew ? (
                <div className="mb-2 space-y-2 p-2 bg-primary/5 rounded-lg border border-primary/20 animate-in slide-in-from-top-1 duration-200">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Env Name..."
                    value={newEnvName}
                    onChange={(e) => setNewEnvName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreate()
                      if (e.key === 'Escape') setIsAddingNew(false)
                    }}
                    className="w-full bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreate}
                      className="flex-1 bg-primary text-white text-[10px] font-bold py-1 rounded hover:bg-primary-hover"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => setIsAddingNew(false)}
                      className="flex-1 bg-surface text-text text-[10px] font-bold py-1 rounded border border-border hover:bg-border"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingNew(true)}
                  className="flex items-center gap-2 text-sm text-primary hover:text-primary-hover font-medium px-2 py-1.5 rounded hover:bg-primary/10 transition-all mb-2 w-full"
                >
                  <Plus size={16} /> New Environment
                </button>
              )}

              <div className="space-y-1 overflow-y-auto">
                {environments.map((env) => (
                  <div
                    key={env.id}
                    onClick={() => setSelectedEnvId(env.id)}
                    className={`px-3 py-2 rounded text-sm cursor-pointer transition-all ${
                      selectedEnvId === env.id
                        ? 'bg-primary/20 text-primary font-semibold'
                        : 'text-text hover:bg-surface/50'
                    }`}
                  >
                    {env.name}
                  </div>
                ))}
                {environments.length === 0 && (
                  <div className="text-xs text-muted italic p-2 text-center">
                    No environments found.
                  </div>
                )}
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-6 overflow-y-auto bg-background/10">
              {selectedEnv ? (
                <EnvEditor
                  key={selectedEnv.id}
                  env={selectedEnv}
                  onUpdate={updateEnvironment}
                  onDelete={deleteEnvironment}
                  onClose={() => setSelectedEnvId(null)}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted">
                  <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center mb-4">
                    <Settings size={32} className="opacity-20" />
                  </div>
                  <p className="text-sm italic">
                    Select an environment to view and edit its variables.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

interface EnvEditorProps {
  env: Environment
  onUpdate: (id: number, name: string, variables: Record<string, string>) => Promise<void>
  onDelete: (id: number) => Promise<void>
  onClose: () => void
}

const EnvEditor = ({ env, onUpdate, onDelete, onClose }: EnvEditorProps): React.JSX.Element => {
  const [name, setName] = useState(env.name)
  const [vars, setVars] = useState<Record<string, string>>(env.variables || {})
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async (): Promise<void> => {
    setIsSaving(true)
    await onUpdate(env.id, name, vars)
    setIsSaving(false)
  }

  const handleDelete = async (): Promise<void> => {
    if (window.confirm(`Are you sure you want to delete "${env.name}"?`)) {
      await onDelete(env.id)
      onClose()
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
      <div>
        <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-2">
          Environment Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg px-4 py-2 text-sm text-text focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-muted uppercase tracking-wider">
            Variables
          </label>
          <span className="text-[10px] text-muted italic">
            Used as {'{{variable_name}}'} in requests
          </span>
        </div>
        <KeyValueEditor
          initialData={vars}
          onChange={(data) => setVars(data as Record<string, string>)}
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          onClick={handleDelete}
          className="flex items-center gap-2 text-xs text-danger hover:text-danger-hover font-medium px-3 py-2 rounded hover:bg-danger/10 transition-all mr-auto"
        >
          <Trash2 size={14} /> Delete Environment
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-primary hover:bg-primary-hover text-white px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
        >
          {isSaving && <Loader2 size={14} className="animate-spin" />}
          Save Changes
        </button>
      </div>
    </div>
  )
}
