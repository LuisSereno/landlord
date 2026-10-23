# WP4.1 — Distritos y generación reproducible — 2026-10-23

## Estado

`DONE`. Misma versión, perfil y seed generan el mismo distrito, y la variación generada no rompe
el core loop. Decisión de diseño registrada en
`docs/engineering/adr/D-064-generacion-procedural-de-distritos.md`.

## Resultado

- El suelo deja de estar congelado en `game-data.ts`: `PROTOTYPE_PARCELS` desaparece y el distrito
  se construye desde perfiles data-driven (`DistrictProfile`) con anclas autoradas y expansión
  procedural.
- Tres perfiles originales con composición propia: `barrio_del_umbral` (continuidad con Fase 3, sin
  obstáculos), `vega_del_cauce` (mixto con obstáculos) y `ensanche_ferroviario` (sesgo industrial,
  manzanas mayores).
- Las anclas se emiten primero y en orden de perfil, así que las parcelas de referencia conservan
  id, celda, zoning, precio y aptitud para cualquier seed; sólo la expansión varía.
- La generación consume un flujo PRNG derivado de la seed y del perfil. El PRNG autoritativo de la
  partida no se desplaza: `createInitialState(seed).prng` sigue siendo idéntico a
  `createPrng(seed).exportState()`.
- Identidad persistente separada de representación: `District.generation = { profileId,
  generatorVersion, seed }`, aditivo y opcional en `SnapshotV1` (`schemaVersion: 1` intacto). No se
  persisten tiles, sprites ni calles.
- Validación de jugabilidad por intento: mínimo de parcelas, mínimo por zoning, concentración
  máxima, parcela asequible, celdas duplicadas, separación ortogonal, spawns bloqueados y acceso
  alcanzable por BFS desde ambos spawns. Doce intentos como máximo y `DistrictGenerationError` con
  códigos de issue si no converge.
- Los obstáculos reutilizan `map.blockedCells`, ya persistido y ya consumido por el pathfinding;
  las celdas de plantilla (`rosterLayout`) y las parcelas quedan reservadas antes de colocarlos.
- `createInitialState`, `runScenario` y `restoreStateFromSnapshot` aceptan perfil de distrito. La
  restauración reconstruye los valores por defecto con el perfil guardado, no con el perfil por
  defecto.
- `ENGINE_VERSION` pasa a `phase4-dev`; las partidas guardadas anteriores, sin `generation`, siguen
  cargando.
- Herramienta de reproducción: `pnpm district:inspect` con `DISTRICT_PROFILE` y `DISTRICT_SEED`,
  que imprime informe por distrito (hash, intentos, parcelas, anclas, bloqueadas, zoning, precios,
  spawns, listado de parcelas) y el literal de fixtures listo para pegar.

## Evidencia

### Evidence

- `packages/simulation/src/district-profiles.ts`: perfiles, `rosterLayout`, `ZONING_ORDER`,
  `DISTRICT_GENERATOR_VERSION` y resolución de perfil con error explícito.
- `packages/simulation/src/district-generator.ts`: composición, bolsa de zoning, validación de
  jugabilidad, cadena canónica, hash FNV-1a, informe y error de generación.
- `packages/simulation/src/district-fixtures.ts`: doce instantáneas reproducibles (tres perfiles ×
  seeds 1, 7, 42 y 1337) con hash, recuento de parcelas, anclas, celdas bloqueadas y zoning.
- `packages/simulation/src/district-generation.test.ts`: doce pruebas (reproducibilidad, estado
  inicial determinista y PRNG intacto, variación con anclas estables, perfiles distintos con la
  misma seed, barrido de jugabilidad y topología, fixtures, core loop sobre distrito generado,
  escenarios con perfil explícito, persistencia, partida legacy sin `generation`, perfil imposible
  y perfil desconocido).
- `packages/simulation/src/district-inspect.test.ts`: inspector opt-in por variable de entorno.
- `packages/shared/src/domain.ts`: `DistrictGeneration` y `districtGenerationSchema` aditivos.
- `packages/simulation/src/state.ts`, `runner.ts` y `snapshot.ts`: cableado del perfil.

