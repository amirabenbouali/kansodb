import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "frontend",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    fs: {
      allow: [".."]
    }
  },
  preview: {
    host: "127.0.0.1",
    port: 4173
  },
  build: {
    outDir: "../dist-frontend",
    emptyOutDir: true
  }
});
