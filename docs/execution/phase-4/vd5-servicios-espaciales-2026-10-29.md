# V.d.5 — Servicios espaciales

Fecha: 2026-10-29. Rama: `develop`.

## Alcance ejecutado (PLAN_improvements.md §V.d.5)

1. **Grafo de viaje de ciudad.** `facility-coverage.ts` construye un grafo con las celdas viales de
   los nueve distritos, sus segmentos (avenida coste 1, calle 2), los gateways y las conexiones de
   `CityProfile`. Los nodos son celdas viales; un gateway sin conexión no es un cruce gratuito.
   Bomberos, policía, salud, educación y mercado entran por las celdas viales adyacentes al frente
   de su parcela; nunca se atraviesa suelo, obstáculo ni espacio público.
2. **Dijkstra multi-source con costes enteros.** Cada facility es una fuente con coste 0; la
   distancia a una parcela es la mínima sobre sus celdas de acceso. La demanda se asigna a la
   facility alcanzable de menor coste y, en empate, a la de ID menor.
3. **Capacidad y presupuesto.** Una unidad de capacidad declarada cubre 25 parcelas
   (`DEMAND_UNITS_PER_CAPACITY`); la calidad presupuestaria municipal multiplica la capacidad
   efectiva (`floor(capacidad × nivel / 100) × 25`). Una facility saturada sirve sólo las parcelas
   más cercanas y publica `demand`, `served`, `effectiveCapacity`, `coveragePercent` y `saturated`.
   No se crea una tesorería por distrito ni un coste monetario artificial por atención.
4. **Caché por firma.** La geometría (red, facilities, capacidades, gateways, accesos de parcela) y
   el presupuesto se cachean por separado en `WeakMap` por estado. Un cambio de nivel de servicio
   invalida la asignación de capacidad, no los Dijkstra; un cambio espacial invalida ambos. Un
   tick que no cambia ninguna de las dos firmas reutiliza el índice.
5. **Seguridad y transporte.** La seguridad sale de comisarías por el grafo y sustituye el radio
   desde el centroide. El transporte es accesibilidad a gateways abiertos por la red, no un radio
   desde una estación. Limpieza sigue siendo la red radial municipal sin edificio operativo y
   administración no usa cobertura: son las excepciones declaradas en D-092.
6. **Bomberos y salud.** `fireDamageForBuilding` es el único helper del sistema de incendios:
   reduce la progresión de intensidad y el daño estructural según cobertura de bomberos.
   `injuredRecoveryDays` es el único helper de recuperación: un distrito con cobertura sanitaria
   ≥ 50 % recupera en un día en vez de dos.
7. **Amenidades.** Educación y parques se suman a la calidad de la vivienda; mercado se suma a sus
   servicios; el valor del suelo ya incorpora equipamientos y espacios públicos en `civicAmenities`.
8. **Proyección y overlays.** Cada parcela publica `serviceCoverage` (transporte, seguridad,
   bomberos, salud, educación, mercado y parques); el inspector de equipamiento publica su demanda,
   capacidad efectiva, cobertura y saturación. Las capas de mapa añaden seguridad, bomberos, salud,
   educación, transporte y valor del suelo, además de las existentes.

## Gate, criterio por criterio

| Criterio | Resultado | Evidencia |
|---|---|---|
| Las rutas cruzan gateways y nunca atraviesan obstáculos | PASS | `facility-coverage.test.ts`: una parcela de Ensanche Oeste recibe cobertura de parques desde otro distrito por gateway; sin frente vial su cobertura es 0 |
| Cerrar un gateway empeora sólo las coberturas dependientes | PASS | al retirar las conexiones de Ensanche Oeste, su cobertura de parques cae a 0 y la de Barrio del Umbral no cambia |
| Capacidad saturada produce cobertura parcial explicable | PASS | informes de facility con `demand > effectiveCapacity`, `saturated: true` y `coveragePercent < 100`; asignación determinista por coste e ID |
| Recorte presupuestario reduce capacidad sin dinero implícito | PASS | seguridad a 0 deja `effectiveCapacity` 0 y cobertura 0, sin borrar el edificio ni mover caja |
| Incendio, lesión, vivienda y valor consumen un único helper por servicio | PASS | `fireDamageForBuilding` en el bucle de incendios; `injuredRecoveryDays` en `hurtAgent`; vivienda y valor leen el mismo índice de cobertura |
| Invariancia ante orden de Maps/arrays | PASS | invertir parcelas, facilities y espacios públicos produce el mismo `byParcelId` |
| Benchmark equivalente sin regresión superior al 25 % | PASS | cierre maduro p95 **43,30 ms** (V.d.4: 50,35) y transición p95 **46,11 ms** (V.d.4: 48,80); el primer cierre incluye la construcción única del grafo (p95 ~312 ms) y se registra como coste de arranque |
| No implementar LOD si los umbrales D-052/D-065 siguen cumpliéndose | PASS | cierre maduro por debajo de 60 ms; no se añade LOD |

