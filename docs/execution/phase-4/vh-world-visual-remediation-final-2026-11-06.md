# WP4.15-V.h — Informe final de remediación visual

**Fecha:** 2026-11-06  
**Rama:** `wip/vh-world-visual-foundation`  
**HEAD inicial auditado:** `2ab9897807f18eb7cd4c74f25aca98616224fa38`  
**Informe preliminar:** `docs/execution/phase-4/vh-world-visual-preliminary-audit-2026-11-06.md` (`5c305e1`)  
**Commit de remediación verificado:** `715fca4b71df98cf5c126c0b544a5a6960fe3f3f`  
**Estado:** `VISUAL INTEGRATION REMEDIATED / BUILDING CATALOG PARTIAL`

## 1. Resultado ejecutivo

La auditoría confirmó que la World Visual Foundation tenía una infraestructura útil, pero el mundo publicado era visualmente incoherente por errores de integración, no por falta de recursos:

- seguían activos edificios Blender heredados y genéricos de las primeras fases;
- varios `BuildingType` se sustituían por una vivienda o tienda de otra familia;
- los vehículos sólo cubrían un eje visual de carretera;
- los Rocketbox se renderizaban a una escala desproporcionada;
- el ayuntamiento runtime había cambiado a una variante de cubierta plana;
- el QA de píxeles no protegía escala, orientación ni coherencia semántica.

Todos esos defectos de integración se han corregido y la evidencia Phaser se ha regenerado después de pasar todos los gates técnicos.

No se declara terminado el catálogo artístico de edificios: sólo dos edificios tienen hoy un candidato Building Composer revisado y promovido (`courtyard_home`, `town_hall`). Los trece tipos restantes usan su fallback procedural exacto. Esta decisión evita volver a introducir edificios genéricos o semánticamente falsos sólo para aparentar variedad.

## 2. Correcciones aplicadas

### 2.1 Edificios heredados eliminados del gameplay

Se excluyen del bundle que consume la ciudad:

- `bld_shopfront`;
- `bld_commercial_b`;
- `bld_commercial_c`;
- `bld_residential_a`;
- `bld_residential_b`;
- `bld_residential_c`.

Los archivos permanecen en el bundle crudo como evidencia histórica y para Art Lab, pero `BLENDER_ASSETS` filtra esos IDs antes de que gameplay los pueda resolver.

Esto elimina el fallo principal observado: una `row_house`, un `apartment_block`, un `mixed_tenement`, un `workshop` o un `warehouse` ya no pueden terminar visualmente representados por una casa/tienda antigua de otra familia.

### 2.2 Política visual explícita para los 15 tipos

Se añadió `BUILDING_VISUAL_POLICIES`, con un contrato cerrado por `BuildingType`:

| BuildingType | Política actual | Visual |
|---|---|---|
| courtyard_home | `runtime_exact` | `vg_courtyard_home_1002` |
| row_house | `procedural_semantic_fallback` | `row_house` |
| apartment_block | `procedural_semantic_fallback` | `apartment_block` |
| mixed_tenement | `procedural_semantic_fallback` | `mixed_tenement` |
| workshop | `procedural_semantic_fallback` | `workshop` |
| warehouse | `procedural_semantic_fallback` | `warehouse` |
| cement_plant | `procedural_semantic_fallback` | `cement_plant` |
| brickworks | `procedural_semantic_fallback` | `brickworks` |
| steelworks | `procedural_semantic_fallback` | `steelworks` |
| town_hall | `runtime_exact` | `vf_town_hall_1000` con cubierta inclinada |
| school_block | `procedural_semantic_fallback` | `school_block` |
| clinic | `procedural_semantic_fallback` | `clinic` |
| police_station | `procedural_semantic_fallback` | `police_station` |
| fire_station | `procedural_semantic_fallback` | `fire_station` |
| market_hall | `procedural_semantic_fallback` | `market_hall` |

El fallback procedural no se considera arte final. Es un contrato semántico temporal: conserva footprint, altura y función y evita una sustitución incorrecta mientras se construye el catálogo Blender definitivo.

### 2.3 Dos candidatos Composer promovidos con trazabilidad

#### Courtyard home

- candidato: `vg_courtyard_home_1002`;
- footprint artístico/dominio: `2×2`;
- estado publicado: `complete`;
- estados ausentes: fallback procedural;
- runtime image: `apps/web/public/assets/runtime/blender/courtyard_home-vg-complete.png`.

