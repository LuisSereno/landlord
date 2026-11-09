# D-103 — Cuadrillas como avatares y rumbo autoritativo: el marcador sólo dice lo que el clip no puede

- **Estado:** propuesta el 2026-11-09 por el trabajo de V.k sobre `wip/vh-world-visual-foundation`
  (V.k.1 `f0e590e`, V.k.2 `2f9501f`, V.k.3 `11de230`+`e6b93b3`+`f672a5e`+`40b1974`, V.k.4 `4032257`).
  Commits locales, **sin push**. Pendiente de ratificación del responsable y de playtest humano.
- **Workstream:** WP4.15-V.k (fundación visual del mundo, continuación de V.j).
- **Petición humana que origina esta decisión:** el playtest de V.d registró que las cuadrillas se
  leían como «puntos de color», no como gente trabajando; el responsable pidió «cuadrillas como
  personas» (#1) antes de cualquier otra prioridad visual.

## Contexto

V.j cerró el mundo con edificios, vehículos y actores ambientales horneados, pero los miembros de una
cuadrilla seguían siendo un cuadrado de 4 px del blitter de agentes. Tres consecuencias observadas:

1. una cuadrilla de tres se veía como tres puntos idénticos, sin postura, sin rumbo y sin oficio;
2. el punto se clavaba **encima** de la persona cuando esa misma celda ya tenía avatar (conflicto con
   el actor ambiental de V.h.7);
3. el panel de obra y la escena mantenían **dos copias** de la regla «¿este agente está en obra?», así
   que podían discrepar sobre la misma proyección sin que ningún test lo detectara.

Los assets ya existían: `chr_worker` está horneado desde Microsoft Rocketbox (4 direcciones × clip
idle/walk) y el manifiesto publica `directions`, `frames` y `frameDurationMs`. Lo que faltaba era el
contrato de proyección para saber **hacia dónde** va cada agente.

## Decisión

1. **Avatar, no marcador.** Todo miembro de una cuadrilla asignada a una obra se pinta con
   `CREW_CHARACTER = "chr_worker"` vía el pool `crewSprites` de la escena. El cuadrado del blitter
   queda sólo para (a) agentes del roster sin sprite asignado (p. ej. `enforcer`,
   `maintenance_technician` fuera de obra) y (b) los estados que ningún clip expresa:
   `injured`/`dead` (`AGENT_STATE_TINTS`), que siguen pintándose sobre el avatar.
2. **El rumbo lo manda el paso autoritativo.** La dirección del sprite es
   `GRID_DELTA_TO_DIRECTION[nextCell − cell]`; nunca se deriva de la cámara, del tick ni de un ángulo
   inventado. La tabla está calibrada contra las cuatro vistas horneadas (misma convención que corrigió
   `8890ff2` en vehículos): `{"1,0":1, "0,1":0, "-1,0":3, "0,-1":2}`.
3. **Rumbo conservado al llegar.** Sin paso publicado, el agente mantiene el rumbo del último tramo
   (`previous` entre proyecciones). Sin esta memoria, quien llega a su celda giraría hacia la cámara,
   porque `nextCell` ya apunta al tramo siguiente.
4. **Ampliación de contrato, no de simulación.** V.k.1 añadió a la proyección
   `agents[].districtId`, `agents[].nextCell` y `movement.ticksPerCell`. Ninguna regla nueva: son datos
   que el motor ya tenía y que antes no se publicaban. El render filtra por `observedDistrictId`.
5. **Una sola puerta de lectura.** `apps/web/src/isometric/crew-presence.ts` es el único sitio donde se
   decide quién está en obra y en qué estado: `crewMembersBySite`, `siteWorkingCells` (huella + las
   cuatro vecinas), `crewVisualState`, `crewWalkPlan`, `crewSpriteObservations` y —desde V.k.4—
   `crewRosterCounts`. La escena pinta a través de `crewSpriteObservations`; el panel formatea a través
   de `crewRosterCounts`. El panel dejó de tener su propio conjunto de vecinas y su propia lista de
   miembros.
6. **Divergencia semántica deliberada.** El panel describe la **plantilla asignada** (toda la cuadrilla,
   esté donde esté); el mapa pinta sólo los agentes del **distrito observado**. Por eso un miembro puede
   contar en la etiqueta y no estar en pantalla. No es un bug que deba silenciarse: es el mismo contrato
   que D-088/D-093 establecieron para toda la proyección multi-distrito.
7. **El reloj de animación es tiempo de render.** La cadencia la marca `frameDurationMs` del manifiesto y
   el suavizado entre proyecciones es exponential easing por `delta` (la proyección llega cada 2 ticks,
   el tramo dura `ticksPerCell = 10`). Nada de eso entra en `GameState`.
8. **Presentación, no arte nuevo.** La legibilidad a ×1 se resuelve en runtime: escala
   `CHARACTER_RENDER_SCALE = 28/256` y luminancia vía `CHARACTER_LIFT_LUT` (γ = 1.8) aplicada al raster
   de los personajes. El PNG horneado, su hash y el manifiesto no cambian.

## Alternativas rechazadas

- **Cuadrilla como un solo avatar «representante».** Rechazada: el playtest pedía leer *quién* está, y
  una figura por cuadrilla borra la información de plantilla que el dominio ya publica.
- **Tinte por oficio (supervisor / obrero / mantenimiento).** Rechazada: el motor no publica un oficio
  que el sprite distinga, y colorear un avatar Rocketbox para insinuar jerarquía sería una lectura
  inventada en el render. Se revisará si alguna vez el dominio la necesite.
- **Segundo modelo de movimiento para animar a la cuadrilla.** Rechazada de raíz (viola D-097
  §«Crew choreography» y las reglas de arquitectura): la coreografía se deriva de `nextCell`.
- **Rotar el sprite en Phaser según el ángulo del camino.** Rechazada: las cuatro vistas son renders
  reales con el frente resuelto por azimut de cámara; girar un bitmap produce la misma silueta mal
  iluminada que ya se corrigió en vehículos.
- **Que el panel llame a `crewSpriteObservations`.** Rechazada: mezclaría la semántica de roster con la
  de pool de sprites (necesita un mapa `previous` que el panel no tiene). Se extrajo el recuento como
  helper puro compartido.

## Consecuencias

- La escena ganó un pool de imágenes con ciclo de vida propio (`crewSprites`), que debe vaciarse al
  cambiar de distrito, apagar la economía o destruir el juego.
- Publicar `nextCell` ensancha el payload de la proyección por agente; sigue siendo un campo escalar
  opcional en coste y no toca el presupuesto de binarios (D-100/D-101) ni el baseline congelado de V.j.
- El marcador y el avatar son ahora dos superficies con una regla de exclusión mutua; cualquier futuro
  actor con sprite propio debe pasar por la misma condición.
- La legibilidad de los personajes ya no es propiedad del bake: es un ajuste de presentación medible
  (LUT + escala) que puede afinarse sin regenerar arte.

## Verificación (medida, no declarada)

- **Contrato:** tests de shared y simulation sobre los nuevos campos de `ViewProjectionV2`;
  `movement-tick-counter.test.ts` fijó el off-by-one del progreso del tramo
  (`((tick − 1) % ticksPerCell) / ticksPerCell`), que con `tick % ticksPerCell` rebobinaba una décima
  de celda en cada llegada.
- **Puerta compartida:** `crew-presence.test.ts` (19/19) incluye el guard de V.k.4: el recuento de
  `crewRosterCounts` coincide estado a estado con los `visualState` que pinta
  `crewSpriteObservations`, y un miembro filtrado del distrito observado cuenta como «asignada», nunca
  como presencia.
- **Panel:** `ux-contracts.test.tsx` renderiza la ficha de obra por SSR y exige el texto derivado
  («2 trabajando», «1 en el solar»), sin IDs crudos en pantalla. El guard de la puerta comparte fixture:
  la misma proyección que espera el helper es la que se pasa a `ContextPanel`.
- **Evidencia de proyección** (`artifacts/visual-slice/vk3-projection.json`, distrito observado
  `district_00000004`, tick 24, `ticksPerCell` 10): 8 agentes publicados, 2 obras con una cuadrilla de
  3 miembros cada una → **6 sprites de cuadrilla**; 5 con `nextCell` (walk) y 1 sin paso (idle);
  rumbos medidos d2×4 y d1×1; salud 100 en todos — por eso **la excepción de marcador por
  `injured`/`dead` no es observable todavía** en este corpus y queda cubierta sólo por test.
- **Gates:** `pnpm typecheck` limpio; ESLint 0 en los ficheros tocados; suite web completa en verde
  (ver acta de la fase). Las capturas pixel-qa de V.j (108 imágenes) y el baseline de `blender-assets`
  no se regeneraron ni se tocaron.
- **Límite honesto:** el comportamiento se verificó por SSR + helpers + una proyección volcada del
  runtime, **no** con clics humanos en el navegador (los smokes `vd-ux`/`vd-core-loop` sobrescriben
  goldens versionados y no se ejecutaron). Esa verificación corresponde al playtest de cierre.

## Relacionadas

- D-088/D-089/D-093 (multi-distrito y escopa de la proyección), D-095 (vocabulario visual de la
  interfaz), D-097 §«Crew choreography» (prohibido un segundo modelo de movimiento), D-099/D-100/D-101
  (catálogo, presupuesto de binarios, quality pass), D-102 (carga por distrito), y la corrección de
  azimuts `8890ff2` de V.d.
- Deuda registrada y no resuelta aquí: los puntos rojo/morado del blitter siguen siendo roster sin
  avatar; los sprites de una misma cuadrilla comparten fase de animación;
  `__gameplayVisualStats`/`__districtAssetStats`/`__landlordQaRefresh` no se limpian en `destroy()`.
