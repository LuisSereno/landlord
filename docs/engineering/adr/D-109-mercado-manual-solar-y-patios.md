# D-109 — Mercado de inquilinos manual, solar reservado y patios de equipamientos

Estado: aceptada el 2026-11-18 por el responsable (plan ejecutado en `develop`, commits
`acc0d33`, `3a8eb63`, `5851542`, `6169122` y los de cierre de fase). No preserva compatibilidad
con partidas anteriores.

## 1. Mercado de inquilinos manual

- Se elimina la autoasignación mensual de solicitudes de origen `market` (`placeSearchers`):
  toda contratación pasa por `AssignTenant`. La delegación de propiedad existente y la IA rival
  siguen emitiendo ese mismo comando; no se añade ninguna política de autoocupación nueva.
- Vigencia exacta de seis meses para solicitudes de mercado (`searchMonths >= maximumSearchMonths`);
  el pool autorado inicial no caduca antes de ser contratado.
- Segmento `household` a ritmo ágil: `populationCap: 60`, `arrivalsAtFullAppeal: 6`. Se conservan
  el límite por plaza libre **y** asequible, la segregación por segmento (talleres sólo artesanos y
  comerciantes; vivienda sólo hogares) y el presupuesto acotado por plaza.
- La satisfacción del contrato no cambia de fórmula (+2 base, −20 renta sobre presupuesto,
  −10 condición < 60, salida forzosa con condición < 20 o satisfacción < 30). El panel la explica
  derivándola de la proyección (`effectiveRent`, `budget`, `condition`), sin estado duplicado.
- Seguridad, transporte, limpieza, parques, empleo y reputación se presentan como factores de
  atractivo de nuevas llegadas, no como penalizaciones de satisfacción.
- La proyección publica `housingMarket.maximumSearchMonths`; el hub muestra plazas libres y
  asequibles, solicitudes por segmento, plazo más corto y causa de escasez derivada.

## 2. Solar reservado frente a huella física

- `BuildingDefinition.siteFootprint` (opcional) declara el solar reservado por la colocación,
  incluidos patios, acceso y aparcamiento. Sólo los seis equipamientos municipales lo declaran:

  | Tipo | Solar | Edificio físico |
  |---|---:|---:|
  | town_hall | 8×4 | 5×3 |
  | school_block | 7×2 | 5×1 |
  | clinic | 3×2 | 2×1 |
  | police_station | 3×2 | 2×1 |
  | fire_station | 4×2 | 3×1 |
  | market_hall | 5×2 | 4×1 |

- El generador municipal elige **ambos** rectángulos con el mismo enumerador autoritativo
  (D-097): primero el solar dentro de la manzana pública reservada (D-092 intacto), después el
  edificio dentro del solar, ordenado por frente vial y orientación. `Building.siteCells` persiste
  la reserva municipal; los edificios privados derivan su solar de la unión de `parcelIds`.
- Proyección, candidatas de colocación y obras publican `siteCells` junto a `footprintCells`.
  El fantasma distingue solar reservado (contexto) de volumen construido (selección + asset).
  Selección, servicios, ocupación, obstáculos y profundidad visual siguen usando la huella física
  (D-093/D-094): el patio no bloquea paso ni construcción.
- `DISTRICT_GENERATOR_VERSION` sube a 4; las fixtures de distrito/ciudad y los digestos dorados
  se regeneran por medición. Incluye el fix de numeración de parcelas públicas tras la fusión
  D-106 (marca alta de ids privados): la fusión reducía `parcels.length` después de numerar y un
  id público podía colisionar con un privado superviviente.
- **Enmienda explícita a D-099:** la baseline aprobada de town_hall V7 reducía su huella física de
  8×4 a 5×3 por decisión del responsable en este plan. Las reglas de identidad cívica (acceso
  monumental, columnas/pilastras, pedestal) se conservan; el friso del recipe grand pasa de 7 a 5
  piezas porque el frente del cuerpo central mide ahora 12 m (6 crujías). La plaza cívica frontal
  sigue enlazada por `UrbanFacility.publicSpaceIds` y el patio del solar añade monumento y asta.

## 3. Patios equipados y fauna visible

- Catálogo declarativo presentacional (`apps/web/src/isometric/facility-courtyards.ts`): acceso
  peatonal recto desde el frente vial a la fachada, plaza de vehículo de dos celdas junto al acceso
  y props temáticos por hash espacial sobre el patio restante. Fuera de `GameState`; no toca
  economía, servicios ni navegación.
- Las celdas libres del solar de los seis equipamientos usan baldosas grises de patio, diferenciadas
  de la acera y del césped exterior; calzadas y huella física conservan su precedencia. La superficie
  es sólo presentación y se deriva de `siteCells − footprintCells`.
- Vehículos temáticos dentro del patio: bomberos → camión, clínica → ambulancia, comisaría → coche
  policial, mercado → reparto. Ayuntamiento: monumento, bancos, bolardos, jardineras y asta;
  colegio: zona de juegos y bancos. Los vehículos de calle ya no aparcan en el bordillo de los
  equipamientos ni en la desembocadura vial de sus accesos.
- Tres props originales nuevos al pipeline con geometría propia y procedencia registrada:
  `prp_school_playground`, `prp_market_stall`, `prp_flagpole` (scripts `create_original_*`,
  fuentes en `blender_artist/sources/original/`, jobs y staging dados de alta). El validador de
  jobs admite fuentes originales bajo ese directorio sin relajar las reglas de terceros.
- Fauna: gorrión urbano en patios de equipamientos con ≥3 celdas libres (máximo 2 con ≥6), nunca
  sobre acceso, vehículo o props. Fauna mayor (gallinas, patos, ocas, toros, camellos) sólo en
  solares vacantes o periféricos con espacio; el núcleo urbano construido sólo ve gorriones.
- Dressing genérico, vallas y fauna excluyen las celdas reservadas por el plan de patio.

## 4. Presupuesto de binarios (D-101) y gates

- La base commiteada el 2026-11-18 (`2018fbd`) ya superaba `maxBundleBytes` en 233.877 B y arrastraba
  17 violaciones por archivo (>1 MiB) en `blender-day/` y `docs/art/day-candidates/`: drift
  preexistente atribuido por medición en worktree limpio, no introducido por esta fase.
- Los nueve PNG de los props originales añaden 476.900 B. El rehorneado de los seis equipamientos
  con huella menor sustituye sus PNG de base (mucho mayores) y debe devolver el bundle bajo el
  límite; la medición final se registra en el acta de cierre. Si no bastara, la excepción nombrada
  en `BINARY-ALLOWLIST.json` es decisión del responsable, no ajuste silencioso.
- Las variantes diurnas y nocturnas de los seis equipamientos se rehornean con `moodId` (D-108) y
  se promocionan por familia con `--types` parcial, preservando el resto del catálogo.

## 5. Lo que esta decisión NO cierra

- El playtest humano de V.d sigue pendiente (checklist en el repo).
- Los fallos de simulación preexistentes desde 2026-11-16 (acería multi-parcela, market-actionability)
  no los introduce ni los cierra esta fase; quedan atribuidos en el acta.
- La orientación física de dominio sigue sin frames laterales (deuda P2 de D-094 §7).
