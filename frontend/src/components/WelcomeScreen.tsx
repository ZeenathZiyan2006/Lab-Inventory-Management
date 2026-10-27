import React, { useEffect, useState } from 'react';
import { User } from '../context/AuthContext';
import { ShieldCheck } from 'lucide-react';

interface WelcomeScreenProps {
  user: User;
  onFinish: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ user, onFinish }) => {
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Initiate smooth fade-out 250ms prior to completion
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 1750);

    // Strict 2-second display time (2000 ms) before entering dashboard
    const finishTimer = setTimeout(() => {
      onFinish();
    }, 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  // Format verified role label
  const getRoleBadgeText = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return 'Administrator Access Verified';
      case 'LAB_INSTRUCTOR':
        return 'Lab Instructor Access Verified';
      case 'HOD':
        return 'HOD Access Verified';
      case 'PRINCIPAL':
        return 'Principal Access Verified';
      case 'TECHNICIAN':
        return 'Technician Access Verified';
      default:
        return 'Institutional Access Verified';
    }
  };

  const displayName = user?.full_name?.trim() || 'User';

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col justify-between p-4 sm:p-8 md:p-12 bg-[#020617] text-white overflow-hidden select-none transition-all duration-300 ease-out ${
        isFadingOut ? 'opacity-0 scale-[0.985] pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{
        backgroundImage: `
          radial-gradient(circle at 50% 38%, rgba(0, 240, 255, 0.18) 0%, rgba(168, 85, 247, 0.10) 35%, transparent 70%),
          linear-gradient(to right, rgba(0, 240, 255, 0.035) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(0, 240, 255, 0.035) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 36px 36px, 36px 36px',
      }}
    >
      {/* Sci-Fi College Night Campus Photographic Backdrop (Reference Image 2) */}
      <div className="absolute right-0 top-0 bottom-0 w-full sm:w-2/3 lg:w-1/2 pointer-events-none overflow-hidden opacity-30 mix-blend-screen select-none">
        <img
          src="/images/smvitm_night_campus_futuristic.jpg"
          alt="SMVITM Campus Night"
          className="w-full h-full object-cover object-center filter saturate-150 contrast-125"
        />
        {/* Soft edge gradients to seamlessly blend photo into space navy canvas */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#020617] via-[#020617]/75 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#020617] via-transparent to-[#020617]" />
      </div>

      {/* Futuristic Corner HUD Accents (Reference Image 1) */}
      {/* Top Left Corner */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 w-32 sm:w-48 h-16 pointer-events-none">
        <svg className="w-full h-full" viewBox="0 0 192 64" fill="none">
          <path d="M 0 20 L 70 20 L 95 45 L 192 45" stroke="#00F0FF" strokeWidth="2" strokeOpacity="0.85" />
          <path d="M 0 32 L 55 32 L 75 52 L 130 52" stroke="#00F0FF" strokeWidth="1" strokeOpacity="0.4" />
          <circle cx="190" cy="45" r="2.5" fill="#00F0FF" />
        </svg>
      </div>

      {/* Top Right HUD Bracket */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 hidden sm:flex items-center space-x-2 pointer-events-none">
        <div className="px-3.5 py-1 rounded border border-cyan-500/40 bg-[#051329]/60 backdrop-blur-sm text-[11px] font-mono tracking-widest text-cyan-300 flex items-center space-x-2 shadow-[0_0_15px_rgba(0,240,255,0.2)]">
          <span className="text-cyan-400 font-bold">&lang;</span>
          <span>SMART INVENTORY</span>
          <span className="text-cyan-400">•</span>
          <span>SMART CAMPUS</span>
          <span className="text-cyan-400">•</span>
          <span>SMART FUTURE</span>
          <span className="text-cyan-400 font-bold">&rang;</span>
        </div>
      </div>

      {/* Bottom Left Corner */}
      <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 w-36 sm:w-56 h-16 pointer-events-none">
        <svg className="w-full h-full" viewBox="0 0 224 64" fill="none">
          <path d="M 0 45 L 80 45 L 105 20 L 224 20" stroke="#00F0FF" strokeWidth="2" strokeOpacity="0.85" />
          <circle cx="222" cy="20" r="2.5" fill="#00F0FF" />
        </svg>
      </div>

      {/* Bottom Right Corner (Purple Sci-Fi Step) */}
      <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 w-44 sm:w-64 h-16 pointer-events-none">
        <svg className="w-full h-full" viewBox="0 0 256 64" fill="none">
          <path d="M 256 45 L 170 45 L 140 18 L 0 18" stroke="#C084FC" strokeWidth="2" strokeOpacity="0.85" />
          <circle cx="2" cy="18" r="2.5" fill="#C084FC" />
        </svg>
      </div>

      {/* TOP INSTITUTIONAL IDENTITY BAR (Reference Image 3 & 1) */}
      <header className="relative z-10 flex items-center justify-between">
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Authentic SMVITM Circular Logo badge */}
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-white p-0.5 border-2 border-cyan-400/80 shadow-[0_0_18px_rgba(0,240,255,0.6)] flex items-center justify-center shrink-0">
            <img
              src="/images/smvitm_authentic_logo.jpg"
              alt="SMVITM Authentic Logo"
              className="w-full h-full object-cover rounded-full"
            />
          </div>

          <div>
            <h1 className="text-white font-bold text-sm sm:text-base md:text-lg tracking-wide leading-tight">
              SMVITM Bantakal
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-300 font-medium tracking-normal">
              AI-Powered Smart Inventory Management System
            </p>
          </div>
        </div>
      </header>

      {/* CENTER GLOWING CORE & PERSONALIZED GREETING (Reference Image 1) */}
      <main className="relative z-10 my-auto flex flex-col items-center justify-center text-center px-4">
        {/* Glowing Holographic Cube Portal */}
        <div className="relative flex items-center justify-center mb-6 sm:mb-8">
          {/* Outer Pulsing Aura Ring */}
          <div className="absolute w-28 h-28 sm:w-32 sm:h-32 rounded-full border border-cyan-400/30 animate-ping opacity-25" />

          {/* Orbiting Particle Nodes */}
          <div className="absolute w-32 h-32 sm:w-36 sm:h-36 rounded-full border border-cyan-500/20 animate-spin" style={{ animationDuration: '12s' }}>
            <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00F0FF]" />
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_#C084FC]" />
          </div>

          {/* Central Glowing Cyan Portal Ring */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-cyan-400 shadow-[0_0_35px_rgba(0,240,255,0.7),inset_0_0_20px_rgba(0,240,255,0.35)] flex items-center justify-center bg-[#051329]/80 backdrop-blur-md">
            {/* Precise 3D Isometric Inventory Cube Wireframe Icon */}
            <svg
              className="w-12 h-12 sm:w-14 sm:h-14 text-cyan-300 filter drop-shadow-[0_0_14px_#00F0FF]"
              viewBox="0 0 48 48"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Outer Hexagonal Boundary of 3D Cube */}
              <path
                d="M24 6L40 15.2V33.6L24 42.8L8 33.6V15.2L24 6Z"
                fill="rgba(0, 240, 255, 0.08)"
                stroke="currentColor"
              />
              {/* Internal Isometric Edges */}
              <path d="M24 24.4V42.8" stroke="currentColor" />
              <path d="M24 24.4L40 15.2" stroke="currentColor" />
              <path d="M24 24.4L8 15.2" stroke="currentColor" />
            </svg>
          </div>
        </div>

        {/* Section Title */}
        <h2 className="text-cyan-400 text-xs sm:text-sm font-mono font-bold tracking-[0.25em] uppercase mb-1 drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]">
          WELCOME BACK,
        </h2>

        {/* The Genuine Authenticated User's Name with Cyan to Magenta Sci-Fi Gradient */}
        <div className="flex items-center justify-center">
          <span className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-fuchsia-400 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,240,255,0.45)]">
            {displayName}
          </span>
          <span className="text-fuchsia-400 font-light text-4xl sm:text-5xl md:text-6xl animate-pulse ml-1 inline-block drop-shadow-[0_0_12px_#E879F9]">
            |
          </span>
        </div>

        {/* Subtitle */}
        <p className="text-slate-300 text-sm sm:text-base font-normal mt-2 tracking-normal">
          Your workspace is ready.
        </p>

        {/* Sci-Fi Role-Aware Access Status Badge (Image 1) */}
        <div className="mt-6 sm:mt-8 px-5 sm:px-7 py-2.5 rounded-full border border-cyan-400/60 bg-[#051329]/85 backdrop-blur-md shadow-[0_0_24px_rgba(0,240,255,0.22)] flex items-center space-x-3">
          <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 fill-cyan-950/40 drop-shadow-[0_0_8px_#00F0FF] shrink-0" />
          <span className="text-white text-xs sm:text-sm font-semibold tracking-wide">
            {getRoleBadgeText(user.role)}
          </span>
        </div>
      </main>

      {/* FOOTER: PROGRESS WAVE DOTS & LOADING NOTICE (Reference Image 1) */}
      <footer className="relative z-10 flex flex-col items-center justify-center pb-2">
        {/* Animated Loading Dots Progression (Cyan to Purple wave) */}
        <div className="flex items-center space-x-2 sm:space-x-2.5">
          {[
            { color: '#00F0FF', delay: '0ms' },
            { color: '#00F0FF', delay: '120ms' },
            { color: '#38BDF8', delay: '240ms' },
            { color: '#38BDF8', delay: '360ms' },
            { color: '#60A5FA', delay: '480ms' },
            { color: '#818CF8', delay: '600ms' },
            { color: '#A78BFA', delay: '720ms' },
            { color: '#C084FC', delay: '840ms' },
            { color: '#E879F9', delay: '960ms' },
          ].map((dot, idx) => (
            <span
              key={idx}
              className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full animate-pulse"
              style={{
                backgroundColor: dot.color,
                boxShadow: `0 0 10px ${dot.color}`,
                animationDelay: dot.delay,
                animationDuration: '1.2s',
              }}
            />
          ))}
        </div>

        {/* Loading Subtitle */}
        <p className="text-[10px] sm:text-xs font-mono font-medium tracking-[0.25em] text-cyan-400/80 uppercase mt-3">
          LOADING YOUR DASHBOARD...
        </p>
      </footer>
    </div>
  );
};
