# D-063 — Excepción al criterio de entrada de Alpha

Estado: **Aceptada**
Fecha: 2026-10-23

## Contexto

El acta de WP3.15 cerró la Fase 3 con `GO CONTROLLED ALPHA` y condicionó la Alpha sistémica a
medir sesiones reales antes de ampliar contenido: duración efectiva de sesión, primera
parcela/obra/ingreso, decisiones estratégicas frente a tareas repetitivas, comprensión de
overlays y carga operativa, con seeds y cohortes registrados.

Esa medición cuantitativa de 30–60 minutos sigue pendiente. El repositorio no dispone de
instrumentación persistente de cohortes: el diagnóstico de D-057 es efímero, acotado a 120
entradas en la web, no entra en `GameState` ni en snapshots, y no está diseñado para medir
retención, balance ni comprensión poblacional.

Los criterios de entrada de Fase 4 (`docs/execution/05-fase-4-alpha-sistemica.md`) exigen un
vertical slice validado y financieramente legible, y problemas de micromanagement resueltos o
con plan probado. Sin datos de sesión, esos criterios no están satisfechos con evidencia
cuantitativa.

## Decisión

El responsable decide adelantar la producción de contenido de Fase 4 sin la medición de
sesiones que exigía WP3.15, registrando la excepción.

La instrumentación persistente de sesiones de Alpha (cohorte, seed, duración, hitos de
progresión, rechazos, overlays usados) queda diferida y debe ejecutarse antes del cierre de
Alpha (WP4.16). No convierte una única prueba manual OK en significancia estadística; sólo
reordena el trabajo.

Los WPs de Fase 4 se ejecutan incrementalmente con plan y checks por WP, no de golpe. Cada WP
debe dejar el repositorio en verde (suite, smoke, arquitectura) antes de pasar al siguiente.

## Alcance

Incluido:
- producción de contenido de Fase 4 (WP4.1 en adelante) sin datos de sesión previos;
- registro explícito de la excepción en DECISIONS, KNOWN-GAPS, PROJECT-STATE y criterios de
  entrada de Fase 4.

No incluido:
- cierre de Alpha (WP4.16) sin la instrumentación de sesiones diferida;
- convertir la excepción en renuncia permanente a la medición;
- ampliar contenido más allá de Fase 4 sin nueva decisión.

## Consecuencias

### Positivas

- La producción de contenido no queda bloqueada por una instrumentación de playtest que aún no
  existe.
- El trabajo de Fase 4 avanza mientras se diseña la telemetría de Alpha con conocimiento real
  de los sistemas.
- La excepción queda trazada: un agente futuro no asumirá que el criterio de entrada está
  satisfecho.

### Costes

- Se amplía contenido sin validar que el slice es financieramente legible ni que el
  micromanagement está resuelto con datos.
- Riesgo de construir sistemas de Alpha sobre supuestos de balance no medidos.
- La instrumentación de sesiones se convierte en deuda explícita que debe cerrarse antes de
  WP4.16; si se olvida, Alpha se cerraría sin evidencia cuantitativa.

## Evidencia requerida

- Este ADR y la entrada D-063 en `ai-context/DECISIONS.md`.
- Nota de excepción en los criterios de entrada de
  `docs/execution/05-fase-4-alpha-sistemica.md`.
- Actualización de `ai-context/KNOWN-GAPS.md` y `ai-context/PROJECT-STATE.md`.
- Antes de WP4.16: instrumentación persistente de sesiones de Alpha con cohortes/seed
  registrados y medición de 30–60 minutos.
