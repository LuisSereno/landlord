# Estado vigente para agentes

Actualizado: 2026-11-12. Leer este archivo antes de la historia extensa de `PROJECT-STATE.md`.

## Rama y arquitectura jugable

- Rama de trabajo: `wip/vh-world-visual-foundation`; no integrar ni empujar a `develop` o `main`
  sin revisión humana.
- Simulación TypeScript pura y determinista; Phaser/React sólo consumen `ViewProjectionV2`.
- El estado autoritativo pertenece al motor. `Math.random()` no entra en dominio.
- El MVP sigue siendo single-player: comprar terreno → producir → construir → ocupar → caja →
  competencia → riesgo → respuesta política.

## Ciudad y carreteras

- La ciudad contiene nueve distritos. La identidad espacial es siempre `districtId + cell`.
- El eje (`RoadSegment`, `map.roads.cells`) es conectividad/topología. El corredor es suelo físico
  vial derivado y no edificable; no es obstáculo de A*.
- Sólo existen `RoadTopology.derivationVersion` 2 y 4: v2 es eje de una celda; v4 persiste
  `roadSectionVariant` (`full` o `ave3`). v3 se rechaza al cargar.
- La jerarquía compartida de clases es `street < avenue < motorway`.
- La sección publicada conserva rol, perfil, eje y `laneSense`; vehículos presentacionales respetan
  `forward`/`backward` y sólo el carril `both` escoge sentido determinísticamente.

## Edificios y solar

- Los 15 BuildingTypes tienen política `runtime_exact`; los assets legacy `bld_*` no son ruta de
  gameplay.
- Un complejo multi-parcela conserva `parcelIds` canónicos: permisos, ruina, venta, colateral,
  snapshot y proyección usan el conjunto completo.
- Si `siteRequirements.requiredParcels > 1`, cada candidata legal ocupa físicamente cada parcela
  requerida. UI, IA y autoplacement consumen el mismo enumerador.

## Sistemas implementados

- Producción, alquileres, deuda, impuestos, mantenimiento, seguros, servicios, mercado de vivienda
  y empleo agregado, IA rival, facciones, reputación, política municipal y automatización.
- Facilities recorren el grafo vial; la cobertura se deriva de edificio operacional y capacidad.
- Snapshots V2, canonicalización y digests protegen determinismo.

## Bloqueos y gates pendientes

- Hardening actual: completar pruebas especializadas, balance jugable, rendimiento, costuras viales,
  QA visual Phaser y reconciliación documental antes de la integración.
- Playtest humano V.d sigue pendiente; los smokes no lo sustituyen.
- No introducir nuevas features, tráfico simulado, backend o nuevas perspectivas durante este gate.
