# Fase 0 de V.d — Baseline reproducible y benchmark morfológico

- **Fecha:** 2026-10-28
- **Commit medido:** `95804ee` (`fix: resolve P0 bugs from 30-min playtest and add report`), rama
  `develop`, más los cambios de esta acta
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

Ninguna cifra de este acta es heredada de documentaciones anteriores: las once filas se ejecutaron en
esta sesión sobre el mismo HEAD.

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

| Métrica | Rango observado |
| --- | --- |
| tick p50 | 0,42 – 0,46 ms |
| tick p95 | 0,71 – 0,88 ms |
| tick p99 | 1,42 – 1,63 ms |
| tick max | 4,06 – 15,72 ms |
| proyección p95 | 0,049 – 0,078 ms |

### Cierre mensual con 800 parcelas (`pnpm system:cost`, 8 semillas, campaña longitudinal)

| Ventana | media | p50 | p95 | max |
| --- | ---: | ---: | ---: | ---: |
| mes 1 | 24,66 ms | 26,12 ms | 35,55 ms | 35,55 ms |
| meses de transición | 25,87 ms | 24,25 ms | 46,81 ms | 46,81 ms |
| meses maduros (4+) | 28,79 ms | 26,80 ms | 40,47 ms | 49,59 ms |

El cierre mensual sigue **fuera del presupuesto p95 de D-065**, como ya registraron D-076 y WP4.11-H.
Es deuda medida y conocida, no una regresión de esta sesión. Importa para V.d por una razón concreta:
D-088 multiplica por nueve el número de distritos que cierran, así que el punto de partida ya está
fuera de presupuesto antes de añadir nada.

### Red vial (`pnpm road:benchmark`)

- derivación sobre 300 distritos: p50 2,30 ms, p95 4,72 ms, max 6,63 ms — dentro del presupuesto de
  25 ms de D-085;
- 0 fallos de frente, 0 topologías públicas desconectadas, 0 solapes;
- proyección jugable p95 1,05 ms; payload denso 20 536 bytes para 2 672 celdas viales;
- structured clone del payload denso p95 15,30 ms.

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

Quedan dos avisos en archivos **no versionados**, que CI no ve porque no existen en el checkout:
`PLAN_improvements.md` y `deep-research-report (2).md`. No se reformatea el plan del responsable sin
que lo pida. `deep-research-report (2).md` parece un volcado accidental en la raíz del repo: decidir
si se versiona en otra ruta o se elimina es una decisión del responsable, no de esta acta.

## 6. Benchmark morfológico: herramienta lista, datos bloqueados

Entregado:

- `tools/urban-benchmark/` con OSMnx fijado por versión (`requirements.lock.txt`: osmnx 1.9.3,
  networkx 3.7, geopandas 1.2.0, shapely 2.2.0, pyproj 3.8.0);
- `tools/urban-benchmark/windows.json`: manifest de las **28 ventanas** (4 ciudades atlánticas
  industriales —Liverpool, Manchester, Bilbao, Philadelphia— × 7 familias morfológicas), cada una
  centrada en un ancla real y de 256 × 256 m, es decir la dimensión exacta de un distrito V.d a
  4 m/celda;
- extracción de métricas agregadas: densidad vial, intersecciones por km², longitud media de tramo,
  entropía de orientación, manzanas por poligonización con áreas p25/mediana/p75, cobertura edificada,
  verde, equipamientos por familia y mezcla funcional;
- `envelopes` por familia sobre las cuatro ciudades (min/p25/mediana/p75/max);
- `run.sh` reanudable: las ventanas ya extraídas se cachean y sólo se rehacen las que faltan.

**No entregado: las 28 muestras reales.** Los tres endpoints públicos de Overpass están saturados
durante toda la sesión de trabajo: `overpass-api.de` responde `502 — currently at capacity` también en
`/api/status`, `overpass.private.coffee` agota el timeout de lectura y `overpass.openstreetmap.fr`
devuelve 403. La herramienta está probada end-to-end contra `overpass-api.de` cuando tenía hueco
(ventana de Bilbao centro cívico: 81 nodos, 207 tramos), pero no hay forma honesta de rellenar el
corpus mientras el servicio externo no responda.

Lo que **no** se hace: generar métricas sintéticas, copiar valores de literatura o dar envelopes
"de referencia" sin muestra. El gate de Fase 0 dice "corpus con 28 muestras y provenance"; un corpus
inventado convertiría el criterio morfológico de V.d.1 en un espejo.

Estado del gate: **ABIERTO**. Falta ejecutar `tools/urban-benchmark/run.sh` cuando Overpass responda y
someter los envelopes a aprobación del responsable.

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
