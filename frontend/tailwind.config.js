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
          DEFAULT: '#1e40af', // blue-800
          dark: '#1e3a8a', // blue-900
          light: '#3b82f6', // blue-500
        },
        accent: {
          DEFAULT: '#06b6d4', // cyan-500
        }
      }
    },
  },
  plugins: [],
}
