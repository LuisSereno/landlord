# Gate 2 — baseline de implementación

Fecha: 2026-10-21  
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
| Tests de simulación: `46 passed` y 3 benchmarks omitidos | Compra atómica, tres recursos renovables, cuadrilla/cancelación, upgrade con renta, ordenanza, multa, diagnóstico y save/load | `packages/simulation/src/phase2.test.ts`, `packages/simulation/src/worker-runtime.test.ts` |
| Suite completa: shared `23 passed`, simulation `42 passed`, web `16 passed` | La extensión no rompe los contratos ni el núcleo técnico de Gate 1 | `packages/shared/src`, `packages/simulation/src`, `apps/web/src` |
| `pnpm typecheck`, `pnpm lint` y arquitectura sin errores | Las fronteras `simulation`/`shared`/`web` siguen siendo válidas | `scripts/check-architecture.mjs` |
| `pnpm smoke:phase2` | El navegador completa comprar → construir → ocupar → ordenar → guardar → cargar sin errores de página | `scripts/phase2-browser-smoke.mjs` |
| Benchmark reducido de 20.000 ticks, seed 1, una repetición | p95 tick `1.0225 ms`; p95 projection `0.0871 ms` en la fixture técnica de Gate 1 | `packages/simulation/src/benchmark.test.ts` |
| Snapshot restaurado con proyección y libro económico | La economía de la fase sobrevive a IndexedDB y a la rehidratación del Worker | `packages/simulation/src/snapshot.ts`, `apps/web/src/persistence/indexed-db.ts` |
| Métricas de Worker y diagnóstico acotado de la web | Los playtests pueden observar cola, aceptaciones, rechazos y patrones repetidos sin alterar la simulación | `packages/simulation/src/worker-runtime.ts`, `apps/web/src/diagnostics.ts` |
| Smoke del layout de presentación | El flujo conserva compra → obra → ocupación → ordenanza → save/load con mapa principal, HUD e inspector contextual | `apps/web/src/App.tsx`, `apps/web/src/styles.css`, `scripts/phase2-browser-smoke.mjs` |

## Alcance implementado

Se han conectado los paquetes en el mismo flujo autoritativo:

- `WP2.1`: distrito fijo, ocho parcelas, ownership por organización y `BuyParcel`.
- `WP2.2`: caja por organización y transacciones con causa, tick y referencia.
- `WP2.3`: fábricas agregadas, ciclos deterministas, capacidad y catálogo de cemento,
  ladrillo y acero.
- `WP2.4–WP2.5`: obras separadas de edificios terminados y una crew de capacidad limitada.
- `WP2.6`: cuatro tenants finitos, compatibilidad, contratos y renta automática.
- `WP2.7`: orden de mejora con coste, materiales y progreso.
- `WP2.8`: rival autónomo con el mismo dispatcher y observación pública del distrito.
- `WP2.9`: ruta ilegal opcional, heat, presión policial y resultado determinista.
- `WP2.10`: una ordenanza con descuento material y reducción de renta, vigencia y expiración.
- `WP2.11–WP2.12`: HUD operativo, acciones contextuales y snapshot aditivo compatible con
  fixtures de Gate 1.
- Diagnóstico de playtest: panel de sesión con los ocho eventos recientes, capacidad máxima de
  120, errores de transporte, rechazos por código y aviso a partir de tres rechazos iguales.
- Base de presentación de WP2.11: layout map-céntrico, panel operativo superpuesto y plegable,
  HUD de caja y recursos, inspector contextual sin IDs como interfaz principal, acciones
  agrupadas y diagnóstico colapsable.
- Cierre funcional D-059: producción renovable de los tres materiales; una cuadrilla visible;
  progreso y cancelación; selección explícita de tenant; mejora con +25% de renta; velocidades
  1×/2×/4×; libro de caja; resumen rival; influencia consumible y multa por detección.

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
parcela: nombre, coste, duración, capacidad, renta y recursos. En una parcela mixta el jugador
puede elegir explícitamente entre el Patio compacto y el Taller de barrio. Esta es la elección de
construcción mínima del Gate 2; finanzas, impuestos, mantenimiento, seguros, banca, mercado
profundo y más tipos de edificio pertenecen a fases posteriores.

## Comprobación reproducible

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm --filter @landlord/web dev --host 127.0.0.1
# en otra terminal
pnpm smoke:phase2
```

La smoke espera el servidor en `http://127.0.0.1:5173/`; se puede cambiar con
`PHASE2_BASE_URL`.

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
