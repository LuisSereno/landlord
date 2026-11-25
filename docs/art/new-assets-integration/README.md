# Integración experimental de nuevas fuentes — 2026-11-20

Estado: **piloto en curso; sin promoción al runtime principal**. Esta carpeta registra resultados
medidos, no una aprobación visual del catálogo. La decisión CC0 de Ultimate Buildings es del
propietario y está acotada a ese pack; véase
[procedencia de fuentes](../NEW-SOURCE-PACKS-2026-11-20.md).

## Cobertura de las seis fuentes

`candidate-inventory.json` agrupa por nombre y carpeta los formatos equivalentes sin duplicar
entradas del índice global. Su generador es `python3 scripts/report-new-asset-candidates.py`.
El estado `measured` significa geometría importada y medida, **no** compatibilidad artística.

| Fuente | Archivos visuales indexados | Modelos únicos | Modelos medidos | Seleccionados | Bloqueo actual |
| --- | ---: | ---: | ---: | ---: | --- |
| Building Kit | 323 | 79 | 79 | 0 | Selección y prueba de fachada pendientes |
| Modular Buildings | 441 | 108 | 108 | 0 | Escala y encaje de módulos pendientes |
| Retro Urban Kit | 564 | 124 | 124 | 0 | Garajes medidos contra la caja de un camión: no cierran un muelle (D-111 §6.C) |
| Ultimate Buildings | 318 | 102 | 102 | 2 | 44 Blend con atlas sin resolver; revisión visual pendiente |
| Mini Characters | 176 | 43 | 43 | 0 | Presentación y compatibilidad de rig pendientes |
| Retro Textures Fantasy | 119 | 0 | 0 | 0 | Comparación por superficie hecha (D-111 §5); falta revisión humana |

El duplicado exacto de City Kit Roads permanece fuera de este inventario y de la selección nueva.
Los 1.941 recursos indexados son **archivos visuales**, incluidos formatos alternativos y previews;
no equivalen a 1.941 modelos diferentes. El manifiesto de medición del Composer contiene 1.249
entradas, incluidos los 102 Blend de Ultimate Buildings y los 354 GLB únicos de los cuatro packs
Kenney geométricos.

## Pruebas geométricas y decisiones

- Ultimate Buildings: los 102 FBX se importaron para comparar formatos. En una muestra de balcón,
  el FBX crea un material `Texture` sin nodo de imagen; el `.blend` equivalente conserva el atlas
  `Texture_Green.png`. El importador del pipeline ahora anexa objetos `.blend` y resuelve el atlas
  local. Se fijó `unitScale=2` tras medir puertas de 0,91–0,97 unidades y comprobar que pasan a
  1,82–1,94 m. El edificio `4Story_Wide_2Doors` pasa a 10,30 m. En 44 de los 102 Blend aún hay
  referencias a texturas inexistentes, por lo que quedan rechazados para render hasta reparación.
- `mod_quat_ultimate_balcony` procede de `Textured Models/Base Modular Parts/Blends/Balcony.blend`.
  Mide 1,669 × 0,950 × 0,541 m, 176 triángulos, textura resuelta. La receta experimental de
  `mixed_tenement` coloca dos copias en la planta residencial delantera con seed 2.
  `mod_quat_ultimate_double_door`, del `Door_Double.blend` del mismo directorio, mide
  1,499 × 0,245 × 1,935 m y 332 triángulos. La receta lo usa como hoja comercial explícita;
  el Composer valida que el módulo tenga rol `door`. Ambas piezas aparecen en los `transforms` y
  `modules` del manifiesto final. La misma receta usa una cubierta plana proporcionada, tomada
  de un módulo de 2 m ya medido del MegaKit.
- Retro Urban: los cuatro `wall-*-garage` miden 1 × 1 × 1 unidad, salvo las versiones flat de
  1 × 0,1 × 1. Sus previews muestran marco/hueco sin hoja o persiana. El camión de carga mide
  0,83 × 1,168 × 0,738 unidades. Una escala de pack que dé 2,2 m de alto al camión haría la puerta
  de unos 3 m de ancho, incompatible con las crujías actuales de 2 m. No se presentan esos huecos
  como muelles terminados. D-111 §6.C repitió la medida contra la caja real de un camión
  (2,50 × 2,60 m) y la renderizó:
  `../graphics-capabilities/evidence/warehouse/garage_probe.png`. Con la rejilla de 1 m del pack,
  duplicar el módulo da 2 m de ancho y 1 m de alto; sigue sin cerrar un muelle.
