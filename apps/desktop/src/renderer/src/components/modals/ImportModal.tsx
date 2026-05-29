import * as Dialog from '@radix-ui/react-dialog'
import { FileDown, X, AlertTriangle, Code2 } from 'lucide-react'
import { useState, useMemo, useEffect } from 'react'
import { useDataStore } from '../../store/useDataStore'
import { toast } from 'sonner'

type ImportTab = 'wapbolt' | 'openapi'

const detectFormat = (content: string): ImportTab | null => {
  try {
    const data = JSON.parse(content)
    if (data.openapi || data.swagger) return 'openapi'
    if (data.info?.schema?.includes('postman') || data.item) return 'wapbolt'
  } catch {
    // ignore
  }
  return null
}

const countOpenAPIEndpoints = (content: string): number => {
  try {
    const data = JSON.parse(content)
    const paths = data.paths || {}
    const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']
    let count = 0
    for (const path of Object.values(paths) as any[]) {
      for (const method of methods) {
        if (path[method]) count++
      }
    }
    return count
  } catch {
    return 0
  }
}

export const ImportModal = (): React.JSX.Element => {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<ImportTab>('wapbolt')
  const [jsonContent, setJsonContent] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importMode, setImportMode] = useState<'new' | 'overwrite'>('new')
  const [confirmName, setConfirmName] = useState('')
  const [formatHint, setFormatHint] = useState<ImportTab | null>(null)

  const { importCollection, importOpenAPI, collections } = useDataStore()

  const { detectedName, isCollision, endpointCount } = useMemo(() => {
    try {
      if (!jsonContent.trim()) return { detectedName: '', isCollision: false, endpointCount: 0 }
      const data = JSON.parse(jsonContent)
      if (activeTab === 'openapi') {
        const name = data.info?.title || 'Imported API'
        const collision = collections.some((c) => c.name === name)
        const endpointCount = countOpenAPIEndpoints(jsonContent)
        return { detectedName: name, isCollision: collision, endpointCount }
      }
      const name = data.info?.name || ''
      const collision = collections.some((c) => c.name === name)
      return { detectedName: name, isCollision: collision, endpointCount: 0 }
    } catch {
      return { detectedName: '', isCollision: false, endpointCount: 0 }
    }
  }, [jsonContent, collections, activeTab])

  useEffect(() => {
    setImportMode('new')
    setConfirmName('')
    if (jsonContent.trim()) {
      const fmt = detectFormat(jsonContent)
      setFormatHint(fmt)
    } else {
      setFormatHint(null)
    }
  }, [jsonContent])

  const handleImport = async (): Promise<void> => {
    if (!jsonContent.trim()) return

    if (importMode === 'overwrite' && confirmName !== detectedName) {
      toast.error(`Confirmation mismatch. Please type "${detectedName}" exactly.`)
      return
    }

    setIsImporting(true)
    if (activeTab === 'openapi') {
      await importOpenAPI(jsonContent, importMode, confirmName)
    } else {
      await importCollection(jsonContent, importMode, confirmName)
    }
    setIsImporting(false)
    setJsonContent('')
    setOpen(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.json')) {
      toast.error('Only JSON files are supported. Convert your YAML spec to JSON first.')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = (event): void => {
      const content = event.target?.result as string
      setJsonContent(content)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const tabDescription =
    activeTab === 'wapbolt'
      ? 'Import Wapbolt / Postman Collection (v2.1)'
      : 'Import OpenAPI 3.0 or Swagger 2.0 spec'

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button title="Import Collection" className="text-muted hover:text-text transition-colors p-1">
          <FileDown size={14} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-300" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl z-50 p-6 animate-in zoom-in-95 fade-in duration-300">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <FileDown size={20} />
              </div>
              <div>
                <Dialog.Title className="text-lg font-bold text-text">Import Collection</Dialog.Title>
                <Dialog.Description className="text-xs text-muted">{tabDescription}</Dialog.Description>
              </div>
            </div>
            <Dialog.Close className="text-muted hover:text-text transition-colors cursor-pointer">
              <X size={20} />
            </Dialog.Close>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 p-1 bg-background rounded-lg mb-5">
            <button
              onClick={() => { setActiveTab('wapbolt'); setJsonContent(''); setFormatHint(null) }}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'wapbolt'
                  ? 'bg-surface text-text shadow-sm'
                  : 'text-muted hover:text-text'
              }`}
            >
              <FileDown size={13} /> Wapbolt / Postman
            </button>
            <button
              onClick={() => { setActiveTab('openapi'); setJsonContent(''); setFormatHint(null) }}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'openapi'
                  ? 'bg-surface text-text shadow-sm'
                  : 'text-muted hover:text-text'
              }`}
            >
              <Code2 size={13} /> OpenAPI / Swagger
            </button>
          </div>

          <div className="max-h-[55vh] overflow-y-auto pr-1 space-y-4">
            {/* Auto-detect hint */}
            {formatHint && formatHint !== activeTab && (
              <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <AlertTriangle size={14} className="text-primary shrink-0" />
                <p className="text-xs text-primary">
                  This looks like a{' '}
                  <strong>{formatHint === 'openapi' ? 'OpenAPI / Swagger' : 'Postman'}</strong> file.{' '}
                  <button
                    onClick={() => setActiveTab(formatHint)}
                    className="underline font-bold cursor-pointer"
                  >
                    Switch tab
                  </button>
                </p>
              </div>
            )}

            {/* OpenAPI preview */}
            {activeTab === 'openapi' && endpointCount > 0 && (
              <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-lg">
                <Code2 size={14} className="text-success shrink-0" />
                <p className="text-xs text-success">
                  Detected <strong>{endpointCount} endpoint{endpointCount !== 1 ? 's' : ''}</strong> from{' '}
                  <strong>"{detectedName}"</strong> — ready to import.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">
                Upload File
              </label>
              <div className="relative group">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="border-2 border-dashed border-border group-hover:border-primary rounded-lg p-6 flex flex-col items-center justify-center transition-colors bg-background/50">
                  <FileDown size={24} className="text-muted group-hover:text-primary mb-2" />
                  <span className="text-sm text-text font-medium">Click to upload or drag & drop</span>
                  <span className="text-xs text-muted">
                    {activeTab === 'openapi' ? 'OpenAPI / Swagger JSON file (YAML not supported)' : 'Postman or Wapbolt JSON file'}
                  </span>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface px-2 text-muted font-bold tracking-widest">OR</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">
                Paste JSON
              </label>
              <textarea
                value={jsonContent}
                onChange={(e): void => setJsonContent(e.target.value)}
                placeholder={
                  activeTab === 'openapi'
                    ? '{ "openapi": "3.0.0", "info": { ... }, "paths": { ... } }'
                    : '{ "info": { ... }, "item": [ ... ] }'
                }
                className="w-full h-32 bg-background border border-border rounded-lg p-3 text-xs font-mono text-text placeholder:text-muted focus:outline-none focus:border-primary resize-none"
              />
            </div>

            {/* Collision Detection */}
            {isCollision && (
              <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-warning shrink-0" size={18} />
                  <div>
                    <p className="text-sm font-bold text-warning">Collection Already Exists</p>
                    <p className="text-xs text-warning/80">
                      A collection named <strong>"{detectedName}"</strong> already exists in this team.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={importMode === 'new'}
                      onChange={() => setImportMode('new')}
                      className="accent-primary"
                    />
                    <span className="text-xs font-medium text-text">Import as New (Duplicate)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={importMode === 'overwrite'}
                      onChange={() => setImportMode('overwrite')}
                      className="accent-warning"
                    />
                    <span className="text-xs font-medium text-text">Overwrite Existing</span>
                  </label>
                </div>
                {importMode === 'overwrite' && (
                  <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                    <p className="text-xs text-muted">
                      All requests and folders in the existing collection will be{' '}
                      <strong>replaced</strong>. To confirm, type the collection name below:
                    </p>
                    <input
                      type="text"
                      value={confirmName}
                      onChange={(e) => setConfirmName(e.target.value)}
                      placeholder={detectedName}
                      className="w-full bg-background border border-warning/30 rounded-lg p-2 text-xs text-text focus:outline-none focus:border-warning"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Dialog.Close asChild>
              <button className="px-4 py-2 text-sm font-medium text-text hover:bg-background rounded-lg transition-colors cursor-pointer">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleImport}
              disabled={
                isImporting ||
                !jsonContent.trim() ||
                (importMode === 'overwrite' && confirmName !== detectedName)
              }
              className={`px-6 py-2 text-sm font-bold rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:scale-95 flex items-center gap-2 cursor-pointer ${
                importMode === 'overwrite'
                  ? 'bg-warning hover:bg-warning/80 text-white shadow-warning/20'
                  : 'bg-primary hover:bg-primary-hover text-white shadow-primary/20'
              }`}
            >
              {isImporting
                ? 'Importing...'
                : importMode === 'overwrite'
                ? 'Overwrite Now'
                : 'Import Now'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
