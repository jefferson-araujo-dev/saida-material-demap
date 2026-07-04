import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json,vue,txt,woff2}"],
      },
      manifest: {
        name: "Gestão de Materiais | COENG",
        short_name: "Gestão COENG",
        description: "Sistema de gestão de saída de materiais do DEMAP.",
        theme_color: "#0f172a",
        background_color: "#f8fafc",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "assets/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "assets/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "assets/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  base: "/", // Caminhos absolutos são melhores para PWA e roteamento
  server: {
    port: 1804,
    open: true, // Abre o navegador automaticamente
  },
  build: {
    outDir: "dist", // Pasta onde os arquivos minificados serão salvos
    emptyOutDir: true,
    target: "esnext", // Gera o menor código possível usando sintaxe moderna
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            return "vendor"; // Separa bibliotecas externas em um arquivo próprio
          }
        },
      },
    },
  },
});
