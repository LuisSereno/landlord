# Gate 2 — baseline de implementación

Fecha: 2026-10-22
Estado: candidato funcional de Gate 2; aprobación de producto pendiente.

Esta evidencia demuestra que el repositorio ya contiene el primer bucle jugable de
Landlord. No declara todavía el Gate 2 aprobado: faltan sesiones de playtest humano de
30–60 minutos, baseline cuantitativo de producto y el Visual Direction Spike completo.

El rework de presentación y comprensión de WP2.11 está integrado. La pantalla ya es una base
representativa para iniciar WP2.14; no constituye todavía una dirección artística aprobada.

## Bucle validado

```mermaid
flowchart LR
  A[Seleccionar parcela] --> B[Comprar]
  B --> C[Producir materiales]
  C --> D[Construir]
  D --> E[Ocupar]
  E --> F[Cobrar renta automática]
  F --> G[Competir con rival]
  G --> H[Elegir ruta legal o ilegal]
  H --> I[Adaptarse a ordenanza]
  I --> J[Guardar y continuar]
```

## Evidence → Finding → Path

| Evidence | Finding | Path |
|---|---|---|
| Tests de simulación: `51 passed` y 3 benchmarks omitidos | Calendario, mercado/producción, multiunidad, dos cuadrillas, renta, reparación, política, riesgo, cola y save/load | `packages/simulation/src/phase2.test.ts`, `packages/simulation/src/worker-runtime.test.ts` |
| Suite completa: shared `23 passed`, simulation `51 passed`, web `17 passed` | La extensión no rompe los contratos ni el núcleo técnico de Gate 1 | `packages/shared/src`, `packages/simulation/src`, `apps/web/src` |
| `pnpm typecheck`, `pnpm lint` y arquitectura sin errores | Las fronteras `simulation`/`shared`/`web` siguen siendo válidas | `scripts/check-architecture.mjs` |
| `pnpm smoke:phase2` | Chromium completa mercado → producción → compra → obra con dos crews → ocupación → upgrade → política → save → reload → load → crimen | `scripts/phase2-browser-smoke.mjs` |
| Benchmark completo, 20.000 ticks por repetición | Peor p95 observado: tick `1.053 ms`, proyección `0.092 ms`; sin regresión del budget de Gate 1 | `packages/simulation/src/benchmark.test.ts` |
| Snapshot restaurado con proyección y libro económico | La economía de la fase sobrevive a IndexedDB y a la rehidratación del Worker | `packages/simulation/src/snapshot.ts`, `apps/web/src/persistence/indexed-db.ts` |
| Métricas de Worker y diagnóstico acotado de la web | Los playtests pueden observar cola, aceptaciones, rechazos y patrones repetidos sin alterar la simulación | `packages/simulation/src/worker-runtime.ts`, `apps/web/src/diagnostics.ts` |
| Smoke del layout de presentación | El flujo conserva compra → obra → ocupación → ordenanza → save/load con mapa principal, HUD e inspector contextual | `apps/web/src/App.tsx`, `apps/web/src/styles.css`, `scripts/phase2-browser-smoke.mjs` |

## Alcance implementado

Se han conectado los paquetes en el mismo flujo autoritativo:

- `WP2.1`: distrito fijo, ocho parcelas, ownership por organización y `BuyParcel`.
- `WP2.2`: caja por organización y transacciones con causa, tick y referencia.
- `WP2.3`: mercado de materiales y líneas agregadas que requieren inversión y coste operativo.
- `WP2.4–WP2.5`: obras separadas y dos crews repartibles o concentrables.
- `WP2.6`: tenants finitos, varios contratos por edificio, presupuesto, satisfacción y renta mensual.
- `WP2.7`: orden de mejora con coste, materiales y progreso.
- `WP2.8`: rival utility mínimo con el mismo dispatcher, memoria/cooldown y activos públicos.
- `WP2.9`: ruta ilegal opcional con cooldown, heat, policía y transferencia conservativa.
- `WP2.10`: ordenanza incierta con influencia, modificadores, vigencia y expiración.
- `WP2.11–WP2.12`: HUD operativo, acciones contextuales y snapshot aditivo compatible con
  fixtures de Gate 1.
