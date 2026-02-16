import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        solana: {
          purple: "#9945FF",
          green: "#14F195",
        },
      },
    },
  },
  plugins: [],
};

export default config;
