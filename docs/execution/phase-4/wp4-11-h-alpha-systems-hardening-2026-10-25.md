# WP4.11-H — Alpha systems hardening

## Estado

`DONE` con la deuda y el aviso de rendimiento de este documento.

## Baseline

- HEAD inicial: `4374c97c9895d4616f6de07c6544ad0dafe396e0`
  (`feat: close wp4.11 municipal politics with elected council`).
- HEAD final: el commit de cierre de este checkpoint (ver `git log`).
- Se actualizaron las referencias remotas antes de tocar código: `origin/main` estaba exactamente en
  `4374c97`, sin commits posteriores. Ninguno de los hallazgos estaba corregido por trabajo ajeno.
- WPs afectados: WP4.2 (harness de coste), WP4.7–WP4.11 (persistencia, información, facciones,
  política), UI de Gate 2/Alpha y CI del repositorio.

## Findings

### P1 — El censo electoral incluía inquilinos fantasma

- **Finding:** `holdElection()` recorría `state.phase2.tenants.values()` sin filtrar.
- **Impacto:** votaban `available`, `displaced` y hogares con un `activeContractBuildingId` que ya no
  existía. Los desplazados no se borran nunca, así que votaban para siempre e inflaban la
  participación tras cada colapso.
- **Causa raíz:** el censo se escribió como "todos los tenants" antes de que WP4.3 introdujera estados
  de hogar.
- **Fix:** `eligibleVoters(state)` exige contrato vigente y edificio existente.
- **Tests:** censo sólo con residentes; 20 desplazados no cambian el padrón; colapso total deja censo
  vacío y participación 0; misma seed y padrón dan el mismo resultado; reparto con electorado mixto.

### P1 — El eje fiscal no veía la tasa de servicios

- **Finding:** `taxesMood()` leía `revenueThisMonthBySource.serviceFee`, pero `politics` cierra antes
  que `municipal`, que es quien devenga la tasa y la vuelve a cero.
- **Impacto:** el ingreso más elástico del municipio no contaba para la opinión; recortar el servicio
  no se leía como carga.
- **Causa raíz:** orden del tick (`politics` antes que `municipal`) más lectura del acumulado en vez
  del devengo.
- **Fix:** `taxesMood` suma `municipalServiceFee(state)`, la misma función pura que cobra el
  presupuesto, y no lee el acumulado.
- **Tests:** con propiedad, transferencias y renta constantes, subir las unidades ocupadas empeora el
  ánimo; sin tasa no inventa carga; un cierre cobra exactamente una vez; save/load conserva la señal.

### P1 — `canonicalizeState` ignoraba siete agregados

- **Finding:** el digesto omitía `employment`, `municipal`, `housingMarket`, `contracts`, `reputation`,
  `intelligence` y `factions`; tampoco incluía `crews`, `incidents`, `phase2.idCounters` ni
  `pendingCommands`, y `balances`/`inventories`/influencia perdían el id.
- **Impacto:** dos partidas con distinta economía podían producir el mismo digesto; el save/load no
  era comparable en cadena.
- **Causa raíz:** cada WP evitó ampliar el digesto para no regenerar goldens.
- **Fix:** superficie completa, entradas con id y ordenación recursiva de claves. `JSON.stringify`
  directo ya no decide el resultado.
- **Tests:** restaurado === original por cadena; alterar cada agregado cambia el digesto; reordenar
  maps/records no lo cambia; misma seed y meses dan la misma cadena; continuación determinista.

### P1 — Benchmarks mensuales medidos en el warmup

- **Finding:** la ventana `month` empezaba en `GAME_MONTH_TICKS − 3` y después consumía 60 ticks de
  warmup, de modo que el cierre de 36000 ocurría antes de la medición.
- **Impacto:** los sistemas mensuales (vivienda, política, presupuesto, facciones) no se estaban
  midiendo.
- **Causa raíz:** el warmup se ejecutaba después de posicionar el reloj.
- **Fix:** `warmupStartTick` coloca el reloj antes del warmup; la ventana medida empieza donde acaba.
- **Tests:** la ventana `month` cruza el cierre; `politics.lastMoodTick` y
  `municipal.lastSettlementTick` valen el tick del cierre dentro de la sección medida.

### P1 — Fuga de razonamiento del rival

- **Finding:** la proyección publicaba `rival.lastAction` y `rival.lastReason`.
- **Impacto:** el jugador recibía gratis la intención privada que WP4.9 hace pagar como estimación.
- **Causa raíz:** el campo se añadió en Gate 2 como diagnóstico y sobrevivió a la política de
  información.
- **Fix:** fuera de la proyección; sólo huella observable.
- **Tests:** un centinela en `lastReason`/`lastAction` no aparece en la proyección; tampoco perfil,
  postura, caja, deuda, reputación ni influencia privadas.

### P2 — Acciones de dominio sin UI

