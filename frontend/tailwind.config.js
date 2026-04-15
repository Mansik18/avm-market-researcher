/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f8fafc",
        panel: "#ffffff",
        border: "#e5e7eb",
        accent: "#10a37f",
      },
    },
  },
  plugins: [],
};
