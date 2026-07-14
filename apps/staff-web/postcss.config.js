import path from "path";
import { fileURLToPath } from "url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

export default {
  plugins: {
    tailwindcss: { config: path.resolve(appDir, "./tailwind.config.ts") },
    autoprefixer: {},
  },
};
