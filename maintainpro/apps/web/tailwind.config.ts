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
          50: "#eef7ff",
          100: "#d9edff",
          200: "#bce0ff",
          300: "#8eccff",
          400: "#5ab0ff",
          500: "#2c92f2",
          600: "#1476d6",
          700: "#115ea8",
          800: "#134f87",
          900: "#16456f"
        }
      }
    }
  },
  plugins: []
};

export default config;
