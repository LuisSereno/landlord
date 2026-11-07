# V.i — Catálogo de industria pesada

Estado: auditoría geométrica cerrada; selección del responsable promovida al runtime.

## Alcance

La subfase corrige únicamente `cement_plant`, `brickworks` y `steelworks`. Los doce edificios ya
promovidos conservan sus imágenes runtime y sus hashes.

## Correcciones

- cada tipo pesado usa una receta con un secundario identitario obligatorio;
- `cement_plant` y `brickworks` reservan `(4,1)` en todos sus massings;
- `steelworks` conserva la chimenea en `(3,2)` y mueve el gantry inválido de `(4,0)` a `(1,2)`;
- los soportes se reanclan al centro donde realmente se coloca el secundario;
- una `atCell` fuera de la huella falla de forma explícita para los tres tipos auditados;
- la ladrillera declara `none` como secundario adicional honesto en vez de sortear un tanque que
  nunca cabe.

El barrido headless cubre 100 seeds por tipo en el test canónico; durante la auditoría se amplió a
1.000 seeds por tipo, con 3.000/3.000 composiciones válidas.

## Evidencia

- `candidates/manifest.json`: doce candidatos Blender completos y sus firmas;
- `metrics.json`: tiempos, bounds, triángulos, provenance y ratios de geometría licenciada;
- `contact-sheets/`: comparación del fallback procedural con cuatro variantes por tipo.

Los doce renders tienen entre 99,4 % y 99,8 % de geometría licenciada/original medida. La selección
del responsable se ha marcado como `qa_approved` y publicado sin fabricar estados adicionales.

## Selección aprobada

- `cement_plant`: `vg_cement_plant_1001` (v2), elección expresa del responsable;
- `brickworks`: `vg_brickworks_1000` (v1), por equilibrio entre nave, ladrillo y chimenea;
- `steelworks`: `vg_steelworks_1003` (v4), por masa metálica y skyline industrial más reconocible.

Las tres promociones quedan registradas en `runtime-promotions.json`; sus políticas son
`runtime_exact` y el catálogo Composer queda en 15/15.
