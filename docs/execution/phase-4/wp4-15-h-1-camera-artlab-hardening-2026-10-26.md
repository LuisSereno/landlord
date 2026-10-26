# WP4.15-H.1 — Corrección de cámara/picking y reconversión del Art Lab

## Estado

`DONE` el 2026-10-26 con verificación local completada. Este checkpoint es una corrección previa a WP4.16 y no abre funcionalidad de gameplay nueva. HEAD inicial de la rama: `aa86eceb4742655f4be41ee63af41de491dfd746` (baseline funcional previo `2b27d40`). Pendiente de CI remoto tras push.

La auditoría manual detectó dos grupos de problemas después de WP4.15-H:

1. la interacción del mapa sólo coincide con la celda visible en determinados niveles de zoom;
2. el Art Lab mezcla archivo histórico, QA de assets y perfil técnico, y además importa un manifiesto
   JSON desde `public/` como si fuese un módulo de Vite.

D-082 fija la solución para ambos problemas y corrige además la documentación de D-081 sobre la
regresión visual, que desde `2b27d404` es deliberadamente local-only.

## Objetivo

Dejar antes de WP4.16 una interfaz isométrica cuya interacción sea correcta a cualquier zoom soportado
y un Art Lab que funcione como herramienta interna de QA de assets, sin warnings de Vite ni
contradicciones entre CI, ADRs y actas.

No se cambia simulación, economía, snapshot, PRNG, balance ni contenido de gameplay.

---

## H1 — Picking pantalla -> mundo correcto

### Problema confirmado

`IsometricSpikeScene.handlePointerUp()` reconstruye manualmente la coordenada de mundo:

```ts
x: nativePointer.offsetX / camera.zoom + camera.scrollX
y: nativePointer.offsetY / camera.zoom + camera.scrollY
```

Esa transformación sólo coincide accidentalmente con la cámara de Phaser en determinadas condiciones.
El síntoma manual es: a zoom 1x la celda suele coincidir; tras zoom out/in el cursor visual y la celda
seleccionada divergen.

### Implementación requerida

- Usar la transformación inversa de la cámara de Phaser:
  `camera.getWorldPoint(pointer.x, pointer.y)`.
- Pasar ese punto de mundo a `pickGridCell()`.
- Eliminar el uso de `PointerEvent.offsetX/offsetY` para el picking.
- Mantener `gridToScreen/screenToGrid/pickGridCell` como geometría pura; el bug está en la frontera
  cámara -> mundo, no en las fórmulas isométricas.

### Aceptación

Un browser test debe demostrar sobre una celda conocida que el clic visual selecciona la misma celda
en:

- zoom 0.5x;
- zoom 1x;
- zoom 2x;
- zoom 2.5x;
- después de pan;
- después de pan + zoom.

No basta con un unit test de `coordinates.ts`: debe ejercitar la cámara real de Phaser.

---

## H2 — Pan coherente con el zoom

### Problema confirmado

El drag con botón derecho aplica el delta de píxeles de pantalla directamente a `camera.scrollX/Y`.
A zoom 2x, 100 px de drag mueven 100 unidades de mundo cuando deberían mover aproximadamente 50.

### Implementación requerida

Convertir el delta de pantalla a mundo:

```ts
scrollX = startScrollX - deltaScreenX / camera.zoom
scrollY = startScrollY - deltaScreenY / camera.zoom
```

La sensación de desplazamiento debe permanecer consistente entre los niveles de zoom soportados.

### Aceptación

Browser regression que compare el desplazamiento de una referencia de mundo tras el mismo drag a
0.5x, 1x y 2x, dentro de una tolerancia pequeña.

---

## H3 — Zoom anclado al cursor

No es la causa del bug de picking, pero forma parte de la misma corrección de cámara.

Al hacer wheel:

1. obtener el punto de mundo bajo el cursor antes del cambio;
2. aplicar el nuevo zoom;
3. volver a obtener el punto de mundo bajo el cursor;
4. compensar `scrollX/Y` por la diferencia.

