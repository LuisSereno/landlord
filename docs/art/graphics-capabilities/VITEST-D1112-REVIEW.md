# VITEST-D1112-REVIEW — auditoría del resultado `245/249`

**Fecha:** 2026-11-23 · **HEAD auditado:** `d0fae6e` · **Rama:** `wip/organization-headquarters`

## Qué es el `245/249`

No son cuatro fallos. La cifra viene de la validación acotada de FASE 6 de FINAL-ASSET-QA:

```
pnpm exec vitest run apps/web/src/fx-lab apps/web/src/isometric --config vitest.config.ts
```

`apps/web/package.json` declara la suite completa como `vitest run --config ../../vitest.config.ts
apps/web/src` (421 passed | 4 skipped en esa cobertura); el `245/249` es el subconjunto de los dos
directorios tocados por D-111.2. Ejecución de diagnóstico con `--reporter=verbose`
(`/tmp/vitest-d1112.log`, código de salida **0**, una sola corrida):

- Tests passed: **245**
- Tests failed: **0**
- Tests skipped: **4**
- Tests todo: **0**
- Tests total: **249** (245 + 4 skipped)
- Resultado: **OK** (exit 0, 21 archivos passed | 1 archivo skipped de 22)

## Clasificación de los cuatro casos

Los cuatro son `skipped` **declarados y deliberados** (opt-in por variable de entorno), no fallos ni
`todo`. Viven en `apps/web/src/isometric/full-world-integration.test.ts` y preceden a D-111.2
(V.h.9/V.h.10, 2026-11-07).

| Prueba | Estado | Causa | Relación con D-111.2 | Acción | Resultado |
| --- | --- | --- | --- | --- | --- |
| `los 9 distritos generan un modelo visual con todas las capas y sin referencias rotas` | skipped | `{ skip: !process.env.VC9_FULLWORLD }` (línea 66): genera el mundo de 9 distritos, demasiado para la corrida ordinaria | ninguna — preexiste (V.h.9) | sin cambios; se ejecuta con `VC9_FULLWORLD=1` cuando se toca la generación de mundo | opt-in aceptable; el brief de FINAL-ASSET-QA prohibía precisamente generar el mundo completo |
| `el modelo visual del mundo completo es determinista (mismo estado → mismo mundo)` | skipped | misma puerta `VC9_FULLWORLD` (línea 160) | ninguna — preexiste | sin cambios | opt-in aceptable |
| `los distritos cívico e industrial visten distinto (perfiles §11 aplicados)` | skipped | misma puerta `VC9_FULLWORLD` (línea 172) | ninguna — preexiste | sin cambios | opt-in aceptable |
| `snapshot de performance (§26): textures/sprites y tiempo de generación de los 9 distritos` | skipped | `{ skip: !process.env.VH10_PERF }` (línea 212) | ninguna — preexiste (V.h.10) | sin cambios | opt-in aceptable; además, en esta máquina sin GPU el 5 % de rendimiento no es evaluable (medición documentada en el cierre) |

## Conclusión

- **0 pruebas fallidas**: no hay ningún fallo de D-111.2 que corregir; no se modificó ningún test.
- Los 4 skips son un mecanismo visible en el código (condición de entorno + motivo de coste), no
  ocultamiento: se ejecutan explícitamente cuando el trabajo toca la generación de mundo, y este
  trabajo gráfico no la toca.
- El resultado de la batería gráfica de D-111.2 es verde sin excepciones artificiales.
