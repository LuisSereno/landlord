# WP4.9 — Información imperfecta — 2026-10-24

## Estado

`DONE`. Cuatro accesos declarados (público, propio, inferido, privado), un expediente por observador y
estimaciones con error y antigüedad que se compran con caja. La IA y la interfaz siguen sin leer el
estado autoritativo completo, y esa ausencia de fuga es comprobable: dos pruebas, una con centinela
privado en la proyección y otra envenenando las creencias del jugador. Decisión en
`docs/engineering/adr/D-072-informacion-imperfecta.md`.

## Resultado

- **Registro de accesos, no banderas por campo**: `INFORMATION_POLICY.scopeByObservable` clasifica ~34
  observables en los cuatro accesos. El mismo número cambia de acceso según de quién sea: la caja
  propia es `own`, la del rival `private` y su versión estimada `inferred`.
- **Un único lector de la verdad**: `trueValueFor` sólo lo llaman el generador de estimaciones y las
  pruebas. `describeIntelligence` y la proyección no lo invocan, así que el expediente no puede convertirse
  en una copia del estado.
- **Cuatro cifras que valen una decisión**: caja disponible, deuda viva, impuestos adeudados y puja
  prevista en la próxima licitación. Se descartaron edificios y parcelas del rival porque ya son públicos.
- **Dos canales con precio**: `contacts` cuesta 150 u., enfría un mes y yerra ±6…±12 %; `market` es
  gratis, yerra ±25…±50 % y sólo re-basa entradas que ya estaban en el expediente y llevan tres meses
  sin refrescarse.
- **Precisión que envejece**: la eficacia declarada cae 2 puntos por mes hasta un suelo del 5 %. La
  entrada no se borra y el archivo queda acotado a una por sujeto y clase.
- **Expediente de un observador**: `observerOrganizationId` fija quién es el dueño y
  `CommissionIntelligence` rechaza al que no lo es (`INTEL_NOT_OBSERVER`), junto a `INTEL_SUBJECT_UNKNOWN`,
  `INTEL_SUBJECT_IS_SELF`, `INTEL_COOLDOWN` e `INTEL_UNAFFORDABLE`. No se asume jugador == empresa:
  valen persona, organización y propiedad del archivo.
- **Arroyo de PRNG propio**: `phase2.intelligence.prng` consume el ruido de estimación. El arroyo
  económico no se toca, y por eso ni un solo digesto dorado se mueve.
- **El expediente no es entrada de ninguna regla**: ningún sistema lo lee. Queda probado comparando el
  libro contable de dos partidas que sólo difieren en lo que el jugador cree saber.
- **Hoy el registro es un contrato, no un filtro**: ninguna lectura pasa automáticamente por él. Lo que
  sostiene la garantía son la forma del reporte y las pruebas.
- `phase2.intelligence` es opcional: una partida anterior se restaura con el expediente vacío generado
  desde su `seed`.

## Evidencia

### Evidence

- `packages/simulation/src/information.ts`: `INFORMATION_SCOPES`, `INFORMATION_POLICY`,
  `initialIntelligenceState`, `scopeFor`, `trueValueFor`, `effectiveAccuracyPercent`,
  `commissionIntelligence`, `commissionRejection`, `runIntelligence`, `describeIntelligence`.
- `packages/simulation/src/information.test.ts`: nueve pruebas.
- `packages/shared/src/domain.ts` (`InformationScope`, `IntelKind`, `IntelSource`,
  `IntelligenceEstimate`, `IntelligenceState`, `CommissionIntelligence` y sus esquemas),
  `responses.ts` (cinco códigos), `snapshot.ts` (`phase2.intelligence` opcional), `projection.ts`
  (bloque `intelligence`).
- `packages/simulation/src/state.ts`, `snapshot.ts`, `systems.ts` (sistema al final de
  `PRODUCT_SYSTEMS`), `commands.ts` ( handler con `debit`), `projection.ts`, `worker-runtime.ts` (los
  cinco textos de rechazo).
