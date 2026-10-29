# V.d.2 — Composición urbana y gameplay inmobiliario

Fecha: 2026-10-28. Rama: `develop`.

## Alcance ejecutado (PLAN_improvements.md §V.d.2)

1. **Roles por bloque.** La receta sustituye la bolsa de `Zoning` por bandas de centralidad (núcleo,
   intermedio, borde), frentes de avenida, gateways y rol dominante del perfil. El rango dentro de la
   banda rompe las paridades accidentales: la mezcla no depende de que un recorrido canónico caiga en
   ordinal par. `Block.urbanRole` y `defaultDevelopmentCodeId` se publican por manzana.
2. **Códigos y usos.** `Parcel` pierde `zoning` y gana `developmentCodeId` + `currentUses`;
   `BuildingDefinition.allowedZoning` se sustituye por `allowedUses`. Los siete códigos de §4.2 viven
   en `development-codes.ts` con enteros (pisos, cobertura, FAR, retranqueos).
3. **Permisos.** El permiso guarda `developmentCodeIdAtDecision`, `allowedUsesAtDecision` y
   `currentUsesAtDecision`; la aprobación usa el rol del bloque y el código real de la parcela. Una
   parcela ancla puede conservar un código propio distinto del código por defecto de su manzana: es
   una excepción autorada de continuidad económica, documentada en D-090.
4. **Índices derivados.** `Parcel.buildingId` desaparece. `building-index.ts` reconstruye
   `buildingsByParcel`, `buildingsByDistrict`, `footprintCellsByParcel`, `parcelsByBlock` y
   `activeSiteOnParcel`; no se persisten. Comandos, sistemas, balance, housing, facciones, servicios,
   automación, snapshot y proyección usan el índice o la relación `Building.parcelId`.
5. **Huellas autocolocadas.** `footprints.ts` construye el envelope edificable (retranqueos de calle y
   laterales, huellas existentes), enumera rectángulos, descarta cobertura/FAR excedidos y elige el
   candidato por área objetivo con desempate por orientación, `y`, `x` y firma. Una parcela admite
   varios edificios terminados, pero una sola obra activa (`ACTIVE_SITE_ON_PARCEL`).
6. **Catálogo.** Se conservan los cinco edificios históricos y se añaden `row_house`,
   `apartment_block`, `mixed_tenement`, `warehouse` y los cinco municipales (`town_hall`,
   `school_block`, `clinic`, `police_station`, `fire_station`, `market_hall`); los municipales no se
   ofrecen a empresas.
7. **Vivienda y empleo por distrito.** `HousingMarketState.byDistrictId` mantiene índice, stock y
   demanda por distrito; `askingRentFor` usa el índice distrital con al menos tres edificios
   comparables y cae al índice de ciudad (o a 100). `EmploymentState.postsByDistrictId` se recalcula
   en el cierre mensual; el salario sigue siendo de ciudad. Los buscadores llevan `marketDistrictId` y
   no se colocan fuera de su distrito.
8. **Política.** El censo electoral pondera cada hogar por su tamaño (`effectivePopulationByDistrict`)
   y la elección reparte votos por población efectiva, no por hogar.
9. **Facciones.** La presión territorial usa manzanas compartidas y frentes sobre el mismo segmento
   vial; no usa distancias entre anchors.
10. **Automatización.** El gestor de propiedad sólo coloca buscadores del distrito del edificio; el de
    mantenimiento sólo asigna cuadrillas locales. Si falta una cuadrilla local deja una excepción
    `crew_unavailable`; nunca teletransporta agentes.
11. **Proyección y UI.** La parcela publica `developmentCodeId`, `allowedUses`, `currentUses`,
    `buildingIds` (más `buildingId` como primer edificio para la UI existente) y `cells`;
    `constructionOptions` publica `allowedUses` y `municipal`. La web filtra opciones por usos
    permitidos.

## Gate, criterio por criterio

| Criterio | Resultado | Evidencia |
|---|---|---|
| Comprar → permiso → construir → ocupar → cobrar en los nueve distritos | PASS | `urban-composition.test.ts` recorre los nueve distritos con ciclo completo y cierre mensual |
| Varias construcciones terminadas comparten parcela sin referencias rotas | PASS | dos edificios en la misma parcela; `buildingIds` derivados y `currentUses` actualizados |
| Cobertura y FAR nunca se exceden | PASS | `parcelEnvelopeUsage` ≤ límites tras construir hasta el rechazo |
| Mismo comando y seed producen la misma huella | PASS | dos estados con la misma seed y comando comparan huella/orientación/plantas |
| Dinero, ownership, garantías y subastas conservan invariantes | PASS | suite completa: `phase2`, `balance`, `tick-conservation`, snapshot y subastas |
| Housing usa fallback distrital/ciudad correctamente | PASS | índice distrital con 3 edificios; con 2 cae al índice de ciudad |
| No se introducen desplazamientos individuales ni commuting | PASS | `AssignTenant` rechaza distrito distinto; automatización no coloca fuera del distrito |

## Verificación ejecutada

- `pnpm lint` — verde (3 warnings de `console.log` en gates de evidencia).
- `pnpm typecheck` — verde en shared, simulation y web.
- `pnpm format:check` — verde.
- Tests: shared **49**, simulation **349** (13 skipped de harnesses), web **88**.
- `pnpm build` — verde.
- `pnpm smoke:alpha` — verde con el fixture v2 migrado a V.d.2.
- `pnpm system:cost` — PASS; cierre mensual maduro p95 máximo **34,30 ms** en los layouts medidos,
  tick ordinario p95 ≤ 0,08 ms. Sigue por encima del presupuesto de D-065.

## Deuda y riesgos

- **SnapshotV2 pre-V.d.2.** Se rechaza por nombre (`UNSUPPORTED_URBAN_FABRIC`), no se migra; el slot
  queda intacto. Es una incompatibilidad de pre-release inherente al cambio de forma de `Parcel`,
  `Building` y `Permit`.
- **Cierre mensual.** p95 ~34 ms, por encima de D-065. V.d.3/V.d.4 deben medir antes de añadir
  sistemas; los índices derivados ya están disponibles.
- **Código de ancla vs código de manzana.** Las anclas autoradas pueden tener un código propio; la
  proyección publica el código de la parcela y el rol de la manzana por separado. No se permite al
  jugador cambiar el código.
- **Usos existentes.** Resuelto: `currentUses` se reconstruye desde los edificios no ruinosos al
  terminar una obra, al iniciar y completar el desescombro y al declararse una ruina. No queda un uso
  sin edificio detrás.
- **Índice distrital de vivienda.** Se actualiza en el cierre mensual; antes del primer cierre usa el
  índice de ciudad (fallback correcto, pero no hay precio distrital hasta que hay muestra).
- **Edificios municipales.** Están en el catálogo pero no se generan hasta V.d.3.
- **Fixtures y goldens.** Regenerados deliberadamente por la nueva composición de roles/códigos y la
  economía de escenario.

## Siguiente fase

V.d.3 — ciudad cívica: reservas y superlots antes de parcelar, programa municipal exacto, parcelas
públicas, espacios públicos y equipamientos físicos enlazados, y bloqueo de compra/venta/garantía/
subasta/construcción empresarial sobre suelo público.
