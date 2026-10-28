# D-087 — Evidencia de sesión de Alpha: qué cierra el playtest del 2026-10-28 y qué excepción queda abierta

Estado: propuesta el 2026-10-28 para la Fase 0 de V.d. Ratificación pendiente del responsable; sin
ella, el gate de Fase 0 permanece abierto y V.d.0 no puede arrancar.

## Contexto

D-063 (2026-10-23) adelantó la producción de Fase 4 sin la medición de sesiones reales que exigía
WP3.15, y condicionó ese aplazamiento: la instrumentación persistente de cohortes y seeds
**debía ejecutarse antes del cierre de Alpha (WP4.16)**. `PLAN_improvements.md` §2 ("Encaje en el
roadmap") reabre exactamente esa condición como prequisito de V.d:
"Antes de cambiar generación, snapshots y balance se debe cerrar la evidencia pendiente de D-063 o
registrar una nueva excepción explícita".

El 2026-10-28 se ejecutó una sesión instrumentada de 30 minutos a 4× sobre el build de producción,
con Worker real, escena Phaser real y semilla registrada. Informe:
`docs/execution/phase-4/playtest-30min-2026-10-28.md`. Los P0 que reveló se corrigieron en el commit
`95804ee`.

## Qué mide realmente esa sesión

| Criterio de WP3.15 / D-063 | Estado tras 2026-10-28 |
| --- | --- |
| Duración efectiva de sesión | **Medido**: 30,0 min de simulación = 144 220 ticks, cuatro cierres mensuales |
| Primera parcela / primera obra / primer ingreso | **Medido**: secuencia completa de compra, permiso, obra, ocupación y renta documentada en el informe |
| Decisiones estratégicas frente a tareas repetitivas | **Medido cualitativamente** para una partida; el informe separa decisiones de microgestión |
| Comprensión de overlays y carga operativa | **Parcial**: una sola observación, sin cohortes |
| Significancia estadística por seed y cohorte | **NO medido**: n = 1 |
| Instrumentación persistente en el producto | **NO implementada**: el diagnóstico de D-057 sigue siendo efímero y no autoritativo |

La sesión no produce lo que D-063 aplazó. Produce una evidencia mucho mejor que la "prueba manual OK"
anterior —reproducible, con build, commit, semilla y artifacts— pero sigue siendo **un solo
observador**, y el propio D-063 ya decía que una única prueba manual "no convierte … en significancia
estadística".

## Decisión propuesta

1. **La evidencia pendiente de D-063 se cierra parcialmente, no totalmente.** El repositorio pasa a
   tener una sesión instrumentada real con informe versionado y defectos P0 corregidos y verificados.
2. **Se registra una excepción explícita nueva** para el componente que sigue sin medirse
   (cohortes n > 1 con persistencia en producto). V.d arranca bajo esa excepción, no bajo la
   sensación de que D-063 quedó cerrado.
3. **La excepción no es gratis.** V.d abre una obligación concreta y verificable: la campaña de
   balance jugable §6 (`16 seeds × 12 meses × 4 estrategias`, `pnpm balance:playable`) y los playtests
   de 45–60 min de §6 **son evidencia de gate de V.d**, no un paso posterior. Si V.d cierra sin al
   menos dos observadores humanos con overlays y cambio de distrito usados, la excepción se renueva
   explícitamente en DECISIONS.md en vez de acumularse en silencio.
4. **El playtest de D-063 no se reabre como bloqueante de la Fase 0.** Bloquear V.d por una medición
   que el propio responsable ya aplazó una vez sería reescribir la historia de decisiones, no
   gobernarlas.

## Consecuencias

- `ai-context/DECISIONS.md` añade D-087 con la tabla de arriba y la excepción residual.
- `ai-context/PROJECT-STATE.md` deja de describir la instrumentación de D-063 como "pendiente" a
  secas: pasa a "parcialmente cerrada con excepción D-087".
- La condición de entrada de V.d queda satisfecha por la rama "registrar una nueva excepción
  explícita" del plan, no por la rama "cerrar la evidencia".
- El gate de Fase 0 depende ahora sólo de dos cosas medibles: baseline verde (este acta) y corpus
  morfológico con envelopes aprobados.

## No decide

- No convierte n = 1 en baseline de balance.
- No autoriza a declarar ningún gate de V.d como PASS sin datos propios.
- No define la condición de victoria del juego, que el playtest identificó como ausencia de producto
  y que sigue sin estar en el alcance de V.d.
