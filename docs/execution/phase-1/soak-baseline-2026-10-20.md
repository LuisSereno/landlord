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

El runner `scripts/browser-benchmark.mjs` acepta una duración arbitraria. Para el soak acordado:

```text
BROWSER_BENCHMARK_WARMUP_MS=600000 BROWSER_BENCHMARK_MS=7200000 pnpm benchmark:browser
```

La corrida de dos horas no se ejecuta automáticamente en la suite ni se simula reduciendo el
umbral. El smoke de Chromium/Firefox está documentado en el baseline de WP1.14; el resultado de
esta duración debe adjuntarse antes de la decisión final de Gate 1.

## Estado

WP1.15 queda técnicamente preparada y el soak headless reproducible debe repetirse con el
fixture continuo. La ejecución de dos horas en Chromium es evidencia operativa pendiente de un
runner CI o una sesión dedicada; Firefox requiere el benchmark de diez minutos, no un soak de dos
horas, conforme a D-052.
