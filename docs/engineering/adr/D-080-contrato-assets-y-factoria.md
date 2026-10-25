# D-080 — Contrato runtime de assets y factoría procedural para Alpha

Estado: aceptada el 2026-10-25 para WP4.15. Convierte la baseline `graphic_civic` en un contrato de
assets verificable y en una línea de producción ejecutable: fuente → metadatos → runtime → Phaser →
Art Lab → validación. No fija el arte final ni sustituye la dirección visual aprobada.

## Contexto

El Visual Direction Spike cerró la dirección `graphic_civic` con renders de referencia, pero el
runtime seguía dibujando edificios como rectángulos y no existía un contrato de assets, un validador
de metadatos ni una integración reproducible en Phaser. WP4.15 debía demostrar que un edificio nuevo
y una variante de personaje se generan e integran sin trabajo manual oculto, dentro de budgets
medidos. La restricción de licencias y de binarios en Git (D-054) sigue vigente: no hay assets de
terceros versionados ni LFS configurado.

## Decisiones

1. **Un único contrato runtime en `@landlord/shared`.** `RuntimeAssetManifestV1` declara por edificio
   su huella, su pivote normalizado y cuatro estados obligatorios (`complete`, `construction`,
   `damaged`, `burning`); por personaje, 4 u 8 direcciones con animaciones `idle` y `walk`; y por
   imagen, tamaño, SHA-256 y fuente. El generador y la provenance (`procedural_svg` o
   `blender_render`) son parte del contrato. El esquema Zod es la frontera: un manifiesto incompleto
   rompe CI.

2. **La factoría de Alpha es procedural y determinista.** `scripts/generate-runtime-assets.mjs`
   produce SVG originales para los cinco edificios y sus cuatro estados, y dos variantes de personaje
   (8 y 4 direcciones) con `idle`/`walk`. Las imágenes viajan como data URI dentro del manifiesto, así
   que no se versionan binarios ni se exige Git LFS en Alpha. `--check` regenera y compara: cualquier
   edición manual del manifiesto o cambio no reproducido falla.

3. **Pivote y depth salen de los metadatos, no de hacks por asset.** El pivote normalizado se aplica
   con `setOrigin`; el depth usa la fila isométrica `(x+y)`, con desempate por `y` y `x`, el mismo
   orden con el que el mapa pinta sus losetas. La escena mantiene un sprite por edificio y sitio de
   obra, reutiliza el objeto al cambiar de estado y conserva el rectángulo como respaldo sólo hasta
   que las texturas compilan.

4. **Estados y degradación visual.** `operational` ≥ 60 % de condición usa `complete`; por debajo,
   `damaged`; `burning` y `collapse_pending` usan `burning`; `ruin` usa `damaged` con opacidad
   reducida. Los sitios de obra usan `construction`. La lógica es pura y está probada sin Phaser.

5. **Los personajes se integran en el Art Lab; el marcador del juego se conserva hasta la pasada de
   escala/LOD.** El Art Lab anima `idle` y `walk` para las dos variantes y muestra las direcciones,
   que es donde se mide la decisión 4 vs 8. La escena jugable mantiene el blitter de agentes porque
   el benchmark de 500 agentes es el presupuesto vigente y no hay todavía un LOD de personaje
   aprobado; cambiar ese contrato sin medirlo repetiría el error que D-065 prohíbe.

6. **Estrategia de atlas.** Alpha usa una textura por frame SVG, compilada en runtime; el manifiesto
   es la fuente de verdad y el empaquetado no oculta trabajo manual. El arte final en píxeles usará un
   atlas raster (JSON hash/array) con los mismos campos de pivote y estados; los binarios exigirán
   Git LFS o una decisión de almacenamiento. No se introduce un atlas binario ahora.

7. **Regresión visual y perfil denso medidos, no vendidos.** `pnpm art:visual` captura el Art Lab y
   publica el SHA-256; el baseline está versionado y la comparación estricta es opt-in porque el
   antialiasing puede variar entre runners. `pnpm art:profile` pinta 400 sprites del manifiesto y
   mide FPS DOM (60 FPS estables en la máquina de referencia). El frame del juego sigue midiéndose
   con `pnpm benchmark:browser`: este perfil no lo sustituye.

8. **Budgets de Alpha.** Manifiesto completo < 200 KB (medido 106 KB), 68 imágenes, cada SVG < 8 KB,
   y 400 sprites de contenido a 60 FPS. El contrato y el test de budget quedan en CI; el arte final
   puede cambiar los números siempre que declare el nuevo budget y lo mida.

## Consecuencias

- Un edificio o variante nuevos se añaden a la lista de la factoría, se regeneran, se validan y se
  integran sin edición manual de texturas ni coordenadas.
- El pipeline Blender queda como fuente de producción para el arte final, con el mismo contrato de
  metadatos; no se ejecuta en CI y no se versionan binarios de terceros.
- La integración de personajes en la escena jugable y el LOD de personaje quedan explícitamente
  diferidos, no olvidados: dependen de la medición de la cámara y del presupuesto de frame.
