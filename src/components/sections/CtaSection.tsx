import React from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/shared';
import { ArrowRight, Sparkles } from 'lucide-react';

interface CtaSectionProps {
  onNavigate: (page: string) => void;
}

export default function CtaSection({ onNavigate }: CtaSectionProps) {
  return (
    <section className="py-24 md:py-32 bg-white relative overflow-hidden">
      <div className="absolute inset-0 bg-slate-50"></div>
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="bg-indigo-950 rounded-[3rem] p-12 md:p-24 text-center relative overflow-hidden shadow-2xl group"
        >
          {/* Animated Background Gradients */}
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-500 rounded-full blur-[120px] -z-10 mix-blend-screen" 
          />
          <motion.div 
            animate={{ 
              scale: [1, 1.5, 1],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-500 rounded-full blur-[120px] -z-10 mix-blend-screen" 
          />
          
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>

          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-full text-xs font-bold text-indigo-200 uppercase tracking-widest mb-8 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-indigo-300" />
            The Future of Civic Tech
          </div>
          
          <h2 className="text-5xl md:text-6xl font-extrabold text-white mb-8 tracking-tight">
            Ready to upgrade your city?
          </h2>
          <p className="text-xl md:text-2xl text-indigo-200 mb-12 max-w-3xl mx-auto font-medium leading-relaxed">
            Join hundreds of forward-thinking municipalities using AI to create cleaner, safer, and more accountable communities.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-4">
            <Button 
              size="lg" 
              onClick={() => onNavigate('login')}
              className="bg-white text-indigo-950 hover:bg-slate-50 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 font-bold px-8 group/btn h-14 text-base"
            >
              Start Reporting Issues
              <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
            </Button>
            <Button 
              size="lg" 
              onClick={() => onNavigate('register')}
              className="bg-indigo-900 text-white hover:bg-indigo-800 border border-indigo-700/50 hover:border-indigo-600 shadow-lg hover:-translate-y-1 transition-all duration-300 font-bold px-8 h-14 text-base"
            >
              Join CivicPulse AI
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