- Building Kit: `wall-window-wide-square-detailed` y `wall-doorway-wide-square` miden
  0,2 × 4 × 2,4 m. Requieren una crujía de 4 m o un adaptador geométrico; montarlos sobre las
  crujías actuales de 2 m superpondría ventanas y marcos.
- Modular Buildings: `building-window-balcony` mide 1 × 1,15 × 0,625 unidades y
  `door-brown-glass` 0,25 × 0,05 × 0,5. Una escala común y el encaje con los niveles de 3 m
  requieren una prueba de fachada; la evaluación D-111 de muelles no los descarta para viviendas.
- Mini Characters: `character-worker` importa una armadura de siete huesos y contiene clips `idle`
  y `walk`. Se verificaron también los clips en un modelo masculino y uno femenino. Falta comprobar
  el rig con todas las poses y direcciones del render de personajes del juego. Tres jobs locales de
  `asset-jobs.json` generaron imágenes `idle` de un civil, una civil y un trabajador en
  [`characters/`](characters/), junto a un frame Rocketbox de control. A 256 px la silueta Mini es
  muy pequeña y oscura, y sus proporciones caricaturescas difieren del control; quedan como
  candidatos **sin selección para población normal**. La prueba de accesorio de movilidad y la
  presentación en Phaser siguen pendientes. `character-robot` se excluyó de población histórica
  normal en el generador del índice y `animationSupport` permanece desactivado para esta fuente
  hasta validar su pipeline, aunque el GLB incluya clips. Los modelos fantásticos y armas están
  marcados `qa_rejected` en el inventario detallado.
- Retro Textures Fantasy: 119 PNG clasificados como reserva. La comparación por superficie ya se hizo
  en D-111 §5 sobre cupón, UV, cámara y luz idénticos
  (`../graphics-capabilities/evidence/sheets/materials_sheet.png`): aporta relieve en teja, zócalo y
  pavimento, y se rechaza en ladrillo y revoco porque el grano del pixel art no corresponde al
  lenguaje mate de `graphic_civic`. Sigue sin selección de producción: la decisión es por superficie y
  espera revisión humana.

## Uso real y límite artístico

| Fuente | Recurso | Consumidor | Piloto | Evidencia | Estado |
| --- | --- | --- | --- | --- | --- |
| Ultimate Buildings CC0 | `mod_quat_ultimate_balcony`, `mod_quat_ultimate_double_door` | `building-modules-selection.json` y receta `quaternius_balcony` | `mixed_tenement`, seed 2 | `pilots/d111q_mixed_tenement_2.png` y manifiesto adjunto | Candidato; **sin aprobación artística** |
| Mini Characters CC0 | `character-male-a`, `character-female-a`, `character-worker` | Fuentes conservadas en staging; jobs `qa_mini_*` retirados | personajes idle | Artefactos retirados el 2026-11-25 | `RETIRED`; sustituido por el pipeline Kenney WP-CHAR-04 |

La primera imagen mostró balcones reales, pero una cubierta sobredimensionada. La revisión posterior
con cubierta plana y puerta doble mejora la silueta y el acceso; la planta baja aún carece de
escaparates convincentes. Por ello no satisface todavía el criterio de renovación
visual del prompt. Faltan versiones nuevas de `row_house` y `warehouse`, comparativas A/B completas,
contexto urbano, personaje visible en Phaser y medidas de frame antes/después. Estos trabajos deben
resolverse antes de ampliar producción o promocionar sprites.

### Comparación A/B del mismo candidato

| Perfil | Imagen | Geometría | Resultado observado |
| --- | --- | --- | --- |
| Material Maquette, día | [PNG](pilots/d111q_mixed_tenement_2.png) · [metadata](pilots/d111q_mixed_tenement_2.json) | 9 módulos, 9.522 triángulos | Textura de ladrillo más legible; balcón y puerta Quaternius visibles |
| Graphic Civic, día | [PNG](pilots-graphic/d111g2_mixed_tenement_2.png) · [metadata](pilots-graphic/d111g2_mixed_tenement_2.json) | Los mismos 9 módulos y 9.522 triángulos | Fachada más plana; los huecos de escaparate siguen ausentes |

