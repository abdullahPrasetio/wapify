import { motion } from 'framer-motion';
import { Download, Key, Server, Users, Zap, CheckCircle2 } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Download,
    title: 'Install Desktop App',
    color: 'from-blue-600 to-blue-400',
    borderColor: 'border-blue-500/30',
    description: 'Download installer Wapbolt untuk platform Anda (Windows, macOS, atau Linux) dari halaman GitHub Releases.',
    details: [
      'Windows: jalankan .exe installer',
      'macOS: buka .dmg dan drag ke Applications',
      'Linux: chmod +x lalu jalankan .AppImage',
    ],
    code: '# Atau via CLI (coming soon)\nnpx wapbolt-installer',
  },
  {
    number: '02',
    icon: Server,
    title: 'Setup Backend',
    color: 'from-emerald-600 to-emerald-400',
    borderColor: 'border-emerald-500/30',
    description: 'Deploy Go backend ke server atau STB Android Anda. Single binary, tanpa dependency eksternal selain PostgreSQL.',
    details: [
      'Copy binary ke server (STB/VPS/Docker)',
      'Buat file .env dari .env.example',
      'Jalankan: ./wapbolt-server',
    ],
    code: '# Docker (recommended)\ndocker compose up -d\n\n# Atau binary langsung\n./wapbolt-server --port=8080',
  },
  {
    number: '03',
    icon: Key,
    title: 'Aktivasi Lisensi',
    color: 'from-purple-600 to-purple-400',
    borderColor: 'border-purple-500/30',
    description: 'Masukkan license key Ed25519 yang Anda terima. Validasi terjadi sepenuhnya offline — tidak ada koneksi ke server lisensi.',
    details: [
      'Buka Wapbolt → Settings → License',
      'Paste license key Anda',
      'Klik Activate — selesai!',
    ],
    code: '# Format license key\nWAPBOLT-XXXX-XXXX-XXXX-XXXX\n\n# Validasi offline dengan Ed25519',
  },
  {
    number: '04',
    icon: Users,
    title: 'Buat Workspace & Invite Tim',
    color: 'from-orange-600 to-orange-400',
    borderColor: 'border-orange-500/30',
    description: 'Super Admin membuat workspace dan mengundang anggota tim dengan role yang sesuai. Tidak ada self-register.',
    details: [
      'Admin buat akun anggota di Admin Panel',
      'Set role: Owner / Admin / Editor / Viewer',
      'Share backend URL ke tim',
    ],
    code: '# Admin Panel endpoint\nGET  /api/v1/admin/users\nPOST /api/v1/admin/users\nPUT  /api/v1/admin/users/:id',
  },
  {
    number: '05',
    icon: Zap,
    title: 'Mulai Testing API',
    color: 'from-primary to-accent',
    borderColor: 'border-primary/30',
    description: 'Buat collection, tambah request, dan mulai uji endpoint API Anda. Perubahan otomatis tersinkronisasi ke seluruh tim via WebSocket.',
    details: [
      'Buat collection baru di workspace',
      'Tambah request (GET/POST/PUT/DELETE)',
      'Set environment variables',
      'Jalankan request dan lihat response',
    ],
    code: '# Real-time sync via WebSocket\nws://api.wapbolt.io/ws\n\n# Channel per workspace\n/ws?team_id={workspace_id}',
  },
];

export default function HowToUse() {
  return (
    <section id="how-to-use" className="py-32 px-6 max-w-7xl mx-auto">
      <div className="text-center mb-20">
        <span className="text-primary font-black uppercase tracking-[0.4em] text-[10px] mb-6 block">Step by Step</span>
        <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase italic dark:text-white leading-none">
          Get Started <span className="text-primary not-italic">Fast.</span>
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-6 max-w-xl mx-auto font-medium text-sm">
          Dari zero ke production-ready API testing platform dalam 5 langkah sederhana.
        </p>
      </div>

      {/* Flow diagram */}
      <div className="flex items-center justify-center gap-2 mb-16 flex-wrap">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`px-4 py-2 rounded-full bg-gradient-to-r ${step.color} text-white text-[10px] font-black uppercase tracking-widest shadow-lg`}>
              {step.number} {step.title}
            </div>
            {i < steps.length - 1 && (
              <svg width="20" height="20" viewBox="0 0 20 20" className="text-primary flex-shrink-0">
                <path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            )}
          </div>
        ))}
      </div>

      {/* Step cards */}
      <div className="space-y-8">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className={`grid md:grid-cols-2 gap-8 p-8 md:p-12 rounded-[3rem] border ${step.borderColor} bg-white dark:bg-slate-800/30 shadow-xl`}
            >
              <div className={`flex flex-col justify-center ${i % 2 === 1 ? 'md:order-2' : ''}`}>
                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} text-white flex items-center justify-center shadow-lg`}>
                    <Icon size={24} />
                  </div>
                  <span className="text-5xl font-black text-slate-100 dark:text-white/10">{step.number}</span>
                </div>
                <h3 className="text-2xl font-black uppercase italic dark:text-white mb-4">{step.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium mb-6 leading-relaxed">{step.description}</p>
                <ul className="space-y-2">
                  {step.details.map((detail, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm font-bold text-slate-600 dark:text-slate-300">
                      <CheckCircle2 size={16} className="text-primary mt-0.5 flex-shrink-0" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>

              <div className={`${i % 2 === 1 ? 'md:order-1' : ''}`}>
                <div className="bg-slate-900 rounded-2xl p-6 border border-white/10 h-full flex flex-col">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="ml-2 text-slate-500 text-[10px] font-mono">terminal</span>
                  </div>
                  <pre className="text-emerald-400 text-xs font-mono leading-relaxed flex-1 whitespace-pre-wrap">
                    {step.code}
                  </pre>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
