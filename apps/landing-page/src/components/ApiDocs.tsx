import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface Endpoint {
  method: Method;
  path: string;
  description: string;
  auth?: boolean;
  body?: string;
  response?: string;
}

interface Group {
  name: string;
  color: string;
  bg: string;
  endpoints: Endpoint[];
}

const methodColors: Record<Method, string> = {
  GET: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  POST: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  PUT: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  PATCH: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/40',
};

const groups: Group[] = [
  {
    name: 'Authentication',
    color: 'text-purple-400',
    bg: 'border-purple-500/30',
    endpoints: [
      { method: 'POST', path: '/api/v1/auth/login', description: 'Login dan dapatkan JWT access + refresh token', body: '{ "email": "user@example.com", "password": "..." }', response: '{ "access_token": "...", "refresh_token": "..." }' },
      { method: 'POST', path: '/api/v1/auth/refresh', description: 'Refresh access token menggunakan refresh token' },
      { method: 'POST', path: '/api/v1/auth/logout', description: 'Invalidate refresh token', auth: true },
      { method: 'GET', path: '/api/v1/auth/me', description: 'Ambil data user yang sedang login', auth: true },
      { method: 'PUT', path: '/api/v1/auth/change-password', description: 'Ganti password user saat ini', auth: true, body: '{ "old_password": "...", "new_password": "..." }' },
    ],
  },
  {
    name: 'Workspaces (Teams)',
    color: 'text-blue-400',
    bg: 'border-blue-500/30',
    endpoints: [
      { method: 'GET', path: '/api/v1/teams', description: 'List semua workspace yang diikuti user', auth: true },
      { method: 'POST', path: '/api/v1/teams', description: 'Buat workspace baru (Admin only)', auth: true, body: '{ "name": "Backend Team", "description": "..." }' },
      { method: 'GET', path: '/api/v1/teams/:id', description: 'Detail workspace by ID', auth: true },
      { method: 'PUT', path: '/api/v1/teams/:id', description: 'Update nama atau deskripsi workspace', auth: true },
      { method: 'DELETE', path: '/api/v1/teams/:id', description: 'Hapus workspace beserta semua data', auth: true },
      { method: 'GET', path: '/api/v1/teams/:id/members', description: 'List semua member di workspace', auth: true },
      { method: 'POST', path: '/api/v1/teams/:id/members', description: 'Invite user ke workspace dengan role', auth: true },
      { method: 'PUT', path: '/api/v1/teams/:id/members/:userId', description: 'Update role member', auth: true },
      { method: 'DELETE', path: '/api/v1/teams/:id/members/:userId', description: 'Hapus member dari workspace', auth: true },
    ],
  },
  {
    name: 'Collections',
    color: 'text-emerald-400',
    bg: 'border-emerald-500/30',
    endpoints: [
      { method: 'GET', path: '/api/v1/teams/:id/collections', description: 'List semua collection di workspace', auth: true },
      { method: 'POST', path: '/api/v1/teams/:id/collections', description: 'Buat collection baru', auth: true, body: '{ "name": "Payment API", "description": "...", "confluence_page_id": "..." }' },
      { method: 'POST', path: '/api/v1/teams/:id/import', description: 'Import collection dari file Postman v2.1', auth: true },
      { method: 'POST', path: '/api/v1/teams/:id/import-openapi', description: 'Import dari OpenAPI / Swagger spec', auth: true },
      { method: 'GET', path: '/api/v1/collections/:id', description: 'Detail collection lengkap dengan semua folder & request', auth: true },
      { method: 'PUT', path: '/api/v1/collections/:id', description: 'Update collection', auth: true },
      { method: 'DELETE', path: '/api/v1/collections/:id', description: 'Hapus collection', auth: true },
    ],
  },
  {
    name: 'Folders & Requests',
    color: 'text-orange-400',
    bg: 'border-orange-500/30',
    endpoints: [
      { method: 'GET', path: '/api/v1/collections/:id/folders', description: 'List folder di collection', auth: true },
      { method: 'POST', path: '/api/v1/collections/:id/folders', description: 'Buat folder baru', auth: true },
      { method: 'PUT', path: '/api/v1/folders/:id', description: 'Rename folder', auth: true },
      { method: 'PATCH', path: '/api/v1/folders/:id/move', description: 'Drag-and-drop folder ke posisi baru', auth: true },
      { method: 'DELETE', path: '/api/v1/folders/:id', description: 'Hapus folder beserta isinya', auth: true },
      { method: 'GET', path: '/api/v1/collections/:id/requests', description: 'List root-level request di collection', auth: true },
      { method: 'POST', path: '/api/v1/collections/:id/requests', description: 'Buat request di root collection', auth: true },
      { method: 'GET', path: '/api/v1/folders/:id/requests', description: 'List request di dalam folder', auth: true },
      { method: 'POST', path: '/api/v1/folders/:id/requests', description: 'Buat request di dalam folder', auth: true },
      { method: 'GET', path: '/api/v1/requests/:id', description: 'Detail request', auth: true },
      { method: 'PUT', path: '/api/v1/requests/:id', description: 'Update request (method, URL, headers, body, scripts)', auth: true },
      { method: 'PATCH', path: '/api/v1/requests/:id/move', description: 'Pindahkan request ke folder/collection lain', auth: true },
      { method: 'DELETE', path: '/api/v1/requests/:id', description: 'Hapus request', auth: true },
      { method: 'POST', path: '/api/v1/requests/:id/duplicate', description: 'Duplikat request', auth: true },
    ],
  },
  {
    name: 'Environments',
    color: 'text-cyan-400',
    bg: 'border-cyan-500/30',
    endpoints: [
      { method: 'GET', path: '/api/v1/teams/:id/environments', description: 'List environment di workspace (Workspace scope)', auth: true },
      { method: 'POST', path: '/api/v1/teams/:id/environments', description: 'Buat environment workspace baru', auth: true },
      { method: 'POST', path: '/api/v1/environments/global', description: 'Buat Global environment (berlaku semua workspace)', auth: true },
      { method: 'GET', path: '/api/v1/environments/:id', description: 'Detail environment dengan semua variabel', auth: true },
      { method: 'PUT', path: '/api/v1/environments/:id', description: 'Update variabel environment', auth: true },
      { method: 'DELETE', path: '/api/v1/environments/:id', description: 'Hapus environment', auth: true },
    ],
  },
  {
    name: 'Mock Server',
    color: 'text-pink-400',
    bg: 'border-pink-500/30',
    endpoints: [
      { method: 'POST', path: '/api/v1/mock/endpoints/:endpointId/transfer', description: 'Transfer mock endpoint ke collection lain' },
      { method: 'GET', path: '/api/v1/mock-endpoints/:endpointId/scenarios', description: 'List semua skenario mock' },
      { method: 'POST', path: '/api/v1/mock-endpoints/:endpointId/scenarios', description: 'Tambah skenario baru (kondisi + response)' },
      { method: 'PUT', path: '/api/v1/mock-endpoints/:endpointId/scenarios/:scenarioId', description: 'Update skenario mock' },
      { method: 'DELETE', path: '/api/v1/mock-endpoints/:endpointId/scenarios/:scenarioId', description: 'Hapus skenario' },
      { method: 'PATCH', path: '/api/v1/mock-endpoints/:endpointId/scenarios/reorder', description: 'Reorder prioritas skenario' },
      { method: 'PATCH', path: '/api/v1/mock-endpoints/:endpointId/mode', description: 'Toggle mode (auto/manual)' },
    ],
  },
  {
    name: 'Confluence Sync',
    color: 'text-indigo-400',
    bg: 'border-indigo-500/30',
    endpoints: [
      { method: 'POST', path: '/api/v1/collections/:id/sync-confluence', description: 'Sinkronkan seluruh collection ke halaman Confluence', auth: true, body: '{ "confluence_base_url": "...", "pat_token": "...", "space_key": "DEV" }' },
      { method: 'GET', path: '/api/v1/collections/:id/confluence-status', description: 'Cek status sync terakhir ke Confluence', auth: true },
    ],
  },
  {
    name: 'Admin Panel',
    color: 'text-red-400',
    bg: 'border-red-500/30',
    endpoints: [
      { method: 'GET', path: '/api/v1/admin/users', description: 'List semua user (Super Admin only)', auth: true },
      { method: 'POST', path: '/api/v1/admin/users', description: 'Buat akun user baru', auth: true, body: '{ "name": "Budi", "email": "budi@company.com", "role": "editor" }' },
      { method: 'PUT', path: '/api/v1/admin/users/:id', description: 'Update data atau suspend user', auth: true },
      { method: 'DELETE', path: '/api/v1/admin/users/:id', description: 'Hapus user dari sistem', auth: true },
      { method: 'POST', path: '/api/v1/admin/users/:id/reset-password', description: 'Reset password user', auth: true },
    ],
  },
  {
    name: 'Real-time (WebSocket)',
    color: 'text-yellow-400',
    bg: 'border-yellow-500/30',
    endpoints: [
      { method: 'GET', path: '/ws', description: 'WebSocket endpoint untuk kolaborasi real-time. Query params: team_id, token', auth: true, response: 'Events: collection_updated | request_created | member_joined | ...' },
      { method: 'GET', path: '/api/v1/notifications', description: 'List notifikasi in-app (dengan deep-link)', auth: true },
      { method: 'PATCH', path: '/api/v1/notifications/:id/read', description: 'Tandai notifikasi sebagai sudah dibaca', auth: true },
    ],
  },
];