Ambos renders usan `mixed_tenement`, seed 2, orientación y encuadre iguales. La diferencia
visual proviene del perfil de material y luz; los manifiestos conservan los módulos, las fuentes,
las transformaciones y los hashes de cada imagen. La geometría importada es real, pero los
balcones no desembocan en puertas y el acceso no organiza una planta comercial creíble. La
evaluación arquitectónica queda **parcial** y requiere rediseñar la fachada antes de pedir
aprobación humana. Esto no equivale a una comparación Quaternius/Kenney/híbrida completa.

### Qué cerró la ejecución de 2026-11-20 y qué sigue abierto

La adenda D-111 produjo lo que aquí estaba pendiente, con la autoridad del Composer intacta:

- `row_house` ya tiene comparativa A/B de una sola variable (control vs fachada Geometry Nodes,
  mismo seed, huella y silueta) en `../graphics-capabilities/evidence/sheets/pilots_sheet.png`.
- `warehouse` y `town_hall` **no** tienen candidata y el motivo está medido, no opinado: el módulo GN
  declara `allowedFamilies: ["residential_low"]` y el Composer corta la composición antes del render.
  Relajar esa lista habría sido falsificar la identidad de familia; se registró la restricción
  (`../graphics-capabilities/evaluations/pilots.md`).
- Contexto urbano a 1440×900 con calzada, acera, parcela, árbol, personaje y vehículo de escala, a 1×
  y 0,5×, en `../graphics-capabilities/evidence/sheets/urban_context_sheet.png`.
- Medidas de frame antes/después de cada efecto de Phaser 4, en
  `../graphics-capabilities/evaluations/phaser-fx-lab.md`.

Sigue abierto, y es lo que bloquea la promoción: el rediseño de la planta baja comercial del
`mixed_tenement` (escaparates creíbles), la revisión visual humana de los dos candidatos y decidir si
se autorizan módulos GN propios de `industrial_heavy` y `civic_landmark`, que es un WP nuevo con su
propia medición.

## Validación conocida

- `pnpm art:building-composer:validate`: pasa con la nueva receta.
- El render EEVEE Material Maquette de seed 2 terminó con OpenGL forzado: 81,2 s, pico RSS
  4.895,3 MiB, 9 módulos y 9.522 triángulos. El primer intento con backend por defecto quedó
  esperando sincronización de GPU después de guardar el pase principal; su PNG no tiene manifiesto
  y no cuenta como candidato validado.
- El render EEVEE Graphic Civic del mismo candidato terminó con OpenGL forzado: 69,9 s,
  pico RSS 4.177,9 MiB, 9 módulos y 9.522 triángulos. Ambos perfiles pasan por el mismo
  compositor y generan manifiestos separados; las cifras son de producción offline, no de Phaser.
- `pnpm art:world-catalog:validate`, `pnpm art:character-factory:validate` y
  `pnpm art:licenses:check`: pasan.
- `pnpm art:building-composer:validate:test` (52 casos),
  `pnpm art:building-composer:geometry:test`, `pnpm art:building-style:build:check`,
  `pnpm art:building-modules:build:check`, `pnpm typecheck` y `pnpm build`: pasan.
- `pnpm test` no termina verde: al repetir aislados, hay un fallo en
  `market-actionability.test.ts` (espera una fusión, obtiene dos) y cuatro en
  `vd7a-multiparcel.test.ts` (aceptación/IA de acería). El commit de arte no modifica
  `packages/simulation`; se registran como fallos de la rama, sin atribuirles una causa
  sin investigación específica.
- `pnpm art:building-modules:validate`: 60 errores existentes del catálogo general; el módulo
  Quaternius nuevo no figura entre ellos. Se registran por separado de esta incorporación.
- `pnpm art:staging:validate`: ocho fallos anteriores (siete procedencias originales incompletas y
  una referencia generada ausente), documentados en la ficha de fuentes.

No se modifican `GameState`, guardados, topología vial ni manifiestos de runtime principal.
