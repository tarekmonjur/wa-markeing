/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx}',
    './content/**/*.mdx',
    './node_modules/fumadocs-ui/dist/**/*.js',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
