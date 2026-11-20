# D-111 §3 — Geometry Nodes como generador de fachada

## Qué se construyó

`tools/art-pipeline/blender/gn_facade_grammar.py`: cinco constructores de Geometry Nodes
parametrizados, horneados a GLB y registrados como módulos originales del Composer.

| parte | módulo | parámetros que la gobiernan |
|---|---|---|
| hueco residencial | `mod_gn_window_bay_2m` | `openingWidth`, `openingHeight`, `sillHeight`, `frameWidth`, `glassRecess`, `mullions`, `transom` |
| escaparate comercial | `mod_gn_shopfront_bay_2m` | `openingWidth/Height`, `sillHeight`, `pilasterWidth`, `fasciaHeight`, `mullions` |
| zócalo de sillar | `mod_gn_plinth_2m` | `socleProjection`, `joints`, `wallThickness` |
| cornisa | `mod_gn_cornice_2m` | `coronaProjection`, `dentils`, `bayHeight` |
| puerta-balcón | `mod_gn_balcony_door_bay_2m` | hoja + alféizar + barandilla con balaustres instanciados |

El árbol se construye por nodos (`Instance on Points` sobre una fila medida, `Set Material`,
`Realize Instances`), y la malla se mide del host antes de exportar: el GLB resultante es geometría
real, no una dependencia de runtime. Origen y construcción quedan en
`blender_artist/sources/original/` con
`src_original_gn_*` en `staging-sources.json` y licencia `original`.

## Las diez características del encargo

| requisito | dónde está |
|---|---|
| tres plantas | el Composer repite la crujía por forjado; el módulo mide un paso de piso |
| planta comercial vs viviendas | roles distintos: `ground_panel` = escaparate, `window_bay` = hueco doméstico |
| distribución parametrizada de ventanas | `mullions`/`transom`/ritmo por semilla en `part_parameters` |
| ritmo arquitectónico | `bayWidth` + ciclo derivado de la semilla (`cycle = (seed·2654435761 mod 997)/997`) |
| cornisas y zócalos | `mod_gn_cornice_2m` + `mod_gn_plinth_2m` |
| balcones vinculados a puertas | `mod_gn_balcony_door_bay_2m`: el balcón nace del dintel de la puerta, no flota |
| huecos comerciales de dimensión real | escaparate 1,44 × 2,00 m con transom a 0,42 m |
| profundidad de marcos | `frameWidth` 0,085 m y `glassRecess` 0,085 m: el vidrio entra en el muro |
| variación controlada por semilla | todos los parámetros sorteados desde la semilla del Composer |
| compatibilidad con huella y altura | el módulo encaja en el paso de crujía del perfil de estilo |

## A/B obligatorio

`/tmp/ab/A` (control) y `/tmp/ab/B` (candidata), misma corrida del Composer, `--mood=day_civic`,
semilla 2. La única diferencia declarada es `axisChoices.facade`: `brick_commercial` →
`gn_masonry_bays`. Huella 4×2 celdas, 3 pisos, `orthoScale` 22,97, cámara 45°/30°, perfil
`graphic_civic_buildings_v1` y `canonicalOverride` idénticos en ambos (comprobado clave a clave).

| métrica | A control | B Geometry Nodes |
|---|---|---|
| triángulos | 9 522 | 13 272 (+39 %) |
| envelope Z | 10,00 m | 9,55 m |
| fuentes licenciadas | 3 | 5 (`src_original_gn_cornice`, `src_original_gn_window_bay`) |
| ratio de geometría licenciada | 1,0 | 1,0 |
| materiales | 18 | 16 |
| px/m del sprite | 60,2 | 60,2 |
| tiempo total del candidato | 213 s | 207 s |
| pico RSS | 4 178 MB | 4 114 MB |

El coste de construcción **no sube**: B es incluso 6 s más rápido y gasta 64 MB menos. El único
coste es 3 750 triángulos, que para un sprite offline es irrelevante frente al presupuesto D-100/D-102.

## Resultado visual

