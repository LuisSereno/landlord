# D-111.2 — Ledger de cierre (ejecución definitiva)

Ejecuta las fases pendientes sobre el baseline del runbook `D111-V2-VISUAL-QUALITY-RUNBOOK.md`
(WP00–WP08 ya ejecutados y commiteados). Tabla `Fase | Estado | Commit | Evidencia | Pendiente`.
Si una sesión se interrumpe, el siguiente agente continúa leyendo este archivo, el HEAD y el runbook.

Estado objetivo alcanzado: **`READY FOR HUMAN VISUAL REVIEW`** — sin promocionar nada a producción
(`runtime-promotions.json` intacto durante todo D-111.2). Validación final: diff-check, composer
valid (15+4), capabilities-valid (24), licencias, typecheck, vitest 43/43, build, smoke, índice
`--check` exit 0 (141 PNG, 0 duras, 12 legacy aislados), checker de anclajes OK.

## Baseline (verificado en FASE 1)

- Rama `wip/organization-headquarters`, HEAD `5d23a19`, árbol limpio, 8 commits de FASE 1–7
  del runbook SIN push (`8b42a64` F1, `9e95206` F2 + `d123a16` ledger, `b58f263` F3,
  `74a4ec2` F4, `f606813` F5, `62304dc` F6, `5d23a19` F7/WP08).
- Cuatro candidatas WP06 presentes en `blender_artist/manifests/building-composer-candidates.json`:
  `row_house` y `mixed_tenement` (perfil `gn_residential_v2`), `town_hall` (`ag_civic_v2`),
  `warehouse` (`gn_industrial_v2`).
- Módulos de fuego presentes: `apps/web/src/fx-lab/fx-fire.ts`, `fx-fire-anchors.ts`,
  `FxLabScene.ts`, `fx-effects.ts`, `fx-lab-types.ts`. Contrato de envejecimiento
  `building-weathering-contract.json` declara `aged`.
- Evidencia v2 existente: `evidence/v2/fire/` (control/candidata día/noche), `evidence/v2/urban/`
  (8 capturas + manifiesto), `evidence/INDEX.md` (108 PNG), cuatro hojas WP08.

## Fases

| Fase | Estado | Commit | Evidencia | Pendiente |
| --- | --- | --- | --- | --- |
| 1 · baseline y ledger | completada | `08e520c` | este archivo, verificación arriba | — |
| 2 · incendio híbrido Blender+Phaser | completada | `d364372` | `evidence/v2/closure/fire/` · `hybrid_fire_ab.png` + checker OK | revisión visual humana; 1/16 focos (`fire:flame:window:1`) sin llama visible en el bake |
| 3 · cuatro candidatas en Phaser | completada | `baa4de0` | `evidence/v2/closure/urban/` · `four_candidates_in_phaser{,_half}.png` + manifest | muestras QA sobre terreno del mundo real; parejas 1×/0,5×; revisión visual humana |
| 4 · envejecimiento vs daño | completada | `bff341a` | `evidence/v2/closure/condition/` · `building_condition_in_phaser.png` | `aged` cae en `complete` (D-080 pendiente); migración de assets aprobados requiere autorización |
| 5 · exposición nocturna definitiva | completada | `b9481af` | `evidence/v2/closure/night/` · `night_lighting_final_ab.png` + `mount_dismount.json` | sin ajustes nuevos: la calibración de la FASE 5 del runbook se sostiene (σ nocturno 91 % del día, 0 px de recorte a blanco salvo 13 en CANVAS) |
| 6 · evidencias y validadores | completada | `c9f1530` | índice `--check` exit 0 (141 PNG, 0 duras, 12 legacy aislados) · candidatas fuego re-render | 12 históricos sin procedencia quedan `legacy_unverified`; revisión visual de las hojas |
| 7 · WP09 y documentación | completada | `55c3329` | capabilities.json (24 entradas), guía §39, ADR D-111 enmendado, ART.md/ART-PIPELINE.md, citas §6.x reapuntadas | revisión del propietario |
| 8 · validación final y publicación | completada | `8c72d88` | informe corto al propietario | revisión visual humana de las hojas |

