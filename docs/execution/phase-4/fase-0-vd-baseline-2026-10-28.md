# Fase 0 de V.d — Baseline reproducible y benchmark morfológico

- **Fecha:** 2026-10-28
- **Commit medido:** `95804ee` (`fix: resolve P0 bugs from 30-min playtest and add report`) más
  los cuatro commits de cierre de esta fase en `develop`; el árbol medido es el de `f900d02`
- **Plan de referencia:** `PLAN_improvements.md` §5 "Fase 0"
- **Entorno:** Linux x64, Node 24.19, pnpm 12.11.2, Chromium headless (Playwright 1.64.1, SwiftShader)

## 1. Checks de baseline

| Check | Comando | Resultado |
| --- | --- | --- |
| Lint + fronteras de arquitectura | `pnpm lint` | **PASS** (`Architecture boundaries pass for simulation and shared.`) |
| Typecheck | `pnpm typecheck` | **PASS** (3 workspaces) |
| Tests | `pnpm test` | **PASS** (suite completa + `test:architecture`) |
| Build | `pnpm build` | **PASS** (`✓ built in 1.48s`) |
| Smoke Alpha en navegador | `pnpm smoke:alpha` | **PASS tras corrección** (ver §2) |
| Benchmark de referencia | `pnpm benchmark` | **PASS**, 6 tests, 210 s, datos en §3 |
| Coste por sistema | `pnpm system:cost` | **PASS**, datos en §3 |
| Benchmark vial D-085 | `pnpm road:benchmark` | **PASS** (`status: "PASS"`, 300 distritos, 0 fallos) |
| Balance jugable | `pnpm balance:playable` | **PASS**, 16 semillas, sin dominancia (§4) |
| Format | `pnpm format:check` | **PASS sobre el árbol versionado** (§5) |

Ninguna cifra de este acta es heredada de documentaciones anteriores: las diez filas se ejecutaron en
esta sesión sobre el mismo árbol.

## 2. Corrección de baseline obligatoria: el smoke Alpha estaba rojo en `95804ee`

El smoke fallaba en `scripts/alpha-browser-smoke.mjs` al esperar `tu oferta 260 u.`:

```
locator.waitFor: Timeout 15000ms exceeded.
  - waiting for getByText(/tu oferta 260 u\./) to be visible
```

Causa: el commit `95804ee` (P1-2) cambió la puja por defecto de un contrato público de
`contract.budget` al 92 % del presupuesto
([apps/web/src/App.tsx:1540](apps/web/src/App.tsx), `Math.ceil((contract.budget * 92) / 100)`). El
fixture del smoke (`contract_90000001`, `budget: 260`) ahora produce **240**, y la aserción seguía
exigiendo 260.

No es un fallo de la corrección P1-2: es una aserción que codificaba un valor de UI en lugar de la
relación que la UI sostiene. Se reescribe para derivar la puja del propio DOM (lee `presupuesto N u.`
y el importe del botón, comprueba que la puja cabe en el presupuesto y después exige que el panel
muestre esa cifra). Con ello el smoke sigue verificando el flujo puja → oferta presentada →
persistencia tras save/reload, y deja de romperse cada vez que cambie la política de puja.

Comprobado: `pnpm smoke:alpha` pasa (`CAJA 49850 u.`, concejo y proyección sin fuga de datos
privados del rival).

**Lección para V.d:** el baseline no estaba verde. `PLAN_improvements.md` pide "ejecutar y archivar"
los checks, y archivarlos sin ejecutarlos habría dado un gate falso.

## 3. Rendimiento del baseline pre-V.d

### Tick y proyección (`pnpm benchmark`, 20 000 ticks × 5 repeticiones × 5 semillas)

Medición limpia, sin otros procesos compitiendo por CPU:

| Métrica | Rango observado |
| --- | --- |
| tick p50 | 0,50 – 0,55 ms |
| tick p95 | 1,00 – 1,12 ms |
| tick p99 | 1,60 – 1,77 ms |
| tick max | 6,72 – 17,31 ms |
| proyección p95 | 0,100 – 0,126 ms |

