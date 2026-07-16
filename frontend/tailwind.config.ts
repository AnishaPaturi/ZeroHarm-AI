import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./component/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        heading: ["var(--font-space-grotesk)", "sans-serif"],
        mono: ["var(--font-space-mono)", "monospace"],
      },
      colors: {
        safety: {
          orange: "#F97316", // safety orange
          orangeMuted: "#EA580C",
        },
        brand: {
          navy: "#020617", // slate-950
          darkSlate: "#0F172A", // slate-900
          accentBlue: "#2563EB", // industrial blue
          accentBlueMuted: "#1D4ED8",
          glassBorder: "rgba(255, 255, 255, 0.1)",
          glassBg: "rgba(255, 255, 255, 0.04)",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
