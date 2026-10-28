import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)));

export default defineConfig({
  root: repositoryRoot,
  test: {
    environment: "node",
    /**
     * V.d multiplica por nueve el mundo: las campañas de balance y los escenarios de conservación
     * tardan varios segundos y antes chocaban con los 5 s por defecto cuando vitest ejecutaba
     * ficheros en paralelo. Un cuelgue real sigue saltando, sólo que a los 20 s.
     */
    testTimeout: 20_000,
    include: ["apps/**/*.test.ts", "apps/**/*.test.tsx", "packages/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    passWithNoTests: true,
  },
});
