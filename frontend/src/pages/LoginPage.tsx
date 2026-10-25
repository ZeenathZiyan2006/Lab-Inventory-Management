import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import {
  LogIn,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User as UserIcon,
  Package,
  QrCode,
  BarChart3,
  MapPin,
  FlaskConical,
  Wrench,
  UserCheck,
  Award,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  UserPlus,
  CheckCircle2,
} from 'lucide-react';

/**
 * Elegant Line-Art Lotus Motif
 * Symmetrical academic emblem representing knowledge, purity, and excellence.
 */
const LotusMotif: React.FC<{ className?: string }> = ({ className = 'w-10 h-8 text-amber-400' }) => (
  <svg
    viewBox="0 0 100 70"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {/* Center upright petal */}
    <path d="M50 8 C44 26 44 48 50 62 C56 48 56 26 50 8 Z" />
    {/* Inner left petal */}
    <path d="M50 62 C34 50 28 32 36 16 C42 32 46 48 50 62 Z" />
    {/* Inner right petal */}
    <path d="M50 62 C66 50 72 32 64 16 C58 32 54 48 50 62 Z" />
    {/* Outer left petal */}
    <path d="M50 62 C26 58 14 42 18 28 C28 42 40 54 50 62 Z" />
    {/* Outer right petal */}
    <path d="M50 62 C74 58 86 42 82 28 C72 42 60 54 50 62 Z" />
    {/* Calyx base support curves */}
    <path d="M22 62 C36 67 64 67 78 62" strokeWidth="1.2" />
    <path d="M30 65 C42 69 58 69 70 65" strokeWidth="1" />
  </svg>
);

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'LAB_INSTRUCTOR' | 'TECHNICIAN'>('LAB_INSTRUCTOR');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [demoOpen, setDemoOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const scanParam = new URLSearchParams(window.location.search).get('scan') ||
                    new URLSearchParams(window.location.search).get('asset') ||
                    new URLSearchParams(window.location.search).get('token') ||
                    new URLSearchParams(window.location.search).get('tag');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const trimmedFullName = fullName.trim();
    if (!trimmedFullName) {
      setError('Please enter your full name.');
      return;
    }
    if (trimmedFullName.length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your institutional email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const data = await apiRequest<{
        access_token: string;
        token_type: string;
        role: any;
        email: string;
        full_name: string;
        id?: number;
        department_id?: number;
        assigned_labs: number[];
      }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          full_name: trimmedFullName,
          email: email.trim().toLowerCase(),
          password,
          confirm_password: confirmPassword,
          role,
        }),
      });

      // Successful registration: immediately establish authenticated session with database record
      login(data.access_token, {
        id: data.id || 0,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        department_id: data.department_id,
        assigned_labs: data.assigned_labs,
      });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const trimmedFullName = fullName.trim();
    if (!trimmedFullName) {
      setError('Please enter your full name.');
      return;
    }

    setLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append('username', email.trim());
      formData.append('password', password);

      const data = await apiRequest<{
        access_token: string;
        token_type: string;
        role: any;
        email: string;
        full_name: string;
        id?: number;
        department_id?: number;
        assigned_labs: number[];
      }>('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      // Compare entered name with registered name ignoring case and extra whitespace
      const registeredName = (data.full_name || '').trim().toLowerCase();
      const enteredName = trimmedFullName.toLowerCase();

      if (registeredName && enteredName !== registeredName) {
        setError('The entered full name does not match this account.');
        return;
      }

      // Successful verification: use the authenticated user's genuine database record
      login(data.access_token, {
        id: data.id || 0,
        email: data.email,
        full_name: data.full_name || trimmedFullName,
        role: data.role,
        department_id: data.department_id,
        assigned_labs: data.assigned_labs,
      });
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const setDemoUser = (demoName: string, demoEmail: string, demoPass: string) => {
    setFullName(demoName);
    setEmail(demoEmail);
    setPassword(demoPass);
    setConfirmPassword(demoPass);
    setError(null);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 lg:p-8 select-none overflow-x-hidden">
      {/* 1. Full-screen Genuine SMVITM Aerial Campus Photograph Background */}
      <div
        className="fixed inset-0 bg-cover bg-center z-0 scale-100"
        style={{ backgroundImage: `url('/images/smvitm-campus.jfif')` }}
      >
        {/* Subtle Dark Navy / Vignette Overlay preserving lush greenery & buildings */}
        <div className="absolute inset-0 bg-[#071324]/65 backdrop-blur-[1px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050C16]/80 via-transparent to-[#050C16]/70" />
      </div>

      {/* 2. Top-Right Institutional Creed (Outside Central Card) */}
      <div className="absolute top-5 right-6 z-10 hidden sm:flex flex-col items-end">
        <div className="text-white/90 text-sm tracking-wide font-serif italic">
          <span>Technology</span>
          <span className="mx-2 text-white/40">|</span>
          <span>Innovation</span>
          <span className="mx-2 text-white/40">|</span>
          <span className="text-white font-medium">Excellence</span>
        </div>
        <div className="w-16 h-0.5 bg-[#F2B544] mt-1 rounded-full shadow-sm" />
      </div>

      {/* 3. Bottom-Left Campus Location Pill (Outside Central Card) */}
      <div className="absolute bottom-5 left-6 z-10 hidden sm:flex items-center space-x-2 bg-[#0B192C]/70 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15 text-white/90 text-xs shadow-lg">
        <MapPin className="h-3.5 w-3.5 text-[#F2B544]" />
        <span className="font-medium tracking-wide">SMVITM Campus, Bantakal, Udupi, Karnataka</span>
      </div>

      {/* 4. Main Split-Screen Login Card */}
      <div className="relative z-10 max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/20 my-auto">
        
        {/* ================= LEFT PANEL: DARK NAVY BRANDING ================= */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#0B192C] via-[#0E2238] to-[#071322] p-7 sm:p-9 text-white flex flex-col justify-between relative overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-700/40">
          
          {/* Subtle Ambient Background Glow */}
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-[#1E3E62]/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-[#F2B544]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            {/* Top Logo & College Name Layout */}
            <div className="flex items-center">
              {/* Circular White Badge with Genuine SMVITM Logo */}
              <div className="w-[72px] h-[72px] rounded-full bg-white p-1.5 shadow-md flex items-center justify-center flex-shrink-0 border border-slate-100">
                <img
                  src="/images/smvitm-logo.jfif"
                  alt="SMVITM Crest"
                  className="w-full h-full object-contain rounded-full"
                />
              </div>

              {/* Vertical Divider Line */}
              <div className="w-[1.5px] h-14 bg-white/20 mx-4 flex-shrink-0" />

              {/* College Identity & Location */}
              <div className="flex flex-col justify-center">
                <h1 className="text-sm font-bold text-white leading-[1.25] tracking-tight">
                  Shri Madhwa Vadiraja<br />
                  Institute of Technology<br />
                  and Management
                </h1>
                <span className="text-[11px] text-slate-300 font-normal mt-0.5">
                  Bantakal, Udupi, Karnataka
                </span>
              </div>
            </div>

            {/* Department Outlined Pill */}
            <div className="mt-6 inline-flex items-center px-3.5 py-1.5 rounded-full border border-[#F2B544]/60 bg-[#F2B544]/10 text-[#F2B544] text-[11px] font-semibold tracking-wide shadow-sm">
              Department of Artificial Intelligence and Data Science
            </div>

            {/* Project Heading & Amber Emphasis */}
            <div className="mt-8">
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white leading-tight">
                Inventory
                <span className="block text-[#F2B544] mt-0.5">Management System</span>
              </h2>
              <p className="mt-2.5 text-xs text-slate-300/90 leading-relaxed max-w-xs">
                AI-Powered Smart Inventory Management System for College Laboratories
              </p>
            </div>

            {/* Three Feature Groups with Gold Icons */}
            <div className="grid grid-cols-3 gap-2 text-center mt-8 pt-6 border-t border-white/10">
              <div className="flex flex-col items-center group">
                <div className="p-2 rounded-xl bg-white/5 border border-white/10 mb-2">
                  <Package className="h-5 w-5 text-[#F2B544]" />
                </div>
                <span className="text-[11px] font-medium text-white/90 leading-tight">
                  Asset<br />Tracking
                </span>
              </div>

              <div className="flex flex-col items-center group">
                <div className="p-2 rounded-xl bg-white/5 border border-white/10 mb-2">
                  <QrCode className="h-5 w-5 text-[#F2B544]" />
                </div>
                <span className="text-[11px] font-medium text-white/90 leading-tight">
                  QR<br />Identification
                </span>
              </div>

              <div className="flex flex-col items-center group">
                <div className="p-2 rounded-xl bg-white/5 border border-white/10 mb-2">
                  <BarChart3 className="h-5 w-5 text-[#F2B544]" />
                </div>
                <span className="text-[11px] font-medium text-white/90 leading-tight">
                  Smart<br />Analytics
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Lotus Motif & Tagline */}
          <div className="relative z-10 mt-8 pt-6 border-t border-white/10 flex items-center space-x-3.5">
            <LotusMotif className="w-12 h-10 text-[#F2B544]/80 flex-shrink-0" />
            <p className="text-[11px] italic font-serif text-slate-300 leading-tight">
              Empowering Laboratories<br />
              <span className="text-white/80">for a Smarter Tomorrow</span>
            </p>
          </div>
        </div>

        {/* ================= RIGHT PANEL: WHITE / WARM IVORY LOGIN FORM ================= */}
        <div className="lg:col-span-7 bg-[#FFFFFF] p-6 sm:p-8 lg:p-9 flex flex-col justify-between relative">
          
          {/* Subtle Lotus Watermark in Top-Right Corner */}
          <LotusMotif className="absolute top-3 right-3 w-28 h-20 text-slate-200/50 pointer-events-none" />

          <div>
            {/* Header: Gold Bar & Title with Toggle Tabs */}
            <div className="mb-4">
              <div className="w-10 h-1 bg-[#F2B544] rounded-full mb-2.5" />
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#0B192C] tracking-tight">
                    {mode === 'login' ? 'Welcome Back' : 'Create Account'}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
                    {mode === 'login'
                      ? 'Sign in to access your laboratory inventory portal.'
                      : 'Register your staff profile with your institutional email.'}
                  </p>
                </div>
              </div>

              {/* Mode Toggle Switch with High-Contrast Active Indicator */}
              <div className="mt-3.5 flex p-1 bg-slate-200/90 rounded-xl max-w-xs border border-slate-300 shadow-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition duration-150 ${
                    mode === 'login'
                      ? 'bg-[#800B35] text-white shadow-sm'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition duration-150 ${
                    mode === 'register'
                      ? 'bg-[#800B35] text-white shadow-sm'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Register
                </button>
              </div>
            </div>

            {/* Scanned QR Code Alert */}
            {scanParam && (
              <div className="mb-3.5 p-3 bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 text-cyan-950 rounded-2xl text-xs flex items-center justify-between shadow-sm">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 bg-cyan-600 text-white rounded-lg">
                    <QrCode className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">Scanned Item Detected</div>
                    <div className="text-cyan-700 font-mono text-[11px] font-semibold">{scanParam}</div>
                  </div>
                </div>
                <span className="text-[10px] bg-cyan-600 text-white font-semibold px-2 py-0.5 rounded-full">
                  Sign In to Open
                </span>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="mb-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 animate-fadeIn">
                <div className="flex items-center space-x-2.5">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-600" />
                  <span className="font-medium">{error}</span>
                </div>
                {mode === 'login' && error.toLowerCase().includes('register') && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError(null);
                    }}
                    className="self-start sm:self-auto px-3 py-1 bg-[#800B35] hover:bg-[#68092B] text-white rounded-lg text-xs font-semibold transition shadow-xs whitespace-nowrap"
                  >
                    Go to Register &rarr;
                  </button>
                )}
              </div>
            )}

            {/* Success Banner */}
            {successMessage && (
              <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center space-x-2.5 animate-fadeIn">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                <span className="font-medium">{successMessage}</span>
              </div>
            )}

            {/* ================= MODE: LOGIN FORM ================= */}
            {mode === 'login' ? (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {/* 1. Full Name Field (Required consistency check) */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Full Name <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative rounded-xl border border-slate-300 bg-slate-50/90 focus-within:border-[#800B35] focus-within:ring-2 focus-within:ring-[#800B35]/20 focus-within:bg-white transition shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <UserIcon className="h-4 w-4 text-slate-500" />
                    </div>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your registered full name"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none rounded-xl font-medium"
                    />
                  </div>
                </div>

                {/* 2. Institutional Email Address */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Institutional Email Address <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative rounded-xl border border-slate-300 bg-slate-50/90 focus-within:border-[#800B35] focus-within:ring-2 focus-within:ring-[#800B35]/20 focus-within:bg-white transition shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-slate-500" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your institutional email"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none rounded-xl font-mono text-xs"
                    />
                  </div>
                </div>

                {/* 3. Password Field with Show/Hide Toggle */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Password <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative rounded-xl border border-slate-300 bg-slate-50/90 focus-within:border-[#800B35] focus-within:ring-2 focus-within:ring-[#800B35]/20 focus-within:bg-white transition shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-slate-500" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-10 py-2.5 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-800 transition focus:outline-none"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* 4. Primary Sign In Button: Authentic SMVITM Crimson with Aesthetic Gradient */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-3 bg-gradient-to-r from-[#800B35] to-[#9E1245] hover:from-[#660829] hover:to-[#800B35] text-white font-bold py-3 px-4 rounded-xl text-sm transition duration-200 shadow-md shadow-[#800B35]/25 flex items-center justify-center space-x-2 disabled:opacity-60 active:scale-[0.99]"
                >
                  <LogIn className="h-4 w-4" />
                  <span>{loading ? 'Authenticating...' : 'Sign In to Portal'}</span>
                </button>
              </form>
            ) : (
              /* ================= MODE: REGISTRATION FORM ================= */
              <form onSubmit={handleRegister} className="space-y-3">
                {/* 1. Full Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Full Name <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative rounded-xl border border-slate-300 bg-slate-50/90 focus-within:border-[#800B35] focus-within:ring-2 focus-within:ring-[#800B35]/20 focus-within:bg-white transition shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <UserIcon className="h-4 w-4 text-slate-500" />
                    </div>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Monisha Devadiga"
                      className="w-full pl-10 pr-3.5 py-2 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none rounded-xl font-medium"
                    />
                  </div>
                </div>

                {/* 2. Institutional Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Institutional Email Address <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative rounded-xl border border-slate-300 bg-slate-50/90 focus-within:border-[#800B35] focus-within:ring-2 focus-within:ring-[#800B35]/20 focus-within:bg-white transition shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-slate-500" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. monisha@sode-edu.in"
                      className="w-full pl-10 pr-3.5 py-2 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none rounded-xl font-mono text-xs"
                    />
                  </div>
                </div>

                {/* 3. Password & Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Password <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative rounded-xl border border-slate-300 bg-slate-50/90 focus-within:border-[#800B35] focus-within:ring-2 focus-within:ring-[#800B35]/20 focus-within:bg-white transition shadow-xs">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 6 characters"
                        className="w-full px-3 py-2 bg-transparent text-xs text-slate-900 placeholder-slate-400 outline-none rounded-xl"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Confirm Password <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative rounded-xl border border-slate-300 bg-slate-50/90 focus-within:border-[#800B35] focus-within:ring-2 focus-within:ring-[#800B35]/20 focus-within:bg-white transition shadow-xs">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full px-3 py-2 bg-transparent text-xs text-slate-900 placeholder-slate-400 outline-none rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Role Selection (Safe defaults for academic staff) */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Requested Staff Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50/90 border border-slate-300 text-xs text-slate-900 font-semibold rounded-xl outline-none focus:border-[#800B35] focus:ring-2 focus:ring-[#800B35]/20 shadow-xs"
                  >
                    <option value="LAB_INSTRUCTOR">Lab Instructor (Academic Staff)</option>
                    <option value="TECHNICIAN">Technician / Technical Staff</option>
                  </select>
                  <p className="text-[10px] text-slate-500 font-medium mt-1">
                    * Executive roles (HOD, Principal, Administrator) are granted exclusively by the Administrator.
                  </p>
                </div>

                {/* 5. Primary Register Button with Aesthetic Gradient */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2.5 bg-gradient-to-r from-[#800B35] to-[#9E1245] hover:from-[#660829] hover:to-[#800B35] text-white font-bold py-3 px-4 rounded-xl text-sm transition duration-200 shadow-md shadow-[#800B35]/25 flex items-center justify-center space-x-2 disabled:opacity-60 active:scale-[0.99]"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>{loading ? 'Registering Account...' : 'Create Staff Account'}</span>
                </button>
              </form>
            )}

            {/* 5. OR Divider */}
            <div className="relative my-3 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <span className="relative bg-white px-3 text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
                OR
              </span>
            </div>

            {/* 6. Development Test Accounts (Development Fixture Only) */}
            {import.meta.env.DEV && (
              <div className="rounded-2xl bg-[#F8FAFC] border border-slate-200/90 p-2 shadow-inner">
                <button
                  type="button"
                  onClick={() => setDemoOpen(!demoOpen)}
                  className="w-full flex items-center justify-between text-left focus:outline-none"
                >
                  <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700">
                    <FlaskConical className="h-3.5 w-3.5 text-slate-500" />
                    <span>Development Test Accounts</span>
                  </div>
                  {demoOpen ? (
                    <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  )}
                </button>

                {demoOpen && (
                  <div className="mt-2 pt-2 border-t border-slate-200/60">
                    <p className="text-[10px] text-slate-400 mb-1.5">
                      Test accounts for local environment testing. Staff identities and roles are managed dynamically in the database.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDemoUser('Lab Instructor', 'instructor@sode-edu.in', 'Instructor@123')}
                        className="px-2 py-1 bg-[#E0F2FE] hover:bg-[#BAE6FD] text-[#0369A1] border border-[#BAE6FD] rounded-lg text-[11px] font-semibold flex items-center space-x-1.5 transition text-left"
                      >
                        <FlaskConical className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">Instructor Test</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDemoUser('Technician', 'technician@sode-edu.in', 'Tech@123')}
                        className="px-2 py-1 bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#B45309] border border-[#FDE68A] rounded-lg text-[11px] font-semibold flex items-center space-x-1.5 transition text-left"
                      >
                        <Wrench className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">Technician Test</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDemoUser('HOD', 'hod.aids@sode-edu.in', 'Hod@123')}
                        className="px-2 py-1 bg-[#DCFCE7] hover:bg-[#BBF7D0] text-[#15803D] border border-[#BBF7D0] rounded-lg text-[11px] font-semibold flex items-center space-x-1.5 transition text-left"
                      >
                        <UserCheck className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">HOD Test</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDemoUser('Principal', 'principal@sode-edu.in', 'Principal@123')}
                        className="px-2 py-1 bg-[#FFE4E6] hover:bg-[#FECDD3] text-[#9F1239] border border-[#FECDD3] rounded-lg text-[11px] font-semibold flex items-center space-x-1.5 transition text-left"
                      >
                        <Award className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">Principal Test</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDemoUser('Administrator', 'admin@sode-edu.in', 'Admin@123')}
                        className="px-2 py-1 bg-[#F3E8FF] hover:bg-[#E9D5FF] text-[#6B21A8] border border-[#E9D5FF] rounded-lg text-[11px] font-semibold flex items-center space-x-1.5 transition text-left col-span-2 sm:col-span-1"
                      >
                        <KeyRound className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">Admin Test</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 7. Card Footer: Security & Role Compliance */}
          <div className="mt-4 pt-2 flex items-center justify-center space-x-1.5 text-[11px] text-slate-400 font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
            <span>Secure • Role-Based Access • SMVITM</span>
          </div>

        </div>

      </div>
    </div>
  );
};
