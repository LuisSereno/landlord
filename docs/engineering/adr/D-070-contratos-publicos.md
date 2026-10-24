# D-070 — Contratos públicos con licitación, fianza y ejecución

Estado: **Aceptada**
Fecha: 2026-10-23

## Contexto

WP4.7 (`docs/execution/05-fase-4-alpha-sistemica.md`) pide definir autoridad, objeto, requisitos,
ofertas, adjudicación y ejecución; validar capacidad y conflictos básicos; hacer competir a las
organizaciones IA bajo las mismas reglas; conectar cumplimiento con caja y reputación; mantener
concesiones complejas fuera de alcance; y probar licitación sin ofertas, empate, incumplimiento y
save/load.

Hasta ahora el municipio sólo recaudaba y gastaba; no contrataba, y el rival no tenía ninguna vía
para competir por ingresos públicos. Sin una autoridad y un calendario explícitos, cualquier ayudas
a la IA habría sido un privilegio oculto.

## Decisión

1. **La autoridad es el municipio existente.** No se crea organización ni rol nuevo: `org_00000004`
   publica, cobra fianzas y paga. El calendario es mes 2 y cada 3 meses, con un máximo de dos
   licitaciones activas. No se publica nada antes del primer cierre mensual.
2. **Dos objetos acotados: obra pública y suministro.** El catálogo declara presupuesto y
   `requiredBuildings` por objeto. Una obra exige al menos un edificio operativo del contratista;
   un suministro no exige edificios. Las concesiones, servicios continuos y pliegos variables
   quedan fuera de alcance.
3. **Oferta única por organización y contrato.** `SubmitPublicBid` valida que la organización sea
   `company`, que la licitación siga abierta, que el importe sea positivo y no supere el
   presupuesto, que la organización no ejecute ya otro contrato, que tenga los edificios requeridos
   y que su caja cubra la fianza. Cada rechazo tiene código propio.
4. **Fianza fija del 10 % del presupuesto**, calculada al publicar. Se cobra al adjudicar y se
   transfiere a la caja municipal; al completar se devuelve junto con el importe adjudicado; al
   incumplir se retiene. Es un traspaso, no una destrucción de caja: el dinero total se conserva en
   todo el ciclo.
5. **Adjudicación al menor postor con desempate determinista.** Las ofertas se ordenan por importe y,
   a igualdad, por identificador de organización. Si ningún postor puede pagar la fianza, la
   licitación queda desierta. Si no hay ofertas, también: no hay adjudicación implícita.
6. **Ejecución y reintento.** El contrato se ejecuta un mes después del cierre. Si el adjudicatario
   ya no mantiene los edificios operativos exigidos, incumple, pierde la fianza y suma
   `defaulted`. Si el municipio no tiene caja para pagar importe y fianza, el contrato sigue
   adjudicado y se reintenta al mes siguiente: la falta de tesorería de la autoridad no se disfraza
   de incumplimiento del contratista.
7. **La IA rival compite con el mismo comando.** El candidato del rival puja al 92 % del
   presupuesto por la licitación abierta más antigua que puede ejecutar y cuya fianza no rompe su
   reserva de liquidez. No recibe descuentos, información privilegiada ni un camino alternativo:
   pasa por `SubmitPublicBid` y por las mismas validaciones.
8. **Reputación como contadores de cumplimiento.** `reliabilityByOrganizationId` guarda
   `awarded`, `completed` y `defaulted`. No es una puntuación universal: es la memoria mínima que
   WP4.8 podrá leer para separar hecho, percepción y grupos con efectos propios.
9. **Persistencia aditiva.** `phase2.contracts` es opcional en el schema; una partida anterior se
   restaura con el estado inicial vacío. Las ofertas se guardan ordenadas para que el round-trip de
   snapshot sea estable.
10. **La proyección publica lo público.** El panel muestra licitaciones abiertas y adjudicadas,
    presupuesto, fianza, número de ofertas, la oferta del jugador y los contadores de fiabilidad.

