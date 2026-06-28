import React from 'react';
import { motion } from 'motion/react';
import { WORKFLOW_STEPS } from '@/lib/data';
import * as Icons from 'lucide-react';
import { fadeUp, fadeUpDelayed } from '@/lib/motion';
import { Badge } from '@/components/ui/shared';
import AnimatedCounter from '@/components/ui/AnimatedCounter';

export default function WorkflowSection() {
  return (
    <section id="how-it-works" className="py-24 md:py-32 relative bg-slate-50 border-y border-slate-200 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex flex-col lg:flex-row gap-16 lg:gap-24 items-start">
          
          {/* Sticky Left Panel */}
          <div className="lg:w-1/3 lg:sticky lg:top-32 lg:pb-32">
             <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
               <motion.div variants={fadeUp} className="mb-4">
                 <Badge variant="default" className="bg-white shadow-sm border-slate-200 text-indigo-600 font-bold">Workflow</Badge>
               </motion.div>
               <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-6 leading-tight">
                  The lifecycle of a <span className="text-indigo-600">smart resolution</span>.
               </motion.h2>
               <motion.p variants={fadeUpDelayed(0.2)} className="text-lg text-slate-500 font-medium leading-relaxed">
                  From the moment a citizen snaps a photo to the final verified repair, CivicPulse AI automates the heavy lifting. Watch how an issue moves through the system.
               </motion.p>
             </motion.div>
          </div>

          {/* Scrolling Right Panel */}
          <div className="lg:w-2/3 flex flex-col relative pt-8 lg:pt-0">
             {/* Progress Line */}
             <div className="absolute left-[39px] top-12 bottom-24 w-0.5 bg-gradient-to-b from-indigo-200 via-slate-200 to-transparent hidden md:block" />
             
             {WORKFLOW_STEPS.map((step, index) => {
               const Icon = (Icons as any)[step.icon];
               return (
                 <motion.div 
                   key={index}
                   initial={{ opacity: 0, y: 50 }}
                   whileInView={{ opacity: 1, y: 0 }}
                   viewport={{ once: true, margin: "-20%" }}
                   transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                   className="relative flex gap-6 md:gap-10 group"
                 >
                   {/* Step Indicator */}
                   <div className="relative z-10 shrink-0">
                     <div className="w-20 h-20 rounded-[1.25rem] bg-white border border-slate-200 flex items-center justify-center shadow-sm group-hover:border-indigo-300 group-hover:shadow-[0_15px_30px_-10px_rgba(79,70,229,0.2)] transition-all duration-300 relative overflow-hidden">
                       <div className="absolute inset-0 bg-indigo-50/0 group-hover:bg-indigo-50/50 transition-colors" />
                       <Icon className="w-8 h-8 text-slate-400 group-hover:text-indigo-600 transition-colors relative z-10" />
                       <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold text-sm flex items-center justify-center border-2 border-white group-hover:bg-indigo-600 group-hover:text-white transition-colors z-20">
                         {index + 1}
                       </div>
                     </div>
                   </div>
                   
                   {/* Content & Mini Mockup */}
                   <div className="pt-2 pb-16 w-full">
                     <h3 className="text-2xl font-extrabold text-slate-900 mb-3 group-hover:text-indigo-600 transition-colors tracking-tight">{step.title}</h3>
                     <p className="text-lg text-slate-500 font-medium leading-relaxed max-w-xl">{step.desc}</p>
                     
                     {/* Dynamic product mockup insert per step to make it feel alive */}
                     <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-hidden relative group-hover:shadow-lg transition-shadow duration-300">
                        <div className="absolute inset-0 bg-slate-50/50 pointer-events-none" />
                        
                        {index === 0 && (
                          <div className="flex gap-4 items-center relative z-10">
                            <div className="w-16 h-16 rounded-xl bg-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                              <Icons.Image className="w-6 h-6 text-slate-400" />
                            </div>
                            <div className="space-y-2 flex-1">
                              <div className="h-2.5 w-1/3 bg-slate-200 rounded-full" />
                              <div className="h-2 w-1/2 bg-slate-100 rounded-full" />
                              <div className="flex gap-2 pt-1">
                                <div className="h-6 w-20 bg-indigo-50 border border-indigo-100 rounded-md" />
                              </div>
                            </div>
                          </div>
                        )}

                        {index === 1 && (
                          <div className="flex justify-between items-center relative z-10">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center">
                                <Icons.CheckCircle2 className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="text-sm font-bold text-slate-800">Authenticity Score</div>
                                <div className="text-xs text-slate-400 font-medium">Cryptographic Hash Verified</div>
                              </div>
                            </div>
                            <div className="text-xl font-black text-emerald-500">
                              <AnimatedCounter value={99.8} suffix="%" decimals={1} duration={2} />
                            </div>
                          </div>
                        )}

                        {index === 2 && (
                          <div className="space-y-3 relative z-10">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Community Validation</span>
                              <Badge variant="default" className="bg-slate-100 text-slate-600">3/3 Required</Badge>
                            </div>
                            <div className="flex gap-2">
                              {[1,2,3].map(i => (
                                <motion.div 
                                  key={i} 
                                  initial={{ scale: 0.8, opacity: 0 }}
                                  whileInView={{ scale: 1, opacity: 1 }}
                                  transition={{ delay: i * 0.15 }}
                                  className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-white shadow-sm flex items-center justify-center -ml-2 first:ml-0"
                                >
                                  <Icons.ThumbsUp className="w-3 h-3 text-indigo-500" />
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        )}

                        {index === 3 && (
                          <div className="flex items-start gap-4 relative z-10">
                            <div className="flex-1 space-y-3">
                              <div className="flex justify-between text-xs font-bold">
                                <span className="text-slate-500 uppercase">Routing to</span>
                                <span className="text-indigo-600">Dept of Public Works</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  whileInView={{ width: "100%" }}
                                  transition={{ duration: 1.5, ease: "easeInOut" }}
                                  className="h-full bg-indigo-500"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {index === 4 && (
                          <div className="flex items-center justify-between relative z-10">
                             <div className="flex items-center gap-3">
                               <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center">
                                 <Icons.Clock className="w-5 h-5" />
                               </div>
                               <div>
                                 <div className="text-sm font-bold text-slate-800">SLA Timer</div>
                                 <div className="text-xs text-slate-400 font-medium">Time until escalation</div>
                               </div>
                             </div>
                             <div className="text-lg font-black text-slate-700 font-mono">47:59:22</div>
                          </div>
                        )}
                     </div>
                   </div>
                 </motion.div>
               );
             })}
          </div>
        </div>
      </div>
    </section>
  );
}
