import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        purple: {
          DEFAULT: "#534AB7",
          light: "#7F77DD",
          dark: "#3C3489",
          pale: "#AFA9EC",
          palest: "#EEEDFE",
        },
        bg: {
          dark: "#0F1117",
          raised: "#12121a",
          card: "#16161f",
        },
        border: {
          subtle: "#2a2a3a",
        },
        text: {
          primary: "#e0e0e8",
          muted: "#8888a0",
          dim: "#55556a",
        },
        green: "#7ec89f",
        warm: "#f0c674",
        red: "#e88",
      },
      boxShadow: {
        glow: "0 18px 42px rgba(83, 74, 183, 0.28)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
};

export default config;
