# WP4.15-V Spike: Instrucciones de Ejecución

## Objetivo

Validar que las fuentes CC0 descargadas (Quaternius, Poly Haven) pueden integrarse en el pipeline Blender con el style layer `graphic_civic` antes de comprometer el trabajo completo de WP4.15-V.

## Requisitos

- Blender 5.2.2 LTS instalado
- Packs CC0 extraídos (Fase 0 completada)
- Este repositorio en la rama `main`

## Pasos

### 1. Verificar que los packs están extraídos

```bash
ls blender_artist/staging/third_party/cc0/extracted/
# Debe mostrar: quaternius/, kenney/, polyhaven/
```

Si no existen, ejecutar:

```bash
node scripts/extract-cc0-packs.mjs
```

### 2. Ejecutar el spike de compatibilidad

```bash
cd /home/luis/RepositorioGitHub/landlord
blender --background --python tools/art-pipeline/blender/spike_compatibility.py
```

Esto generará:
- `blender_artist/spike/building_spike.png` — edificio con material Poly Haven (red_brick_03)
- `blender_artist/spike/character_spike.png` — personaje base
- `blender_artist/spike/building_spike.json` — metadata (pivot, dimensiones)
- `blender_artist/spike/character_spike.json` — metadata

### 3. Revisar los renders

Abre las imágenes PNG y evalúa:

**Edificio**:
- ¿El material `red_brick_03` se ve como ladrillo real (no color plano)?
- ¿La paleta `graphic_civic` (tint, roughness) produce el tono correcto?
- ¿El pivote está en el centro del suelo?

**Personaje**:
- ¿La geometría importa correctamente?
- ¿Las proporciones son humanas (~1.8m)?
- ¿El material base es razonable?

### 4. Decidir STOP V1

Basado en los renders, decide:

- **GO**: Ambos assets funcionan correctamente → continuar Fases 2-8
- **CONDITIONAL GO**: Edificio funciona, personaje necesita más trabajo (retargeting de animaciones, materiales de ropa) → continuar edificios/terrain/props, pero **WP4.15-V no puede declararse DONE hasta resolver personajes**
- **NO-GO**: Las fuentes CC0 no sobreviven al pipeline (materiales rotos, geometría incompatible) → detener WP4.15-V

### 5. Spike de personajes vestidos (Microsoft Rocketbox, MIT)

Los Universal Base Characters de Quaternius llegan sin ropa y no existe un pack CC0 de
ropa urbana, así que se añadió Microsoft Rocketbox (licencia MIT, ver
`docs/art/BOOTSTRAP-ASSET-LIBRARY.md`):

```bash
blender --background --python tools/art-pipeline/blender/spike_rocketbox.py
```

Genera:

- `blender_artist/spike/rocketbox_chr_worker.png` (Male_Adult_05, chaleco utilitario)
- `blender_artist/spike/rocketbox_chr_enforcer.png` (Male_Adult_10, chaqueta deportiva)
- `blender_artist/spike/rocketbox_chr_civilian.png` (Male_Adult_09, camiseta y vaqueros)
- `blender_artist/spike/rocketbox_chr_professional.png` (Female_Adult_09, blazer)
- `blender_artist/spike/rocketbox_walk/frame_*.png` (ciclo de marcha)
- `tools/art-pipeline/blender/inspect_rocketbox.py` permite inspeccionar cualquier FBX
  del pack: `blender --background --python .../inspect_rocketbox.py -- <ruta.fbx>`

Resultados medidos en el spike:

- Los 4 avatares importan con armadura `Bip01` (80 huesos) y 3 slots de material
  (body / head / opacity) con texturas `.tga` correctas tras remapear rutas.
- Altura del bind pose 1.812 m — coincide con `proportions.characterHeight`.
- El clip `m_walk_neutral.max.fbx` comparte **80 de 80 huesos** con el rig del avatar:
  no hace falta retargeting, basta con asignar la action a la armadura.
- Los clips de la variante `xy` traen movimiento de raíz (~1 m por ciclo), así que para
  generar sprites hay que recentrar el personaje en cada frame o despojar la traslación
  del hueso raíz.

### 6. Rig de iluminación del style layer

El primer paso del spike dejaba los personajes sobreexpuestos (sol a 360 W/m² y sin tone
mapping). `style_layer_graphic_civic.json` ahora declara irradiances reales para luces
SUN (`keyEnergy` 3.2 / `fillEnergy` 1.1 / `rimEnergy` 1.6), `worldStrength` 0.35 y el
`postProcessing` AgX que ya estaba escrito en el propio JSON. `setup_lighting()` lee esos
valores sin multiplicadores mágicos, así que el JSON es la única fuente de verdad.

### 7. Si GO o CONDITIONAL GO: continuar con Fase 2

Crear los archivos `.blend` para el vertical slice completo (3 edificios, terrain, props, vehicles, 3 personajes).

## Assets del Spike

- **Edificio**: `Building_Medium_2_001.fbx` de Quaternius Downtown City MegaKit
- **Personaje**: `Superhero_Male_FullBody.fbx` de Quaternius Universal Base Characters
- **Animación**: `UAL1_Standard.glb` de Quaternius Universal Animation Library (no se usa en este spike inicial, solo geometría)
- **Material**: `red_brick_03` de Poly Haven (aplicado via style layer)

## Style Layer

El archivo `tools/art-pipeline/blender/style_layer_graphic_civic.json` define:
- Recetas de materiales (road_asphalt, residential_brick, industrial_metal, concrete, wood)
- Overrides de paleta (window, green, plaster)
- Proporciones (characterHeight: 1.8m, cellSize: 4x4m)
- Lighting rig (key/fill energy y color)
- Cámara (ORTHO, 45° azimuth, 30° elevation)

## Notas

- El spike CC0 (Quaternius) valida geometría + materiales sin animación
- El spike de Rocketbox sí comprueba animación: `m_walk_neutral` se aplica al rig sin
  retargeting (80/80 huesos compartidos)
- La escala 4×4m por celda es **convención visual del slice**, no contrato de simulación
