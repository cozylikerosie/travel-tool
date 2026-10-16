import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const pagesBase =
  process.env.VITE_BASE_PATH ??
  (process.env.GITHUB_ACTIONS === "true" &&
  repositoryName &&
  !repositoryName.endsWith(".github.io")
    ? `/${repositoryName}/`
    : "/");

export default defineConfig({
  base: pagesBase,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "個人旅行工具",
        short_name: "旅程",
        description: "在地管理個人旅程",
        lang: "zh-Hant",
        theme_color: "#F7F5F0",
        background_color: "#F7F5F0",
        display: "standalone",
        start_url: pagesBase,
        scope: pagesBase,
        icons: [
          {
            src: `${pagesBase}icon.svg`,
            sizes: "any",
            type: "image/svg+xml",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
      },
    }),
  ],
});