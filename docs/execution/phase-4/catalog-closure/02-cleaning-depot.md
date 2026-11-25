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
| `cleaning-depot.test.ts` | 12/12 |
| Servicios, programa municipal, snapshots, ciudad, distritos, digestos, labels y assets | 60/60 en conjunto |
| `pnpm typecheck` | PASS |
| Captura Composer del depósito | 144/144, 0 errores de página |
| Revisión visual humana del depósito | PENDIENTE |
| Promoción Composer del depósito | PENDIENTE |

El fallback procedural `cleaning_depot` es semántico: nave de tres bahías, contenedores y señal
municipal. No se declara asset final ni sustituye la revisión humana.

## Arte Composer

La gramática final usa chapa perfilada original de 4 m, tres portones de servicio, cubierta plana y
ventilación de azotea. Las 48 candidatas (seis estados × cuatro orientaciones × dos moods) pasan
matriz, hashes, 8/8 pruebas de gate y validación PNG independiente con 48 hashes únicos. Las 144
capturas en ciudad pasan el gate con 0 errores de página y 144 hashes únicos; la aprobación visual
humana sigue separada de la promoción runtime.

## Atribución de regresiones

La suite completa sobre el cambio inicial dio 22 fallos. Un worktree limpio en `116b6e0` reprodujo
18 fallos preexistentes en los mismos archivos. Los cinco nuevos se corrigieron en `2d79e72`:
colocación de acería sobre v5, dos ciclos de vida de `phase2`, colateral por parcela y conteo de
facilities en topología/campaña. La fixture Alpha se regeneró desde el productor en `c2204d5`.
La repetición completa final dio 17 fallos, todos baseline; el triplete de acería de la seed 2026
ya pasa con v5. No hay regresiones nuevas y los 17 restantes no se ocultan ni se atribuyen al depósito.
