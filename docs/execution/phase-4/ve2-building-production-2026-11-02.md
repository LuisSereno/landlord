# V.e.2 — producción de edificios (2026-11-02)

> **SUPERSEDED (2026-11-02, remediación de geometría de fuente, D-098).** Los "compositores
> data-driven" de este WP eran primitivas propias: los presets declaraban fuentes
> Kenney/Quaternius/KayKit/Poly Haven que no entraban al render. La producción real vive ahora en
> `docs/art/BUILDING-CATALOG.md` y `docs/execution/phase-4/ve-source-geometry-remediation-2026-11-02.md`.
> Este documento se conserva como historial del error, no como referencia.

Estado: **V.e.2 CANDIDATE PRODUCTION PASS**. No equivale a promoción al runtime.

## Resultado

- 15/15 tipos de dominio tienen configuración explícita de producción.
- 14/15 usan un compositor Blender data-driven; `courtyard_home` preserva su procedimiento
  congelado y ya validado.
- Los 14 jobs nuevos son `evidence` y sólo renderizan `complete`.
- La revisión sin labels cubre 15 siluetas y no modifica el bundle publicado.
- La colisión inicial `clinic ≈ police_station` se corrigió con una cruz/canopy frente a escudo,
  acceso seguro y luminarias.

La configuración y el uso se documentan en `docs/art/BUILDING-FACTORY.md`. La evidencia visual
local reproducible queda en
`blender_artist/generated/ve2-buildings/complete-silhouettes-unlabelled.png`.

## Decisiones de alcance

Los nombres de fuentes en los presets registran materia prima y dirección de composición, no
declaran que una pieza de terceros sea arte final. El generador aplica una gramática propia de
masas, fachadas, cubiertas, señalética y dressings. No escribe footprints en dominio ni permite
que el render decida reglas.

Estados `construction`, `damaged` y `burning` se mantienen fuera de este cierre: corresponden a
V.e.3 y no se falsean duplicando el edificio terminado.

## Verificación

```text
art:building-factory:validate  PASS — 15/15 presets
art:jobs:validate              PASS — 41 jobs; 25 bundle; 16 evidence
art:building-factory:review    PASS — 15 complete; lámina 5×3 sin labels
```
