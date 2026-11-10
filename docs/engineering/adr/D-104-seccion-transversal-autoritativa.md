# D-104 — Sección transversal autoritativa: aceras, carriles y sentidos dejan de ser presentación

- **Estado:** alcance decidido por el responsable el 2026-11-09 (topología autoritativa **ahora**,
  ampliación de la proyección y **autovía de 7**), registrado en las tareas V.l.1–V.l.8. Esta ADR es el
  documento que faltaba: no existía spec de V.l en el repo. Implementación en curso, **sin cierre**;
  la aprobación visual final es humana (V.l.8).
- **Workstream:** WP4.15-V.l, sobre `wip/vh-world-visual-foundation` (encima de V.k, ya publicado).
- **Enmienda:** D-085 §2 y D-090 §2. No sustituye ninguna de las dos: mantiene su arquitectura y levanta
  una prohibición concreta.

## Contexto medido

Hoy la calzada es **sólo el eje**. `RoadSegment { id, from, to, class }`
(`packages/shared/src/domain.ts:214`) con `class ∈ {street, avenue}` (`domain.ts:210`), y
`roadCellsFromSegments()` (`domain.ts:259`) deriva una celda por paso del segmento. `RoadTopology`
lleva `topologyVersion: 1` y `derivationVersion: 2` (`domain.ts:225`), y la red se produce desde
`RoadAnchor[]` en `deriveRoadNetwork()` (`packages/simulation/src/urban-fabric.ts:253`).

Lo que el jugador ve como acera, bordillo, cebra o carril es **presentación**: el adapter deriva
máscaras N/E/S/W y `GroundRoadMarking` desde `projection.map.roads.cells`
(`apps/web/src/isometric/gameplay-visual-adapter.ts`), y `visual-slice/terrain-paint.ts` pinta aceras y
bordillos alrededor de esa celda única. El desplazamiento lateral de vehículos y actores ambientales
sale de una moneda `spatialHash(coordenada, salt)`, no de un carril con sentido. Consecuencia del
playtest de V.d: no hay dos carriles legibles, el peatón no tiene una acera propia donde anclarse y la
«avenida» se distingue de la calle sólo por semántica interna.

Números de la retícula actual, medidos sobre `axisPositions()` (`urban-fabric.ts:142`) con mapa 64×64:

| `latticeLines` | posiciones por eje | avenida (índice medio) |
| --- | --- | --- |
| 3 | 0, 32, 63 | 32 |
| 4 | 0, 21, 42, 63 | 42 |

Con 3 líneas en ambos ejes el eje ocupa **375 celdas** (9,2 % del mapa); D-085 midió 451 celdas
(11,0 %) incluyendo los conectores de ancla. Un corredor de **7** celdas sobre una sola línea consume
**448 celdas (10,9 %)** por sí solo, y sobre las tres líneas de un eje **1.344 (32,8 %)**. Es decir: la
autovía de 7 no puede aplicarse a toda la retícula sin comerse un tercio del distrito por eje.

## Qué se enmienda y qué se mantiene

**Se levanta** la prohibición de D-085 §2 —«sin carriles, sentidos, nombres, anchos variables ni
tráfico»— **sólo en lo que toca a la sección transversal**: ancho, roles de celda (calzada / mediana /
acera) y sentido de carril pasan a dato autoritativo derivado, publicado y persistible.

**Se mantiene en pie**, y es la razón de que esto sea una enmienda parcial y no una sustitución:

1. **El eje sigue siendo la verdad de red.** `RoadSegment` y `roadSegmentId()` no cambian; los
   segmentos siguen siendo ortogonales, canónicos y derivados de `RoadAnchor[]`, nunca de parcelas ya
   colocadas (D-090 §1/§2). El corredor se deriva *del* segmento, no al revés.
2. **Una sola función deriva las celdas del eje**: `roadCellsFromSegments()` sigue siendo la única
   puerta, y `map.roads.cells` de la proyección sigue publicando el eje, no el corredor expandido.
3. **Las cuatro semánticas de D-085 §1** (obstacle / road / parcel / open) no se tocan. El corredor es
   suelo **no edificable** de tipo road: **nunca entra en `blockedCells`**, porque ese conjunto es el
   muro del A\* y convertirlo en calzada haría intransitable la ciudad (el error que D-085 §1 corrigió).
4. **Nada de tráfico simulado, nombres de calle ni reglas de producto nuevas.** El coste
   `road < open terrain` y `hasRoadAccess` como regla real siguen diferidos (V.c.2D).
5. **El render no decide geometría.** Los roles y el sentido llegan por la frontera de proyección;
   `apps/web` no importa simulación (guard de arquitectura).

## Decisión

1. **Tabla de perfiles** en `packages/shared/src/road-cross-section.ts` (módulo nuevo, puro, sin
   dependencias de Phaser/React/DOM): `RoadProfile` y `ROAD_PROFILES` con `street` = 3 celdas,
   `avenue` = 5 con mediana central, `motorway` = 7. Cada perfil declara el ancho total, la secuencia
   de roles desde el borde izquierdo y qué lado de la calzada lleva cada sentido.
2. **Derivación determinista del corredor**: `roadCorridorCellsFromSegments()` y
   `roadCellRolesFromSegments()` con precedencia explícita cuando dos trazados se pisan (la clase mayor
   domina, igual que `roadCellClassesFromSegments()` hace hoy con `avenue`), recorte a `[0,64)` y
   orden canónico. Sin PRNG nuevo y sin `state.prng`.
