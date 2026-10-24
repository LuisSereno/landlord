# D-072 — Información imperfecta: registro de accesos y expediente de estimaciones

Estado: **Aceptada**
Fecha: 2026-10-24

## Contexto

WP4.9 (`docs/execution/05-fase-4-alpha-sistemica.md`) pide clasificar los datos en públicos, propios,
inferidos y privados; definir un `information scope` sin montar todavía la interfaz multirol; crear
mecanismos limitados de análisis, contactos e investigación; representar la precisión y la antigüedad
de las estimaciones; evitar que la IA y la interfaz lean el estado autoritativo completo; y probar que
no hay filtraciones ni datos privados en las proyecciones.

Hasta aquí todo lector del motor veía lo mismo que el estado: la proyección publicaba la caja y las
ofertas del jugador, `rivalAction` (`systems.ts`) elegía sus candidatos leyendo directamente los
edificios, las parcelas y las tesorerías de todo el mapa, y el panel del rival ya decía "caja y
contratos privados" sin que ninguna regla lo garantizara. No existía ningún mecanismo para saber algo
del rival pagando por ello, y la reputación de WP4.8 guardaba las posiciones de todas las
organizaciones en el mismo saco.

## Decisión

1. **Cuatro accesos y un registro, no banderas por campo.** `public`, `own`, `inferred` y `private`
   se declaran en `INFORMATION_POLICY.scopeByObservable` sobre un nombre de observable (`~34 claves`),
   no sobre las entidades. El mismo número cambia de acceso según de quién sea: la caja propia es
   `own`, la del rival `private` y su versión estimada `inferred`.
2. **El registro es documentación ejecutable, no un filtro automático.** Ninguna lectura pasa por él
   todavía; lo que impide la filtración es la forma del reporte y las pruebas de fuga y de invariancia.
   Un filtro genérico sobre el estado habría sido un mecanismo de seguridad sin lista de qué protege.
3. **La verdad privada se lee en un único sitio.** `trueValueFor(state, subject, kind)` es el único
   lector autorizado, y sólo lo llaman el generador de estimaciones y las pruebas. `describeIntelligence`
   y la proyección no pueden llamarlo: si lo hicieran, el expediente sería el estado.
4. **Estimación, no copia.** Una `IntelligenceEstimate` guarda `subjectOrganizationId`, `kind`,
   `source`, `value`, `accuracyPercent` y `atTick`. La cifra verdadeira no se almacena en el expediente,
   así que no puede escapar por serialización ni por proyección.
5. **Cuatro cifras que valen una decisión**: caja disponible, deuda viva, impuestos adeudados y puja
   prevista en la próxima licitación. Todas en unidades de dinero y todas conectadas a una decisión ya
   existente (pedir o refinanciar préstamo, pujar o no por una obra, aguantar la deuda fiscal). Quedan
   fuera el número de edificios y de parcelas del rival porque ya son públicos.
6. **Dos canales con precio distinto.** `contacts` es caro (150 u.), exacto (±6…±12 % según la cifra) y
   se enfría un mes. `market` es gratis, torpe (±25…±50 %) y sólo re-basa entradas que ya estaban en el
   expediente y que llevan tres meses sin refrescarse: el jugador que no pregunta no aprende nada nuevo.
7. **La precisión caduca y la entrada no se borra.** La eficacia declarada baja 2 puntos por mes hasta
   un suelo del 5 %. Un dato viejo sigue siendo una hipótesis útil, no ruido; y el archivo queda acotado
   a una entrada por sujeto y clase.
8. **Un expediente por observador.** `phase2.intelligence.observerOrganizationId` fija de quién es el
   expediente y `CommissionIntelligence` exige que la organización que actúa sea esa (`INTEL_NOT_OBSERVER`).
   No se asume jugador == empresa: el mando valida persona, organización y propiedad del archivo.
   La IA rival no tiene expediente; lo tendrá en WP4.10 como observador propio, no leyendo el estado.
9. **Arroyo de PRNG separado.** El ruido de estimación sale de `intelligence.prng`, nunca del arroyo
   económico de la partida. La consecuencia es comprobable: encargar o no encargar inteligencia no
   mueve el `state.prng` ni ninguno de los diez digestos dorados.
10. **El expediente no es entrada de ninguna regla.** Ningún sistema lo lee. Se comprueba envenenando
    las estimaciones de una partida auto-jugada y verificando que el libro de transacciones sale
    idéntico: leer mal el mundo no cambia el mundo. Hoy esto es una garantía; cuando WP4.10 dé a las
    facciones información parcial, la entrada será su propio expediente con el mismo contrato.
11. **Persistencia aditiva.** `phase2.intelligence` es opcional en el snapshot: una partida anterior se
    restaura con el expediente vacío generado a partir de su `seed`.

## Alternativas consideradas

- **Dejar que la IA siga leyendo el estado completo y filtrar sólo la interfaz.** Descartada: la fuga
  sería estructural. El rival que conoce la caja del jugador no está tomando una decisión más lista,
  está jugando con los naipes abiertos, y nada en el código lo impediría al añadir la siguiente regla.
