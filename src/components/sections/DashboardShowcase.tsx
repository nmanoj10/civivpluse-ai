import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { fadeUp, staggerContainer, fadeUpDelayed } from '@/lib/motion';
import { Button, Badge } from '@/components/ui/shared';
import { Activity, Clock, ShieldCheck, MapPin, Users, ArrowUpRight, TrendingUp } from 'lucide-react';

import AnimatedCounter from '@/components/ui/AnimatedCounter';

export default function DashboardShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const y1 = useTransform(scrollYProgress, [0, 1], ["0%", "-10%"]);
  const y2 = useTransform(scrollYProgress, [0, 1], ["0%", "10%"]);

  return (
    <section ref={containerRef} id="dashboard" className="py-24 md:py-32 bg-indigo-950 relative overflow-hidden text-white">
      <div id="impact" className="absolute top-0 left-0" />
      {/* Background Textures */}
      <div className="absolute inset-0 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:24px_24px] opacity-10" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <motion.div variants={fadeUp} className="mb-4">
            <Badge variant="ai" className="bg-indigo-900/50 text-indigo-300 border-indigo-700 font-bold backdrop-blur-sm">Municipality Dashboard</Badge>
          </motion.div>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-6 leading-tight">
            See the impact in <span className="text-indigo-400">real-time</span>.
          </motion.h2>
          <motion.p variants={fadeUpDelayed(0.2)} className="text-lg md:text-xl text-indigo-200 font-medium leading-relaxed">
             Empower your ward officers and civic leaders with live analytics, predictive maintenance insights, and automated SLAs.
          </motion.p>
        </motion.div>

        {/* Dynamic Dashboard Grid */}
        <div className="grid lg:grid-cols-12 gap-6 relative">
          
          {/* Main KPI Panel */}
          <motion.div 
            style={{ y: y1 }}
            className="lg:col-span-8 bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden group hover:bg-white/10 transition-colors duration-700"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-10 relative z-10">
              <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight">City Health Overview</h3>
              <div className="px-3 py-1.5 bg-white/10 rounded-md text-xs font-bold tracking-wider uppercase border border-white/5">Last 30 Days</div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12 relative z-10">
              {[
                { label: "Active Issues", value: 482, suffix: "", decimals: 0, duration: 2, trend: "+12%", icon: Activity, color: "text-blue-400" },
                { label: "Avg Resolution", value: 4.2, suffix: "d", decimals: 1, duration: 2.5, trend: "-18%", icon: Clock, color: "text-emerald-400" },
                { label: "AI Auto-Routed", value: 94, suffix: "%", decimals: 0, duration: 2.2, trend: "+2%", icon: ShieldCheck, color: "text-indigo-400" },
                { label: "Citizens Active", value: 12, suffix: "k", decimals: 0, duration: 2.7, trend: "+24%", icon: Users, color: "text-purple-400" }
              ].map((stat, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  viewport={{ once: true }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-display font-black tracking-tight">
                      <AnimatedCounter value={stat.value} suffix={stat.suffix} decimals={stat.decimals} duration={stat.duration} />
                    </span>
                    <span className={`text-xs font-bold ${stat.trend.startsWith('+') ? 'text-emerald-400' : 'text-emerald-400'}`}>
                      {stat.trend}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Fake Chart / Visual */}
            <div className="relative h-48 w-full bg-indigo-950/50 rounded-2xl border border-white/5 overflow-hidden flex items-end px-4 pt-8 pb-4 gap-2">
               {[40, 60, 30, 80, 50, 90, 70, 100, 40, 60, 80, 50, 70, 90].map((h, i) => (
                 <motion.div 
                   key={i}
                   initial={{ height: 0 }}
                   whileInView={{ height: `${h}%` }}
                   transition={{ delay: 0.5 + (i * 0.05), duration: 1, ease: "easeOut" }}
                   viewport={{ once: true }}
                   className="flex-1 bg-indigo-500/20 hover:bg-indigo-400/50 rounded-t-sm transition-colors relative group/bar"
                 >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-indigo-900 text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity">
                      {h * 12}
                    </div>
                 </motion.div>
               ))}
               
               {/* Overlay Trend Line (decorative) */}
               <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                 <motion.path 
                   initial={{ pathLength: 0 }}
                   whileInView={{ pathLength: 1 }}
                   transition={{ duration: 2, delay: 0.5, ease: "easeInOut" }}
                   viewport={{ once: true }}
                   d="M 0,80 Q 20,40 40,60 T 80,20 T 100,30" 
                   fill="none" 
                   stroke="#818cf8" 
                   strokeWidth="2"
                   vectorEffect="non-scaling-stroke"
                   className="opacity-50"
                 />
               </svg>
            </div>
          </motion.div>

          {/* Right side stacked widgets */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            <motion.div 
              style={{ y: y2 }}
              className="bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-6 relative overflow-hidden"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white tracking-tight">Hotspot Detected</h4>
                  <p className="text-xs text-indigo-300 font-medium">Downtown Sector</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-medium text-slate-300">Pothole Reports</span>
                  <span className="text-lg font-bold text-white flex items-center gap-1">
                    <AnimatedCounter value={24} duration={2} /> 
                    <ArrowUpRight className="w-3 h-3 text-red-400"/>
                  </span>
                </div>
                <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                   <motion.div 
                     initial={{ width: 0 }}
                     whileInView={{ width: "85%" }}
                     transition={{ duration: 1, delay: 0.5 }}
                     viewport={{ once: true }}
                     className="bg-red-400 h-full rounded-full" 
                   />
                </div>
              </div>
            </motion.div>

            <motion.div 
              style={{ y: y1 }}
              className="bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-6 relative overflow-hidden flex-1"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white tracking-tight">Resolution SLA</h4>
                  <p className="text-xs text-indigo-300 font-medium">Across all departments</p>
                </div>
              </div>

              {/* SLA Ring */}
              <div className="flex items-center justify-center py-4">
                 <div className="relative w-32 h-32 flex items-center justify-center">
                   <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                     <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                     <motion.circle 
                       cx="50" cy="50" r="40" fill="none" stroke="#34d399" strokeWidth="8"
                       strokeDasharray="251.2"
                       initial={{ strokeDashoffset: 251.2 }}
                       whileInView={{ strokeDashoffset: 251.2 * (1 - 0.92) }}
                       transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                       viewport={{ once: true }}
                       strokeLinecap="round"
                     />
                   </svg>
                   <div className="absolute text-center">
                     <div className="text-3xl font-display font-black">
                       <AnimatedCounter value={92} suffix="%" duration={2.5} />
                     </div>
                     <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Met SLA</div>
                   </div>
                 </div>
              </div>
            </motion.div>

          </div>

        </div>
      </div>
    </section>
  );
}
