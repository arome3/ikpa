/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // IKPA Brand Colors
        primary: {
          DEFAULT: '#1E3A5F',
          50: '#E8EEF4',
          100: '#D1DDE9',
          200: '#A3BBD3',
          300: '#7599BD',
          400: '#4777A7',
          500: '#1E3A5F',
          600: '#182E4C',
          700: '#122339',
          800: '#0C1726',
          900: '#060C13',
        },
        secondary: {
          DEFAULT: '#2D9CDB',
        },
        accent: {
          DEFAULT: '#F2994A',
        },
      },
    },
  },
  plugins: [],
};
