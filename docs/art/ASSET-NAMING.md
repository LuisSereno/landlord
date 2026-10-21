# Asset Naming, Anchors y Atlas

> Versión: 0.1 — propuesta.
>
> Este documento extrae las convenciones operativas del Art Pipeline para que puedan consultarse sin recorrer la especificación completa.

**Naming convention**

Todo en ASCII, `lower_snake_case`, sin espacios.

Tipos:

```text
bld_  building
chr_  character
veh_  vehicle
prp_  prop
ter_  terrain
vfx_  effect
ui_   interface
ico_  icon
snd_  sound
mus_  music
```

Edificio:

```text
bld_res_rowhouse_a_r0_complete
bld_res_rowhouse_a_r0_build_25
bld_res_rowhouse_a_r0_build_50
bld_res_rowhouse_a_r0_damaged
```

Personaje:

```text
chr_worker_m01_idle_ne_f000
chr_worker_m01_walk_ne_f000
chr_worker_m01_walk_ne_f001
```

Terreno:

```text
ter_asphalt_clean_a
ter_grass_dry_a
ter_road_straight_ne_sw
```

No colocaría `v001`, `final`, `final2`, etc. en IDs runtime.

La versión pertenece a Git y al manifest.

**Anchor**

Esta es una de las especificaciones más importantes.

No se debe fijar manualmente un pivot “aproximadamente en los pies”.

El `.blend` contiene:

```text
ANCHOR_ROOT
```

El script proyecta ese punto con la cámara oficial y escribe el resultado en metadata.

En personajes:

```text
ANCHOR_ROOT = midpoint between feet on ground
```

En edificios:

```text
ANCHOR_ROOT = footprint origin / ground plane
```

De esta manera, trim y atlas packing no rompen posicionamiento.

**Trim**

TexturePacker puede eliminar transparencias manteniendo información de tamaño original, aplicar márgenes y extruir píxeles de borde para evitar seams al escalar o muestrear entre texels. También soporta multipack y pivots.

Configuración inicial:

```text
trim                 on
trim threshold       1
trim margin          2 px
extrude              2 px
shape padding        4 px
border padding       4 px
rotation in atlas    off
algorithm            MaxRects
max atlas            2048×2048
multipack            on
```

Desactivaría inicialmente la rotación del sprite dentro del atlas para simplificar tooling, inspección y debugging.

**Atlases**

No utilizaría un gigantesco `game.png`.

Separaría por afinidad:

```text
atlas_terrain
atlas_buildings_residential
atlas_buildings_commercial
atlas_buildings_industrial
atlas_characters_workers
atlas_characters_civilians
atlas_vfx
```

TexturePacker permite limitar dimensiones y producir múltiples hojas automáticamente; su valor predeterminado actual para `--max-size` es 2048 y soporta salida Phaser con multipack.

Phaser diferencia entre spritesheet —celdas uniformes— y atlas —frames de tamaños y posiciones arbitrarias— y soporta `multiatlas` para contenidos que no caben en una sola textura.
