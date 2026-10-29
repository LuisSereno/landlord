# V.d.3 — Ciudad cívica

Fecha: 2026-10-29. Rama: `develop`.

## Alcance ejecutado (PLAN_improvements.md §V.d.3)

1. **Reservas antes de parcelar.** Tras formar la red y las manzanas, `reserveProgramBlocks` elige
   una manzana entera por entrada del programa —la más cercana al centro cívico entre las que tocan
   una celda vial— y sólo después se subdivide el resto. Una manzana sin frente vial no es suelo
   desarrollable: pasa a terreno bloqueado en vez de fallar el distrito entero.
2. **Programa municipal exacto de §4.4.** `municipal-program.ts` declara por receta: 1 ayuntamiento y
   1 plaza en Centro Cívico; 3 escuelas (Lomas, Barrio del Umbral, Vega); 6 parques (Lomas, Barrio del
   Umbral, Vega, Mercado del Norte, Barrio del Taller, Corredor Ferroviario); 2 comisarías (Centro
   Cívico y Barrio del Taller); 2 parques de bomberos (Ensanche Ferroviario Oeste y Patios del Este);
   3 clínicas (Centro Cívico, Barrio del Umbral y Vega); 3 mercados (Centro Cívico, Mercado del Norte
   y Barrio del Taller). Total: **14 equipamientos, 7 espacios públicos, 14 parcelas y 14 edificios
   municipales** por ciudad. Si el programa no cabe, el intento falla y el distrito se regenera; no
   se omite ninguna entrada en silencio.
3. **Parcelas públicas.** Cada equipamiento ocupa una parcela con `disposition: "public"`, precio 0,
   `ownerOrganizationId` del municipio, código urbanístico institucional (comercial para los
   mercados), `currentUses` con su uso primario y frentes viales reales. Las parcelas públicas no
   cuentan para los mínimos dimensionales de la oferta privada, pero sí exigen acceso vial.
4. **Espacios públicos.** Plazas y parques son `PublicSpace` con celdas propias, operador municipal y
   `blockId: null`: ocupan la manzana reservada completa, no terreno decorativo. Toda reserva toca
   una celda vial porque la selección de manzanas lo exige.
5. **Edificios físicos enlazados.** `UrbanFacility` referencia una parcela y un edificio municipales;
   la huella se autocoloca con el mismo `chooseFootprint` que la obra privada (retranqueos, cobertura
   y FAR), con tipo municipal del catálogo, orientación, plantas y forma. El municipio es propietario
   y operador; ninguna empresa puede solicitar permiso o iniciar obra con un tipo municipal.
6. **Validación estructural.** El generador y `SnapshotV2` comprueban: distrito del equipamiento,
   operador existente, parcelas y edificios del mismo distrito, acceso vial, capacidad positiva,
   relación equipamiento↔edificio sin duplicados, espacios públicos conexos y sin solaparse con
   parcelas o vías, y conservación de todas las referencias en save/load.
7. **Suelo público bloqueado.** Compra (`PUBLIC_LAND_NOT_FOR_SALE`), venta
   (`PUBLIC_LAND_NOT_TRANSFERABLE`), garantía (`PUBLIC_LAND_NOT_COLLATERAL`), permiso y obra
   (`PUBLIC_LAND_NOT_BUILDABLE`). La subasta sólo puede ejecutar garantías de préstamos, y una
   parcela pública nunca puede ser garantía, así que queda fuera del circuito sin un comando nuevo.
8. **Render distinto.** El suelo público se pinta como césped y las parcelas municipales llevan
   contorno cívico azul en la capa de propiedad; plazas y patios se pavimentan y parques se pintan
   verdes desde `ViewProjectionV2.publicSpaces`. La parcela vacante, la obra, la parcela construida,
   el jugador y el rival conservan sus superficies y overlays. Los edificios municipales usan sus
   tipos propios del catálogo y el inspector del distrito lista equipamientos y espacios públicos con
   función, capacidad, operador, edificios, parcelas y celdas de acceso vial desde las que V.d.5
   calculará la cobertura.
9. **Sin capability política.** El programa nace del perfil de ciudad; el jugador no coloca
   equipamientos y la proyección filtra las opciones municipales para empresas.

## Gate, criterio por criterio

