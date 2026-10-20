# AGENTS.md

Este repositorio está diseñado para ser trabajado también por agentes de IA.

## Lectura obligatoria antes de modificar código o diseño

1. ai-context/README.md
2. ai-context/PROJECT-STATE.md
3. ai-context/DECISIONS.md
4. ai-context/ARCHITECTURE.md
5. ai-context/GAME-DOMAIN.md
6. docs/INDEX.md
7. La documentación específica del área que vaya a modificarse.

## Fuente de verdad

- docs/ contiene la documentación canónica y extensa.
- ai-context/ contiene una wiki condensada y operativa para agentes.
- Si ambos difieren, prevalece la decisión más reciente registrada en ai-context/DECISIONS.md y debe corregirse después la documentación extensa.
- El código, cuando exista, prevalece sobre ejemplos antiguos de documentación respecto al comportamiento realmente implementado, pero una discrepancia debe registrarse como deuda documental.

## Reglas de producto

Landlord es una IP original. No es un remake de Constructor, Street Wars ni Mob Rule.

No reutilizar:
- nombres protegidos de la franquicia de referencia;
- personajes;
- sprites;
- mapas;
- música;
- diálogos;
- textos;
- interfaz;
- cadenas de contenido copiadas literalmente.

Sí pueden estudiarse principios abstractos de diseño: promoción inmobiliaria, construcción, tenants, recursos, competencia, territorio, crimen, policía, política, etc., siempre expresados con identidad, datos y reglas propias.

## Reglas de arquitectura

- La simulación no depende de Phaser, React ni del DOM.
- El render no decide reglas de negocio.
- El estado autoritativo de una partida pertenece al motor de simulación.
- El MVP es single-player.
- La simulación debe ser determinista cuando recibe la misma seed y los mismos comandos.
- Evitar Math.random en la lógica de dominio; usar PRNG controlado.
- El tiempo de render y el tiempo de simulación son conceptos diferentes.
- Preferir datos configurables a condicionales codificados para edificios, políticas y eventos.
- No introducir Redis, Kubernetes, microservicios o multijugador antes de que exista una necesidad demostrada.
- La IA generativa nunca modifica directamente el estado de juego: propone contenido estructurado que debe validar el motor.

## Antes de añadir una funcionalidad

Responder:
1. ¿Qué problema de jugador resuelve?
2. ¿Pertenece al Gate actual?
3. ¿Añade una decisión significativa o sólo más micromanagement?
4. ¿Puede expresarse como sistema reutilizable en vez de contenido puntual?
5. ¿Cómo se prueba de forma determinista?
6. ¿Qué datos deben persistirse?
7. ¿Afecta a partidas guardadas?
8. ¿Tiene implicaciones de propiedad intelectual?

## Objetivo actual

No construir todavía "el juego infinito". Construir y validar el núcleo:
comprar terreno -> producir -> construir -> ocupar -> generar caja -> competir -> asumir riesgos -> reaccionar a una decisión política.
