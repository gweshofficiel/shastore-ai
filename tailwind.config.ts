import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./templates/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        muted: "#64748b",
        line: "#e2e8f0",
        canvas: "#f8fafc"
      },
      boxShadow: {
        soft: "0 24px 80px -40px rgba(15, 23, 42, 0.35)"
      }
    }
  },
  plugins: []
};

export default config;
