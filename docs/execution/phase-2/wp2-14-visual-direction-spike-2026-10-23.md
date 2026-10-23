# WP2.14 — Visual Direction Spike — cierre 2026-10-23

## Estado

`DONE — approved baseline`

El bloqueo visual de Gate 2 queda cerrado. La dirección aprobada para producción
representativa es `graphic_civic`; las variantes `warm_editorial` y `blue_hour`
quedan conservadas como presets controlados, no como cambios de cámara ni como
direcciones de producción paralelas.

## Evidencia reproducible

- Fuente procedural original: `tools/art-pipeline/blender/visual_direction_spike.py`.
- Toolchain ejecutado: Blender 5.2.2, EEVEE, seed 42, render headless.
- Manifiesto de resultado y hashes: `blender_artist/manifests/visual-direction-spike-result-2026-10-23.json`.
- Manifest de provenance del kit: `blender_artist/manifests/visual-direction-spike-kit.json`.
- Renders master: `blender_artist/generated/renders/visual_direction_spike_*.png`.
- Galería Art Lab: `/art-lab`, servida desde `apps/web/public/assets/art-spike/`.
- Validación estructural: `pnpm art:spike:validate`.
- Smoke de navegador: `pnpm smoke:art-lab`.

Los conceptos generados con IA se mantienen como referencias privadas/de dirección,
con herramienta, prompt, hash y revisión registrados. No se usan como fuente runtime;
la escena que aprueba el pipeline se genera con geometría, materiales y composición
procedurales originales del repositorio.

## Kit comparado

Las tres direcciones comparten exactamente el mismo kit funcional y encuadre:

- carretera, acera y parcelas;
- residencial e industrial;
- trabajador y civil;
- vehículo de reparto;
- vegetación, andamio y humo;
- selección y ownership por forma y acento, no sólo por color.

Cada render es 1024×576, PNG RGBA de 16 bits, con fondo transparente y una cámara
ortográfica común. La escena se guarda junto al render durante la ejecución local,
pero el script es la fuente reproducible y el `.blend` generado no se convierte en
fuente autoritativa ni se incorpora al runtime.

## Comparativa ponderada

| Dirección | Puntuación | Resultado | Decisión |
|---|---:|---|---|
| `graphic_civic` | 93/100 | Contraste de masas, overlays y ownership más claros; repetible con pocos parámetros | baseline aprobada |
| `blue_hour` | 85/100 | Buen preset atmosférico y buen coste, pero menor margen de contraste en zoom lejano | preset opcional |
| `warm_editorial` | 82/100 | Materialidad cálida y atractiva, pero más coste de detalle y más riesgo de fusión de valores | preset diurno alternativo |

La puntuación aplica los pesos definidos en `docs/art/VISUAL-DIRECTION-SPIKE.md`.
No representa una evaluación artística absoluta: documenta la decisión del slice
con el kit y el objetivo de legibilidad actuales.

## Métricas

| Dirección | Render headless | PNG master | Dimensiones | Formato |
|---|---:|---:|---:|---|
| `graphic_civic` | 6482.52 ms | 2,074,163 bytes | 1024×576 | RGBA16 |
| `warm_editorial` | 6378.94 ms | 2,058,148 bytes | 1024×576 | RGBA16 |
| `blue_hour` | 6245.95 ms | 1,853,733 bytes | 1024×576 | RGBA16 |

El smoke del Art Lab cargó las tres imágenes a anchura natural 1024 y generó una
captura de comparación en `artifacts/`. La comprobación de atlas multipack, memoria
GPU y draw calls de una escena Phaser densa queda como medición de producción de
WP3.13; no se usa una cifra inventada para cerrar este spike.

## Baseline aprobada

- Cámara: ortográfica, azimut 45°, elevación 30°, roll 0.
- Render: EEVEE headless, master PNG RGBA16, fondo transparente.
- Style layer: masas simplificadas, paleta cívico-industrial, acentos de estado y
  overlays redundantes por forma/outline.
- Ownership y selección: geometría/acento dedicados, nunca color aislado.
- Procedural-first: la misma escena cambia de dirección mediante parámetros de
  material, luz y grading; no mediante packs intercambiados.
- Art Lab: ruta independiente `/art-lab` y smoke automatizado.

## Valores que permanecen abiertos

- escala física exacta de la celda tras perfilar una escena densa en Phaser;
- decisión final de atlas packer y política Git LFS;
- número de direcciones y presupuesto de animación de personajes;
- budgets finales de memoria/draw calls con el distrito representativo integrado.

Estas aperturas no bloquean WP3.13: se mantienen como parámetros de profiling,
no como permiso para rediseñar la cámara o la gobernanza de provenance.

## Criterio de cierre

WP2.14 queda cerrado porque existe una comparación de tres direcciones sobre el mismo
kit, una fuente headless reproducible, metadata y hashes, provenance explícita, una
recomendación, un Art Lab navegable y un smoke automatizado. El siguiente trabajo
es WP3.13: convertir esta baseline en contenido representativo del slice y medir la
escena real sin introducir una nueva dirección visual.
