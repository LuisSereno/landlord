# §7 — Laboratorio de capacidades de Phaser 4 (FX Lab)

Estado: **cuatro familias de efectos probadas y montadas en QA**, ninguna activada en producción.
Medición completa el 2026-11-20 sobre `phaser@4.2.1`, 17 fotogramas, `pageErrors: 0`, `frozenRows: []`.

## Qué es

`apps/web/src/fx-lab/` es una escena de una sola manzana isométrica que levanta el mismo cargador de
activos que el juego, pero **no lee ni escribe `GameState`**: la colocación de fachadas, farolas,
árboles, personaje y vehículo sale de una semilla fija del propio laboratorio. Cada familia de efectos
se monta y se desmonta por separado sobre esa escena idéntica, así que el único píxel que cambia entre
dos fotogramas es el del efecto nombrado.

Superficie (`/art-lab?artQa=1`, sin persistencia de partida):

| Parámetro | Efecto |
| --- | --- |
| `fxPerf=1` | deja la escena en modo medición continua (no pausa en el primer fotograma) |
| `fxMood=day\|night` | banda de iluminación de la escena |
| `fxZoom=1\|0.5` | zoom de cámara, para la prueba de legibilidad |
| `fxRenderer=canvas` | fuerza el renderer CANVAS para ver la degradación sin WebGL |
| `fx=grading,bloomThreshold,…` | activa varias familias al montar |

Los botones sólo aparecen con `artQa=1`. El laboratorio no entra en el camino de carga del juego.

## Sonda de API: qué existe de verdad en 4.2.1

Medida en la página (`capabilities` de `fx-lab-perf.json`), no copiada de la documentación de v3:

| API | 4.2.1 | Nota |
| --- | --- | --- |
| `camera.filters.internal.addColorMatrix / addVignette / addThreshold / addGlow / addParallelFilters / addImageLight` | sí | la cadena de filtros de cámara es el sustituto del `postFX` de v3 |
| `camera.filters.external` | sí | existe, pero el laboratorio no la usa: mezclar las dos cajas hace difícil atribuir un defecto |
| `GameObject.enableFilters()` | sí | caja de filtros por objeto, la que usa el bloom por objeto |
| `Phaser.Actions.AddEffectBloom` | sí | la única receta oficial de bloom; no hay filtro `Bloom` |
| `Phaser.Filters.Bloom` | **no** | API de v3; la sonda la declara `false` expresamente |
| `GameObject.preFX` / `postFX`, `camera.postFX` | **no** | v3; todo el código de efectos va por `filters.internal` |
| `Renderer.WebGL.Pipelines` | **no** | no hay pipeline propio que escribir para esto |
| `lights.addLight` (difuso) / `addPointLight` (halo visible) / `addConeLight` / `setAmbientColor` | sí | el motor **separa** las dos piezas que en v3 estaban fundidas |
| `GameObject.setLighting()` / `setSelfShadow()` | sí | |
| `Texture.setDataSource` (slot de normales) | sí | ver el apartado de congelos |
| `scene.add.particles` | sí | |

## Coste on/off

Ventana móvil de 180 fotogramas, 200 de asiento, día, zoom 1×, misma escena. `control` se mide con la
misma ventana que los efectos (la lectura de arranque queda aparte como `control-arranque`).

| Fila | p50 ms | p95 ms | Δ p95 vs control | fps |
| --- | --- | --- | --- | --- |
| `control` | 21,65 | 25,01 | — | 49 |
| `grading` | 49,99 | 58,33 | **+33,3** | 19 |
| `bloomThreshold` | 119,99 | 143,33 | **+118,3** | 8 |
| `bloomObjects` | 31,67 | 31,67 | **+6,7** | 32 |
| `lighting` | 79,99 | 91,66 | **+66,7** | 12 |
| `lightingNormals` | 76,67 | 85,00 | **+60,0** | 13 |
| `particles` (58 vivas) | 43,33 | 46,66 | **+21,7** | 24 |
| `todos` a la vez | 143,32 | 143,32 | **+118,3** | 7 |
| `control-final` (efectos retirados) | 33,33 | 38,33 | **+13,3** | 30 |
| `canvas-todos` (renderer CANVAS) | 16,64 | 16,65 | n/a | 61 |

