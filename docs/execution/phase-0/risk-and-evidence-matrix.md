# Matriz de riesgos y evidencias de Gate 1

Estado: Aceptada  
Fecha: 2026-10-20

Los responsables son roles hasta que Gate 1 asigne nombres.

| ID | Riesgo/criterio | Señal | Prevención | Evidencia de cierre | Responsable | Contingencia |
|---|---|---|---|---|---|---|
| G1-R01 | Simulation acoplada a UI | Import de React/Phaser/DOM | tsconfig sin DOM y lint | Test de arquitectura + typecheck | Arquitectura | Bloquear merge y extraer adapter |
| G1-R02 | No determinismo | Hash distinto con mismas entradas | PRNG, orden e IDs explícitos | Golden scenarios cross-runtime | Simulation | Localizar primer checkpoint divergente |
| G1-R03 | PRNG incompatible con saves | Secuencia cambia tras restore | Algoritmo/version/vectores | Vectores y continuidad N+1 | Simulation | REWORK; no migrar silenciosamente |
| G1-R04 | Render autoritativo | UI decide ocupación/owner | Commands y proyecciones | E2E rechazo + revisión de handlers | Arquitectura | Mover regla a simulation |
| G1-R05 | Player equivale a company | Recursos/ownership en Player | Person/org/grant separados | Fixture con dos orgs y test de autorización | Dominio | REWORK del modelo antes de Gate 2 |
| G1-R06 | Worker pierde o duplica comandos | IDs repetidos o respuesta ausente | Correlación y deduplicación | Tests duplicado, orden y error | Web/Simulation | Instrumentar cola y protocolo |
| G1-R07 | Save incompleto | Divergencia tras load | Snapshot v1 exhaustivo | Continuación equivalente | Persistencia | Identificar estado omitido, nueva fixture |
| G1-R08 | Save corrupto destruye partida | Último válido no carga | Validación antes de swap y backup | Test payload corrupto | Persistencia | Recuperar última copia validada |
| G1-R09 | Schema incompatible ambiguo | Load parcial de v2 | Versiones estrictas | `INCOMPATIBLE_SCHEMA` | Persistencia | Migración explícita posterior |
| G1-R10 | Rendimiento Worker insuficiente | Tick/backlog fuera de D-052 | Profiling temprano | Informe headless/browser | Performance | Optimizar cuello medido o STOP |
| G1-R11 | Render isométrico insuficiente | Frame/picking falla | Spike con carga real | E2E geométrico + métricas | Web | Spike comparativo y nuevo ADR |
| G1-R12 | Memory leak | Pendiente > 5 MiB/h | Soak automatizado | Informe de dos horas | Performance | Heap/profile; REWORK |
| G1-R13 | Benchmark irreproducible | Resultados sin entorno/seed | Fixture y metadata obligatoria | Artefacto completo | QA/Performance | Invalidar y repetir |
| G1-R14 | Scope creep | Aparecen sistemas Gate 2 | Charter IN/OUT | Revisión de backlog/diff | Producto | Diferir o retirar cambio |
| G1-R15 | Overengineering | Paquetes/frameworks vacíos | D-047 | Árbol de workspace revisado | Arquitectura | Eliminar placeholder |
| G1-R16 | IP ajena | Asset/copy sin origen | Geometría original y registro | Inventario de procedencia | Producto/Legal | Retirar antes de demo |
| G1-R17 | Navegadores divergen | Test sólo pasa en uno | Playwright Chromium/Firefox | Matriz E2E | Web/QA | REWORK o ADR de soporte |
| G1-R18 | Toolchain no reproducible | Install cambia o falla | Versiones exactas/lockfile | Clon limpio en CI | Plataforma | Resolver incompatibilidad con ADR |

## Correspondencia criterio-evidencia

| Criterio de Gate 1 | Test/artefacto obligatorio |
|---|---|
| Mapa isométrico, cámara y zoom | E2E Chromium/Firefox + captura de demo |
| Picking | Tests de conversión y E2E en centro/bordes/zoom |
| Web Worker | Test de handshake, versionado, requests y errores |
| Tick fijo | Equivalencia `step(100)` y cien `step(1)` |
| Seed/PRNG | Vectores D-048 en tres runtimes |
| Determinismo | Golden scenario, hashes y checkpoints |
| Identidad/control | Persona, dos orgs, un grant y rechazo ajeno |
| Command/event | Aceptación, causalidad, duplicado y rechazo atómico |
| Snapshot | Schema, roundtrip, continuación e incompatibilidad |
| IndexedDB | Slots, última copia válida y corrupción |
| 500 agentes/100 edificios | `gate1-reference-v1` y D-052 |
| Profiling | Métricas por sistema, Worker, render y snapshot |
| Estabilidad | Soak de dos horas y reporte de memoria |
| IP | Inventario de assets/copy con procedencia |

## Regla de cierre

Un riesgo se marca cerrado sólo con enlace al artefacto. “No observado” no equivale a cerrado si no se ejecutó la prueba prevista.
