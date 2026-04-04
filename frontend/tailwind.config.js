/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#F97316', // ส้ม
          dark: '#EA580C',
          light: '#FB923C',
        },
        accent: {
          red: '#DC2626',
          gold: '#D4AF37',
        },
      },
    },
  },
  plugins: [],
}


