import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appDir, "../..");

export default defineConfig({
  root: appDir,
  plugins: [react()],
  server: {
    host: "::",
    port: 8081,
    // OneDrive / cloud-synced folders on Windows often break native file watchers and reads.
    watch: {
      usePolling: true,
      interval: 1000,
    },
    fs: {
      allow: [repoRoot],
    },
  },
  publicDir: path.resolve(appDir, "./public"),
  resolve: {
    alias: {
      "@": path.resolve(appDir, "./src"),
      "@phinduloans/shared": path.resolve(appDir, "../../packages/shared/src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  build: {
    outDir: path.resolve(appDir, "./dist"),
    emptyOutDir: true,
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
});
