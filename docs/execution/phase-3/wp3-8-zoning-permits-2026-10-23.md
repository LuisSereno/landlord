# WP3.8 — Zoning, licencias y permisos — 2026-10-23

## Estado

`DONE`. El slice expone los usos permitidos por parcela y mantiene permisos municipales
deterministas, persistentes y compatibles con el flujo de construcción.

## Resultado

- Las categorías residential, mixed e industrial siguen siendo la fuente data-driven de usos
  permitidos por edificio.
- Las parcelas proyectan usos permitidos, riesgo regulatorio conocido, estado del permiso y fecha
  de caducidad antes de invertir.
- `RequestPermit` registra autoridad municipal, requisitos, zoning vigente, resultado y plazo.
- La obra rutinaria autoemite un permiso aprobado cuando el zoning es compatible; no añade un
  click administrativo obligatorio al bucle principal.
- Una policy municipal puede modificar la probabilidad de aprobación. Una denegación deja la obra
  bloqueada con `PERMIT_DENIED` sin consumir caja ni materiales.
- Los permisos caducados se renuevan al iniciar una obra y se muestran como `expired` en la
  proyección.
- El estado de permisos se conserva en snapshot y se migra aditivamente para partidas antiguas.

## Evidencia

### Evidence

- `packages/simulation/src/phase2.test.ts` cubre usos incompatibles, denegación y aprobación por
  policy, expiración, proyección y save/load.
- `packages/simulation/src/commands.ts` centraliza la evaluación y emisión de permisos.
- `packages/shared/src/domain.ts`, `packages/shared/src/projection.ts` y
  `packages/shared/src/snapshot.ts` fijan el contrato y su persistencia.

### Finding

El zoning crea una restricción legible antes de la compra/obra, mientras que el permiso sólo
interrumpe la decisión cuando existe una excepción regulatoria; la rutina compatible permanece
automatizada.

### Path

La cadena queda integrada como:

`zoning -> usos permitidos/riesgo -> permiso municipal -> obra o denegación -> expiración y renovación`

## Verificación reproducible

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Resultado observado: 23 tests shared, 77 tests simulation y 17 tests web; tres benchmarks
opt-in permanecen omitidos. Arquitectura, lint, typecheck y build pasan. Vite mantiene el aviso
informativo conocido sobre el tamaño del bundle principal.

## Fuera de alcance

No se implementan todavía densidad/altura complejas, inspección urbana, recalificación política
avanzada ni una cola burocrática separada. Esas decisiones se reservan para el sistema municipal y
la expansión urbana posterior.
