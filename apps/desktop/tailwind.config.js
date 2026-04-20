/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Insomnia-like Dark Theme with Purple Accents
        background: '#1a1a2e',
        surface: '#252540',
        primary: '#7c3aed', // Purple accent
        'primary-hover': '#6d28d9',
        secondary: '#5856d6',
        text: '#e2e8f0',
        muted: '#94a3b8',
        border: '#33334d',
        success: '#10b981',
        danger: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Menlo', 'Monaco', 'Consolas', 'monospace']
      }
    }
  },
  plugins: []
}