- **Finding:** `SubmitPublicBid` y `CommissionIntelligence` existían en dominio y dispatcher, pero no
  en el cliente ni en la pantalla.
- **Fix:** métodos de cliente, formulario de oferta con presupuesto/fianza/oferta actual y botones de
  encargo con coste/cooldown/precisión; sin reglas económicas en React.
- **Tests:** forma de los comandos en el cliente; runtime end-to-end con aceptación, fianza cobrada y
  estimación publicada; smoke de navegador.

### P2 — UI municipal obsoleta y concejo invisible

- **Finding:** `App.tsx` leía `plannedByCategory.services` y `serviceLevelPercentByCategory.services`.
- **Fix:** administración, seguridad, transporte y limpieza, individuales y sumadas; panel mínimo del
  concejo con gobernante, escaños, apoyo, participación, ánimo y próximas citas.
- **Tests:** smoke Alpha sobre el DOM.

### P2 — Ordenanza activa re-sorteada y duración mágica

- **Finding:** si la ley activa era la preferida del gobierno, el debate volvía a sortearla y podía
  reemplazarla por `rejected`; el lobby usaba `24_000` ticks y el concejo seis meses.
- **Fix:** una ley activa no se vuelve a sortear y se reprograma a su caducidad; una sola
  `MUNICIPAL_POLICY_DURATION_TICKS` para ambos caminos.
- **Tests:** misma ley activa sigue activa; otra se pospone; rechazada no bloquea; lobby y concejo
  producen la misma duración buscando semillas hasta que ambos aprueban.

### P2 — Queja por desplazamiento inconsistente

- **Finding:** el desplazado pesaba 2 puntos fijos con hogares contratados y 2×3 sin ellos, sin
  normalizar por población.
- **Fix:** proporción `displaced / (contracted + displaced) × 100` puntos de queja, sin rama especial.
- **Tests:** 1 de 2 pesa más que 1 de 100; cero desplazados no castiga; rango 0…100.

### P2 — Víctimas sin autor y exploit bancario

- **Finding:** un sabotaje con muertos sólo penalizaba al propietario; además la banca premiaba cada
  desalojo con +1 sin decaimiento.
- **Fix:** hecho `violent_sabotage` para el atacante distinto del dueño y banca neutral ante
  `households_displaced`.
- **Tests:** atribución, no duplicación, cero víctimas sin hecho; campaña de 12 meses de desalojos sin
  mejora del tipo bancario.

### P2 — Documentación que sobreafirmaba WP4.10

- **Finding:** WP4.9 anunciaba que WP4.10 daría a las facciones su propio expediente; WP4.10 no lo
  hizo y el acta lo declaraba deuda, pero `PROJECT-STATE` y `KNOWN-GAPS` seguían mezclando sistemas
  implementados con conceptuales.
- **Fix:** notas de hardening en WP4.9/WP4.10, distinción Implemented/Partial/Conceptual en
  `PROJECT-STATE`, limpieza de `KNOWN-GAPS`, `PRODUCT_SYSTEMS` exacto en `ARCHITECTURE`.

## Canonical state

Agregados añadidos: `phase2.idCounters`, `pendingCommands`, `crews`, `incidents`, `employment`,
`municipal`, `housingMarket`, `contracts`, `reputation`, `intelligence`, `factions`; entradas con id en
`balances`, `inventories` e influencia; ordenación recursiva de claves.

Los diez digestos dorados cambian. **Atribución verificada:** serializando los mismos estados con la
superficie canónica anterior se recuperan exactamente los diez valores de WP4.11:

| Caso | Antes | Ahora |
| --- | --- | --- |
| `scenario:seed-1:1200` | `cbfb3f7c51f0233c` | `3112921f3895fda7` |
| `scenario:seed-7:1200` | `ab1719956d062dac` | `f896686c9cd189a1` |
| `scenario:seed-42:1200` | `55cd7cc60cd9c651` | `5d3bb2ce7c992fee` |
| `scenario:seed-1:36000` | `09ba274d438311f3` | `0dc2c0afcbb37013` |
| `city:50-parcels:1300-ticks` | `bf1ac7fb74da8b89` | `aa6df9560bd75329` |
| `city:50-parcels:month-boundary` | `8cd19ed973a256a1` | `b9265816025c4329` |
| `city:200-parcels:month-boundary` | `ffaabc2525434a22` | `2d8810d5599ad182` |
| `city:50-parcels:fire-cascade` | `1269681c889cb606` | `e1fc003eb7af4c9a` |
| `city:200-parcels:fire-cascade` | `95489f25a3251d3a` | `91fa9ad9c89a0116` |
| `city:800-parcels:fire-cascade` | `cb47c7206fe65ef0` | `ba411bbd904a5d19` |

Ninguna caja, transacción, baja, desplazamiento ni decisión cambió en esos escenarios: el delta es
superficie canónica, no una modificación económica silenciosa.

## Performance

Benchmark `pnpm system:cost` (seed 7, 18 sistemas, ventana `month` cruzando el cierre):