## Alternativas consideradas

- **Un registro de proveedores o una organización contratante nueva.** Descartada: añade identidad
  y permisos sin resolver ningún problema del WP; el municipio ya existe y es la autoridad natural.
- **Adjudicación por sorteo o por reputación.** Descartada para este WP: el sorteo oculta la
  decisión y la reputación todavía no tiene dimensiones (WP4.8). El menor precio con desempate
  explícito es comprobable y justo bajo las mismas reglas.
- **Pago por hitos y certificaciones.** Descartada: exige estado de progreso de obra distinto del
  sistema de construcción y convierte un WP de contratación en un sistema de obra pública continuo.
- **Fianza como cuenta en escrow separada.** Descartada: una segunda caja municipal rompe la regla
  de caja única de D-068. La fianza se transfiere a la caja existente y se devuelve desde ella.
- **Confiscar la fianza y además multar.** Descartada: sin reputación multidimensional todavía, una
  multa encima de la fianza sería un castigo sin contraparte observable en el modelo.

## Alcance

Incluido:

- `packages/simulation/src/public-contracts.ts`: política, catálogo, fianza, validación de oferta,
  cierre, adjudicación, ejecución, incumplimiento, fiabilidad y descripción;
- `SubmitPublicBid` en `packages/shared/src/domain.ts` y su rechazo tipado en `responses.ts`;
- `phase2.contracts` con serialización y migración aditiva;
- sistema `contracts` antes de `municipal` en `PRODUCT_SYSTEMS`;
- candidato rival `bid_public_contract`;
- `publicContracts` en la proyección y bloque en el panel;
- nueve pruebas en `public-contracts.test.ts`;
- extracción de `debit`/`credit` a `ledger.ts` para evitar un ciclo de importación entre comandos y
  contratos.

No incluido:

- concesiones, servicios continuos, peajes o pliegos configurables;
- hitos, certificaciones o penalizaciones más allá de la fianza;
- interfaz para que el jugador puje (el comando existe y la proyección muestra su oferta);
- reputación multidimensional, percepción o información imperfecta (WP4.8 y WP4.9);
- corrupción, lobbying de contratos o conflicto de interés.

## Consecuencias

### Positivas

- El municipio deja de ser sólo recaudador: contrata, paga y puede quedarse sin caja para pagar.
- La IA rival gana ingresos por una vía pública y verificable, con el mismo comando que el jugador.
- Incumplir tiene coste inmediato (fianza) y memoria (contadores), sin introducir todavía una
  puntuación universal.
- El ciclo completo conserva el dinero total: fianza y pago son traspasos entre organizaciones.

### Costes

- Un contrato adjudicado bloquea a la organización para otra adjudicación hasta que se ejecute; es
  una regla simple que puede resultar restrictiva cuando existan más tipos de contrato.
- Si el municipio se queda sin caja, el contrato se reintenta indefinidamente y la fianza queda
  inmovilizada en la caja municipal.
- Los presupuestos, el 10 % de fianza, el 92 % de puja rival y el calendario son grados de libertad
  de balance sin herramienta de barrido.
- `canonicalizeState` no serializa los agregados económicos de WP4.3–WP4.7, así que los digestos
  dorados no cubren contratos. La prueba de determinismo de este WP compara el snapshot completo; la
  deuda queda registrada.

## Evidencia requerida

- `packages/simulation/src/public-contracts.ts` y `public-contracts.test.ts`.
- `packages/simulation/src/ledger.ts`: caja única reutilizable sin ciclos.
- `packages/shared/src/domain.ts`, `snapshot.ts`, `projection.ts` y `responses.ts`.
- `packages/simulation/src/state.ts`, `snapshot.ts`, `commands.ts`, `systems.ts` y `projection.ts`.
- `apps/web/src/App.tsx`: bloque de contratos públicos.
- Acta `docs/execution/phase-4/wp4-7-public-contracts-2026-10-23.md`.
