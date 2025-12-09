/**** Tailwind config ****/
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,jsx,js}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Work Sans"', 'Inter', 'system-ui', 'sans-serif'],
        body: ['"Source Sans Pro"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f3f7ff',
          100: '#e5edff',
          200: '#c8d9ff',
          400: '#6c8cff',
          500: '#4a6bff',
          600: '#3655e6',
          700: '#2c46bf',
        },
      },
      boxShadow: {
        card: '0 10px 40px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
};
