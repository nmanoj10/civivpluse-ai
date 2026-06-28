import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { fadeUp, staggerContainer, fadeUpDelayed } from '@/lib/motion';
import { Button, Badge } from '@/components/ui/shared';
import { MapPin, AlertTriangle, ShieldCheck, Clock, CheckCircle2, Navigation } from 'lucide-react';

import AnimatedCounter from '@/components/ui/AnimatedCounter';

interface HeroSectionProps {
  onNavigate: (page: string) => void;
}

export default function HeroSection({ onNavigate }: HeroSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const yBg = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacityBg = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const yCards = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);

  return (
    <section ref={containerRef} className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden min-h-screen flex items-center bg-slate-50">
      {/* Animated Ambient Background Layers */}
      <motion.div style={{ y: yBg, opacity: opacityBg }} className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[800px] h-[800px] bg-indigo-200/40 rounded-full blur-[120px] mix-blend-multiply animate-blob" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-blue-200/40 rounded-full blur-[120px] mix-blend-multiply animate-blob animation-delay-2000" />
        <div className="absolute top-[20%] left-[20%] w-[500px] h-[500px] bg-slate-200/50 rounded-full blur-[100px] mix-blend-multiply animate-blob animation-delay-4000" />
      </motion.div>
      
      <div className="max-w-7xl mx-auto px-6 w-full relative z-10">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left: Content */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="lg:col-span-5 flex flex-col justify-center space-y-8"
          >
            <motion.div variants={fadeUp} className="mb-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-700 uppercase tracking-widest shadow-sm hover:shadow-md transition-shadow">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                </span>
                Next-Gen Civic Infrastructure
              </div>
            </motion.div>
            
            <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-extrabold text-slate-900 leading-[1.05] tracking-tight">
              Transforming <br/>
              <span className="relative inline-block mt-2">
                <span className="relative z-10 text-indigo-600 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-600">
                  Communities
                </span>
                <span className="absolute bottom-1 left-0 w-full h-3 bg-indigo-100 -z-10 transform -rotate-1 origin-left rounded"></span>
              </span> 
              <br/>through AI.
            </motion.h1>
            
            <motion.p variants={fadeUp} className="text-lg md:text-xl text-slate-500 max-w-lg leading-relaxed font-medium">
              Citizens report issues like potholes and leaks using media. AI verifies, categorizes, and routes them to authorities with transparent tracking. A new era of public accountability.
            </motion.p>
            
            <motion.div variants={fadeUp} className="flex flex-wrap gap-4 pt-4">
              <Button 
                size="lg" 
                onClick={() => onNavigate('login')}
                className="bg-slate-900 text-white shadow-xl hover:bg-slate-800 hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300 font-bold group"
              >
                Get Started
                <Navigation className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                onClick={() => onNavigate('register')}
                className="bg-white hover:bg-slate-50 hover:shadow-md transition-all duration-300 font-bold"
              >
                Create Account
              </Button>
            </motion.div>

            <motion.div variants={fadeUpDelayed(0.4)} className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 mt-8">
              <div className="group">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-display font-black text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors">
                    <AnimatedCounter value={12} duration={2} />
                  </span>
                  <span className="text-xl font-bold text-indigo-600">k+</span>
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Reports Processed</div>
              </div>
              <div className="group">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-display font-black text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors">
                    <AnimatedCounter value={94} duration={2.5} />
                  </span>
                  <span className="text-xl font-bold text-indigo-600">%</span>
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">AI Accuracy</div>
              </div>
            </motion.div>
          </motion.div>

          {/* Right: Premium Visual Composition */}
          <motion.div 
            style={{ y: yCards }}
            className="lg:col-span-7 relative hidden md:block"
          >
             {/* Abstract map/dashboard composite */}
             <div className="w-full relative h-[700px] flex items-center justify-center">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full h-full relative"
                >
                  {/* Base App Interface */}
                  <div className="absolute inset-4 bg-white/80 backdrop-blur-sm rounded-3xl overflow-hidden border border-slate-200/80 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] flex flex-col z-10">
                     {/* Header */}
                     <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white/50">
                       <div className="flex items-center gap-3">
                         <div className="flex gap-1.5">
                           <div className="w-3 h-3 rounded-full bg-slate-200 hover:bg-red-400 transition-colors cursor-pointer"></div>
                           <div className="w-3 h-3 rounded-full bg-slate-200 hover:bg-amber-400 transition-colors cursor-pointer"></div>
                           <div className="w-3 h-3 rounded-full bg-slate-200 hover:bg-green-400 transition-colors cursor-pointer"></div>
                         </div>
                         <span className="ml-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Command Center</span>
                       </div>
                       <div className="flex gap-3">
                         <div className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded text-[10px] font-bold text-slate-500 uppercase tracking-wider">Downtown Sector</div>
                         <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded text-[10px] font-bold uppercase tracking-wider">
                           <span className="relative flex h-1.5 w-1.5">
                             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-75"></span>
                             <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-600"></span>
                           </span>
                           Live
                         </div>
                       </div>
                     </div>
                     {/* Map Canvas */}
                     <div className="flex-1 relative bg-slate-50/50">
                        <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                        
                        {/* Map Pins */}
                        <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="absolute top-1/4 left-1/3">
                          <div className="w-8 h-8 rounded-full bg-red-100 border border-red-200 flex items-center justify-center text-red-500 shadow-sm"><MapPin className="w-4 h-4" /></div>
                        </motion.div>
                        <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }} className="absolute bottom-1/3 right-1/4">
                          <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-500 shadow-sm"><MapPin className="w-4 h-4" /></div>
                        </motion.div>
                        <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 2 }} className="absolute top-1/2 left-2/3">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-500 shadow-sm"><CheckCircle2 className="w-4 h-4" /></div>
                        </motion.div>
                     </div>
                  </div>

                  {/* Floating Elements - Layered Motion */}
                  
                  {/* Trust Badge */}
                  <motion.div 
                    initial={{ y: 30, opacity: 0, x: -20 }}
                    animate={{ y: 0, opacity: 1, x: 0 }}
                    transition={{ delay: 0.8, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute top-32 -left-8 md:-left-12 z-20"
                  >
                    <motion.div animate={{ y: [-8, 8, -8] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
                      <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl w-64 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)] border border-slate-200/60 group hover:border-indigo-200 transition-colors">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors text-indigo-600">
                              <ShieldCheck className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold text-slate-800 tracking-wide">AI Verification</span>
                          </div>
                          <Badge variant="success" className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase shadow-sm">Passed</Badge>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            <span>Authenticity</span>
                            <span className="text-emerald-500 font-black">
                              <AnimatedCounter value={99.8} suffix="%" decimals={1} duration={2} />
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }} 
                              animate={{ width: "99.8%" }} 
                              transition={{ delay: 1.5, duration: 1.5, ease: [0.16, 1, 0.3, 1] }} 
                              className="bg-emerald-500 h-full rounded-full" 
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>

                  {/* Issue Card */}
                  <motion.div 
                    initial={{ y: 40, opacity: 0, x: 20 }}
                    animate={{ y: 0, opacity: 1, x: 0 }}
                    transition={{ delay: 1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute bottom-24 -right-8 md:-right-12 z-30"
                  >
                    <motion.div animate={{ y: [8, -8, 8] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}>
                      <div className="bg-white/95 backdrop-blur-xl p-5 rounded-2xl w-[320px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)] border border-slate-200/80 group hover:border-red-200 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0 text-red-500 group-hover:bg-red-500 group-hover:text-white transition-all shadow-sm group-hover:shadow-md group-hover:scale-105">
                            <AlertTriangle className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-1">
                              <h4 className="font-bold text-sm text-slate-900 tracking-tight">Severe Road Damage</h4>
                              <span className="text-[10px] font-bold text-slate-400">2m ago</span>
                            </div>
                            <p className="text-[11px] font-semibold text-slate-500 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                              <MapPin className="w-3 h-3 text-slate-400" /> Downtown Ave
                            </p>
                            <div className="flex gap-2">
                               <div className="px-2.5 py-1 bg-red-50 text-red-600 rounded-md text-[10px] font-bold uppercase tracking-wider border border-red-100 shadow-sm flex items-center gap-1">
                                 <Clock className="w-3 h-3" /> SLA: 48h
                               </div>
                               <div className="px-2.5 py-1 bg-slate-50 text-slate-600 rounded-md text-[10px] font-bold uppercase tracking-wider border border-slate-200 shadow-sm">
                                 Escalated
                               </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>

                </motion.div>
             </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
