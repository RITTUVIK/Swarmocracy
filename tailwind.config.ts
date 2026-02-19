import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "sol-purple": "#9945FF",
        "sol-green": "#14F195",
        "sol-cyan": "#00d4ff",
        panel: {
          DEFAULT: "#0c0e14",
          light: "#111520",
          border: "#1a1f2e",
        },
        surface: "#080a0f",
      },
      fontFamily: {
        mono: [
          '"JetBrains Mono"',
          '"SF Mono"',
          '"Fira Code"',
          "Menlo",
          "monospace",
        ],
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        scanline: "scanline 8s linear infinite",
        float: "float 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
