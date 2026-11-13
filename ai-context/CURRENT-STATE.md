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

## Hardening de integración (2026-11-12, rama wip/vh-world-visual-foundation)

- **D-106 cerrada.** Un solar `marketable` es accionable por la misma regla autoritativa de
  colocación que usan comando/UI/IA/automatización (`evaluateActionableSite` = contrato de solar +
  enumeración de huellas, incluida participación multi-parcela). El residuo sin jugada legal se
  fusiona con el vecino compatible de mayor borde compartido (veto morfológico del tejido, anclas
  preservadas) y se reevalúa; sin salida, queda público. La corrección provisional que reclasificaba
  todo solar sin proyecto individual quedó sustituida.
- **Gate B:** barrido de 60 seeds (`pnpm placement:reachability`): 0 solares marketable sin jugada
  legal, 0 complejos multi-parcela que no tocan todas sus parcelas, y los 9 tipos privados (incluida
  la acería) con ≥1 colocación legal ciudad-global en cada seed. `createCity` garantiza la acería
  recompone el primer distrito industrial que pueda hospedarla (`STEELWORKS_SITE_MISSING`).
- **Gate C:** aceptación vial v2/ave3/full/motorway (roles, laneSense, medianas, intersecciones,
  costuras mixtas) y auditoría de consumidores: cobertura y valor leen el corredor en v4. Corregido
  el sentido publicado de una celda de eje cubierta por un perfil mayor (conserva su sentido central).
- **Gate D:** pixel QA sobre la app real (Phaser): 27 capturas de distrito + 5 detalles + 3 contact
  sheets regeneradas y 8 capturas viales dirigidas (avenida h/v con mediana, intersección, costura
  v2↔v4, autovía de 7 vía fixture QA de presentación `?qaRoads=motorway`, etiquetado). Revisadas una a
  una; 0 pageerrors.
- **Gate E:** `pnpm gameplay:acceptance`: campaña headless con comandos reales (compra, 9 tipos
  privados + acería multi-parcela, cuadrillas con traslado, materiales, alquiler con renta, reparación,
  incendio→ruina→ClearRuin, save/load idempotente, automatización). 15 tipos en la ciudad; determinismo
  verificado. Evidencia: `docs/execution/phase-4/gameplay-acceptance.json`.
- **Gate F:** `balance:playable`, `services:balance` y `system:cost:monthly` en verde. La dominancia de
  `delegated_deferred` (16/16 por caja) y el cierre mensual fuera del presupuesto p95 de D-065 siguen
  siendo señales/deuda preexistentes, no regresiones de este hardening.
- **Deuda declarada no cerrada:** playtest humano de V.d (`PENDING HUMAN PLAYTEST`), escala del
  programa municipal bajo desarrollo extremo, orientación física no representada (P2), y el
  no-determinismo raster byte-level de Blender (V.i). Ver KNOWN-GAPS.md.

## Bloqueos y gates pendientes

- Playtest humano V.d sigue pendiente; los smokes y el gameplay automático no lo sustituyen.
- No integrar ni empujar a `develop`/`main` sin revisión humana; esta rama no se ha empujado.
- No introducir nuevas features, tráfico simulado, backend o nuevas perspectivas durante este gate.
