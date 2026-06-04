import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        fin: {
          bg: "var(--fin-bg)",
          surface: "var(--fin-surface)",
          muted: "var(--fin-muted)",
          elevated: "var(--fin-elevated)",
          border: "var(--fin-border)",
          "border-strong": "var(--fin-border-strong)",
          text: "var(--fin-text)",
          navy: "var(--fin-navy)",
          subtle: "var(--fin-subtle)",
          brand: "var(--fin-brand)",
          "brand-soft": "var(--fin-brand-soft)",
          accent: "var(--fin-accent)",
          "accent-soft": "var(--fin-accent-soft)",
          sidebar: "var(--fin-sidebar)",
          "sidebar-active": "var(--fin-sidebar-active)",
        },
        status: {
          positive: "var(--status-positive)",
          "positive-bg": "var(--status-positive-bg)",
          negative: "var(--status-negative)",
          "negative-bg": "var(--status-negative-bg)",
          neutral: "var(--status-neutral)",
          "neutral-bg": "var(--status-neutral-bg)",
          warning: "var(--status-warning)",
          "warning-bg": "var(--status-warning-bg)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "22px",
        panel: "28px",
        image: "20px",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        float: "var(--shadow-float)",
      },
      maxWidth: {
        shell: "1280px",
        article: "760px",
      },
    },
  },
  plugins: [],
};

export default config;
