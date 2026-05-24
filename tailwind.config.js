/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf6',
          100: '#dcfce9',
          200: '#bbf7d4',
          300: '#86efad',
          400: '#4ade7f',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803c',
          800: '#166533',
          900: '#14532b',
        },
        accent: {
          50: '#fff8ed',
          100: '#ffefcf',
          200: '#ffdf9e',
          300: '#ffc961',
          400: '#ffb025',
          500: '#f59407',
          600: '#d97202',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        surface: {
          950: '#0c0f14',
          900: '#12161e',
          800: '#1a1f2e',
          700: '#242b3d',
          600: '#313a50',
          500: '#414d6a',
          400: '#5a6a8a',
          300: '#7a8baa',
          200: '#a3b0c6',
          100: '#cdd5e2',
          50: '#e8ecf3',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(34,197,94,0.15)',
        'glow-lg': '0 0 40px rgba(34,197,94,0.2)',
        'glow-accent': '0 0 20px rgba(245,158,7,0.15)',
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out forwards',
        'slide-in-right': 'slideInRight 0.3s ease-out forwards',
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
      },
      keyframes: {
        slideUp: {
          from: { opacity: 0, transform: 'translateY(12px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { opacity: 0, transform: 'translateX(20px)' },
          to: { opacity: 1, transform: 'translateX(0)' },
        },
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(34,197,94,0.2)' },
          '50%': { boxShadow: '0 0 20px rgba(34,197,94,0.4)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
