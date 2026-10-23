# D-064 — Generación procedural de distritos con anclas autoradas

Estado: **Aceptada**
Fecha: 2026-10-23

## Contexto

WP4.1 (`docs/execution/05-fase-4-alpha-sistemica.md`) exige perfiles de distrito data-driven,
topología/parcelas/parámetros generados desde seed, validación de jugabilidad mínima, separación
entre identidad persistente y representación visual, herramientas para reproducir seeds y
fixtures con hash.

Hasta ahora el distrito estaba congelado en el código: `PROTOTYPE_PARCELS` definía ocho parcelas
fijas en `packages/simulation/src/game-data.ts`, sin obstáculos y con la misma topología para
todas las partidas. Esa composición es, además, el anclaje de la evidencia de Gate 2 y Fase 3:
los tests económicos, el benchmark, el soak y el smoke de navegador citan ids concretos
(`parcel_00000001`, `parcel_00000005`, `parcel_00000006`), su zoning, su aptitud productiva y el
precio de referencia del que deriva la caja inicial (`D-056`, `D-060`).

Generar todo el suelo de forma procedural invalidaría esa evidencia sin aportar valor de
producto; mantenerlo todo congelado incumple WP4.1.

## Decisión

El distrito se genera en dos capas sobre un perfil data-driven (`DistrictProfile`):

1. **Anclas autoradas** (`anchorSlots`): celda, zoning y precio fijos por perfil, sin jitter de
   precio ni de aptitud. Se emiten primero y en el orden del perfil, de modo que los ids
   `parcel_00000001..N` del suelo de referencia son estables para cualquier seed.
2. **Expansión procedural** (`expansion`, `priceBand`, `suitabilityJitterPercent`, `obstacles`):
   número de manzanas, columnas/filas, zoning por manzana mediante bolsa proporcional a los pesos
   del perfil, precio dentro de banda y aptitud con jitter acotado.

Reglas que acompañan a la generación:

- **Flujo PRNG propio.** La generación deriva su semilla con FNV-1a sobre
  `landlord.district.v{generatorVersion}|{profileId}` mezclado con la seed de la partida. El PRNG
  autoritativo (`createPrng(seed)`) conserva exactamente la secuencia anterior a WP4.1, así que
  ninguna decisión aleatoria posterior se desplaza.
- **Identidad separada de representación.** `District.generation = { profileId, generatorVersion,
  seed }` es lo único que se persiste. Ningún tile, sprite, atlas o calle entra en el contrato; la
  representación sigue siendo asunto del renderer y de WP4.15.
- **Jugabilidad validada, no supuesta.** Cada intento pasa por `validateDistrictPlayability`:
  mínimo de parcelas, mínimo por zoning, concentración máxima por zoning, existencia de una
  parcela asequible, ausencia de celdas duplicadas, separación ortogonal entre parcelas, spawns no
  bloqueados y acceso alcanzable (BFS desde ambos spawns) para cada parcela.
- **Reintentos acotados y fallo explícito.** Doce intentos como máximo; si ninguno converge se
  lanza `DistrictGenerationError` con los códigos de issue. Nunca se devuelve un distrito
  silenciosamente roto.
- **Obstáculos sobre `map.blockedCells`.** Se reutiliza el conjunto ya persistido y ya consumido
  por el pathfinding en lugar de introducir una entidad nueva. Las celdas de plantilla
  (`rosterLayout`) y las parcelas quedan reservadas antes de colocar obstáculos.
- **Versión del generador en el hash.** `DISTRICT_GENERATOR_VERSION` forma parte de la cadena
  canónica y del estado persistido: cambiar el algoritmo o los perfiles invalida las fixtures de
  forma visible en vez de desplazarlas en silencio.
- **Perfil de continuidad.** `barrio_del_umbral` es el perfil por defecto: reproduce las ocho
  parcelas autoradas de Fase 3 y declara cero obstáculos, de modo que la topología transitable y
  los tiempos de obra del slice siguen siendo los mismos.

## Alternativas consideradas

- **Reescribir la evidencia sobre un mapa totalmente procedural.** Descartada: destruye la
  trazabilidad de aceptación de Gate 2 y Fase 3 (44 referencias a parcelas concretas) sin cambiar
  lo que el jugador experimenta.
- **Congelar el distrito como datos puros.** Descartada: incumple el requisito de variación entre
  partidas de WP4.1.
- **Generar también las parcelas de referencia.** Descartada: rompe el baseline económico
  (`D-056`, `D-060`) y los precios de los que dependen las actas existentes.
- **Consumir el PRNG de la partida durante la generación.** Descartada: desplazaría toda la
  secuencia aleatoria posterior y falsearía la comparación con la evidencia de Fase 3.

## Alcance

Incluido:

- perfiles de distrito y generador determinista en `packages/simulation`;
- validación de jugabilidad con reintentos acotados y error explícito;
- identidad de generación aditiva en `District` y en `SnapshotV1` (`schemaVersion: 1` intacto);
- cableado en `createInitialState`, `runScenario` y `restoreStateFromSnapshot`;
- fixtures con hash e inspector reproducible (`pnpm district:inspect`).

No incluido:

- representación visual, calles, aceras o tiles (WP4.15);
- varios distritos por partida o expansión fuera del distrito activo;
- selección de distrito desde la interfaz;
- política de perfiles retirados o renombrados en partidas guardadas;
- LOD de simulación (WP4.2), servicios y accesibilidad (WP4.6).

## Consecuencias

### Positivas

- Misma versión, perfil y seed producen el mismo distrito y el mismo hash; se puede reproducir
  cualquier seed problemática con una sola orden.
- La variación es real: el perfil por defecto genera entre 2 y 4 manzanas de expansión por seed,
  con precios, aptitudes y distribución de zoning distintas.
- La evidencia de Gate 2 y Fase 3 permanece válida sin reescribir ni una aserción económica.
- El contenido del suelo pasa a ser configurable: un distrito nuevo es un perfil, no código.

### Costes

- Dos fuentes de verdad para el suelo: anclas autoradas y reglas procedurales. Un cambio de
  balance puede requerir tocar ambas.
- Los hashes de las fixtures se invalidan al cambiar algoritmo, versión o perfiles; hay que
  regenerarlos con el inspector y revisarlos, no volcarlos a ciegas.
- El barrido de jugabilidad añade coste a la suite (3 perfiles × 20 seeds por ejecución).
- Restaurar una partida reconstruye el estado por defecto con el perfil guardado: si ese
  `profileId` desaparece del catálogo, la carga lanza `RangeError`. Retirar o renombrar un perfil
  exige decisión explícita de migración.
- `canonicalizeState` compara cadenas JSON sensibles al orden de claves, y un estado restaurado
  construye los agentes con otro orden que un estado nuevo. Es anterior a WP4.1, pero limita la
  comparación canónica entre una partida fresca y una cargada.

## Evidencia requerida

- `packages/simulation/src/district-profiles.ts`, `district-generator.ts` y `district-fixtures.ts`.
- `packages/simulation/src/district-generation.test.ts`: reproducibilidad, variación, anclas
  estables, barrido de jugabilidad, fixtures, core loop sobre distrito generado, determinismo de
  escenarios con perfil explícito, persistencia y rutas de error.
- `packages/simulation/src/district-inspect.test.ts` y `pnpm district:inspect`.
- Acta `docs/execution/phase-4/wp4-1-districts-generation-2026-10-23.md`.
