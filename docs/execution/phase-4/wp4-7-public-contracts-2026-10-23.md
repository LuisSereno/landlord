# WP4.7 — Contratos públicos — 2026-10-23

## Estado

`DONE`. El municipio licita con calendario propio, las organizaciones compiten por la misma
licitación con el mismo comando, la fianza se cobra y se devuelve, y el incumplimiento deja memoria.
Decisión en `docs/engineering/adr/D-070-contratos-publicos.md`.

## Resultado

- **La autoridad es el municipio que ya existía** (`org_00000004`): no hay organización ni rol nuevo.
  Publica en el mes 2 y cada 3 meses, con máximo dos licitaciones activas y ventana de ofertas de un
  mes.
- **Dos objetos**: obra pública (`requiredBuildings: 1`) y suministro (`requiredBuildings: 0`), con
  presupuesto y fianza declarados en el catálogo. Concesiones y servicios continuos quedan fuera.
- **Fianza del 10 % del presupuesto**, transferida a la caja municipal al adjudicar, devuelta al
  completar y retenida al incumplir. Es un traspaso entre organizaciones: el dinero total se conserva.
- **Adjudicación al menor postor** con desempate por identificador de organización. Sin ofertas, o si
  ningún postor puede pagar la fianza, la licitación queda desierta: no hay adjudicación implícita.
- **Ejecución un mes después del cierre**, con reintento mensual si a la autoridad no le alcanza la
  caja. La falta de tesorería del municipio no se disfraza de incumplimiento del contratista.
- **Siete rechazos tipados** para la oferta: licitación inexistente, cerrada, oferta duplicada,
  importe sobre presupuesto, sin edificios requeridos, sin caja para la fianza y contrato ya en
  curso.
- **El rival compite por la misma puerta**: puja al 92 % del presupuesto por la licitación abierta más
  antigua que puede ejecutar y cuya fianza no rompe su reserva, a través de `SubmitPublicBid` y de
  las mismas validaciones que el jugador.
- **Cumplimiento con memoria**: `awarded`, `completed` y `defaulted` por organización, la base mínima
  que WP4.8 convertirá en reputación multidimensional.
- El panel publica licitaciones en curso e históricas con presupuesto, fianza, ofertas, la oferta del
  jugador y sus contadores de fiabilidad.

## Evidencia

### Evidence

- `packages/simulation/src/public-contracts.ts`: `PUBLIC_CONTRACTS_POLICY`, catálogo, `bondFor`,
  `operationalBuildingsOwned`, `hasActiveAward`, `submitPublicBid`, `runPublicContracts`,
  `describePublicContracts`.
- `packages/simulation/src/ledger.ts`: `debit`/`credit` extraídos de `commands.ts` para que contratos
  mueva caja sin ciclo de importación; `commands.ts` los reexporta.
- `packages/simulation/src/public-contracts.test.ts`: nueve pruebas.
- `packages/shared/src/domain.ts` (`SubmitPublicBid`), `responses.ts` (siete códigos), `snapshot.ts`,
  `projection.ts`.
- `packages/simulation/src/state.ts`, `snapshot.ts`, `commands.ts`, `systems.ts` (sistema `contracts`
  antes de `municipal` y candidato rival `bid_public_contract`), `projection.ts`, `worker-runtime.ts`.
- `apps/web/src/App.tsx`: bloque de contratos públicos.

### Finding

El ciclo completo se cierra sin crear ni destruir dinero: con presupuesto 400 y fianza 40, una oferta
de 350 deja al contratista 40 menos al adjudicar y 390 más al completar —neto, cobra justo su
importe— mientras el municipio pasa de 10 040 a 9 650 y el total de las cinco organizaciones no
cambia en ningún paso. Si el adjudicatario pierde el edificio requerido antes de ejecutar, incumple:
el municipio retiene los 40 y el historial queda `{awarded: 1, completed: 0, defaulted: 1}`.

La puja más baja gana y el empate es determinista: con dos ofertas idénticas a 280 gana el jugador
(`org_00000001`) sobre el rival (`org_00000002`) por identificador, no por orden de llegada. Cerrar
sin ofertas no mueve caja y no deja fiabilidad registrada.

