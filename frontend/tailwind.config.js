/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        galaxy: {
          950: '#030712',
          900: '#050A18',
          850: '#081026',
          800: '#0D1738',
          750: '#122048',
          700: '#182A5C',
          card: '#080F24',
          'card-hover': '#0C1736',
          border: 'rgba(0, 240, 255, 0.18)',
        },
        neon: {
          cyan: '#00F0FF',
          sky: '#38BDF8',
          blue: '#2563EB',
          purple: '#A855F7',
          magenta: '#EC4899',
          emerald: '#10B981',
          amber: '#F59E0B',
          rose: '#F43F5E',
        },
        navy: {
          950: '#060d17',
          900: '#0B192C',
          800: '#11223A',
          700: '#1C314E',
          600: '#28456C',
          500: '#385F91',
        },
        brand: {
          maroon: '#800B35',
          'maroon-hover': '#660829',
          gold: '#D97706',
          'gold-light': '#FDE68A',
          teal: '#0d9488',
          accent: '#1e40af',
          light: '#f8fafc',
        }
      },
      boxShadow: {
        'aesthetic': '0 4px 20px -2px rgba(11, 25, 44, 0.08), 0 2px 6px -1px rgba(11, 25, 44, 0.04)',
        'aesthetic-hover': '0 10px 25px -3px rgba(11, 25, 44, 0.12), 0 4px 10px -2px rgba(11, 25, 44, 0.06)',
        'neon-cyan': '0 0 15px rgba(0, 240, 255, 0.35), 0 0 30px rgba(0, 240, 255, 0.15)',
        'neon-purple': '0 0 15px rgba(168, 85, 247, 0.35), 0 0 30px rgba(168, 85, 247, 0.15)',
        'neon-magenta': '0 0 15px rgba(236, 72, 153, 0.35), 0 0 30px rgba(236, 72, 153, 0.15)',
        'neon-card': '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
        'neon-card-glow': '0 0 20px rgba(0, 240, 255, 0.18), 0 8px 32px 0 rgba(0, 0, 0, 0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'border-flow': 'borderFlow 6s ease infinite',
        'glow-pulse': 'glowPulse 2.5s ease-in-out infinite',
      },
      keyframes: {
        borderFlow: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.85' },
        }
      }
    },
  },
  plugins: [],
}
