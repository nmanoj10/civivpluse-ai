import React, { useState } from 'react';
import { Button } from '@/components/ui/shared';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, User, Mail, Lock, Phone, MapPin, 
  ShieldCheck, AlertCircle, Eye, EyeOff, Navigation, 
  Map, CheckCircle2, ChevronRight, Landmark 
} from 'lucide-react';

interface RegisterProps {
  onNavigate: (page: string) => void;
}

export default function Register({ onNavigate }: RegisterProps) {
  // Step state: 1 = Account Info, 2 = Address Info
  const [step, setStep] = useState(1);
  
  // Form fields state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('citizen');
  
  // Location details state
  const [street, setStreet] = useState('');
  const [locality, setLocality] = useState('');
  const [city, setCity] = useState('');
  const [ward, setWard] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Errors state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autofilling, setAutofilling] = useState(false);

  const validateStep1 = () => {
    const step1Errors: Record<string, string> = {};
    if (!name.trim()) step1Errors.name = 'Full name is required';
    
    if (!email) {
      step1Errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      step1Errors.email = 'Please enter a valid email address';
    }
    
    if (phone && !/^\+?[0-9\s-]{10,15}$/.test(phone)) {
      step1Errors.phone = 'Please enter a valid phone number (10-15 digits)';
    }

    if (!password) {
      step1Errors.password = 'Password is required';
    } else if (password.length < 6) {
      step1Errors.password = 'Password must be at least 6 characters';
    }

    if (password !== confirmPassword) {
      step1Errors.confirmPassword = 'Passwords do not match';
    }

    setErrors(step1Errors);
    return Object.keys(step1Errors).length === 0;
  };

  const validateStep2 = () => {
    const step2Errors: Record<string, string> = {};
    if (!street.trim()) step2Errors.street = 'Street / Area is required';
    if (!locality.trim()) step2Errors.locality = 'Locality is required';
    if (!city.trim()) step2Errors.city = 'City / Town is required';
    if (!ward.trim()) step2Errors.ward = 'Ward / Zone is required';
    if (!state.trim()) step2Errors.state = 'State is required';
    
    if (!pincode) {
      step2Errors.pincode = 'Pincode is required';
    } else if (!/^[0-9]{5,6}$/.test(pincode)) {
      step2Errors.pincode = 'Pincode must be 5 or 6 digits';
    }

    setErrors(step2Errors);
    return Object.keys(step2Errors).length === 0;
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleUseCurrentLocation = () => {
    setAutofilling(true);
    // Clear any previous location-specific errors/success messages
    setErrors(prev => {
      const copy = { ...prev };
      delete copy.location;
      delete copy.locationSuccess;
      return copy;
    });

    if (!navigator.geolocation) {
      setErrors(prev => ({ ...prev, location: 'Geolocation is not supported by your browser.' }));
      setAutofilling(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        setLat(latitude);
        setLng(longitude);

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=en`,
            {
              headers: {
                'Accept-Language': 'en',
                'User-Agent': 'CivicPulse-AI-App'
              }
            }
          );

          if (!response.ok) {
            throw new Error('Reverse geocoding request failed.');
          }

          const data = await response.json();
          if (data && data.address) {
            const addr = data.address;

            // Street fallback chain
            const streetName = addr.road || addr.pedestrian || addr.highway || addr.footway || '';
            const houseNumber = addr.house_number || '';
            const combinedStreet = houseNumber && streetName 
              ? `${houseNumber} ${streetName}` 
              : streetName || houseNumber || '';
            setStreet(combinedStreet || 'Detected Street');

            // Locality fallback chain
            const combinedLocality = addr.suburb || addr.neighbourhood || addr.city_district || addr.subdistrict || addr.village || addr.town || '';
            setLocality(combinedLocality || 'Detected Locality');

            // City fallback chain
            const combinedCity = addr.city || addr.town || addr.municipality || addr.village || addr.county || '';
            setCity(combinedCity || 'Detected City');

            // Ward fallback chain
            const combinedWard = addr.suburb || addr.county || addr.city_district || '';
            setWard(combinedWard || 'Ward 1');

            // State fallback chain
            const combinedState = addr.state || addr.region || addr.state_district || '';
            setState(combinedState || 'Detected State');

            // Pincode fallback
            setPincode(addr.postcode || '');

            // Success message
            setErrors(prev => ({ 
              ...prev, 
              locationSuccess: 'Location detected and address filled. Please review before submitting.' 
            }));
          } else {
            throw new Error('No address information returned from coordinates.');
          }
        } catch (err: any) {
          console.error(err);
          setErrors(prev => ({ 
            ...prev, 
            location: 'Couldn\'t fetch address from your current location. Please enter manually.' 
          }));
        } finally {
          setAutofilling(false);
        }
      },
      (geoError) => {
        let msg = 'Could not retrieve your location.';
        if (geoError.code === geoError.PERMISSION_DENIED) {
          msg = 'Location permission denied. Please fill address manually.';
        } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
          msg = 'Location information is unavailable.';
        } else if (geoError.code === geoError.TIMEOUT) {
          msg = 'Location request timed out.';
        }
        setErrors(prev => ({ ...prev, location: msg }));
        setAutofilling(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!validateStep2()) return;
    
    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          password,
          phone: phone || undefined,
          role,
          city,
          ward,
          locality,
          street,
          state,
          pincode,
          lat,
          lng
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed.');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-12 text-slate-900 text-center font-sans relative overflow-hidden">
        {/* Background Ambient Blobs */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] right-[-5%] w-[800px] h-[800px] bg-indigo-200/30 rounded-full blur-[120px] mix-blend-multiply animate-pulse" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-blue-200/30 rounded-full blur-[120px] mix-blend-multiply animate-pulse" />
        </div>

        <div className="max-w-md w-full bg-white/85 border border-slate-200/80 backdrop-blur-md rounded-3xl p-8 shadow-2xl relative z-10">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md border border-emerald-200">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-display font-extrabold mb-4 tracking-tight text-slate-900">Registration Successful!</h2>
          <p className="text-slate-500 mb-8 font-medium">Your account has been created. You can now log in using your credentials.</p>
          <Button onClick={() => onNavigate('login')} className="w-full py-3.5 rounded-2xl justify-center text-sm font-semibold shadow-lg shadow-indigo-600/10">
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-12 relative overflow-hidden text-slate-900 font-sans">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[800px] h-[800px] bg-indigo-200/30 rounded-full blur-[120px] mix-blend-multiply animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-blue-200/30 rounded-full blur-[120px] mix-blend-multiply animate-pulse" />
      </div>

      <div className="max-w-xl w-full relative z-10 bg-white/85 border border-slate-200/80 backdrop-blur-md rounded-3xl p-8 shadow-2xl transition-all duration-300 hover:shadow-indigo-100/50">
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={step === 2 ? handleBack : () => onNavigate('landing')}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition-colors group font-semibold"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            {step === 2 ? 'Back to Step 1' : 'Back to Home'}
          </button>
          
          <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => onNavigate('landing')}>
            <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-indigo-900">CivicPulse<span className="text-indigo-600">AI</span></span>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6 bg-slate-100/60 p-2 rounded-2xl border border-slate-200/30">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${step === 1 ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[10px] text-indigo-600">1</span>
            Account Setup
          </div>
          <div className="h-px bg-slate-200 flex-1 mx-2" />
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${step === 2 ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-[10px] text-slate-400">2</span>
            Address Details
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-3xl font-display font-extrabold tracking-tight text-slate-900 mb-2">
            {step === 1 ? 'Create Account' : 'Where do you reside?'}
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            {step === 1 
              ? 'Join the CivicPulse AI community to start reporting and verifying issues.' 
              : 'Entering accurate location details helps us route issues to the correct local authorities.'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.form 
              key="step1"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleNext} 
              className="space-y-4"
            >
              {/* Name and Email */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (errors.name) setErrors({...errors, name: ''});
                      }}
                      className={`w-full bg-slate-50/50 border ${errors.name ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-indigo-500'} rounded-2xl py-3 pl-11 pr-4 text-slate-950 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium`}
                      placeholder="John Doe"
                    />
                  </div>
                  {errors.name && <span className="text-xs text-red-600 mt-1 flex items-center gap-1 font-semibold"><AlertCircle className="w-3 h-3" />{errors.name}</span>}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) setErrors({...errors, email: ''});
                      }}
                      className={`w-full bg-slate-50/50 border ${errors.email ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-indigo-500'} rounded-2xl py-3 pl-11 pr-4 text-slate-950 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium`}
                      placeholder="you@example.com"
                    />
                  </div>
                  {errors.email && <span className="text-xs text-red-600 mt-1 flex items-center gap-1 font-semibold"><AlertCircle className="w-3 h-3" />{errors.email}</span>}
                </div>
              </div>

              {/* Phone and Role Tabs */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="tel" 
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (errors.phone) setErrors({...errors, phone: ''});
                      }}
                      className={`w-full bg-slate-50/50 border ${errors.phone ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-indigo-500'} rounded-2xl py-3 pl-11 pr-4 text-slate-950 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium`}
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  {errors.phone && <span className="text-xs text-red-600 mt-1 flex items-center gap-1 font-semibold"><AlertCircle className="w-3 h-3" />{errors.phone}</span>}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Registering As</label>
                  <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50">
                    <button
                      type="button"
                      onClick={() => setRole('citizen')}
                      className={`flex-1 text-[11px] font-bold py-2.5 rounded-xl uppercase tracking-wider transition-all ${role === 'citizen' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      Citizen
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('volunteer')}
                      className={`flex-1 text-[11px] font-bold py-2.5 rounded-xl uppercase tracking-wider transition-all ${role === 'volunteer' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      Volunteer
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('ward_officer')}
                      className={`flex-1 text-[11px] font-bold py-2.5 rounded-xl uppercase tracking-wider transition-all ${role === 'ward_officer' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      Officer
                    </button>
                  </div>
                </div>
              </div>

              {/* Password and Confirm Password */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type={showPassword ? "text" : "password"} 
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password) setErrors({...errors, password: ''});
                      }}
                      className={`w-full bg-slate-50/50 border ${errors.password ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-indigo-500'} rounded-2xl py-3 pl-11 pr-10 text-slate-950 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium`}
                      placeholder="•••••••• (6+ chars)"
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <span className="text-xs text-red-600 mt-1 flex items-center gap-1 font-semibold"><AlertCircle className="w-3 h-3" />{errors.password}</span>}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type={showConfirmPassword ? "text" : "password"} 
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errors.confirmPassword) setErrors({...errors, confirmPassword: ''});
                      }}
                      className={`w-full bg-slate-50/50 border ${errors.confirmPassword ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-indigo-500'} rounded-2xl py-3 pl-11 pr-10 text-slate-950 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <span className="text-xs text-red-600 mt-1 flex items-center gap-1 font-semibold"><AlertCircle className="w-3 h-3" />{errors.confirmPassword}</span>}
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full py-3.5 rounded-2xl justify-center text-sm font-semibold shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all mt-4 group"
              >
                Next Details
                <ChevronRight className="w-4 h-4 ml-1.5 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </motion.form>
          ) : (
            <motion.form 
              key="step2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSubmit} 
              className="space-y-4"
            >
              {/* Geolocation autofill option */}
              <div className="bg-slate-50 border border-slate-200/60 p-3.5 rounded-2xl space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                      <Navigation className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Locality Autofill</h4>
                      <p className="text-[10px] text-slate-500 font-medium">Detect address using browser GPS coordinates</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={autofilling}
                    onClick={handleUseCurrentLocation}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all hover:shadow hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    {autofilling ? 'Detecting...' : 'Get Location'}
                  </button>
                </div>
                {errors.location && (
                  <p className="text-xs text-red-600 flex items-center gap-1 font-semibold pt-2 border-t border-slate-200/30">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errors.location}
                  </p>
                )}
                {errors.locationSuccess && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1 font-semibold pt-2 border-t border-slate-200/30">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {errors.locationSuccess}
                  </p>
                )}
              </div>

              {/* Street & Locality */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Street / House No.</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      value={street}
                      onChange={(e) => {
                        setStreet(e.target.value);
                        if (errors.street) setErrors({...errors, street: ''});
                      }}
                      className={`w-full bg-slate-50/50 border ${errors.street ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-indigo-500'} rounded-2xl py-3 pl-11 pr-4 text-slate-950 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium`}
                      placeholder="e.g. 123 Main St"
                    />
                  </div>
                  {errors.street && <span className="text-xs text-red-600 mt-1 flex items-center gap-1 font-semibold"><AlertCircle className="w-3 h-3" />{errors.street}</span>}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Locality / Area</label>
                  <div className="relative">
                    <Map className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      value={locality}
                      onChange={(e) => {
                        setLocality(e.target.value);
                        if (errors.locality) setErrors({...errors, locality: ''});
                      }}
                      className={`w-full bg-slate-50/50 border ${errors.locality ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-indigo-500'} rounded-2xl py-3 pl-11 pr-4 text-slate-950 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium`}
                      placeholder="e.g. Downtown"
                    />
                  </div>
                  {errors.locality && <span className="text-xs text-red-600 mt-1 flex items-center gap-1 font-semibold"><AlertCircle className="w-3 h-3" />{errors.locality}</span>}
                </div>
              </div>

              {/* City & Ward */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">City / Town</label>
                  <div className="relative">
                    <Landmark className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        if (errors.city) setErrors({...errors, city: ''});
                      }}
                      className={`w-full bg-slate-50/50 border ${errors.city ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-indigo-500'} rounded-2xl py-3 pl-11 pr-4 text-slate-950 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium`}
                      placeholder="e.g. Metropolis"
                    />
                  </div>
                  {errors.city && <span className="text-xs text-red-600 mt-1 flex items-center gap-1 font-semibold"><AlertCircle className="w-3 h-3" />{errors.city}</span>}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Ward / Zone (free text)</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      value={ward}
                      onChange={(e) => {
                        setWard(e.target.value);
                        if (errors.ward) setErrors({...errors, ward: ''});
                      }}
                      className={`w-full bg-slate-50/50 border ${errors.ward ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-indigo-500'} rounded-2xl py-3 pl-11 pr-4 text-slate-950 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium`}
                      placeholder="e.g. Ward 1"
                    />
                  </div>
                  {errors.ward && <span className="text-xs text-red-600 mt-1 flex items-center gap-1 font-semibold"><AlertCircle className="w-3 h-3" />{errors.ward}</span>}
                </div>
              </div>

              {/* State & Pincode */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">State</label>
                  <div className="relative">
                    <Map className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      value={state}
                      onChange={(e) => {
                        setState(e.target.value);
                        if (errors.state) setErrors({...errors, state: ''});
                      }}
                      className={`w-full bg-slate-50/50 border ${errors.state ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-indigo-500'} rounded-2xl py-3 pl-11 pr-4 text-slate-950 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium`}
                      placeholder="e.g. NY"
                    />
                  </div>
                  {errors.state && <span className="text-xs text-red-600 mt-1 flex items-center gap-1 font-semibold"><AlertCircle className="w-3 h-3" />{errors.state}</span>}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Pincode / Postal Code</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      value={pincode}
                      onChange={(e) => {
                        setPincode(e.target.value);
                        if (errors.pincode) setErrors({...errors, pincode: ''});
                      }}
                      className={`w-full bg-slate-50/50 border ${errors.pincode ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-indigo-500'} rounded-2xl py-3 pl-11 pr-4 text-slate-950 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium`}
                      placeholder="e.g. 10001"
                    />
                  </div>
                  {errors.pincode && <span className="text-xs text-red-600 mt-1 flex items-center gap-1 font-semibold"><AlertCircle className="w-3 h-3" />{errors.pincode}</span>}
                </div>
              </div>

              <div className="flex gap-4 pt-2">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1 py-3.5 rounded-2xl justify-center text-sm font-semibold border-slate-200 text-slate-700 bg-white"
                >
                  Back
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="flex-1 py-3.5 rounded-2xl justify-center text-sm font-semibold shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all"
                >
                  {loading ? 'Creating...' : 'Register'}
                </Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-sm text-slate-500 font-medium">
            Already have an account?{' '}
            <button 
              onClick={() => onNavigate('login')}
              className="text-indigo-600 hover:text-indigo-500 font-bold transition-colors"
            >
              Log In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
