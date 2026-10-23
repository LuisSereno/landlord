# WP3.10 — IA rival financiera — 2026-10-23

## Estado

`DONE`. El rival financiero opera mediante los mismos comandos, fondos y reglas de
ownership que el jugador.

## Resultado

- El perfil inicial `conservative` mantiene una reserva mínima de liquidez y limita las
  decisiones de expansión, producción y puja con esa reserva.
- La IA observa sólo su cartera, su caja, sus préstamos, las subastas públicas y el riesgo
  de sus edificios; no consulta el estado privado del jugador para decidir.
- Puede refinanciar deuda en mora/default, pujar por garantías públicas, asegurar activos
  deteriorados, reparar edificios, solicitar financiación y vender solares vacíos cuando la
  caja cae bajo la reserva.
- La venta de parcelas es un comando atómico: el banco paga el valor de liquidación, el rival
  recibe caja y el ownership se libera sin duplicar activos.
- La memoria persistente registra pérdidas, defaults, última pérdida y motivo/resultado de la
  última decisión. Un shortfall de subasta alimenta esa memoria sin modificar reglas fuera del
  motor.
- La decisión autónoma utiliza el actor rival autorizado por el motor y queda incluida en el
  estado canónico y en snapshots.
- El cliente web expone `sellParcel` para conservar un contrato completo, aunque la estrategia
  rival se ejecuta headless dentro de la simulación.

## Evidencia

### Evidence

- `packages/simulation/src/systems.ts` calcula reserva, candidatos utility, memoria y ejecución
  autónoma determinista.
- `packages/simulation/src/commands.ts` valida y liquida `SellParcel` a través del mismo camino
  transaccional que las demás decisiones.
- `packages/simulation/src/phase2.test.ts` cubre venta rival, ausencia de creación de dinero,
  persistencia y repetición determinista de la liquidación bajo presión de caja.
- `packages/shared/src/domain.ts`, `packages/shared/src/snapshot.ts` y
  `packages/simulation/src/snapshot.ts` fijan el contrato y su migración.
- `apps/web/src/worker/client.ts` conserva la superficie de comandos del worker.

### Finding

La competencia rival deja de ser un actor con presupuesto implícito: tiene una política
observable de liquidez, asume deuda y riesgo, y puede recuperarse vendiendo activos. Las
decisiones siguen siendo auditables y reproducibles porque la IA sólo propone comandos que el
motor valida.

### Path

La cadena queda integrada como:

`caja/reserva -> deuda/riesgo -> utility rival -> comando validado -> memoria -> siguiente decisión`

## Verificación reproducible

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Resultado observado: 23 tests shared, 81 tests simulation y 17 tests web; tres benchmarks
opt-in permanecen omitidos. Arquitectura, lint, typecheck y build pasan. Vite mantiene el aviso
informativo conocido sobre el tamaño del bundle principal.

## Fuera de alcance

No se implementan todavía perfiles configurables múltiples, aprendizaje estadístico, cheating
del rival, información oculta avanzada ni torneos de balance prolongados. El perfil
`conservative` y el harness determinista dejan el contrato preparado para esos trabajos sin
ampliar el Gate actual.
