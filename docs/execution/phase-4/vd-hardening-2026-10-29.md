# V.d — Hardening y cierre

Fecha: 2026-10-29. Rama: `develop`.

## Estado de cierre

V.d.0–V.d.6 están cerradas y publicadas en `develop`. Esta acta recoge la verificación final y lo
que queda explícitamente para Beta; no sustituye las actas de cada fase.

## Verificación final

- `pnpm lint` — verde (1 warning de `console.log` en el gate de evidencia).
- `pnpm typecheck` — verde en shared, simulation y web.
- `pnpm format:check` — verde.
- `pnpm --filter @landlord/shared test` — **49** tests.
- `pnpm --filter @landlord/simulation test` — **376** tests (13 skipped de harnesses opt-in), 43
  archivos verdes.
- `pnpm --filter @landlord/web test` — **92** tests.
- `pnpm build` — verde.
- `pnpm smoke:alpha` — verde con el fixture Alpha migrado a `baseLandValue`/`marketValue`.
- `pnpm fabric:gate` — 100 city seeds / 900 distritos, 73.289 parcelas, generación p95 **221,58 ms**
  y red p95 **2,42 ms** (evidencia V.d.4; la generación no cambia en V.d.5/V.d.6).
- `pnpm system:cost` — PASS; cierre maduro p95 máximo **43,30 ms**, transición p95 **46,11 ms**.
  El primer cierre incluye la construcción única del grafo (~312 ms p95) y queda como deuda de
  arranque.
- `pnpm balance:playable` — PASS; 64 campañas (4 estrategias × 16 seeds), 0 comandos rechazados y
  sin dominancia.
- Capturas visuales: `docs/art/golden/vd6/` (centro cívico, HUD oculto, residencial, industria con
  seguridad, valor del suelo y ordenanza de densidad).

## Cobertura de los requisitos de §6

| Requisito | Estado | Evidencia |
|---|---|---|
| Schemas e IDs de entidades nuevas | PASS | tests shared/simulation de city, blocks, parcels, facilities, permits y snapshots |
| Conectividad de celdas de blocks, parcels y public spaces | PASS | `urban-fabric.test.ts`, `district-generation.test.ts` |
| Canonicalización independiente del orden | PASS | `canonical-state.test.ts`, `facility-coverage.test.ts` (orden de Maps) |
| Frente vial, coverage, FAR y setbacks | PASS | suite de V.d.1/V.d.2/V.d.5 |
| Grafo de gateways y rutas cross-district | PASS | `facility-coverage.test.ts` (cierre de gateway y frente eliminado) |
| Valor del suelo y límite mensual | PASS | `land-value.test.ts` |
| Capacidad y saturación de facilities | PASS | `facility-coverage.test.ts` |
| Relaciones building→parcel y facility→buildings | PASS | `urban-civic.test.ts`, snapshot validation |
| Rechazo de operaciones sobre suelo público | PASS | `urban-civic.test.ts` |
| Información pública/privada en `ViewProjectionV2` | PASS | `projection.test.ts`, `facility-coverage.test.ts` |
| Diez escenarios dorados adaptados a SnapshotV2 | PASS | `tick-conservation.test.ts` (diez digestos) |
| Save/load byte-equivalente | PASS | `snapshot.test.ts`, `urban-civic.test.ts` |
| Misma seed/perfil/comandos → misma ciudad y economía | PASS | `district-generation.test.ts`, `city.test.ts`, suite de balance |
| Cambio de distrito observado sin cambiar digest | PASS | `worker-runtime.test.ts`, smoke Alpha |
| Campaña de dos años en nueve distritos | PARTIAL | `balance:playable` cubre la ciudad completa y 64 campañas; falta el etiquetado explícito de dos años con hitos |
| Incendio cross-system con respuesta de bomberos | PASS | `facility-coverage.test.ts` (helper de fuego) y `tick-conservation` de cascadas |
| Colapso, seguro, reparación y subasta multi-cell | PASS | `phase2.test.ts`, `urban-civic.test.ts`, `snapshot.test.ts` |

## Deuda declarada para Beta

- **RuntimeAssetManifestV2.** V1 ya cubre estados, huella, pivote, orientaciones de props y
  provenance; las orientaciones de edificios asimétricos y la huella de dominio explícita por tipo
  no están en este cierre.
- **Arranque frío del grafo de servicios.** Primer cierre p95 ~312 ms; los siguientes reutilizan
  caché. Es un hitch de carga, no un coste mensual recurrente.
- **Doce city seeds como fixture.** Hay doce fixtures de distrito (tres perfiles × cuatro seeds) y
  el gate barre 900 distritos; no hay una lista canónica separada de doce seeds de ciudad.
- **Campaña de dos años instrumentada.** `balance:playable` cubre la ciudad completa y varias
  estrategias, pero no está etiquetada como una campaña de dos años con hitos intermedios.
- **Capturas golden locales.** Son JPEG de evidencia, no pixel-diff cross-environment (D-081 ya
  documentó esa inestabilidad).
- **Arte cívico.** Los seis edificios cívicos son SVG procedurales originales; la ruta Blender
  puede sustituirlos sin cambiar el contrato runtime.

## Decisión de cierre

No se declara Beta cerrada: V.d cierra el núcleo urbano y de servicios, pero la lista anterior pasa
a la planificación de Beta/Hardening. La suite, el build, el smoke, el gate morfológico, el coste por
sistema y la campaña jugable quedan verdes en `develop`.
