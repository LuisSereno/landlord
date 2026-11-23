# FINAL-ASSET-SOURCES — mapa de procedencias de edificios (FINAL-ASSET-QA FASE 2)

D-111.2 usa tres grupos de edificios con procedencias distintas. Este mapa existe para que ningún
agente vuelva a generar efectos sobre edificios obsoletos presentándolos como nuevos: los `bld_*`
son **controles históricos**, no la dirección artística actual.

## Grupos

**A. Legacy `bld_*` (controles históricos).** Seis módulos 1×1 del Composer antiguo
(`bld_shopfront`, `bld_residential_a/b/c`, `bld_commercial_b/c`). Son los únicos del catálogo
runtime con los cuatro estados horneados (`complete`, `construction`, `damaged`, `burning`), por
eso FX Lab los usa por defecto para enseñar todos los estados en una calle. Sirven para
regresión y comparativas A/B; **no** representan la arquitectura WP06.

**B. Catálogo runtime promocionado.** 15 edificios `qa_approved` en
`blender_artist/manifests/runtime-promotions.json` (Composer V7/V.f/V.g anteriores a WP06), con
sólo el estado `complete` horneado (`stateFallback: procedural`). Es lo que la partida normal
carga. **No** se promociona nada nuevo desde D-111.2 ni FINAL-ASSET-QA.

**C. Candidatos WP06.** Las cuatro composiciones nuevas:
`row_house` y `mixed_tenement` (perfil `gn_residential_v2`), `warehouse`
(`gn_industrial_v2`), `town_hall` (`ag_civic_v2`). Metadata canónica en
`docs/art/graphics-capabilities/evidence/v2/candidates/wp06_*.json`. Sólo existen como QA:
nunca se cargan salvo por la ruta QA de abajo.

## Qué fuente usa cada flujo

| Flujo | Fuente | Ruta de carga de imágenes |
| --- | --- | --- |
| FX Lab por defecto (`/art-lab`, `fx-street.ts`) | A `bld_*` + B (`row_house`, `mixed_tenement`, `cement_plant` en `complete`) | `runtime-assets-blender.json` → `/assets/runtime/blender/<tipo>-<estado>.png` |
| Partida normal | B (sólo `complete`; estados caen a procedural) | mismo manifiesto, vía `buildingAssetStateFor` |
| QA de candidatos (`fxCandidate=<nombre>` en `/art-lab` o `placeCandidateQa` en la escena) | C exclusivamente | `/qa-candidates/<nombre>.{json,png}` — la escribe el arnés de captura en el dist gitignoreado; nada de esto sirve en producción |

## Estados disponibles por grupo

- A: los cuatro (`complete`, `construction`, `damaged`, `burning`).
- B: `complete` (los demás estados caen a `procedural` por `stateFallback`).
- C: `complete` para las cuatro; `burning` QA con llamas reducidas para las variantes
  `qaFlamePeakEmission` del cierre híbrido (`evidence/v2/closure/fire/`); `aged` y `damaged` de
  los nuevos aún no están horneados (FASE 3 de FINAL-ASSET-QA los genera para `mixed_tenement` y
  `warehouse`). El tier `aged` del runtime cae en el sprite `complete` (D-080, decisión del
  propietario).

## Anti-sustitución silenciosa (FASE 2.3)

La ruta QA valida antes de montar (`validateCandidateQa` en `apps/web/src/fx-lab/fx-candidate-qa.ts`):
`candidateId`, `candidateProfile`, `compositionSignature`, tipo y estado deben corresponder al
nombre solicitado (`<buildingType>` o `<buildingType>-<estado>`), y el PNG debe responder. Si algo
falla, el lab no se monta y el banner `fx-lab-candidate-error` dice qué se pidió y por qué no se
sirvió. En la escena de juego, `listCandidateQaErrors()` (hook `__landlordCameraTest`) lista las
variantes cuyo PNG no cargó — nunca se sustituyen por un edificio antiguo sin decirlo.
