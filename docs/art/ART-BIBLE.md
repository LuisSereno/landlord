# Art Bible — Landlord

> Versión: 0.1
>
> Estado: borrador de preproducción.
>
> La dirección 2.5D isométrica es vigente; los parámetros concretos descritos aquí son propuestas sujetas al Visual Direction Spike.

## Baseline preliminar

| Área | Baseline v0.1 |
|---|---|
| Representación | 2.5D isométrica/dimétrica |
| Fuente de assets | 3D en Blender con salida prerenderizada |
| Estética | realismo estilizado con caricatura moderada |
| Setting inicial propuesto | ciudad ficticia inspirada en 1925–1940 |
| Cámara propuesta | ortográfica; azimut 45°; elevación calibrada a footprint 2:1 |
| Grid visual propuesto | 128×64 px a zoom de referencia |
| Master | 2×, equivalente a 256×128 px por celda |
| Iluminación | fija y canónica |
| Personajes | rigs 3D prerenderizados, baseline de 8 direcciones |
| UI | React/CSS/SVG; no bakear texto operativo |
| VFX | sprites pequeños + efectos procedurales/runtime |
| Accesibilidad | color + forma/icono/patrón, nunca sólo color |

## Principio rector

> Una ciudad industrial viva, atractiva pero moralmente ambigua, representada como una maqueta cinematográfica isométrica en la que riqueza, deterioro, poder y crimen pueden leerse sin abrir un panel.

## Estado de las recomendaciones

Los valores numéricos de cámara, grid, escala física, paleta y animation budget no deben interpretarse todavía como constantes de producción. Deben aprobarse o modificarse en [VISUAL-DIRECTION-SPIKE.md](VISUAL-DIRECTION-SPIKE.md).

## Referencias visuales y dirección artística

La comparación de referencias conduce a una dirección bastante concreta. Landlord no debería intentar superar a *Anno* o *Cities: Skylines* en realismo geométrico; perdería la principal ventaja de su arquitectura web 2.5D. Tampoco recomiendo convertirlo en pixel art puro. Su espacio más interesante está entre el carácter legible de *Constructor*, la sofisticación histórica de *Anno*, la fuerte identidad atmosférica de *Frostpunk* y la claridad sistémica de *RimWorld/Prison Architect*.

| Referencia | Qué funciona visualmente | Qué tomar para Landlord | Qué no copiar |
|---|---|---|---|
| **Constructor / Mob Rule** | isométrico bitmap, edificios inmediatamente identificables, humor, exageración | siluetas, lectura instantánea, personalidad | assets, personajes, iconografía y diseño concreto |
| **Constructor Plus** | misma legibilidad llevada a más variedad y resolución | diferenciación extrema de negocios y utilities | exceso de color/ruido en algunas escenas |
| **Anno 1800** | materiales ricos, arquitectura históricamente evocadora, densidad urbana creíble | materialidad, kit arquitectónico, evolución socioeconómica visible | presupuesto de detalle 3D completo |
| **Cities: Skylines** | ecosistema de assets y modularidad | disciplina de metadata/importación y kits urbanos | perseguir fotorrealismo 3D |
| **Frostpunk** | atmósfera como parte de la identidad del juego | VFX, clima, color grading, lectura emocional | oscuridad que perjudique información económica |
| **Tropico 4/5** | entorno cálido, colorido, edificios distinguibles y política visible | mezcla entre ciudad, personajes y humor | estética tropical concreta |
| **Prison Architect** | forma antes que detalle | lectura sistémica, iconografía | simplicidad extrema para edificios premium |
| **RimWorld** | estilo icónico de bajo coste | claridad de agentes a distancia | representación abstracta completa |
| **Banished** | ciudad orgánica, materiales naturales y coherencia de escala | cohesión arquitectónica y ambiental | coste de producción 3D completo |
| **SimCity 2000** | lectura por tiles, silueta urbana y densidad comprensible | ortogonalidad del sistema bajo la imagen | resolución/pixelización histórica |
| **Two Point Hospital** | volúmenes exagerados y personajes legibles | exaggeration controlada y siluetas | tono completamente cartoon |
| **Stardew Valley** | extraordinaria coherencia entre sprites, paleta y entorno | disciplina de paleta y repetición modular | pixel art como dirección principal |

La base histórica de *Street Wars/Mob Rule* es especialmente valiosa porque el juego final mantuvo bitmaps isométricos pese a haberse considerado 3D. *Constructor Plus*, por su parte, muestra cómo esa gramática puede sostener más de 140 edificios y múltiples mundos.

