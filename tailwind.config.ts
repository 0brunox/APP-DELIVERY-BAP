import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Mapeadas para variáveis CSS definidas por loja (tema dinâmico)
        primary: "var(--primary)",
        "primary-dark": "var(--primary-dark)",
        secondary: "var(--secondary)",
        whatsapp: "#25d366",
      },
      fontFamily: {
        sans: ["var(--font)", "Poppins", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
