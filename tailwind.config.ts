import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Di sini lu bisa nambahin kustomisasi warna atau font nantinya
    },
  },
  plugins: [
    require('@tailwindcss/typography'), // Penting buat ngerapiin format teks Markdown
  ],
};
export default config;