import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

export default defineConfig({
  plugins: [react(), {
    name: "validate-hermes-documentation",
    apply: "build",
    buildStart() {
      const guide = readFileSync(new URL("../../docs/hermes-agent.md", import.meta.url), "utf8");
      const routes = ["/api/agent/messages", "/api/agent/media/search", "/api/agent/media/recent", "/api/agent/watch-history", "/api/agent/openapi.json", "/api/agent/tmdb?path=", "/api/agent/tmdb/catalogue"];
      if (guide.includes("Documentation à compléter") || routes.some((route) => !guide.includes(route))) {
        this.error("La documentation Hermes est incomplète. Restaurez docs/hermes-agent.md depuis le dépôt avant de construire l’application.");
      }
    }
  }],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true
      }
    }
  }
});
