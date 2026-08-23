/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          900: '#082f49',
        },
        sport: {
          swim: '#3b82f6',
          bike: '#10b981',
          run: '#ef4444',
          strength: '#8b5cf6',
        },
      },
    },
  },
  plugins: [],
}
