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
        ink: "#263238",
        brand: {
          50: "#EAF5ED",
          100: "#d7ebdc",
          200: "#b7dcc2",
          300: "#7fbf93",
          400: "#3f9460",
          500: "#176B3A",
          600: "#176B3A",
          700: "#145e33",
          800: "#104D2B",
          900: "#104D2B"
        },
        accent: {
          50: "#fff8dc",
          100: "#fdeeb0",
          500: "#F4C430",
          700: "#8a6d12"
        }
      },
      borderRadius: {
        card: "0.75rem"
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 77, 43, 0.06)"
      }
    }
  },
  plugins: []
};

export default config;
