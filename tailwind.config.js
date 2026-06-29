/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Blue-tinted near-blacks for depth without flatness
        surface: {
          0: '#08090c',
          1: '#0e1014',
          2: '#15181e',
          3: '#1d212a',
          4: '#262b36',
        },
        border: {
          DEFAULT: '#23272f',
          strong: '#323845',
        },
        empire: {
          green: '#34d399',
          yellow: '#fbbf24',
          red: '#f87171',
          blue: '#60a5fa',
          violet: '#a78bfa',
          cyan: '#22d3ee',
          muted: '#7d8590',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(96,165,250,0.15), 0 8px 32px -8px rgba(96,165,250,0.25)',
        card: '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -12px rgba(0,0,0,0.6)',
        'card-hover': '0 1px 2px rgba(0,0,0,0.5), 0 16px 40px -16px rgba(0,0,0,0.8)',
      },
      backgroundImage: {
        'grid-faint':
          'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)',
        'radial-glow':
          'radial-gradient(60% 60% at 50% 0%, rgba(96,165,250,0.08) 0%, transparent 100%)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out both',
        'slide-in': 'slide-in 0.25s ease-out both',
        'scale-in': 'scale-in 0.2s ease-out both',
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
