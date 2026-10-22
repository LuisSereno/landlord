# D-056 — Baseline económico de Gate 2

Estado: Aceptada
Fecha: 2026-10-21
Alcance: Gate 2

Nota posterior: D-061 sustituye las crews puramente agregadas para el criterio de cierre del
Gate 2; este ADR permanece como baseline económico e historial de la decisión.

## Contexto

Gate 2 necesita un bucle inmobiliario ejecutable sin introducir todavía banca, fiscalidad o un
mercado sofisticado. También debe conservar la separación entre persona, organización y control.

## Decisión

- La caja, inventario, edificios y transacciones pertenecen a organizaciones.
- El prototipo usa parcelas, tres materiales, obras, inquilinos finitos y rentas periódicas.
- El estado se agrupa en `phase2` como extensión compatible de `SnapshotV1`.
- El rival usa una identidad técnica explícita y el mismo dispatcher que el jugador.
- Los costes y reglas se mantienen data-driven en el núcleo de simulación.

## Consecuencias

El prototipo puede validar el bucle de producto sin equiparar jugador y empresa. La contabilidad,
el mercado inmobiliario avanzado y otros sistemas del Vertical Slice permanecen fuera de alcance.

## Evidencia

`packages/simulation/src/state.ts`, `packages/simulation/src/commands.ts`,
`packages/simulation/src/systems.ts` y `packages/simulation/src/snapshot.ts`.