### Cierre mensual con 800 parcelas (`pnpm system:cost`, 8 semillas, campaña longitudinal)

| Ventana | media | p50 | p95 | max |
| --- | ---: | ---: | ---: | ---: |
| mes 1 | 20,16 ms | 19,69 ms | 22,69 ms | 22,69 ms |
| meses de transición | 20,86 ms | 21,16 ms | 24,94 ms | 24,94 ms |
| meses maduros (4+) | 21,97 ms | 20,92 ms | 26,76 ms | 30,90 ms |

**Corrección de medición:** la primera pasada de esta acta reportó 24,66 / 28,79 ms de media y un p95
maduro de 40,47 ms. Esa pasada corrió con la extracción del benchmark morfológico en segundo plano y
está contaminada. La cifra válida es la de arriba. El cierre mensual sigue por encima del presupuesto
p95 de D-065 incluso en la medición limpia —deuda medida y conocida, no una regresión de esta
sesión— y es el punto de partida real de V.d.

### Red vial (`pnpm road:benchmark`)

- derivación por distrito: p50 3,26 ms, p95 4,89 ms, max 5,29 ms — dentro del presupuesto de 25 ms
  de D-085;
- sweep de 300 distritos: p50 2,84 ms, p95 4,62 ms, max 6,45 ms; **0 fallos**, 0 parcelas sin
  frente, 0 topologías públicas desconectadas, 0 solapes;
- proyección del payload denso: p95 61,53 ms; structured clone p95 13,84 ms; publicar las celdas
  viales añade 20 545 bytes al payload denso.

## 4. Balance jugable tras las correcciones P0

`pnpm balance:playable` (16 semillas × 12 meses × 4 estrategias, sólo comandos reales):

```
PLAYABLE_BALANCE_DOMINANCE {"metric":"playerCash","seeds":16,"dominantThreshold":15,
 "winsByStrategy":{"passive":10,"maintained":1,"delegated_deferred":3,"delegated_balanced":2},
 "anyDominant":false}
```

Ninguna estrategia domina. Pero el reparto **cambió respecto al dataset versionado** de la revisión de
WP4.14 (`passive` 8, `delegated_deferred` 5, `maintained` 2, `delegated_balanced` 1): las correcciones
P0 del 2026-10-28 (límite real de cuadrillas, bloqueo de garantía en ventas, mantenimiento acotado al
jugador, ruinas sin valor contable) movieron el equilibrio hacia la partida pasiva.

Consecuencia de gobierno: el fichero `docs/balance/playable-alpha-baseline-v1.json` **ya no describe
el HEAD actual**. Regenerarlo es tarea de la Fase 0 (o de V.d.2, donde la economía cambia de verdad),
y debe quedar atribuido: no es lo mismo regenerar por superficie canónica que por comportamiento
económico.

## 5. Format

`pnpm format:check` fallaba en dos archivos versionados y se corrigieron en esta acta:
`packages/simulation/src/commands.ts` (estilo del P0-3, ya commiteado con formato pendiente) y
`scripts/alpha-browser-smoke.mjs` (la aserción reescrita).

Los dos archivos que entonces estaban sin versionar ya están en el repositorio, cada uno en su sitio
documental: el plan en la raíz (`PLAN_improvements.md`, citado por sección desde los ADRs) y el
informe de investigación en `docs/research/06-vd-tejido-urbano-investigacion.md`. Ambos pasaron por
prettier (sólo reajuste de líneas) porque CI ejecuta `format:check` sobre el árbol versionado, y
`pnpm format:check` está **verde**.

## 6. Benchmark morfológico: corpus de 28 muestras entregado

La Fase 0 exige 28 ventanas, provenance y envelopes. La primera versión de esta acta dejó el
corpus bloqueado porque la API pública de Overpass respondió `502 at capacity` durante horas.
Se resolvió cambiando la fuente, no el criterio: `tools/urban-benchmark` trabaja ahora sobre
**extractos regionales de Geofabrik** descargados una vez y recortados localmente.

### Fuente y reproducibilidad

