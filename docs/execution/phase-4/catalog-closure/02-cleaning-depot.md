# Depósito municipal de limpieza — 2026-11-25

Commit local de dominio: `f7f628e` (`feat(sim): add municipal cleaning depot`). Sin push.

## Contrato implementado

- Tipo `cleaning_depot`, municipal, huella 3×1, solar 4×2, una parcela/8 celdas.
- +6 celdas al radio de limpieza del distrito por edificio operativo propiedad del municipio; máximo 36.
- Sin depósito, la fórmula radial anterior se conserva exacta.
- Transporte y seguridad permanecen en el grafo.
- SnapshotV3 sin migración; partidas v3 sin depósito cargan con comportamiento básico.

## Medición

La versión del generador sube a 5. Las doce ciudades canónicas se midieron una vez y pasan a 15
facilities/edificios municipales, 7 espacios públicos y 699–723 parcelas. Las doce fixtures de
distrito y los diez digestos de conservación se regeneraron con los mismos escenarios.

| Gate | Resultado |
| --- | --- |
| `cleaning-depot.test.ts` | 11/11 |
| Servicios, programa municipal, snapshots, ciudad, distritos, digestos, labels y assets | 60/60 en conjunto |
| `pnpm typecheck` | PASS |
| Revisión visual humana del depósito | PENDIENTE |
| Promoción Composer del depósito | PENDIENTE |

El fallback procedural `cleaning_depot` es semántico: nave de tres bahías, contenedores y señal
municipal. No se declara asset final ni sustituye la revisión humana.
