# Baseline de hardening de la rama actual — 2026-11-12

## Git

- Rama: `wip/vh-world-visual-foundation`.
- HEAD inicial: `a4194653ca7055eb4159cf85fbb0ed384fcba4c0`.
- Base común con `develop`: `b9356cf256d6039bac8b5887110677bfc8848de3`.
- Remoto: la rama local estaba un commit por delante de `origin/wip/vh-world-visual-foundation`.
- Working tree inicial: limpio.

Los commits recientes eran V.l.3–V.l.5c/D-104 y `a419465` (suelo vial y grado diurno).

## Resultado antes de correcciones

| Gate | Resultado | Evidencia |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS | lockfile actualizado, sin resolución |
| typecheck | PASS | tres proyectos TypeScript |
| lint + arquitectura | PASS | ESLint y `check-architecture` verdes |
| shared tests | PASS | 79/79 |
| multi-parcela focalizado | FAIL | 32/33; K no cruzaba la frontera interna |
| build web directo | PASS | Vite completó en 4,18 s |

La ejecución del `pnpm test` raíz inició la suite de simulation, cuyo baseline histórico ya era
costoso; se registró el fallo focalizado antes de modificar fixtures. El wrapper de scripts de pnpm
devolvió `ERR_PNPM_EXECUTOR_RUN_SCRIPT_SPAWN: EIO` durante algunos reintentos posteriores, mientras
los comandos directos equivalentes (`pnpm exec eslint`, `node scripts/check-architecture.mjs` y
`pnpm exec vite build`) sí se ejecutaron correctamente. Es un problema de runner a investigar, no se
ha interpretado como un test verde.

## Hallazgos reproducidos

1. El enumerador de huellas trataba la unión de parcelas como envelope, pero podía elegir una huella
   enteramente dentro de la primera parcela aunque `requiredParcels > 1`.
2. La resolución de clase de vía codificaba sólo «avenue gana». Al existir `motorway`, la precedencia
   no era completa ni estaba centralizada.
3. El adapter web recibía `laneSenses`, pero los vehículos elegían el sentido con hash independiente.

La corrección y el retest quedan registrados en el informe final de esta fase.
