# Inventario de fuentes visuales

> Generado por `pnpm art:sources:audit`. No edites las tablas manualmente.

Fecha: 2026-11-02. Decisión de compra: **DEFER**.

## Ejecutar la auditoría

```bash
pnpm art:staging:validate
pnpm art:licenses:check
pnpm art:jobs:validate
pnpm art:sources:audit
```

Se localizaron **3099 modelos** y **2213 texturas** en 18 fuentes aprobadas.
Las métricas `null` significan que el formato requiere inspección Blender; no se infieren.

## Cobertura por fuente

| Fuente | Licencia | Presente | Modelos | Texturas | Formatos | Categorías |
|---|---|---:|---:|---:|---|---|
| `src_quaternius_downtown_city_megakit` | CC0-1.0 | sí | 459 | 75 | fbx 306, gltf 153 | characters 36, commercial 384, nature 39 |
| `src_quaternius_base_characters` | CC0-1.0 | sí | 44 | 48 | fbx 26, gltf 18 | characters 44 |
| `src_quaternius_animation_library` | CC0-1.0 | sí | 4 | 3 | fbx 2, glb 2 | characters 4 |
| `src_quaternius_animation_library_2` | CC0-1.0 | sí | 7 | 3 | blend 1, fbx 3, glb 3 | characters 7 |
| `src_kenney_city_commercial` | CC0-1.0 | sí | 123 | 50 | fbx 41, glb 41, obj 41 | commercial 123 |
| `src_kenney_city_industrial` | CC0-1.0 | sí | 111 | 48 | fbx 37, glb 37, obj 37 | industrial 111 |
| `src_kenney_city_roads` | CC0-1.0 | sí | 285 | 102 | fbx 95, glb 95, obj 95 | characters 3, nature 6, terrain 276 |
| `src_kenney_city_suburban` | CC0-1.0 | sí | 120 | 51 | fbx 40, glb 40, obj 40 | nature 9, residential 111 |
| `src_kenney_car_kit` | CC0-1.0 | sí | 150 | 54 | fbx 50, glb 50, obj 50 | vehicles 150 |
| `src_kenney_nature_kit` | CC0-1.0 | sí | 1645 | 1640 | dae 329, fbx 329, glb 329, obj 329, stl 329 | nature 1645 |
| `src_kaykit_city_builder_bits` | CC0-1.0 | sí | 102 | 3 | gltf 41, obj 61 | nature 4, props 56, terrain 12, vehicles 30 |
| `src_polyhaven_asphalt_07` | CC0-1.0 | sí | 1 | 4 | blend 1 | terrain 1 |
| `src_polyhaven_concrete_wall_003` | CC0-1.0 | sí | 1 | 4 | blend 1 | props 1 |
| `src_polyhaven_red_brick_03` | CC0-1.0 | sí | 1 | 4 | blend 1 | props 1 |
| `src_polyhaven_red_bricks_02` | CC0-1.0 | sí | 1 | 4 | blend 1 | props 1 |
| `src_polyhaven_rusty_metal_02` | CC0-1.0 | sí | 1 | 4 | blend 1 | props 1 |
| `src_polyhaven_wood_planks_grey` | CC0-1.0 | sí | 1 | 4 | blend 1 | props 1 |
| `src_microsoft_rocketbox` | MIT | sí | 43 | 112 | fbx 43 | characters 33, nature 10 |

## Hallazgos

- Las fuentes declaradas están físicamente disponibles cuando `Presente` indica `sí`; la guarda de staging verifica además su integridad.
- El staging contiene arquitectura urbana e industrial, personajes/animaciones, vehículos, naturaleza, props y materiales.
- Esta auditoría no promueve ningún asset ni declara calidad final. La selección artística ocurre en V.e.1 y posteriores.
- `PURCHASE DECISION = DEFER`: el inventario no demuestra todavía un gap que satisfaga los cuatro criterios de compra.

## Revisar contact sheets

```bash
pnpm art:sources:contact-sheets
```

La salida local está en `blender_artist/generated/catalog-sources/` y contiene hojas de residencial, comercial, industria, cívico, personajes, vehículos, props y naturaleza. No se versiona. La ingesta cruda de Rocketbox evidencia materiales magenta; es una señal de remapeo pendiente, no una promoción fallida.

## Evidencia detallada

Los registros por archivo, hashes y métricas estructurales están en [`source-inventory.json`](./source-inventory.json).
