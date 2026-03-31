import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: {
            DEFAULT: "#534AB7",
            light: "#7F77DD",
            dark: "#3C3489",
            pale: "#AFA9EC",
            palest: "#EEEDFE",
          },
        },
        surface: {
          base: "#0F1117",
          raised: "#12121a",
          card: "#16161f",
        },
        line: {
          DEFAULT: "#2a2a3a",
          subtle: "#1e1e2a",
        },
        content: {
          primary: "#e0e0e8",
          muted: "#8888a0",
          dim: "#55556a",
        },
        status: {
          green: "#7ec89f",
          warm: "#f0c674",
          red: "#e88",
        },
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        mono: ["var(--font-dm-mono)", "monospace"],
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "20px",
      },
    },
  },
  plugins: [],
};

export default config;
