import { defineConfig } from "vite";

export default defineConfig({
  // O service worker é escrito à mão em public/sw.js (registrado em js/app.js).
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
