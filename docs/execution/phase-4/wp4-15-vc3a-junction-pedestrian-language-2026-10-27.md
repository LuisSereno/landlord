# WP4.15-V.c.3A — Junction & Pedestrian Language

**Fecha:** 2026-10-27  
**Baseline de entrada:** `f20f74a` (V.c.2C-H)  
**Estado:** PASS  
**Tipo:** presentación determinista; sin cambios de simulación, contrato vial, snapshot, proyección ni assets.

## Objetivo

Hacer que la red vial autoritativa se lea como espacio urbano al acercarse a una unión: pasos de
peatones discretos en cada boca real de una T o encrucijada y una señal central mínima en los cruces
de cuatro brazos. No se introduce mobiliario ni tráfico.

## Cadena y regla de datos

```text
GameState.map.roads
  -> ViewProjectionV1.map.roads.cells
  -> deriveRoadVisuals / deriveRoadMarkings
  -> GroundPlan.roadMarkings
  -> Canvas decal layer
```

`deriveRoadMarkings()` sólo acepta las máscaras ya calculadas por el adapter:

| Forma | Máscaras | Tratamiento |
| --- | --- | --- |
| recta, esquina, extremo, aislada | 0–6, 8–10, 12 | ninguno |
| T | 7, 11, 13, 14 | cebra en las tres bocas presentes |
| intersección | 15 | cebra en las cuatro bocas y rombo central tenue |

La máscara cardinal N/E/S/W llega con el propio `GroundRoadMarking`; el pintado no vuelve a inferir
carretera ni crea una conexión. Por ello una T nunca muestra una cebra hacia su brazo ausente.

## Implementación

- `GroundPlan` gana `roadMarkings` opcional y puramente visual; el Visual Slice conserva sus
  `crossings` autorales sin cambio.
- `paintCrossing(context, layout, mask)` pinta sólo `crossingArms(mask)`, en orden N/E/S/W
  determinista. El rombo central sólo se pinta para máscara 15.
- El adapter deriva las marcas desde `roadVisuals`, no desde `GameState` ni desde un fixture.
- `IsometricSpikeScene` mantiene sprites de decal separados y los reemplaza únicamente al cambiar la
  clave geométrica. No se añaden props, sprites externos, `flipX`, vehículos, reglas de acceso,
  navegación ni balance.

## Evidencia

- Tests unitarios: una T de máscara 7 genera brazos `N,E,S`; una intersección de máscara 15 genera
  `N,E,S,W`; el modelo de gameplay sólo marca T/cruces y transporta su máscara al `GroundPlan`.
- Tests focalizados web: 12 archivos, 83 tests PASS.
- `pnpm --filter @landlord/web typecheck`, lint, build y `pnpm format:check`: PASS.
- Chromium contra preview de producción: 0 respuestas HTTP >= 400, 0 errores de consola; el suelo se
  hornea una vez (`groundRebakes: 1`).

## No incluido

- V.c.2D: acceso vial y edificabilidad reales.
- V.c.3B: farolas, señales, bancos, papeleras y otros props.
- V.c.3C: vehículos, estacionamiento o tráfico.
- Cambios al derivador, segmentos, clases viales, snapshots, worker protocol, navegación o gameplay.

## Estado resultante

```text
ROAD_TOPOLOGY_CORE = PASS
GRAPHIC_CIVIC_ROADS = PASS
WP4.15-V.c.3A = CLOSED
WP4.15-V.c.3B = NEXT
```
