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
        },
        stitch: {
          bg: "#081424",
          abyss: "#040e1e",
          panel: "#111c2c",
          panel2: "#152031",
          panel3: "#1f2a3c",
          line: "#3a4a4a",
          cyan: "#00fbff",
          cyan2: "#00dce0",
          blue: "#03a8e8",
          text: "#d8e3fa",
          muted: "#b9caca",
          graphite: "#4a5568"
        }
      },
      boxShadow: {
        panel: "0 18px 50px rgba(4, 17, 29, 0.08)",
        stitch: "0 18px 80px rgba(0, 251, 255, 0.08)",
        glow: "0 0 32px rgba(0, 251, 255, 0.16)"
      },
      fontFamily: {
        mono: [
          "JetBrains Mono",
          "SFMono-Regular",
          "Consolas",
          "Liberation Mono",
          "monospace"
        ]
      }
    }
  },
  plugins: []
};

export default config;
