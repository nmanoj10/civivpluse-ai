import React from 'react';
import { motion } from 'motion/react';
import { fadeUp, staggerContainer, fadeUpDelayed, scaleUp } from '@/lib/motion';
import { FileQuestion, AlertCircle, RefreshCcw, UserX } from 'lucide-react';

export default function ProblemSection() {
  const problems = [
    { icon: FileQuestion, title: "Fragmented Reporting", desc: "Multiple isolated portals, emails, and tweets that get lost." },
    { icon: AlertCircle, title: "Fake & Duplicate Data", desc: "Authorities waste time sorting through unverified or duplicate complaints." },
    { icon: UserX, title: "No Accountability", desc: "Issues sit unassigned with no clear SLAs or escalation paths." },
    { icon: RefreshCcw, title: "Zero Feedback Loop", desc: "Citizens never know if their issue was acknowledged or fixed." }
  ];

  return (
    <section id="community" className="py-24 md:py-32 relative overflow-hidden bg-white">
      <div className="absolute inset-0 bg-[radial-gradient(#f1f5f9_1px,transparent_1px)] [background-size:20px_20px] opacity-50"></div>
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">
            Why traditional civic portals <span className="text-slate-400">fail</span>.
          </motion.h2>
          <motion.p variants={fadeUpDelayed(0.2)} className="text-lg md:text-xl text-slate-500 font-medium">
            Current systems are broken. They lack intelligence, transparency, and the ability to verify claims at scale, leading to municipal gridlock.
          </motion.p>
        </motion.div>

        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {problems.map((prob, i) => (
            <motion.div 
              key={i}
              variants={fadeUp}
              className="bg-white border border-slate-200 p-8 rounded-3xl relative overflow-hidden group shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:-translate-y-1 transition-all duration-300"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-[100px] -z-10 group-hover:bg-indigo-50/50 transition-colors duration-500" />
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-indigo-50 transition-all duration-300">
                <prob.icon className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 transition-colors duration-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3">{prob.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">{prob.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Narrative Split */}
        <motion.div 
          variants={scaleUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mt-24 bg-white border border-slate-200 rounded-[2.5rem] p-1.5 md:p-2.5 shadow-2xl shadow-slate-200/50"
        >
           <div className="grid md:grid-cols-2 rounded-[2rem] overflow-hidden bg-white border border-slate-100">
              <div className="p-10 md:p-16 relative overflow-hidden bg-slate-50/80 group hover:bg-slate-50 transition-colors">
                <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] opacity-30" />
                <Badge variant="critical" className="mb-6 inline-flex relative z-10 shadow-sm">The Old Way</Badge>
                <h4 className="text-3xl font-extrabold mb-6 text-slate-900 tracking-tight relative z-10">Black Hole of Bureaucracy</h4>
                <ul className="space-y-5 text-slate-500 text-base font-medium relative z-10">
                  <li className="flex items-center gap-4"><span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-500 font-bold text-xs">×</span> Manual sorting and assignment</li>
                  <li className="flex items-center gap-4"><span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-500 font-bold text-xs">×</span> Susceptible to spam and trolls</li>
                  <li className="flex items-center gap-4"><span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-500 font-bold text-xs">×</span> Reactive, not predictive</li>
                </ul>
              </div>
              <div className="p-10 md:p-16 relative overflow-hidden bg-slate-900 text-white group">
                <div className="absolute inset-0 bg-indigo-900/20 mix-blend-overlay group-hover:bg-indigo-900/40 transition-colors duration-700" />
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 group-hover:bg-indigo-500/30 transition-colors duration-700" />
                <Badge variant="ai" className="mb-6 inline-flex bg-indigo-900/50 text-indigo-300 border-indigo-700/50 backdrop-blur-md relative z-10 shadow-lg">CivicPulse AI</Badge>
                <h4 className="text-3xl font-extrabold mb-6 text-white tracking-tight relative z-10">Intelligent Resolution Engine</h4>
                <ul className="space-y-5 text-slate-300 text-base font-medium relative z-10">
                  <li className="flex items-center gap-4"><span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-xs">✓</span> AI categorization & auto-routing</li>
                  <li className="flex items-center gap-4"><span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-xs">✓</span> Cryptographic media verification</li>
                  <li className="flex items-center gap-4"><span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-xs">✓</span> Transparent SLA tracking</li>
                </ul>
              </div>
           </div>
        </motion.div>

      </div>
    </section>
  );
}

function Badge({ children, className, variant = 'default' }: { children: React.ReactNode, className?: string, variant?: 'default'|'critical'|'ai' }) {
  const variants = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    critical: 'bg-red-50 text-red-600 border-red-100',
    ai: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  };
  return (
    <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold border uppercase tracking-widest ${variants[variant]} ${className || ''}`}>
      {children}
    </span>
  );
}