Cómo hay que leer esta tabla, en orden de importancia:

1. **No es un presupuesto de GPU.** Esta máquina no tiene aceleración: el renderer es
   `ANGLE (Vulkan 1.3.0 SwiftShader Device (Subzero))`, es decir, GL por software. Los valores
   absolutos no son comparables a un equipo con tarjeta; lo que sí vale es el **orden relativo** entre
   filas de una misma corrida.
2. **La máquina estaba ocupada.** `load average` entre 5,5 y 9,0 durante la pasada por agentes
   concurrentes en la misma rama. Por eso el `control` de esta corrida (25,01 ms) es más caro que el de
   la corrida anterior (16,67 ms, saturado contra el suelo de vsync): no es una regresión, es carga.
3. **`control-final` no vuelve al baseline.** Tras desmontar los seis efectos, el control mide
   33,33/38,33 en lugar de 21,65/25,01. Puede ser carga que subió durante la corrida o residuo del
   desmontaje (texturas de normales planas y halos liberados por el pool). El laboratorio lo registra
   en vez de esconderlo: **antes de activar cualquier efecto en producción hay que medir el desmontaje
   en una corrida dedicada con la máquina quieta**, porque un `dispose` que no devuelve el coste es un
   defecto de runtime, no de arte.
4. El orden relativo es estable y accionable: **el bloom por umbral es carísimo** (un pase difuso sobre
   toda la cámara), la luz dinámica con normales es cara, y el bloom **por objeto** es barato porque su
   caja se limita a los emisivos. Ahí está la palanca: si algún día se promociona un glow, que sea por
   objeto.

## Degradación sin WebGL

Con `fxRenderer=canvas` y las seis familias forzadas, la escena se dibuja **igual que el control**:
`grading`, `bloomThreshold`, `bloomObjects`, `lighting`, `lightingNormals` son no-op por contrato de
Phaser en CANVAS y `errors` queda vacío. La sonda confirma `defaultNormalTexture: false` en CANVAS
frente a `true` en las 16 filas WebGL — es decir, en WebGL el `__NORMAL` de Phaser sí llega al batcher
y la inyección de normales es lo único que lo sustituye.

Consecuencia de diseño: **ningún efecto puede ser portador de información**. El estado económico sigue
comunicándose con forma, glifo, texto y color, que sí viajan en los dos renderers.

## Los tres congelos que produjo el laboratorio

Cada uno se midió con dos PNG consecutivas de `sha256` idéntico; el arnés ahora los declara
(`frozenRows`, `identicalFrameGroups`) en lugar de dejar que la evidencia mienta.

1. **`texture.setDataSource(canvas, 0, renew=true)` congela el fotograma.** Phaser destruye el
   `TextureSource` anterior y devuelve su canvas al `CanvasPool`, pero el batcher conserva la
   referencia vieja y revienta en `batchTextures` (`batchUnit` sobre `null`). Con `renew=false` y el
   canvas **al tamaño del sprite** el envoltorio GL no cambia de identidad y el A/B plano ↔ derivado no
   rompe el renderer (`fx-effects.ts`, `putNormal`).
2. **Iluminar el suelo con `Graphics` congela el fotograma** por la misma vía: su `dataSource` no tiene
   `glTexture`. El rig de luces sólo enciende las fachadas (`FxLabScene.ts`).
3. **El control de zoom no cambiaba nada** porque `fill()` de Playwright no dispara el `onChange` de un
   `input[type=range]` controlado por React: hay que usar el setter nativo y mandar el evento `input`
   (`setZoom` en `scripts/fx-lab-capture.mjs`).