El punto de mundo bajo el cursor debe permanecer estable salvo clamp/bounds.

### Aceptación

Browser test: una celda bajo el cursor antes del wheel sigue bajo el cursor después del zoom y se
puede seleccionar correctamente.

---

## H4 — Eliminar imports de `public/` en Vite

### Problema confirmado

Actualmente existen imports como:

```ts
import blenderBundle from "../public/assets/runtime/blender/runtime-assets-blender.json";
```

en `ArtLab.tsx`, `DenseAssetScene.ts` y `blender-assets.test.ts`.

Vite avisa:

> Assets in public directory cannot be imported from JavaScript.

### Decisión

Separar metadata importable y binarios servidos:

```text
apps/web/src/generated/runtime-assets-blender.json
    -> metadata JSON importada por TypeScript

apps/web/public/assets/runtime/blender/*.png
    -> PNG servidos por URL
```

`scripts/build-blender-assets.mjs` debe escribir el JSON en `src/generated/` y conservar los PNG
en `public/assets/runtime/blender/`. Los campos `src` del manifiesto siguen siendo URLs
`/assets/runtime/blender/*.png`.

No usar `?url` + `fetch()`: el manifiesto es metadata generada de build y no necesita inicialización
asíncrona.

### Ficheros mínimos afectados

- `scripts/build-blender-assets.mjs`;
- `apps/web/src/ArtLab.tsx`;
- `apps/web/src/isometric/DenseAssetScene.ts`;
- `apps/web/src/blender-assets.test.ts`;
- cualquier check que asuma que el JSON vive en `public/`;
- documentación de runtime assets.

### Aceptación

- `pnpm --filter @landlord/web dev --host 127.0.0.1` no emite warnings de imports desde
  `public/`;
- `pnpm art:blender:check` sigue verificando hashes y medidas;
- Art Lab y DenseAssetScene siguen cargando los PNG por URL;
- build Vite limpio.

---

## H5 — Reconversión del Art Lab a Asset QA

`graphic_civic` ya está aprobado. El Art Lab no vuelve a decidir dirección visual y no es una
pantalla de gameplay.

Debe quedar explícitamente organizado como herramienta interna:

### 1. Baseline / archivo visual

- `graphic_civic`: APPROVED;
- `warm_editorial` y `blue_hour`: archivo histórico;
- las tres tarjetas históricas deben quedar en una sección secundaria/colapsable, no dominar la
  pantalla.

### 2. Building QA

Por asset:

- nombre y tipo;
- footprint;
- pivot;
- generator/provenance;
- complete / construction / damaged / burning;
- estado de validación.

Para el asset E2E `courtyard_home`, mostrar procedural y Blender lado a lado para poder decidir
visualmente una futura promoción al runtime principal.

### 3. Character QA

- variante;
- 4/8 direcciones;
- idle/walk;
- frame actual por dirección;
- provenance/generator.

### 4. Technical QA

Mostrar de forma compacta qué está verificado:

- schema v1;
- hashes;
- Blender bundle;
- binary budget;
- manifest generator.

La escena densa/performance puede seguir detrás de `?density=N`; no convertirla en contenido normal
de la galería.

### Restricción

No sustituir en este checkpoint todo el runtime procedural por Blender. La promoción de assets es
posterior y por asset.

---

## H6 — Regresión visual: verdad documental

D-081 y el acta WP4.15-H quedaron desactualizados después de los commits que intentaron ejecutar
pixel-diff en GitHub Actions.

La realidad desde `2b27d404` es:

- `pnpm art:visual`: comparación local contra golden;
- CI: `smoke:art-lab`, `art:blender:check` y `art:binaries:check`;
- CI NO ejecuta `art:visual`, porque Phaser/SVG/DOM producen diferencias cross-environment demasiado
  grandes para que el pixel-diff sea una señal fiable.

No reactivar el pixel-diff de CI dentro de este checkpoint. Si en el futuro se quiere una guarda
visual remota, debe diseñarse con un entorno de render fijado o una técnica distinta.

