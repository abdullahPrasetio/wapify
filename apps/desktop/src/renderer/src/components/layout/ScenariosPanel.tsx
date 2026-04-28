import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  ChevronLeft,
  Plus,
  Trash2,
  Save,
  Info,
  LayoutGrid,
  Code,
  GripVertical,
  Terminal,
  FileUp,
  FileText
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { apiClient, getBaseUrl } from '../../api/client'
import type { MockEndpoint, MockScenario, MockCondition } from '../../types'
import { toast } from 'sonner'
import Editor from '@monaco-editor/react'

interface ScenariosPanelProps {
  endpoint: MockEndpoint
  onBack: () => void
  onUpdateEndpoint: (updated: MockEndpoint) => void
}

const SOURCES = ['query', 'body', 'header', 'path'] as const
const OPERATORS = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'exists',
  'not_exists',
  'regex'
] as const

const setDeep = (obj: any, path: string, value: any) => {
  const parts = path.split('.')
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (!current[part]) current[part] = {}
    current = current[part]
  }
  current[parts[parts.length - 1]] = value
}

const SortableScenarioItem = ({ 
  scenario, 
  isActive, 
  isForced,
  onClick,
  onCopyAsCurl
}: { 
  scenario: MockScenario, 
  isActive: boolean, 
  isForced: boolean,
  onClick: () => void,
  onCopyAsCurl: () => void
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: scenario.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex flex-col gap-1 p-2.5 rounded-lg text-left transition-all border ${
        isActive ? 'bg-violet-500/10 border-violet-500/30' : 'border-transparent hover:bg-white/5 text-muted hover:text-foreground'
      } ${isForced ? 'ring-1 ring-amber-500/50 bg-amber-500/5 border-amber-500/30' : ''}`}
    >
      <div 
        {...attributes} 
        {...listeners} 
        className="absolute left-1 top-3 opacity-0 group-hover/sortable:opacity-40 cursor-grab active:cursor-grabbing p-1 z-30"
      >
        <GripVertical size={12} />
      </div>

      <div onClick={onClick} className="pl-5 cursor-pointer flex-1">
        <div className="flex items-center justify-between w-full">
          <span className={`text-xs font-bold truncate ${isActive ? 'text-violet-400' : ''}`}>{scenario.name}</span>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <button 
              onClick={(e) => { e.stopPropagation(); onCopyAsCurl(); }}
              className="p-1 rounded hover:bg-violet-500/20 text-muted hover:text-violet-400 transition-colors"
              title="Copy cURL to trigger this scenario"
            >
              <Terminal size={11} />
            </button>
            {isForced && (
              <span className="flex items-center gap-1 text-[8px] font-black bg-amber-500 text-black px-1.5 py-0.5 rounded uppercase tracking-tighter">
                Forced
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-mono opacity-60">
           <span className={scenario.status_code < 400 ? 'text-emerald-400' : 'text-rose-400'}>{scenario.status_code}</span>
           <span>•</span>
           <span>{scenario.conditions?.length || 0} rules</span>
           {scenario.is_default && <span className="text-info font-bold ml-auto">[DEFAULT]</span>}
        </div>
      </div>
    </div>
  )
}

export const ScenariosPanel: React.FC<ScenariosPanelProps> = ({
  endpoint,
  onBack,
  onUpdateEndpoint
}) => {
  const [scenarios, setScenarios] = useState<MockScenario[]>([])
  const [activeScenarioId, setActiveScenarioId] = useState<number | null>(null)
  const [editingScenario, setEditingScenario] = useState<MockScenario | null>(null)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  )

  const fetchScenarios = useCallback(async () => {
    if (!endpoint?.id) return
    try {
      const res = await apiClient.get<MockScenario[]>(
        `/api/v1/collections/${endpoint.collection_id}/mock/endpoints/${endpoint.id}/scenarios`
      )
      const data = res.data as MockScenario[]
      setScenarios(data)
      if (data.length > 0 && !activeScenarioId) {
        const first = data[0]
        setActiveScenarioId(first.id)
        setEditingScenario(first)
      }
    } catch {
      toast.error('Failed to load scenarios')
    }
  }, [endpoint, activeScenarioId])

  useEffect(() => {
    fetchScenarios()
  }, [fetchScenarios])

  const handleModeChange = async (mode: 'auto' | 'manual', scenarioId: number | null) => {
    if (!endpoint?.id || !scenarioId) return
    try {
      await apiClient.patch(
        `/api/v1/collections/${endpoint.collection_id}/mock/endpoints/${endpoint.id}/mode`,
        { evaluation_mode: mode, active_scenario_id: scenarioId }
      )
      onUpdateEndpoint({ ...endpoint, evaluation_mode: mode, active_scenario_id: scenarioId })
    } catch {
      toast.error('Failed to update mode')
    }
  }

  const handleAddScenario = async () => {
    if (!endpoint?.id) return
    try {
      const res = await apiClient.post<MockScenario>(
        `/api/v1/collections/${endpoint.collection_id}/mock/endpoints/${endpoint.id}/scenarios`,
        {
          name: 'New Scenario',
          status_code: 200,
          response_body: '{\n  "status": "success"\n}',
          conditions: [],
          order_index: scenarios.length > 0 ? Math.max(...scenarios.map(s => s.order_index)) + 1000 : 1000
        }
      )
      const newScenario = res.data as MockScenario
      if (!newScenario?.id) throw new Error("Invalid response")
      
      setScenarios(prev => [...prev, newScenario])
      setActiveScenarioId(newScenario.id)
      setEditingScenario(newScenario)
      toast.success('Scenario created')
    } catch (err) {
      console.error(err)
      toast.error('Failed to create scenario')
    }
  }

  const handleUpdateScenario = async () => {
    // PROTEKSI: Cek ID sebelum kirim
    if (!editingScenario?.id || editingScenario.id.toString() === 'undefined') {
      toast.error('Cannot save: Scenario ID is missing. Try creating a new one.')
      return
    }
    if (!endpoint?.id || !endpoint?.collection_id) return

    setSaving(true)
    try {
      const res = await apiClient.put<MockScenario>(
        `/api/v1/collections/${endpoint.collection_id}/mock/endpoints/${endpoint.id}/scenarios/${editingScenario.id}`,
        editingScenario
      )
      const updated = res.data as MockScenario
      setScenarios(prev => prev.map(s => {
        if (s.id === updated.id) return updated
        if (updated.is_default) return { ...s, is_default: false }
        return s
      }))
      setEditingScenario(updated)
      toast.success('Scenario saved')
    } catch (err) {
      console.error(err)
      toast.error('Failed to save scenario')
    } finally {
      setSaving(false)
    }
  }

  const selectScenario = (s: MockScenario) => {
    setActiveScenarioId(s.id)
    setEditingScenario(s)
    if (endpoint.evaluation_mode === 'manual') {
      handleModeChange('manual', s.id)
    }
  }

  const copyAsCurl = (s: MockScenario) => {
    const mockBaseUrl = `${getBaseUrl()}/mock/${endpoint.collection_id}`
    const url = `${mockBaseUrl}${endpoint.path}`
    
    const queryParams: Record<string, string> = {}
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const bodyObj: any = {}

    // SMART INJECTION: Analyze conditions to satisfy the scenario
    if (s.conditions && s.conditions.length > 0) {
      s.conditions.forEach(c => {
        // Value to inject
        let val = c.value
        if (c.operator === 'exists') val = 'example_value'
        if (c.operator === 'contains' && !val) val = 'search_term'
        
        if (!val && (c.operator === 'equals' || c.operator === 'contains')) {
           val = "required_value"
        }

        if (c.source === 'query') queryParams[c.key] = val
        if (c.source === 'header') headers[c.key] = val
        if (c.source === 'body') setDeep(bodyObj, c.key, val)
        if (c.source === 'path') {
           // For path params, we might need a more complex URL replacement logic in the future
           // For now, we add as query to hint the user or just ignore
        }
      })
    }

    // Build query string
    const qs = Object.keys(queryParams).length > 0 
      ? '?' + new URLSearchParams(queryParams).toString() 
      : ''
    
    // Build headers string
    const headerLines = Object.entries(headers)
      .map(([k, v]) => `-H "${k}: ${v}"`)

    // Build body string
    let bodyPart = ''
    if (Object.keys(bodyObj).length > 0) {
      bodyPart = ` \\\n     -d '${JSON.stringify(bodyObj, null, 2)}'`
    } else if (endpoint.method !== 'GET' && endpoint.method !== 'HEAD') {
      // Add empty JSON if method usually requires body but none in conditions
      bodyPart = ` \\\n     -d '{}'`
    }

    const curl = `curl -X ${endpoint.method} "${url}${qs}" \\\n     ${headerLines.join(' \\\n     ')}${bodyPart}`
    
    navigator.clipboard.writeText(curl)
    toast.success(`cURL for "${s.name}" copied with required data!`)
  }

  const handleDeleteScenario = async (id: number) => {
    if (!id || id.toString() === 'undefined') return
    if (!window.confirm('Delete this scenario?') || !endpoint?.id || !endpoint?.collection_id) return
    try {
      await apiClient.delete(`/api/v1/collections/${endpoint.collection_id}/mock/endpoints/${endpoint.id}/scenarios/${id}`)
      setScenarios(prev => prev.filter(s => s.id !== id))
      if (activeScenarioId === id) {
        setActiveScenarioId(null)
        setEditingScenario(null)
      }
      toast.success('Scenario deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !endpoint?.id) return

    const oldIndex = scenarios.findIndex(s => s.id === active.id)
    const newIndex = scenarios.findIndex(s => s.id === over.id)
    
    const newScenarios = arrayMove(scenarios, oldIndex, newIndex)
    const updatedWithOrder = newScenarios.map((s, i) => ({ ...s, order_index: (i + 1) * 1000 }))
    setScenarios(updatedWithOrder)

    try {
      await apiClient.patch(`/api/v1/collections/${endpoint.collection_id}/mock/endpoints/${endpoint.id}/scenarios/reorder`, {
        scenarios: updatedWithOrder.map(s => ({ id: s.id, order_index: s.order_index }))
      })
    } catch {
      toast.error('Failed to save order')
    }
  }

  const addCondition = () => {
    if (!editingScenario) return
    const newConditions = [...(editingScenario.conditions || []), { source: 'body', key: '', operator: 'equals', value: '' }]
    setEditingScenario({ ...editingScenario, conditions: newConditions as any })
  }

  const updateCondition = (index: number, update: Partial<MockCondition>) => {
    if (!editingScenario) return
    const newConditions = [...editingScenario.conditions]
    newConditions[index] = { ...newConditions[index], ...update }
    setEditingScenario({ ...editingScenario, conditions: newConditions })
  }

  const removeCondition = (index: number) => {
    if (!editingScenario) return
    const newConditions = editingScenario.conditions.filter((_, i) => i !== index)
    setEditingScenario({ ...editingScenario, conditions: newConditions })
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editingScenario) return

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      setEditingScenario({
        ...editingScenario,
        response_type: 'file',
        file_name: file.name,
        file_base64: base64
      })
      toast.success(`File "${file.name}" uploaded locally. Click Save to persist.`)
    }
    reader.readAsDataURL(file)
  }

  const sortableIds = useMemo(() => scenarios.map(s => s.id), [scenarios])

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Top Header */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-white/10 bg-black/20">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/5 text-muted transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">{endpoint.method}</span>
            <h3 className="text-sm font-semibold truncate max-w-[300px]">{endpoint.path}</h3>
          </div>
        </div>

        <div className="h-6 w-px bg-white/10 mx-2" />

        {/* Mode Switcher */}
        <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg border border-white/5">
           <button 
             onClick={() => handleModeChange('auto', activeScenarioId)}
             className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${endpoint.evaluation_mode === 'auto' ? 'bg-violet-500 text-white shadow-lg' : 'text-muted hover:text-foreground'}`}
           >
             Auto / Dynamic
           </button>
           <button 
             onClick={() => handleModeChange('manual', activeScenarioId)}
             className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${endpoint.evaluation_mode === 'manual' ? 'bg-amber-500 text-white shadow-lg' : 'text-muted hover:text-foreground'}`}
           >
             Manual / Forced
           </button>
        </div>

        {endpoint.evaluation_mode === 'manual' && (
          <div className="flex items-center gap-2 text-[10px] text-amber-400/80 italic animate-pulse">
            <Info size={12} />
            Always returns the selected scenario
          </div>
        )}

        <button 
          onClick={handleUpdateScenario}
          disabled={saving || !editingScenario}
          className="ml-auto flex items-center gap-2 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
        >
          {saving ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
          Save Changes
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Scenarios List */}
        <div className="w-64 border-r border-white/10 flex flex-col bg-black/20">
          <div className="p-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-[10px] font-black text-muted uppercase tracking-widest">Priority / Scenarios</span>
            <button onClick={handleAddScenario} className="p-1 hover:text-violet-400 transition-colors" title="Add Scenario"><Plus size={14} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                {scenarios.map(s => (
                  <SortableScenarioItem
                    key={s.id}
                    scenario={s}
                    isActive={activeScenarioId === s.id}
                    isForced={endpoint.evaluation_mode === 'manual' && s.id === endpoint.active_scenario_id}
                    onClick={() => selectScenario(s)}
                    onCopyAsCurl={() => copyAsCurl(s)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>

        {/* Scenario Editor */}
        <div className="flex-1 flex flex-col overflow-hidden text-foreground">
          {editingScenario ? (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5">Scenario Name</label>
                  <input 
                    type="text" 
                    value={editingScenario.name} 
                    onChange={e => setEditingScenario({ ...editingScenario, name: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5">HTTP Status</label>
                  <input 
                    type="number" 
                    value={editingScenario.status_code} 
                    onChange={e => setEditingScenario({ ...editingScenario, status_code: parseInt(e.target.value) })}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500/50"
                  />
                </div>
              </div>

              <div className="space-y-3">
                 <div className="flex items-center justify-between">
                   <label className="block text-[10px] font-black text-muted uppercase tracking-widest">Rules (IF)</label>
                   <button onClick={addCondition} className="text-[10px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1">
                     <Plus size={12} /> Add Rule
                   </button>
                 </div>
                 
                 {(!editingScenario.conditions || editingScenario.conditions.length === 0) ? (
                   <div className="p-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-center">
                     <p className="text-xs text-muted">No rules. Used as default if Auto mode fails to match others.</p>
                   </div>
                 ) : (
                   <div className="space-y-2">
                     {editingScenario.conditions.map((cond, idx) => (
                       <div key={idx} className="flex items-center gap-2 bg-black/30 p-2 rounded-lg border border-white/5">
                         <select 
                           value={cond.source} 
                           onChange={e => updateCondition(idx, { source: e.target.value as any })}
                           className="bg-transparent text-xs font-bold text-violet-400 focus:outline-none"
                         >
                           {SOURCES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                         </select>
                         <input 
                           type="text" 
                           placeholder="key"
                           value={cond.key}
                           onChange={e => updateCondition(idx, { key: e.target.value })}
                           className="flex-1 bg-black/20 border border-white/5 rounded px-2 py-1 text-xs focus:outline-none"
                         />
                         <select 
                           value={cond.operator}
                           onChange={e => updateCondition(idx, { operator: e.target.value as any })}
                           className="bg-transparent text-xs text-muted focus:outline-none"
                         >
                           {OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}
                         </select>
                         <input 
                           type="text" 
                           placeholder="value"
                           value={cond.value}
                           onChange={e => updateCondition(idx, { value: e.target.value })}
                           className="flex-1 bg-black/20 border border-white/5 rounded px-2 py-1 text-xs focus:outline-none"
                         />
                         <button onClick={() => removeCondition(idx)} className="p-1 text-muted hover:text-rose-400"><Trash2 size={12} /></button>
                       </div>
                     ))}
                   </div>
                 )}
              </div>

              <div className="flex-1 flex flex-col min-h-[300px] space-y-3">
                 <div className="flex items-center justify-between">
                   <label className="block text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                     <Code size={12} /> Response Content
                   </label>

                   <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                      <button 
                        onClick={() => setEditingScenario({ ...editingScenario, response_type: 'text' })}
                        className={`px-3 py-1 text-[9px] font-bold uppercase rounded-md transition-all flex items-center gap-1.5 ${editingScenario.response_type !== 'file' ? 'bg-violet-500 text-white shadow-lg' : 'text-muted hover:text-foreground'}`}
                      >
                        <FileText size={10} /> Text / JSON
                      </button>
                      <button 
                        onClick={() => setEditingScenario({ ...editingScenario, response_type: 'file' })}
                        className={`px-3 py-1 text-[9px] font-bold uppercase rounded-md transition-all flex items-center gap-1.5 ${editingScenario.response_type === 'file' ? 'bg-violet-500 text-white shadow-lg' : 'text-muted hover:text-foreground'}`}
                      >
                        <FileUp size={10} /> Binary / File
                      </button>
                   </div>
                 </div>
                 
                 {editingScenario.response_type === 'file' ? (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-xl bg-white/[0.02] p-8 space-y-4">
                       <div className="w-16 h-16 rounded-full bg-violet-500/10 flex items-center justify-center">
                          <FileUp size={32} className="text-violet-400" />
                       </div>
                       <div className="text-center">
                          <p className="text-sm font-bold text-foreground">
                             {editingScenario.file_name || 'Select a file to serve'}
                          </p>
                          <p className="text-[10px] text-muted mt-1">
                             Supports PDF, Images, JSON, etc. Max 5MB recommended.
                          </p>
                       </div>
                       <label className="px-6 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-xs font-bold transition-all cursor-pointer">
                          Choose File
                          <input type="file" className="hidden" onChange={handleFileUpload} />
                       </label>
                       {editingScenario.file_base64 && (
                          <span className="text-[9px] text-emerald-400 font-mono">
                             {(editingScenario.file_base64.length * 0.75 / 1024).toFixed(1)} KB stored
                          </span>
                       )}
                    </div>
                 ) : (
                    <div className="flex-1 border border-white/10 rounded-xl overflow-hidden bg-[#1e1e1e]">
                      <Editor 
                        height="300px"
                        defaultLanguage="json"
                        theme="vs-dark"
                        value={editingScenario.response_body}
                        onChange={val => setEditingScenario({ ...editingScenario, response_body: val || '' })}
                        options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true }}
                      />
                    </div>
                 )}
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-white/5">
                 <button 
                   onClick={() => handleDeleteScenario(editingScenario.id)}
                   className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1.5"
                 >
                   <Trash2 size={14} /> Delete
                 </button>
                 <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={editingScenario.is_default}
                      onChange={e => setEditingScenario({ ...editingScenario, is_default: e.target.checked })}
                      className="w-3 h-3 rounded border-white/10 bg-black/40 text-violet-500" 
                    />
                    <span className="text-[10px] font-bold text-muted uppercase">Fallback Scenario</span>
                 </label>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted gap-3">
              <LayoutGrid size={40} className="opacity-10" />
              <p className="text-sm">Select or create a scenario</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