#### Town hall

- candidato: `vf_town_hall_1000`;
- cubierta: `gable_dormers`;
- footprint artístico: `4×3`;
- footprint de dominio: `8×4`;
- estado publicado: `complete`;
- estados ausentes: fallback procedural;
- runtime image: `apps/web/public/assets/runtime/blender/town_hall-roofed-complete.png`.

La plaza cívica continúa siendo una capa de `PublicSpace` independiente. No se hornea dentro del sprite del ayuntamiento.

Las promociones están documentadas en:

`blender_artist/manifests/runtime-promotions.json`

### 2.4 Ayuntamiento con tejado restaurado

La promoción V7 que se veía en gameplay correspondía a `vf_town_hall_1002` con `flat_corniced`. No se había perdido un archivo: se había promovido una variante de silueta plana.

Se sustituyó por la variante revisada con `gable_dormers`. El override tiene un nombre y procedencia explícitos y el test fuerza:

- ruta `town_hall-roofed-complete.png`;
- `stateFallback: procedural`;
- ausencia de estados falsos `construction`, `damaged` y `burning`.

### 2.5 Escala física de personajes

Antes:

`256 px × 0,75 = ~192 px`

Después:

- frame fuente: `256 px`;
- altura objetivo: `28 px`;
- escala runtime: `0,109375`;
- envelope admitido por test: `22–32 px`.

Los actores ambientales y contextuales dejan de dominar visualmente coches y edificios.

Además, los actores contextuales usan un desplazamiento de bordillo. Ya no se colocan en el centro de la celda vial.

### 2.6 Vehículos paralelos a ambos ejes viales

El contrato anterior sólo admitía `45° | 225°`.

El contrato actual admite:

- carretera EW: `45° | 225°`;
- carretera NS: `135° | 315°`.

Mientras el atlas no tenga cuatro renders propios, `135°/315°` reutiliza el frame disponible y aplica una rotación de pantalla de `±90°`. Es una corrección geométrica completa para la orientación, aunque sigue existiendo una mejora P2 para hornear cuatro vistas reales.

Los tests obligan a cubrir las cuatro posibilidades.

### 2.7 QA industrial y paths de evidencia corregidos

- `detail-industrial-20x.png` se genera ahora desde `Ensanche Ferroviario Oeste`, cuyo rol es `INDUSTRIA Y LOGÍSTICA`.
- se eliminó la evidencia duplicada generada bajo `apps/web/docs/...` por un `cwd` incorrecto;
- toda la evidencia canónica vive en `docs/art/world-visual-foundation/pixel-qa/`.

### 2.8 Gates visuales añadidos

`visual-remediation.test.ts` protege:

- validez del manifiesto V2 curado;
- exclusión de los seis edificios heredados;
- promociones exactas de `courtyard_home` y `town_hall`;
- fallback semántico exacto para los otros trece tipos;
- cuatro azimuts de vehículos;
- escala humana entre 22 y 32 px;
- ayuntamiento con ruta de cubierta inclinada;
- ausencia de estados visuales fabricados.

También se actualizaron las pruebas antiguas que anteriormente exigían deliberadamente los pools heredados.

## 3. Verificación ejecutada

Workflow verificado:

`V.h visual remediation v6` — run `42224558865`

| Gate | Resultado |
|---|---|
| instalación workspace | PASS |
| remediación reproducible | PASS |
| Prettier | PASS |
| TypeScript | PASS |
| ESLint | PASS |
| suite web | PASS — 225 tests, 4 skipped |
| full-world gate 9/9 distritos | PASS |
| performance gate | PASS |
| build producción | PASS |
| instalación Chromium/ImageMagick | PASS |
| captura Phaser real | PASS |
| limpieza de scripts/workflows temporales | PASS |
| commit y push | PASS |

El commit publicado es:

`715fca4b71df98cf5c126c0b544a5a6960fe3f3f`

## 4. Evidencia de píxeles regenerada

La captura se ejecutó sobre la app Phaser real, no sobre un montaje Blender.

Se regeneraron:

- 27 capturas de distrito: 9 distritos × 0,5× / 1× / 2×;
- 3 contact sheets por escala;
- detalles civic, commercial, green, industrial y residential;
- `capture-manifest.json` con SHA-256 de cada imagen.

Rutas principales:

