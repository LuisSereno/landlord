# D-082 — Cámara isométrica autoritativa en Phaser y Art Lab como Asset QA

Estado: aceptada el 2026-10-26 para implementar WP4.15-H.1 antes de abrir WP4.16.

## Contexto

La prueba manual posterior a WP4.15-H detectó que la celda seleccionada deja de coincidir con la
celda visible al variar el zoom. La geometría isométrica pura está cubierta por
`coordinates.test.ts`; el defecto está en la transformación manual pantalla -> mundo de
`IsometricSpikeScene`.

En paralelo, Vite avisa porque el bundle JSON de Blender está bajo `public/` y se importa como
módulo desde `ArtLab.tsx` y `DenseAssetScene.ts`. El Art Lab también sigue presentándose como
comparador de direcciones visuales aunque `graphic_civic` ya fue aprobado, y D-081/acta WP4.15-H
todavía afirman que `art:visual` corre en CI aunque el workflow lo movió a local-only por diferencias
cross-environment.

## Decisiones

1. **La cámara de Phaser es la única autoridad para pantalla -> mundo.**
   El picking usa `camera.getWorldPoint(pointer.x, pointer.y)`; no se reconstruye manualmente
   `offset / zoom + scroll`.

2. **El pan convierte píxeles de pantalla a unidades de mundo.**
   El delta de drag se divide por `camera.zoom`.

3. **El zoom se ancla al cursor.**
   El punto de mundo bajo el cursor se conserva compensando el scroll después de cambiar el zoom.

4. **Metadata importable en `src/generated`; binarios HTTP en `public`.**
   `runtime-assets-blender.json` pasa a
   `apps/web/src/generated/runtime-assets-blender.json`; los PNG siguen en
   `apps/web/public/assets/runtime/blender/` y el manifest continúa publicando URLs
   `/assets/runtime/blender/*.png`.

5. **El Art Lab es QA interno, no gameplay ni selector de estilo.**
   `graphic_civic` es la baseline aprobada. Las alternativas quedan como archivo secundario.
   El cuerpo principal valida buildings, estados, pivote/huella, characters, direcciones,
   provenance y comparación procedural/Blender del E2E.

6. **Regresión visual local-only mientras el render cross-environment no sea estable.**
   `pnpm art:visual` conserva el golden y el pixel-diff para revisión local. GitHub Actions mantiene
   smoke del Art Lab, integridad Blender y presupuesto de binarios. Esta decisión corrige la parte de
   D-081 que decía que el pixel-diff era required CI.

7. **No se modifica la simulación.**
   Este checkpoint pertenece a input/render/tooling. No cambia estado autoritativo, snapshot, goldens
   económicos ni PRNG.

## Consecuencias

- El picking debe ser correcto a cualquier zoom soportado y después de pan.
- Los tests de cámara deben ser browser/Phaser, no sólo geometría pura.
- El dev server de Vite deja de advertir sobre imports desde `public/`.
- El Art Lab gana una función estable durante Alpha: aprobar/promover assets por asset.
- La promoción general de Blender al runtime principal sigue fuera de este checkpoint.
- WP4.16 no se abre hasta cerrar y revisar WP4.15-H.1.
