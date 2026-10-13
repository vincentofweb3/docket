import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Source components import via the "@/..." alias (Next.js convention). Without this, any
    // test that imports a component fails to resolve, which is why earlier tests only touched
    // plain lib modules. jsconfig/tsconfig paths are not read by vitest.
    alias: {
      "@": dirname(fileURLToPath(import.meta.url)) + "/src",
    },
  },
});