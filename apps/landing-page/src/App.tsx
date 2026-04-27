import React, { useState, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  FileUp
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
          <a href="#workflow" className="hover:text-primary dark:hover:text-white transition-colors">Architecture</a>
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
            <a href="#workflow" onClick={() => setIsOpen(false)}>Architecture</a>
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

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Wapbolt Beta Inquiry from ${formData.name}`);
    const body = encodeURIComponent(
      `Name: ${formData.name}\n` +
      `Email: ${formData.email}\n\n` +
      `Message/Description:\n${formData.description}`
    );
    const gmailUrl = `https://mail.google.com/mail/u/0/?fs=1&to=temancode@gmail.com&su=${subject}&body=${body}&tf=cm`;
    window.open(gmailUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 transition-colors duration-500 font-sans antialiased">
      <Navbar theme={theme} toggleTheme={toggleTheme} />
      
      {/* HERO */}
      <section className="pt-48 pb-24 px-6 max-w-7xl mx-auto text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
           <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <span className="px-5 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.3em] mb-12 inline-block shadow-sm">
            <Sparkles size={12} className="inline mr-2" /> Next-Generation API Platform
          </span>
          <h1 className="text-6xl md:text-9xl font-black mb-10 leading-none tracking-tighter dark:text-white uppercase italic">
            Wapbolt <span className="text-primary not-italic">Engine</span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-500 dark:text-slate-400 mb-14 max-w-3xl mx-auto font-medium leading-relaxed">
            The lightweight, self-hosted alternative to Postman. <br className="hidden md:block"/>Built for speed, privacy, and real-time team collaboration.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <a href="#download" className="w-full sm:w-auto px-12 py-5 bg-primary text-white rounded-2xl font-black shadow-2xl shadow-primary/30 text-lg hover:scale-105 transition-all">Download Client</a>
            <a href="#license" className="w-full sm:w-auto px-12 py-5 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white rounded-2xl font-black border border-slate-200 dark:border-white/10 text-lg hover:scale-105 transition-all uppercase tracking-widest">Join Beta</a>
          </div>
        </motion.div>
      </section>

      {/* WHY WAPBOLT */}
      <section id="about" className="py-24 px-6 max-w-7xl mx-auto grid md:grid-cols-3 gap-10">
        <div className="p-12 rounded-[3.5rem] bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 flex flex-col items-center text-center group hover:border-primary/50 transition-all shadow-sm">
          <div className="w-20 h-20 rounded-3xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-10 group-hover:scale-110 transition-transform shadow-inner"><Zap size={40} /></div>
          <h3 className="text-2xl font-black mb-5 dark:text-white uppercase italic tracking-tight">Extreme Speed</h3>
          <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed text-sm">Ultra-low latency powered by Go Fiber. Minimal RAM footprint for any hardware.</p>
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

      {/* PRO FEATURES SHOWCASE */}
      <section className="py-32 px-6 max-w-7xl mx-auto overflow-hidden">
        <div className="flex flex-col lg:flex-row items-center gap-20">
          <div className="flex-1 space-y-12">
            <div>
              <span className="text-primary font-black uppercase tracking-[0.4em] text-[10px] mb-6 block">Professional Capabilities</span>
              <h2 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter uppercase italic leading-none text-slate-900 dark:text-white">API Mocking <br/> <span className="text-primary not-italic">Refined.</span></h2>
              <p className="text-lg text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Take your development workflow to the next level with our pro-grade mock server. 
                Don't just mock responses—simulate entire API behaviors.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-8">
               {[
                 { icon: Sparkles, title: "Dynamic Logic", desc: "Automated response matching based on Body, Headers, or Query params." },
                 { icon: FileUp, title: "Binary Power", desc: "Return real PDF, Images, or any binary files from your mock endpoints." },
                 { icon: Terminal, title: "Smart cURL", desc: "One-click copy that auto-injects all data required to trigger specific scenarios." },
                 { icon: Workflow, title: "Precise D&D", desc: "Intuitive horizontal-split drag & drop for organizing folders and priority." }
               ].map((feat, i) => (
                 <div key={i} className="flex gap-5">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><feat.icon size={24}/></div>
                    <div>
                       <h4 className="font-black text-xs uppercase tracking-widest mb-2 dark:text-white">{feat.title}</h4>
                       <p className="text-xs text-slate-500 dark:text-slate-400 font-bold leading-relaxed">{feat.desc}</p>
                    </div>
                 </div>
               ))}
            </div>
          </div>
          
          <div className="flex-1 relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-[3rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[3rem] p-4 shadow-2xl">
               <div className="bg-slate-100 dark:bg-black/50 rounded-[2.5rem] p-8 aspect-video flex items-center justify-center overflow-hidden">
                  {/* Mockup visualization - representing the Scenario Editor */}
                  <div className="w-full space-y-4">
                     <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5 animate-pulse">
                        <div className="w-8 h-8 rounded bg-primary/20"></div>
                        <div className="h-2 w-1/2 bg-white/10 rounded"></div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="h-24 rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 flex items-center justify-center">
                           <FileUp className="text-primary/40" size={24}/>
                        </div>
                        <div className="h-24 rounded-2xl bg-black/40 p-4 space-y-3">
                           <div className="h-1.5 w-full bg-white/5 rounded"></div>
                           <div className="h-1.5 w-2/3 bg-white/5 rounded"></div>
                           <div className="h-1.5 w-3/4 bg-white/5 rounded"></div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="workflow" className="py-32 px-6 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-24">
            <span className="text-primary font-black uppercase tracking-[0.4em] text-[10px] mb-6 block animate-pulse">Architecture Overview</span>
            <h2 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter uppercase italic text-white leading-none">System Flow</h2>
          </div>
          
          <div className="grid md:grid-cols-4 gap-6">
             {[
               { icon: Monitor, title: "Desktop Client", desc: "Native experience built with Electron and React." },
               { icon: Lock, title: "Crypto Auth", desc: "Offline-first Ed25519 license validation system." },
               { icon: Activity, title: "Go Engine", desc: "High-performance API handling and WebSocket sync." },
               { icon: Database, title: "Persistence", desc: "Enterprise-grade storage using PostgreSQL." }
             ].map((step, i) => (
               <div key={i} className="p-10 rounded-[3rem] bg-white/5 border border-white/10 flex flex-col items-center text-center backdrop-blur-md hover:bg-white/10 transition-all">
                  <div className="w-20 h-20 rounded-[2rem] bg-primary text-white flex items-center justify-center mb-8 shadow-2xl shadow-primary/40">
                    <step.icon size={36} strokeWidth={2.5}/>
                  </div>
                  <h4 className="text-xl font-black mb-4 uppercase tracking-tighter italic">{step.title}</h4>
                  <p className="text-slate-400 text-xs font-bold leading-relaxed">{step.desc}</p>
               </div>
             ))}
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section id="comparison" className="py-32 px-6 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-10 items-stretch">
          <div className="bg-slate-50 dark:bg-slate-800/20 p-12 rounded-[4rem] border border-slate-200 dark:border-white/5 opacity-50 flex flex-col justify-center">
            <h3 className="text-3xl font-black mb-12 dark:text-white italic uppercase tracking-tighter opacity-50">Postman (Legacy)</h3>
            <ul className="space-y-8">
              {["High Memory Usage", "Forced Cloud Sync", "Complex Subscription", "No Offline Keys"].map((item, i) => (
                <li key={i} className="flex items-center gap-5 text-slate-500 line-through font-bold text-lg italic">
                  <X size={24} /> {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-gradient-to-br from-primary to-accent p-12 md:p-20 rounded-[4rem] text-white shadow-2xl shadow-primary/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-10 rotate-45"><Rocket size={150}/></div>
            <h3 className="text-4xl md:text-5xl font-black mb-12 italic uppercase tracking-tighter text-white">Wapbolt (Upgrade)</h3>
            <ul className="space-y-8 relative z-10">
              {["Ultra-light Go Core", "Dynamic Mocking Pro", "Smart cURL Injector", "Real-time Collaboration"].map((item, i) => (
                <li key={i} className="flex items-center gap-6 font-black text-xl md:text-2xl tracking-tight text-white">
                  <div className="w-10 h-10 rounded-2xl bg-white text-primary flex items-center justify-center shrink-0 shadow-xl"><CheckCircle2 size={24} strokeWidth={4} /></div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

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
                       <div key={i} className="flex items-center gap-4 text-white font-bold text-sm"><CheckCircle2 className="text-primary" size={20}/> {li}</div>
                     ))}
                  </div>
               </div>

               <form onSubmit={handleSendEmail} className="bg-slate-900/50 p-10 rounded-[3rem] border border-white/5 backdrop-blur-xl">
                  <div className="space-y-6">
                     <div className="relative">
                        <User className="absolute left-5 top-5 text-slate-500" size={20} />
                        <input type="text" placeholder="Full Name" required className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white focus:border-primary transition-all font-bold text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                     </div>
                     <div className="relative">
                        <Mail className="absolute left-5 top-5 text-slate-500" size={20} />
                        <input type="email" placeholder="Email Address" required className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white focus:border-primary transition-all font-bold text-sm" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                     </div>
                     <div className="relative">
                        <MessageSquare className="absolute left-5 top-5 text-slate-500" size={20} />
                        <textarea placeholder="Tell us about your setup (e.g. PC or STB)" required rows={4} className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white focus:border-primary transition-all font-bold text-sm resize-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
                     </div>
                     <button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white py-6 rounded-2xl font-black text-xl flex items-center justify-center gap-4 shadow-2xl transition-all active:scale-95 group uppercase tracking-widest">
                        Register Beta <Send size={24} className="group-hover:translate-x-2 transition-transform" />
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
    </div>
  );
}

