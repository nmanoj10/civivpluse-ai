import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-slate-50 border-t border-slate-200 py-16 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div>
          <div className="flex items-center gap-2 font-bold text-2xl tracking-tight text-slate-900 mb-2">
            <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center shadow-sm">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
            CivicPulse<span className="text-indigo-600">AI</span>
          </div>
          <p className="text-sm font-medium text-slate-500 max-w-xs">Building smarter, safer, and more accountable communities through intelligent civic infrastructure.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-10 text-sm font-bold text-slate-600">
          <a href="#" className="hover:text-indigo-600 transition-colors">Platform</a>
          <a href="#" className="hover:text-indigo-600 transition-colors">Case Studies</a>
          <a href="#" className="hover:text-indigo-600 transition-colors">Municipality Login</a>
          <a href="#" className="hover:text-indigo-600 transition-colors">Privacy & Terms</a>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-sm font-medium text-slate-400">
          &copy; {new Date().getFullYear()} CivicPulse AI. All rights reserved.
        </div>
        <div className="text-sm font-medium text-slate-400 flex items-center gap-2">
          Designed for the public good <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
        </div>
      </div>
    </footer>
  );
}
