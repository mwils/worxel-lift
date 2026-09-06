import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "prompt": a new build installs in the background and waits; the
      // UpdatePrompt component shows a "New version — Refresh" toast and calls
      // updateServiceWorker() to activate it. autoUpdate reloaded the page under
      // the owner mid-task and only ever checked on page load, so a tablet left
      // open sat on a stale bundle indefinitely (QA round-2 H3).
      registerType: "prompt",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Lift",
        short_name: "Lift",
        description: "Shop management for independent auto repair",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: /\/(repair-orders|customers|messages)/,
            handler: "NetworkFirst",
            options: { cacheName: "lift-api", networkTimeoutSeconds: 3 },
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
});