### Finding

El distrito deja de ser un dato fijo sin que la evidencia anterior pierda validez: la composición
de referencia vive ahora en el perfil y la variación se concentra en la expansión. La validación de
jugabilidad detectó un fallo real durante el desarrollo (la bolsa de zoning se cortaba antes de
mezclarse y todas las manzanas heredaban el primer zoning, lo que provocaba
`ZONING_CONCENTRATION`), que habría pasado desapercibido sin el validador.

### Path

`perfil -> seed derivada -> anclas autoradas -> manzanas procedurales -> obstáculos -> validación
de jugabilidad -> hash -> estado inicial -> comandos/sistemas -> snapshot con identidad de
generación`

## Verificación reproducible

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm smoke:phase2
pnpm smoke:art-lab
pnpm check:architecture
pnpm district:inspect
DISTRICT_INSPECT=1 DISTRICT_SEED=$(seq -s, 1 40) pnpm district:inspect
```

Resultado observado:

- Typecheck de los tres paquetes en verde.
- Suite completa: 23 tests en shared, 96 en simulation y 17 en web. Cuatro pruebas opt-in siguen
  omitidas (`benchmark`, `soak`, `audit:metrics` y el inspector de distritos). Ninguna aserción
  económica de Gate 2 o Fase 3 se modificó.
- Build de `apps/web` correcto, con el aviso informativo conocido sobre el tamaño del bundle.
- Smoke de navegador de Gate 2 (`exit 0`) y smoke de Art Lab (`status: passed`) sobre el distrito
  generado.
- Guarda de arquitectura en verde: la generación vive en `packages/simulation` sin dependencias de
  UI ni globales de navegador.
- Barrido del inspector: 3 perfiles × 40 seeds = 120 distritos válidos, 120 hashes distintos, cero
  issues. Intentos de composición media 1.69 y máximo 8; por perfil, `barrio_del_umbral` media 1.52
  y 16-38 parcelas, `ensanche_ferroviario` media 1.50 y 32-68 parcelas con 4-17 celdas bloqueadas,
  `vega_del_cauce` media 2.05 y 18-61 parcelas con 5-26 celdas bloqueadas.
- Core loop sobre distrito generado (`vega_del_cauce`, seed 1337): compra de `parcel_00000011` en
  (7,13) por 729 más 11 de tasa de transmisión, obra terminada en el tick 4801, inquilino asignado
  y renta cobrada en el límite mensual, con la caja pasando de 8260 a 8396 y 39 transacciones
  auditables.
- Lint en verde sobre el código versionado (`pnpm exec eslint packages apps scripts`) y sobre la
  guarda de arquitectura.

## Deuda detectada no corregida en este WP

- `pnpm lint` falla en local por `blender_artist/toolchain/`, que está en `.gitignore` pero no en
  los `ignores` de `eslint.config.js`. No afecta a CI porque esa carpeta no se versiona.
- `pnpm format:check` falla con tres ficheros ya commiteados sin formatear
  (`apps/web/src/isometric/IsometricSpikeScene.ts`, `scripts/art-lab-browser-smoke.mjs`,
  `scripts/validate-visual-direction-spike.mjs`). Es anterior a WP4.1 y reproduce el fallo en CI.
- `canonicalizeState` es sensible al orden de claves JSON, y un estado restaurado construye los
  agentes en otro orden que uno nuevo. Es anterior a WP4.1 y sólo afecta a la comparación canónica
  entre partida fresca y partida cargada; los tests de WP4.1 comparan de forma estructural.

## Fuera de alcance

No se implementan representación visual del distrito, calles o aceras, varios distritos por
partida, selección de distrito desde la interfaz, migración de perfiles retirados ni LOD de
simulación. Las calles y la identidad visual corresponden a WP4.15; el LOD a WP4.2; los servicios y
la accesibilidad a WP4.6. La instrumentación persistente de sesiones de Alpha sigue diferida por
D-063 y debe cerrarse antes de WP4.16.
