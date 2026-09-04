import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["hafiza.svg"],
      manifest: {
        name: "Hafiza",
        short_name: "Hafiza",
        description: "Local-first flashcards and spaced repetition",
        theme_color: "#4438a3",
        background_color: "#f7f5f0",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/hafiza.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@app": path.resolve(rootDirectory, "src/app"),
      "@modules": path.resolve(rootDirectory, "src/modules"),
      "@shared": path.resolve(rootDirectory, "src/shared"),
      "@test": path.resolve(rootDirectory, "src/test"),
    },
  },
});
