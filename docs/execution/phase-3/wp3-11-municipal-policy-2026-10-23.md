# WP3.11 — Política municipal integrada — 2026-10-23

## Estado

`DONE`. La política municipal es una decisión económica integrada y no un minijuego aislado.

## Resultado

- El catálogo ofrece tres políticas originales con trade-offs explícitos sobre materiales, renta,
  impuesto de propiedad, tasa de transmisión, aprobación de permisos, influencia y probabilidad
  de aprobación.
- `ProposePolicy` permite seleccionar una alternativa cuando no hay una política activa; la
  ordenanza propuesta conserva sus efectos y requisitos antes del lobby.
- `LobbyPolicy` consume influencia y resuelve la aprobación con el PRNG determinista del motor.
- `WithdrawPolicy` retira una propuesta o una política activa y elimina sus modificadores de
  la economía desde el siguiente cálculo, sin borrar la trazabilidad del estado.
- Los modificadores se aplican en la misma precedencia: sólo la ordenanza `active` afecta coste
  de construcción, renta, fiscalidad y permisos; no se apilan accidentalmente con una segunda
  política.
- La proyección muestra el catálogo, efectos, apoyo requerido, probabilidad y estado visible;
  el cliente permite proponer, promover y retirar.
- La IA rival pondera su propio beneficio fiscal/costes y puede gastar su influencia en una
  propuesta favorable, usando el mismo comando y la misma aleatoriedad que el jugador.

## Evidencia

### Evidence

- `packages/simulation/src/game-data.ts` contiene el catálogo data-driven y las definiciones de
  efectos.
- `packages/simulation/src/commands.ts` centraliza propuesta, lobby, retirada y validación de
  precedencia.
- `packages/simulation/src/systems.ts` incorpora el interés propio del rival sin acceso al
  estado privado del jugador.
- `packages/shared/src/domain.ts` y `packages/shared/src/projection.ts` fijan los contratos de
  comandos, estados y opciones visibles.
- `apps/web/src/App.tsx` presenta los efectos y expone las decisiones políticas.
- `packages/simulation/src/phase2.test.ts` cubre catálogo, trade-offs, lobby, retirada,
  persistencia y decisión autónoma rival.

### Finding

La política cambia el valor de las decisiones inmobiliarias: una ordenanza puede abaratar la
obra y reducir renta, favorecer permisos con una carga fiscal distinta o aliviar impuestos a
cambio de costes regulatorios. La influencia es un recurso limitado y retirar una política
permite corregir una estrategia sin destruir la partida.

### Path

La cadena queda integrada como:

`catálogo -> propuesta -> lobby/influencia -> política activa -> coste/renta/impuesto/permiso -> decisión inmobiliaria`

## Verificación reproducible

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Resultado observado: 23 tests shared, 83 tests simulation y 17 tests web; tres benchmarks
opt-in permanecen omitidos. Arquitectura, lint, typecheck y build pasan. Vite mantiene el aviso
informativo conocido sobre el tamaño del bundle principal.

## Fuera de alcance

No se implementan todavía coaliciones, elecciones, reputación política longitudinal, múltiples
jurisdicciones ni una simulación política jugable independiente. El catálogo y el contrato de
modificadores dejan esa evolución abierta sin ampliar el Gate actual.
