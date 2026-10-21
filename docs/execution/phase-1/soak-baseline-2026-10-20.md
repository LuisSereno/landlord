# Baseline de soak de Gate 1 — 2026-10-20

## Headless

`pnpm soak` ejecutó 144.000 ticks (20 Hz, equivalente a dos horas simuladas) sobre el fixture
anterior de 500 agentes/100 edificios con seed `1`. La ejecución tardó 8,62 s en el hardware de
referencia (i7-10510U, 16 GiB, Linux x86_64). La memoria RSS pasó de 90,6 MiB en el primer
muestreo a 105,2 MiB y se mantuvo estable hasta el final; el heap osciló por GC sin una
tendencia creciente. El test también serializó/restauró el estado de simulación y comparó el
snapshot resultante.

Esta baseline no certifica el fixture continuo: la revisión posterior detectó que los agentes se
detenían tras completar su primera ruta. Debe repetirse antes del cierre. El harness no declara
por sí solo ausencia de leaks del navegador: sólo mide el proceso Node y
conserva muestras de `rss`/`heapUsed` cada 10.000 ticks. Los datos completos quedan en la salida
de `pnpm soak` y deben archivarse como artefacto CI.

## Navegador

El runner `scripts/browser-benchmark.mjs` acepta una duración arbitraria. Para el soak reducido
acordado en esta fase:

```text
BROWSER_ONLY=chromium BROWSER_BENCHMARK_WARMUP_MS=600000 BROWSER_BENCHMARK_MS=1800000 pnpm benchmark:browser
```

La ejecución del 2026-10-21 completó 30 minutos medidos en Chromium sin page errors, fallos de
save/load ni divergencias de continuación. Ese soak de estabilidad usó 2 Hz; la comprobación de
rendimiento a la cadencia máxima (10 Hz) se ejecutó aparte durante diez minutos y dejó Chromium
en REWORK por frame p95 de 21,5 ms. Firefox completó su benchmark independiente de diez minutos a
10 Hz. Los datos completos están en `gate-1-retest-2026-10-21.md`.

## Estado

WP1.15 queda cerrada para esta revisión con un soak Chromium reducido de 30 minutos medidos. La
duración sustituye operativamente las dos horas para la fase temprana, sin alterar los umbrales de
D-052. Firefox mantiene el benchmark de diez minutos, no un soak de dos horas.