| Criterio | Resultado | Evidencia |
|---|---|---|
| Ayuntamiento y plaza siempre existen y son alcanzables | PASS | `urban-civic.test.ts` sobre 5 seeds: el ayuntamiento está en Centro Cívico, la plaza existe y toda parcela/espacio público tiene acceso vial; el barrido de 100 seeds/900 distritos genera sin issues |
| Ningún equipamiento obligatorio desaparece por una seed | PASS | conteo exacto 14/7/14/14 en cada seed; el generador falla si el programa queda incompleto y reintenta el distrito |
| Suelo público no es transferible ni hipotecable | PASS | compra, venta, garantía, permiso y obra devuelven códigos públicos específicos; la subasta sólo alcanza garantías privadas |
| El HUD apagado permite localizar centro cívico, parques y áreas institucionales | PASS | captura local con el panel oculto: plaza pavimentada, edificios municipales, contornos cívicos azules y parques verdes desde la proyección |
| Save/load conserva todas las referencias | PASS | round-trip de `SnapshotV2` con 14 facilities y 7 espacios; referencias de operador, parcelas, edificios y espacios validadas |
| Propiedad y operador municipales, nunca una empresa | PASS | parcelas, edificios, facilities y espacios públicos usan `MUNICIPALITY_ORGANIZATION_ID`; la organización existe con `kind: municipality` |
| Sin relación equipamiento↔edificio duplicada | PASS | `SnapshotV2` rechaza un edificio en dos facilities y el generador enlaza 1:1 |

## Verificación ejecutada

- `pnpm lint` — verde (1 warning de `console.log` en el gate de evidencia).
- `pnpm typecheck` — verde en shared, simulation y web.
- `pnpm format:check` — verde.
- Tests: shared **49**, simulation **356** (13 skipped de harnesses opt-in), web **89**.
- `pnpm build` — verde.
- `pnpm smoke:alpha` — verde (su fixture Alpha no contiene programa municipal; valida carga, cambio
  de distrito, cámara y HUD).
- Captura local en navegador con una partida nueva: Centro Cívico muestra 4 equipamientos y 1 plaza,
  el inspector lista Ayuntamiento/Comisaría/Clínica/Mercado con su cobertura futura, y con el panel
  oculto se ven la plaza pavimentada, los edificios municipales y los contornos cívicos azules de las
  parcelas públicas. Sin errores de página.
- `pnpm fabric:gate` — 100 city seeds / **900 distritos**, **73.289 parcelas**, 0 fallos; generación
  p50 **137,49 ms**, p95 **169,54 ms** (< 300), máximo 389,89 ms; derivación vial p95 **2,65 ms**
  (≤ 25); todas las recetas dentro de su envelope.
- `pnpm system:cost` — PASS; cierre mensual maduro p95 máximo **31,55 ms** y transición más costosa
  p95 51,12 ms, sin regresión respecto a V.d.2 (34,30 ms maduro). Sigue por encima del presupuesto
  de D-065 y es deuda de V.d.4.

## Ajustes de jugabilidad declarados

La reserva de manzanas enteras reduce el suelo privado disponible y desplaza la mezcla de roles. El
barrido de 100 seeds midió los máximos reales por distrito: Vega 66,0 % (residencial), Mercado del
Norte 61,5 % (industrial) y Centro Cívico 60,0 % (industrial). Los techos se fijaron sobre esa
medición —Vega 70, Mercado 68, Centro 65— y el resto conserva los valores de V.d.1; Vega declara
mínimo mixto 0 porque su receta verde/baja densidad no produce manzanas mixtas. No se usa un techo
uniforme del 85 %: habría dejado de proteger la mezcla.

## Deuda y riesgos

- **Cobertura por grafo.** El inspector publica las celdas de acceso vial, pero la cobertura real es
  V.d.5. Hasta entonces los servicios siguen con la cobertura radial de D-069 y los edificios
  municipales no participan en ella.
- **Presupuesto municipal.** Los edificios municipales se excluyen de los costes de servicio y del
  stock privado de vivienda/balance para no adelantar reglas de V.d.5. El mantenimiento ordinario de
  los edificios municipales tampoco se cobra todavía de la caja municipal; queda para la fase de
  servicios.
- **Manzanas reservadas.** El programa consume manzanas completas; una futura mejora puede reservar
  superlots parciales para conservar más mezcla privada en distritos con programa denso.
- **Vega sin mixed.** La receta de rol verde/baja densidad no genera manzanas mixtas; el mínimo 0 es
  explícito y no un hueco tolerado. Si V.d.4 cambia la receta, debe revisarse.
- **Saves pre-V.d.3.** Un guardado v2 anterior a esta fase carga con `facilities: []` y sin parcelas
  públicas: no se regenera el programa municipal sobre una ciudad ya guardada. No hay migración; para
  jugar con el programa cívico hay que empezar partida nueva. El guard `UNSUPPORTED_URBAN_FABRIC`
  sigue rechazando las formas pre-V.d.2.
- **Fixtures y goldens.** Regenerados de forma deliberada por el programa municipal, la nueva
  geometría de reservas y la economía de escenario.

## Siguiente fase

V.d.4 — densidad, skyline y valor del suelo: score entero por parcela, altura automática desde
código/valor/tipo, skyline y precios de suelo.
