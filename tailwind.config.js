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
        // Components use `text-gray-100/200/300/400` directly as the primary
        // text ramp (rather than a `text-primary` utility), so these four
        // shades are re-scoped to the same theme-aware custom properties as
        // `--text-primary/body/secondary/tertiary` — recoloring one token set
        // relights the whole app for the Day theme instead of every call site.
        gray: {
          100: 'rgb(var(--text-primary) / <alpha-value>)',
          200: 'rgb(var(--text-body) / <alpha-value>)',
          300: 'rgb(var(--text-secondary) / <alpha-value>)',
          400: 'rgb(var(--text-tertiary) / <alpha-value>)',
        },
        surface: {
          0: 'rgb(var(--surface-0) / <alpha-value>)',
          1: 'rgb(var(--surface-1) / <alpha-value>)',
          2: 'rgb(var(--surface-2) / <alpha-value>)',
          3: 'rgb(var(--surface-3) / <alpha-value>)',
          4: 'rgb(var(--surface-4) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--border) / <alpha-value>)',
          strong: 'rgb(var(--border-strong) / <alpha-value>)',
        },
        empire: {
          green: 'rgb(var(--empire-green) / <alpha-value>)',
          yellow: 'rgb(var(--empire-yellow) / <alpha-value>)',
          red: 'rgb(var(--empire-red) / <alpha-value>)',
          blue: 'rgb(var(--empire-blue) / <alpha-value>)',
          violet: 'rgb(var(--empire-violet) / <alpha-value>)',
          cyan: 'rgb(var(--empire-cyan) / <alpha-value>)',
          muted: 'rgb(var(--empire-muted) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        md: '0.5rem',
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        glow: 'var(--shadow-glow)',
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        'btn-primary': 'var(--shadow-btn-primary)',
      },
      backgroundImage: {
        'grid-faint': 'var(--grid-faint)',
        'radial-glow': 'var(--radial-glow)',
        'hairline': 'var(--hair)',
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
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.6' },
          '50%': { transform: 'scale(1.08)', opacity: '1' },
        },
        radiate: {
          '0%': { transform: 'scale(0.8)', opacity: '0.5' },
          '100%': { transform: 'scale(1.9)', opacity: '0' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-6px)' },
          '40%, 80%': { transform: 'translateX(6px)' },
        },
        'pop-in': {
          from: { transform: 'scale(0.4)', opacity: '0' },
          '70%': { transform: 'scale(1.1)', opacity: '1' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out both',
        'slide-in': 'slide-in 0.25s ease-out both',
        'scale-in': 'scale-in 0.2s ease-out both',
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        breathe: 'breathe 2.4s ease-in-out infinite',
        radiate: 'radiate 1.8s ease-out infinite',
        shake: 'shake 0.4s ease-in-out',
        'pop-in': 'pop-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
      },
    },
  },
  plugins: [],
};