En una ciudad de 50 parcelas las licitaciones aparecen en los meses 2, 5, 8, 11, 14 y 17 y todas
quedan desiertas: ninguna organización IA tiene a la vez un edificio operativo y la fianza, así que
la vía pública es real pero todavía no está ajustada. Ese dato viene de saltar de cierre en cierre
mensual; sin ticks horarios la construcción no avanza y no prueba el comportamiento del rival tick a
tick, que sí se comprueba en la prueba unitaria donde puja por un suministro y esquiva una obra que
no puede ejecutar.

### Path

`calendario municipal -> licitación publicada -> ofertas por el mismo comando -> validar capacidad,
conflicto y fianza -> adjudicación al menor postor -> cobrar fianza al municipio -> ejecutar al mes
(degradación de edificios, tesorería municipal) -> pago más devolución de fianza -> contadores de
cumplimiento -> reputación (WP4.8)`

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
- Suite completa: 23 tests en shared, 140 en simulation (5 opt-in omitidos) y 17 en web. Las nueve
  pruebas nuevas de WP4.7 pasan.
- Build de `apps/web` correcto, con el aviso informativo conocido sobre el tamaño del bundle.
- Smoke de navegador de Gate 2: `CAJA 5228 u.` sin cambios; el panel renderiza el bloque de
  contratos sin errores de página.
- Guarda de arquitectura en verde y eslint limpio sobre el código versionado.
- Digestos dorados: los diez casos de `tick-conservation.test.ts` siguen válidos sin regeneración,
  porque ningún caso llega al mes 2 y `canonicalizeState` no serializa los agregados económicos
  (deuda registrada). La determinancia de contratos se comprueba comparando el snapshot completo.

## Deuda detectada no corregida en este WP

- **`canonicalizeState` sigue ciego a los agregados** de WP4.3–WP4.7 (`employment`, `municipal`,
  `housingMarket`, `contracts`). Ampliarlo reescribiría los diez digestos por un motivo ajeno a este
  WP, así que se deja como deuda y se abordará con una regeneración deliberada y documentada.
- **Balance sin ajustar**: el calendario, el 10 % de fianza, el 92 % de puja rival y los presupuestos
  son grados de libertad sin herramienta de barrido. Tal como está, las licitaciones de obra quedan
  desiertas en una partida auto-jugada.
- **El jugador aún no puja desde la interfaz**: el comando `SubmitPublicBid` existe y la proyección
  muestra su oferta, pero no hay botón. Corresponde a la pasada de UI de Fase 4, no a este WP.
- Un contrato adjudicado bloquea otra adjudicación para esa organización hasta ejecutarse; puede
  resultar restrictivo cuando haya más tipos de contrato.
- Si el municipio se queda sin caja, la fianza queda inmovilizada en su tesorería mientras el contrato
  se reintenta mes a mes.
- La puntuación del candidato rival de contratos es 76, por debajo de expansión (80): en partidas
  reales puede no llegar nunca a pujar. Sin ticks horarios no se ha medido.
- `apps/web/src/App.tsx` sigue leyendo la categoría `services` obsoleta en la línea municipal desde
  WP4.6; el desglose real es transporte, seguridad y limpieza.
- `pnpm format:check` sigue fallando por cuatro ficheros ya commiteados antes de este WP
  (`IsometricSpikeScene.ts`, `urban-services.test.ts`, `art-lab-browser-smoke.mjs`,
  `validate-visual-direction-spike.mjs`); `pnpm lint` sigue fallando en local por
  `blender_artist/toolchain/`.

## Fuera de alcance

No se implementan concesiones, servicios continuos, peajes, pliegos configurables, hitos ni
certificaciones de obra, multas más allá de la fianza, corrupción o lobbying de contratos, ni
reputación multidimensional, percepción o información imperfecta (WP4.8 y WP4.9). La
instrumentación persistente de sesiones de Alpha sigue diferida por D-063.
