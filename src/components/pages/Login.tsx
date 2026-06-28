import React, { useState } from 'react';
import { Button } from '@/components/ui/shared';
import { ArrowLeft, KeyRound, Mail, AlertCircle, Eye, EyeOff, Lock } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: any, token: string) => void;
  onNavigate: (page: string) => void;
}

export default function Login({ onLoginSuccess, onNavigate }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');

    if (!email) {
      setEmailError('Email address is required');
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) return;
    
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed. Please check your credentials.');
      }

      const { user, token } = data.data;
      onLoginSuccess(user, token);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-12 relative overflow-hidden text-slate-900 font-sans">
      {/* Premium Animated Gradient Blobs */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[800px] h-[800px] bg-indigo-200/30 rounded-full blur-[120px] mix-blend-multiply animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-blue-200/30 rounded-full blur-[120px] mix-blend-multiply animate-pulse" />
      </div>

      <div className="max-w-md w-full relative z-10 bg-white/80 border border-slate-200/80 backdrop-blur-md rounded-3xl p-8 shadow-2xl transition-all duration-300 hover:shadow-indigo-100/50">
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => onNavigate('landing')}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition-colors group font-semibold"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </button>
          
          <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => onNavigate('landing')}>
            <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-indigo-900">CivicPulse<span className="text-indigo-600">AI</span></span>
          </div>
        </div>

        <div className="mb-8">
          <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
            <Lock className="w-5 h-5 text-indigo-600" />
          </div>
          <h2 className="text-3xl font-display font-extrabold tracking-tight text-slate-900 mb-2">Welcome Back</h2>
          <p className="text-sm text-slate-500 font-medium">Log in to manage and report civic issues.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError('');
                }}
                className={`w-full bg-slate-50/50 border ${emailError ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-indigo-500'} rounded-2xl py-3 pl-11 pr-4 text-slate-950 text-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium`}
                placeholder="you@example.com"
              />
            </div>
            {emailError && (
              <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-semibold">
                <AlertCircle className="w-3.5 h-3.5" /> {emailError}
              </p>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Password</label>
              <button 
                type="button" 
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-500 transition-colors"
                onClick={() => {}}
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError('');
                }}
                className={`w-full bg-slate-50/50 border ${passwordError ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-indigo-500'} rounded-2xl py-3 pl-11 pr-10 text-slate-950 text-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium`}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwordError && (
              <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-semibold">
                <AlertCircle className="w-3.5 h-3.5" /> {passwordError}
              </p>
            )}
          </div>

          <Button 
            type="submit" 
            disabled={loading}
            className="w-full py-3.5 rounded-2xl justify-center text-sm font-semibold shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all mt-2"
          >
            {loading ? 'Logging In...' : 'Log In'}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-sm text-slate-500 font-medium">
            Don't have an account?{' '}
            <button 
              onClick={() => onNavigate('register')}
              className="text-indigo-600 hover:text-indigo-500 font-bold transition-colors"
            >
              Sign Up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
