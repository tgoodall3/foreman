/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      screens: {
        xs: "480px",
      },
      colors: {
        forge:  "#0f1923",
        "forge-light": "#1a2634",
        steel:  "#2d3f50",
        amber:  "#f59e0b",
        "amber-dark": "#d97706",
        chalk:  "#f0ede8",
        mist:   "#8a9bac",
        surface: "#f5f4f0",
      },
      fontFamily: {
        sans:    ["'Barlow'", "sans-serif"],
        display: ["'Barlow Condensed'", "sans-serif"],
        mono:    ["'JetBrains Mono'", "monospace"],
      },
      fontWeight: { 600: "600", 700: "700", 800: "800" },
    },
  },
  plugins: [],
};
