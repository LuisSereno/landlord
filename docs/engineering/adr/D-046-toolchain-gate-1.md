# D-046 — Toolchain de Gate 1

Estado: Aceptada  
Fecha: 2026-10-20  
Alcance: Gate 1

## Contexto

El repositorio no contiene todavía manifests, lockfile ni código. Gate 1 necesita una cadena reproducible compatible con aplicación web, simulación TypeScript headless, Web Worker, IndexedDB y pruebas en dos motores de navegador.

## Decisión

| Componente | Versión fijada |
|---|---:|
| Node.js | `24.19.0` |
| pnpm | `12.11.2` |
| TypeScript | `6.0.3` |
| Vite | `8.3.4` |
| React | `19.2.8` |
| Phaser | `4.2.1` |
| `@vitejs/plugin-react` | `6.1.2` |
| Vitest | `4.1.10` |
| Playwright | `1.64.1` |
| `fake-indexeddb` | `6.2.6` |
| Zod | `4.4.3` |
| ESLint | `10.8.0` |
| `typescript-eslint` | `8.66.0` |
| `eslint-plugin-react-hooks` | `7.1.1` |
| Prettier | `3.9.6` |

El futuro manifest raíz declarará:

- `packageManager: "pnpm@12.11.2"`;
- `engines.node: ">=24.19.0 <25"`;
- versiones exactas, sin `^` ni `~`;
- instalación congelada en CI.

Se usará pnpm workspaces sin Turborepo, Nx ni Lerna. TypeScript operará en modo `strict`. `packages/simulation` usará `lib: ["ES2023"]` sin DOM. ESLint con flat config prohibirá imports de React, Phaser, adapters DOM e IndexedDB desde simulation.

GitHub Actions ejecutará instalación, lint, typecheck, tests, build y E2E en Chromium y Firefox. Playwright gestionará sus navegadores de CI.

## Alternativas descartadas

- npm workspaces: válido, pero pnpm ya está disponible y ofrece filtros y workspace estricto con menor coste de instalación.
- Turborepo/Nx: no existe carga que justifique otra capa de orquestación.
- TypeScript `7.0.2`: descartado porque `typescript-eslint 8.66.0` declara compatibilidad anterior a `6.1.0`.
- Jest: Vitest encaja directamente con Vite/TypeScript y cubre el runner headless.
- Un único navegador: no detectaría divergencias tempranas entre Chromium y Firefox.

## Consecuencias

- Gate 1 empieza con versiones reproducibles, no con rangos flotantes.
- Actualizar una dependencia es una tarea separada con sus checks.
- Node 25 o versiones posteriores requieren una revisión explícita.
- Esta decisión documenta versiones; no declara que estén instaladas en el repositorio.

## Condición de revisión

Revisar si una versión fijada contiene una vulnerabilidad relevante, deja de resolver desde el registro, resulta incompatible con otra versión fijada o bloquea un criterio de Gate 1.
