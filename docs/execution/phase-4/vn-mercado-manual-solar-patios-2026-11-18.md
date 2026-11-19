# V.n — Mercado manual, solar/huella y patios de equipamientos (2026-11-18)

Decisión: D-109 (`docs/engineering/adr/D-109-mercado-manual-solar-y-patios.md`).
Plan del responsable del 2026-11-18 ejecutado sin compatibilidad con partidas anteriores.

## Estado: PASS WITH PENDING HUMAN VISUAL GATE

Código, contratos, tests de dominio, arte promocionado y documentación cerrados y commiteados en
local (sin push). Las 288 variantes día/noche están horneadas, validadas (§13/§17/§24/§25 por
manifiesto) y promocionadas; las 12 capturas QA (6 tipos × día/noche) viven en
`docs/art/golden/vn-facilities/` con `summary.json` (0 errores de página). Falta la revisión visual
humana del responsable y el playtest de V.d; no se declara READY ni se hace push.

**Deuda visual P2 medida en las capturas:** en patios en L (p. ej. bomberos 4×2 con edificio 3×1)
el vehículo temático queda parcialmente oculto por el propio edificio: el ancla/pivote del sprite
1×2 y su orden de profundidad necesitan ajuste fino por asset para las plazas en la cara +X. Las
celdas reservadas, exclusiones y determinismo sí cumplen (tests de modelo en verde). El resto de
props (monumento, asta, bancos, jardineras, bolardos, zona de juegos, puestos) se leen en las
capturas diurnas y nocturnas.

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
- **Suites finales**: web 393/393 (4 skipped), shared 80/80, typecheck y build en verde; lint y
  arquitectura en verde. Simulación: 619 en verde con las fixtures regeneradas; el test de
  determinismo de `district-generation` dio timeout de 60 s (61,2 s) sólo bajo la contención de CPU
  de las tres lanes Blender y pasa en solitario en 19,8 s (12/12): artefacto de carga, no regresión.
  Los cinco fallos restantes son los preexistentes atribuidos abajo.
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
4. **Presupuesto D-101 medido tras la promoción**: bundle `runtime/blender` = 22.617.525 B,
   1.499.723 B por debajo del límite de 23 MiB (la base lo excedía en 233.877 B; los props añadían
   476.900 B y el rehorneado con huella menor los compensó con creces). Quedan 16 violaciones por
   archivo (>1 MiB), todas en artefactos heredados de la promoción diurna anterior (`blender-day/`,
   `docs/art/day-candidates/`); ningún PNG nuevo supera 1 MiB. Borrado o excepción: decide el responsable.

## Gate artístico ejecutado (queda revisión humana)

- Lote completo: 288 variantes (6 tipos × 6 estados × 4 orientaciones × día/noche) en
  `docs/art/quality-vj/batch-facilities-v4/` (fuera de Git, marcador versionado). Los tres lotes
  diurnos abortados por §26 se recuperaron de staging con `scripts/recover-staging-v4.py`.
- Actas §13 por tipo/mood (`regenerate/regenerate.json`): 11 con jitter GPU en cota y 1 byte-idéntica;
  validador por manifiesto 12/12 en verde (§17 acepta huella rotada, §25 acepta los estados del
  contrato de variantes; 52/52 casos del validador).
- Promoción ejecutada con `scripts/promote-facilities-v4.sh`: bundle con domainFootprint nuevo y
  144 variantes diurnas + 144 nocturnas sustituidas por familia (312 preservadas por catálogo).
- QA: `pnpm qa:vn-facilities` → 12 capturas en `docs/art/golden/vn-facilities/` + `summary.json`,
  0 errores de página. El script recorre los nueve distritos porque el programa municipal es de
  ciudad, no por distrito.
- Pendiente: revisión visual humana de las capturas (deuda P2 del vehículo en patios en L arriba)
  y playtest de V.d. Push sólo con decisión del responsable.

## Deuda que sigue abierta

- Playtest humano de V.d (checklist en el repo).
- Orientación física de dominio sin frames laterales (P2, D-094 §7).
- Huérfanos `vf_town_hall_1006*` en `variants/` (borrado decide el responsable).
- Siete fuentes `src_original_*` heredadas con procedencia incompleta y PNG de spike irrecuperable.