**MEJORA VISUAL reconocible**, en tres de los ocho criterios de aceptación:

- **Fachada.** El hueco pasa de cristal empotrado en paño plano a marco en relieve con alfiz,
  dintel, alféizar y tramos; el vidrio se hunde 8,5 cm y lee como hueco, no como pegatina.
- **Profundidad.** La cornisa con dentículos y el zócalo de sillar proyectan sombra propia sobre el
  paño; el control no tiene ningún elemento saliente por encima del plano de fachada.
- **Legibilidad a escala de juego.** A zoom 1× los pisos se distinguen por el ritmo de huecos, no
  por la banda de color del forjado.

Hoja comparativa a escala nativa (ambas a 60,2 px/m):
`docs/art/graphics-capabilities/evidence/sheets/gn_facade_ab.png`.

## Determinismo medido, no supuesto

Dos procesos idénticos del mismo control (`A` vs `A3`):

- 3 claves del JSON difieren, y ninguna es de composición: tiempos de render, `candidateId` y
  `shadow.pixels.sha256`.
- Píxel a píxel: 447 de 1 096 208 píxeles distintos = **0,041 %**, delta máximo de canal **4/255**,
  media **0,00047**.

Consecuencia para §9: el determinismo del Composer es estructural (mismos ejes, mismas firmas de
composición), **no byte-idéntico en imagen**. Una validación que compare `sha256` del PNG fallará
siempre y no por un defecto real.

## Limitaciones observadas (las tres de promoción)

1. **El perfil de material no es idéntico del todo.** Los módulos GN traen paleta plana propia
   (`gn_brick_wall`, `gn_stone_trim`, `gn_dark_glass`) y `complete_style_reach` la trata por
   escalera, mientras el paño megakit se trata por atlas (`T_RedBrick_BaseColor`). En B el ladrillo
   sale más saturado que en A. Es el primer ajuste antes de cualquier promoción.
2. **La cornisa sale casi blanca** contra un muro terroso. El color de `gn_stone_trim` no está
   atado al rol `crown_panel` aprobado.
3. **Altura de banda distinta:** la cornisa GN mide 0,55 m y el parapeto megakit 1,0 m, así que el
   envelope baja 0,45 m. No es un defecto, pero cambia el encuadre derivado (`targetZ` 5,0 → 4,775)
   y con él el recorte por alpha: el sprite de B queda a 1203×1349 tocando el borde derecho del
   lienzo, mientras A queda a 1048×1046 con margen. El Composer encuadra por *envelope*, no por
   geometría realizada; si la fachada enriquecida sobresale, el recorte se aprieta.

## Decisión de integración

Geometry Nodes **sí aporta ventajas** y se integra como generador especializado invocado por el
Building Composer, exactamente como pedía el encargo:

- El Composer conserva la autoridad: recetas, sorteo de ejes, validación, procedencia y salida.
- Los cinco módulos se registran **aditivos** en `building-modules.json` (no sustituyen a nadie).
- **La gramática del repo NO cambia.** El parche que enruta roles a GN es temporal y se revierte
  tras cada corrida: promoverlo re-derivaría todas las variantes de producción, porque
  `draw_choices` sortea `rng.choice(recipes)` y filtra por `facadeIds`. Eso es una decisión de
  promoción con revisión humana, no un subproducto de la exploración.

Reproducir el A/B:

```bash
python3 tools/art-pipeline/blender/ext_lab/gn_facade_patch.py apply && \
node scripts/build-building-composer.mjs --types=mixed_tenement --seeds=2 --prefix=d111b \
  --outDir=/tmp/ab/B --metrics=/tmp/ab/B-metrics.json --mood=day_civic
python3 tools/art-pipeline/blender/ext_lab/gn_facade_patch.py revert
```

Los dos drivers de parche (`gn_facade_patch.py`, para §3, y `ab_grammar_patch.py`, para §6) sí viajan
en el repo: son evidencia reproducible. Lo que no viaja es el resultado aplicado sobre el manifiesto.
