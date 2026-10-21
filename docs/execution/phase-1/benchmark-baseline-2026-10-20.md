# Baseline de benchmark de Gate 1 — 2026-10-20

## Escenario y ejecución

El harness `packages/simulation/src/benchmark.ts` crea 100 edificios/obstáculos y 500 agentes
en un mapa 64×64. El movimiento usa A* determinista con vecinos norte, este, sur, oeste y
desempate por índice de celda. La iteración de agentes y la asignación inicial de destinos usan
orden estable por ID y el PRNG de la simulación.

La ejecución headless se lanzó con `pnpm benchmark`: 1.000 ticks de warm-up, 20.000 ticks
medidos, cuatro seeds (`0`, `1`, `42`, `4294967295`) y cinco repeticiones por seed. El tiempo
se midió fuera de las reglas con `performance.now()`; el resultado no cambia el estado.

Hardware observado: Intel Core i7-10510U, 8 CPUs visibles, 16 GiB (15 GiB reportados), Linux
x86_64. Node.js 24.19.0 y pnpm 12.11.2.

## Resultado headless

Los valores son el peor p95 y el máximo observado entre las cinco repeticiones de cada seed;
están expresados en milisegundos por tick/proyección.

| Seed | Tick p95 peor | Tick máximo | Proyección p95 peor | Proyección máxima |
|---:|---:|---:|---:|---:|
| 0 | 0,099 | 2,135 | 0,066 | 1,165 |
| 1 | 0,096 | 1,587 | 0,064 | 1,200 |
| 42 | 0,098 | 1,530 | 0,062 | 0,362 |
| 4294967295 | 0,106 | 1,654 | 0,065 | 0,384 |

Estos resultados headless están por debajo de los presupuestos de tick (p95 ≤ 10 ms, p99 ≤
20 ms) y serialización/proyección definidos en Fase 0. El harness conserva el digest final para
repetir la comparación de determinismo.

## Smoke de navegador

El runner `scripts/browser-benchmark.mjs` mide frame time tras warm-up y puede ejecutarse con
`BROWSER_BENCHMARK_WARMUP_MS`, `BROWSER_BENCHMARK_MS` y `BROWSER_ONLY`. En la máquina de
referencia se ejecutó un smoke de 2 s de warm-up y 3 s medidos:

| Navegador | Frames | p50 | p95 | p99 | Máximo |
|---|---:|---:|---:|---:|---:|
| Chromium 156 headless | 180 | 16,7 ms | 16,8 ms | 16,9 ms | 16,9 ms |
| Firefox 157 headless | 180 | 17 ms | 19 ms | 24 ms | 37 ms |

El smoke queda dentro de p95 ≤ 20 ms en ambos navegadores. La ejecución interactiva de diez
minutos y el soak de dos horas pertenecen a WP1.15 y deben archivarse como artefactos de CI sin
mezclar máquinas distintas.

## Invalidación metodológica y siguiente evidencia

Esta baseline queda sustituida como evidencia de aprobación. La revisión de cierre comprobó que
el fixture marcaba un agente como completado al terminar su primera ruta, por lo que la carga de
navegación se apagaba progresivamente. Además, el runner de navegador servía Vite en desarrollo y
abría el juego normal, que no contiene los 500 agentes ni los 100 obstáculos del fixture.

El retest usa destinos continuos por PRNG en orden de ID, un espacio de trabajo A* reutilizable,
un Worker dedicado al fixture y la build de producción servida con `vite preview`. Un smoke corto
del retest obtuvo frame p95 de 17 ms en Chromium y 18 ms en Firefox, y Worker tick p95 cercano a
6 ms; no sustituye las ejecuciones de diez minutos de D-052.

## Limitaciones y siguiente evidencia

- El retest headless completo, las ejecuciones browser de diez minutos y el soak Chromium de dos
  horas siguen pendientes. El harness browser aún debe incluir comandos, backlog y save/load.
- El warning de Vite sobre un bundle inicial superior a 500 kB es informativo para la futura
  optimización; no modifica los umbrales de simulación ni de frame time.
- Para repetir la medición de navegador con los dos motores instalados:

  `pnpm benchmark:browser`

  En entornos donde Playwright no expone el headless shell de Chromium puede indicarse
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE` con la ruta al binario descargado.
