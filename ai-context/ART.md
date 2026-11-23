# Arte — contexto operativo para agentes

## Estado

Landlord dispone de especificaciones completas de preproducción:

- `docs/art/ART-BIBLE.md`
- `docs/art/ART-PIPELINE.md`
- `docs/art/BOOTSTRAP-ASSET-LIBRARY.md`

## Decidido

- IP original (D-001).
- 2.5D isométrico como dirección inicial (D-003).
- Phaser confirmado para Gate 1 (D-050).
- Blender 5.2.2 LTS como versión fijada del toolchain artístico inicial (D-053).
- bootstrap artístico self-contained: CC0 + procedural-first + automatización, sin artista contratado como dependencia de Gate 2/Visual Direction Spike (D-054).
- React/DOM para HUD/paneles según arquitectura; no para entidades del mundo.
- D-111: dirección visual de maqueta urbana material aprobada el 2026-11-19. `graphic_civic`
  sigue como control del spike; no se promueven sprites, filtros ni librerías nuevas hasta revisar
  los pilotos `row_house`, `mixed_tenement` y `warehouse` en escena real.
- D-111 (ejecución 2026-11-20): las capacidades gráficas se probaron de verdad y su registro está en
  `docs/art/graphics-capabilities/` (19 tecnologías, 17 campos por entrada, seis hojas de revisión en
  `evidence/sheets/`). Geometry Nodes aporta fachada paramétrica a `row_house` y `mixed_tenement`; las
  extensiones arquitectónicas y los garajes de Retro Urban quedan rechazados con motivo medido; los
  efectos de Phaser 4 viven sólo en el laboratorio de QA `/art-lab?artQa=1` y nada se activa por
  defecto. La promoción sigue cerrada hasta revisión humana.
- Selector A/B de HUD/terreno sólo para QA (`?artQa=1`), sin persistencia de partida; capturas de día
  y noche y candidatos del Composer con manifiestos viven en `docs/art/material-maquette-spike/`.

## Parámetros de producción pendientes del spike material

- 3D -> prerender 2D/2.5D.
- EEVEE como batch renderer.
- cámara ortográfica ~45° / ~30°.
- footprint 2:1.
- grid 128x64 y master 2x.
- iluminación canónica.
- personajes en 8 direcciones.
- atlases 2048² multipack.
- PNG RGBA como baseline.
- Git LFS para grandes fuentes binarias.
- Art Lab + Playwright para visual regression.

La dirección general está aprobada; estos parámetros y la compatibilidad visual día/noche siguen
sujetos a evidencia en escena. Véase `docs/art/MATERIAL-MAQUETTE-DIRECTION.md`.

## Librería bootstrap local

Ya descargados localmente por el propietario:

- Quaternius Downtown City MegaKit Standard;
- Quaternius Universal Base Characters Standard;
- Quaternius Universal Animation Library Standard y Library 2 Standard;
- Kenney City Kit Industrial;
- Kenney City Kit Commercial;
- Kenney City Kit Roads;
- Kenney UI Pack;
- Kenney UI Audio;
- Poly Haven Red Brick 03, Red Bricks 02, Asphalt 07, Concrete Wall 003, Rusty Metal 02 y Wood
  Planks Grey como fuentes 4K; derivados bootstrap objetivo 2K.

No asumir que esos binarios están en Git.

El 2026-11-20 se registraron en staging local cinco packs nuevos de Kenney (Building Kit, Mini
Characters, Modular Buildings, Retro Textures Fantasy y Retro Urban Kit) y Quaternius Ultimate
Buildings. La segunda copia recibida de City Kit Roads coincide en 487/487 archivos con la fuente
ya registrada. Los seis packs nuevos están clasificados en `world-asset-index.json` como candidatos,
sin `runtimeReady` ni compatibilidad artística aprobada. Desde 2026-11-20, Ultimate Buildings
usa `unitScale=2` con 102 modelos medidos y dos módulos seleccionados para un piloto de
`mixed_tenement`; Mini Characters usa `unitScale=1` con 43 GLB medidos y jobs de QA.
Building Kit, Modular Buildings y Retro Urban mantienen escala de pack pendiente. Ficha y
matices de licencia en
`docs/art/NEW-SOURCE-PACKS-2026-11-20.md`.

## Lectura obligatoria

1. `docs/art/README.md`
2. `docs/art/ART-BIBLE.md`
3. `docs/art/ART-PIPELINE.md`
4. `docs/art/BOOTSTRAP-ASSET-LIBRARY.md`
5. `docs/art/OPEN-DECISIONS.md`
6. `docs/art/ASSET-CHECKLIST.md`
7. `docs/art/graphics-capabilities/README.md` si el trabajo toca una herramienta gráfica nueva
   (Geometry Nodes, extensiones, materiales externos, filtros de Phaser): registra qué se probó, con
   qué evidencia y en qué estado está.

## Reglas

- No convertir BASELINE en DECIDED sin evidencia/spike.
- No producir masivamente antes del Visual Direction Spike.
- No copiar IP ajena.
- No bakear texto que deba localizarse.
- No derivar footprint/collision de pixels.
- No editar atlases generados manualmente.
- Todo asset externo debe declarar provenance/licencia.
- CC0 no implica que debamos volcar ZIPs completos al repo: esperar política LFS/provenance.
- El Building Composer gobierna hoy la producción modular de edificios; la antigua Building Factory
  está retirada (D-098). Mantener semillas, procedencia, huellas y validación dentro de esa cadena.
- D-111.2 cerró en `READY FOR HUMAN VISUAL REVIEW` (ledger: `docs/art/graphics-capabilities/D1112-CLOSURE-LEDGER.md`):
  la proyección de conservación distingue conservado/envejecido/dañado/ardiendo a partir de
  `state/condition/structuralIntegrity` (`building-condition.ts`); el tier `aged` cae en el sprite
  `complete` hasta que exista sprite envejecido aprobado (D-080). Las candidatas WP06 y el fuego
  híbrido sólo se ven por rutas QA (`?fxCandidate` en /art-lab, `placeCandidateQa` en la escena);
  nada está promocionado y `runtime-promotions.json` no se tocó. FINAL-ASSET-QA (2026-11-23): las
  demostraciones de fuego/daño deben usar arquitectura WP06; los `bld_*` legacy son controles
  históricos — la ruta QA lo valida (`validateCandidateQa`) y existe el mapa de procedencias
  (`docs/art/graphics-capabilities/FINAL-ASSET-SOURCES.md`).
- Guía reutilizable para generar y revisar un edificio: `docs/art/BUILDING-COMPOSER.md` §39.
- D-111.3 (2026-11-23): franjas de fachada corregidas (sombra key + ambiente neutro), interior
  dressing de daños/incendios determinista (`_compose_damage_interior`, sin tocar el PRNG de los
  anclajes), envejecimiento v3 legible a escala de juego (D-080 sigue abierto) y town hall
  neoclásico como candidata QA (`neoclassical_town_hall_v1`; `ag_civic_v2` intacto). Ledger:
  `docs/art/graphics-capabilities/D1113-ART-REWORK-LEDGER.md`; aceptación:
  `D1113-ART-ACCEPTANCE.md`. Reutilización: `BUILDING-COMPOSER.md` §40.

## Fuente extensa

`docs/research/05-art-direction-and-pipeline-research.md`
