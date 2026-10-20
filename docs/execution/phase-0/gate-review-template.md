# Plantilla de revisión de gate

## Identificación

- Gate:
- Engine version:
- Commit:
- Fecha:
- Responsable técnico:
- Revisores:
- Entornos:

## Decisión

Marcar una:

- [ ] `GO`
- [ ] `CONDITIONAL GO`
- [ ] `REWORK`
- [ ] `STOP`

Justificación basada en evidencia:

## Alcance

| Elemento comprometido | Estado | Evidencia | Desviación |
|---|---|---|---|
| | | | |

Elementos diferidos explícitamente:

Cambios fuera de alcance detectados:

## Checks funcionales

| Check | Resultado | Artefacto |
|---|---|---|
| Install congelado | | |
| Lint | | |
| Typecheck | | |
| Unit/integration | | |
| Build producción | | |
| E2E Chromium | | |
| E2E Firefox | | |
| Determinismo | | |
| Save/load/corrupción | | |
| Fronteras arquitectónicas | | |
| Revisión IP | | |

## Performance

| Métrica | Umbral | Resultado | Estado | Artefacto |
|---|---:|---:|---|---|
| Tick headless p95 | 10 ms | | | |
| Tick headless p99 | 20 ms | | | |
| Ticks > 50 ms | 0,1 % | | | |
| Worker p95 | 12 ms | | | |
| Command/response p95 | 100 ms | | | |
| Frame p95 | 20 ms | | | |
| Frame p99 | 33,3 ms | | | |
| Snapshot | 5 MiB | | | |
| Serialize p95 | 100 ms | | | |
| Validate + restore p95 | 500 ms | | | |
| Memoria delta | 25 MiB | | | |
| Memoria slope | 5 MiB/h | | | |

## Riesgos y deuda

| ID | Estado | Evidencia/impacto | Acción | Responsable | Fecha |
|---|---|---|---|---|---|
| | | | | | |

## Condiciones de un CONDITIONAL GO

Cada condición debe cerrarse antes de iniciar el sistema afectado de la siguiente fase. No se admiten condiciones sobre determinismo, pérdida de saves, autoridad, IP o thresholds.

| ID | Condición | Test de cierre | Responsable | Fecha |
|---|---|---|---|---|
| | | | | |

## Documentación actualizada

- [ ] `PROJECT-STATE.md`
- [ ] `DECISIONS.md`
- [ ] `KNOWN-GAPS.md`
- [ ] Documentos canónicos afectados
- [ ] Matriz de trazabilidad
- [ ] Fixtures y migraciones

## Firmas

- Responsable técnico:
- Producto:
- QA/performance:
