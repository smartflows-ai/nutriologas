import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tenant colors (set from ThemeConfig). The RGB channel vars let opacity modifiers work: bg-primary/10
        primary: "rgb(var(--color-primary-rgb) / <alpha-value>)",
        secondary: "rgb(var(--color-secondary-rgb) / <alpha-value>)",
        accent: "rgb(var(--color-accent-rgb) / <alpha-value>)",
        // NewAigent dark brand (SaaS-global pages and the marketing landing). Fixed, never tenant-themed.
        mk: {
          bg: "rgb(var(--mk-bg-rgb) / <alpha-value>)",
          deep: "rgb(var(--mk-deep-rgb) / <alpha-value>)",
          surface: "rgb(var(--mk-surface-rgb) / <alpha-value>)",
          card: "rgb(var(--mk-card-rgb) / <alpha-value>)",
          raised: "rgb(var(--mk-raised-rgb) / <alpha-value>)",
          violet: "rgb(var(--mk-violet-rgb) / <alpha-value>)",
          "violet-light": "rgb(var(--mk-violet-light-rgb) / <alpha-value>)",
          indigo: "rgb(var(--mk-indigo-rgb) / <alpha-value>)",
          cyan: "rgb(var(--mk-cyan-rgb) / <alpha-value>)",
          amber: "rgb(var(--mk-amber-rgb) / <alpha-value>)",
          pink: "rgb(var(--mk-pink-rgb) / <alpha-value>)",
          blue: "rgb(var(--mk-blue-rgb) / <alpha-value>)",
          emerald: "rgb(var(--mk-emerald-rgb) / <alpha-value>)",
          red: "rgb(var(--mk-red-rgb) / <alpha-value>)",
        },
      },
      backgroundImage: {
        "mk-gradient": "linear-gradient(135deg, #7c3aed 0%, #4f46e5 55%, #06b6d4 100%)",
      },
      fontFamily: {
        sans: ["var(--font-family-base)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
