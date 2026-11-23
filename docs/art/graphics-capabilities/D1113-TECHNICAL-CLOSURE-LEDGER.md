# D-111.3-T · Cierre técnico y reproducibilidad — Ledger

Rama: `wip/organization-headquarters` · HEAD inicial: `743aea4` (D-111.3 FASE 8)
Baseline artístico de referencia: `cd7bb6b` (pre-D-111.3)

Este ledger permite que otro agente continúe sin la conversación original.
Brief: D-111.3-T (cierre técnico) + AMPLIACIÓN OBLIGATORIA de FASE 1 (eliminación
comprobable de franjas negras/verdosas en fachadas, no basta hash nuevo).

## Registro de fases

| Fase | Estado | Commit | Archivos | Evidencia | Bloqueos |
|---|---|---|---|---|---|
| 0 · Baseline y registro de problemas | DONE | (este commit) | este ledger | mediciones abajo | — |
| 1 · GLB ventana GN + eliminación de franjas | DONE | (este commit) | `gn_window_bay_2m.glb`, `gn_facade_system.blend`, `gn-facade-report-seed7.json`, catálogo/inventario/estilo/pines, `building_composer/scene.py` (`strip_baked_vertex_lighting`), `scripts/d1113t-facade-lab.py`, `d1113t-facade-lab2.py`, `d1113t-facade-final-sheet.py`, candidatas doradas mixed/row | `evidence/d1113/technical/`: `facade_black_green_artifacts_final_ab.png`, `facade_black_green_artifacts_diagnosis.md`, `facade_black_green_metrics.json`, `gn_window_source_fix.json`, `gn_window_rebuild_ab.png`, `facade_lab/` (12 celdas day), `facade_states/` (o90), `controls_d1112/` | franja = `COLOR_0` horneado del export Godot (no sombra); 0 px tras corrección; tests candidatos OK |
| 2 · Variantes daño/incendio sin referencias inválidas | DONE | (este commit) | `compose.py` (`_compose_damage_interior`: sin bloque de palés muerto; pilares `mod_megakit_column_metal_bottom` en nave industrial a cota 0), `scripts/d1113t-damage-consistency.py`, 4 variantes en `evidence/d1113/interiors/` | `damage_module_consistency.json` (0 refs inválidas, interiores en región, warehouse 19=19 focos idénticos; mixed burning 19=19 con variación justificada por offset de anclaje del vano corregido), `technical/damage_fire_states_regenerated_ab.png`, controles D-111.3 en `technical/controls_d1113/` | limitación documentada: sin módulo legal para estanterías/mercancía (§22) |
| 3 · Eliminar dependencias de /tmp + metadatos aged | DONE | (este commit) | `d1113-phaser-capture.mjs` (sprites versionados; `sourceSpriteSha256` ≠ `canvasCaptureSha256` + verificación del sprite servido), 6 hojas `d1113-*-sheet.py` reorientadas a rutas Git, aged V3 regenerado con metadata completa (`weathering/w06cnd_mixed_tenement_2_aged.{png,json}`, viejo archivado como `controls_d1113/aged_v3_d1113.png`), `scripts/d1113t-reproducibility-manifest.py` | `technical/reproducibility_manifest.json` (entradas+SHA-256+mandatos; notas de mood y determinismo de píxel), verificación: ningún input de las hojas vive ya en /tmp | el lote multi-candidato en un proceso puede dejar en blanco el 2º PNG (documentado; las corridas de evidencia usan un proceso por candidato) |
| 4 · Evidencias Phaser (1×/0,5×, noche real, daño) | DONE | (este commit) | `scripts/d1113t-phaser-capture.mjs` (14 brazos QA; hash del sprite servido contrastado con el PNG y con la metadata publicada; `sourceSpriteSha256` ≠ `canvasCaptureSha256`; `captureMode: art-lab-qa-candidate-scene`), `scripts/d1113t-phaser-sheets.py`; sprites town_hall/warehouse regenerados contra el pipeline FASE 1 (viejos archivados en `controls_d1113/`) | `technical/d1113_technical_city_1x.png`, `d1113_technical_city_05x.png`, `d1113_technical_night.png` (fxPreset=night_balanced verificado por sonda: preset activo, mood night, 4 luces), `d1113_technical_damage_fire.png` (variantas FASE 2), `d1113_technical_phaser_manifest.json` (0 aserciones fallidas, 0 errores de página), `phaser_captures/` (14 PNG+JSON) | — |
| 5 · Auditoría individual de los 52 errores del validador | PENDING | — | — | — | — |
| 6 · Cierre documental, validaciones y push | PENDING | — | — | — | — |

