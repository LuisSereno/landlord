# Depósito municipal de limpieza

Estado: dominio y fallback semántico implementados; 48 variantes Composer y 144 capturas validadas
técnicamente, aprobadas por luis el 2026-11-26 y promovidas a los manifiestos runtime de día y
noche. D-112.

## Contrato

- Tipo `cleaning_depot`, exclusivamente municipal.
- Huella física 3×1, solar reservado 4×2, una parcela con mínimo 8 celdas.
- Cero renta y cero capacidad; mantenimiento municipal normal.
- Cada edificio operativo propiedad del municipio suma 6 celdas al radio de limpieza de su distrito,
  con máximo configurable 36.
- Obra, incendio, colapso inminente, ruina o propiedad privada no aportan bonus.
- Sin depósito se conserva exactamente la cobertura radial anterior. Transporte y seguridad no
  cambian.

## Arte Composer

La nave usa una crujía de 4 m de chapa perfilada original, tres portones de servicio separados 4 m,
cubierta plana y ventilación de azotea. El frente no lleva escaparates: la identidad es una nave
municipal compacta, no un local comercial, una fábrica ni un cuartel de bomberos.

El contrato cubre seis estados, cuatro orientaciones y dos moods (48 candidatas). La señal
`LIMPIEZA` y el azul municipal pertenecen al renderer; el PNG no hornea color de organización.

## Evidencia

`packages/simulation/src/cleaning-depot.test.ts` cubre baseline sin depósito, mejora de borde,
aislamiento por distrito, propiedad, estados, tope, save/load v3 y carga de partidas anteriores. Las
fixtures de generador v5 y los diez digestos se regeneraron por medición.

- `candidate-matrix.json`: 48 activos con hashes, firma, huella, pivote, escala y visibilidad de acceso.
- `gameplay-capture-v1/capture-manifest.json`: 144 capturas, tres zooms y cero errores de página;
  los PNG de evidencia quedan locales y los promovidos se sirven desde `variants*`.
- `review/`: láminas de candidatas y captura del fallback `LIMPIEZA`.
- `validation.json`: gate técnico separado de la aprobación artística.
- `technical-audit.json`: auditoría por asset de PNG, fuentes, licencias, hashes y procedencia de
  las 144 capturas; los avisos de borde quedan para revisión visual.

El fallback procedural es una nave de tres bahías con contenedores y señal municipal; se conserva
como respaldo, no como asset final. La captura de la señal runtime queda en
`review/fallback-signage.png`. La promoción Composer se ejecutó tras la aprobación humana de luis
del 2026-11-26.

## Patio municipal

La parcela 4×2 incorpora una escena de patio: el planificador reserva dos celdas para el camión de
basura `veh_garbage`, una para el montón `prp_waste_heap` y otra para un contenedor
`prp_trash_can`, además del acceso. El montón procede del modelo CC0 `trash_A` de KayKit y tiene
variantes diurna y nocturna en el catálogo Blender runtime. Es decoración visual; no modifica el
radio de limpieza, la simulación ni los guardados. La composición final en ciudad aún necesita
revisión visual humana a escala de juego.

PNG para inspección: [montón diurno](../../../apps/web/public/assets/runtime/blender-day/prp_waste_heap.png),
[camión de basura](../../../apps/web/public/assets/runtime/blender-day/veh_garbage.png) y
[contenedor](../../../apps/web/public/assets/runtime/blender-day/prp_trash_can.png).

El procedimiento completo para regenerar los PNG locales está en
[ART-PIPELINE §44](../ART-PIPELINE.md). La verificación de la evidencia existente es:

```bash
DEPOT_REQUIRE_LOCAL_ASSETS=1 pnpm art:cleaning-depot:validate
pnpm art:cleaning-depot:audit
pnpm art:cleaning-depot:validate:test
pnpm art:docs:links:check
```
