# D-076 — Follow-up de corrección del hardening Alpha (WP4.11-H.1)

Estado: aceptada el 2026-10-25 para el checkpoint **WP4.11-H.1**, después de la auditoría humana de
WP4.11-H sobre `83cc25a`. No abre WP4.12: cierra las inconsistencias entre sistemas que evolucionaron
en WPs distintos.

## Contexto

WP4.11-H pagó la deuda transversal de WP4.2–WP4.11 y dejó CI verde, pero la revisión posterior
encontró seis fallos que no son deuda nueva sino reglas de paquetes diferentes que ya no encajan:
una `WithdrawPolicy` heredada de WP3.11 que borra una ley que ahora impone el concejo (D-074), un
hecho reputacional de WP4.8 que publica al autor de un sabotaje que nadie detectó (D-072), dos
tablas de reputación que la documentación sigue describiendo al revés (D-071), validación de
snapshot que comprueba existencia pero no tipo, una métrica de UI que siempre vale 0 y una gobernanza
de rendimiento (D-065) cuyo disparador ya saltó sin que nadie reformulara qué obliga.

## Decisiones

1. **Una ordenanza `active` ya no se retira con `WithdrawPolicy`.** El comando sólo acepta
   `status === "proposed"`; una ley en vigor —la imponga la jugadora por lobby o la imponga el
   concejo— caduca por `MUNICIPAL_POLICY_DURATION_TICKS` y nadie más la borra. La coherencia con
   D-074 lo pide: si el concejo puede aprobar una ley sin que la jugadora la pida, la jugadora no
   puede desaprobarla sola. Retirar además silenciaría al gobierno, porque el debate siguiente está
   programado contra la caducidad (`nextDebateTick = expiresAtTick`) y no existe derogación
   parlamentaria en Alpha.
   - Alternativa descartada: añadir `source: player_lobby | council` al expediente y permitir la
     retirada sólo de las leyes propias. Resuelve el caso del lobby pero introduce provenance y
     calendario doble por un beneficio que ningún test pide; queda como evolución si algún día el
     concejo admite derogaciones.
   - UI: el botón pasa a llamarse *Retirar propuesta actual* y solo se habilita con `proposed`.
   - Consecuencia: D-075 decide 11 se mantiene; la regla que WP3.11 documentó ("retira una propuesta
     o una política activa") queda **parcialmente superendada** por esta decisión.

## Pendiente de este follow-up

Los puntos 2 a 6 de WP4.11-H.1 (atribución pública del sabotaje, documentación de reputación,
tipos de organización en snapshot, lectura de la tasa de servicios y gobernanza de rendimiento) se
añaden a esta decisión conforme aterricen.

## Evidencia

`docs/execution/phase-4/wp4-11-h-1-alpha-follow-up-2026-10-25.md`; pruebas
`packages/simulation/src/municipal-politics.test.ts` (la ley impuesta por el concejo no se retira y
caduca sola devolviendo la mesa) y `packages/simulation/src/phase2.test.ts` (lobby activo → retirada
rechazada, modificadores intactos).
