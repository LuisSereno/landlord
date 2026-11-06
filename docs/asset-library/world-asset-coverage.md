# World Asset Coverage (V.h.10 · §27)

Cobertura del World Asset Knowledge Base sobre `world-asset-index.json` (4554 assets, 17 fuentes).
`Used by world` = assets con pipeline/runtime ID reales (catálogo de módulos u horneados en el atlas
`runtime-assets-blender.json`); es el subconjunto que la presentación consume de verdad.

Generado el 2026-11-05 desde el índice canónico (V.h.1-V.h.7).

## Por categoría

| Category | Indexed | Classified | Runtime ready | Used by world | Remaining |
|---|---:|---:|---:|---:|---:|
| material | 2119 | 2119 | 0 | 0 | 2119 |
| environment | 933 | 933 | 10 | 10 | 923 |
| architecture | 459 | 459 | 101 | 101 | 358 |
| building_mass | 386 | 386 | 39 | 39 | 347 |
| infrastructure | 285 | 285 | 13 | 13 | 272 |
| vehicle | 150 | 150 | 9 | 9 | 141 |
| urban_prop | 134 | 134 | 21 | 21 | 113 |
| actor | 62 | 62 | 0 | 0 | 62 |
| animation | 26 | 26 | 0 | 0 | 26 |
| **TOTAL** | **4554** | **4554** | **193** | **193** | **4361** |

Lectura: el 100 % está indexado y clasificado (§5); 193 assets son runtime-ready y son los que el
mundo usa. El resto permanece clasificado sin ser runtime-ready por decisión (§5: "no necesitamos
colocar 1.000 assets en pantalla; necesitamos saber qué tenemos y poder encontrarlo"). Los 2119
materiales y los 62 actores/26 animaciones sin runtime-ready son la reserva para futuras pasadas
(material library aplicada a style profiles; actores profesionales horneados).

## Por vocabulario de Building / District / PublicSpace

| Building / District / PublicSpace | Available visual vocabulary | Coverage |
|---|---|---|
| BuildingType (15 de dominio) | fallback procedural 15/15 + archetype Blender 7/15 | 15/15 |
| District roles (§11, 7) | perfiles visuales (densidad + vocabulario favored/avoided) | 7/7 |
| PublicSpace kinds (5) | reglas de presentación (plaza/park/pocket_park/civic_courtyard/schoolyard) | 5/5 |
| Vehicle classes (§15, 11 declaradas) | runtime-ready: civilian, taxi, delivery, freight, garbage, police, fire, ambulance, construction | 9/11 |
| Actor classes (§16, 8 declaradas) | runtime-ready: civilian (vecino_variante horneado) | 1/8 |
| Material categories (§10, 10) | con fuente Poly Haven: asphalt, concrete, brick, rusty_metal, wood (+pavement parcial); gap procedural: stone, metal, soil, grass | 6/10 |

## Gaps reales (no silencio)

- **P1** `industrial` y `service` (vehicle classes) declaradas sin miembro runtime-ready: no hay
  fuente horneada que las distinga de freight/delivery; se poblarán con un bake curado futuro.
- **P1** Actor classes profesionales (worker/maintenance/enforcer/service_worker/police/medical/
  firefighter) declaradas sin miembro runtime-ready: Rocketbox no codifica profesión por nombre;
  requiere overrides curados + bake. En v1 sólo peatones civiles ambientales.
- **P1** Contact sheet de píxeles 9 distritos × 3 escalas (§23/§29): no hay Chrome headless en este
  entorno; la captura interactiva se produce en la review humana con la app servida (pasos en
  `docs/art/WORLD-VISUAL-FOUNDATION.md`). La integración 9/9 distritos sí está medida a nivel de
  modelo runtime (`full-world-integration.test.ts`, gate 9/9 DISTRICTS RENDER).
- **P2** Materiales stone/metal/soil/grass sin fuente real: fallback procedural del style profile
  Graphic Civic (declarado en `material-assets.json` como `gap:true`).
- **P2** 10 zips autorizados CC0 pero no adquiridos (sin path/hash): permanecen en cuarentena
  (provenance fail-closed); listados en `world-asset-audit.md`.
