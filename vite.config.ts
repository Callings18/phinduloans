import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/** Legacy root Vite config — prefer apps/staff-web and apps/borrower-mobile. */
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
});
