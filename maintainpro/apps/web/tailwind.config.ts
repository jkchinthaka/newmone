import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefcf8",
          100: "#d5f7ee",
          200: "#acefdc",
          300: "#79e1c7",
          400: "#47c8ad",
          500: "#1ea88d",
          600: "#0f866f",
          700: "#0f6b5a",
          800: "#0f5548",
          900: "#0e473e"
        }
      },
      boxShadow: {
        panel: "0 8px 24px rgba(15, 118, 110, 0.12)"
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "fade-up": "fade-up 0.5s ease forwards"
      }
    }
  },
  plugins: []
};

export default config;