## FINAL-ASSET-QA (corrección final D-111.2, brief 2026-11-23, HEAD inicial `8c72d88`)

Objetivo: que las demostraciones de fuego/humo/daño usen la arquitectura WP06 y los edificios
legacy (`bld_*`) queden como controles históricos. Sin tocar `GameState`, promociones ni runtime.

Estado final: **`READY FOR HUMAN VISUAL REVIEW`** — las tres comparativas de cierre viven en
`evidence/v2/final-assets/` (`modern_building_fire_ab.png`, `modern_building_condition_ab.png`,
`modern_candidates_in_phaser.png`); `runtime-promotions.json` intacto verificado contra `8c72d88`.
Pendiente de revisión visual humana; la variante `aged` QA existe como proyección material pero el
runtime sigue sin sprite envejecido aprobado (D-080, decisión del propietario).

| Paso | Estado | Commit | Evidencia | Pendiente |
| --- | --- | --- | --- | --- |
| 0 · baseline y registro | DONE | `ba073fd` | esta sección | — |
| 1 · cuatro inconsistencias de auditoría | DONE | `b0c8de9` | ledger dedup · fixture `qaStates=damaged` → `ruin` + test · README sin contador · hueco WP06 eliminado · `zooms` desde capturas | — |
| 2 · mapa de procedencias + anti-sustitución | DONE | `83094b7` | `FINAL-ASSET-SOURCES.md` · `validateCandidateQa` en la ruta QA · `listCandidateQaErrors()` en la escena | — |
| 3 · variantes WP06 que faltan | DONE | `5d7b176` | `evidence/v2/candidates/wp06_{mixed_tenement-aged,mixed_tenement-damaged,warehouse-burning,warehouse-damaged}.{png,json}` · burning mixed_tenement reutilizado de `closure/fire/hybrid_sprite_*` (sha OK) · exclusión `Texture` en el contrato de weathering | — |
| 4 · demostraciones de incendio WP06 | DONE | `c93bdc7` | `evidence/v2/final-assets/modern_building_fire_ab.png` · 10 brazos día/noche (control legacy + mixed_tenement y warehouse intenso/moderado) · `fxFoci` QA · `wp06_warehouse-burning-day` | — |
| 5 · comparativa de conservación WP06 | DONE | `5e1a27f` | `evidence/v2/final-assets/modern_building_condition_ab.png` · mixed_tenement conservado/envejecido/dañado/en llamas a 2,5× (misma arquitectura) | — |
| 6 · validación, documentación y cierre | DONE | — | índice `--check` exit 0 (163 PNG, 0 duras, 12 legacy aislados) · capabilities-valid · composer valid (15+4) · licencias · typecheck · vitest 245/249 · smoke sin errores · README/ART.md/capabilities.json actualizados | — |

## Defectos heredados registrados en FASE 1 (sin regenerar evidencias antiguas)

1. Las 8 capturas `evidence/v2/urban/` marcan `LAVADA` por el HUD dentro del recorte
   (4,4–4,6 % de píxel blanco; 0,02–0,14 % sin la banda del HUD) — se resuelve en FASE 6.
2. 13 PNG anteriores a WP08 sin JSON hermano, motivo anclado en `evidence/INDEX.md` — FASE 6.
3. Las dos `fire/candidata_mixed_tenement_*` piden re-render tras el fix de cornisa de FASE 6
   del runbook — FASE 6.
4. `pnpm lint` rojo: 7 179 errores en `apps/web/dist-fxlab/` (gitignoreada; el `ignores` de
   `eslint.config.js` sólo casa `**/dist/**`) + 30 en diez ficheros ajenos — FASE 6.
5. La entrada `phaser_fx_lab` del README de capacidades dice «sin presets», contradicha por
   `f606813` — FASE 7.
6. Los rótulos §6.1/§6.2/§6.3 citados en código apuntan a secciones por escribir — FASE 7.
7. Sólo Centro Cívico cumple los siete contadores de WP08 (densidad del generador de mundo,
   fuera del alcance de este cierre).
8. `building-condition.ts` no tiene call site jugable; mover `condition < 60 ⇒ damaged` es la
   decisión D-080 del propietario — FASE 4 aplica la proyección nueva sin cambiar estados de dominio.
