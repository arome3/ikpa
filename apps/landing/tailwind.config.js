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
        cream: '#FDFCF8',
        ivory: '#FAFAF9',
        forest: '#1A2E22',
        charcoal: '#1C1C1C',
        olive: '#3F6212',
        sage: {
          50: '#F0F4F1',
          100: '#D9E3DB',
          200: '#B8CDB9',
          300: '#97B69A',
          400: '#6F9B74',
          500: '#4A7A55',
          600: '#3D6546',
          700: '#2C4A33',
          800: '#1F3524',
          900: '#1A2E22',
        },
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
