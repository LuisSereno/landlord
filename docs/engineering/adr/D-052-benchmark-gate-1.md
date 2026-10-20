# D-052 — Benchmark y umbrales de Gate 1

Estado: Aceptada  
Fecha: 2026-10-20  
Alcance: Gate 1

## Contexto

“Rendimiento suficiente” necesita una carga, un método y umbrales previos. Ajustar el criterio después de medir ocultaría un fallo técnico.

## Decisión

Escenario fijo:

- mapa `64 × 64`;
- 100 edificios/obstáculos;
- 500 agentes simplificados;
- navegación cardinal mediante A* determinista;
- desempate norte, este, sur, oeste y después ID de celda;
- destinos generados por PRNG en orden estable de agent ID;
- 20 ticks lógicos por segundo;
- proyección máxima de 10 Hz;
- seeds `1` principal y `0`, `42`, `4294967295` adicionales.

Headless: 1.000 ticks de warm-up, 20.000 medidos, cinco repeticiones por seed y build de producción.

Browser: Chromium y Firefox durante diez minutos; soak de dos horas en Chromium. Hardware de referencia: Intel Core i7-10510U, 16 GiB, Linux x86_64. Las comparaciones registran hardware, SO, browser, build, commit y seed.

Umbrales:

- headless tick p95 ≤ 10 ms y p99 ≤ 20 ms;
- muestras > 50 ms ≤ 0,1 %;
- Worker tick p95 ≤ 12 ms;
- command/response p95 ≤ 100 ms;
- frame time p95 ≤ 20 ms y p99 ≤ 33,3 ms en ambos browsers;
- snapshot sin compresión ≤ 5 MiB;
- serialización p95 ≤ 100 ms;
- validación + restore p95 ≤ 500 ms;
- cero crashes, excepciones no capturadas y divergencias;
- tras diez minutos de warm-up, aumento entre medianas inicial/final ≤ 25 MiB y pendiente ≤ 5 MiB/hora;
- continuación tras save/load idéntica a ejecución ininterrumpida.

El detalle operativo vive en `docs/execution/phase-0/benchmark-plan.md`.

## Alternativas descartadas

- Benchmark sin thresholds: no permite decidir el gate.
- Sólo media: oculta spikes perceptibles.
- Sólo headless: no mide mensajería ni render.
- Comparar números absolutos entre CI y portátil: mezcla entornos no equivalentes.

## Consecuencias

- Incumplir un umbral produce `REWORK`, no una rebaja automática.
- Optimización debe partir de profiling por sistema.
- El fixture y metodología son artefactos versionados.

## Condición de revisión

Sólo mediante ADR con nueva evidencia, cambio documentado de carga o error demostrado en la metodología. No se revisa para aprobar retrospectivamente un resultado fallido.
