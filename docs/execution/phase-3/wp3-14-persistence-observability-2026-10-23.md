# WP3.14 — Persistencia, cloud spike y observabilidad — 2026-10-23

## Estado

`DONE` para el alcance local del vertical slice. WP3.13 continúa bloqueado por WP2.14 y no se
introduce backend cloud antes de una decisión explícita.

## Resultado

- Los saves de la fase usan `engineVersion: phase3-dev`; el schema v1 conserva migraciones
  aditivas de Gate 1/Gate 2 y los nuevos sistemas de Fase 3.
- El Worker devuelve tamaño, schema y engine del snapshot al guardar, haciendo observable el
  coste de persistencia sin contaminar el estado autoritativo.
- IndexedDB valida al escribir y leer, rechaza payloads corruptos y conserva el último save válido.
- La web crea un autosave local mensual en el slot `autosave`; el slot manual sigue separado y
  disponible para recuperación explícita.
- La carga inválida no reemplaza la partida activa y devuelve `INCOMPATIBLE_SCHEMA` o
  `INVALID_SNAPSHOT` según el fallo.
- La recuperación mantiene PRNG, referencias, comandos pendientes y estado de Fase 3 con la
  misma serialización canónica.

## Evidencia

### Evidence

- `packages/simulation/src/snapshot.ts` fija la versión de engine y la serialización canónica.
- `packages/simulation/src/worker-runtime.ts` expone metadatos de tamaño/schema/engine y mantiene
  la carga atómica.
- `apps/web/src/persistence/indexed-db.ts` valida slots y payloads corruptos.
- `apps/web/src/App.tsx` realiza el autosave mensual y mantiene el flujo manual.
- `packages/simulation/src/worker-runtime.test.ts`, `packages/simulation/src/snapshot.test.ts`
  y `apps/web/src/persistence/indexed-db.test.ts` cubren round-trip, corrupción y recuperación.

### Finding

La persistencia local ya es suficiente para el slice y deja medible el tamaño de una partida
madura. Cloud save permanece como spike de arquitectura, no como backend prematuro ni como nueva
dependencia operativa.

### Path

La cadena queda integrada como:

`estado -> snapshot phase3-dev -> validación IndexedDB/autosave -> carga atómica -> estado equivalente`

## Verificación reproducible

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Resultado observado: 23 tests shared, 84 tests simulation y 17 tests web; tres benchmarks
opt-in permanecen omitidos. Arquitectura, lint, typecheck y build pasan. Vite mantiene el aviso
informativo conocido sobre el tamaño del bundle principal.

## Fuera de alcance

No se implementan backend cloud, sincronización multi-dispositivo, resolución de conflictos,
telemetría remota ni retención de datos fuera del navegador. Todo ello requiere decisión de
producto, privacidad y operación posterior.
