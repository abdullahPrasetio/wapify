import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  PlayCircle, X, ChevronDown, ChevronRight, CheckSquare, Square,
  CheckCircle2, XCircle, Clock, Download, RotateCcw, Loader2
} from 'lucide-react'
import { useDataStore, CollectionRunResult } from '../../store/useDataStore'
import type { ApiRequest, Folder } from '../../types'
import { MethodBadge } from '../ui/MethodBadge'

interface Props {
  collectionId: number
  collectionName: string
  onClose: () => void
}

type RunnerState = 'idle' | 'running' | 'finished'


export const CollectionRunnerPanel: React.FC<Props> = ({ collectionId, collectionName, onClose }) => {
  const { runCollection, foldersByCollection, requestsByCollection, requestsByFolder, fetchCollectionContents, lastRunCollectionId, lastRunResults } = useDataStore()

  const allFolders: Folder[] = foldersByCollection[collectionId] || []
  const rootRequests: ApiRequest[] = requestsByCollection[collectionId] || []

  const allRequests = useMemo(() => {
    const list: ApiRequest[] = [...rootRequests]
    const addFolder = (fid: number) => {
      const reqs = requestsByFolder[fid] || []
      list.push(...reqs)
      allFolders.filter((f) => f.parent_folder_id === fid).forEach((f) => addFolder(f.id))
    }
    allFolders.filter((f) => f.parent_folder_id === null).forEach((f) => addFolder(f.id))
    return list
  }, [rootRequests, allFolders, requestsByFolder])

  const hasCachedResults = lastRunCollectionId === collectionId && lastRunResults.length > 0

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [iterations, setIterations] = useState(1)
  const [delayMs, setDelayMs] = useState(0)
  const [stopOnFailure, setStopOnFailure] = useState(false)
  const [runnerState, setRunnerState] = useState<RunnerState>(hasCachedResults ? 'finished' : 'idle')
  const [results, setResults] = useState<CollectionRunResult[]>(hasCachedResults ? lastRunResults : [])
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set())
  const [currentIndex, setCurrentIndex] = useState(hasCachedResults ? lastRunResults.length : 0)

  useEffect(() => {
    fetchCollectionContents(collectionId)
  }, [collectionId])

  useEffect(() => {
    if (allRequests.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedIds(new Set(allRequests.map((r) => r.id)))
    }
  }, [allRequests.length])

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === allRequests.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(allRequests.map((r) => r.id)))
  }

  const handleRun = async () => {
    setResults([])
    setCurrentIndex(0)
    setRunnerState('running')
    let done = 0
    try {
      await runCollection(
        collectionId,
        (result) => {
          done++
          setCurrentIndex(done)
          setResults((prev) => [...prev, result])
        },
        { selectedIds, iterations, delayMs, stopOnFailure }
      )
    } catch (err) {
      console.error('Collection runner error:', err)
    } finally {
      setRunnerState('finished')
    }
  }

  const handleReset = () => {
    setResults([])
    setCurrentIndex(0)
    setRunnerState('idle')
    setExpandedResults(new Set())
  }

  const totalRun = selectedIds.size * iterations
  const passed = results.filter((r) => r.status >= 200 && r.status < 300).length
  const failed = results.filter((r) => r.status === 0 || r.status >= 400).length
  const totalTime = results.reduce((acc, r) => acc + r.time, 0)

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${collectionName}_run_results.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportCSV = () => {
    const header = 'Name,Method,URL,Status,Time(ms),Tests Passed,Tests Failed'
    const rows = results.map((r) => {
      const tp = r.testResults.filter((t) => t.status === 'passed').length
      const tf = r.testResults.filter((t) => t.status === 'failed').length
      return `"${r.name}","${r.method}","${r.url}",${r.status},${r.time},${tp},${tf}`
    })
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${collectionName}_run_results.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Render request tree node
  const renderRequest = (req: ApiRequest) => (
    <label key={req.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-background/60 cursor-pointer group">
      <button
        onClick={() => toggleSelect(req.id)}
        className="text-muted hover:text-primary transition-colors shrink-0 cursor-pointer"
      >
        {selectedIds.has(req.id) ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} />}
      </button>
      <MethodBadge method={req.method} />
      <span className="text-xs text-text truncate flex-1">{req.name}</span>
      <span className="text-xs text-muted truncate max-w-[160px] hidden group-hover:block">{req.url}</span>
    </label>
  )

  const renderFolder = (folder: Folder) => {
    const children = allFolders.filter((f) => f.parent_folder_id === folder.id)
    const reqs = requestsByFolder[folder.id] || []
    return (
      <div key={folder.id} className="ml-3 border-l border-border pl-2 mt-0.5">
        <div className="flex items-center gap-1 py-1 text-xs text-muted font-semibold uppercase tracking-widest">
          <ChevronRight size={12} /> {folder.name}
        </div>
        {children.map(renderFolder)}
        {reqs.map(renderRequest)}
      </div>
    )
  }

  const rootFolders = allFolders.filter((f) => f.parent_folder_id === null)
  const progress = totalRun > 0 ? Math.round((currentIndex / totalRun) * 100) : 0

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-3xl flex flex-col shadow-2xl overflow-hidden h-[680px]">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-white/5 shrink-0">
          <h2 className="text-base font-bold flex items-center gap-2">
            <PlayCircle size={18} className="text-primary" />
            Collection Runner — {collectionName}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-text transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {runnerState === 'idle' ? (
          <div className="flex flex-1 overflow-hidden">
            {/* Left: request selector */}
            <div className="w-64 border-r border-border flex flex-col overflow-hidden shrink-0">
              <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-muted uppercase tracking-widest">Requests</span>
                <button
                  onClick={toggleSelectAll}
                  className="text-xs text-primary hover:underline cursor-pointer"
                >
                  {selectedIds.size === allRequests.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {rootFolders.map(renderFolder)}
                {rootRequests.map(renderRequest)}
                {allRequests.length === 0 && (
                  <p className="text-xs text-muted text-center py-8 italic">No requests in collection</p>
                )}
              </div>
            </div>

            {/* Right: config */}
            <div className="flex-1 flex flex-col p-5 gap-5 overflow-y-auto">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-text">Run Configuration</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-1.5">
                      Iterations
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={iterations}
                      onChange={(e) => setIterations(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-1.5">
                      Delay between requests (ms)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={30000}
                      step={100}
                      value={delayMs}
                      onChange={(e) => setDelayMs(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    onClick={() => setStopOnFailure((v) => !v)}
                    className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${stopOnFailure ? 'bg-danger' : 'bg-border'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${stopOnFailure ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-text">Stop on failure</span>
                    <p className="text-xs text-muted">Stop the run if any request fails or has a failed test</p>
                  </div>
                </label>
              </div>

              <div className="mt-auto">
                <div className="p-3 bg-background/50 rounded-lg border border-border text-xs text-muted mb-4">
                  <span className="font-bold text-text">{selectedIds.size}</span> request{selectedIds.size !== 1 ? 's' : ''} selected
                  {iterations > 1 && <> × <span className="font-bold text-text">{iterations}</span> iterations = <span className="font-bold text-primary">{selectedIds.size * iterations}</span> total requests</>}
                  {delayMs > 0 && <>, <span className="font-bold text-text">{delayMs}ms</span> delay</>}
                </div>
                <button
                  onClick={handleRun}
                  disabled={selectedIds.size === 0}
                  className="w-full py-3 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Run Collection
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Progress */}
            <div className="px-5 py-3 border-b border-border shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1 text-success font-bold">
                    <CheckCircle2 size={13} /> {passed} passed
                  </span>
                  <span className="flex items-center gap-1 text-danger font-bold">
                    <XCircle size={13} /> {failed} failed
                  </span>
                  <span className="flex items-center gap-1 text-muted">
                    <Clock size={13} /> {totalTime}ms total
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {runnerState === 'running' && (
                    <span className="flex items-center gap-1 text-xs text-primary">
                      <Loader2 size={12} className="animate-spin" /> {currentIndex}/{totalRun}
                    </span>
                  )}
                  {runnerState === 'finished' && (
                    <>
                      <button onClick={exportJSON} className="flex items-center gap-1 px-2 py-1 text-xs bg-background border border-border rounded hover:border-primary text-text transition-colors cursor-pointer">
                        <Download size={12} /> JSON
                      </button>
                      <button onClick={exportCSV} className="flex items-center gap-1 px-2 py-1 text-xs bg-background border border-border rounded hover:border-primary text-text transition-colors cursor-pointer">
                        <Download size={12} /> CSV
                      </button>
                      <button onClick={handleReset} className="flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 border border-primary/20 rounded text-primary font-bold transition-colors cursor-pointer">
                        <RotateCcw size={12} /> Run Again
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
              {results.map((r, i) => {
                const isExpanded = expandedResults.has(i)
                const hasFailed = r.status === 0 || r.status >= 400 || r.testResults.some((t) => t.status === 'failed')
                const hasTests = r.testResults.length > 0

                return (
                  <div
                    key={i}
                    className={`border rounded-lg overflow-hidden transition-colors ${hasFailed ? 'border-danger/30 bg-danger/5' : 'border-success/20 bg-success/5'}`}
                  >
                    <button
                      onClick={() => {
                        if (!hasTests) return
                        setExpandedResults((prev) => {
                          const next = new Set(prev)
                          if (next.has(i)) next.delete(i)
                          else next.add(i)
                          return next
                        })
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left ${hasTests ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      {hasFailed
                        ? <XCircle size={14} className="text-danger shrink-0" />
                        : <CheckCircle2 size={14} className="text-success shrink-0" />
                      }
                      <MethodBadge method={r.method} />
                      <span className="text-xs text-text flex-1 truncate">{r.name}</span>
                      <span className="text-xs text-muted truncate hidden sm:block max-w-[180px]">{r.url}</span>
                      <span className={`text-xs font-bold ml-2 ${r.status >= 200 && r.status < 300 ? 'text-success' : r.status === 0 ? 'text-danger' : r.status >= 400 ? 'text-danger' : 'text-warning'}`}>
                        {r.status || 'ERR'}
                      </span>
                      <span className="text-xs text-muted ml-2 w-14 text-right">{r.time}ms</span>
                      {hasTests && (
                        isExpanded ? <ChevronDown size={13} className="text-muted shrink-0" /> : <ChevronRight size={13} className="text-muted shrink-0" />
                      )}
                    </button>

                    {isExpanded && hasTests && (
                      <div className="border-t border-border/50 px-3 pb-2 pt-1.5 space-y-1">
                        {r.testResults.map((t, ti) => (
                          <div key={ti} className="flex items-start gap-2 text-xs">
                            {t.status === 'passed'
                              ? <CheckCircle2 size={12} className="text-success shrink-0 mt-0.5" />
                              : <XCircle size={12} className="text-danger shrink-0 mt-0.5" />
                            }
                            <span className={t.status === 'passed' ? 'text-success' : 'text-danger'}>{t.name}</span>
                            {t.error && <span className="text-muted ml-1">— {t.error}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {runnerState === 'running' && results.length === 0 && (
                <div className="text-center py-12 text-muted text-xs">
                  <Loader2 size={24} className="animate-spin mx-auto mb-3 text-primary" />
                  Running requests...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  , document.body)
}
