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
        // IKPA Brand Colors (from UI guide)
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
          50: '#E6F4FB',
          100: '#CCE9F7',
          200: '#99D3EF',
          300: '#66BDE7',
          400: '#33A7DF',
          500: '#2D9CDB',
          600: '#247DAF',
          700: '#1B5E83',
          800: '#123E58',
          900: '#091F2C',
        },
        accent: {
          DEFAULT: '#F2994A',
          50: '#FEF6EE',
          100: '#FDEDDD',
          200: '#FBDBBB',
          300: '#F9C999',
          400: '#F7B777',
          500: '#F2994A',
          600: '#C27A3B',
          700: '#915C2C',
          800: '#613D1E',
          900: '#301F0F',
        },
        success: '#27AE60',
        warning: '#F2C94C',
        error: '#EB5757',
      },
    },
  },
  plugins: [],
};
