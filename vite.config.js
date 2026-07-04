import { defineConfig } from "vite";

export default defineConfig({
  // Garante que os caminhos no index.html final sejam relativos (./)
  base: "./",
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