- `apps/web/src/App.tsx`: bloque de inteligencia en "Riesgo y política" y la etiqueta
  `intelligence_commission` en el libro de caja.

### Finding

Las cuatro verdades se miden con la misma pregunta y dan lecturas distintas: en una ciudad auto-jugada
de 50 parcelas, doce encargos mensuales sobre el rival producen veracidad sólo en `caja disponible`
(4 991 478 u. al cierre del mes 12); `deuda viva`, `impuestos adeudados` y `puja prevista` valen 0 en
las tres seeds sondeadas (7, 11, 17) porque el rival no pide préstamo, no debe impuestos y no puja.

El ruido respeta la cota declarada y describe el mundo del momento del encargo, no el de la lectura:
en la seed 11 el mes 3 se publica 5 499 107 u. —exactamente +10 % de la caja del mes anterior,
4 999 188 u.— cuando la caja real al consultar ya era 4 993 978 u. La estimación buena yerra, y la
prueba de cota compara contra la verdad del tick del encargo.

La caducidad cambia la decisión sin cambiar el dato: un contacto recién contratado se lee al 90 %, a
los dos meses al 86 % y a los noventa meses sigue valiendo algo (suelo del 5 %). Al cruzar la ventanilla
de tres meses el mercado re-basa solo y el expediente pasa a `source: market` con precisión 55 %, con
identificador nuevo —la entrada vieja no se hereda.

La fuga se comprueba con un centinela: con la caja del rival fijada a 7 777 770 u., el contacto la
estima en otro valor y la proyección serializada no contiene esa cifra en ninguna parte. Y la creencia
no manda: envenenando el expediente con 999 999 999 u. durante seis meses de partida auto-jugada, el
libro de transacciones del snapshot sale byte a byte idéntico al de la partida sin envenenar.

Ningún digesto dorado se mueve. Los diez casos de `tick-conservation.test.ts` conservan el valor de
WP4.8 y el smoke de navegador mantiene `CAJA 5228 u.`, porque la inteligencia abre un canal de gasto
voluntario que la partida auto-jugada no ejecuta y consume su propio arroyo aleatorio.

### Path

`observable -> INFORMATION_POLICY.scopeByObservable (public/own/inferred/private) -> CommissionIntelligence
(sujeto empresa, no yo, observador dueño, sin enfriar, caja suficiente) -> debit 150 u. ->
trueValueFor(verdad del tick) + Xoshiro128ss(intelligence.prng) -> estimate(value, accuracyPercent,
atTick, source: contacts) -> expediente por sujeto y clase -> cierre mensual: runIntelligence re-basa
con source: market lo que caducó -> describeIntelligence (sin verdad, con edad y precisión eficaz) ->
proyección y panel`

