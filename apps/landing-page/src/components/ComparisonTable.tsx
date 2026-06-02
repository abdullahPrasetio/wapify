import { CheckCircle2, XCircle, Minus } from 'lucide-react';
import { motion } from 'framer-motion';

type Status = 'yes' | 'no' | 'partial';

interface Feature {
  category: string;
  name: string;
  wapbolt: Status;
  postman: Status;
  insomnia: Status;
  wapboltNote?: string;
}

const features: Feature[] = [
  // Performance
  { category: 'Performance', name: 'Ultra-low RAM (~30MB)', wapbolt: 'yes', postman: 'no', insomnia: 'partial', wapboltNote: 'Go Fiber engine' },
  { category: 'Performance', name: 'Sub-millisecond latency', wapbolt: 'yes', postman: 'no', insomnia: 'partial' },
  { category: 'Performance', name: 'STB / Low-end device ready', wapbolt: 'yes', postman: 'no', insomnia: 'no' },
  // Privacy
  { category: 'Privacy', name: 'Self-hosted backend', wapbolt: 'yes', postman: 'partial', insomnia: 'partial' },
  { category: 'Privacy', name: '100% offline operation', wapbolt: 'yes', postman: 'no', insomnia: 'partial' },
  { category: 'Privacy', name: 'No forced cloud sync', wapbolt: 'yes', postman: 'no', insomnia: 'partial' },
  // Collaboration
  { category: 'Collaboration', name: 'Real-time WebSocket sync', wapbolt: 'yes', postman: 'yes', insomnia: 'no' },
  { category: 'Collaboration', name: 'Team activity log', wapbolt: 'yes', postman: 'partial', insomnia: 'no' },
  { category: 'Collaboration', name: 'Shared environments (Global + Workspace)', wapbolt: 'yes', postman: 'yes', insomnia: 'partial' },
  { category: 'Collaboration', name: 'Role-based access (Owner/Admin/Editor/Viewer)', wapbolt: 'yes', postman: 'yes', insomnia: 'no' },
  // Features
  { category: 'Features', name: 'Confluence auto-sync', wapbolt: 'yes', postman: 'no', insomnia: 'no', wapboltNote: 'PAT / API Token' },
  { category: 'Features', name: 'Mock server + dynamic scenarios', wapbolt: 'yes', postman: 'yes', insomnia: 'partial' },
  { category: 'Features', name: 'Omnibar search (Cmd+K)', wapbolt: 'yes', postman: 'yes', insomnia: 'partial' },
  { category: 'Features', name: 'OpenAPI / Postman import', wapbolt: 'yes', postman: 'yes', insomnia: 'yes' },
  { category: 'Features', name: 'In-app notifications + deep-link', wapbolt: 'yes', postman: 'partial', insomnia: 'no' },
  { category: 'Features', name: 'Drag & drop request reorder', wapbolt: 'yes', postman: 'yes', insomnia: 'yes' },
  // Licensing
  { category: 'Licensing', name: 'Offline Ed25519 license key', wapbolt: 'yes', postman: 'no', insomnia: 'no' },
  { category: 'Licensing', name: 'Free tier available', wapbolt: 'yes', postman: 'partial', insomnia: 'yes' },
  { category: 'Licensing', name: 'No subscription required', wapbolt: 'yes', postman: 'no', insomnia: 'partial' },
];

const categories = [...new Set(features.map(f => f.category))];

const StatusIcon = ({ status, note }: { status: Status; note?: string }) => {
  if (status === 'yes') return (
    <div className="flex flex-col items-center gap-1">
      <CheckCircle2 size={20} className="text-emerald-400" strokeWidth={2.5} />
      {note && <span className="text-[9px] text-emerald-300 font-bold">{note}</span>}
    </div>
  );
  if (status === 'no') return <XCircle size={20} className="text-red-400 opacity-60" strokeWidth={2} />;
  return <Minus size={20} className="text-yellow-400" strokeWidth={2.5} />;
};

export default function ComparisonTable() {
  return (
    <section id="comparison" className="py-32 px-6 max-w-7xl mx-auto">
      <div className="text-center mb-16">
        <span className="text-primary font-black uppercase tracking-[0.4em] text-[10px] mb-6 block">Side-by-Side</span>
        <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase italic dark:text-white leading-none">
          Wapbolt vs <span className="text-primary not-italic">The Rest.</span>
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-6 max-w-xl mx-auto font-medium text-sm">
          Perbandingan fitur lengkap berdasarkan penggunaan nyata di tim developer.
        </p>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-8 mb-10 text-xs font-bold">
        <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-400" /> Supported</div>
        <div className="flex items-center gap-2"><Minus size={16} className="text-yellow-400" /> Partial</div>
        <div className="flex items-center gap-2"><XCircle size={16} className="text-red-400 opacity-60" /> Not Available</div>
      </div>

      <div className="overflow-x-auto rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-2xl">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="text-left p-6 pl-8 font-black text-xs uppercase tracking-widest w-1/2">Feature</th>
              <th className="p-6 text-center font-black text-xs uppercase tracking-widest">
                <span className="text-primary">Wapbolt</span>
              </th>
              <th className="p-6 text-center font-black text-xs uppercase tracking-widest text-slate-400">Postman</th>
              <th className="p-6 text-center font-black text-xs uppercase tracking-widest text-slate-400">Insomnia</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <>
                <tr key={`cat-${cat}`} className="bg-slate-100 dark:bg-slate-800/60">
                  <td colSpan={4} className="pl-8 py-3 text-[10px] font-black uppercase tracking-[0.3em] text-primary">
                    {cat}
                  </td>
                </tr>
                {features.filter(f => f.category === cat).map((feat, i) => (
                  <motion.tr
                    key={feat.name}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <td className="pl-8 py-4 text-sm font-bold text-slate-700 dark:text-slate-200">{feat.name}</td>
                    <td className="py-4 text-center">
                      <div className="flex justify-center">
                        <StatusIcon status={feat.wapbolt} note={feat.wapboltNote} />
                      </div>
                    </td>
                    <td className="py-4 text-center">
                      <div className="flex justify-center">
                        <StatusIcon status={feat.postman} />
                      </div>
                    </td>
                    <td className="py-4 text-center">
                      <div className="flex justify-center">
                        <StatusIcon status={feat.insomnia} />
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-center text-slate-400 text-xs mt-6 font-medium italic">
        * Data berdasarkan evaluasi fitur per Mei 2026. Partial = fitur ada tapi terbatas atau butuh plan berbayar.
      </p>
    </section>
  );
}
