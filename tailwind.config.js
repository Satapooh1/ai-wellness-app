/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Sarabun', 'sans-serif'],
      },
      colors: {
        base: '#0a0a0f',
        surface: '#12121a',
        surfaceAlt: '#1a1a2e',
        teal: {
          400: '#00d4aa',
          500: '#00b894',
        },
        coral: '#ff6b6b',
        amber: {
          warm: '#ff8c42',
        },
      },
      backgroundImage: {
        'warm-glow': 'radial-gradient(ellipse at center, rgba(255,140,66,0.15) 0%, transparent 70%)',
        'teal-glow': 'radial-gradient(ellipse at center, rgba(0,212,170,0.15) 0%, transparent 70%)',
      },
    },
  },
  plugins: [],
}
