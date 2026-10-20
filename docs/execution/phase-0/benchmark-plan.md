# Plan de benchmark de Gate 1

Estado: Aceptado para implementación  
Decisión: D-052

## Objetivo

Medir simulation, frontera Worker, render isométrico, snapshot y estabilidad con una carga fija. El benchmark no mide diversión ni balance.

## Fixture `gate1-reference-v1`

- Mapa `64 × 64`.
- Seed principal `1`; regresión con `0`, `42` y `4294967295`.
- 100 obstáculos estáticos, definidos por un fixture versionado y no regenerados en cada run.
- 500 agentes ordenados por ID.
- Celdas transitables cardinales.
- A* con coste uniforme y desempate norte `(0,-1)`, este `(1,0)`, sur `(0,1)`, oeste `(-1,0)`, después ID de celda.
- Cada agente solicita un destino al completar su ruta; el consumo de PRNG ocurre en orden ascendente de ID.
- Un destino bloqueado se vuelve a sortear con un máximo documentado de intentos; agotarlo deja al agente quieto hasta el siguiente ciclo.
- Tick lógico de 50 ms, equivalente a 20 Hz.
- Proyección completa o delta, según implementación, con cadencia máxima de 10 Hz.

## Entorno de referencia

| Campo | Valor inicial |
|---|---|
| CPU | Intel Core i7-10510U, 4 cores/8 threads |
| Memoria | 16 GiB |
| SO | Linux x86_64, Ubuntu base |
| Node | 24.19.0 |
| Browsers | Chromium y Firefox gestionados por Playwright 1.64.1 |

Cada resultado añade commit, engine version, build mode, temperatura/energía si se conoce, browser exacto y procesos relevantes. CI y portátil generan series separadas.

## Benchmark headless

Por cada seed:

1. Ejecutar build de producción en proceso nuevo.
2. Inicializar fixture.
3. Avanzar 1.000 ticks sin registrar percentiles.
4. Forzar sólo la pausa disponible para estabilizar medición; no forzar GC salvo suite diagnóstica separada.
5. Medir 20.000 ticks.
6. Registrar duración individual, total, media, p50, p95, p99, máximo, memoria inicial/final y hash.
7. Repetir cinco veces.

No mezclar tiempo de carga/build con tiempo de tick. Informar por sistema cuando exista instrumentación.

## Benchmark browser

En Chromium y Firefox:

1. Servir build de producción local.
2. Abrir fixture y esperar warm-up de 1.000 ticks.
3. Ejecutar diez minutos con cámara mostrando toda la carga relevante.
4. Programar selección y `PlaceTestStructure` a intervalos fijos.
5. Registrar tick Worker, backlog, command/response, proyección, frame time, long tasks y memoria disponible.
6. Guardar, cargar y verificar hash/continuación.

La medición de frame usa timestamps monotónicos sólo en el harness/render; nunca alimenta simulation.

## Soak

- Chromium, build de producción, seed `1`.
- Diez minutos de warm-up y dos horas medidas.
- Muestra de memoria cada minuto.
- Guardado/carga a los minutos 30, 60, 90 y 120.
- Comando válido cada cinco minutos e inválido cada diez.
- Hash/checkpoint cada 1.000 ticks.
- Comparar mediana de minutos 11-20 con mediana de los diez últimos.
- Calcular regresión lineal de memoria tras warm-up.

## Umbrales

| Métrica | Aprobación |
|---|---:|
| Headless tick p95 | ≤ 10 ms |
| Headless tick p99 | ≤ 20 ms |
| Ticks > 50 ms | ≤ 0,1 % |
| Worker tick p95 | ≤ 12 ms |
| Command/response p95 | ≤ 100 ms |
| Frame time p95 | ≤ 20 ms |
| Frame time p99 | ≤ 33,3 ms |
| Snapshot sin comprimir | ≤ 5 MiB |
| Serialización p95 | ≤ 100 ms |
| Validación + restore p95 | ≤ 500 ms |
| Crecimiento entre medianas | ≤ 25 MiB |
| Pendiente post-warm-up | ≤ 5 MiB/hora |
| Crash/excepción/divergencia | 0 |

Todos los umbrales deben cumplirse en el entorno de referencia. El browser con peor resultado decide la métrica compartida.

## Determinismo

- Las cinco repeticiones de una seed deben producir el mismo hash final.
- Node, Chromium y Firefox deben producir el mismo hash canónico.
- Guardar en tick N, restaurar y llegar a M debe igualar ejecución continua hasta M.
- Una diferencia debe informar primer checkpoint divergente, sistema, seed y comandos.

## Artefactos

```text
artifacts/benchmarks/<engine-version>/<environment>/<timestamp>/
  environment.json
  config.json
  samples.json
  summary.json
  checkpoints.json
  report.md
```

`artifacts/` será output de CI/local ignorado por Git. El fixture y schema de resultados sí se versionarán durante Gate 1.

## Interpretación

- Un fallo funcional o divergencia invalida la medición de rendimiento.
- Un outlier se conserva; no se elimina sin causa demostrada y anotada.
- Optimizar sólo después de perfilar por sistema.
- Incumplir produce `REWORK`. Cambiar carga o umbral exige ADR posterior.
