import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

const appDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: appDir,
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
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
  },
});