## FASE 0 — Verificaciones de baseline (sin regenerar PNG)

1. **Rama/HEAD/árbol**: `wip/organization-headquarters` @ `743aea4`, árbol limpio
   (métricas `vf-building-composer-metrics.json` restauradas en el cierre de D-111.3).
2. **`runtime-promotions.json`**: `git diff --stat cd7bb6b..743aea4` sobre ese archivo
   está vacío → D-111.3 no lo modificó. ✔
3. **Evidencias D-111.3 presentes** en `docs/art/graphics-capabilities/evidence/d1113/`
   (facade_diagnosis, facades/, interiors/, weathering/, townhall/, final/, damage/fire/ageing
   A/B en raíz). ✔

### Los cinco problemas confirmados

| # | Problema | Evidencia medida |
|---|---|---|
| P1 | **GLB de ventana GN no actualizado.** `gn_facade_grammar.py` tiene la corrección de carpintería (commit `4a48cc8`), pero el GLB publicado no se regeneró. | Blob git de `blender_artist/sources/original/gn_window_bay_2m.glb` idéntico en `cd7bb6b` y `743aea4` (`9c7df2c3515216c39f6805aa3cbedcec5bda4762`). SHA-256 working: `4cc900cf…5b49`. El Composer consume el GLB, no ejecuta el generador. |
| P2 | **Variantes publicadas referencian módulo eliminado.** `mod_kenney_pallet` ya no está en `building-modules.json` (0 ocurrencias) pero sí en las composiciones de daño/incendio. | `interiors/w06cnd_mixed_tenement_2_burning.json` (10 refs), `interiors/w06cnd_mixed_tenement_2_damaged.json`, `damaged_interior_mixed_tenement_ab.json`. Irreproducibles con catálogo actual. |
| P3 | **Capturas dependientes de /tmp.** 7 scripts D-111.3 leen/leen rutas bajo `/tmp/d1113/`: `d1113-damage-fire-sheet.py`, `d1113-facade-diagnosis.py`, `d1113-facade-fix-sheet.py`, `d1113-interior-sheet.py`, `d1113-phaser-capture.mjs`, `d1113-townhall-sheet.py`, `d1113-weathering-sheet.py`. Un checkout limpio no las tiene. | grep sobre `scripts/d1113-*` |
| P4 | **Evidencia Phaser incompleta + aged V3 sin JSON.** `evidence/d1113/weathering/` sólo tiene PNG (`aged_v2.png`, `aged_v3.png`, `conserved.png`), sin JSON de composición (`candidateId`, `compositionSignature`, semilla, mood, SHA-256) que la QA necesita. Las capturas Phaser de FASE 7 no cubren sistemáticamente 1× y 0,5× de los 4 candidatos ni acreditan el preset `night_balanced` activo. | `ls evidence/d1113/weathering/` · revisión de `d1113-phaser-capture.mjs` |
| P5 | **Validador con 52 errores sin clasificación individual.** `node scripts/validate-building-modules.mjs` cierra con 52 fallos; D-111.3 alegó preexistencia por diff de catálogo pero no hay tabla módulo-por-módulo contra baseline. | informe D-111.3 FASE 8 · pendiente `D1113-VALIDATOR-AUDIT.md` (FASE 5) |

### Nota de la ampliación de FASE 1

El propietario confirma que **las franjas negro-verdosas siguen visibles** en
`mixed_tenement` (seed 2) y `row_house` (seed 17) pese a la corrección de
`4a48cc8`. Esto es coherente con P1: la corrección vive en el generador pero el
GLB publicado —y por tanto los renders de evidencia— nunca la incorporaron.
FASE 1 debe terminar con A/B 1×/0,5× donde el defecto haya **desaparecido a la vista**,
no con hashes distintos.
