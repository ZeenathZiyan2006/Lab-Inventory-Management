/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0a192f',
          800: '#0f2744',
          700: '#1b3a5b',
          600: '#234e79',
          500: '#2d659b',
        },
        brand: {
          maroon: '#800020',
          teal: '#0d9488',
          accent: '#1e40af',
          light: '#f0f4f8',
        }
      }
    },
  },
  plugins: [],
}
