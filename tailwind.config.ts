import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Lu bisa tambahin kustomisasi warna di sini nanti
    },
  },
  plugins: [
    require('@tailwindcss/typography'), // INI YANG BIKIN RAPI
  ],
};
export default config;