- Diagnóstico de playtest: panel de sesión con los ocho eventos recientes, capacidad máxima de
  120, errores de transporte, rechazos por código y aviso a partir de tres rechazos iguales.
- Base de presentación de WP2.11: layout map-céntrico, panel operativo superpuesto y plegable,
  HUD de caja y recursos, inspector contextual sin IDs como interfaz principal, acciones
  agrupadas y diagnóstico colapsable.
- Coherencia D-060: 30 minutos reales por mes a 1×; mercado frente a producción; dos cuadrillas;
  capacidad multiunidad; presupuesto/satisfacción; deterioro/reparación; política incierta;
  privacidad rival; cooldown criminal; historiales acotados y cola autoritativa persistente.

El estado autoritativo permanece en `simulation`; React sólo envía comandos y presenta la
proyección recibida del Worker. El render no modifica caja, recursos, precios o política.
Las métricas de diagnóstico son efímeras: se publican cada 20 ticks o mediante `GetMetrics`,
no se serializan y se reinician al iniciar o cargar una partida.

## Cierre de la comprobación básica de diagnóstico

El 2026-10-21 se realizó una prueba manual básica y el responsable del proyecto confirmó que
el flujo y los mensajes observados eran correctos. La evidencia de la sesión registró cero
errores de transporte, cero rechazos y once comandos aceptados; el Worker alcanzó el tick 2040
sin cola pendiente. El punto de instrumentación de playtest queda cerrado para esta iteración.

Este resultado no es un acta de aprobación de Gate 2: las sesiones largas, las seeds de
referencia, las métricas de producto y el Visual Direction Spike siguen pendientes.

## Rework de comprensión de acciones

Una prueba de la base de presentación detectó cinco rechazos `INSUFFICIENT_RESOURCES`: el
jugador tenía cero ladrillo y la acción de construir no anticipaba los requisitos. También se
reportó falta de propósito visible para la ordenanza, la ruta ilegal y el marcador técnico.

La corrección integrada muestra los requisitos y los materiales faltantes antes de construir,
explica coste/efectos/vigencia de la ordenanza, expone beneficio/riesgo/heat de la ruta ilegal y
oculta el marcador técnico salvo con `?debug=1`. Los requisitos y parámetros se proyectan desde
la simulación; la UI no replica decisiones económicas autoritativas.

El selector de construcción también expone todas las alternativas permitidas por el zoning de la
parcela: nombre, coste efectivo y base, duración, capacidad, renta y recursos. En una parcela mixta el jugador
puede elegir explícitamente entre el Patio compacto y el Taller de barrio. Esta es la elección de
construcción mínima del Gate 2; finanzas, impuestos, seguros, banca, mercado inmobiliario
profundo y más tipos de edificio pertenecen a fases posteriores.

## Comprobación reproducible

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm smoke:phase2
```

La smoke levanta automáticamente el preview de producción en `127.0.0.1:4174`. También puede
apuntar a un servidor externo mediante `PHASE2_BASE_URL`. GitHub Actions instala Chromium y
ejecuta este smoke después del build.

## Decisiones y límites

- La extensión de snapshot es aditiva dentro del contrato v1 para poder restaurar fixtures
  de Gate 1 sin una migración destructiva. Los campos de Phase 2 están agrupados bajo
  `phase2` y los contadores propios se mantienen separados.
- El rival es una organización independiente. Su controlador técnico usa un actor explícito
  reservado para la IA; no se modela como una segunda identidad humana del jugador.
- La acción ilegal no es necesaria para progresar y no garantiza beneficio.
- El diagnóstico sirve para interpretar un playtest, no para telemetría remota ni analítica de
  jugadores: no hay backend ni persistencia de estos datos.
- Los nombres, edificios, textos y datos del prototipo son originales y no reutilizan
  contenido protegido de referencias históricas.

## Pendiente para aprobar Gate 2

- WP2.13: 5–10 seeds de referencia, sesiones humanas de 30–60 minutos, métricas de decisión,
  ritmo, comprensión, inflación y bloqueos.
- WP2.14: Visual Direction Spike end-to-end con renders, metadata, provenance, métricas y
  recomendación de dirección; el prototipo actual usa geometría procedural de validación.
- Registrar la decisión GO/REWORK/STOP en un acta posterior al playtest.
