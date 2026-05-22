/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      screens: {
        xs: "480px",
      },
      colors: {
        forge:        "#0f1923",
        "forge-light": "#1a2634",
        steel:        "#2d3f50",
        amber:        "#f59e0b",
        "amber-dark": "#d97706",
        chalk:        "#f0ede8",
        mist:         "#8a9bac",
        surface:      "#f4f5f7",
      },
      fontFamily: {
        sans:    ["'Inter'", "system-ui", "sans-serif"],
        display: ["'Barlow Condensed'", "sans-serif"],
        mono:    ["'JetBrains Mono'", "monospace"],
      },
      fontWeight: { 400: "400", 500: "500", 600: "600", 700: "700", 800: "800" },
      boxShadow: {
        card:        "0 1px 3px 0 rgba(15,25,35,0.08), 0 1px 2px -1px rgba(15,25,35,0.04)",
        "card-md":   "0 4px 12px -2px rgba(15,25,35,0.10), 0 2px 4px -2px rgba(15,25,35,0.06)",
        "card-lg":   "0 8px 24px -4px rgba(15,25,35,0.12), 0 4px 8px -4px rgba(15,25,35,0.06)",
        "inner-sm":  "inset 0 1px 2px 0 rgba(15,25,35,0.06)",
      },
      keyframes: {
        shimmer: {
          "0%":   { backgroundPosition: "-600px 0" },
          "100%": { backgroundPosition: "600px 0"  },
        },
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(6px)"  },
          "100%": { opacity: "1", transform: "translateY(0)"    },
        },
        "slide-in-right": {
          "0%":   { opacity: "0", transform: "translateX(14px)" },
          "100%": { opacity: "1", transform: "translateX(0)"    },
        },
        "scale-in": {
          "0%":   { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)"    },
        },
      },
      animation: {
        shimmer:          "shimmer 1.6s ease-in-out infinite",
        "fade-up":        "fade-up 0.18s ease-out",
        "slide-in-right": "slide-in-right 0.22s ease-out",
        "scale-in":       "scale-in 0.15s ease-out",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
    },
  },
  plugins: [],
};
