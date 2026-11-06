# Evidencia — World Visual Foundation (V.h.10 · §29)

Contenido de este directorio y dónde está el resto de la evidencia visual.

## Presente aquí

- `performance.json` — snapshot §26 generado con `VH10_PERF=1` (tests gated): evolución del atlas
  69→81→161→163 imágenes, vehículos 3→9, ocho capas presentacionales y tiempo de generación del
  mundo completo en node.

## Evidencia de píxeles existente (Blender, Graphic Civic)

- Civic core APPROVED baseline (town_hall V7 + plaza cívica): `vf_town_hall_1006` es el ayuntamiento
  runtime; `vf_town_hall_1002` se reutiliza honestamente como `school_block`, ambos con provenance
  en `blender_artist/manifests/runtime-promotions.json`.
- Vehículos contextuales horneados (V.h.6): sprites en
  `apps/web/public/assets/runtime/blender/veh_{firetruck,ambulance,police,garbage,delivery,tractor}.png`
  (verificados sin clipping; sombra y palette Graphic Civic).

## Contact sheet 9 distritos × 3 escalas (§23/§29)

La evidencia real de la app está en `pixel-qa/`: 27 capturas de distrito, tres contact sheets y
cinco detalles, con hashes y `pageErrors: []` en `pixel-qa/capture-manifest.json`. Se regenera con:

```bash
pnpm build
node scripts/vh-world-visual-capture.mjs
```

Los 9 distritos (Lomas del Umbral, Mercado del Norte, Vega del Cauce, Barrio del Umbral,
Centro Cívico, Barrio del Taller, Ensanche Ferroviario Oeste, Corredor Ferroviario, Patios del Este)
quedan cubiertos por la integración runtime medida en
`apps/web/src/isometric/full-world-integration.test.ts` (`VC9_FULLWORLD=1`): capas pobladas,
referencias de asset válidas y cobertura de edificios/espacios para los 9.

## Detalles por familia (residential/commercial/industrial/civic/park)

Se obtienen de la misma sesión de la app a 2× sobre un contexto representativo de cada familia;
los perfiles de distrito (§11) y de edificio (§12) garantizan que el vocabulario difiere por familia.
