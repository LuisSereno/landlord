# AI Context Wiki

Esta carpeta es el punto de entrada obligatorio para cualquier agente de IA que trabaje en Landlord.

## Para qué existe

Permite que un agente entienda rápidamente:
- qué es el proyecto;
- qué está decidido;
- qué sólo está propuesto;
- cómo debe funcionar la arquitectura;
- qué dominios existen;
- en qué fase está;
- qué no debe implementar aún;
- qué riesgos y restricciones existen;
- dónde está la documentación canónica.

## Orden de lectura

1. PROJECT-STATE.md
2. DECISIONS.md
3. ARCHITECTURE.md
4. GAME-DOMAIN.md
5. ROADMAP.md
6. CONVENTIONS.md
7. GLOSSARY.md
8. KNOWN-GAPS.md
9. SOURCE-MAP.md
10. AGENT-WORKFLOW.md

Después leer docs/ del área afectada.

## Resumen en 30 segundos

Landlord es un juego web 2.5D isométrico de estrategia económica, inmobiliaria, urbana, criminal y política.

No es un remake.

Stack inicial:
- TypeScript;
- Vite;
- Phaser;
- React para UI;
- Web Worker para simulación;
- IndexedDB para saves locales.

Regla arquitectónica principal:
la simulación es independiente del render.

Estado actual:
documentación y predesarrollo. No existe todavía implementación jugable.

Siguiente objetivo:
Gate 1 técnico.

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