| Escala | Ventana | tick medio | p95 | máximo | Sistemas dominantes |
| --- | --- | --- | --- | --- | --- |
| 50 parcelas | day | 0,007 ms | 0,017 ms | — | tactical 15,7 % · rival 8,9 % |
| 50 parcelas | month | 0,411 ms | 2,414 ms | — | housing 28,5 % · rival 20,0 % |
| 50 parcelas | fire | 0,009 ms | 0,015 ms | — | tactical 36,2 % |
| 200 parcelas | day | 0,018 ms | 0,042 ms | — | insurance 34,3 % · tactical 21,8 % |
| 200 parcelas | month | 1,206 ms | 7,128 ms | — | housing 35,3 % · factions 14,0 % |
| 200 parcelas | fire | 0,017 ms | 0,040 ms | — | tactical 38,5 % |
| 800 parcelas | day | 0,048 ms | 0,109 ms | 1,66 ms | insurance 54,1 % · tactical 28,7 % |
| 800 parcelas | month | **4,766 ms** | **28,385 ms** | **28,385 ms** | housing **65,1 %** · rent 9,8 % |
| 800 parcelas | fire | 0,063 ms | 0,134 ms | 1,66 ms | insurance 49,9 % · tactical 33,8 % |

El tick estable de día sigue dos órdenes de magnitud por debajo del presupuesto p95 de 10 ms
(0,109 ms al 800). **El cierre mensual cruza por primera vez el presupuesto de la ventana `month`**
(28,4 ms de p95, 42,8 ms instrumentado) y el disparador de revisión de 5 ms de D-065, aunque queda por
debajo del límite duro de 50 ms. No se implementa LOD: está fuera del alcance de este checkpoint. Se
recomienda optimizar `runHousingMarket` antes de WP4.13 y volver a medir.

## Persistencia

Referencias nuevas validadas en `shared`:

- contratos: adjudicatario, ofertas (empresa existente) y claves de fiabilidad;
- reputación: claves de posición y de hechos;
- inteligencia: observador (empresa), claves de sujeto y coherencia sujeto/clave;
- facciones: perfiles, memoria, contadores y ambos extremos de cada `observador>sujeto`.

Validación semántica en `simulation` al restaurar: partido gobernante y claves de escaños/apoyo dentro
del catálogo. Los saves anteriores siguen cargando porque todos los agregados son opcionales y caen a
los valores por defecto.

## UI

- oferta pública accionable con presupuesto, fianza y oferta actual;
- inteligencia accionable con coste, cooldown, fuente, valor, precisión y antigüedad;
- categorías municipales correctas (administración, seguridad, transporte, limpieza);
- panel mínimo del concejo visible;
- `lastReason` privado ausente del DOM;
- save/load sigue funcionando en IndexedDB.

## CI

Ejecutado en este checkpoint:

```text
format:check   PASS (todo el repo, 13 ficheros formateados)
lint           PASS (eslint + arquitectura; blender_artist/toolchain excluido)
typecheck      PASS (shared, simulation, web)
test           PASS (241+ pruebas; goldens regenerados)
build          PASS
smoke:phase2   PASS (caja 5228 u. intacta)
smoke:alpha    PASS (concejo, oferta, inteligencia, caja 49 850 u., sin razones privadas)
system:cost    PASS (tabla anterior)
```

El workflow de CI gana el paso `pnpm smoke:alpha`. El remoto queda pendiente de verificación tras el
push.

## Remaining debt

- **Cierre mensual por encima del presupuesto p95** en 800 parcelas: 28,4 ms, con `housing` como 65 %.
  Disparador de D-065 alcanzado; LOD no implementado por alcance. Optimización específica pendiente.
- **Tuning del modelo político:** 15 números elegidos a mano; distritos monocultivo barren 9-0; sin
  barrido de parámetros.
- **Servicios leídos con un mes de retardo** por el orden del tick (decisión semántica, no bug).
- **No hay candidatos** ni renovación legislativa compleja; el concejo es una institución de datos.
- **El registro de accesos de WP4.9 no es un interceptor:** sigue siendo un contrato declarado.
- **El expediente de inteligencia de las facciones sigue diferido**, igual que las facciones
  autónomas múltiples y el planificador de largo horizonte.
- **Commuting agregado**, arte/pipeline Alpha y playtest instrumentado (D-063) siguen abiertos.
- **Los desplazados no se re-alojan ni expiran:** el censo ya no los cuenta, pero su ciclo de vida
  sigue siendo deuda de diseño.
- **El fixture del smoke Alpha es un snapshot versionado** de 160 KB; si el formato cambia hay que
  regenerarlo junto con los goldens.

## Fuera de alcance

WP4.12 y cualquier macroshock; LOD nuevo; planificador; life simulation; perspectivas jugables;
nuevos grupos de reputación, partidos o candidatos; corrupción; backend; multijugador.
