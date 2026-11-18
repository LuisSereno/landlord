# V.n — Mercado manual, solar/huella y patios de equipamientos (2026-11-18)

Decisión: D-109 (`docs/engineering/adr/D-109-mercado-manual-solar-y-patios.md`).
Plan del responsable del 2026-11-18 ejecutado sin compatibilidad con partidas anteriores.

## Estado: PASS WITH PENDING ART GATE

El código, los contratos, los tests de dominio y la documentación están cerrados y commiteados en
local (sin push). El rehorneado Blender de las variantes diurnas/nocturnas de los seis
equipamientos está **en curso** en tres lanes en segundo plano; la promoción, el QA de capturas y
la medición final del presupuesto D-101 quedan pendientes de que el lote termine. No se declara
READY ni se cierra la fase hasta completar esos gates.

## Commits locales (develop, sin push)

| Commit | Contenido |
|---|---|
| `2018fbd` | Base ajena commiteada por indicación del responsable: variantes noche, fauna/flora, velocidades 8×/16× |
| `acc0d33` | WP-A: mercado manual, household 60/6, caducidad exacta, UI de satisfacción y hub |
| `3a8eb63` | WP-B: siteFootprint/siteCells, generador v4, fix ids públicos, manifiesto procedural |
| `5851542` | Fixture alpha-phase4 regenerado por el productor |
| `6169122` | WP-D/E: patios, vehículos temáticos, props originales, fauna urbana/periférica |
| `f73e874` | WP-C: gramáticas de los seis equipamientos a la huella nueva |
| `38e634a` | Fixtures/digestos regenerados por medición, procedencia original, docs D-109 |

## Medición

- **Mercado (WP-A)**: `housing-market.test.ts` 26/26. Solicitudes disponibles al cierre siguiente,
  caducidad exacta a los seis meses, pool autorado sin caducidad, contratación sólo por
  `AssignTenant`, llegadas ≤ 6/mes y techo 60, segregación por segmento, modificadores de
  satisfacción (+2/−20/−10) y umbrales de salida (20/30) incluidos los bordes exactos.
- **Colocación (WP-B)**: `urban-civic.test.ts` verifica solar completo ⊇ huella física menor en los
  14 equipamientos, patio libre de obstáculos (sólo la huella bloquea paso/construcción) y programa
  municipal 14/7/14 intacto. `development-placement.test.ts` 32/32 con el tejido v4.
- **Patios y fauna (WP-D/E)**: `facility-courtyards.test.ts` 7/7 (vehículo temático por tipo, props,
  accesos libres, sin solapes, determinismo, exclusiones) y fauna en
  `gameplay-visual-adapter.test.ts` (gorriones 1–2 en patios válidos sin pisar reservas, fauna mayor
  excluida del núcleo construido, determinismo).
- **Suites finales**: ver `sim-final.log` / `web-final.log` / `shared-final.log` de la sesión;
  typecheck y build en verde; lint y arquitectura en verde.
- **Fixtures regeneradas por medición**: doce filas de distrito (generador v4), doce ciudades
  (envolvente 687–730, suelo público 14–16 con residuos D-106) y diez digestos dorados. Arrastraban
  BASELINE DEBT desde V.e (2026-11-03); el cambio de versión los invalida de forma visible (D-064).

## Atribución de fallos preexistentes (no los introduce ni los cierra D-109)

Medidos en worktree limpio en `2018fbd` (base commiteada):

1. `market-actionability.test.ts` — fixture sintético espera `merged: 1`, mide `merged: 2`.
2. `vd7a-multiparcel.test.ts` — L (acería con tres parcelas), rival con triplete y tripletes
   naturales por seed (42 en base; 1 y 2026 con tejido v4).
3. `art:external:check`, `art:coverage:audit:check`, `art:staging:validate` — rojos heredados de
   V.j (drift versionado, informe desfasado, 7 fuentes originales incompletas + PNG de spike).
4. **Presupuesto D-101**: la base ya excedía `maxBundleBytes` en 233.877 B con 17 violaciones por
   archivo (>1 MiB) en `blender-day/` y `docs/art/day-candidates/`. Los nueve PNG de los props
   originales añaden 476.900 B; el rehorneado con huella menor sustituye los PNG de base de los
   equipamientos y la medición final tras la promoción decide si hace falta excepción nombrada.

## Gate artístico pendiente (handoff)

1. **Horneado en curso**: tres lanes (`/tmp/bake-lane.sh lane1|lane2|lane3 …`) producen
   6 tipos × 6 estados × 4 orientaciones × 2 moods = 288 variantes en
   `docs/art/quality-vj/batch-facilities-v4/<lane>/<day|night>/<type>/` (fuera de Git, marcador
   versionado). Logs `/tmp/bake-<lane>-<mood>-<type>.log`. El lote nocturno de town_hall de la
   primera corrida falló con la gramática antigua; la lane actual lo rehornea con la gramática
   corregida (`f73e874`).
2. **Promoción** (al terminar las lanes): `bash scripts/promote-facilities-v4.sh` — copia el
   candidato complete@0 diurno a `docs/art/facilities-v4/candidates/`, actualiza
   `runtime-promotions.json`, ejecuta `art:blender:promote` (bundle con domainFootprint nuevo) y
   promociona variantes día y noche por familia con `--types` parcial; valida cada manifiesto.
3. **QA de capturas**: `pnpm qa:vn-facilities` — 12 capturas (6 tipos × día/noche) en
   `docs/art/golden/vn-facilities/` con `summary.json`; revisión visual del responsable.
4. **Gates finales**: `art:binaries:check` (medición final del bundle), suites completas,
   `art:building-composer:validate` por manifiesto, y commit de cierre con los artefactos
   promocionados. Push sólo al cerrar la fase, por decisión del responsable.

## Deuda que sigue abierta

- Playtest humano de V.d (checklist en el repo).
- Orientación física de dominio sin frames laterales (P2, D-094 §7).
- Huérfanos `vf_town_hall_1006*` en `variants/` (borrado decide el responsable).
- Siete fuentes `src_original_*` heredadas con procedencia incompleta y PNG de spike irrecuperable.