import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

const appDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: appDir,
  server: {
    host: "::",
    port: 8081,
  },
  esbuild: {
    jsx: "automatic",
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
