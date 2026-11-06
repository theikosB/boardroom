import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(root, "src"),
      "@boardroom/shared": resolve(root, "../shared/src/index.ts"),
    },
  },
  server: {
    host: true,
    port: 5174,
    strictPort: true,
    proxy: {
      "/socket.io": {
        target: "http://127.0.0.1:4010",
        ws: true,
      },
      "/health": "http://127.0.0.1:4010",
    },
  },
  preview: {
    host: true,
    port: 4174,
    strictPort: true,
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
