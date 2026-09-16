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
        // Verde institucional (inspirado no padrão eDoc Forms da Câmara dos
        // Deputados), para que nenhuma classe brand-{n} usada no HTML/JS
        // fique sem CSS gerado.
        brand: {
          50: "#f1f6ef",
          100: "#dfeada",
          200: "#bfd5b6",
          300: "#98ba8c",
          400: "#729d63",
          500: "#517f44",
          600: "#3d6432",
          700: "#325228",
          800: "#294321",
          900: "#1f331a",
          950: "#111f0e",
        },
        // Dourado de destaque (linha divisória / realces do estilo eDoc).
        gold: {
          400: "#e0be5c",
          500: "#c9a227",
          600: "#a9861d",
        },
      },
    },
  },
  plugins: [],
};
