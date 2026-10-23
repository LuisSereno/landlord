# WP3.9 — Subastas, ejecuciones e insolvencia inicial — 2026-10-23

## Estado

`DONE`. La condición G3-04 de WP3.4 queda cerrada para el alcance inicial del vertical slice.

## Resultado

- Una segunda cuota impagada lleva el préstamo a `defaulted` y abre una subasta de su garantía.
- La reserva se calcula sobre el valor de parcela y edificio, sin crear activos ni dinero.
- Las pujas sólo reservan caja disponible; el saldo no cambia hasta la adjudicación.
- Las pujas empatadas no se aceptan, una puja puede retirarse y los fondos quedan libres de nuevo.
- Al cierre, la adjudicación carga al ganador, abona al banco, transfiere parcela y edificio de
  forma atómica y deja la deuda defaulted resuelta en el principal, sin duplicar ownership.
- Sin puja la subasta se cierra sin transferencia. La partida sigue siendo jugable.
- Una deuda `delinquent` o `defaulted` puede refinanciarse de forma limitada: aumenta el principal
  con una comisión data-driven, reinicia plazo/interés y retira una subasta sin pujas.
- Una subasta con puja activa bloquea la refinanciación para evitar dos rutas de recuperación
  simultáneas.
- La proyección muestra las subastas abiertas y el HUD permite refinanciar, pujar o retirar una
  puja desde el activo seleccionado.
- Las subastas, reservas y resultado se conservan en snapshot.

## Evidencia

### Evidence

- `packages/simulation/src/phase2.test.ts` cubre apertura por default, refinanciación, reserva,
  empate, retirada, adjudicación, transferencia y save/load.
- `packages/simulation/src/systems.ts` centraliza apertura y cierre de subastas.
- `packages/simulation/src/commands.ts` valida actor, fondos disponibles y exclusión de rutas
  incompatibles.
- `packages/shared/src/domain.ts`, `packages/shared/src/projection.ts` y
  `packages/shared/src/snapshot.ts` fijan los contratos persistentes.

### Finding

La insolvencia se convierte en una decisión de recuperación, no en un game over automático:
refinanciar conserva la propiedad con más deuda; vender la garantía recupera caja para el banco;
retirar una puja conserva la oportunidad hasta el cierre.

### Path

La cadena queda integrada como:

`mora -> default -> refinanciación o subasta -> reserva -> adjudicación -> ownership/caja/deuda`

## Verificación reproducible

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Resultado observado: 23 tests shared, 79 tests simulation y 17 tests web; tres benchmarks
opt-in permanecen omitidos. Arquitectura, lint, typecheck y build pasan. Vite mantiene el aviso
informativo conocido sobre el tamaño del bundle principal.

## Fuera de alcance

No se implementan todavía múltiples rondas de acreedores, quitas negociadas, reestructuración
colectiva, mercado secundario ni un sistema de game over. El procedimiento es deliberadamente
limitado y determinista para el vertical slice.