| Ciudad | Extracto | Bytes | SHA-256 (12) |
| --- | --- | ---: | --- |
| Liverpool | merseyside | 25 461 621 | `04d7b67988c7` |
| Manchester | greater-manchester | 51 698 491 | `c6bdbe943452` |
| Bilbao | pais-vasco | 69 205 709 | `5817ee02c0fe` |
| Philadelphia | pennsylvania | 349 464 615 | `2ec5209b4026` |

Los `.pbf` y los recortes `.osm` viven en `tools/urban-benchmark/.cache/` (ignorado por Git). Lo
versionado son **sólo** agregados: `docs/urban-benchmark/metrics-v1.json` (28 ventanas, sin
geometría: únicamente el centro de cada ventana), `envelopes-v1.json` y `provenance-v1.json`
(fuente, bytes, SHA-256, versión de OSMnx/pyosmium y atribución ODbL).

La barrida completa —descarga incluida— termina sin fallos: `windows=28/28 failures=0`,
`degenerateWindows: []`.

### Tres errores de medición que el corpus destapó

Encontrar geometría real obligó a corregir tres cosas que las métricas anteriores ocultaban. Las
tres está documentadas en el README de la herramienta porque cambiarán cualquier comparación futura:

1. **La red no es "todo lo que tiene `highway`".** Contando aceras, escaleras y cruces, la ventana
   de Liverpool cívico daba 200 km/km²; filtrando a la red rodada y deduplicando sentido da 34.
   El generador produce calzadas: compararlo con una red peatonal no significa nada.
2. **`gpd.clip` no recalcula `length`.** Sumar el atributo original contaba tramos enteros que sólo
   rozaban la ventana.
3. **Las manzanas hay que poligonizarlas con margen.** Recortando sólo a la ventana, los bloques
   cortados por el borde nunca se cierran y ventanas enteras daban cero manzanas. Ahora se
   poligoniza con 200 m de margen y se conservan las caras cuyo punto representativo cae dentro.

### Anclajes corregidos

La validación automática (`degenerateWindows`: densidad vial < 5 km/km² o cobertura edificada
< 2 %) marcó dos ventanas sobre agua y una muestra poco representativa:

| Ventana | Antes | Ahora |
| --- | --- | --- |
| `liverpool__industrial_edge` | Brunswick Dock (0 km/km², 0,14 % edificado) | Bootle docks / Derby Road |
| `philadelphia__ensanche` | orilla del Delaware (0 km/km², 0,31 %) | Northern Liberties |
| `philadelphia__mixed_dense` | campus Penn/Drexel (supermanzana) | Rittenhouse / Center City West |

Ninguna se corrigió a mano en los datos: se movió el ancla y se volvió a medir.

### Envelopes por familia

Rango observado en las cuatro ciudades (mínimo–máximo y mediana):

| Familia | Vial km/km² | Edificado % | Manzana mediana m² | Entropía orientación (mediana) |
| --- | --- | --- | ---: | ---: |
| `civic_centre` | 22,8–42,4 (30,6) | 33,5–54,5 | 2 860 | 2,07 |
| `ensanche` | 19,9–26,5 (26,3) | 21,6–61,6 | 3 999 | 2,02 |
| `industrial_edge` | 16,9–26,9 (21,4) | 11,4–45,3 | 4 126 | 1,82 |
| `irregular_historic` | 18,8–89,4 (33,5) | 26,8–40,7 | 3 252 | 2,33 |
| `low_density_residential` | 8,4–23,3 (20,0) | 10,7–32,6 | 4 626 | 1,31 |
| `mixed_dense` | 16,2–36,8 (27,8) | 28,0–58,5 | 4 413 | 1,45 |
| `railway` | 14,2–21,2 (15,6) | 13,4–46,5 | 8 208 | 2,21 |

Las familias se separan en la dirección esperada: `low_density_residential` tiene la entropía de
orientación más baja y la menor densidad; `railway` la manzana más grande; `civic_centre` la mayor
cobertura edificada; `irregular_historic` la mayor entropía. Eso es lo que el envelope tiene que
demostrar antes de gobernar una receta de V.d.1.