Y un cuarto que no era congel sino atribución falsa: el fallback `__NORMAL` de Phaser es un **píxel de
1×1**. Si el brazo «sin normales» no ocupaba el mismo slot, encender `lightingNormals` cambiaba a la
vez el filtro y el relieve. Ahora el rig se monta siempre con una normal **plana del tamaño de cada
fachada**, así que la pareja `lighting` ↔ `lightingNormals` mide sólo el relieve.

## Los dos defectos visuales encontrados al mirar las imágenes

Preservados como evidencia antes de sobrescribirlos, en `evidence/phaser/`:

- `defect_night_lighting_saturado.png` — cuatro halos de radio 190 px sobre farolas separadas ~107 px,
  en mezcla aditiva encima del glow ya horneado en el sprite: la manzana entera saturaba a blanco.
  Recalibrado a charca difusa de 150 px / intensidad 1,6 y halo visible de 26 px / 0,5 / atenuación
  0,22. Cada farola deja ahora su propia charca y la fachada sigue legible.
- `defect_grading_vinyeta_estrecha.png` — la vinyeta estaba parametrizada con la semántica de v3. En
  Phaser 4 `radius` es el radio normalizado **dentro del cual no hay efecto** y `strength` es la
  opacidad del borde, así que 0,5/0,28 metía la calzada dentro de un óvalo pequeño y casi ennegrecía las
  esquinas. Corregido a 0,85/0,18 de día y 0,78/0,30 de noche.

## Veredicto por familia

| Familia | Veredicto | Motivo |
| --- | --- | --- |
| Filtros de cámara (grading) | **MEJORA VISUAL** con coste alto | unifica el tono día/noche sin tocar ningún sprite; es la única familia que mejora coherencia sin robar legibilidad. +33,3 ms p95 en SwiftShader exige medirse en GPU real antes de plantear runtime |
| Bloom por umbral | **SIN MEJORA** de día, mejorable de noche, **caro** | +118,3 ms p95 sobre toda la cámara. Prohibido globalmente (§7.2) |
| Bloom por objeto | **MEJORA VISUAL** nocturna y barato | +6,7 ms; sólo la caja de los emisivos. Limitación del SDK: sobre regiones alfa el glow no puede sumar contra el fondo |
| Luz dinámica + normales | **MEJORA VISUAL** de noche, **SIN MEJORA** de día | el sprite ya lleva su luz horneada: de día el levantado no se ve y de noche las charcas añaden lectura de dónde está la luz. +60/66,7 ms y depende de un mapa de normales derivado en runtime |
| Partículas | **MEJORA VISUAL** de legibilidad de estado | chimenea con humo y solar con polvo se leen sin mirar la interfaz (+21,7 ms). Mandato §7.4: son presentación derivada de un evento que ya existe en el estado; no simulan nada |
| TilemapGPULayer | **BLOQUEADA / no iniciada** | no cambia la imagen, sólo el coste de dibujado; D-111 no migra el ground painter para demostrar otra tecnología |

Ninguna familia se activa por defecto. La promoción requiere revisión humana y una medición en
equipamiento con GPU; hasta entonces el runtime sigue con `graphic_civic` sin filtros.

## Cómo reproducir

```sh
npx vite build --outDir dist-fxlab --emptyOutDir          # salida aislada, no toca dist/
npx vite preview --outDir dist-fxlab --host 127.0.0.1 --port 4311
FX_LAB_BASE_URL=http://127.0.0.1:4311 node scripts/fx-lab-capture.mjs
python3 tools/art-pipeline/blender/ext_lab/compose_review_sheets.py phaser
node scripts/fx-lab-smoke.mjs                              # smoke barato, sin capturas
```

Sin `FX_LAB_BASE_URL` el arnés intenta montar su propia vista previa. `dist-fxlab/` está ignorado por
Git y no se comitea nunca.
