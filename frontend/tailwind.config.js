/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"DM Sans"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        soft: '0 2px 8px -2px rgb(15 23 42 / 0.06), 0 8px 24px -4px rgb(15 23 42 / 0.08)',
        glow: '0 0 0 1px rgb(13 148 136 / 0.12), 0 12px 40px -12px rgb(13 148 136 / 0.35)',
      },
      backgroundImage: {
        'mesh-page':
          'radial-gradient(1200px 600px at 10% -10%, rgb(204 251 241 / 0.55), transparent 50%), radial-gradient(900px 500px at 100% 0%, rgb(224 231 255 / 0.45), transparent 45%), radial-gradient(800px 400px at 50% 100%, rgb(254 243 199 / 0.35), transparent 50%)',
      },
    },
  },
  plugins: [],
}