/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      colors: {
        "strong-buy": "#1a7a4a",
        "moderate-buy": "#2d9e68",
        "neutral": "#b07a20",
        "caution": "#c05a30",
        "avoid": "#9b2020",
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}