**Estado del criterio:** el corpus y los envelopes están producidos y versionados; su
**aprobación** es del responsable y queda pendiente. Es el único criterio de Fase 0 que esta acta
no puede firmar.

## 7. Etiqueta de baseline

`pre-vd-baseline` apunta al árbol verificado por esta acta, para poder comparar economía, rendimiento
y UX antes y después de V.d. Se crea localmente; su publicación es decisión del responsable.

## 8. ADRs de la Fase 0

| ADR | Decisión |
| --- | --- |
| D-087 | Qué cierra el playtest del 2026-10-28 y qué excepción de D-063 queda abierta |
| D-088 | Ciudad 3×3, escala física 4 m/celda, nueve distritos simultáneos y LOD sólo medido |
| D-089 | `SnapshotV2`, protocolo v2 y rechazo explícito de guardados v1 |
| D-090 | Tejido urbano autoritativo: manzana → parcela multi-cell → huella, y normativa separada |
| D-091 | Mercados híbridos: vivienda y empleo por distrito, banca/política/macro de ciudad |
| D-092 | Equipamientos municipales físicos y servicios que recorren la red con Dijkstra entero |

Los seis están en **propuesta**: el plan los pide como entrega de la Fase 0, pero la ratificación es
del responsable, y sin ella ningún gate de V.d puede declararse cerrado.

## 9. Deuda documental detectada al pasar

- `docs/engineering/adr/` tiene ficheros hasta **D-083**, mientras `ai-context/DECISIONS.md` llega a
  **D-086**. D-084, D-085 y D-086 —dos de ellos cambios de contrato (proyección Graphic Civic a
  gameplay y topología vial autoritativa)— no tienen ADR propio. El índice del README también termina
  en D-076.
- No se corrige aquí: escribir el detalle de D-084/D-085/D-086 excede la Fase 0 y debe hacerse con su
  propia evidencia, no de rebote.

## 10. Gate de Fase 0, criterio por criterio

| Criterio (`PLAN_improvements.md` §5, Fase 0) | Estado | Evidencia |
| --- | --- | --- |
| Baseline reproducible y verde | **PASS** | §1: lint, typecheck, tests, build, smoke Alpha, benchmark, system cost, benchmark vial y balance jugable ejecutados sobre este árbol |
| Corpus con 28 muestras y provenance | **PASS** | §6: `windows=28/28 failures=0`, SHA-256 de los cuatro extractos, ODbL en `provenance-v1.json` |
| Ningún dato externo forma parte del juego | **PASS** | Guarda en `scripts/check-architecture.mjs`: el runtime no puede referenciar `tools/urban-benchmark`; ningún `.pbf` ni `.osm` se versiona; `metrics-v1.json` no contiene geometría, sólo el centro de cada ventana |
| Envelopes aprobados para orientar parámetros | **PENDIENTE** | §6: publicados y plausibles; la aprobación es del responsable |

**El gate no se declara cerrado.** Tres de los cuatro criterios están verdes y medidos; el cuarto
requiere la firma del responsable sobre los envelopes. Hasta entonces no se inicia la parte
destructiva de V.d.0 (`WorldState`, `SnapshotV2`, protocolo v2, gateways, `ViewProjectionV2`).

## 11. Ratificación de ADRs

El responsable ratificó las decisiones fijadas en `PLAN_improvements.md`, incluidas la ciudad 3×3,
`SnapshotV2` sin compatibilidad con saves v1, el tejido urbano multi-cell, los mercados híbridos y
los equipamientos espaciales. D-087…D-092 pasan de `Propuesta` a `Ratificada` **en lo que reflejan
el plan**; cada ADR lleva ahora una sección "Adiciones respecto a `PLAN_improvements.md`" que separa
los detalles de implementación propios (orden canónico de distritos, separación de versiones en
IndexedDB, índices derivados no persistidos, publicación del nivel de fallback, regla de no inferir
adyacencia desde la rejilla, renovación de la excepción D-087).