*Anno 1800* es probablemente la referencia más útil para **materiales y arquitectura**. Ubisoft explicó que su departamento artístico creó y texturizó cientos de assets para producir una industrialización urbana creíble, y que el número de materiales por asset fue ya un problema de producción significativo. Esto confirma que Landlord necesita reutilización material y kits modulares, aunque el resultado se bakee a sprites.

*Cities: Skylines II* es menos relevante como estética 2.5D, pero muy relevante como ingeniería de contenido: su sistema de custom assets separa importación, workspace, subobjetos, metadata y publicación; Colossal Order llegó a identificar serialización y virtual texturing como problemas técnicos específicos del soporte de assets. Es una buena lección para no confundir “un PNG bonito” con “un asset de juego correctamente definido”.

*Frostpunk* aporta otra lección: 11 bit Studios describió la eliminación de la nieve como un cambio tan grande que se preguntaron si el resultado seguiría sintiéndose como *Frostpunk*. Es decir, ciertos elementos visuales dejan de ser decoración y pasan a formar parte de la identidad del producto. Para Landlord deberían cumplir ese papel el humo industrial, la suciedad acumulada, la lluvia, la luz de escaparates, los carteles, las calles y la progresión visual del capital.

*Prison Architect* demuestra el valor de preservar un lenguaje de formas: al trabajar en su transición de 2D a 3D, el equipo explicó explícitamente que quería conservar el aspecto reconocible del original. Ludeon explica, además, que durante el desarrollo temprano de *RimWorld* la dirección utilizaba deliberadamente un estilo sencillo e icónico antes de incorporar a un artista dedicado.

*Banished* ofrece una advertencia productiva extremadamente útil. Su desarrollador recuerda que inicialmente quería prácticamente “cero animación” porque modelado, rigging, keyframes y animación eran demasiado trabajo para un desarrollador solitario; posteriormente construyó esa capacidad gradualmente. Para Landlord esto justifica automatizar direcciones y frames desde un rig 3D común en lugar de animar sprites independientemente.

*SimCity 2000* sigue siendo relevante por la legibilidad de sistemas superpuestos: la propia ficha actual de EA recuerda carreteras, ferrocarril, servicios, capa subterránea y conjuntos gráficos personalizables.

*Stardew Valley* merece una precisión: no lo usaría como referencia de prerender isométrico, porque su lenguaje visual es pixel-art 2D. Sí es excelente referencia de **consistencia absoluta de escala, paleta y sprites**; su sitio oficial conserva una galería amplia de capturas para construir moodboards comparativos.

**Dirección artística propuesta para Landlord**

La frase que debería encabezar la Art Bible sería:

> **Una ciudad industrial viva, atractiva pero moralmente ambigua, representada como una maqueta cinematográfica isométrica en la que riqueza, deterioro, poder y crimen pueden leerse sin abrir un panel.**

Cinco pilares:

**Legibilidad antes que detalle.** Un edificio debe poder identificarse por silueta antes de leer su cartel.

**Historia sin documentalismo.** Inspiración 1925–1940 para el primer escenario, pero ciudad ficticia. No necesitamos reproducir literalmente Chicago, Londres o Nueva York.

**Caricatura material.** Proporciones ligeramente exageradas, pero ladrillos, metal, piedra, vidrio, hollín y madera deben resultar materiales convincentes.

**La economía se ve.** Un barrio que prospera cambia visualmente; uno empobrecido también.

**Oscuridad con humor.** El mundo puede contener corrupción y crimen sin ser permanentemente gris ni deprimente.

La época propuesta para el primer vertical slice sería **finales de los años veinte / principios de los treinta en una ciudad ficticia transatlántica**. Permite conectar art déco, ladrillo industrial, tranvías, automóviles tempranos, sindicatos, especulación inmobiliaria, política urbana y crimen organizado sin quedar encadenados a una geografía real.

No convertiría esto en una restricción del motor. Las futuras épocas serían *theme packs*:

```text
era_1920
era_1950
era_1970
era_modern
```

La composición cromática propuesta:

| Token artístico | Hex orientativo | Uso |
|---|---:|---|
| `coal` | `#25282A` | acero, tejados, sombra |
| `warm_plaster` | `#D6C4A1` | fachadas y piedra clara |
| `brick` | `#8C503D` | industria y vivienda |
| `brass` | `#B08A50` | riqueza, señalética |
| `petrol` | `#315A5E` | industrial, transporte |
| `olive` | `#696C52` | servicios/utilidades |
| `paper` | `#E8DFC8` | UI y documentación |
| `danger` | `#A74339` | alerta, policía, pérdida |

