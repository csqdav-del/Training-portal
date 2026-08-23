/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#050507',
          panel: '#0c0c15',
          panel2: '#12121e',
          line: '#20233a',
        },
        primary: {
          50: '#ecfeff',
          100: '#cffafe',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          900: '#083344',
        },
        sport: {
          swim: '#22d3ee',
          bike: '#34ff9d',
          run: '#ff2fd6',
          strength: '#b45bff',
        },
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        body: ['Rajdhani', 'sans-serif'],
        mono: ['"Share Tech Mono"', 'monospace'],
      },
      boxShadow: {
        'neon-cyan': '0 0 8px rgba(34,211,238,0.55), 0 0 26px rgba(34,211,238,0.2)',
        'neon-pink': '0 0 8px rgba(255,47,214,0.55), 0 0 26px rgba(255,47,214,0.2)',
        'neon-green': '0 0 8px rgba(52,255,157,0.55), 0 0 26px rgba(52,255,157,0.2)',
        'neon-purple': '0 0 8px rgba(180,91,255,0.55), 0 0 26px rgba(180,91,255,0.2)',
      },
      backgroundImage: {
        'cyber-grid':
          'linear-gradient(rgba(34,211,238,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.06) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '38px 38px',
      },
    },
  },
  plugins: [],
}
