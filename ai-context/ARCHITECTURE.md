# Arquitectura para agentes

Este documento describe dos cosas distintas y hay que mantenerlas separadas:

- **objetivo**: lo decidido como dirección;
- **implementado**: lo que hoy existe en código y tests.

Nada de lo que sigue en "objetivo" debe asumirse operativo.

## Capas

### web
Phaser + React.

Responsabilidad:
- render;
- input;
- HUD;
- paneles;
- overlays;
- feedback.

No debe:
- decidir reglas económicas;
- mutar libremente el dominio.

Implementado: `apps/web` con escena isométrica y picking (`src/isometric/`), cliente de Worker
(`src/worker/client.ts`), proyección en React (`App.tsx`), persistencia IndexedDB
(`src/persistence/indexed-db.ts`) y feedback sonoro (`src/audio/`).

### simulation
TypeScript puro.

Responsabilidad:
- estado;
- comandos;
- validaciones;
- reloj;
- eventos;
- sistemas;
- actors/organizations;
- ownership;
- roles/capabilities cuando sean necesarios.

No depende de Phaser, React ni DOM. Lo vigila `scripts/check-architecture.mjs` (ejecutado por
`pnpm lint` y `pnpm test:architecture`), que prohíbe imports de UI y globales de navegador en
`packages/simulation` y `packages/shared`.

Implementado: `GameState` con Maps normalizados e IDs opacos, dispatcher de comandos,
`advanceProductSystems` por tick, canonicalización de estado para checkpoints, run headless de
escenarios deterministas y generación procedural del distrito por perfil y seed (D-064)
(`packages/simulation/src/`).

### persistence
IndexedDB inicialmente.
Snapshots versionados.

Implementado: `SnapshotV1` (`schemaVersion: 1`, `engineVersion`, payload aditivo `phase2`) con
validación Zod, referencias cruzadas comprobadas al cargar, slot `autosave` mensual y slot manual.
Desde WP4.1 `engineVersion` es `phase4-dev` y el distrito persiste su identidad de generación
(`profileId`, `generatorVersion`, `seed`); el campo es opcional, así que las partidas anteriores
siguen cargando. Al restaurar, los valores por defecto se reconstruyen con el perfil guardado.

### backend
No construir hasta necesitar autenticación, cloud save o telemetría central.

### multiplayer
Futuro. Servidor autoritativo.

## Flujo correcto

User input
-> ControlContext
-> Command
-> Validation
-> State transition
-> Domain events
-> View projection
-> Render

Estado actual del flujo: `ControlContext` sigue siendo objetivo, no código. Hoy el usuario envía
comandos al Worker y el Worker responde con snapshot/proyección y métricas.

## Implementación del bucle por tick

`advanceProductSystems` ejecuta sistemas en orden fijo, y ése orden es parte del determinismo:

`tacticalTick` -> producción -> rentas y leases -> pagos de deuda -> subastas -> impuestos de
propiedad -> mantenimiento -> seguros -> política y heat -> acción rival -> avance de tick.

Cada bloque es un sistema puro sobre `GameState`; ninguno depende del reloj de pared ni del render.

La lista es `PRODUCT_SYSTEMS`, con nombres estables (`tactical`, `production`, `rent`, `debt`,
`auctions`, `propertyTax`, `maintenance`, `insurance`, `policy`, `rival`) que usan la instrumentación
de coste (`pnpm system:cost`) y las futuras reglas de LOD. No reordenar ni intercalar: cambia todas
las partidas. La conservación del resultado se blinda con digestos dorados en
`tick-conservation.test.ts` (D-065).

## Identidad y control

No asumir:
player == company.

Separar:
- PlayerIdentity;
- Person;
- Organization;
- ownership;
- RoleAssignment;
- ControlContext;
- Capability.

Implementado (mínimo de D-049): `PlayerIdentity -> Person`, `Organization` con `kind`
`company | bank | municipality | insurer`, `OrganizationControlGrant` y `ownership` explícito por
entidad (`ownerOrganizationId` en parcelas, edificios, instalaciones y cuadrillas). La validación
de control usa `hasOrganizationControl`, no flags de modo.

No implementado: `RoleAssignment`, resolvedor de `Capability` y `ControlContext`. Las acciones se
autorizan hoy por grant de control de organización más validaciones de regla.

## Organizaciones independientes del jugador

Existen y se simulan sin control humano: banco (ofertas, amortización, mora), municipio
(recaudación, permisos, ordenanzas), aseguradora (contratos, primas, claims, exclusiones) y la
organización rival. El rival se mueve por el mismo dispatcher de comandos con identidad propia
(D-056); no es una segunda identidad del jugador ni comparte su caja.

## Agentes tácticos, daño e incidentes (D-061)

Implementado para el cierre de Gate 2, con alcance deliberadamente mínimo:

- `Agent` con celda, objetivo, ruta, tarea, salud, estado (`idle | moving | working | injured | dead`),
  especialidad (`supervisor`, `construction_worker`, `maintenance_technician`, `enforcer`), cooldown
  y tick de recuperación por lesión. Un agente no es el jugador ni la organización.
- `Crew` física: supervisor más trabajadores, asignable a órdenes de obra, mejora, reparación o
  limpieza de ruina.
