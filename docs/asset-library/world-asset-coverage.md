# World Asset Coverage (V.h.12 · §27)

Cobertura del World Asset Knowledge Base sobre `world-asset-index.json` (4554 assets, 17 fuentes).
`Used by world` = assets con pipeline/runtime ID reales (catálogo de módulos u horneados en el atlas
`runtime-assets-blender.json`); es el subconjunto que la presentación consume de verdad.

Generado el 2026-11-06 desde el índice canónico (V.h.1-V.h.11 + promoción town_hall V.h.12).

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
| actor | 62 | 62 | 5 | 5 | 57 |
| animation | 26 | 26 | 0 | 0 | 26 |
| **TOTAL** | **4554** | **4554** | **198** | **198** | **4356** |

Lectura: el 100 % está indexado y clasificado (§5); **198** assets son runtime-ready y son los que
el mundo usa. El resto permanece clasificado sin ser runtime-ready por decisión (§5: "no necesitamos
colocar 1.000 assets en pantalla; necesitamos saber qué tenemos y poder encontrarlo"). Los 2119
materiales y las 26 animaciones siguen sin consumidor runtime; los actores tienen ya 5 avatares
Rocketbox horneados (V.h.11) y el resto (44 piezas + 13 avatares sin rol) queda como reserva.

## Por vocabulario de Building / District / PublicSpace

| Building / District / PublicSpace | Available visual vocabulary | Coverage |
|---|---|---|
| BuildingType (15 de dominio) | fallback procedural 15/15 + archetype Blender 7/15 | 15/15 |
| District roles (§11, 7) | perfiles visuales (densidad + vocabulario favored/avoided) | 7/7 |
| PublicSpace kinds (5) | reglas de presentación (plaza/park/pocket_park/civic_courtyard/schoolyard) | 5/5 |
| Vehicle classes (§15, 11 declaradas) | runtime-ready: civilian, taxi, delivery, freight, garbage, police, fire, ambulance, construction | 9/11 |
| Actor classes (§16, 8 declaradas) | runtime-ready (avatares Rocketbox horneados, V.h.11): civilian, police, medical, firefighter, worker | 5/8 |
| Material categories (§10, 10) | **cobertura semántica**: 5 con fuente Poly Haven + 5 con `proceduralTone` derivado → 10/10 seleccionables por lenguaje. **Uso en runtime: 0** — ningún consumidor (Phaser/bake) lee aún `material-assets.json`; el terreno usa la palette del style profile, no la biblioteca de materiales | semántico 10/10 · runtime 0/10 |

## Gaps reales (no silencio)

- **P1** `industrial` y `service` (vehicle classes) declaradas sin miembro runtime-ready: no hay
  fuente horneada que las distinga de freight/delivery; se poblarán con un bake curado futuro.
- **P1** Actor classes `maintenance`, `enforcer`, `service_worker` declaradas sin avatar horneado:
  V.h.11 cubrió civilian/police/medical/firefighter/worker (5/8). Las restantes necesitan avatares
  adicionales. Nota de honestidad: el rol profesional es **por colocación** (avatar Rocketbox
  stationed en su edificio), NO uniforme literal; Rocketbox no trae uniformes.
- **Píxel QA (V.h.12 §13)** Contact sheet de píxeles 9 distritos × 3 escalas + 5 detalles (§23/§29):
  capturado de forma automatizada con Playwright headless sobre la app servida
  (`scripts/vh-world-visual-capture.mjs` → `docs/art/world-visual-foundation/pixel-qa/`, con
  `capture-manifest.json` de hashes y `pageErrors`). Es render de framebuffer real, separado de la
  integración de modelo: la 9/9 distritos se mide a nivel de modelo presentacional en
  `full-world-integration.test.ts`, gate **9/9 DISTRICTS VISUAL MODEL PASS** (no "RENDER"). La
  interpretación estética de los píxeles corresponde a la review humana.
- **P2** Materiales pavement/stone/metal/soil/grass sin fuente real: cerrados con `proceduralTone`
  derivado del Graphic Civic (declarado en `material-assets.json`, `gap:true` + `proceduralTone`).
  Fuente Poly Haven real queda pendiente para esos 5.
- **P2** 10 zips autorizados CC0 pero no adquiridos (sin path/hash): permanecen en cuarentena
  (provenance fail-closed); listados en `world-asset-audit.md`.