3. **Canal nuevo de proyección, no expansión del viejo**: `map.roadSection` con esquema `.strict()`
   `{ revision, digest, profiles[], segments[] }`, mientras `map.roads` sigue siendo el eje. Así el
   contrato existente no cambia de forma y los digestos de `map.roads` siguen siendo comparables
   byte a byte hasta que V.l.4 toque la geometría.
4. **`derivationVersion: 3`** para la geometría con corredor y autovía en retícula
   (`roadCellClassSchema` gana la clase nueva). Lectura `z.union([literal(2), literal(3)])`, escritura
   3, y el corredor se gatea por versión: un save v2 debe reproducir su vía de 1 celda **bit a bit**,
   porque `restoreStateFromSnapshot` lee del save y no re-deriva (precedente de D-085 §7, ya
   implementado en `packages/simulation/src/snapshot.ts:439`).
5. **Presentación por rol**: `planGameplayGround` pinta carriageway / median / sidewalk y suprime el
   apron duplicado; la línea central discontinua va en `terrain-paint` antes de
   `strokeSidewalks`/`strokeCurbs`; el lateral de vehículos y actores sale de
   `lateralOffsetForProfile` + `laneSense` en vez de la moneda `spatialHash`; los `contextActors`
   peatonales se anclan a la celda `sidewalk`. Sección procedural: **cero tiles nuevos**.
6. **Invariante dura sentido ⇄ bordillo**: en los 3 perfiles × 8 seeds, un carril cuyo sentido apunta
   hacia `+x`/`+y` debe quedar del lado del bordillo que le corresponde según la convención de
   circulación adoptada. Es la prueba de que el sentido no es decorativo.

## Secuencia y STOPs (los WP no son intercambiables)

| WP | Entrega | STOP |
| --- | --- | --- |
| V.l.1 | Esta ADR + D-104 en `DECISIONS.md` + enmiendas marcadas en D-085/D-090 | — |
| V.l.2 | `road-cross-section.ts` + tests; `roadSegmentId` y digestos intactos | — |
| V.l.3 | `map.roadSection` `.strict()` + relleno + re-medición de payload en `road-topology-benchmark` | digestos de `map.roads` byte-idénticos |
| V.l.4 | Corredor como suelo no edificable, `axisPositions`/`latticeLines` para la autovía, costura inter-distrito | **si se pierde un frente vial, revienta `maxBlockDepth`/`maxBlockArea` o p95 > ~20 ms → volver al responsable con avenida-3 de respaldo** |
| V.l.5 | Regeneración de 10 digestos + 12 hashes de fixture en commit **sólo de hashes**, con changelog de causa y control | `parcelCount`/`blockedCellCount` sin cambios; perfiles a ancho 1 recuperan los valores V.d.4 |
| V.l.6 | Lectura 2\|3, escritura 3, tests de save viejo | **si un save v2 no reproduce su vía bit a bit → STOP** |
| V.l.7 | Pintado por rol, sentido ⇄ bordillo, peatón en acera | invariante en 3 perfiles × 8 seeds |
| V.l.8 | Capturas en directorio nuevo + FPS + aprobación humana | `baseline-vj.json` y pixel-qa de V.j **intocables**; `groundRebakes = 1` |

## Consecuencias

- El corredor consume suelo: con autovía de 7 sobre un eje completo son 448 celdas por línea. Por eso
  V.l.4 tiene STOP y respaldo (avenida de 3) en vez de un ajuste silencioso del ancho.
- Los ejes en `x = 0` y `x = 63` (retícula de 3 y de 4 líneas) quedan en el borde: un corredor de 7 se
  sale del mapa y **debe recortarse**, no desplazarse. La costura inter-distrito es un test explícito,
  no una consecuencia esperada.
- La avenida de la retícula de 4 líneas cae en `42`, no en el centro geométrico: es el comportamiento
  actual de `axisPositions` y V.l.4 no lo «corrige» de rebote.
- Cambiar la geometría regenera digestos dorados y hashes de fixture. Se hace en un commit aislado y
  atribuido (V.l.5), nunca mezclado con código, siguiendo D-085 §8.
- El baseline visual de V.j queda congelado: V.l.8 captura en directorio nuevo y la aprobación es del
  responsable.

## Verificación prevista (aún no medida)

Tests puros de perfiles y derivación (V.l.2), contrato `.strict()` y payload medido (V.l.3), sweep de
distritos con frente vial al 100 % y envelopes morfológicas (V.l.4), digestos regenerados con control
(V.l.5), carga de save v2 bit a bit (V.l.6), invariante sentido ⇄ bordillo (V.l.7) y capturas + FPS
(V.l.8). **Ninguno de estos números existe todavía**: esta ADR fija el contrato, no un resultado.

## Relacionadas

D-085 (topología vial autoritativa; §2 enmendada), D-090 (tejido urbano; §2 enmendada por
`derivationVersion` 3), D-086 (street dressing presentacional: lo que era sólo pintura pasa a tener
dato detrás), D-093 (identidad espacial y huellas), D-096/D-097 (contrato multi-parcela y colocación),
D-102 (carga por distrito: el canal nuevo no añade binarios), D-103 (agentes como avatares: el peatón
tendrá por fin una celda `sidewalk` donde anclarse).
