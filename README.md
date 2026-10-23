# Landlord

Landlord es un videojuego web de estrategia económica, inmobiliaria, urbana, criminal y política, diseñado como una propiedad intelectual original e inspirado en los principios sistémicos de los tycoon y juegos de estrategia isométricos de finales de los 90.

No es un remake de Constructor, Street Wars o Mob Rule. El objetivo es construir un sucesor espiritual moderno, web-native y de larga duración, donde economía, construcción, sociedad, crimen, política, facciones e IA formen una simulación conectada capaz de generar situaciones emergentes.

## Principios

- Web de escritorio como plataforma inicial.
- 2.5D isométrico con identidad visual propia.
- Single-player primero; multijugador después de validar el núcleo.
- Simulación determinista separada del renderizado.
- Mundo ampliable por distritos, no un mapa físicamente infinito.
- Sistemas emergentes en lugar de campañas cerradas.
- Automatización progresiva para evitar micromanagement.
- Política municipal integrada en economía, urbanismo, seguridad y opinión pública.
- IA sistémica como base; IA generativa sólo como capa narrativa opcional.
- Diseño data-driven.
- Propiedad intelectual original.

## Documentación

- [Índice de documentación](docs/INDEX.md)
- [Contexto para agentes de IA](ai-context/README.md)
- [Instrucciones para agentes](AGENTS.md)

## Estado

Fase actual: Fase 3 / Vertical Slice en `IN_PROGRESS`, con Gate 2 en `CONDITIONAL GO`, WP3.2
(producción física localizada), WP3.3 (baseline financiero), el núcleo de WP3.4 (banca y deuda)
y WP3.5 (fiscalidad prioritaria), WP3.6 (mantenimiento y deterioro), WP3.7 (seguros), WP3.8 (zoning/permisos), WP3.9 (insolvencia inicial)
y WP3.10 (IA rival financiera) cerrados para el slice funcional. La refinanciación/ejecución avanzada queda trazada a WP3.9.

La estrategia recomendada es validar primero dos puertas:

1. Gate 1 — viabilidad técnica.
2. Gate 2 — viabilidad de producto.

Gate 1 está en `GO`: Chromium alcanza 18,6 ms de frame p95 a 10 Hz y Firefox 18 ms. El soak
reducido de 30 minutos fue estable; la evidencia está en
`docs/execution/phase-1/gate-1-retest-2026-10-21.md`. D-055 resuelve el punto `events`/snapshots:
los eventos normales son efímeros y los historiales persistentes serán registros específicos.
D-060 separa el calendario económico del tick técnico y cierra el rework de materiales,
capacidad, cuadrillas, política, rival, riesgo y mantenimiento. La revisión del 2026-10-23 acepta
el núcleo tras la prueba manual OK y deja una única condición: cerrar el Visual Direction Spike
antes del arte representativo de Fase 3. Consulta el acta en
`docs/execution/phase-2/gate-2-review-2026-10-23.md`.
