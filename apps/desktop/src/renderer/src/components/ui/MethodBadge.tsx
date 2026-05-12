import React from 'react'

interface MethodBadgeProps {
  method: string
  size?: 'sm' | 'md'
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  POST: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  PUT: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  PATCH: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  DELETE: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  HEAD: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  OPTIONS: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
}

export const MethodBadge: React.FC<MethodBadgeProps> = ({ method, size = 'sm' }) => {
  const m = method.toUpperCase()
  const color = METHOD_COLORS[m] ?? 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5 min-w-[42px]' : 'text-xs px-2 py-1 min-w-[52px]'

  return (
    <span
      className={`inline-flex items-center justify-center rounded border font-mono font-bold uppercase tracking-wide ${color} ${sizeClass}`}
    >
      {m}
    </span>
  )
}
