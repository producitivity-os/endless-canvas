// packages/canvas/vite.config.ts

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: "playground",

  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@endless-canvas": fileURLToPath(new URL("./src", import.meta.url)),
    },

    dedupe: ["react", "react-dom"],
  },
});
