# V.d.4 — Densidad, skyline y valor del suelo

Fecha: 2026-10-29. Rama: `develop`.

## Alcance ejecutado (PLAN_improvements.md §V.d.4)

1. **Valor separado de la escritura.** `Parcel` pierde `price` y separa `baseLandValue` (autorado,
   inmutable, para auditoría) de `marketValue` (usado por compras, garantías, impuestos, balance y
   valoración de activos). El valor de mercado arranca igual al base y sólo se mueve en el cierre
   mensual.
2. **Score entero por parcela.** `land-value.ts` calcula componentes con los rangos del plan:
   centralidad vial 0…20 (distancia a avenidas), acceso comercial 0…12 (manzanas de corredor),
   amenidades cívicas 0…10 (equipamientos y espacios públicos), frente 6/3 (avenida/calle),
   potencial del código 0…12, servicios 0…10 (cobertura municipal), externalidad industrial 0…−18
   (excluida en suelo industrial propio), aislamiento 0…−20 (distancia a la red vial) y variación
   determinista por seed −3…3. `rawScore` es la suma; `score` aplica el clamp −40…60 y el desglose
   publica `clampAdjustment` para que la suma cuadre exactamente.
3. **Objetivo y límite mensual.** `targetValue = floor(baseLandValue × (100 + score) / 100)`. En cada
   cierre mensual `marketValue` se mueve hacia el objetivo como máximo un 5 % del valor corriente;
   el suelo público queda en cero y no participa. Los mapas de distancia se cachean por geometría de
   distrito (`WeakMap`), porque V.d.4 no muta la red, las manzanas ni los equipamientos.
4. **Densidad.** El bloque de viviendas (`apartment_block`) declara cinco plantas base, de modo que
   el código de corredor (4) lo limita a 4 y el ensayo de densidad permite la quinta. La
   autocolocación prefiere el frente principal (avenida) y, después, la continuidad con huellas
   existentes de la misma parcela; el área objetivo, las plantas y la firma siguen desempatando.
5. **Ordenanza `corridor_density_trial`.** `policy_00000005`, «Ensayo de densidad de corredor»:
   +1 planta y +100 puntos de FAR sólo en manzanas `commercial_corridor`. El permiso congela el
   bonus en `densityBonusFloors`/`densityBonusFarPercent`; la obra usa el código efectivo del
   permiso, así que un permiso emitido durante la vigencia conserva el derecho adquirido después de
   expirar. La expiración no toca edificios ni obras existentes.
6. **Proyección y UI.** La parcela publica `baseLandValue`, `marketValue` y
   `LandValueBreakdown`; el inspector muestra base, mercado, score y los nueve componentes. La capa
   de mapa «Valor del suelo» colorea por score, y las opciones de construcción publican el bonus
   vigente. La ordenanza y sus alternativas exponen los campos de densidad.

## Gate, criterio por criterio

| Criterio | Resultado | Evidencia |
|---|---|---|
| El valor es reproducible y el desglose suma exactamente | PASS | `land-value.test.ts`: dos cálculos idénticos, `rawScore` = suma de componentes y `rawScore + clampAdjustment = score`; `targetValue` = fórmula entera |
| Centro, residencial e industria muestran bandas diferentes | PASS | mediana de `targetValue` en seed 7: Centro Cívico 1.509 > Barrio del Umbral 1.070 > industria (Oeste/Patios) 913/960 |
| Una amenidad o recorte de servicio mueve el valor en la dirección esperada | PASS | recortar seguridad/transporte/limpieza baja `services` y `targetValue` de la parcela mejor cubierta |
| La ordenanza cambia oportunidades sin demoler ni invalidar activos | PASS | permiso activo guarda +1/+100; tras expirar, la obra con ese permiso se acepta y conserva 5 plantas; un permiso nuevo ya no recibe bonus |
| Siguen existiendo entradas baratas, medias y premium en cada city seed aceptada | PASS | seeds 1/7/42/1337: mínimo < mediana < máximo y al menos tres valores distintos |
| Regenerar baseline jugable y verificar que ninguna estrategia domina por error | PASS | `pnpm balance:playable`: 64 campañas (4 estrategias × 16 seeds), 0 comandos rechazados, 0 impagos/subastas; ninguna estrategia domina activos ni caja |
| Autocolocación prefiere frente principal y continuidad | PASS | `development-density.test.ts` elige la huella junto al frente principal cuando área y plantas empatan; la continuidad usa huellas existentes |

## Verificación ejecutada

- `pnpm lint` — verde (1 warning de `console.log` en el gate de evidencia).
- `pnpm typecheck` — verde en shared, simulation y web.
- `pnpm format:check` — verde.
- Tests: shared **49**, simulation **366** (13 skipped de harnesses opt-in), web **89**.
- `pnpm build` — verde.
- `pnpm smoke:alpha` — verde con el fixture Alpha migrado a `baseLandValue`/`marketValue`.
- `pnpm fabric:gate` — 100 city seeds / **900 distritos**, **73.289 parcelas**, 0 fallos; generación
  p50 **154,03 ms**, p95 **221,58 ms** (< 300), máximo 363,72 ms; red p95 **2,42 ms** (≤ 25).
- `pnpm system:cost` — PASS; primer cierre p95 ~183 ms, cierre maduro p95 máximo **50,35 ms**
  (antes 31,55 en V.d.3), transición p95 máxima 48,80 ms. Sigue por debajo del presupuesto de 60 ms
  de D-065, pero el margen se estrecha: V.d.5 debe medir antes de añadir el grafo de servicios.
- `pnpm balance:playable` — PASS; 64 campañas y sin dominancia.

## Deuda y riesgos

- **Coste del cierre mensual.** El valor del suelo añade ~19 ms al p95 maduro (31,55 → 50,35 ms).
  La caché de geometría evita repetir BFS; si V.d.5 introduce el grafo de servicios, la caché por
  firma de topología/facilities/capacidad/presupuesto es obligatoria antes de añadir más trabajo.
- **Aislamiento geométrico.** Las distancias del score son Manhattan sobre la cuadrícula, no rutas
  por la red. Es una señal de valor, no una promesa de accesibilidad; V.d.5 sustituirá la parte de
  servicios por cobertura de grafo.
- **Externalidad industrial.** Se anula en parcelas del propio bloque industrial (aglomeración), y
  penaliza a las residenciales/comerciales cercanas. Si V.d.5 cambia la mezcla de roles, debe
  revisarse.
- **Saves pre-V.d.4.** Un guardado v2 anterior tiene `price` y no tiene `baseLandValue`/`marketValue`;
  se rechaza por nombre (`UNSUPPORTED_URBAN_FABRIC`) y no se migra. El guard v1/v2 anterior sigue
  intacto.
- **Suelo público.** `marketValue` y `baseLandValue` valen 0; el score se calcula sólo para
  marketable y el suelo público no participa en compras, garantías ni impuestos.
- **Fixtures y goldens.** Hashes de distrito y diez digestos regenerados de forma deliberada por la
  nueva escritura canónica del suelo y el cierre mensual.

## Siguiente fase

V.d.5 — servicios espaciales: grafo de viaje con celdas viales, segmentos, gateways y conexiones;
Dijkstra multi-source con costes enteros; caché por firma; cobertura de seguridad, bomberos, salud,
educación, mercado y parques; y overlays de servicio.
