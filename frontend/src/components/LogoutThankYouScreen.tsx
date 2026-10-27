import React, { useState, useEffect, useRef } from 'react';
import { LogOut, Clock, X, Laptop, Code, Calendar, ShieldCheck, ArrowRight } from 'lucide-react';

interface LogoutThankYouScreenProps {
  onGoToLogin: () => void;
  countdownSeconds?: number;
}

export const LogoutThankYouScreen: React.FC<LogoutThankYouScreenProps> = ({
  onGoToLogin,
  countdownSeconds = 20
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(countdownSeconds);
  const [isWaving, setIsWaving] = useState<boolean>(true);
  const [blushActive, setBlushActive] = useState<boolean>(true);
  const [hasNavigated, setHasNavigated] = useState<boolean>(false);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<any>(null);

  // Safe navigation guard to guarantee exactly one redirect
  const handleNavigate = () => {
    if (hasNavigated) return;
    setHasNavigated(true);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    onGoToLogin();
  };

  // 60-second precise countdown using timestamp delta to avoid browser drift
  useEffect(() => {
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const remaining = Math.max(0, countdownSeconds - elapsedSeconds);
      setSecondsLeft(remaining);

      if (remaining <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        handleNavigate();
      }
    }, 250);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [countdownSeconds]);

  // Keyboard shortcut: Escape or Enter immediately proceeds to login
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        handleNavigate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Periodic waving cycles every few seconds
  useEffect(() => {
    const waveInterval = setInterval(() => {
      setIsWaving(true);
      setTimeout(() => setIsWaving(false), 2400);
    }, 4500);

    return () => clearInterval(waveInterval);
  }, []);

  // Soft facial blush gentle breathing pulse
  useEffect(() => {
    const blushInterval = setInterval(() => {
      setBlushActive(prev => !prev);
    }, 2000);

    return () => clearInterval(blushInterval);
  }, []);

  const progressPercent = Math.max(0, Math.min(100, (secondsLeft / countdownSeconds) * 100));

  return (
    <div className="min-h-screen w-full bg-[#030712] text-white flex items-center justify-center p-3 sm:p-6 relative overflow-hidden font-sans select-none">
      
      {/* Subtle cosmic background glow effects matching SMVITM Neon theme */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/3 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Cyber Grid Pattern Overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(0, 240, 255, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 240, 255, 0.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      {/* Main Glassmorphism Logout Card */}
      <div className="relative z-10 w-full max-w-5xl rounded-3xl bg-[#050C1D]/90 border-2 border-cyan-400/40 shadow-[0_20px_70px_rgba(0,0,0,0.9),inset_0_0_20px_rgba(0,240,255,0.06)] overflow-hidden backdrop-blur-2xl flex flex-col my-auto max-h-[96vh]">
        
        {/* Top Specular Neon Highlight Edge */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_12px_#00F0FF]" />

        {/* Top Close Button (✕) */}
        <button
          onClick={handleNavigate}
          className="absolute top-4 right-4 z-30 p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition active:scale-95"
          title="Go to Login (Esc)"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Card Content: 2-Column Responsive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 items-center min-h-0 overflow-y-auto">
          
          {/* ========================================================================= */}
          {/* LEFT COLUMN: THE AI & DS COMPUTER LAB ROBOT ILLUSTRATION                  */}
          {/* ========================================================================= */}
          <div className="lg:col-span-6 p-4 sm:p-6 lg:p-8 flex items-center justify-center relative">
            <div className="relative group w-full max-w-[420px] aspect-square rounded-2xl overflow-hidden border border-cyan-500/30 bg-[#03091B]/80 shadow-[0_0_30px_rgba(0,240,255,0.15)] flex items-center justify-center">
              
              {/* Pristine authentic AI & DS Laboratory Robot Image */}
              <img
                src="/images/ai_ds_robot_logout_avatar.png"
                onError={(e) => {
                  // Fallback to full reference image if cropped asset has path issues
                  (e.target as HTMLImageElement).src = '/images/neon_robot_logout.png';
                }}
                alt="AI Robot Laboratory Mascot"
                className={`w-full h-full object-cover transition-transform duration-700 ease-out ${
                  isWaving ? 'scale-[1.01]' : 'scale-100'
                }`}
              />

              {/* Gentle Sinusoidal Floating Breathing Glow Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#050C1D]/60 via-transparent to-transparent pointer-events-none" />

              {/* Soft Facial Blush Warmth Pulse Effect */}
              <div
                className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${
                  blushActive ? 'opacity-30' : 'opacity-10'
                }`}
                style={{
                  background: 'radial-gradient(circle at 50% 48%, rgba(244, 63, 94, 0.25) 0%, transparent 40%)'
                }}
              />

              {/* Luminous Hand Wave Signal Arcs Accent */}
              {isWaving && (
                <div className="absolute top-[32%] right-[16%] pointer-events-none animate-pulse">
                  <svg className="w-12 h-12 text-cyan-300 drop-shadow-[0_0_8px_#00F0FF]" viewBox="0 0 50 50" fill="none">
                    <path d="M 25 15 A 15 15 0 0 1 40 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
                    <path d="M 28 20 A 10 10 0 0 1 38 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
                  </svg>
                </div>
              )}

              {/* Cyber Badge Pill: AI & Data Science Mascot */}
              <div className="absolute bottom-3 left-3 bg-[#03091A]/90 border border-cyan-400/40 px-3 py-1 rounded-full text-[10px] font-bold text-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.3)] flex items-center space-x-1.5 backdrop-blur-md">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                <span>SMVITM • AI & DS Lab Mascot</span>
              </div>

            </div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT COLUMN: THANK YOU MESSAGE, 60S COUNTDOWN & IMMEDIATE LOGIN ACTION   */}
          {/* ========================================================================= */}
          <div className="lg:col-span-6 p-6 sm:p-8 lg:p-10 flex flex-col justify-center space-y-5 text-left">
            
            {/* Circular Logout Icon Badge */}
            <div className="w-14 h-14 rounded-full border-2 border-cyan-400 p-[3px] flex items-center justify-center shadow-[0_0_16px_rgba(0,240,255,0.5)]">
              <div className="w-full h-full rounded-full border border-cyan-300/80 bg-cyan-950/80 flex items-center justify-center text-cyan-300">
                <LogOut className="h-6 w-6 drop-shadow-[0_0_6px_#00F0FF]" />
              </div>
            </div>

            {/* Main Thank You Title */}
            <div className="space-y-1">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-none">
                Thank <span className="text-cyan-400 drop-shadow-[0_0_16px_#00F0FF] relative inline-block">
                  You!
                  <span className="absolute -top-2 -right-4 text-cyan-300 text-xs sm:text-sm font-bold tracking-widest animate-pulse">
                    ﾐ✨
                  </span>
                </span>
              </h2>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight pt-1">
                for using our website!
              </div>
            </div>

            {/* Friendly Farewell Message */}
            <div className="space-y-1 text-slate-300 text-xs sm:text-sm leading-relaxed">
              <p className="font-medium text-slate-200">
                You’ve been logged out successfully.
              </p>
              <p className="font-semibold text-cyan-300">
                See you again soon!
              </p>
            </div>

            {/* Countdown Box & Progress Bar */}
            <div className="rounded-2xl p-4 bg-[#03091A]/90 border border-cyan-500/35 shadow-[0_0_15px_rgba(0,240,255,0.15)] space-y-2.5">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center space-x-2 text-slate-200 font-semibold">
                  <Clock className="h-4 w-4 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
                  <span>Redirecting to login page in</span>
                </div>
                <div className="text-base sm:text-lg font-black font-mono text-cyan-300 drop-shadow-[0_0_8px_#00F0FF]">
                  {secondsLeft}s
                </div>
              </div>

              {/* Animated Glowing Progress Bar */}
              <div className="w-full bg-[#020612] h-2 rounded-full overflow-hidden border border-cyan-500/25 p-[1px]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-300 shadow-[0_0_10px_#00F0FF] transition-all duration-300 ease-linear"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Immediate "Go to Login" Action Button */}
            <button
              onClick={handleNavigate}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-400 hover:from-cyan-400 hover:via-blue-500 hover:to-cyan-300 text-white font-extrabold text-sm sm:text-base flex items-center justify-center space-x-2.5 shadow-[0_0_25px_rgba(0,240,255,0.45)] transition active:scale-95 group border border-cyan-300/40"
              title="Return to login page immediately"
            >
              <span>Go to Login</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>

          </div>

        </div>

        {/* ========================================================================= */}
        {/* BOTTOM FOOTER BADGES: LAB CAPABILITIES HIGHLIGHT                          */}
        {/* ========================================================================= */}
        <div className="border-t border-cyan-500/20 bg-[#020817]/90 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-300 font-medium">
          
          <div className="flex items-center space-x-2">
            <Laptop className="h-3.5 w-3.5 text-cyan-400" />
            <span>Computer Laboratories</span>
          </div>

          <div className="flex items-center space-x-2">
            <Code className="h-3.5 w-3.5 text-cyan-400" />
            <span>Manage Lab Bookings</span>
          </div>

          <div className="flex items-center space-x-2">
            <Calendar className="h-3.5 w-3.5 text-cyan-400" />
            <span>Track Inventory</span>
          </div>

          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Secure Access</span>
          </div>

        </div>

      </div>

    </div>
  );
};