- Pathfinding determinista A* cardinal N/E/S/W (`packages/simulation/src/navigation.ts`).
- `IncidentRecord` con origen (`sabotage | deterioration | blast`), intensidad, estado, bajas y
  autoría por agente/organización.
- Edificio con `condition` y `structuralIntegrity` separados, bajas acumuladas y estados
  `operational | burning | collapse_pending | ruin`.
- Consecuencia económica real: orden de reparación con coste, tiempo y cuadrilla, ruina que bloquea
  uso hasta `ClearRuin`, y reclamación de seguro trazable.

No incluye life simulation, reproducción, hospital jugable ni catálogo de combate (D-061).

## Producción física localizada (D-062)

Implementado para el Vertical Slice:

- la producción propia es un edificio construible en parcela, no un booleano invisible;
- `ProductionFacility` vive asociada a un `buildingId` y comparte las reglas físicas del resto de
  activos (condición, fuego, reparación, sabotaje);
- la parcela aporta `productionSuitability` por recurso y la instalación expone
  `suitabilityPercent`, `conditionPercent` y `upgradePercent` que modifican el rendimiento;
- el mercado de materiales sigue siendo la alternativa inmediata;
- invertir es subir de nivel un activo existente;
- `kind: "legacy"` sólo existe para migrar instalaciones del modelo abstracto `InvestInProduction`
  de Gate 2.

## Distritos y generación reproducible (D-064)

Implementado en WP4.1:

- el distrito se genera desde perfiles data-driven (`packages/simulation/src/district-profiles.ts`),
  no desde constantes congeladas en `game-data.ts`;
- dos capas: `anchorSlots` autorados (celda, zoning y precio fijos, emitidos primero para que los
  ids de referencia sean estables) y `expansion` procedural (manzanas, zoning por bolsa ponderada,
  precio en banda, aptitud con jitter y obstáculos);
- la generación usa un flujo PRNG derivado de la seed y del perfil; el PRNG autoritativo de la
  partida no se desplaza, así que el determinismo posterior a WP4.1 es idéntico al anterior;
- la identidad persistente es `District.generation = { profileId, generatorVersion, seed }`. No se
  persisten tiles, sprites, atlas ni calles: la representación sigue siendo del renderer;
- los obstáculos reutilizan `map.blockedCells` y respetan las celdas reservadas por
  `rosterLayout` y por las parcelas;
- cada intento se valida (parcelas mínimas, mínimo y concentración por zoning, entrada asequible,
  separación ortogonal, spawns libres y acceso alcanzable por BFS). Doce reintentos como máximo y
  `DistrictGenerationError` con códigos de issue si no converge; nunca un distrito roto en silencio;
- `DISTRICT_GENERATOR_VERSION` entra en la cadena canónica y en el hash: cambiar algoritmo o
  perfiles invalida las fixtures de forma visible. Reproducir una seed: `pnpm district:inspect` con
  `DISTRICT_PROFILE` y `DISTRICT_SEED`.

## Dinero, tiempo y datos

- `Money` entero en unidad menor; nada de floats para moneda.
- Tick técnico fijo e independiente del frame rate; calendario económico aparte, con 30 minutos
  reales equivalentes a un mes de 30 días a 1x (D-060).
- Sin `Date.now` ni `Math.random` en dominio: reloj de simulación y PRNG `xoshiro128ss-v1` con seed
  uint32 (D-048). El estado canónico se serializa con Maps ordenados para poder comparar tick a tick.
- Catálogos tipados en `packages/simulation/src/game-data.ts` (edificios, parcelas, inquilinos,
  políticas municipal/loan/tax/mantenimiento/seguro/permiso/insolvencia/rival) antes que condicionales
  codificados. La validación Zod hoy cubre las fronteras —comandos, snapshots, métricas e IDs—; la
  coherencia de los catálogos se sostiene en tipos TypeScript y en tests, no en un schema de carga.

## Eventos y observabilidad

- Los eventos de dominio normales son efímeros: no entran en `GameState` ni en el snapshot. La
  memoria histórica se modela como registros específicos con retención propia cuando una regla lo
  exige (`TransactionLedger`, `RelationshipHistory`, `CrimeRecord`, `CareerHistory`…) (D-055). El
  libro de transacciones económico sí es persistente, con la cola recortada a 500 entradas.
- El Worker publica métricas cada 20 ticks y bajo demanda: cola, estructuras, comandos aceptados y
  rechazos por código. La web conserva un máximo de 120 entradas y no persiste esa telemetría
  (D-057).

## Regla de dependencia

UI puede depender de shared contracts.
Simulation no depende de UI.
Shared no depende de simulation ni de web (lo comprueba el mismo guard).

## Headless

Simulation debe arrancar sin UI para tests, IA y balance. `runScenario` ya lo hace: seed + comandos
programados por tick + checkpoints canónicos, y `findFirstDivergentTick` detecta desviaciones.

## Gameplay LOD

Concepto futuro:
- cambiar de rol no crea otro mundo;
- cambia información visible, overlays, responsabilidades y delegación;
- sistemas no activos para el jugador siguen simulándose.

No construir este framework todavía.

## Antipatrones

- game.player.money;
- game.player.buildings;
- if playerIsMayor repartido por negocio;
- información privada disponible globalmente;
- organizaciones modeladas como simples extensiones del usuario.
