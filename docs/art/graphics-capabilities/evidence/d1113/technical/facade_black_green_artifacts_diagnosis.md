# D-111.3-T FASE 1 · Franjas negro-verdosas en fachadas de ladrillo — diagnóstico final

**Edificios:** `mixed_tenement` seed 2 y `row_house` seed 17, perfil `gn_residential_v2`,
mood `day_civic`. **Estado inicial:** HEAD `743aea4` (D-111.3 cerrado).
**Veredicto:** defecto **eliminado y medido**; ver `facade_black_green_artifacts_final_ab.png`.

## 1. Reproducción (Paso 1)

El estado publicado de `743aea4` reproduce la queja con recursos versionados:

- `technical/controls_d1112/wp06_mixed_tenement-candidata.png` y
  `wp06_row_house-candidata.png` (los PNG revisados que el propietario sigue viendo):
  franja negro-verdosa en la cabecera de **cada paño de ladrillo** de los alzados frontales y
  en el **testero lateral**, con degradado de ~0,8 m hacia abajo.
- Corrida limpia en worktree `743aea4` con `LANDLORD_ART_MOOD=day_civic` (firma idéntica a la
  publicada, `94f1106d02e6`/`5468186522ad`): el defecto es reproducible de punta a punta.

## 2. Diagnóstico (Paso 2) — qué NO era

Laboratorio versionado `scripts/d1113t-facade-lab.py` y `scripts/d1113t-facade-lab2.py`,
corridos en el estado con queja (worktree `743aea4`) bajo `day_civic`. Métrica: píxeles
verde-negros (`suma RGB < 250` y `G o B > R + 8`) en una columna de ladrillo puro sin ventanas.

| Celda | Mutación | Píxeles franja | Lectura |
|---|---|---|---|
| A control | nada | 323 | defecto presente |
| B | sombra del SOL key OFF | 322 | **no es la sombra proyectada de la key** |
| C | fill/rim/world a gris cálido | 269 | el tinte del ambiente explica poco |
| D | sólo key (sin relleno/ambiente) | 254 | la franja persiste sin luz indirecta |
| E | cornisas GN sin proyectar | 173 | aporta, pero no es la causa |
| F | vanos GN sin proyectar | 173 | aporta, pero no es la causa |
| H | key casi cenital | 191 | no es sombra rasante |
| I | losas/azoteas sin proyectar | 323 | descarta las losas |
| J | paneles sin proyectar | 323 | descarta autosombra de paneles |
| G | clay gris (sin materiales) | 0 | la franja vive EN el material, no en la geometría |

La celda G es la bisagra: sin los materiales originales la franja desaparece, con cualquier
mutación de luces/sombras persiste. **No era sombra proyectada ni balance de ambiente** (el
diagnóstico de D-111.3 FASE 1 era incompleto: las sombras aportaban contraste, pero la banda
tenía una fuente propia).

### Causa final

`mod_megakit_brick_wall_2m` (y `mod_megakit_doorframe_trim`) proceden del export
**"glTF (Godot)"** del Quaternius Downtown City MegaKit. Godot hornea la iluminación de su
escena de origen en el atributo de color de vértice `COLOR_0`. Medido directamente en la fuente
(`Brick_Plain_3.gltf`): la fila inferior de vértices del paño vale **(0, 0.126, 0.126)** —
negro con dominante verde-azulada— y las filas superiores valen blanco puro. El importador de
glTF conecta ese `COLOR_0` a `Base Color` mediante un `MULTIPLY` (〔§11〕 de `scene.py` lo
documentaba para alcanzar el atlas), de modo que **cada panel llega con su propia banda
degradada**, multiplicada sobre el ladrillo, invisible en la textura (`T_RedBrick_BaseColor.png`
es uniforme) e independiente del rig de luz. El matiz negro-verdoso del producto
(R≈0 al multiplicar) es exactamente la franja que describió el propietario, y explica por qué
persistía a 1× y 0,5× y en ambos edificios.

La corrección de carpintería de D-111.3 (`gn_facade_grammar.py`) además **no estaba publicada**:
el GLB `gn_window_bay_2m.glb` conservaba el blob `9c7df2c3` idéntico a `cd7bb6b`. Ambas cosas
se arreglan en esta fase.

## 3. Corrección (Paso 3)

1. **GLB de ventana GN publicado.** Regenerado con el generador corregido
   (`--parts=window_bay --seed=7`, determinista: la corrida completa de 9 partes reproduce los
   otros 8 GLB byte-idénticos a los publicados). Profundidad del vano 0,400 → 0,323 m
   (antepecho/dintel menos salientes). Catálogo, inventario (sólo el bloque medido del módulo,
   vía la herramienta oficial), perfil de estilo y pines del contrato de weathering re-medidos
   en cadena. Detalles y hashes: `gn_window_source_fix.json`, lámina `gn_window_rebuild_ab.png`.