Estos valores son **tokens iniciales, no una paleta cerrada**. El arte del mundo puede disponer de centenares de colores; lo que se limita es la distribución de familias cromáticas para mantener identidad.

La riqueza debería modificar el lenguaje material:

```text
POBRE
yeso
madera
ladrillo expuesto
carteles baratos
desgaste
humo

CLASE MEDIA
ladrillo limpio
piedra
toldos
vegetación
mejor iluminación

ALTA
piedra labrada
latón
cristal
mármol
fachadas simétricas
ornamento
```

Así el jugador podría identificar la estratificación económica directamente desde la ciudad.

La identidad visual también debería propagarse por **deterioro**:

```text
state_pristine
state_used
state_neglected
state_damaged
state_abandoned
```

No hace falta modelar cinco edificios distintos. Una parte puede obtenerse mediante decals, materiales y overlays antes del prerender.

**Escala y cámara**

Para el juego recomiendo establecer como unidad lógica:

```text
1 CELL
=
1 square in world space
=
128 × 64 px projected footprint at 100 % reference zoom
```

El render master se generaría al doble:

```text
256 × 128 px
```

y de él se derivaría la variante estándar. La resolución master no determina necesariamente el tamaño del sprite completo: un edificio de cuatro plantas podría ocupar cientos de píxeles verticales.

Opciones consideradas:

| Grid proyectado | Ventajas | Inconvenientes | Recomendación |
|---|---|---|---|
| 64×32 | ligero, retro, muchos objetos | personajes/props pierden detalle | no como baseline |
| **128×64** | buen equilibrio para 1080p/1440p | coste moderado | **elegido** |
| 256×128 | excelente detalle | atlases y memoria crecen rápido | master/HiDPI |
| 1:1 diamond | más vertical, aspecto distinto | menos conectado al legado | descartar inicialmente |

Tiled permite configurar explícitamente orientación isométrica, `tilewidth` y `tileheight`, mantiene grid lógico separado de la imagen y ofrece alineación específica para objetos isométricos. Por tanto, el editor de mapas puede seguir trabajando con coordenadas lógicas aunque los sprites superen ampliamente el tamaño de una celda.

Para generar un rombo 2:1 de una cuadrícula cuadrada, propondría una cámara ortográfica orientada aproximadamente con **45° de azimut y 30° de elevación sobre el horizonte**. En lugar de almacenar rotaciones Euler “mágicas” manualmente, el pipeline debe tener un `camera_rig.py` que oriente la cámara hacia el origen y compruebe automáticamente que un cuadrado de prueba genera el footprint esperado. Blender dispone de cámara ortográfica y de un `Orthographic Scale` explícito, lo que hace este rig perfectamente reproducible.

**Referencias visuales prioritarias**

Captura oficial de Constructor Plus:

```text
https://image.api.playstation.com/cdn/UP4037/CUSA14667_00/FREE_CONTENT2EABdQIjWVT0HRW3Zr7T/ikgpWkEl_PREVIEW_SCREENSHOT3_175726.jpg
```

System 3:

```text
https://shop.system3.com/products/constructor-plus-pc
```

Anno 1800, análisis técnico de arte:

```text
https://news.ubisoft.com/en-us/article/69SwK8nqv5rDUdEzqbNt6h/create-the-unknown-how-anno-1800-put-a-creative-spin-on-the-industrial-revolution
```

Frostpunk, identidad visual:

```text
https://11bitstudios.com/pl/frostpunk_rizomuv/
```

Prison Architect, preservación de identidad 2D al migrar dimensionalmente:

```text
https://www.paradoxinteractive.com/games/prison-architect-2/news/dev-highlight-a-whole-new-dimension
```

Dota 2, ejemplo público de guía artística profesional:

```text
https://www.dota2.com/workshop/build/references?l=spanish
```

Como ejemplo comunitario de la **estructura documental** de una Art Bible, no como estándar industrial, también es útil revisar repositorios educativos públicos como KiwiTrek/ArtBible. La guía oficial de Dota 2 debe tener mucha más autoridad para criterios de producción.


## Sprites, animaciones, terreno, UI, VFX y audio

**Personajes**

La automatización del prerender hace económicamente viable usar más direcciones que en un pipeline dibujado a mano.

Baseline:

```text
N   NE   E   SE   S   SW   W   NW
```

Es decir, **8 direcciones**.

