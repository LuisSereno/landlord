# D-089 — SnapshotV2, protocolo v2 y rechazo explícito de los guardados Alpha v1

Estado: ratificada el 2026-10-28 por el responsable para V.d.0, en la medida en que refleja
las decisiones fijadas en `PLAN_improvements.md`. `SnapshotV2`, protocolo v2 y rechazo explícito de los guardados Alpha v1.
Los detalles de implementación añadidos por esta ADR se listan al final, en
"Adiciones respecto a `PLAN_improvements.md`", y no forman parte de la ratificación.

## Contexto

V.d cambia la forma del mundo, no sus campos. `GameState` pasa de un mapa único
([packages/simulation/src/state.ts:143](packages/simulation/src/state.ts)) a un `WorldState` con nueve
distritos; `Parcel` pasa de un punto a una geometría (`cell: GridCell` → `cells: GridCell[]`);
aparecen `City`, `Block`, `DevelopmentCode`, `PublicSpace`, `UrbanFacility`, `DistrictGateway` y
`Permit`. Un snapshot v1 no contiene ninguno de esos datos, y **no existe derivación posible**: no se
puede reconstruir la red vial, las manzanas ni los códigos urbanísticos de un distrito que nunca los
tuvo.

El repositorio llega a este punto con dos hábitos acumulados:

1. **Compatibilidad aditiva.** D-064 hizo `District.generation` opcional en `SnapshotV1`; D-077 derivó
   los streams de PRNG de macroeventos desde la seed para partidas anteriores; D-085 marcó
   `map.roads` como opcional con backfill determinista
   ([packages/shared/src/snapshot.ts:90](packages/shared/src/snapshot.ts)). Cada uno de esos campos
   **sí** era derivable, así que el backfill era correcto.
2. **Literales únicos.** `SchemaVersion = Brand<1, …>` y `schemaVersionSchema = z.literal(1)`
   ([packages/shared/src/primitives.ts:77](packages/shared/src/primitives.ts)), igual que
   `protocolVersionSchema = z.literal(1)` ([packages/shared/src/primitives.ts:76](packages/shared/src/primitives.ts)),
   y el IndexedDB del navegador con `schemaVersion: 1` fijado en tiempo de escritura
   ([apps/web/src/persistence/indexed-db.ts:93](apps/web/src/persistence/indexed-db.ts)).

V.d rompe la premisa del hábito 1. Seguir aditivando produciría un `SnapshotV1` que acepta dos formas
incompatibles del mundo: la peor clase de deuda, porque el error aparece al cargar, no al guardar.

## Decisiones

### 1. `SnapshotV2` con `schemaVersion: 2`, sin migración y sin borrado automático

- Se introduce `SnapshotV2` y `schemaVersionSchema` pasa a aceptar el literal 2; el tipo de marca
  `SchemaVersion` deja de ser un literal único.
- **No hay migrador v1 → v2.** `PLAN_improvements.md` §3.5 lo fija y aquí se justifica: un migrador
  tendría que inventar manzanas, vías y normativa, y ese invento entraría en la cadena canónica como
  si fuera determinista. Sería determinismo decorativo.
- **No se borran los saves v1.** Rechazar y destruir son actos distintos. El usuario puede tener una
  partida que quiere conservar como dato histórico.

### 2. El rechazo es un estado visible, no un toast

El slot incompatibles se muestra en la lista de guardados como **incompatible**, con su versión, y
con una acción explícita de eliminar. Un guardado que desaparece de la lista se lee como pérdida de
datos aunque no lo sea. Esto obliga a separar dos conceptos que hoy están fundidos en
`indexed-db.ts`: la **versión de la base IndexedDB** (estructura del almacén) y la **versión del
esquema del snapshot** (contrato de la partida). La base puede seguir en 1; lo que cambia es el
registro.

### 3. Protocolo Worker a v2

`protocolVersionSchema = z.literal(1)` pasa a 2. El transporte no puede negociar un esquema que no
puede interpretar: un worker v2 leyendo una petición v1 (o al revés) produce estados corruptos en
memoria, que es el único fallo de esta lista que no se ve en la UI.

### 4. `SetObservedDistrict` es petición técnica, no comando de dominio

El distrito que mira el jugador no es una acción del juego: no consume caja, no altera el PRNG, no
entra en `processedCommandIds`, no se persiste y no afecta a `canonicalizeState`. Se modela como
petición técnica del cliente al Worker, en la familia que ya ocupa `SetObservedParcel`.

Consecuencia verificable, no declarativa: **el gate de V.d.0 exige que cambiar de distrito observado
no mueva el digest canónico**. Es la prueba de que la vista no contamina la simulación, y es la
generalización del criterio que ya separaba presentación de reglas.

### 5. Superficie canónica y goldens

`WorldState` entra en `canonicalizeState`. Orden canónico de la colección de distritos: por `slotY`
y luego `slotX` del layout, no por orden de inserción ni por `districtId` generado, para que la cadena
sea estable entre seeds del mismo perfil.

Esto regenera, en un commit propio y separado del de schema:

- los diez digestos dorados de conservación de tick (precedente: D-075 y D-076);
- los hashes de fixture de generación de distritos (precedente: D-085, 12 fixtures);
- el dataset de balance jugable, que es re-ge-nerado y no migrado.

La regla de D-075 se mantiene: la regeneración de goldens se atribuye (superficie vs economía) en el
propio acta. Un golden que cambia porque la cadena canónica ahora incluye nueve distritos no es un
cambio económico, y decirlo en el commit es lo que permite revisar el resto.

## Alternativas descartadas

- **Migración v1 → v2 sintética.** Inventaría topología; ver decisión 1.
- **Hacer que `SnapshotV1` admita ambos mundos con campos opcionales.** Duplica cada invariante
  (`Parcel.cell` xor `Parcel.cells`) y convierte toda validación en un `if (versión)`. El coste cae
  sobre cada sistema, para siempre.
- **Borrar los v1 automáticamente.** Destruye datos del usuario sin pedirlo.

## Consecuencias

- `PLAN_improvements.md` §8: "no existe compatibilidad silenciosa con saves v1" queda garantizada por
  un literal de esquema, no por buena voluntad.
- El CI de V.d.0 necesita un fixture v1 inmovilizado para probar el rechazo; sin él, la ruta de
  rechazo es código muerto que nadie verifica.
- Las partidas Alpha actuales terminan aquí. Es irreversible y por eso va en ADR propio.

## No decide

- El formato de una eventual migración entre versiones *de v2 en adelante* (se decidirá cuando exista
  un v3 con necesidad real).
- La exportación de partidas v1 como datos históricos legibles: deseable, fuera del gate.

## Adiciones respecto a `PLAN_improvements.md`

El plan fija `SnapshotV2`, el rechazo de v1, el protocolo v2 y que el distrito observado no es
comando de dominio. Esta ADR añade dos detalles de implementación que el plan no especifica:

1. el orden canónico de distritos (`slotY` y luego `slotX`) para que la cadena no dependa del orden
   de inserción;
2. separar la versión de la base IndexedDB de la versión del esquema del snapshot, hoy fundidas en
   `indexed-db.ts`.

Ambas son decisiones técnicas, no de producto, y quedan sujetas a revisión sin reabrir el contrato.
