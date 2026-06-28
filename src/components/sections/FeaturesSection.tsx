import React from 'react';
import { motion } from 'motion/react';
import { fadeUp, staggerContainer, fadeUpDelayed } from '@/lib/motion';
import { FEATURES } from '@/lib/data';
import * as Icons from 'lucide-react';

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24 md:py-32 bg-white relative overflow-hidden">
      <div className="absolute inset-0 bg-slate-50/50"></div>
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
            Everything needed to run <br/> a <span className="text-indigo-600">smart municipality</span>.
          </motion.h2>
          <motion.p variants={fadeUpDelayed(0.2)} className="text-lg md:text-xl text-slate-500 font-medium">
            A comprehensive suite of tools for citizens to report, communities to verify, and authorities to act.
          </motion.p>
        </motion.div>

        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid md:grid-cols-3 gap-8"
        >
          {FEATURES.map((feature, idx) => {
            const Icon = (Icons as any)[feature.icon];
            return (
              <motion.div
                key={idx}
                variants={fadeUp}
                className="bg-white border border-slate-200 rounded-[2rem] p-8 md:p-10 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_50px_-15px_rgba(79,70,229,0.15)] hover:border-indigo-200 hover:-translate-y-1 transition-all duration-500 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/0 to-indigo-50/0 group-hover:from-indigo-50/50 group-hover:to-transparent transition-colors duration-500" />
                
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-indigo-600 transition-colors duration-500 shadow-sm group-hover:shadow-indigo-200">
                    <Icon className="w-8 h-8 text-slate-400 group-hover:text-white transition-colors duration-500" />
                  </div>
                  <h3 className="text-2xl font-extrabold text-slate-900 mb-5 tracking-tight group-hover:text-indigo-600 transition-colors">{feature.category}</h3>
                  <ul className="space-y-4">
                    {feature.items.map((item, i) => (
                      <motion.li 
                        key={i} 
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * i + 0.3 }}
                        className="flex items-center gap-3 text-slate-600 font-medium group-hover:text-slate-800 transition-colors"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-indigo-400 transition-colors" />
                        {item}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