No usaría mirroring automático como política principal, porque:

- ropa asimétrica;
- objetos en manos;
- uniformes;
- armas;
- texto o insignias

pueden quedar incorrectos.

El pipeline puede ofrecer mirroring únicamente para un asset que declare:

```json
{
  "mirrorSafe": true
}
```

Animaciones iniciales:

| Animación | Frames orientativos | FPS | Loop |
|---|---:|---:|---|
| idle | 6–8 | 6 | sí |
| walk | 8 | 10–12 | sí |
| carry | 8 | 10–12 | sí |
| work | 10–16 | 10–12 | sí |
| talk | 6–10 | 8 | sí |
| interact | 8–12 | 10 | no |
| injured | 4–8 | 6 | depende |

Son presupuestos de Landlord, no restricciones del motor. Phaser utiliza precisamente secuencias de frames almacenadas en spritesheets o atlas como mecanismo principal de animación.

Una animación de:

```text
8 directions
×
8 frames
=
64 renders
```

parece enorme manualmente.

Pero con un rig:

```text
Blender
→ animation
→ rotate rig/camera eight times
→ batch render
```

son 64 outputs de una única animación.

Ahí está una de las principales ventajas de este pipeline.

**Modularidad**

No recomiendo construir cada ciudadano a runtime con:

```text
body
+ trousers
+ shirt
+ jacket
+ hair
+ hat
+ item
```

porque multiplicaría sprites/draws y complicaría depth ordering.

La modularidad principal ocurrirá **offline**:

```text
BASE RIG
   ↓
body preset
clothes preset
hair preset
palette preset
   ↓
automated render
   ↓
finished character sprite
```

Con veinte prendas podríamos producir cientos de personas con scripts sin aumentar la complejidad del renderer.

Runtime layering queda reservado para cosas muy específicas:

- objeto que lleva en la mano;
- indicador de selección;
- ciertos sombreros/accesorios;
- highlight;
- faction marker.

Si en el futuro se quieren personajes 2D esqueléticos, Spine tiene runtime oficial para Phaser y consume skeleton data junto a texture atlases. Es una opción técnicamente válida, pero **no lo elegiría para los ciudadanos principales mientras Landlord siga el pipeline 3D→prerender**.

DragonBones conserva un modelo de atlas + datos de animación JSON, pero su ecosistema oficial ha ido evolucionando hacia Loongbones; por estabilidad del proyecto no lo pondría en el camino crítico.

Aseprite sí puede tener un papel útil como herramienta auxiliar. Su CLI exporta spritesheets y JSON y sus `Slices` pueden contener pivots; sirve muy bien para VFX 2D, retoques frame a frame, iconos o animaciones deliberadamente dibujadas.

**Edificios**

Los edificios no requieren ocho vistas si la cámara nunca gira.

Vertical Slice:

```text
orientation = 1
```

Si posteriormente permitimos rotación en pasos de 90°:

```text
R0
R90
R180
R270
```

se generan cuatro renders automáticamente.

Estados mínimos:

```text
planned
foundation
construction_50
complete
damaged
```

Para determinados edificios:

```text
abandoned
upgraded_1
upgraded_2
```

La variación debe producirse primero con materiales/props y sólo después mediante modelos completamente distintos.

**LOD artístico**

En un juego prerender no haría LOD como en un motor 3D tradicional.

Tres capas:

```text
NEAR
high-resolution sprite
props visible
characters animated

MID
same asset / mip chain
reduced minor VFX

FAR
half-resolution asset family
fewer characters
signage/props hidden

MAP
district abstraction
icons / blocks / heatmap
```

Esto permite que el alejamiento de cámara reduzca no sólo detalle visual sino también coste de simulación, conectando bien con el Simulation LOD que ya estamos diseñando.

**Tiles y terreno**

No derive nunca colisiones de transparencia.

La imagen y la lógica son independientes:

```text
Visual tile
    │
    └── tile id

Logical cell
    ├── walkable
    ├── buildable
    ├── road
    ├── terrain
    ├── district
    └── occupancy
```

Tiled soporta mapas isométricos, layers, terrain tools, objetos y propiedades personalizadas; estas últimas pueden heredarse desde tiles a sus instancias.

Tiles mínimos:

```text
grass
dirt
mud
asphalt
pavement
industrial_ground
water
```

No crearía cada carretera como un bitmap monolítico.

Separaría:

```text
base
road surface
curb
markings
decals
props
```

y usaría variantes compatibles con grid.

Los collision/footprint masks deben almacenarse como data:

