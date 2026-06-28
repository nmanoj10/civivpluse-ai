import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/shared';
import { ShieldCheck, Menu, X } from 'lucide-react';

interface NavbarProps {
  currentPage: string;
  user: any;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export default function Navbar({ currentPage, user, onNavigate, onLogout }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = ['How It Works', 'Features', 'Community', 'Dashboard', 'Impact'];

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, link: string) => {
    if (link === 'Dashboard') {
      e.preventDefault();
      if (user) {
        const dest = user.role === 'admin' ? 'admin-dashboard' : (user.role === 'ward_officer' ? 'officer-dashboard' : 'citizen-dashboard');
        onNavigate(dest);
      } else {
        onNavigate('login');
      }
    } else {
      // For other links, check if we are on landing page.
      // If not, set current page to landing, then let standard scroll happen
      if (currentPage !== 'landing') {
        e.preventDefault();
        onNavigate('landing');
        setTimeout(() => {
          const el = document.getElementById(link.toLowerCase().replace(/\s+/g, '-'));
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  };

  return (
    <motion.header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/80 backdrop-blur-md border-b border-slate-200 py-4' : 'bg-transparent py-6'
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('landing')}>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
             <div className="w-3 h-3 bg-white rounded-full"></div>
          </div>
          <span className="font-display font-bold text-2xl tracking-tight text-indigo-900">CivicPulse<span className="text-indigo-600">AI</span></span>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a 
              key={link} 
              href={`#${link.toLowerCase().replace(/\s+/g, '-')}`} 
              onClick={(e) => handleLinkClick(e, link)}
              className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
            >
              {link}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <>
              <span className="text-sm font-semibold text-indigo-900/80 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
                Hi, {user.name}
              </span>
              <Button 
                variant="ghost" 
                className="text-sm" 
                onClick={() => {
                  const dest = user.role === 'admin' ? 'admin-dashboard' : (user.role === 'ward_officer' ? 'officer-dashboard' : 'citizen-dashboard');
                  onNavigate(dest);
                }}
              >
                Dashboard
              </Button>
              <Button variant="outline" className="text-sm border-slate-250 text-slate-700 hover:bg-slate-50" onClick={onLogout}>
                Log Out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" className="text-sm" onClick={() => onNavigate('login')}>Log In</Button>
              <Button onClick={() => onNavigate('login')}>Report an Issue</Button>
            </>
          )}
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden text-slate-900" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-slate-200 overflow-hidden"
          >
            <div className="px-6 py-4 flex flex-col gap-4">
              {navLinks.map((link) => (
                <a 
                  key={link} 
                  href={`#${link.toLowerCase().replace(/\s+/g, '-')}`} 
                  className="text-sm font-semibold text-slate-600 hover:text-indigo-600 py-2" 
                  onClick={(e) => {
                    setIsMobileMenuOpen(false);
                    handleLinkClick(e, link);
                  }}
                >
                  {link}
                </a>
              ))}
              <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
                {user ? (
                  <>
                    <span className="text-sm font-semibold text-slate-700 text-center py-2">
                      Logged in as {user.name}
                    </span>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-center"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        const dest = user.role === 'admin' ? 'admin-dashboard' : (user.role === 'ward_officer' ? 'officer-dashboard' : 'citizen-dashboard');
                        onNavigate(dest);
                      }}
                    >
                      Dashboard
                    </Button>
                    <Button 
                      variant="outline"
                      className="w-full justify-center"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onLogout();
                      }}
                    >
                      Log Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" className="w-full justify-center" onClick={() => { setIsMobileMenuOpen(false); onNavigate('login'); }}>
                      Log In
                    </Button>
                    <Button className="w-full justify-center" onClick={() => { setIsMobileMenuOpen(false); onNavigate('login'); }}>
                      Report an Issue
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

