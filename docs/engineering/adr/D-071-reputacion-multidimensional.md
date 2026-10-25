# D-071 — Reputación multidimensional con tres grupos y memoria de hechos

Estado: **Aceptada**, con un punto **parcialmente superseded** desde 2026-10-25
Fecha: 2026-10-24

> **Superseded parcialmente por D-075 (WP4.11-H) y D-076 (WP4.11-H.1).** `households_displaced` pasó de
> `banks +1` a `banks 0`, y la tabla vigente es `residents -3 / municipality -1 / banks 0`: sin
> decaimiento en la valoración bancaria, desalojar repetidamente construía un descuento permanente del
> préstamo, o sea un exploit de financiación, y ningún hecho del motor demostraba que el banco viera
> mejor a un casero que desahucia. Se añade aquí, no se reescribe la decisión original. La premisa de
> fondo sigue viva y probada —un mismo hecho puntúa distinto por grupo (`contract_completed`,
> `loan_defaulted`, `violent_sabotage`, víctimas frente a cumplimiento)—; lo que ya no existe es el
> cruce concreto "desalojo sube la nota bancaria". La documentación que afirme ese cruce está obsoleta.

## Contexto

WP4.8 (`docs/execution/05-fase-4-alpha-sistemica.md`) pide elegir grupos o dimensiones con efecto
real y evitar una puntuación universal; registrar los hechos relevantes como entradas de memoria
acotada; definir decaimiento sólo donde tenga sentido y sea testeable; conectar la reputación con
financiación, tenants, gobierno o facciones; separar hecho, percepción e información disponible; y
probar que un mismo actor es valorado de forma distinta por grupos distintos. La aceptación exige que
una acción pueda mejorar la reputación con un grupo y empeorarla con otro.

`docs/product/08-fiscality-operations-and-public-economy.md` enumeraba ocho reputaciones
(ciudadanos, empresarios, gobierno, policía, bancos, sindicatos, criminales, medios). Hasta ahora el
juego sólo tenía dos piezas cercanas: el `heat` policial, que gobierna la atención de la policía, y
los contadores de fiabilidad de WP4.7 (`awarded`/`completed`/`defaulted`), que nadie consumía. Sin
hechos ni memoria, cualquier "reputación" habría sido una barra decorativa.

## Decisión

1. **Tres grupos con efecto cableado, no ocho barras.** `residents`, `municipality` y `banks`. Cada
   uno mueve una palanca ya existente y observable: la banca fija el tipo del préstamo, los residentes
   castigan o premian la deseabilidad del parque de ese casero, y el gobierno deposita influencia al
   cerrar el mes. Un grupo sin salida medible queda fuera hasta que tenga consecuencia.
2. **La unidad de memoria es el hecho, no la puntuación.** `ReputationFact` guarda `kind`, `atTick`,
   `referenceId`, `magnitude` y el `deltaByGroup` realmente aplicado. La posición por grupo es un
   acumulado derivado, limitado a ±100 y con un máximo de 16 hechos por organización: la memoria no
   crece sin cota.
3. **Ocho clases de hecho con valoración propia por grupo.** Cumplimiento e incumplimiento de
   contrato, hogares desplazados, víctimas, deuda fiscal, abandono de mantenimiento, impago de préstamo
   y préstamo saldado. El mismo hecho puntúa distinto: desplazar un hogar resta 3 ante los vecinos, 1
   ante el gobierno y suma 1 ante la banca. *(Sustituido por D-075: la banca quedó en 0.)*
4. **El decaimiento sólo existe donde la opinión es opinión.** Vecinos 3/mes, gobierno 2/mes, banca 0.
   Un impago crediticio no se borra con el tiempo: se compensa con otro hecho.
5. **Las tablas de efecto son neutras en posición 0** (recargo 0 pb, factor 100 %, +1 de influencia).
   El WP no mueve la economía salvo que un hecho real altere la posición, y eso es comprobable.
6. **Los hechos los registran los sistemas que ya observaban el suceso**, no un sensor nuevo: el
   desalojo forzado en `collectRentAndAgeLeases`, la víctima del colapso en `systems.ts`, el impago y
   la amortización en `processLoanPayments`, el cumplimiento en `public-contracts.ts`, y la deuda fiscal
   con el abandono de mantenimiento al cierre mensual de `runReputation`.
7. **Orden determinista: `reputation` después de `housing` y antes de `contracts`.** Cierra el mes con
   los impagos y el abandono ya observados y devuelve la influencia antes de la licitación, para que
   ninguna organización puje con la influencia del mes anterior.
8. **Hecho, percepción e información disponible quedan separados.** El estado autoritativo tiene la
   posición de todas las organizaciones; `describeReputation` sólo informa del jugador y la proyección
   no publica datos del rival. WP4.9 decidirá qué es público, inferido o privado.
9. **Mismas reglas para el jugador y la IA.** El depósito mensual de influencia se aplica a toda
   organización de tipo `company`; el rival sufre y beneficia las mismas valoraciones sin atajos.