- **Guardar la verdad junto al error y calcular la estimación al mostrar.** Descartada: la proyección
  tendría que leer el estado privado para restar el error, que es justo lo que el WP prohíbe.
- **Una marca `informationScope` en cada campo de dominio.** Descartada: tocaría todos los tipos,
  repartiría la política por el modelo y no podría leerse de una sola pantalla como inventario.
- **Un único "nivel de conocimiento" por rival.** Descartada: no hay ninguna decisión que dependa de
  un número así; sería la barra decorativa que ya se rechazó en D-071.
- **Espionaje sin coste o sin enfriamiento.** Descartada: sin precio ni caducidad la investigación no
  es una decisión, es un menú siempre abierto.
- **Reventar la puja exacta del rival en la licitación abierta.** Descartada: el `SubmitPublicBid` es
  privado hasta el cierre; lo que se vende es una intención estimada, no la oferta.
- **Ampliar `canonicalizeState` para cubrir la inteligencia y regenerar los diez digestos.** Descartada
  dentro de este WP, igual que en D-071: reescribiría la línea base por un motivo ajeno al cambio.

## Alcance

Incluido:

- `packages/simulation/src/information.ts`: registro de accesos, política de canales, `trueValueFor`,
  dibujo de estimaciones con arroyo propio, enfriamiento, re-base mensual del mercado, caducidad de
  precisión y `describeIntelligence`;
- `InformationScope`, `IntelKind`, `IntelSource`, `IntelligenceEstimate` e `IntelligenceState` en
  `packages/shared/src/domain.ts`, con el comando `CommissionIntelligence`, sus cinco códigos de rechazo
  en `responses.ts` y `phase2.intelligence` opcional en `snapshot.ts`;
- sistema `intelligence` al final de `PRODUCT_SYSTEMS` y bloque `intelligence` en la proyección;
- panel de "Riesgo y política" con el coste, el enfriamiento y el contenido del expediente;
- nueve pruebas en `packages/simulation/src/information.test.ts`, incluidas la de fuga con centinela y
  la de invariancia con estimaciones envenenadas.

No incluido:

- botón de encargo en la interfaz (el comando existe y la proyección se alimenta de él; la pasada de UI
  de Fase 4 lo cuelga);
- facciones con expediente propio, memoria e intenciones (WP4.10);
- percepción con fuentes que se contradigan, rumores o desinformación deliberada;
- filtrado automático de la proyección a partir del registro de accesos;
- Extensión de `canonicalizeState` a los agregados de WP4.3–WP4.9.

## Consecuencias

### Positivas

- Por primera vez el juego puede responder "¿qué sabe el jugador de su rival?" con una estructura de
  datos, no con una ausencia: el expediente es lo único que existe y la verdad sólo se usa para dibujarlo.
- La aceptación del WP es ejecutable: una prueba compara la proyección serializada contra un centinela
  privado y otra compara dos partidas que difieren sólo en lo que el jugador cree saber.
- El coste de equivocarse es acotado y visible: 150 u. por cifra, un mes de enfriamiento y un error
  declarado que envejece. El dinero es el único canal nuevo y no altera la conservación.
- Cero impacto en la economía: los diez digestos dorados y la caja del smoke (`5228 u.`) quedan
  idénticos porque la estimación consume su propio arroyo aleatorio.
- El registro de accesos deja una lista donde la Fase 4 multirol (perspectiva ciudadana o criminal)
  podrá apoyarse sin reabrir el modelo.

### Costes

- El registro no obliga a nada: sigue siendo posible escribir una regla que lea un observable `private`.
  La defensa real son las pruebas de fuga y de invariancia, que hay que mantener al día.
- `own` está definido pero no se usa para filtrar: el jugador ve su propio estado completo en el panel,
  que es correcto hoy y habrá que revisitar cuando haya más de un observador.
- El rival juega sin información parcial. Su IA lee el mundo completo —como antes de este WP— y la
  corrección corresponde a WP4.10, donde tendrá su propio expediente.
- Las cuatro cifras son grados de libertad sin barrido: con partida auto-jugada tres de las cuatro
  verdades valen 0 (`deuda viva`, `impuestos adeudados`, `puja prevista`), así que el canal sólo se
  ejercita de verdad en `caja`.
- El coste de `CommissionIntelligence` entra por `debit` igual que cualquier gasto: no hay mecánica de
  "información falsa" deliberada, y el error es siempre simétrico alrededor de la verdad del momento.

## Evidencia requerida

- `packages/simulation/src/information.ts` e `information.test.ts`.
- `packages/shared/src/domain.ts`, `responses.ts`, `snapshot.ts` y `projection.ts`.
- `packages/simulation/src/state.ts`, `snapshot.ts`, `systems.ts`, `commands.ts`, `projection.ts` y
  `worker-runtime.ts` (textos de los cinco rechazos).
- `apps/web/src/App.tsx`: bloque de inteligencia en el panel de riesgo.
- Acta `docs/execution/phase-4/wp4-9-information-2026-10-24.md`.
