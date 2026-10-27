# WP4.15-V.c.3 — Street Dressing & Static Street Life

**Fecha:** 2026-10-27  
**HEAD inicial:** `21856a0`  
**Commits locales:** `4a18b2a`, `bcb9d7a`, `856b34f`  
**Estado:** PASS / CLOSED  
**Naturaleza:** presentación determinista; no añade estado autoritativo.

## Cadena final

```text
ViewProjectionV1.map.roads + economy.parcels
        ↓
GameplayVisualAdapter
  roadVisuals + treeCells + streetFurniture + parkedVehicles
        ↓
IsometricSpikeScene
  manifest Blender + depthForAsset + viewport culling
        ↓
Phaser
```

`GameState`, `SnapshotV1`, `ViewProjectionV1.map.roads`, worker protocol, navegación, economía y
`visual-slice/layout.ts` no se modifican en V.c.3.

## Street furniture planner (V.c.3B)

- **Farolas:** sólo `straight_ns`/`straight_ew`, ritmo mínimo de cinco celdas por línea, hash
  espacial estable y lado lateral alternado. Se excluyen dos celdas Manhattan de T/intersecciones;
  el host debe estar fuera de roads, parcelas, árboles y obras.
- **Semáforos:** sólo `intersection`, dos esquinas diagonales opuestas (`45`/`225`); las T no se
  convierten en cruces regulados. Si ambos pares están ocupados, no se fuerza ningún prop.
- **Bancos:** muestreo más escaso, próximos a zoning residencial/mixto y fuera de industria,
  construcción, carretera, parcela o árbol.
- **Papeleras:** muestreo todavía más escaso y no acoplado rígidamente a cada banco.
- **Exclusiones:** `roadCells`, `parcelCells`, `treeCells`, `constructionCells` y
  `furnitureCells`; IDs derivados de `kind + roadCell + hostCell`.

## Parked vehicles (V.c.3C)

- Sólo se colocan en `straight_ns`/`straight_ew`; no aparecen en T, intersecciones, esquinas,
  endpoints ni celdas aisladas.
- Clearance Manhattan de dos celdas respecto de cualquier junction/crossing.
- Ocupación moderada con huecos irregulares; selección determinista sedan/taxi/truck, con truck raro.
- `45` es el frame base y `225` la orientación presente en manifest; no se usa `flipX`, `rotation`,
  `angle` ni CSS transform.
- La lateralidad y offsets se derivan de la orientación de recta y del lado de aparcamiento; la road
  sigue siendo una celda conceptual, sin carriles ni tráfico dinámico.

## Lifecycle y rendimiento

La clave geométrica existente decide cuándo reconstruir. Con geometría estable no se recalculan los
planners ni se hornea el suelo. Los sprites de mobiliario y vehículos se reconcilian por ID: se
reutilizan los existentes y se destruyen sólo los desaparecidos. La visibilidad se actualiza con
viewport culling, no con churn de sprites.

## Assets

Sólo se usan assets ya presentes en `runtime-assets-blender.json`:

```text
prp_street_light
prp_traffic_light
prp_bench
prp_trash_can
veh_sedan
veh_taxi
veh_truck
```

El test de bundle verifica que cada asset existe y que todo azimut distinto del frame base tiene
orientación `225` en manifest. No se generaron orientaciones nuevas ni se descargaron packs.

## Evidencia browser y recuentos

Preview de producción Chromium headed, `/`, 1440×900:

| Métrica | Resultado |
| --- | ---: |
| road cells | 240 |
| junctions | 10 (todas T) |
| crossings | 10 |
| street lights | 26 |
| traffic lights | 0 |
| benches | 4 |
| trash cans | 2 |
| parked vehicles | 29 |
| trees | 108 |
| buildings | 0 en estado inicial |
| total sprites | 195 |
| ground rebakes | 1 estable |

Los 0 semáforos no son una carencia del planner: el distrito real no contiene ninguna máscara
`intersection`; los tests cubren dos semáforos por intersección completa.

Capturas manuales revisadas a `0.5×`, `1×`, `2×` y `2.5×`: a 0.5× las calles, cruces y ritmo urbano
siguen dominando; a 1× se distinguen coches y farolas sin saturación; a 2×/2.5× se verifican
pivotes, bordillo, profundidad y cebras. El panel UI tapa parte del lienzo en la captura de QA,
pero no produjo errores ni altera el render.

## Estado final de la fase

```text
ROAD_TOPOLOGY_CORE = PASS
GRAPHIC_CIVIC_ROADS = PASS
WP4.15-V.c.3A = CLOSED
WP4.15-V.c.3B = CLOSED
STREET_FURNITURE = PASS
WP4.15-V.c.3C = CLOSED
PARKED_VEHICLES = PASS
WP4.15-V.c.3 = CLOSED
STREET_DRESSING = PASS
STATIC_STREET_LIFE = PASS
```

Deudas explícitas: tráfico móvil, peatones simulados, reglas de tráfico, one-way, economía de
aparcamiento, densidad dependiente de economía, ocupación vial, ciclo dinámico de luces y compresión
vertical de segmentos siguen fuera de scope.
