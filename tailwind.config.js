/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        groww: {
          green: "#00D09C",
          "green-hover": "#00B887",
          "green-bg": "rgba(0, 208, 156, 0.12)",
          red: "#EB5B3C",
          "red-hover": "#D84A2C",
          "red-bg": "rgba(235, 91, 60, 0.12)",
          card: "#12141A",
          cardHover: "#181C24",
          surface: "#1B202A",
          border: "#262B36",
          muted: "#848E9C",
          darkBg: "#0B0E14"
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      }
    },
  },
  plugins: [],
};
