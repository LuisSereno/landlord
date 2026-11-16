# D-107 — Los estados invisibles del activo se muestran con un lenguaje de presentación

Estado: aceptada el 2026-11-16 por el responsable.

## Decisión

El mapa de Landlord pinta cuatro estados de edificio porque `BuildingAssetState` es un enum cerrado
(`complete | construction | damaged | burning`) con cuatro texturas por tipo. Todo lo demás —hipoteca
que grava el solar, préstamo en atraso o impagado, garantía en subasta, mejora completada, ocupación y
vacancia, póliza activa/vencida/sin seguro y mantenimiento atrasado— **existe en el motor y no se ve**.

D-107 decide que esos estados se hacen visibles con un **lenguaje de presentación derivado**, no con
estados de mundo nuevos:

1. **Cuatro canales, cada uno con su naturaleza.** El badge flotante es un problema accionable; la
   placa de parcela es un pasivo persistente; la marca de fachada es un logro; la capa de datos es una
   lectura masiva. Pintar una hipoteca al día como badge sería tratar un hecho pasivo como interrupción.
2. **Gramática fija.** Forma = severidad (rombo crítico, círculo aviso, placa apaisada pasiva, estrella
   de logro). Glifo = causa raíz, siempre del registro único de iconos. Color = familia, desde una sola
   paleta compartida por badge, placa, marca y leyenda. El contraste del glifo contra su fondo se
   **mide** (WCAG ≥ 4.5:1) y decide la tinta clara u oscura.
3. **Severidad por consecuencia, no por categoría.** El nivel 1 agrupa la pérdida irreversible del
   activo; el colapso y la adjudicación de subasta comparten nivel porque ninguno se revierte, mientras
   que un incendio aún se extingue. Los secundarios (backlog, vacancia) sólo se pintan si no generan
   clutter y se plegan en el detalle del tooltip.
4. **Un idioma, un marcador.** Máximo un badge por edificio, tope global 12 (D-095), orden
   determinista `(tier, rank, key)` y umbrales de zoom explícitos. La reconciliación se hace con una
   **firma visual completa**, no con la identidad lógica: `delinquent → defaulted` conserva la clave y
   cambia forma, tono y criticidad.
5. **`unknown` ≠ `none`.** De un activo ajeno no se publica ocupación, cargas ni seguro. La ausencia de
   información se pinta como banda gris «sin datos» y **cero marcadores**; inferir «sin hipoteca» o
   «vacío» desde un array vacío sería fabricar conocimiento prohibido por la regla de información
   imperfecta.

## Por qué esto es presentación y no simulación

Todo lo visible se deriva en una puerta pura (`apps/web/src/ui/asset-status.ts`) a partir de
`ViewProjectionV2`, el único contrato que consume la cáscara. La escena no decide reglas: los umbrales
que activan un badge los fija el motor y llegan como alertas. El backlog se lee como resta de dos campos
ya publicados (`maintenanceDue − maintenanceCost`), que es exactamente el backlog del motor, no una
regla paralela.

D-107 sustituye la consigna anterior «cero cambios en simulation/shared» por esta regla de encuadre:

> No se modifican reglas económicas salvo para corregir un bug demostrado. Los estados visuales son
> derivados de la proyección. Cualquier ampliación de `projection`/`shared` debe ser mínima, aditiva y
> sin cambio de estado canónico. No hay migración de snapshot salvo que un bug real la exija.

Preservar la etiqueta «presentación pura» manteniendo un bug de dominio vivo habría construido la UI
sobre arena. Las tres excepciones autorizadas son mínimas, cada una con su motivo:

- **E1 — bug real.** `CancelInsurance` exigía `status === "active"`, y `BuyInsurance` rechaza las
  pólizas `lapsed`: una póliza vencida era un callejón sin salida y el edificio no volvía a
  asegurarse. Ahora `CancelInsurance` acepta `active | lapsed`. `cancelled` se documenta como
  **«contrato terminado»**, no necesariamente cancelado por voluntad del jugador. Se descartó inventar
  una acción `RenewInsurance` para resolver un guard demasiado estrecho, y se descartó añadir
  `terminated` al enum (tocaría dominio, zod, snapshot, etiquetas y tests por una distinción que no
  aporta gameplay en Alpha).
- **E2 — arquitectura.** Las alertas ganan un discriminador tipado `reason` (y `buildingId`) para que
  la UI distinga «mantenimiento por condición» de «mantenimiento por riesgo sin seguro». Aditivo, con
  tipo + zod + productor en el mismo commit. El `id` de la alerta **deja de ser contrato**: parsear
  prefijos habría sido semántica codificada en una string que el motor puede renombrar en silencio.
- **E3 — bug real.** Una ruina conservaba su póliza `active` hasta el siguiente vencimiento y
  `clear_ruin` borraba el edificio sin borrar el contrato. Además de estado muerto en el save, eso
  **inflaba el gasto previsto de seguros**, porque el agregado proyectado filtra por `status` pero no
  excluye ruinas. Ahora el contrato termina en el mismo tick del colapso y desaparece con el
  desescombro; los **claims no se borran** — pertenecen al incidente y sobreviven a la demolición.