```json
{
  "assetId": "bld_res_rowhouse_a",
  "footprint": {
    "width": 2,
    "height": 3,
    "mask": [
      [1, 1],
      [1, 1],
      [1, 1]
    ]
  }
}
```

Un edificio irregular:

```json
[
  [1, 1, 0],
  [1, 1, 1],
  [0, 1, 1]
]
```

El snapping opera en coordenadas mundo, jamás en píxeles de sprite.

**UI**

Aquí no debemos imitar la tecnología de 1999.

El repositorio ya define React/DOM para HUD, economía, política, estadísticas y pantallas de empresa, y prohíbe utilizarlo como renderer de entidades.

La UI visual debería mezclar:

```text
papel / documentos
+
metal / latón
+
periodismo / prensa
+
tipografía moderna y muy legible
```

No haría todo con una fuente art déco.

Sistema:

```text
Display font
    sólo títulos / branding

UI sans
    todo dato operativo

Mono/tabular
    cifras financieras cuando sea útil
```

Un candidato razonable sería:

```text
display: una familia de inspiración Art Deco
body: IBM Plex Sans / Source Sans 3 o equivalente abierto
numeric: tabular numerals
```

La Art Bible debe fijar tipografías y licencias antes de producir screenshots públicos.

Tokens UI:

```text
--surface-0
--surface-1
--surface-raised

--text-primary
--text-secondary
--text-muted

--positive
--negative
--warning
--information

--ownership-player
--ownership-neutral
--ownership-rival

--politics-support
--politics-opposition
```

Rojo y verde **no pueden ser la única codificación**.

Ejemplo:

```text
↑ +12.5 %        beneficio
↓ -12.5 %        pérdida
```

con icono, signo y color.

Para WCAG 2.2, el texto normal debe alcanzar al menos 4,5:1 de contraste y el texto grande 3:1; además, el texto web debe poder ampliarse al 200 % sin perder contenido ni funcionalidad.

Los targets de interacción deben diseñarse con un mínimo práctico superior al estrictamente necesario. WCAG 2.2 establece 24×24 CSS px como criterio mínimo con ciertas excepciones; para Landlord recomiendo **36–44 px en controles primarios**.

**Localización**

Nunca:

```text
[ bitmap que contiene "BUY PROPERTY" ]
```

Siempre:

```text
icon
+
DOM text
```

W3C advierte que strings muy cortos pueden expandirse en traducción un 200–300 %, y las de 11–20 caracteres aproximadamente un 180–200 % como referencia de planificación.

Por ello:

- botones flexibles;
- min-width, no width rígido;
- wrapping controlado;
- pseudo-localización;
- test con alemán/español;
- arquitectura RTL desde componentes base;
- ningún texto importante bakeado.

**VFX**

Los VFX tienen dos funciones: espectáculo y feedback.

Prioridad:

```text
1. información
2. feedback
3. atmósfera
4. espectáculo
```

VFX sprite atlas:

- polvo de obra;
- humo;
- pequeñas chispas;
- vapor;
- fuego;
- hojas/papel;
- salpicaduras;
- pequeñas explosiones.

Procedural/runtime:

- selection ring;
- footprint;
- zoning overlay;
- influence overlay;
- rutas;
- arrows;
- highlights;
- area masks.

Evitaría sprites enormes de humo semitransparente apilados sobre media pantalla porque aumentan overdraw.

Los VFX atmosféricos constituyen una oportunidad importante para darle a Landlord su propia identidad, siguiendo la lección de Frostpunk de que los elementos ambientales pueden acabar formando parte del reconocimiento visual del juego.

**Audio**

La Art Bible debería tener un pequeño Audio Bible asociado.

Masters:

```text
48 kHz
24 bit
WAV
```

Categorías:

```text
UI
construction
industry
traffic
citizens
crime
police
weather
ambience
music
```

Para runtime web se generan formatos comprimidos desde los masters. Phaser puede recibir una lista de URLs alternativas para un mismo asset de audio.

Regla sonora:

> El jugador debe poder escuchar el estado económico de la ciudad sin que el sonido se convierta en ruido constante.

Por ejemplo:

```text
barrio pobre
→ perros, reparaciones, tráfico viejo

distrito industrial
→ martillos, vapor, maquinaria

centro rico
→ automóviles, música interior, actividad comercial

alta criminalidad
→ sirenas distantes, discusiones, cristales
```

El audio ambiental deberá usar concurrencia y prioridades para evitar reproducir cientos de emisores simultáneamente.
