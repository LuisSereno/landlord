# Evidencia — World Visual Foundation (V.h.10 · §29)

Contenido de este directorio y dónde está el resto de la evidencia visual.

## Presente aquí

- `performance.json` — snapshot §26 generado con `VH10_PERF=1` (tests gated): antes/después de
  V.h (atlas 69→81 imágenes, vehículos 3→9), objetos presentacionales por distrito (2720 en los 9)
  y tiempo de generación del mundo completo (551 ms proyectar+construir 9 distritos en node).

## Evidencia de píxeles existente (Blender, Graphic Civic)

- Civic core APPROVED baseline (town_hall V7 + plaza cívica): `blender_artist/showcase/vg-civic-core/`
  (`civic_core_town_hall_1002.png`, `civic-core-references.png`, building-only y plaza-only).
- Vehículos contextuales horneados (V.h.6): sprites en
  `apps/web/public/assets/runtime/blender/veh_{firetruck,ambulance,police,garbage,delivery,tractor}.png`
  (verificados sin clipping; sombra y palette Graphic Civic).

## Contact sheet 9 distritos × 3 escalas (§23/§29) — P1, captura interactiva

No hay Chrome headless en este entorno, así que el contact sheet de píxeles del mundo completo se
produce en la review humana con la app real (que es, además, la prueba más fiel del runtime Phaser):

```bash
pnpm --filter @landlord/web dev          # sirve la app
# abrir http://localhost:5173/, seleccionar cada distrito en el panel CityView
# y capturar a 0.5x / 1x / 2x (zoom de cámara); guardar como district-<nombre>-<escala>.png
montage district-*-1x.png -tile 3x3 -geometry +4+4 district-contact-sheet.png
```

Los 9 distritos (Lomas del Umbral, Mercado del Norte, Vega del Cauce, Barrio del Umbral,
Centro Cívico, Barrio del Taller, Ensanche Ferroviario Oeste, Corredor Ferroviario, Patios del Este)
quedan cubiertos por la integración runtime medida en
`apps/web/src/isometric/full-world-integration.test.ts` (`VC9_FULLWORLD=1`): capas pobladas,
referencias de asset válidas y cobertura de edificios/espacios para los 9.

## Detalles por familia (residential/commercial/industrial/civic/park)

Se obtienen de la misma sesión interactiva acercando a 2x sobre un solar representativo de cada
familia; los perfiles de distrito (§11) y de edificio (§12) garantizan que el vocabulario difiere
por familia (medido en `full-world-integration.test.ts`: cívico ≠ industrial).