function EndpointRow({ ep }: { ep: Endpoint }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-6 py-4 hover:bg-white/5 transition-colors text-left"
      >
        <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-black tracking-widest w-16 text-center flex-shrink-0 ${methodColors[ep.method]}`}>
          {ep.method}
        </span>
        <span className="font-mono text-sm text-slate-200 flex-1">{ep.path}</span>
        {ep.auth && (
          <span className="text-[9px] font-black text-yellow-400 border border-yellow-400/30 bg-yellow-400/10 px-2 py-0.5 rounded-full flex-shrink-0">
            AUTH
          </span>
        )}
        <ChevronDown size={16} className={`text-slate-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-4 space-y-3">
              <p className="text-slate-400 text-sm font-medium">{ep.description}</p>
              {ep.body && (
                <div>
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-1">Request Body</span>
                  <pre className="bg-black/40 rounded-xl p-4 text-xs text-emerald-300 font-mono overflow-x-auto">{ep.body}</pre>
                </div>
              )}
              {ep.response && (
                <div>
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-1">Response</span>
                  <pre className="bg-black/40 rounded-xl p-4 text-xs text-slate-300 font-mono overflow-x-auto">{ep.response}</pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ApiDocs() {
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  return (
    <section id="api-docs" className="py-32 px-6 max-w-7xl mx-auto">
      <div className="text-center mb-16">
        <span className="text-primary font-black uppercase tracking-[0.4em] text-[10px] mb-6 block">REST API Reference</span>
        <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase italic dark:text-white leading-none">
          API <span className="text-primary not-italic">Endpoints.</span>
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-6 max-w-xl mx-auto font-medium text-sm">
          Semua endpoint Wapbolt Backend — terproteksi JWT Auth kecuali disebutkan lain.
          Base URL: <code className="text-primary font-mono">https://api.wapbolt.io</code>
        </p>
      </div>

      {/* Group filter tabs */}
      <div className="flex flex-wrap gap-3 justify-center mb-10">
        <button
          onClick={() => setActiveGroup(null)}
          className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
            activeGroup === null
              ? 'bg-primary text-white border-primary'
              : 'border-white/10 text-slate-400 hover:border-primary/50'
          }`}
        >
          All
        </button>
        {groups.map((g) => (
          <button
            key={g.name}
            onClick={() => setActiveGroup(activeGroup === g.name ? null : g.name)}
            className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
              activeGroup === g.name
                ? 'bg-primary text-white border-primary'
                : 'border-white/10 text-slate-400 hover:border-primary/50'
            }`}
          >
            {g.name}
          </button>
        ))}
      </div>

      {/* Endpoint groups */}
      <div className="space-y-6">
        {groups
          .filter((g) => activeGroup === null || g.name === activeGroup)
          .map((group) => (
            <motion.div
              key={group.name}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`rounded-[2.5rem] border ${group.bg} bg-slate-900/60 overflow-hidden`}
            >
              <div className="flex items-center gap-4 px-6 py-5 border-b border-white/5">
                <h3 className={`font-black text-sm uppercase tracking-widest ${group.color}`}>{group.name}</h3>
                <span className="ml-auto text-[10px] text-slate-500 font-bold">{group.endpoints.length} endpoints</span>
              </div>
              <div>
                {group.endpoints.map((ep, i) => (
                  <EndpointRow key={i} ep={ep} />
                ))}
              </div>
            </motion.div>
          ))}
      </div>

      <div className="mt-10 p-6 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-center">
        <p className="text-sm text-blue-300 font-medium">
          <span className="font-black">Base URL:</span> <code className="font-mono text-blue-200">https://api.wapbolt.io</code>
          &nbsp;·&nbsp;
          <span className="font-black">Auth:</span> <code className="font-mono text-blue-200">Authorization: Bearer {'{token}'}</code>
          &nbsp;·&nbsp;
          <span className="font-black">Format:</span> <code className="font-mono text-blue-200">application/json</code>
        </p>
      </div>
    </section>
  );
}
