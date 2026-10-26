# D-081 — Binarios de arte: presupuesto con guarda, atlas y Git LFS reclasificados a Beta

Estado: aceptada el 2026-10-25 como parte del endurecimiento WP4.15-H. Cierra con datos las filas
abiertas de `docs/art/OPEN-DECISIONS.md` sobre atlas, texture packing y Git LFS, y convierte la
regresión visual del Art Lab en una guarda efectiva de CI.

## Contexto

WP4.15 había dejado "atlas strategy definitiva" y "política Git LFS" como diferidos sin decisión, y
la regresión visual era opt-in (`ART_VISUAL_STRICT=1`) sobre un SHA-256: CI podía quedar verde con el
layout roto. La auditoría de 2026-10-25 exigió decidir explícitamente atlas/LFS o reclasificarlos con
una decisión que modificara de verdad el roadmap, y hacer efectiva la regresión.

Los datos medidos el 2026-10-25:

- El bundle runtime de Alpha son 20 data URI SVG (manifiesto de 106 KB) más 20 PNG de la ruta Blender
  E2E que suman 55,8 KB; ningún frame supera 8,6 KB.
- El perfil denso en Phaser con 400 sprites, 24 texturas distintas, cambio de frame cada 240 ms y
  scroll de cámara sostiene 60 FPS de mediana en Chromium headless (`pnpm art:profile`).
- El repo ya versiona 9 PNG binarios de 1,8–2,8 MB (19,98 MB en total, con los masters del spike
  duplicados entre `blender_artist/generated/` y `apps/web/public/assets/art-spike/`), sin LFS.

## Decisiones

1. **Atlas: reclasificado como requisito de Beta, con punto de decisión nombrado.** Con 24 texturas
   y 400 sprites el perfil denso cumple 60 FPS, así que el empaquetado no es un cuello de botella de
   Alpha; introducir TexturePacker (licencia, reproducibilidad en CI) sin esa necesidad sería coste
   sin problema. La fila "Atlas / Texture packing" de `OPEN-DECISIONS.md` se cierra como *diferida a
   Beta* y se añade al gate de Beta en el roadmap (`docs/execution/05-fase-4-alpha-sistemica.md`),
   con el criterio de reapertura medido: si el perfil denso baja de 55 FPS o el número de texturas
   del runtime supera 64, el atlas vuelve a ser requisito del WP de rendimiento vigente.

2. **Git LFS: política de presupuesto con guarda en CI, adopción completa en Beta.** Alpha no
   configura LFS (coherente con D-054 y con un bundle sin binarios grandes), pero el repo deja de
   aceptar binarios nuevos por encima de 1 MB: `scripts/check-binary-budget.mjs` (`pnpm
   art:binaries:check`, paso de CI) falla ante cualquier binario versionado que supere
   `maxBinaryBytes` salvo las excepciones nombradas en `docs/art/BINARY-ALLOWLIST.json`, que hoy son
   exactamente los 9 PNG del spike WP2.14 y cuya lista sólo crece con una edición revisable a mano.
   Una excepción obsoleta también falla. La adopción real de LFS (migración de los masters y
   desduplicación de las copias servidas) queda como primer punto del gate de Beta.

3. **Regresión visual efectiva y tolerante.** `scripts/art-visual-capture.mjs` captura `/art-lab` en
   modo estático (`?static=1`, sin animaciones que varíen el frame) y compara contra
   `docs/art/golden/art-lab-runtime-assets.png` con un pixel-diff en el navegador: umbral por canal
   12/255 y máximo 0,5 % de píxeles distintos; fuera de tolerancia, CI falla. `ART_VISUAL_UPDATE=1`
   regenera el golden tras un cambio aprobado y escribe su metadato
   (`art-lab-runtime-assets.golden.json`). El SHA-256 anterior se conserva dentro del metadato como
   referencia, no como guarda. Dos capturas consecutivas en la misma máquina dan 0 píxeles distintos,
   así que la tolerancia cubre variación de runner y no cambios de layout.

4. **La ruta Blender queda demostrada de extremo a extremo para un edificio y una variante de
   personaje.** `tools/art-pipeline/blender/runtime_asset.py` renderiza con EEVEE y fondo
   transparente, recorta al contenido, reduce 2× por filtro de caja y publica tamaño, hash y pivote
   proyectado del origen 3D; `scripts/build-blender-assets.mjs` orquesta el conjunto (4 estados de
   `courtyard_home` y 16 frames de `vecino_variante`), escribe el bundle
   `apps/web/public/assets/runtime/blender/runtime-assets-blender.json` y `pnpm art:blender:check`
   verifica hashes y medidas sin Blender. Phaser consume esas cuatro texturas en la escena densa,
   que es la prueba de que el render llega al runtime. El resto de assets Alpha sigue siendo
   procedural: esto demuestra la ruta, no sustituye la factoría.

## Consecuencias

- `docs/art/OPEN-DECISIONS.md`: se cierran Atlas, Texture packing, Git LFS y Golden scenes; se marca
  la ruta Blender/Building Factory como demostrada para el subconjunto E2E.
- El roadmap de Fase 4 gana dos puntos de gate de Beta: adopción de LFS con desduplicación de
  masters y estrategia de atlas con el criterio de reapertura medido.
- CI suma tres pasos: `art:visual` (regresión), `art:blender:check` (integridad del bundle) y
  `art:binaries:check` (presupuesto de binarios).

## Revisión 2026-10-26 — regresión visual local-only

Los intentos posteriores de ejecutar el pixel-diff en GitHub Actions mostraron diferencias de
renderizado cross-environment del orden del 17–22 % incluso después de congelar la escena y excluir
el canvas Phaser. Esa señal no distingue de forma fiable una regresión de arte de una diferencia del
runner.

D-082 corrige únicamente esta parte de D-081:

- `pnpm art:visual` conserva golden y pixel-diff para validación local reproducible;
- GitHub Actions **no** ejecuta `art:visual`;
- CI sí mantiene `smoke:art-lab`, `art:blender:check` y `art:binaries:check`;
- una futura regresión visual remota requiere entorno de render fijado u otra técnica que demuestre
  estabilidad cross-environment.

Las decisiones de atlas, LFS, presupuesto de binarios y ruta Blender E2E de D-081 permanecen vigentes.
