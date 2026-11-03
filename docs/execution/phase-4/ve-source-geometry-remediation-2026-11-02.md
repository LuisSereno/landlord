# Remediación de geometría de fuente V.e (2026-11-02)

Estado: **EJECUTADA en `wip/ve-source-geometry-remediation`**. Pendiente de QA visual del
responsable y de merge. Decisión: D-098.

## Motivo

El responsable rechazó la producción visual de V.e.2–V.e.3: los presets de `building-factory.json`
declaraban fuentes Kenney/Quaternius/KayKit/Poly Haven, pero los 14 jobs renderizaban
`source.kind: "procedural"` con composición de primitivas propia (`building_factory.py`). Ninguna
geometría de terceros entraba físicamente al render. La cadena acordada
*source geometry → normalize → material remap → style layer → condition state → render* no se
cumplió, y la calidad visual lo reflejaba.

## Qué se hizo

1. **Manifiesto honesto** (`asset-jobs.json`): los 14 jobs pasan a `source.kind: "glb"` con
   `sourceId`, ruta exacta en staging y `camera`/`render` explícitos. Rutas verificadas contra el
   archivo físico.
2. **Fix del pipeline externo** (`runtime_asset.py`): el recorte de `trim_and_scale` fallaba al
   reducir por 2 cuando el contenido tocaba el borde del frame con dimensión impar; ahora ajusta
   también por el lado inferior/izquierdo. Golden externo y legacy courtyard verificados
   byte-idénticos tras el cambio.
3. **Retirada de la fábrica falsa**: se eliminan `building_factory.py`, su rama procedural en
   `runtime_asset.py`, `building-factory.json` y `validate-building-factory.mjs`.
4. **Catálogo honesto** (`building-catalog.json`, schemaVersion 2): un registro por edificio de
   dominio con `mode` imported/legacy-procedural, `jobId`, `sourceId`, `sourcePath`, licencia,
   plantas, footprint y categoría. `validate-building-catalog.mjs` cruza catálogo ↔ asset-jobs ↔
   archivo físico y rechaza jobs procedurales que citen familias de terceros.
5. **Evidencia real** (`render-building-evidence.mjs`): 18 renders Blender (14 imported `complete`
   + courtyard legacy con 4 estados), verificación de metadatos (`origin: licensed`,
   `source.path`/`source.id` idénticos al catálogo, licencia CC0-1.0, hashes únicos) y publicación
   en `apps/web/public/assets/evidence/buildings/` + `building-evidence.json`. Hojas de contacto en
   `blender_artist/generated/ve-source-remediation/`.
6. **Catálogo y showcase reales**: `/visual-catalog` y la escena Phaser consumen la evidencia
   publicada con procedencia visible; la sección de estados muestra sólo estados existentes y
   marca el condicionamiento pendiente. Cobertura honesta 18/60.

## Qué NO se hizo (deuda declarada)

- **Condicionamiento de estados sobre geometría importada** (construction/damaged/burning): V.e.3
  queda reabierto como WP propio. Fabricar estados sobre Kenney hoy repetiría el atajo.
- **Promoción al runtime**: la evidencia no toca `runtime-assets-blender.json`; el juego sigue con
  sus assets actuales hasta QA visual del responsable y decisión de promoción.
- **Catálogo de personajes** (`character-factory.json`): es un plan offline sin renders; no
  declaraba fuentes falsas en jobs, pero su materialización deberá pasar por el mismo validador
  cuando se renderice.

## Verificación

- `pnpm art:jobs:validate`, `pnpm art:building-catalog:validate`: passed.
- `pnpm art:external:check`: golden byte-idéntico (hash SHA-256).
- Legacy `courtyard_home-complete.png` re-renderizado: hash `b197476f…` idéntico al publicado.
- `pnpm art:catalog:check`, test `visual-catalog.test.tsx`, typecheck web: passed.
- `pnpm smoke:visual-catalog`: 15 tarjetas, 18 imágenes de estado reales, showcase sin errores de
  página; capturas golden regeneradas.
- `node scripts/check-binary-budget.mjs`: passed (evidencia 1.0 MiB dentro del presupuesto D-081).
