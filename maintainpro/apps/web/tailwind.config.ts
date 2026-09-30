import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f3faf4",
          100: "#e3f5e6",
          200: "#c5e8cb",
          300: "#96d4a3",
          400: "#5fb874",
          500: "#3a9a52",
          600: "#2f7d43",
          700: "#266536",
          800: "#1e4f2c",
          900: "#183f24"
        },
        accent: {
          50: "#fff8eb",
          100: "#fdecc8",
          500: "#e0a106",
          700: "#8a6408"
        }
      }
    }
  },
  plugins: []
};

export default config;
