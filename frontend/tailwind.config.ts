import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--bg)",
        foreground: "var(--text)",
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--text)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "#a1a1aa",
        },
        border: "var(--border)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--text)",
        },
      },
      animation: {
        marquee: "marquee 25s linear infinite",
        pulseSlow: "pulseSlow 8s ease-in-out infinite",
        pulseGreen: "pulseGreen 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
        pulseSlow: {
          "0%, 100%": { opacity: "0.2", transform: "scale(1) translate(0px, 0px)" },
          "50%": { opacity: "0.4", transform: "scale(1.1) translate(10px, -20px)" },
        },
        pulseGreen: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(1.2)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
