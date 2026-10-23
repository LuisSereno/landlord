# AI Context Wiki

Esta carpeta es el punto de entrada obligatorio para cualquier agente de IA que trabaje en Landlord.

## Para qué existe

Permite que un agente entienda rápidamente:
- qué es el proyecto;
- qué está decidido;
- qué sólo está propuesto;
- cómo debe funcionar la arquitectura;
- qué dominios existen;
- cómo se representa al jugador;
- en qué fase está;
- qué no debe implementar aún;
- qué riesgos y restricciones existen;
- dónde está la documentación canónica.

## Orden de lectura

1. PROJECT-STATE.md
2. DECISIONS.md
3. ARCHITECTURE.md
4. PLAYER-MODEL.md
5. GAME-DOMAIN.md
6. ART.md
7. ROADMAP.md
8. CONVENTIONS.md
9. GLOSSARY.md
10. KNOWN-GAPS.md
11. SOURCE-MAP.md
12. AGENT-WORKFLOW.md

Después leer docs/ del área afectada.

## Resumen en 30 segundos

Landlord es inicialmente un juego web 2.5D isométrico de estrategia económica, inmobiliaria, urbana, criminal y política.

No es un remake.

Stack inicial:
- TypeScript;
- Vite;
- Phaser;
- React para UI;
- Web Worker para simulación;
- IndexedDB para saves locales.

Reglas arquitectónicas principales:
- la simulación es independiente del render;
- player no equivale a company;
- identidad, persona, organizaciones, ownership y control son conceptos separados;
- los roles futuros deben resolverse mediante capabilities;
- la compatibilidad multiperspectiva no amplía el scope del MVP.

Estado actual:
Gate 1 aprobado y baseline económico jugable de Gate 2 integrado. Gate 2 tiene `GO` para
producción representativa desde el 2026-10-23: WP2.15, la prueba manual del núcleo y el Visual
Direction Spike están cerrados; `graphic_civic` es la baseline de WP3.13.

Siguiente objetivo:
continuar con WP3.13 (arte, audio y rendimiento representativos) y después emitir la decisión
final de WP3.15.

## Visión futura

Una misma Person podría evolucionar entre capas:
- ciudadano;
- trabajador;
- empresario;
- propietario;
- político;
- criminal;
- inversor;
- otros roles.

No se implementa ahora. Sólo se preserva la posibilidad arquitectónica.

## Fuente de verdad

- docs/: documentación extensa.
- ai-context/: resumen operativo.
- código + tests: comportamiento implementado real, cuando existan.
- DECISIONS.md: decisiones vigentes.

## Regla crítica

No inventar que algo está implementado por estar descrito.

Distinguir siempre:
- decidido;
- propuesto;
- futuro;
- no resuelto.
