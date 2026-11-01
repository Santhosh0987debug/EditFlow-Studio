import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const rootEnvDir = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootEnvDir, "");
  const apiProxy = {
    "/api": {
      target: env.VITE_API_PROXY_TARGET ?? "http://localhost:3001",
      changeOrigin: true,
    },
  };

  return {
    envDir: rootEnvDir,
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: apiProxy,
    },
    preview: {
      port: 4173,
      proxy: apiProxy,
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
    },
  };
});
