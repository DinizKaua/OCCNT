/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#f7f9fb",
        primary: "#002f5f",
        "primary-container": "#004587",
        secondary: "#526070",
        surface: "#f7f9fb",
        "surface-container": "#eceef0",
        "surface-container-low": "#f2f4f6",
        "on-surface": "#191c1e",
        "on-surface-variant": "#424750",
        outline: "#737782",
        error: "#ba1a1a",
      },
      fontFamily: {
        body: ["Inter"],
      },
    },
  },
  plugins: [],
}