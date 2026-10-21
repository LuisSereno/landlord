# Retest de Gate 1 — 2026-10-21

## Alcance

Se repitió el fixture continuo de D-052 después de corregir la finalización de rutas y se
instrumentaron el transporte de comandos, la cola pendiente, las proyecciones, save/load y la
continuación determinista. La decisión sobre `events` frente a snapshots no forma parte de este
retest y permanece intacta.

Hardware de referencia: Linux x86_64, Intel Core i7-10510U, 16 GiB. Toolchain: Node 24.19.0,
pnpm 12.11.2, build de producción Vite 8.3.4, Chromium 156 y Firefox 157.

## Headless

Comando: `CI=1 pnpm benchmark` (1.000 ticks de warm-up, 20.000 medidos, cuatro seeds y cinco
repeticiones por seed). Peor p95 y máximo entre las cinco repeticiones:

| Seed | Tick p95 (ms) | Tick p99 (ms) | Tick máximo (ms) | Proyección p95 (ms) | Proyección máxima (ms) |
|---:|---:|---:|---:|---:|---:|
| 0 | 1,135 | 1,834 | 7,202 | 0,102 | 2,668 |
| 1 | 1,128 | 1,779 | 5,299 | 0,103 | 2,520 |
| 42 | 1,075 | 1,732 | 7,711 | 0,095 | 3,154 |
| 4294967295 | 1,094 | 1,802 | 8,706 | 0,089 | 3,076 |

Resultado: PASS. No se observaron divergencias en las pruebas de snapshot/continuación y las
cuatro seeds completaron sus cinco repeticiones.

## Navegador: diez minutos

Firefox y Chromium completaron diez minutos medidos tras 50 s de warm-up con la cadencia máxima
de proyección de D-052 (10 Hz). El soak reducido de 30 minutos que sigue se ejecutó previamente
con la cadencia de estabilidad de 2 Hz y no sustituye esta comprobación de rendimiento máximo.

| Navegador | Medición | Frames | p50 (ms) | p95 (ms) | p99 (ms) | Máximo (ms) | Page errors |
|---|---:|---:|---:|---:|---:|---:|---:|
| Firefox 157 | 10 min a 10 Hz | 35.997 | 17,0 | 18,0 | 19,0 | 54,0 | 0 |
| Chromium 156 | 10 min a 10 Hz | 35.495 | 16,7 | 18,6 | 22,8 | 85,5 | 0 |

Firefox registró Worker tick p95 de 9 ms, backlog máximo 5, 23 comprobaciones de continuación,
0 divergencias y 4 operaciones save/load sin fallos. Chromium registró Worker tick p95 de
2,5 ms, command/response p95 de 38,5 ms, backlog máximo 5, 23 comprobaciones de continuación,
0 divergencias y 4 operaciones save/load sin fallos. Ambos navegadores cumplen los umbrales de
frame y command/response de D-052.

La primera repetición de Chromium tras instrumentar el fixture había dado 21,5 ms de p95. La
corrección final cacheó las coordenadas isométricas, evitó reposicionar Bobs fuera del viewport y
desactivó antialiasing para los marcadores del benchmark; la repetición oficial bajó a 18,6 ms.

## Soak Chromium reducido

Por decisión operativa del usuario, el soak se redujo de dos horas a 30 minutos medidos, con
10 minutos de warm-up. Esta corrida se hizo con la cadencia de estabilidad de 2 Hz:

```text
BROWSER_ONLY=chromium BROWSER_BENCHMARK_WARMUP_MS=600000 BROWSER_BENCHMARK_MS=1800000 pnpm benchmark:browser
```

La ejecución completó los 1.800.000 ms sin errores de página ni errores de operación. La memoria
observada se mantuvo estable y posteriormente bajó de 19,3 MiB a 16,1 MiB de heap usado; no hay
pendiente creciente en esta ventana. El Worker acabó con digest `fnv1a32:5d926911`, snapshot de
463.491 bytes, `saveLoadFailures=0` y `continuationDivergences=0`.

Este soak de 30 minutos sustituye la duración operativa de dos horas para esta fase temprana y
confirma estabilidad. La decisión arquitectónica sobre eventos/snapshots permanece intacta.

## Instrumentación completada

- `SubmitCommand`: latencia p95, backlog actual/máximo y rechazos de celda inválida.
- Proyección: coste en Worker y round-trip hasta el render.
- Snapshot: bytes serializados, serialize/restore p95, operaciones y fallos.
- Continuación: comparación canónica durante 20 ticks tras cada load.
- Runner: page errors, long tasks, frame percentiles y muestras de memoria.

Los comandos del modo benchmark son probes de transporte con validación de celda; no alteran el
fixture fijo de 100 edificios, para preservar la comparabilidad de D-052. El comando de dominio
`PlaceTestStructure` y su integración funcional siguen cubiertos por los tests del Worker.