## Verificación ejecutada

- `pnpm lint` — verde (1 warning de `console.log` en el gate de evidencia).
- `pnpm typecheck` — verde en shared, simulation y web.
- `pnpm format:check` — verde.
- Tests: shared **49**, simulation **376** (13 skipped de harnesses opt-in), web **89**.
- `pnpm build` — verde.
- `pnpm smoke:alpha` — verde.
- `pnpm system:cost` — PASS; primer cierre p95 máximo ~312 ms (construcción única del grafo),
  cierre maduro p95 máximo **43,30 ms**, transición p95 máxima **46,11 ms**. Sin regresión en
  régimen estacionario; el arranque frío queda como deuda de presentación/carga.
- `pnpm balance:playable` — PASS; 64 campañas y ninguna estrategia domina.

## Decisiones de implementación declaradas

- **Cohorte de capacidad.** Las capacidades autoradas (1–6) son unidades de servicio, no parcelas
  individuales; una unidad cubre 25 parcelas. Es una constante explícita para que la saturación sea
  explicable y para que una comisaría/bomberos no quede reducida a dos edificios. Si V.d.6 cambia
  la densidad, debe revisarse.
- **Cobertura binaria por parcela.** Una parcela servida recibe 100 y una no servida 0; la
  parcialidad se publica por facility (`served/demand`). Es más legible que un porcentaje continuo
  y conserva la asignación estable por coste.
- **Umbral de parques.** Un parque cubre hasta coste de viaje 40; el transporte cubre gateways
  abiertos hasta coste 90. Son umbrales de servicio, no radios geométricos.
- **Servicios y presupuesto.** Seguridad y bomberos usan el nivel `security`; salud, educación y
  mercado usan `administration`; parques usan `cleaning`. No se añaden categorías de gasto ni una
  caja por distrito.

## Deuda y riesgos

- **Arranque frío del grafo.** El primer cierre de una partida construye 14 Dijkstra y los mapas de
  accesos: p95 ~312 ms una vez. Los cierres siguientes reutilizan la caché. Si el hitch es visible,
  V.d.6 debe precargar el grafo o mover su construcción fuera del cierre.
- **Grafo de celdas.** El coste es por celda vial, no por longitud de segmento: una avenida de 10
  celdas cuesta 10. Es coherente con la escala de 4 m/celda, pero V.d.6 puede introducir peajes por
  segmento si el benchmark lo exige.
- **Capacidad en cohortes.** La constante 25 es una decisión de producto; los valores autorados de
  V.d.3 no distinguían plazas de hogares. Cualquier rebalanceo de facilities debe conservar la
  relación capacidad→cobertura.
- **Cobertura de valor y vivienda.** Educación/parques/market entran como suma acotada en calidad y
  servicios; no sustituyen el score de valor del suelo, que sigue midiendo distancia y código.
- **Sin persistencia.** La cobertura es derivada y no se guarda; un save/load reconstruye la caché.
  El snapshot no cambia de forma en V.d.5.

## Siguiente fase

V.d.6 — presentación y dressing contextual: adapter para parcelas multi-cell/manzanas/roles/
espacios públicos/huellas/facilities, manifest V2, assets cívicos, dressing determinista y capturas
golden de ciudad, centro cívico, residencial, industria, servicio saturado y ordenanza de densidad.
