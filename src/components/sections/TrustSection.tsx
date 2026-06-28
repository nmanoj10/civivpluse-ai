import React from 'react';
import { motion } from 'motion/react';
import { Shield, Building, Users, Server } from 'lucide-react';

export default function TrustSection() {
  const logos = [
    { icon: Building, text: "Municipal Councils" },
    { icon: Users, text: "Community Groups" },
    { icon: Shield, text: "Ward Officers" },
    { icon: Server, text: "GovTech Integrations" }
  ];

  return (
    <section className="py-12 border-y border-slate-200 bg-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-white via-transparent to-white z-10 pointer-events-none" />
      <div className="max-w-7xl mx-auto px-6 relative z-0">
        <p className="text-center text-xs font-bold text-slate-400 mb-8 uppercase tracking-widest">
          Trusted by communities, civic teams, and local administrators
        </p>
        <div className="flex flex-wrap justify-center gap-10 md:gap-20">
          {logos.map((item, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-2.5 text-slate-400 group cursor-default"
            >
              <item.icon className="w-5 h-5 group-hover:text-indigo-600 transition-colors duration-300" />
              <span className="font-display font-medium group-hover:text-slate-900 transition-colors duration-300">{item.text}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