Ninguna de las tres añade contenido, cambia una fórmula económica ni requiere migración: `cancelled`
ya existía en el enum y las alertas son derivadas y nunca se persisten.

## Consecuencia añadida: referencias vivas por `buildingId`

La auditoría acotada que exigió el responsable encontró que el mismo ciclo de vida dejaba **otras**
referencias vivas apuntando a una entidad inexistente. Se corrigió lo que bloqueaba gameplay y se
conservó lo históricamente deliberado:

| Referencia | Veredicto |
| --- | --- |
| `insurance.contractsByBuildingId` | estado vivo → se elimina con la ruina |
| `maintenance.backlogByBuildingId` | estado vivo → se elimina con la ruina |
| `agents.task {kind:"maintenance"}` | **bug confirmado**: el técnico nunca liberaba la tarea sobre un edificio inexistente y quedaba permanentemente no reasignable → se libera al pasar a ruina y al desescombrar, en orden canónico |
| `insurance.claimsByIncidentId`, `incidents`, ledger | histórico deliberado → **se conserva** |
| `tenants.activeContractBuildingId`, `facilities.buildingId`, `constructionSites.*BuildingId` | ya se resolvían correctamente → sin acción, afirmado con test |

Regla del audit: un mapa de estado vivo que debería desaparecer con el edificio se reporta **antes** de
modificarlo; el alcance no crece en silencio.

## Implementación y gate

- Puerta pura: `apps/web/src/ui/asset-status.ts` (índice de cargas por parcela y estado por edificio),
  `ui/overlay-color.ts` (un `Record` exhaustivo por capa: una capa sin rama es error de compilación, no
  un fallback silencioso al color de propiedad), `ui/world-indicators.ts` (tiers, agregación, firma,
  `resolvePanelTab`), `isometric/parcel-marks.ts` e `isometric/building-marks.ts` (planes puros +
  reconciliación idempotente), `isometric/glyph-textures.ts` (rasterizado desde el mismo registro de
  iconos).
- Un solo registro de glifos **serializable** (`ui/icons.tsx`): los descriptores alimentan a `UiIcon`
  y a `glyphSvgMarkup`. Se rechazó `react-dom/server` en el navegador por medida, no por gusto: 268 KB
  de módulo frente a un bundle ya medido, a cambio de cero chunk lazy y cero dependencia nueva. Un
  fixture dorado compara byte a byte los 55 iconos anteriores a la conversión.
- Tres capas de datos (`Cargas y subastas`, `Ocupación`, `Seguro`) con leyenda declarada en el mismo
  catálogo del color pintado, y un test de paridad que la verifica.
- La placa de parcela **no crea capa interactiva**: sin `Zone`, el hover se resuelve por hit-test manual
  y el click atraviesa hacia el picking de suelo, que selecciona la parcela. Los badges conservan su
  `Zone` ya probada.
- Routing reactivo de pestaña: token monotónico por click + helper puro, con verificación en DOM real
  (la inyección de captura no llega a la economía de React, así que el flujo se prueba allí).
- Evidencia en dos niveles: sintética (cobertura visual de los seis estados, todos los tiers de zoom,
  día/noche, `prefers-reduced-motion`, colisión espacial, estabilidad de reconciliación) y motor real
  (test versionado que recorre `runScenario` → proyección → puerta → marcador).

Gate de la fase: suite verde salvo la deuda de simulación fotografiada en el baseline; paridad byte a
byte de iconos; paridad leyenda↔color; invariantes del ciclo de vida del seguro; determinismo e
identidad de estado canónico; y las métricas de peor caso de §3.3 del plan, medidas con un brazo de
control que pinta la **misma** ciudad sin marcadores.

## Métricas

Ver `docs/execution/phase-4/vd-ux-s-asset-status-2026-11-16.md`. La resolución del instrumento en
rasterizador de software queda documentada allí: un presupuesto del 5 % sobre ~12 FPS está por debajo
del cuantún del medidor, así que la certificación de FPS en máquina con GPU pertenece al playtest
humano (P1-1 ya abierto desde V.d-7C).

## Lo que D-107 no hace

- No añade texturas, estados de `BuildingAssetState`, contenido ni reglas económicas.
- No simula tráfico, impago automático de rivales ni información que el jugador no puede saber.
- No reabre el gate de features ni amplía el scope de V.d.
- No define animaciones como estado del mundo: pulso y destello son tiempo de render y se apagan con
  `prefers-reduced-motion`.

Relacionadas: D-095 (registro único de iconos y catálogo único de overlays), D-103 (el marcador sólo
dice lo que la escena no puede; animación nunca es estado), D-106, D-105 (día/noche es presentación).
Ver `docs/execution/phase-4/vd-ux-playable-interface-spec.md` §9 y §14.