- `docs/art/world-visual-foundation/pixel-qa/district-contact-sheet-05x.png`
- `docs/art/world-visual-foundation/pixel-qa/district-contact-sheet-10x.png`
- `docs/art/world-visual-foundation/pixel-qa/district-contact-sheet-20x.png`
- `docs/art/world-visual-foundation/pixel-qa/detail-civic-20x.png`
- `docs/art/world-visual-foundation/pixel-qa/detail-residential-20x.png`
- `docs/art/world-visual-foundation/pixel-qa/detail-commercial-20x.png`
- `docs/art/world-visual-foundation/pixel-qa/detail-industrial-20x.png`
- `docs/art/world-visual-foundation/pixel-qa/detail-green-20x.png`

## 5. Performance después de la remediación

| Métrica | V.h.10 | Estado actual |
|---|---:|---:|
| atlas images | 81 | 162 |
| vehicles | 9 | 9 |
| props | 13 | 13 |
| characters | 1 | 6 |
| building types con entrada Blender/override | — | 8 en bundle curado/crudo |
| tipos con política visual explícita | — | 15/15 |
| objetos presentacionales | 2720 | 2726 |
| ambient actors | no contabilizados por separado | 32 |
| context actors | no contabilizados | 7 |
| actores totales | — | 39 |
| generación modelo 9 distritos | 551 ms | 292 ms |

El tiempo medido es de proyección y construcción del modelo visual en Node, no FPS GPU. El render interactivo sigue usando sprites compartidos, culling y reutilización de texturas.

## 6. Qué no se ha hecho deliberadamente

### 6.1 No se han promovido los assets V.e genéricos

El repositorio contiene imágenes de evidencia para los 15 tipos en:

`apps/web/public/assets/evidence/buildings/`

Esas imágenes demuestran cobertura técnica con geometría Kenney, pero no han pasado una selección artística como catálogo final. Promoverlas automáticamente habría reintroducido exactamente el problema denunciado: edificios genéricos o antiguos utilizados para aparentar cobertura.

### 6.2 No se ha declarado `BUILDING RUNTIME CATALOG = 15/15`

Estado honesto:

- Composer aprobado/promovido: `2/15`;
- cobertura semántica visual: `15/15`;
- Composer pendiente: `13/15`.

Crear trece edificios nuevos requiere una fase artística específica con Blender y selección humana. No es correcto fabricar esa cobertura mediante aliases o assets no aprobados.

### 6.3 No se han horneado cuatro vistas reales de cada coche

La orientación de gameplay está corregida. El render de `135°/315°` utiliza rotación en pantalla. El siguiente nivel de calidad consiste en hornear cuatro vistas por vehículo para preservar sombra y perspectiva exactas.

## 7. Deuda restante priorizada

### P1 — Building Runtime Catalog 15/15

Crear y promover un primary Composer asset para:

1. row_house;
2. apartment_block;
3. mixed_tenement;
4. workshop;
5. warehouse;
6. cement_plant;
7. brickworks;
8. steelworks;
9. school_block;
10. clinic;
11. police_station;
12. fire_station;
13. market_hall.

Cada tipo debe tener evidencia Phaser antes de promoción. No volver a habilitar pools cross-family.

### P2 — Vehículos de cuatro orientaciones reales

Hornear `45°/135°/225°/315°` para los nueve vehículos y retirar la rotación de pantalla temporal.

### P2 — Estados Blender reales

Para los edificios Composer aprobados, generar `construction`, `damaged` y `burning` reales antes de eliminar `stateFallback: procedural`.

### Review humana

Los gates impiden regresiones objetivas, pero no declaran belleza artística. Las contact sheets regeneradas deben revisarse antes de merge a `main`.

## 8. Veredicto

Los errores de integración encontrados en la auditoría quedan corregidos:

- no se usan edificios heredados en gameplay;
- no hay sustituciones cross-family;
- los vehículos siguen el eje vial;
- las personas tienen escala urbana;
- los actores contextuales salen del centro de la calzada;
- el ayuntamiento recupera cubierta inclinada;
- la captura industrial usa un distrito industrial;
- la evidencia Phaser ha sido regenerada y hasheada;
- typecheck, lint, tests, full-world, performance y build están verdes.

El mundo está en una base visual sustancialmente más coherente, pero el trabajo artístico no debe darse por terminado hasta cerrar el catálogo Composer de los trece tipos restantes.

**Estado final:**

`WP4.15-V.h — VISUAL INTEGRATION REMEDIATED / BUILDING CATALOG 2/15`
