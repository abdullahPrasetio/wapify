import React, { useState, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ArchitectureDiagram from './components/ArchitectureDiagram';
import ComparisonTable from './components/ComparisonTable';
import HowToUse from './components/HowToUse';
import ApiDocs from './components/ApiDocs';
import {
  Zap,
  Shield,
  Users,
  Globe,
  Cpu,
  CheckCircle2,
  ArrowRight,
  Terminal,
  Activity,
  Layers,
  Sun,
  Moon,
  Menu,
  X,
  Code2,
  Server,
  Rocket,
  Mail,
  Download,
  Monitor,
  Database,
  Lock,
  Workflow,
  Sparkles,
  Box,
  Layout,
  Send,
  User,
  MessageSquare,
  FileUp,
  Search,
  Bell
} from 'lucide-react';

const GithubIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.2-.3 2.4 0 3.5-.73 1.02-1.08 2.25-1 3.5 0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const Navbar = ({ theme, toggleTheme }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <nav className="fixed top-0 w-full z-[100] bg-white/90 dark:bg-[#0F172A]/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/10">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center text-white shadow-xl shadow-primary/30 group-hover:rotate-12 transition-transform">
            <Zap size={22} fill="currentColor" />
          </div>
          <span className="font-black text-2xl tracking-tighter text-slate-900 dark:text-white uppercase italic">Wapbolt</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em]">
          <a href="#about" className="hover:text-primary dark:hover:text-white transition-colors">Why Wapbolt</a>
          <a href="#how-to-use" className="hover:text-primary dark:hover:text-white transition-colors">Get Started</a>
          <a href="#architecture" className="hover:text-primary dark:hover:text-white transition-colors">Architecture</a>
          <a href="#api-docs" className="hover:text-primary dark:hover:text-white transition-colors">API Docs</a>
          <a href="#comparison" className="hover:text-primary dark:hover:text-white transition-colors">Vs Postman</a>
          <a href="#download" className="hover:text-primary dark:hover:text-white transition-colors">Download</a>
        </div>
        <div className="hidden md:flex items-center gap-4">
          <button onClick={toggleTheme} className="p-2.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <a href="https://github.com/abdullahPrasetio" target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-full bg-slate-900 dark:bg-white/10 text-white shadow-xl hover:scale-110 transition-all">
            <GithubIcon size={20} />
          </a>
        </div>
        <div className="md:hidden flex items-center gap-4">
          <button onClick={toggleTheme} className="p-2 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={() => setIsOpen(!isOpen)} className="text-slate-900 dark:text-white"><Menu size={32} /></button>
        </div>
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="md:hidden absolute top-full left-0 w-full bg-white dark:bg-[#0F172A] border-b border-slate-200 dark:border-white/10 p-8 flex flex-col gap-6 font-black uppercase tracking-widest text-xs shadow-2xl dark:text-white">
            <a href="#about" onClick={() => setIsOpen(false)}>Why Wapbolt</a>
            <a href="#how-to-use" onClick={() => setIsOpen(false)}>Get Started</a>
            <a href="#architecture" onClick={() => setIsOpen(false)}>Architecture</a>
            <a href="#api-docs" onClick={() => setIsOpen(false)}>API Docs</a>
            <a href="#comparison" onClick={() => setIsOpen(false)}>Vs Postman</a>
            <a href="#download" onClick={() => setIsOpen(false)}>Download</a>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default function App() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [formData, setFormData] = useState({ name: '', email: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const LICENSE_API = import.meta.env.VITE_LICENSE_API || 'http://localhost:9100';

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Gunakan useLayoutEffect agar perubahan class terjadi sebelum render visual (mencegah flicker)
  useLayoutEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${LICENSE_API}/api/license-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          message: formData.description.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const until = data.valid_until ? ` Aktif hingga: ${new Date(data.valid_until).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.` : '';
        showToast(`License terkirim ke email Anda!${until}`, 'success');
        setFormData({ name: '', email: '', description: '' });
      } else {
        showToast(data.error || 'Gagal mengirim request. Coba lagi.', 'error');
      }
    } catch {
      showToast('Tidak dapat terhubung ke server. Coba lagi nanti.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 transition-colors duration-500 font-sans antialiased">
      <Navbar theme={theme} toggleTheme={toggleTheme} />

      {/* NEW FEATURES HIGHLIGHT */}
      <section className="py-24 px-6 max-w-7xl mx-auto relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[100px] -z-10" />
        <div className="text-center mb-20">
          <span className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase tracking-[0.4em] mb-6 inline-block shadow-sm">
            Release v1.6.1 is Here
          </span>
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic dark:text-white">What's <span className="text-primary not-italic">New?</span></h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="p-1 rounded-[3rem] bg-gradient-to-br from-primary/20 to-transparent border border-white/10 overflow-hidden group">
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.8rem] p-10 h-full">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20"><Globe size={28} /></div>
                <h3 className="text-2xl font-black italic uppercase text-white">Shared Environments</h3>
              </div>
              <p className="text-slate-400 font-bold mb-8 leading-relaxed">Kelola variabel environment secara terpusat. Gunakan <span className="text-white">Global Scope</span> untuk variabel yang dipakai semua orang, atau <span className="text-white">Workspace Scope</span> untuk variabel spesifik proyek Anda.</p>
              <img src="/captures/v3_env.png" alt="Shared Environments UI" className="rounded-2xl border border-white/5 shadow-2xl group-hover:scale-[1.02] transition-transform duration-500" />
            </div>
          </div>
          <div className="p-1 rounded-[3rem] bg-gradient-to-br from-blue-500/20 to-transparent border border-white/10 overflow-hidden group">
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.8rem] p-10 h-full">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20"><Box size={28} /></div>
                <h3 className="text-2xl font-black italic uppercase text-white">Confluence Sync</h3>
              </div>
              <p className="text-slate-400 font-bold mb-8 leading-relaxed">Otomatisasi dokumentasi API Anda. Sinkronkan seluruh koleksi request ke halaman <span className="text-white">Confluence</span> tim Anda hanya dengan satu klik menggunakan PAT atau API Token.</p>
              <img src="/captures/v3_sync.png" alt="Confluence Sync UI" className="rounded-2xl border border-white/5 shadow-2xl group-hover:scale-[1.02] transition-transform duration-500" />
            </div>
          </div>
        </div>
      </section>

      {/* WHY WAPBOLT */}
      <section id="about" className="py-24 px-6 max-w-7xl mx-auto grid md:grid-cols-3 gap-10">
        <div className="p-12 rounded-[3.5rem] bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 flex flex-col items-center text-center group hover:border-primary/50 transition-all shadow-sm">
          <div className="w-20 h-20 rounded-3xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-10 group-hover:scale-110 transition-transform shadow-inner"><Zap size={40} /></div>
          <h3 className="text-2xl font-black mb-5 dark:text-white uppercase italic tracking-tight">Extreme Speed</h3>
          <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed text-sm">Ultra-low latency powered by Go Fiber engine. Minimal RAM footprint for any hardware.</p>
        </div>
        <div className="p-12 rounded-[3.5rem] bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 flex flex-col items-center text-center group hover:border-primary/50 transition-all shadow-sm">
          <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-10 group-hover:scale-110 transition-transform shadow-inner"><Shield size={40} /></div>
          <h3 className="text-2xl font-black mb-5 dark:text-white uppercase italic tracking-tight">Self-Hosted</h3>
          <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed text-sm">You own the data. Deploy on your STB Android or Private Server with 100% privacy.</p>
        </div>
        <div className="p-12 rounded-[3.5rem] bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 flex flex-col items-center text-center group hover:border-primary/50 transition-all shadow-sm">
          <div className="w-20 h-20 rounded-3xl bg-purple-500/10 flex items-center justify-center text-purple-500 mb-10 group-hover:scale-110 transition-transform shadow-inner"><Users size={40} /></div>
          <h3 className="text-2xl font-black mb-5 dark:text-white uppercase italic tracking-tight">Team Sync</h3>
          <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed text-sm">Real-time WebSocket synchronization. No more manual collection export/import.</p>
        </div>
      </section>

      {/* FEATURE CAPTURE GALLERY */}
      <section className="py-24 px-6 bg-slate-50 dark:bg-black/20">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-end justify-between mb-16 gap-6">
            <div className="max-w-2xl">
              <span className="text-primary font-black uppercase tracking-[0.4em] text-[10px] mb-4 block">Visual Interface</span>
              <h2 className="text-5xl font-black tracking-tighter uppercase italic dark:text-white">Professional <span className="text-primary not-italic">Workflow.</span></h2>
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-bold italic max-w-xs text-sm">"Antarmuka yang didesain untuk produktivitas maksimal tanpa mengorbankan estetika."</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="group relative overflow-hidden rounded-[3rem] border border-white/5 shadow-2xl bg-slate-900">
              <img src="/captures/v3_dashboard.png" alt="Wapbolt Dashboard" className="w-full h-auto object-contain group-hover:scale-[1.01] transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-12 flex flex-col justify-end">
                <h4 className="text-white text-3xl font-black italic uppercase mb-2">Omni Dashboard</h4>
                <p className="text-slate-300 font-medium">Capture dashboard utama yang bersih dan intuitif.</p>
              </div>
            </div>
            <div className="group relative overflow-hidden rounded-[3rem] border border-white/5 shadow-2xl bg-slate-900">
              <img src="/captures/activity_v2.png" alt="Wapbolt Activity" className="w-full h-auto object-contain group-hover:scale-[1.01] transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-12 flex flex-col justify-end">
                <h4 className="text-white text-3xl font-black italic uppercase mb-2">Team Activity</h4>
                <p className="text-slate-300 font-medium">Log aktivitas tim yang transparan dan informatif.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ALL FEATURES GRID */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-24">
          <span className="text-primary font-black uppercase tracking-[0.4em] text-[10px] mb-6 block">The Complete Toolkit</span>
          <h2 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter uppercase italic dark:text-white leading-none">Every Feature <br /> <span className="text-primary not-italic">You Need.</span></h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { icon: Zap, title: "Extreme Speed", desc: "Powered by Go Fiber for sub-millisecond API response handling." },
            { icon: Globe, title: "Shared Env", desc: "Manage variables across global and workspace scopes seamlessly." },
            { icon: Box, title: "Confluence", desc: "Auto-sync your API documentation directly to Confluence spaces." },
            { icon: Activity, title: "Activity Log", desc: "Real-time audit logs for every collection and request update." },
            { icon: Search, title: "Omnibar", desc: "Spotlight-style search across all workspaces with Cmd+K." },
            { icon: Bell, title: "Notifications", desc: "In-app alerts for team activities with smart deep-linking." },
            { icon: Lock, title: "Secure Vault", desc: "OS-level credential storage using system Keychain integration." },
            { icon: Database, title: "Local First", desc: "Your data stays on your machine. Privacy is our core mission." },
            { icon: Server, title: "STB Ready", desc: "Ultra-lightweight engine, perfect for Android STB or low-end PCs." },
            { icon: Sparkles, title: "Mock Server", desc: "Simulate complex API behaviors with dynamic logic matching." },
            { icon: FileUp, title: "Binary Support", desc: "Test and mock binary data like PDFs, Images, and more." },
            { icon: Workflow, title: "Drag & Drop", desc: "Intuitive organization for folders and requests with precise D&D." },
            { icon: Sun, title: "Auto Theme", desc: "Switch between Light and Dark mode with adaptive system sync." },
            { icon: Layout, title: "Multi-Tab", desc: "Work on multiple requests simultaneously with a browser-like feel." },
            { icon: Shield, title: "Crypto Auth", desc: "Ed25519 based license validation for secure offline usage." },
            { icon: Code2, title: "JSON Logic", desc: "Advanced validation and scripting support for complex tests." }
          ].map((feat, i) => (
            <div key={i} className="p-8 rounded-[2.5rem] bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 hover:border-primary/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><feat.icon size={24} /></div>
              <h4 className="font-black text-xs uppercase tracking-widest mb-3 dark:text-white">{feat.title}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW TO USE */}
      <HowToUse />

      {/* ARCHITECTURE DIAGRAM */}
      <ArchitectureDiagram />

      {/* API DOCS */}
      <ApiDocs />

      {/* COMPARISON TABLE */}
      <ComparisonTable />

      {/* DOWNLOAD */}
      <section id="download" className="py-24 px-6 bg-slate-50 dark:bg-white/[0.02] border-y border-slate-200 dark:border-white/5">
        <div className="max-w-4xl mx-auto text-center mb-16 text-slate-900 dark:text-white">
          <h2 className="text-5xl md:text-7xl font-black mb-12 tracking-tighter uppercase italic">Ready to Switch?</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { platform: 'Windows', icon: Monitor, file: 'Wapbolt_Win.exe', color: 'primary' },
              { platform: 'macOS', icon: Box, file: 'Wapbolt_Mac.dmg', color: 'slate-400' },
              { platform: 'Linux', icon: Layout, file: 'Wapbolt.AppImage', color: 'orange-500' }
            ].map((item, i) => (
              <div key={i} className="p-8 rounded-[2.5rem] bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 hover:border-primary/50 transition-all group shadow-xl">
                <item.icon className={`mx-auto mb-6 text-${item.color} group-hover:scale-110 transition-transform`} size={48} />
                <h4 className="font-black dark:text-white mb-6 uppercase text-xs tracking-widest">{item.platform}</h4>
                <a
                  href="https://github.com/abdullahPrasetio/wapbolt-desktop-releases/releases/latest"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-4 bg-slate-900 dark:bg-primary text-white rounded-2xl font-black text-[10px] shadow-lg uppercase tracking-widest text-center"
                >
                  Download
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* JOIN BETA / EMAIL FORM */}
      <section id="license" className="py-32 px-6 max-w-6xl mx-auto">
        <div className="bg-[#0F172A] dark:bg-slate-800/60 rounded-[4rem] p-10 md:p-20 text-center border border-slate-200 dark:border-white/10 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
          <div className="grid lg:grid-cols-2 gap-20 items-center relative z-10 text-left">
            <div>
              <span className="text-primary font-black uppercase tracking-[0.4em] text-[10px] mb-6 block">Developer Access</span>
              <h2 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter text-white uppercase italic leading-none">Join the Beta.</h2>
              <p className="text-lg font-medium mb-10 text-slate-400 leading-relaxed italic border-l-4 border-primary pl-6">
                "Dapatkan lisensi gratis 1 tahun. Kami akan mengirimkan key eksklusif serta <span className="text-primary font-bold">Panduan Instalasi Backend Lengkap</span> dan bantuan teknis setup di STB/Server Anda."
              </p>
              <div className="space-y-4">
                {["Free 1-Year License", "Backend Setup PDF Guide", "Direct WhatsApp/Email Support"].map((li, i) => (
                  <div key={i} className="flex items-center gap-4 text-white font-bold text-sm"><CheckCircle2 className="text-primary" size={20} /> {li}</div>
                ))}
              </div>
            </div>

            <form onSubmit={handleSendEmail} className="bg-slate-900/50 p-10 rounded-[3rem] border border-white/5 backdrop-blur-xl">
              <div className="space-y-6">
                <div className="relative">
                  <User className="absolute left-5 top-5 text-slate-500" size={20} />
                  <input type="text" placeholder="Full Name" required className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white focus:border-primary transition-all font-bold text-sm" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="relative">
                  <Mail className="absolute left-5 top-5 text-slate-500" size={20} />
                  <input type="email" placeholder="Email Address" required className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white focus:border-primary transition-all font-bold text-sm" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="relative">
                  <MessageSquare className="absolute left-5 top-5 text-slate-500" size={20} />
                  <textarea placeholder="Tell us about your setup (e.g. PC or STB)" required rows={4} className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white focus:border-primary transition-all font-bold text-sm resize-none" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}></textarea>
                </div>
                <button type="submit" disabled={submitting} className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white py-6 rounded-2xl font-black text-xl flex items-center justify-center gap-4 shadow-2xl transition-all active:scale-95 group uppercase tracking-widest">
                  {submitting ? 'Mengirim...' : <>Register Beta <Send size={24} className="group-hover:translate-x-2 transition-transform" /></>}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-20 border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#080E1E] transition-colors">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-12 text-slate-900 dark:text-white">
          <div className="flex items-center gap-4 text-slate-900 dark:text-white">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-2xl shadow-xl">W</div>
            <div>
              <span className="font-black text-3xl tracking-tighter uppercase italic block">Wapbolt</span>
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.5em]">Built for Speed by abdullahPrasetio</span>
            </div>
          </div>
          <div className="flex gap-12 font-black uppercase text-[10px] tracking-widest text-slate-400">
            <a href="https://github.com/abdullahPrasetio" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-center gap-2 underline underline-offset-8 decoration-primary decoration-2">GitHub Profile</a>
            <a href="mailto:temancode@gmail.com" className="hover:text-primary transition-colors">Support</a>
          </div>
          <a href="https://github.com/abdullahPrasetio" target="_blank" rel="noopener noreferrer" className="p-5 rounded-[1.5rem] bg-white dark:bg-white/5 shadow-xl hover:scale-110 transition-all border border-slate-200 dark:border-white/10">
            <GithubIcon size={24} />
          </a>
        </div>
      </footer>

      {/* TOAST */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 60, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 60, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`fixed bottom-8 left-1/2 z-999 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-xl border font-bold text-sm ${
              toast.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                : 'bg-red-500/10 border-red-500/40 text-red-300'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <X size={20} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

