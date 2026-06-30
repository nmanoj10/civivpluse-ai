import React from 'react';
import { Sparkles } from 'lucide-react';

export default function PremiumPlaceholder() {
  return (
    <div className="w-full h-full bg-gradient-to-br from-indigo-50 to-slate-100 flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner mb-3">
        <Sparkles className="w-6 h-6 animate-pulse" />
      </div>
      <span className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">CIVICPULSE AI EVIDENCE</span>
      <span className="text-[9px] text-slate-500 mt-1">Satellite coordinate lock active</span>
    </div>
  );
}