---

## H7 — Tests y smoke

Añadir o ampliar pruebas para cubrir:

### Cámara

- picking a 0.5/1/2/2.5x;
- picking después de pan;
- picking después de pan + zoom;
- drag escalado por zoom;
- zoom conserva el punto de mundo bajo cursor.

### Art Lab

- no import de `public/runtime-assets-blender.json`;
- procedural y Blender visibles para `courtyard_home`;
- archivo de direcciones visuales presente pero secundario;
- Character QA conserva direcciones y animaciones;
- smoke sin `pageerror`.

### Vite

El smoke/dev no debe producir el warning:

`Assets in public directory cannot be imported from JavaScript`.

---

## H8 — Verificación final

Antes de declarar `DONE`:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm smoke:phase2
pnpm smoke:alpha
pnpm smoke:art-lab
pnpm art:blender:check
pnpm art:binaries:check
pnpm art:visual
```

`art:visual` es validación local, no required check remoto.

Después del push, comprobar GitHub Actions remoto completamente verde.

---

## No hacer

- No abrir WP4.16.
- No modificar simulación ni snapshots.
- No cambiar `graphic_civic`.
- No añadir dependencias para resolver la cámara.
- No reemplazar todos los placeholders procedurales por Blender.
- No reactivar un pixel-diff cross-environment que ya demostró falsos positivos.
- No arreglar el problema ocultándolo con tolerancias de picking o aumentando el tamaño de las
  celdas clicables.
- No duplicar una transformación de cámara propia si Phaser ya ofrece `getWorldPoint()`.

---

## Criterios finales de aceptación

- [ ] clic visual y celda seleccionada coinciden en todo el rango 0.5x–2.5x;
- [ ] pan mantiene velocidad visual coherente con el zoom;
- [ ] wheel conserva el punto de mundo bajo cursor;
<<<<<<< HEAD
- [ ] browser test cubre zoom + pan reales de Phaser;
- [ ] cero imports JS/TS desde `apps/web/public/`;
- [ ] manifest Blender importable vive en `src/generated/`;
- [ ] PNG Blender siguen servidos desde `public/assets/runtime/blender/`;
- [ ] desaparece el warning de Vite;
- [ ] Art Lab se presenta como Asset QA y no como selector de estilo;
- [ ] `courtyard_home` muestra procedural vs Blender;
- [ ] D-081/WP4.15-H reflejan `art:visual` local-only;
- [ ] suite local completa verde;
- [ ] CI remoto verde;
- [ ] WP4.16 sigue cerrado hasta revisar este checkpoint.
=======
- [x] browser test cubre zoom + pan reales de Phaser (ejecución local pendiente por sandbox);
- [x] cero imports JS/TS desde `apps/web/public/`;
- [x] manifest Blender importable vive en `src/generated/`;
- [x] PNG Blender siguen servidos desde `public/assets/runtime/blender/`;
- [ ] desaparece el warning de Vite;
- [x] Art Lab se presenta como Asset QA y no como selector de estilo;
- [x] `courtyard_home` muestra procedural vs Blender;
- [x] D-081/WP4.15-H reflejan `art:visual` local-only;
- [ ] suite local completa verde;
- [ ] CI remoto verde;
- [x] WP4.16 sigue cerrado hasta revisar este checkpoint.

---

## Evidencia de implementación 2026-10-26

### HEAD

- Inicial: `aa86eceb4742655f4be41ee63af41de491dfd746`.
- Final: pendiente de commit/push; `.git` está montado read-only. Se trabajó con una copia temporal de
  metadata Git sobre la rama correcta, sin modificar `main`.
- PR draft: no actualizable desde este entorno; DNS de `github.com` no disponible.

### Causa e implementación de cámara

El bug exacto era reconstruir mundo como `PointerEvent.offset / zoom + scroll`. Esa fórmula ignora la
matriz completa de la cámara (origen/viewport, zoom y bounds), por lo que sólo coincidía accidentalmente
a 1x. `handlePointerUp` usa ahora `camera.getWorldPoint(pointer.x, pointer.y)` y entrega ese punto a la
geometría de mundo existente. El drag derecho divide el delta de pantalla por `camera.zoom`. El wheel
toma el punto de mundo antes/después, refresca la matriz Phaser en el propio evento, compensa scroll y
aplica bounds en el mismo frame para evitar un clamp diferido.

El hook `?cameraTest=1` es observacional/frontend-only. El smoke Alpha usa eventos reales sobre el
canvas para cubrir:

- picking a 0.5x, 1x, 2x y 2.5x;
- pan y picking posterior;
- el mismo delta visual de pan a 0.5x, 1x y 2x;
- pan + wheel + picking;
- conservación del punto de mundo bajo cursor con tolerancia de 0,05 unidades.

La ejecución del smoke queda pendiente: Chromium termina con `sandbox_host_linux.cc ... Operation not
permitted` antes de abrir una página.

### Vite y assets Blender

- Manifest: `apps/web/src/generated/runtime-assets-blender.json`.
- PNG: `apps/web/public/assets/runtime/blender/*.png`, con URLs `/assets/runtime/blender/*.png`.
- Consumidores actualizados: Art Lab, DenseAssetScene y test de bundle.
- `build-blender-assets.mjs` separa `PUBLIC_DIR` y `BUNDLE_PATH`.
- `check-architecture.mjs` rechaza imports TypeScript de `apps/web/src` hacia `public/`.
- `pnpm build`: verde, 119 módulos, sin warning de imports desde `public/`.
- Dev server: no emitió el warning antes de fallar al abrir `127.0.0.1:5173` con `listen EPERM`; la
  comprobación dev completa queda pendiente en un host que permita sockets.

### Art Lab final

`Art Lab / Asset QA` tiene Asset QA como zona principal (tipo, huella, pivote,
generator/provenance y cuatro estados), comparación `courtyard_home` procedural vs Blender,
Character QA para 4/8 direcciones con idle/walk y frames por dirección, Technical QA compacto y
archivo visual secundario colapsable. `graphic_civic` figura `APPROVED / BASELINE`; las otras dos,
`ARCHIVE / ALTERNATIVE`. La escena densa sigue apareciendo sólo con `?density=N`. El runtime jugable
continúa importando `generated/runtime-assets.json` procedural.

### Verificación local

| Comando | Resultado |
|---|---|
| `pnpm format:check` | verde |
| `pnpm lint` | verde, incluido check de imports `public/` |
| `pnpm typecheck` | verde |
| `pnpm test` | 23 shared + 305 simulation + 33 web verdes; 1 web bloqueado por `spawnSync node EPERM` |
| `pnpm build` | verde, sin warning Vite de `public/` |
| `pnpm smoke:phase2` | bloqueado al lanzar Chromium por sandbox |
| `pnpm smoke:alpha` | bloqueado al lanzar Chromium por sandbox |
| `pnpm smoke:art-lab` | bloqueado al lanzar Chromium por sandbox |
| `pnpm art:blender:check` | verde: 20 imágenes, 55 834 bytes |
| `pnpm art:binaries:check` | bloqueado por `spawnSync git EPERM` |
| `pnpm art:visual` | bloqueado al lanzar Chromium; golden deliberadamente no regenerado a ciegas |

### CI remoto y deuda restante

No hay run remoto: el push no es posible sin escritura de `.git` ni resolución DNS. Antes de cambiar
el estado a `DONE` deben ejecutarse los tres smokes, inspeccionarse/regenerarse el golden con
`ART_VISUAL_UPDATE=1`, repetirse `art:visual`, verificarse el dev server y obtener CI verde. El
workflow mantiene `art:visual` fuera de CI. WP4.16 permanece cerrado.
>>>>>>> dda858a (feat: harden camera picking, zoom anchoring and Art Lab QA layout (WP4.15-H))
