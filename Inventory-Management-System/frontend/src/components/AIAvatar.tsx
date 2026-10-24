import React, { useState, useEffect } from 'react';
import { RobotState, AICharacter } from './AIRobotAssistant';

interface AIAvatarProps {
  character: AICharacter;
  state: RobotState;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'stage';
  className?: string;
  showAura?: boolean;
  isSpeakingAudio?: boolean;
  variant?: 'circle' | 'transparent';
}

export const AIAvatar: React.FC<AIAvatarProps> = ({
  character,
  state,
  size = 'md',
  className = '',
  showAura = true,
  isSpeakingAudio = false,
  variant = 'circle'
}) => {
  const isMale = character === 'male';
  const isSpeaking = state === 'speaking' || isSpeakingAudio;

  // Mouth viseme state for realistic speech cadence
  // 0: neutral smile, 1: slightly open, 2: wide open, 3: rounded 'o'
  const [mouthViseme, setMouthViseme] = useState<number>(0);
  // Natural blinking cycle
  const [isBlinking, setIsBlinking] = useState<boolean>(false);
  // Subtle head micro-nod during speech
  const [headPhase, setHeadPhase] = useState<number>(0);
  // Fallback state if image loading fails
  const [imageError, setImageError] = useState<boolean>(false);

  // Synchronized mouth animation loop active strictly while speaking
  useEffect(() => {
    if (!isSpeaking) {
      setMouthViseme(0);
      setHeadPhase(0);
      return;
    }

    const mouthInterval = setInterval(() => {
      setMouthViseme(Math.floor(Math.random() * 4));
      setHeadPhase((p) => (p + 1) % 4);
    }, 130);

    return () => clearInterval(mouthInterval);
  }, [isSpeaking]);

  // Natural spontaneous eye blink cycle: blinks every ~3.5 to 5 seconds for 160ms
  useEffect(() => {
    let blinkTimeout: any;

    const triggerBlink = () => {
      setIsBlinking(true);
      setTimeout(() => {
        setIsBlinking(false);
      }, 160);

      const nextInterval = 3200 + Math.random() * 2500;
      blinkTimeout = setTimeout(triggerBlink, nextInterval);
    };

    blinkTimeout = setTimeout(triggerBlink, 3000);
    return () => clearTimeout(blinkTimeout);
  }, []);

  // Dimensions based on requested size
  const sizeMap: Record<string, string> = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
    '2xl': 'w-32 h-32',
    stage: 'w-48 h-48'
  };

  const containerSize = sizeMap[size] || sizeMap.md;

  // Visual Theme Colors
  // Male (Arya): Electric Cyan / Ice Blue (#00D8FF, #0077FF)
  // Female (Ananya): Royal Violet / Magenta (#E056FD, #FF2A85)
  const primaryGlow = isMale ? '#00D8FF' : '#E056FD';
  const secondaryAccent = isMale ? '#0077FF' : '#B83B5E';

  const isStageOrLarge = size === 'stage' || size === '2xl';

  // Head tilt & nod transformations based on expression and speech
  const getHeadTransform = () => {
    if (state === 'listening') return 'rotate(2.5deg) translateY(-1px)';
    if (state === 'thinking') return 'rotate(-2deg) translateY(-2px)';
    if (isSpeaking) {
      const nods = ['translateY(0px)', 'translateY(1.5px)', 'translateY(0px)', 'translateY(-1px)'];
      return nods[headPhase] || 'none';
    }
    return 'none';
  };

  // Image source path: authentic male or female robot asset from reference image
  const imageSrc =
    variant === 'transparent' && isStageOrLarge
      ? `/images/robot_${character}_transparent.png`
      : `/images/robot_${character}_circle.png`;

  // Relative positions of eyes and mouth on circle avatars
  // Male: eyes ~42%, mouth ~64%
  // Female: eyes ~44%, mouth ~68%
  const mouthTopPercent = isMale ? '63%' : '67%';
  const eyesTopPercent = isMale ? '42%' : '44%';

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${containerSize} ${className}`}
      style={{ perspective: '1000px' }}
    >
      {/* 1. Dynamic Animated Aura & State Effects */}
      {showAura && (
        <div className="absolute inset-0 rounded-full pointer-events-none flex items-center justify-center">
          {/* Listening: Multi-tier radar pulse rings radiating outward */}
          {state === 'listening' && (
            <>
              <span
                className="absolute inset-[-8px] rounded-full animate-ping opacity-60"
                style={{ backgroundColor: primaryGlow, animationDuration: '1.4s' }}
              />
              <span
                className="absolute inset-[-18px] rounded-full border-2 border-dashed opacity-75 animate-spin"
                style={{ borderColor: primaryGlow, animationDuration: '6s' }}
              />
            </>
          )}

          {/* Thinking: Holographic rotating neural halo */}
          {state === 'thinking' && (
            <>
              <span
                className="absolute inset-[-6px] rounded-full animate-spin border-2 border-dashed opacity-80"
                style={{ borderColor: primaryGlow, animationDuration: '2.5s' }}
              />
              <span
                className="absolute inset-[-14px] rounded-full animate-pulse border border-cyan-400/40 opacity-70"
                style={{ animationDuration: '1.2s' }}
              />
            </>
          )}

          {/* Speaking: Dynamic soundwave breathing halo */}
          {isSpeaking && (
            <>
              <span
                className="absolute inset-[-6px] rounded-full animate-pulse opacity-85"
                style={{
                  boxShadow: `0 0 22px ${primaryGlow}, inset 0 0 10px ${primaryGlow}`,
                  border: `2px solid ${primaryGlow}`,
                  animationDuration: '0.7s'
                }}
              />
              <span
                className="absolute inset-[-14px] rounded-full opacity-40 animate-ping"
                style={{ backgroundColor: primaryGlow, animationDuration: '1.6s' }}
              />
            </>
          )}

          {/* Idle: Subtle neon aura ring */}
          {state === 'idle' && (
            <span
              className="absolute inset-[-3px] rounded-full opacity-40 transition-opacity duration-500 hover:opacity-80"
              style={{
                boxShadow: `0 0 14px ${primaryGlow}55`,
                border: `1.5px solid ${primaryGlow}44`
              }}
            />
          )}

          {/* Error: Alert pulse */}
          {state === 'error' && (
            <span
              className="absolute inset-[-6px] rounded-full animate-pulse opacity-90 border-2 border-rose-500 shadow-rose-500/50"
            />
          )}
        </div>
      )}

      {/* 2. Authentic Robot Duo Character Avatar Container */}
      <div
        className={`relative w-full h-full rounded-full overflow-hidden border-2 shadow-xl transition-all duration-300 bg-slate-900 ${
          isSpeaking ? 'scale-105' : state === 'listening' ? 'scale-105' : 'hover:scale-105'
        }`}
        style={{
          borderColor: isSpeaking ? primaryGlow : state === 'listening' ? '#38BDF8' : `${primaryGlow}77`,
          boxShadow: `0 4px 18px ${primaryGlow}44`,
          transform: getHeadTransform()
        }}
      >
        {!imageError ? (
          <>
            {/* Real Character Image extracted from Friendly AI Robot Duo.png */}
            <img
              src={imageSrc}
              alt={`${isMale ? 'Arya (Male' : 'Ananya (Female'} AI Assistant)`}
              className="w-full h-full object-cover object-center select-none pointer-events-none"
              onError={() => setImageError(true)}
              loading="eager"
            />

            {/* Natural Eye Blink Overlay */}
            {isBlinking && (
              <div
                className="absolute inset-x-0 bg-slate-900/60 pointer-events-none transition-opacity duration-75"
                style={{
                  top: eyesTopPercent,
                  height: '7%',
                  transform: 'translateY(-50%)'
                }}
              />
            )}

            {/* Dynamic Talking Mouth / Viseme Wave Indicator during speech */}
            {isSpeaking && (
              <div
                className="absolute inset-x-0 flex items-center justify-center pointer-events-none"
                style={{
                  top: mouthTopPercent,
                  transform: 'translateY(-50%)'
                }}
              >
                {mouthViseme === 1 && (
                  <span
                    className="w-3 h-1.5 rounded-full bg-cyan-400/80 animate-pulse"
                    style={{
                      boxShadow: `0 0 8px ${primaryGlow}`,
                      backgroundColor: primaryGlow
                    }}
                  />
                )}
                {mouthViseme === 2 && (
                  <span
                    className="w-4 h-2 rounded-full animate-pulse"
                    style={{
                      boxShadow: `0 0 10px ${primaryGlow}`,
                      backgroundColor: '#FFFFFF',
                      border: `1px solid ${primaryGlow}`
                    }}
                  />
                )}
                {mouthViseme === 3 && (
                  <span
                    className="w-2.5 h-2.5 rounded-full animate-ping"
                    style={{
                      boxShadow: `0 0 8px ${primaryGlow}`,
                      backgroundColor: primaryGlow
                    }}
                  />
                )}
                {mouthViseme === 0 && (
                  <span
                    className="w-3 h-0.5 rounded-full opacity-60"
                    style={{ backgroundColor: primaryGlow }}
                  />
                )}
              </div>
            )}

            {/* Neural Thinking Pulse Overlay */}
            {state === 'thinking' && (
              <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/30 via-transparent to-purple-900/30 animate-pulse pointer-events-none" />
            )}

            {/* Listening Soundwave Pulse Overlay */}
            {state === 'listening' && (
              <div className="absolute inset-0 bg-sky-500/10 animate-pulse pointer-events-none" />
            )}
          </>
        ) : (
          /* High-fidelity Vector Fallback if image asset fails to load */
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <rect width="100" height="100" fill={isMale ? '#091526' : '#1A0A26'} />
            <circle cx="50" cy="40" r="22" fill="#F8D3C5" />
            <circle cx="42" cy="38" r="3" fill={primaryGlow} />
            <circle cx="58" cy="38" r="3" fill={primaryGlow} />
            <path
              d={isSpeaking ? 'M 44 48 Q 50 56 56 48 Z' : 'M 44 50 Q 50 54 56 50'}
              fill={isSpeaking ? '#B83B5E' : 'none'}
              stroke="#B83B5E"
              strokeWidth="2"
            />
          </svg>
        )}

        {/* Live Audio Equalizer Bars Overlay during Speech (Stage View) */}
        {isStageOrLarge && isSpeaking && (
          <div className="absolute bottom-1 inset-x-0 flex justify-center items-end space-x-1.5 py-1.5 bg-black/50 backdrop-blur-xs border-t border-white/10">
            <span className="w-1 bg-cyan-400 rounded-full animate-bounce h-3" style={{ animationDelay: '0ms' }} />
            <span className="w-1 bg-cyan-300 rounded-full animate-bounce h-5" style={{ animationDelay: '120ms' }} />
            <span className="w-1 bg-white rounded-full animate-bounce h-6" style={{ animationDelay: '240ms' }} />
            <span className="w-1 bg-cyan-300 rounded-full animate-bounce h-4" style={{ animationDelay: '180ms' }} />
            <span className="w-1 bg-cyan-400 rounded-full animate-bounce h-2" style={{ animationDelay: '80ms' }} />
          </div>
        )}
      </div>
    </div>
  );
};
