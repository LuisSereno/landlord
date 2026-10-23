# WP3.2 — Producción física y aptitud del terreno

Fecha: 2026-10-23
Estado: DONE para el slice funcional; arte representativo diferido a G2-C01

## Resultado

La producción propia de materiales ya requiere un edificio productivo físico construido sobre
una parcela. El mercado sigue siendo una alternativa inmediata. Cemento, ladrillo y acero tienen
instalaciones propias, zoning y costes data-driven; la aptitud de la parcela modifica el
rendimiento efectivo mediante enteros/fixed-point. Las fábricas usan las reglas comunes de
crews, WorkOrder, condición, integridad, fuego, reparación, ruina y ampliación.

`InvestInProduction` se conserva únicamente para restaurar instalaciones legacy de snapshots
anteriores; las partidas nuevas no crean instalaciones invisibles.

## Evidencia → criterio

| Criterio D-062 | Resultado | Evidencia |
|---|---|---|
| Construir una instalación desde parcela vacía | PASS | `phase2.test.ts` — `cement_plant` sobre parcela industrial |
| Cero producción antes de terminar la obra | PASS | regresión `does not produce before completion...` |
| Producción automática después | PASS | `builds a physical factory...` |
| Dos parcelas dan rendimientos distintos | PASS | parcela industrial 120% frente a mixta 95% |
| Mercado como alternativa equivalente | PASS | `BuyMaterials`, precios proyectados y smoke browser |
| Interrupción por fuego y recuperación | PASS | pausa de fábrica, técnico, incidente resuelto y reparación |
| Rival elige mercado o producción con comandos normales | PASS | regresión `lets the rival choose market supply...` |
| Save/load y migración legacy | PASS | `migrates snapshots without kind by building linkage` |

## Límites preservados

No se añaden minas, canteras, energía, materias primas intermedias, logística compleja,
trabajadores industriales adicionales ni factory-game. La IA rival conserva información pública y
usa el mismo dispatcher; no recibe caja, materiales ni resultados privilegiados.

## Verificación

```text
pnpm exec vitest run --config vitest.config.ts packages/simulation/src/phase2.test.ts --reporter=verbose
pnpm smoke:phase2
pnpm typecheck
pnpm lint
```

Todos los checks pasan en la revisión del 2026-10-23. El balance de costes, almacenamiento,
zoning/contaminación y upgrades adicionales queda abierto para los siguientes incrementos del
Vertical Slice; no se presenta como cerrado por esta implementación.
