import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f4f7fb",
          100: "#dfe8f2",
          500: "#12385f",
          700: "#0b2440",
          900: "#061827",
          950: "#04111d"
        },
        aqua: {
          50: "#e9fbff",
          100: "#c8f4fb",
          400: "#22c9e8",
          500: "#09aeca",
          600: "#078ca5"
        },
        coral: {
          400: "#ff765f",
          500: "#f15f4a"
        },
        mint: {
          400: "#49d7a6",
          500: "#22b889"
        }
      },
      boxShadow: {
        panel: "0 18px 50px rgba(4, 17, 29, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
