import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL("../../", import.meta.url));
const labHtml = fileURLToPath(new URL("../../char-scale-lab.html", import.meta.url));

export default defineConfig({
  root: webRoot,
  plugins: [react()],
  build: {
    outDir: "dist-character-scale-lab",
    emptyOutDir: true,
    rollupOptions: { input: labHtml },
  },
});
