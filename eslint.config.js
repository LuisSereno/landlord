import eslint from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/.cache/**"],
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