2. **Vertex lighting horneado neutralizado en el generador.** Nuevo
   `strip_baked_vertex_lighting()` en `building_composer/scene.py`, llamado desde
   `import_module_source` para toda fuente importada: si el color de vértice entra por un
   `MIX MULTIPLY` con factor 1 (el patrón medido del export Godot), el grafo se reconecta al
   atlas directo y el atributo `COLOR_0` se elimina. No toca vértices ni UVs; no desactiva
   sombras globales; no altera la calibración nocturna; no edita PNGs. Fuentes cuyo `COLOR_0`
   no siga ese patrón quedan intactas. En los dos residenciales afecta a
   `Brick_Plain_3.gltf` y `DoorFrame_Trim.gltf`.
3. Efecto colateral coherente: el atlas `T_RedBrick_BaseColor` pasa a ser alcanzable por la
   escalera de albedo de §11 (antes "no llegaba a través del MULTIPLY", deuda documentada),
   así que el ladrillo se trata con la misma matemática que los muros Kenney.

## 4. Comprobación (Paso 4)

`facade_black_green_artifacts_final_ab.png` (generada por
`scripts/d1113t-facade-final-sheet.py` sólo desde recursos versionados) y
`facade_black_green_metrics.json`:

| Zona | ANTES | DESPUÉS |
|---|---|---|
| mixed paño izquierdo (ladrillo puro) | 1 321 px franja · salto lum. 39,0 | **0 px** · 8,8 |
| mixed testero lateral | 643 px | **6 px** |
| row_house testero lateral | 1 104 px | **0 px** |
| mixed orientación 90° (regresión) | 2 555 px · salto 23,2 | **0 px** · 13,5 |

- Escalas 1× y 0,5× (la del juego) en la lámina; franja desaparecida en ambas.
- Segunda orientación (90°) comprobada: sin franjas y sin nuevos defectos; el salto lumínico
  residual (13,5) es la sombra natural del alero del tejado sobre el testero.
- Sin huecos, manchas ni superficies atravesadas nuevos; marcos de ventana, balcones y
  cornisas conservan su relieve; los cristales siguen siendo el único elemento oscuro
  (legítimo, banda `window_blue_to_dark_glass` de la capa de estilo).
- Sombras: el rig no cambió; la luz clave sigue proyectando (ver celdas E/F: la sombra de
  cornisa y vano existía y sigue existiendo, ahora sobre ladrillo sin doble sombreado).

## 5. Publicación (Paso 5)

- `blender_artist/sources/original/gn_window_bay_2m.glb` (nuevo blob `a504ff71…`),
  `gn_facade_system.blend` vivo y `gn-facade-report-seed7.json`.
- Catálogo/inventario/estilo/pines regenerados con las herramientas oficiales
  (`build-building-modules.mjs`, `build-building-style.mjs`, pines del contrato).
- Las dos candidatas doradas (`evidence/v2/candidates/wp06_{mixed_tenement,row_house}-candidata`)
  regeneradas con el pipeline oficial: sus firmas cambian deliberadamente
  (`94f1106d02e6→64fbeb4619e2`, `5468186522ad→28304f99ce13`) porque el vano GN es ahora otra
  geometría. **Los controles D-111.2 quedan archivados** en
  `evidence/d1113/technical/controls_d1112/`. `test_building_composer_candidates.py` en verde.
- Consecuencia para fases siguientes: toda evidencia de daño/incendio/envejecimiento/Phaser
  de los residenciales se regenera contra este estado (FASE 2 y FASE 4 del brief técnico).

## 6. Límites honestos

- La corrección actúa sobre el material importado; el archivo CC0 de origen
  (`Brick_Plain_3.gltf`) no se modificó — se neutraliza su lighting horneado en el generador,
  que es donde nos pertenece decidir cómo se ilumina la escena.
- El inventariado oficial (`inventory-building-modules.mjs`) no conoce las fuentes originales
  neoclásicas y re-mediría los GLB de fuego: la regeneración completa del inventario es
  destructiva hoy. En esta fase se trasplantó **sólo** el bloque medido por la herramienta para
  `gn_window_bay_2m.glb`. Deuda registrada para FASE 3/6.
- Las corridas multi-candidato en un mismo proceso de Blender pueden producir el segundo PNG
  en blanco (observado con y sin esta corrección); toda evidencia de esta fase se renderizó en
  procesos dedicados. Deuda registrada para FASE 3.
