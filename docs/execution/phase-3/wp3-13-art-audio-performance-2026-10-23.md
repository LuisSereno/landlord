# WP3.13 — Arte, audio y rendimiento representativos — cierre 2026-10-23

## Estado

`DONE — representative slice delivered`

WP3.13 consume la baseline aprobada por WP2.14 sin reabrir cámara, provenance ni
formato. El paquete representativo queda disponible en el Art Lab y en el runtime web.

## Entregables

- Tres renders del mismo distrito funcional: `graphic_civic`, `warm_editorial` y
  `blue_hour`.
- Baseline de producción `graphic_civic`, con las otras dos variantes como presets
  explícitos y trazables.
- Residencial, industrial, road, parcela, worker, civilian, vehículo, vegetación,
  andamio, humo, selección y ownership en una composición comparable.
- Art Lab independiente en `/art-lab`, enlazado desde el slice principal, con texto
  DOM, alt text, navegación de vuelta y galería responsive.
- Validador de dimensiones, profundidad de color, formato, hashes, cobertura y
  reproducibilidad: `pnpm art:spike:validate`.
- Smoke de navegador que carga las tres direcciones y genera captura: `pnpm smoke:art-lab`.
- Feedback sonoro procedural para comandos aceptados/rechazados mediante Web Audio,
  sin descargar ni reutilizar música, efectos o referencias de terceros.
- Metadata por render con asset ID, toolchain, cámara, seed, kit y tiempo de render.

## Provenance

La geometría, materiales, cámara y luces de los renders proceden de
`tools/art-pipeline/blender/visual_direction_spike.py`. Los conceptos generados con
IA se conservan como referencias de dirección con prompt, hash y revisión, pero no
son fuente runtime. Los binarios CC0 del staging no se copian ni se mezclan de forma
opaca en estos outputs.

## Medición

| Medición | Resultado |
|---|---:|
| Render `graphic_civic` | 6482.52 ms · 2,074,163 bytes · RGBA16 1024×576 |
| Render `warm_editorial` | 6378.94 ms · 2,058,148 bytes · RGBA16 1024×576 |
| Render `blue_hour` | 6245.95 ms · 1,853,733 bytes · RGBA16 1024×576 |
| Galería Art Lab | 3 renders cargados a anchura natural 1024; smoke pasado |
| Tick headless, seed 1, 20.000 ticks | mean 0.5057 ms · p95 0.9053 · p99 1.5438 · max 6.3252 |
| Proyección headless | mean 0.0551 ms · p95 0.0959 · max 2.5253 |
| Worker audit | p95 0.2885 ms · max 3.8633 |
| Snapshot audit | 11,024 bytes · serialize p95 0.0904 ms · restore p95 2.2872 ms |
| Bundle web | 1,724.37 kB minificado · 459.08 kB gzip |

El bundle conserva el warning de Vite de chunk principal superior a 500 kB
minificados; no bloquea el slice y queda registrado para code splitting posterior.
Los renders de Art Lab se sirven como archivos estáticos y no inflan el bundle JS.

## Audio y accesibilidad

Los cues de accepted/rejected son osciladores breves, de baja ganancia y creados en
respuesta a una acción del usuario. No hay autoplay, red externa, archivo musical ni
asset con licencia pendiente. La galería usa estructura semántica, nombres de
dirección, estados visibles y texto alternativo; ownership/selección mantienen
outline y forma además del color.

## Criterio de cierre

El WP queda cerrado para el alcance del Vertical Slice: hay contenido visual
representativo reproducible, integración web verificable, feedback de audio original,
metadata/provenance y medición de carga y simulación. La producción masiva futura
queda fuera de este WP; atlas multipack, animación de ocho direcciones y profiling de
escena densa son ampliaciones de Alpha, no deuda oculta del entregable actual.
