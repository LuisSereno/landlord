# D-060 — Coherencia económica y temporal de Gate 2

Estado: Aceptada
Fecha: 2026-10-22
Alcance: Gate 2

Nota posterior: D-061 sustituye el punto 5 para el criterio de cierre del Gate 2. Las dos crews
agregadas permanecen como baseline migrable, no como validación final de agentes funcionales.

## Contexto

La auditoría del baseline detectó que los ticks técnicos también actuaban como tiempo económico,
la capacidad de los edificios era decorativa, la producción no tenía trade-off, la política era
segura, el rival ocultaba sus activos y el deterioro no tenía respuesta jugable.

## Decisión

1. A velocidad 1×, 20 ticks técnicos forman un segundo real y 36.000 ticks forman un mes de juego
   de 30 días. Una hora económica equivale a 50 ticks y un día a 1.200 ticks.
2. Los materiales pueden comprarse a precio fijo de prototipo o producirse tras invertir en una
   línea propia con coste operativo. El mercado sofisticado se difiere.
3. `capacity` representa unidades o locales ocupables. Un edificio admite varios contratos y cada
   inquilino conserva un único contrato activo.
4. El presupuesto limita la entrada; satisfacción, asequibilidad, condición y vencimiento pueden
   causar la salida al cierre mensual.
5. La organización del jugador dispone de dos cuadrillas agregadas. Puede repartirlas entre dos
   obras o concentrarlas en una para duplicar su avance horario.
6. La ordenanza se resuelve mediante el PRNG persistido: 65 % base y 15 puntos por cada influencia
   adicional, con máximo de 95 %. El resultado puede ser aprobación o rechazo.
7. Edificios y obras rivales son información pública en el mapa. Caja, rentas y contratos rivales
   permanecen ocultos.
8. La condición baja mensualmente. Una reparación cuesta 450 u., requiere 48 horas y ocupa
   cuadrilla; al completarse restaura la condición al 100 %.
9. La ruta ilegal tiene cooldown de dos días y una transferencia exitosa nunca crea dinero: el
   beneficio queda limitado por la caja del objetivo.
10. Historial de transacciones e IDs procesados son ventanas acotadas; el snapshot conserva la
    cola autoritativa y valida referencias internas de Phase 2.

## Consecuencias

- La renta se liquida una vez al mes y una vivienda base tarda cuatro días de juego con una
  cuadrilla.
- El render sigue sin decidir reglas ni acceder al estado privado del rival.
- Los saves antiguos de Gate 1 continúan aceptándose mediante defaults aditivos del schema v1.
- El smoke de navegador prueba el flujo interactivo; las liquidaciones mensuales se cubren en el
  harness headless para no convertir el CI en una espera de varios minutos.

## Evidencia

- Dominio y persistencia: `packages/shared/src/domain.ts`, `packages/shared/src/snapshot.ts`.
- Reglas: `packages/simulation/src/game-data.ts`, `commands.ts`, `systems.ts`, `projection.ts`.
- UI/Worker: `apps/web/src/App.tsx`, `apps/web/src/worker/client.ts`,
  `packages/simulation/src/worker-runtime.ts`.
- Pruebas: `packages/simulation/src/phase2.test.ts`, `worker-runtime.test.ts`,
  `apps/web/src/worker/client.test.ts` y `scripts/phase2-browser-smoke.mjs`.
