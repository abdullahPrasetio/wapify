import { motion } from 'framer-motion';

export default function ArchitectureDiagram() {
  return (
    <section id="architecture" className="py-32 px-6 bg-slate-900 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-transparent pointer-events-none" />
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <span className="text-blue-400 font-black uppercase tracking-[0.4em] text-[10px] mb-6 block">Infrastructure</span>
          <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase italic text-white leading-none">
            How It <span className="text-blue-400 not-italic">Works.</span>
          </h2>
          <p className="text-slate-400 mt-6 max-w-2xl mx-auto font-medium">
            Arsitektur self-hosted yang ringan — berjalan dari STB Android di rumah hingga enterprise server, tanpa vendor lock-in.
          </p>
        </div>

        {/* Main Architecture SVG */}
        <div className="flex justify-center mb-16">
          <svg
            viewBox="0 0 900 400"
            className="w-full max-w-4xl"
            style={{ fontFamily: 'inherit' }}
          >
            {/* Background grid lines */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff08" strokeWidth="1" />
              </pattern>
              <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1E3A5F" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#0F172A" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="arrowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2563EB" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.6" />
              </linearGradient>
              <marker id="arrowEnd" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#2563EB" />
              </marker>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            <rect width="900" height="400" fill="url(#grid)" rx="24" />

            {/* Node 1: Desktop Client */}
            <g transform="translate(30, 130)">
              <rect width="160" height="140" rx="20" fill="url(#cardGrad)" stroke="#2563EB" strokeWidth="1.5" />
              <rect width="160" height="6" rx="3" fill="#2563EB" opacity="0.7" />
              {/* Monitor icon */}
              <rect x="40" y="30" width="80" height="52" rx="6" fill="#1E3A8A" stroke="#3B82F6" strokeWidth="1.5" />
              <rect x="55" y="42" width="50" height="30" rx="3" fill="#0F172A" />
              <line x1="60" y1="56" x2="100" y2="56" stroke="#60A5FA" strokeWidth="1.5" />
              <line x1="60" y1="63" x2="88" y2="63" stroke="#60A5FA" strokeWidth="1" opacity="0.6" />
              <rect x="72" y="82" width="16" height="6" rx="2" fill="#3B82F6" />
              <text x="80" y="108" textAnchor="middle" fill="#F1F5F9" fontSize="11" fontWeight="900" letterSpacing="0.5">DESKTOP</text>
              <text x="80" y="122" textAnchor="middle" fill="#94A3B8" fontSize="9" fontWeight="700">Electron + React</text>
            </g>

            {/* Arrow 1 → 2 */}
            <g>
              <line x1="192" y1="200" x2="248" y2="200" stroke="url(#arrowGrad)" strokeWidth="2" markerEnd="url(#arrowEnd)" strokeDasharray="6 3">
                <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="1.5s" repeatCount="indefinite" />
              </line>
              <text x="220" y="192" textAnchor="middle" fill="#60A5FA" fontSize="8" fontWeight="700">HTTPS</text>
            </g>

            {/* Node 2: Cloudflare */}
            <g transform="translate(250, 130)">
              <rect width="160" height="140" rx="20" fill="url(#cardGrad)" stroke="#F97316" strokeWidth="1.5" />
              <rect width="160" height="6" rx="3" fill="#F97316" opacity="0.7" />
              {/* Cloud shape */}
              <ellipse cx="80" cy="58" rx="36" ry="22" fill="#431407" stroke="#F97316" strokeWidth="1.5" />
              <ellipse cx="57" cy="65" rx="22" ry="16" fill="#431407" stroke="#F97316" strokeWidth="1.5" />
              <ellipse cx="105" cy="65" rx="22" ry="16" fill="#431407" stroke="#F97316" strokeWidth="1.5" />
              <ellipse cx="80" cy="72" rx="48" ry="14" fill="#431407" stroke="#F97316" strokeWidth="1" />
              <text x="80" y="68" textAnchor="middle" fill="#FED7AA" fontSize="9" fontWeight="900">CF</text>
              <text x="80" y="108" textAnchor="middle" fill="#F1F5F9" fontSize="11" fontWeight="900" letterSpacing="0.5">CLOUDFLARE</text>
              <text x="80" y="122" textAnchor="middle" fill="#94A3B8" fontSize="9" fontWeight="700">Tunnel + DDoS Guard</text>
            </g>

            {/* Arrow 2 → 3 */}
            <g>
              <line x1="412" y1="200" x2="468" y2="200" stroke="url(#arrowGrad)" strokeWidth="2" markerEnd="url(#arrowEnd)" strokeDasharray="6 3">
                <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="1.5s" repeatCount="indefinite" />
              </line>
              <text x="440" y="192" textAnchor="middle" fill="#60A5FA" fontSize="8" fontWeight="700">TUNNEL</text>
            </g>

            {/* Node 3: Go Backend */}
            <g transform="translate(470, 130)">
              <rect width="160" height="140" rx="20" fill="url(#cardGrad)" stroke="#10B981" strokeWidth="1.5" />
              <rect width="160" height="6" rx="3" fill="#10B981" opacity="0.7" />
              {/* Server rack icon */}
              <rect x="30" y="26" width="100" height="18" rx="5" fill="#064E3B" stroke="#10B981" strokeWidth="1.5" />
              <circle cx="118" cy="35" r="4" fill="#10B981" filter="url(#glow)" />
              <rect x="30" y="50" width="100" height="18" rx="5" fill="#064E3B" stroke="#10B981" strokeWidth="1.5" />
              <circle cx="118" cy="59" r="4" fill="#10B981" filter="url(#glow)" />
              <rect x="30" y="74" width="100" height="18" rx="5" fill="#064E3B" stroke="#10B981" strokeWidth="1.5" />
              <circle cx="118" cy="83" r="4" fill="#10B981" filter="url(#glow)" />
              <text x="80" y="108" textAnchor="middle" fill="#F1F5F9" fontSize="11" fontWeight="900" letterSpacing="0.5">GO BACKEND</text>
              <text x="80" y="122" textAnchor="middle" fill="#94A3B8" fontSize="9" fontWeight="700">Fiber + WebSocket</text>
            </g>

            {/* Arrow 3 → 4 */}
            <g>
              <line x1="632" y1="200" x2="688" y2="200" stroke="url(#arrowGrad)" strokeWidth="2" markerEnd="url(#arrowEnd)" strokeDasharray="6 3">
                <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="1.5s" repeatCount="indefinite" />
              </line>
              <text x="660" y="192" textAnchor="middle" fill="#60A5FA" fontSize="8" fontWeight="700">SQL</text>
            </g>

            {/* Node 4: PostgreSQL */}
            <g transform="translate(690, 130)">
              <rect width="160" height="140" rx="20" fill="url(#cardGrad)" stroke="#8B5CF6" strokeWidth="1.5" />
              <rect width="160" height="6" rx="3" fill="#8B5CF6" opacity="0.7" />
              {/* Database cylinder */}
              <ellipse cx="80" cy="38" rx="40" ry="12" fill="#2E1065" stroke="#8B5CF6" strokeWidth="1.5" />
              <rect x="40" y="38" width="80" height="38" fill="#1E0D4E" />
              <ellipse cx="80" cy="76" rx="40" ry="12" fill="#2E1065" stroke="#8B5CF6" strokeWidth="1.5" />
              <line x1="40" y1="48" x2="40" y2="76" stroke="#8B5CF6" strokeWidth="1.5" />
              <line x1="120" y1="48" x2="120" y2="76" stroke="#8B5CF6" strokeWidth="1.5" />
              <text x="80" y="108" textAnchor="middle" fill="#F1F5F9" fontSize="11" fontWeight="900" letterSpacing="0.5">POSTGRESQL</text>
              <text x="80" y="122" textAnchor="middle" fill="#94A3B8" fontSize="9" fontWeight="700">Persistent Storage</text>
            </g>

            {/* WebSocket label below Go Backend */}
            <g transform="translate(470, 310)">
              <rect width="160" height="36" rx="12" fill="#064E3B" stroke="#10B981" strokeWidth="1" strokeDasharray="4 2" />
              <text x="80" y="17" textAnchor="middle" fill="#34D399" fontSize="8" fontWeight="900" letterSpacing="1">⚡ WebSocket SSE</text>
              <text x="80" y="29" textAnchor="middle" fill="#6EE7B7" fontSize="7" fontWeight="700">Real-time Team Sync</text>
            </g>
            <line x1="550" y1="270" x2="550" y2="310" stroke="#10B981" strokeWidth="1.5" strokeDasharray="4 2" />

            {/* License badge below Desktop */}
            <g transform="translate(30, 310)">
              <rect width="160" height="36" rx="12" fill="#1E1B4B" stroke="#6366F1" strokeWidth="1" strokeDasharray="4 2" />
              <text x="80" y="17" textAnchor="middle" fill="#A5B4FC" fontSize="8" fontWeight="900" letterSpacing="1">🔐 Ed25519 License</text>
              <text x="80" y="29" textAnchor="middle" fill="#818CF8" fontSize="7" fontWeight="700">Offline-first Validation</text>
            </g>
            <line x1="110" y1="270" x2="110" y2="310" stroke="#6366F1" strokeWidth="1.5" strokeDasharray="4 2" />

            {/* STB label below Cloudflare */}
            <g transform="translate(250, 310)">
              <rect width="160" height="36" rx="12" fill="#1C1917" stroke="#F59E0B" strokeWidth="1" strokeDasharray="4 2" />
              <text x="80" y="17" textAnchor="middle" fill="#FCD34D" fontSize="8" fontWeight="900" letterSpacing="1">📦 STB Android</text>
              <text x="80" y="29" textAnchor="middle" fill="#FDE68A" fontSize="7" fontWeight="700">or On-premise Server</text>
            </g>
            <line x1="330" y1="270" x2="330" y2="310" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="4 2" />
          </svg>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {[
            { value: '<5ms', label: 'API Latency', color: 'text-emerald-400' },
            { value: '~30MB', label: 'RAM Usage', color: 'text-blue-400' },
            { value: '100%', label: 'Offline Ready', color: 'text-purple-400' },
            { value: 'Ed25519', label: 'License Crypto', color: 'text-orange-400' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="text-center p-6 rounded-3xl bg-white/5 border border-white/10"
            >
              <div className={`text-3xl font-black ${stat.color} mb-2`}>{stat.value}</div>
              <div className="text-slate-400 text-xs font-bold uppercase tracking-widest">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
