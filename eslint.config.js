import eslint from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      /**
       * D-111.2 cierre FASE 6: los directorios de build EFÍMEROS de captura (`dist-fxlab`,
       * `dist-fxlab-2`, etc.) también son build generado — git ya los ignora con el patrón
       * dist-estrella, y el lint contaba 7 179 errores de ellos. Sólo esto: los 30 errores reales
       * de código fuente siguen en rojo y ahí se quedan hasta arreglarse.
       */
      "**/dist-*/**",
      "**/node_modules/**",
      "**/.cache/**",
      /**
       * Toolchain Python vendorizado de Blender (docutils, urllib3 y sus demos JS): no es código
       * del producto, no se edita a mano y por eso tampoco entra en el lint del repositorio.
       */
      "blender_artist/toolchain/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-console": "warn",
    },
  },
  {
    files: ["**/*.mjs", "eslint.config.js", "vite.config.ts", "vitest.config.ts"],
    languageOptions: {
      globals: {
        URL: "readonly",
        console: "readonly",
        process: "readonly",
        // Los smokes de Playwright evalúan este global dentro del navegador.
        indexedDB: "readonly",
      },
    },
  },
  {
    files: ["packages/simulation/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ["react", "react-dom", "phaser", "idb", "fake-indexeddb"],
          patterns: ["@landlord/web", "**/web/**"],
        },
      ],
      "no-restricted-globals": [
        "error",
        "document",
        "window",
        "indexedDB",
        "localStorage",
        "sessionStorage",
        "fetch",
        "crypto",
      ],
    },
  },
);
