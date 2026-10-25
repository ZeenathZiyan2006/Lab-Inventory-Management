import React, { useState, useEffect } from 'react';

// Custom event to trigger the temporary greeting robot
export const triggerSelectionGreeting = (greeting: string) => {
  window.dispatchEvent(new CustomEvent('smvitm:selection-greeting', { detail: { greeting } }));
};

export const SelectionGreetingRobot: React.FC = () => {
  const [greeting, setGreeting] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let timeoutId: number;

    const handleGreeting = (e: Event) => {
      const customEvent = e as CustomEvent<{ greeting: string }>;
      const text = customEvent.detail?.greeting || 'Ready!';
      setGreeting(text);
      setIsVisible(true);

      clearTimeout(timeoutId);
      // Auto-dismiss after 1.25 seconds
      timeoutId = window.setTimeout(() => {
        setIsVisible(false);
      }, 1250);
    };

    window.addEventListener('smvitm:selection-greeting', handleGreeting);
    return () => {
      window.removeEventListener('smvitm:selection-greeting', handleGreeting);
      clearTimeout(timeoutId);
    };
  }, []);

  if (!greeting || !isVisible) return null;

  return (
    <div
      className="fixed bottom-6 left-6 z-40 pointer-events-none transition-all duration-300 transform translate-y-0 opacity-100 animate-bounce"
      style={{ animationDuration: '2s' }}
      aria-live="polite"
    >
      <div className="flex items-center space-x-2.5 px-3.5 py-2 rounded-2xl bg-[#091124]/90 backdrop-blur-xl border border-cyan-400/50 shadow-[0_0_20px_rgba(0,240,255,0.35)] text-white">
        {/* Tiny friendly micro-bot waving */}
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 p-1 flex items-center justify-center shadow-[0_0_10px_#00F0FF] flex-shrink-0">
          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="12" cy="5" r="2" />
            <path d="M12 7v4" />
            <line x1="8" y1="16" x2="8" y2="16" />
            <line x1="16" y1="16" x2="16" y2="16" />
            <path d="M9 19c1 .5 2 .5 3 0" />
            {/* waving arm */}
            <path d="M21 13l2-2" />
          </svg>
        </div>
        <div>
          <div className="text-[10px] font-bold tracking-wider text-cyan-300 uppercase">
            SMVITM AI Core
          </div>
          <div className="text-xs font-semibold text-slate-100 truncate max-w-[200px]">
            {greeting}
          </div>
        </div>
      </div>
    </div>
  );
};
