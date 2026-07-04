/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.html", "./js/**/*.js"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "sans-serif"] },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-fast": "pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "toast-progress": "toastProgress 3s linear forwards",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        toastProgress: {
          "0%": { width: "100%" },
          "100%": { width: "0%" },
        },
      },
      colors: {
        brand: {
          50: "#eff6ff", 100: "#dbeafe",
          500: "#3b82f6", 600: "#2563eb",
          700: "#1d4ed8", 900: "#1e3a8a",
        },
      },
    },
  },
  plugins: [],
};