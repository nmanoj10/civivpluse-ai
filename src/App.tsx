import React, { useState, useEffect } from 'react';
import HeroSection from '@/components/sections/HeroSection';
import TrustSection from '@/components/sections/TrustSection';
import ProblemSection from '@/components/sections/ProblemSection';
import WorkflowSection from '@/components/sections/WorkflowSection';
import FeaturesSection from '@/components/sections/FeaturesSection';
import DashboardShowcase from '@/components/sections/DashboardShowcase';
import CtaSection from '@/components/sections/CtaSection';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

// Pages
import Login from '@/components/pages/Login';
import Register from '@/components/pages/Register';
import CitizenDashboard from '@/components/pages/CitizenDashboard';
import OfficerDashboard from '@/components/pages/OfficerDashboard';
import AdminDashboard from '@/components/pages/AdminDashboard';
import ResolvedFeed from '@/components/pages/ResolvedFeed';
import WardStats from '@/components/pages/WardStats';

export default function App() {
  const [currentPage, setCurrentPage] = useState<string>('landing');
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Centralized Guarded Routing Logic
  const navigate = (page: string) => {
    // 1. Unauthenticated guards: can't open dashboard without login
    const isProtected = ['citizen-dashboard', 'officer-dashboard', 'admin-dashboard'].includes(page);
    if (isProtected && !user) {
      setCurrentPage('login');
      return;
    }

    // 2. Guest-only page guards: logged-in user visits login or register -> redirect to dashboard
    if (user && ['login', 'register'].includes(page)) {
      const dest = user.role === 'admin' ? 'admin-dashboard' : (user.role === 'ward_officer' ? 'officer-dashboard' : 'citizen-dashboard');
      setCurrentPage(dest);
      return;
    }

    // 3. Role authorization guards: prevent accessing other roles' dashboards
    if (user) {
      if (page === 'admin-dashboard' && user.role !== 'admin') {
        setCurrentPage(user.role === 'ward_officer' ? 'officer-dashboard' : 'citizen-dashboard');
        return;
      }
      if (page === 'officer-dashboard' && user.role !== 'ward_officer' && user.role !== 'admin') {
        setCurrentPage('citizen-dashboard');
        return;
      }
      if (page === 'citizen-dashboard' && user.role !== 'citizen' && user.role !== 'volunteer') {
        setCurrentPage(user.role === 'admin' ? 'admin-dashboard' : 'officer-dashboard');
        return;
      }
    }

    setCurrentPage(page);
  };

  useEffect(() => {
    const bootstrapAuth = async () => {
      const savedToken = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');

      if (savedToken) {
        try {
          const response = await fetch('/api/auth/profile', {
            headers: {
              'Authorization': `Bearer ${savedToken}`
            }
          });
          const data = await response.json();
          
          if (response.ok && data.data) {
            setUser(data.data);
            setToken(savedToken);
            localStorage.setItem('user', JSON.stringify(data.data)); // Keep profile fresh in storage

            // Re-route to dashboard automatically if on public/auth landing pages
            const dest = data.data.role === 'admin' ? 'admin-dashboard' : (data.data.role === 'ward_officer' ? 'officer-dashboard' : 'citizen-dashboard');
            if (['landing', 'login', 'register'].includes(currentPage)) {
              setCurrentPage(dest);
            }
          } else {
            handleLogout();
          }
        } catch (e) {
          console.error('Error fetching user profile during bootstrap:', e);
          // Fallback to offline stored state if backend is down but token is saved
          if (savedUser) {
            try {
              const parsedUser = JSON.parse(savedUser);
              setUser(parsedUser);
              setToken(savedToken);
              const dest = parsedUser.role === 'admin' ? 'admin-dashboard' : (parsedUser.role === 'ward_officer' ? 'officer-dashboard' : 'citizen-dashboard');
              if (['landing', 'login', 'register'].includes(currentPage)) {
                setCurrentPage(dest);
              }
            } catch (err) {
              handleLogout();
            }
          } else {
            handleLogout();
          }
        }
      }
      setLoading(false);
    };

    bootstrapAuth();
  }, []);

  const handleLoginSuccess = (userData: any, userToken: string) => {
    setUser(userData);
    setToken(userToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', userToken);

    const dest = userData.role === 'admin' ? 'admin-dashboard' : (userData.role === 'ward_officer' ? 'officer-dashboard' : 'citizen-dashboard');
    setCurrentPage(dest);
  };

  const handleLogout = () => {
    setUser(null);
    setToken('');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setCurrentPage('landing');
  };

  // Prevent UI flash when securing session on reload
  if (loading && localStorage.getItem('token')) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-100 font-sans relative overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] right-[-5%] w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[120px] mix-blend-multiply animate-pulse" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] mix-blend-multiply animate-pulse" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center animate-spin shadow-lg shadow-indigo-600/30">
            <div className="w-3.5 h-3.5 bg-white rounded-full"></div>
          </div>
          <span className="font-display font-bold text-2xl tracking-tight text-white mt-4">CivicPulse<span className="text-indigo-400">AI</span></span>
          <p className="text-sm text-slate-400 font-medium">Securing session...</p>
        </div>
      </div>
    );
  }

  // State Routing Render Logic
  switch (currentPage) {
    case 'login':
      return (
        <Login onLoginSuccess={handleLoginSuccess} onNavigate={navigate} />
      );
    case 'register':
      return (
        <Register onNavigate={navigate} />
      );
    case 'citizen-dashboard':
      return user ? (
        <CitizenDashboard user={user} token={token} onLogout={handleLogout} />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} onNavigate={navigate} />
      );
    case 'officer-dashboard':
      return user ? (
        <OfficerDashboard user={user} token={token} onLogout={handleLogout} />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} onNavigate={navigate} />
      );
    case 'admin-dashboard':
      return user ? (
        <AdminDashboard user={user} token={token} onLogout={handleLogout} />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} onNavigate={navigate} />
      );
    case 'resolved-feed':
      return (
        <div className="min-h-screen flex flex-col">
          <Navbar currentPage={currentPage} user={user} onNavigate={navigate} onLogout={handleLogout} />
          <div className="flex-1">
            <ResolvedFeed />
          </div>
          <Footer />
        </div>
      );
    case 'ward-stats':
      return (
        <div className="min-h-screen flex flex-col">
          <Navbar currentPage={currentPage} user={user} onNavigate={navigate} onLogout={handleLogout} />
          <div className="flex-1">
            <WardStats />
          </div>
          <Footer />
        </div>
      );
    case 'landing':
    default:
      return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
          <Navbar currentPage={currentPage} user={user} onNavigate={navigate} onLogout={handleLogout} />
          <main>
            <HeroSection onNavigate={navigate} />
            <TrustSection />
            <ProblemSection />
            <WorkflowSection />
            <FeaturesSection />
            <DashboardShowcase />
            <CtaSection onNavigate={navigate} />
          </main>
          <Footer />
        </div>
      );
  }
}
