import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)));

export default defineConfig({
  root: repositoryRoot,
  test: {
    environment: "node",
    /**
     * V.d multiplica por nueve el mundo y V.d.1 lo llena con ~800 parcelas multi-cell por ciudad:
     * varios tests crean cinco o siete estados y, con los ficheros en paralelo, superaban los 20 s.
     * Los gates de rendimiento se miden en sus propios harness, no aquí; 60 s sólo evita que un
     * test correcto muera por contención de CPU.
     */
    testTimeout: 60_000,
    /**
     * V.d.1 llena cada ciudad con ~800 parcelas y cada test que crea un estado reserva más memoria
     * y CPU. Con un worker por núcleo (8 aquí) los ficheros se estrangulaban entre sí y tests
     * correctos morían por inanición; cuatro workers mantienen la suite paralela sin ahogar la RAM.
     */
    maxWorkers: 4,
    include: ["apps/**/*.test.ts", "apps/**/*.test.tsx", "packages/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    passWithNoTests: true,
  },
});
