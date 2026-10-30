# V.d — Hardening y cierre

Fecha: 2026-10-29. Rama: `develop`.

> ## ⚠ Revisado por V.d-H1 — este acta ya no describe el estado de la fase
>
> Lo que sigue abajo es el texto del cierre del 2026-10-29 y **se conserva sin retoques**: sus
> mediciones son reales para el HEAD `95e8937` en que se tomaron y no se reescribe la historia.
>
> Esa acta declaraba «V.d.0–V.d.6 están cerradas» con un requisito obligatorio en `PARTIAL` y seis
> puntos en su lista de deuda, y la revisión posterior convirtió ese cierre prematuro en diez
> hallazgos de integridad confirmados. Un acta no puede a la vez declarar cerrada una fase y listar
> requisitos obligatorios sin cumplir.
>
> El estado vigente de V.d es el de la revisión
> [vd-h1-urban-integrity-hardening-2026-10-29.md](file:///home/luis/RepositorioGitHub/landlord/docs/execution/phase-4/vd-h1-urban-integrity-hardening-2026-10-29.md):
> los diez hallazgos están corregidos y con test, los cuatro puntos de deuda de esta acta que
> dependían de código están hechos, y **V.d NO está cerrada**, porque falta el playtest humano de §2.4
> ([checklist](file:///home/luis/RepositorioGitHub/landlord/docs/execution/phase-4/vd-final-playtest-checklist.md),
> `PENDING HUMAN PLAYTEST`) y quedan dos señales de balance abiertas. El detalle, en la sección
> «Revisión V.d-H1» al final de este documento.


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

---

# Revisión V.d-H1 (2026-10-29)

HEAD revisado: `95e8937`. HEAD de la revisión: los trece commits funcionales de `95e8937..c0bda82` en
`develop`
(sin push). Acta completa con evidencia:
[vd-h1-urban-integrity-hardening-2026-10-29.md](vd-h1-urban-integrity-hardening-2026-10-29.md).

## Por qué se reabre

«V.d.0–V.d.6 están cerradas» se afirmó con la fila *Campaña de dos años* en `PARTIAL` y con seis
puntos de deuda. La revisión sistemática del salto un distrito → ciudad 3×3 encontró además **diez
reglas que decían una cosa y hacían otra**, todas con test de regresión que falla contra el código de
esta acta:

| H1 | Hallazgo | Estado tras la revisión |
|---|---|---|
| H1-01 | La coordenada local `(x,y)` se comparaba entre distritos: onda expansiva, vecinos de vivienda, incidentes y adyacencia de técnicos cruzaban de mapa | corregido (`district-place.ts`) |
| H1-02 | Un edificio se modelaba como el ancla de su parcela: interacción y rutas no respetaban la huella | corregido (`district-obstacles.ts`) |
| H1-03 | `Permit` sin identidad ni consumo: un permiso financiaba obras infinitas y la venta borraba el expediente | corregido (`permitting.ts`, `PermitId`, `consumed`) |
| H1-04 | `allowedUses` leído como `every` en cuatro capas: `workshop` no era construible en ninguna parcela de la ciudad | corregido (`isBuildingAllowedByDevelopmentCode`) |
| H1-05 | Un equipamiento en ruina seguía prestando servicio | corregido (`operationalFacilityCapacity`) |
| H1-06 | Centro y densidad de limpieza mezclaban los nueve mapas | corregido (geometría por distrito) |
| H1-07 | La UI actuaba sobre `buildingIds[0]`, no sobre lo elegido | corregido (`resolveBuildingSelection`) |
| H1-08 | El dressing ocupaba por `parcel.cell`, no por la geometría | corregido (`geometryCells`) |
| H1-09 | El valor del suelo no consumía servicios de V.d.5 ni la densidad vigente y sumaba amenidades dos veces | corregido (`land-value.ts`) |
| H1-10 | Faltaban los escenarios de aceptación extremo a extremo | cubiertos (`h1-acceptance-*.test.ts`) |

## Estado de los requisitos y de la deuda de esta acta

| Elemento de esta acta | Entonces | Ahora |
|---|---|---|
| Campaña de dos años en nueve distritos | `PARTIAL` | `PASS` — `h1-campaign-24-months.test.ts`, 345 600 ticks, hitos 1/6/12/18/24 |
| Doce city seeds como fixture | deuda Beta | `PASS` — `CANONICAL_CITY_SEEDS` + `city-seeds.test.ts` |
| `RuntimeAssetManifestV2` | deuda Beta | `PASS` — V2 con `domainFootprint`, `allowedOrientations`, `symmetry` y parser explícito |
| Arranque frío del grafo de servicios | deuda Beta | **sigue abierto** (~312 ms una vez, hitch de carga) |
| Capturas golden locales | deuda Beta | **sigue abierto** (evidencia JPEG, sin pixel-diff cross-environment) |
| Arte cívico SVG procedural | deuda Beta | **sigue abierto** por decisión: sustituirlo es trabajo de Blender, no de contrato |
| Incendio cross-system con respuesta de bomberos | `PASS` | `PASS` y reforzado: el escenario B mide ahora `damageCovered < damageUncovered` |
| Diez digestos dorados | `PASS` | regenerados **cuatro veces**, cada delta atribuido por medida (H1-01, H1-02, H1-03/04, H1-05/06) |
| Save/load byte-equivalente | `PASS` | `PASS`, con una rotura declarada: un `SnapshotV2` pre-H1 se rechaza por `UnsupportedPermitContractError` |

## Decisión de cierre tras la revisión

`CLOSED` exige que todos los requisitos obligatorios estén en `PASS`. Después de H1 los requisitos de
código lo están; la fase **sigue sin cerrarse** por dos motivos verificables:

1. §2.4 del plan pide una partida jugada por una persona. No se ha jugado: el checklist está en
   [vd-final-playtest-checklist.md](vd-final-playtest-checklist.md) como `PENDING HUMAN PLAYTEST`. Un
   smoke automatizado no puede sustituir una percepción humana, así que marcar `PASS` por esa vía
   sería falso.
2. Dos señales de balance quedan abiertas y no se han parcheado: 100 de ~709 parcelas comercializables
   con cobertura de seguridad con 12 de 14 equipamientos saturados, y `delegated_deferred` dominante
   en 16/16 seeds (reproducida idéntica en `95e8937`, por tanto preexistente). Arreglarlas cambia
   constantes y reglas de balance, decisión que pertenece al responsable y no a este hardening.
