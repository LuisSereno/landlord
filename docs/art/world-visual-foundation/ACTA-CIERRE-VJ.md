# Acta de cierre — WP4.15-V.j (visualización completa del mundo)

- **Fecha:** 2026-11-09. **Rama:** `wip/vh-world-visual-foundation`. **Push:** RETENIDO hasta autorización del responsable.
- **Veredicto humano:** batch 15×6×4 + vehículos 9×4 aprobado ("Todo correcto"); detalle burning revisado y aprobado; evidencia 9×3×4 aprobada ("Aprueba la evidencia y pasa a los docs + gates de cierre").

## Commits (sin push)
| Commit | Contenido |
|---|---|
| `5803c29` | V.j.1 baseline congelado (15 complete sha/dims + pixel-qa 9×3) + guard |
| `3bedb9c` | V.j.3 orientación física 0/90/180/270 (renders reales, no sprite rotado) |
| `2a91d39`/`5178b68`/`94268c1` | V.j.2 estados + visibilidad (hollín, escombros, llama/humo, andamio frontal) |
| `e0044cd` | V.j.4 batch 360 + vehículos 36 + fix anclaje de daño a sección real + andamio ceñido |
| `31ff12f` | V.j.5 clave de variante + adapter consume orientación/estado + manifiesto por variante |
| `e0d6ea5` | V.j.6 carga por distrito + caché LRU 96 MiB + métricas (D-102) |
| `8e076df` | V.j.7 materiales CC0 Poly Haven (5 gaps) → librería 10/10 |
| `03e7085`/`44206d3` | V.j.8 evidencia 9×3×4 QA + ancla centrada en footprint |

## Gates de cierre (medidos 2026-11-09)
| Gate | Resultado |
|---|---|
| `pnpm typecheck` (shared+web) | PASS |
| tests shared+web (`vitest` raíz) | 300 passed, 4 skipped |
| `prettier --check .` (format) | PASS — se extendió `.prettierignore` con los manifiestos generados por script (`runtime-assets-blender.json`, `runtime-blender-e2e-metadata.json`, `world-asset-index.json`, `world-catalogs/material-assets.json`); `JSON.stringify(...,2)`/`json.dumps` emiten arrays multilínea que prettier colapsa, así que formatearlos a mano se deshace en cada regen (misma política ya documentada para `cc0-inventory`/`asset-metrics`). |
| composer `test_vg_recipe_model.py` | 22/22 PASS |
| `validate-building-composer.mjs` | valid (15 gramáticas, 15 promociones) |
| `validate-asset-jobs.mjs` | passed (55 jobs) |
| `build-blender-assets.mjs --check` | passed (190 imágenes, 23.464.376 B) |
| `check-binary-budget.mjs` | passed (bundle 23.487.739 B ≤ 24.117.248 D-101/D-102) |
| `check-third-party-license.mjs` | passed (2 bundles) |
| `validate-world-asset-catalog.mjs` | PASS (6 vehículos, 15 props, 11 terrain) |
| evidencia 9×3×4 (Playwright) | 108 capturas + 12 sheets, 0 pageErrors |
| `validate-art-staging.mjs` | fallos SÓLO `src_original_*` preexistentes (V.j.2), no regresión |

## Decisiones y docs
- **D-102** (nueva): presupuesto = bytes en arranque / por distrito, no total servido. PNG de variante gitignored + manifiesto versionado; caché LRU; ver `docs/engineering/adr/D-102-carga-por-distrito-presupuesto.md`.
- `ai-context/DECISIONS.md` y `ai-context/PROJECT-STATE.md` actualizados con el cierre V.j.

## Deuda conocida (no bloquea el cierre visual)
- **`packages/simulation` arrastra fallos PREEXISTENTES, ajenos a V.j.** La batería `pnpm -w test`
  (588 tests) falla sólo en 3 casos de simulación: (a) *mantiene el digesto de carreras largas al
  optimizar el coste del tick*, (b) *K · la huella puede cruzar la frontera catastral interna* y (c)
  *cada seed reproduce su medida: nueve distritos, programa municipal y geometría*. V.j no toca el motor:
  en el rango `5803c29..HEAD` el único commit que altera `packages/simulation` es `91fede9`, y sólo hizo
  un cambio de formato a `urban-civic.test.ts` (pasa); los cambios en `packages/shared/src/assets.ts` son
  **puramente aditivos** (cero líneas eliminadas). Son deuda heredada de V.d-7A/V.d-H2.1 (§5 mature p95
  sin resolver) y **bloquean el cierre de la fase URBANA (V.d), no el de V.j**. No se corrigen aquí: el
  siguiente hito es el playtest humano de V.d, no más arte ni nuevas mecánicas.
- No-determinismo de muestreo en `runtime_asset.py` para `veh_tractor.png`/`chr_police-d3-idle-1.png` (re-render cambia bytes); revisar en próxima promoción.
- `validate-art-staging` rechaza módulos `original` (patrón preexistente); el guard de building-modules los tolera por otra vía.
- Llama/humo low-poly (vocabulario Graphic Civic aprobado); posible refinamiento estético futuro.