## Verificación reproducible

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm smoke:phase2
pnpm check:architecture
pnpm exec eslint packages apps scripts
```

Resultado observado:

- Typecheck de los tres paquetes en verde.
- Suite completa: 23 tests en shared, 158 en simulation (5 opt-in omitidos) y 17 en web. Las nueve
  pruebas nuevas de WP4.9 pasan.
- Build de `apps/web` correcto, con el aviso informativo conocido sobre el tamaño del bundle.
- Smoke de navegador de Gate 2: `CAJA 5228 u.` sin cambios. Comprobación headless del panel con
  Playwright sobre el bundle de preview, sin errores de página: `Inteligencia: encargar una cifra
  cuesta 150 u. y deja el canal 0 ticks enfriado. El mercado re-basa solo lo que lleva 3 meses sin
  refrescarse.` seguido de `El expediente está vacío: no has pagado por saber nada del rival.`
- Guarda de arquitectura en verde y eslint limpio sobre el código versionado.
- Digestos dorados: **ninguno regenerado**. Los diez casos conservan el valor de WP4.8 tras cablear el
  sistema `intelligence` y el comando de encargo, lo que confirma que el arroyo de PRNG separado no
  toca la economía. La determinancia del expediente se prueba comparando el snapshot completo, porque
  `canonicalizeState` sigue sin serializar `intelligence`.

## Deuda detectada no corregida en este WP

- **El registro de accesos no filtra nada**: `scopeByObservable` es un contrato declarado, no un
  interceptor. Una regla nueva puede seguir leyendo un observable marcado `private`; lo que lo evita
  hoy es la forma del reporte y las dos pruebas de fuga/invariancia.
- **`canonicalizeState` sigue ciego a los agregados** de WP4.3–WP4.9 (`employment`, `municipal`,
  `housingMarket`, `contracts`, `reputation`, `intelligence`). Se prolonga la misma decisión de D-071:
  ampliarlo reescribiría los diez digestos por un motivo ajeno al WP.
- **El rival sigue jugando con los naipes abiertos**: `rivalAction` lee edificios, parcelas y tesorerías
  de todo el mapa. Es el estado previo a este WP, no una regresión, pero la garantía de WP4.9 sólo se
  aplica al jugador. La corrección corresponde a WP4.10, donde las facciones tendrán su propio expediente
  como entrada.
- **Tres de las cuatro cifras no se ejercitan en partida auto-jugada**: sin préstamo rival, sin deuda
  fiscal y sin licitación concurrida, `deuda viva`, `impuestos adeudados` y `puja prevista` valen 0 y su
  error relativo es indeterminado (0 × cualquier ruido = 0).
- **No hay botón de encargo**: `CommissionIntelligence` está cableado y la proyección se alimenta de él,
  pero el panel sólo lee. Mismo patrón que `SubmitPublicBid` desde WP4.7; corresponde a la pasada de UI
  de Fase 4.
- **`own` está declarado pero no se usa para recortar**: el jugador ve todo su estado en el panel. Es
  correcto con un único observador y habrá que revisitarlo cuando haya segundo observador.
- **Grados de libertad sin barrido**: 150 u. de coste, un mes de enfriamiento, los cuatro márgenes de
  error, 2 puntos de caducidad, suelo del 5 % y tres meses de re-base son cifras elegidas a mano, sin
  herramienta de balance.
- **El error es siempre simétrico**: no existen rumores, desinformación deliberada ni fuentes que
  mientan sistemáticamente. La estimación es ruido alrededor de la verdad, no una creencia inducida.
- `apps/web/src/App.tsx` sigue leyendo la categoría `services` obsoleta en la línea municipal desde
  WP4.6; el desglose real es transporte, seguridad y limpieza.
- `pnpm format:check` sigue fallando por cuatro ficheros ya commiteados antes de este WP
  (`IsometricSpikeScene.ts`, `urban-services.test.ts`, `art-lab-browser-smoke.mjs`,
  `validate-visual-direction-spike.mjs`); `pnpm lint` sigue fallando en local por
  `blender_artist/toolchain/`.

## Nota de hardening (WP4.11-H, 2026-10-25)

Este acta conserva su cierre original. Dos afirmaciones quedaron corregidas después:

- la deuda decía que "la corrección corresponde a WP4.10, donde las facciones tendrán su propio expediente
  como entrada". **WP4.10 no implementó ese expediente**: cerro la cota medible y la fórmula compartida de
  la puja, pero el expediente propio de las facciones sigue `DEFERRED`. La frase original se mantiene como
  historia; el estado vigente está en la nota de WP4.10 y en `KNOWN-GAPS.md`.
- la proyección publicaba `rival.lastReason` y `rival.lastAction`, que contradecían la política de este WP.
  WP4.11-H los eliminó; sólo queda la huella física del rival (`rival_footprint: public`,
  `rival_decision: private`). Ver D-075.

## Fuera de alcance

No se implementan facciones con expediente propio, memoria e intenciones (WP4.10), ni planificador, ni
campañas electorales y aprobación popular (WP4.11), ni desinformación deliberada o fuentes enfrentadas,
ni el segundo observador que haría falta para la perspectiva ciudadana o criminal, ni interfaz de
gestión de la investigación. La instrumentación persistente de sesiones de Alpha sigue diferida por D-063.