10. **Persistencia aditiva.** `phase2.reputation` es opcional en el schema: una partida anterior se
    restaura con el estado inicial vacío.

## Alternativas consideradas

- **Las ocho reputaciones del documento de producto.** Descartada: cinco de ellas no tienen todavía
    ninguna salida en el modelo y habrían sido decorativas, justo lo que el WP prohíbe. Se añaden
    cuando exista el canal que las consuma (policía → riesgo táctico, medios → percepción en WP4.9).
- **Una única barra de "reputación"**. Descartada: la aceptación exige valoraciones contrapuestas; una
    barra no puede simultanear "buen pagador" y "mal casero".
- **Decaimiento exponencial generalizado.** Descartada: borrar el historial crediticio con el tiempo
    premia el impago lejano. El decaimiento se limita a la opinión pública y municipal.
- **Reutilizar `heat` como reputación.** Descartada: `heat` mide atención policial sobre el distrito,
    no la opinión de tres grupos sobre una organización; duplicarlo mezclaría dos preguntas distintas.
- **Dar efecto a la reputación en el precio del suelo o en los contratos directamente.** Descartada
    para este WP: la adjudicación ya es al menor postor y el precio del suelo lo fija el mercado;
    añadir otra corrección ahora haría imposible atribuir el cambio en los digestos dorados.
- **Extender `canonicalizeState` a los agregados de WP4.3–WP4.8 y regenerar los diez digestos.**
    Descartada dentro de este WP: reescribiría toda la línea base por un motivo ajeno. Se regeneran
    sólo los dos casos que cambian por la influencia mensual, con nota en la cabecera del test.

## Alcance

Incluido:

- `packages/simulation/src/reputation.ts`: grupos, política, hechos, decaimiento, tres tablas de
  efecto, registro y reporte;
- `ReputationFact` / `ReputationState` en `packages/shared/src/domain.ts` y `phase2.reputation`
  opcional en `snapshot.ts`, con serialización y migración aditiva;
- llamada a `recordReputationFact` desde `systems.ts` (desalojos, víctimas, préstamos) y
  `public-contracts.ts` (cumplimiento e incumplimiento);
- sistema `reputation` en `PRODUCT_SYSTEMS` entre `housing` y `contracts`;
- efectos: recargo de tipo en `RequestLoan` (`commands.ts`) y factor del casero en `desirabilityOf`
  (`housing-market.ts`), más el depósito de influencia en `runReputation`;
- bloque `reputation` en la proyección y en el panel de `apps/web/src/App.tsx`;
- nueve pruebas en `reputation.test.ts` y la regeneración documentada de dos digestos dorados.

No incluido:

- grupos de empresarios, policía, sindicatos, criminales y medios;
- relaciones entre organizaciones (no hay par de "quién mira a quién", sólo grupo → organización);
- información imperfecta, estimaciones con precisión y antigüedad (WP4.9);
- interfaz de gestión de reputación, objetivos de facción y planificador (WP4.10);
- campañas electorales o aprobación popular (WP4.11).

## Consecuencias

### Positivas

- La aceptación del WP se comprueba en el propio modelo: un desalojo suma ante la banca y resta ante
  los vecinos y el gobierno. *(Leída hoy: la prueba sigue siendo que un mismo hecho puntúa distinto por
  grupo; el grupo que suma ya no es la banca ante el desalojo, ver el aviso al inicio de esta decisión.)*
- Tres canales reales de consecuencia —crédito, deseo de mudarse e influencia política— sin inventar
  nuevos subsistemas. La economía no se mueve por reputación hasta que hay un hecho real: los digestos
  sólo cambian por la influencia mensual.
- El historial es auditable: cada hecho guarda el delta aplicado, así que el panel puede explicar por
  qué cambió la opinión.
- Ninguna organización necesita un registro nuevo para sentir la reputación: préstamo, mercado de
  vivienda, influencia y contratos ya leían el estado.

### Costes

- Con tres grupos, la reputación ante el crimen, los medios o la policía sigue sin existir; si Fase 4
  los pide, habrá que añadir el canal y su tabla de efectos, no sólo la barra.
- La memoria acotada a 16 hechos por organización puede borrar historia antigua en partidas largas;
  la posición acumulada sobrevive, el detalle no.
- Umbral y magnitudes (decaimientos, topes, recargos y factores) son grados de libertad sin
  herramienta de barrido.
- El depósito de influencia cambia dos digestos dorados en cada regeneración futura del agregado; la
  prueba de determinancia del WP compara el snapshot completo porque `canonicalizeState` sigue ciego a
  `reputation`.

## Evidencia requerida

- `packages/simulation/src/reputation.ts` y `reputation.test.ts`.
- `packages/shared/src/domain.ts`, `snapshot.ts` y `projection.ts`.
- `packages/simulation/src/state.ts`, `snapshot.ts`, `systems.ts`, `commands.ts`,
  `public-contracts.ts`, `housing-market.ts` y `projection.ts`.
- `apps/web/src/App.tsx`: bloque de reputación.
- Acta `docs/execution/phase-4/wp4-8-reputation-2026-10-24.md`.
