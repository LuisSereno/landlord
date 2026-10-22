# Roadmap

## Principio
No se aprobará de inicio todo el alcance. Se avanzará mediante gates.

Además, el motor preservará compatibilidad con una visión multiperspectiva futura sin implementar esas perspectivas durante el producto inicial.

## Fase 0 — definición y viabilidad
Objetivos: visión, identidad propia, límites legales, núcleo y métricas.
Duración orientativa: 3-4 semanas. Esfuerzo: 40-60 jornadas-persona.

Decisión transversal:
- no modelar player == company;
- separar identidad, persona, organizaciones, ownership y control.

## Fase 1 — spike técnico / Gate 1
Objetivos: tilemap isométrico, cámara, selección, simulación desacoplada, Web Worker, PRNG con seed, tick fijo, guardado/carga y benchmark.
Duración: 4-6 semanas. Esfuerzo: 80-120 jornadas-persona.

No incorporar todavía sistemas económicos avanzados ni perspectivas alternativas.

Compatibilidad requerida:
- actor explícito donde proceda;
- ownership independiente;
- organizaciones independientes;
- evitar flags rígidos de modo.

## Fase 2 — prototipo / Gate 2
Objetivos: parcelas, materiales, construcción, tenants, ingresos, upgrades, IA rival, una acción
ilegal, policía, una ordenanza política, guardado y un spike mínimo de agentes físicos, daño e
incidentes.
Baseline anterior a D-061: 10-14 semanas y 180-280 jornadas-persona. Ya no es una estimación
vigente; WP2.15 debe diseñarse antes de rebaselinar duración y esfuerzo.

Los costes económicos deben existir sólo al nivel necesario para validar el bucle.
La experiencia jugable sigue centrada en Landlord/Entrepreneur.

Antes del `GO`, WP2.15 debe comprobar que construir, reparar y sabotear pueden ejecutarse por
agentes individuales y producir consecuencias espaciales deterministas. No incorpora todavía
life simulation ni una perspectiva criminal jugable.

## Fase 3 — vertical slice
Objetivos:
- arte representativo;
- economía ampliada;
- deuda bancaria;
- liquidez;
- impuestos/tasas principales;
- mantenimiento;
- seguros;
- zonificación;
- licencias;
- subastas;
- IA mejorada;
- política municipal;
- UX;
- automatización;
- cloud save.

Duración: 12-16 semanas. Esfuerzo: 300-450 jornadas-persona.

## Fase 4 — alpha sistémica
Objetivos:
- distritos generados;
- simulation LOD;
- macroeconomía;
- oferta/demanda de vivienda;
- empleo;
- hogares;
- presupuesto municipal;
- servicios urbanos;
- contratos públicos;
- reputación multidimensional;
- relaciones más persistentes;
- información imperfecta;
- eventos económicos;
- elecciones;
- facciones;
- progresión larga.

Duración: 16-24 semanas. Esfuerzo: 600-900 jornadas-persona.

Estos sistemas son el sustrato que haría posibles perspectivas jugables adicionales sin duplicar el mundo.

## Fase 5 — beta online
Seguridad, telemetría, compatibilidad, balance, anti-exploit, cloud save y preparación multiplayer si se aprueba.
Duración: 10-14 semanas. Esfuerzo: 350-500 jornadas-persona.

Sistemas funcionales candidatos a madurar aquí:
- insolvencia avanzada;
- ejecuciones;
- justicia inicial;
- concesiones;
- negociación avanzada;
- sindicatos si aportan al balance.

## Fase 6 — lanzamiento y expansión
Contenido, QA, localización, optimización, tutorial, operación y soporte.
Duración: 12-18 semanas. Esfuerzo: 400-650 jornadas-persona.

Capas posteriores posibles:
- inversores/equity;
- holdings;
- justicia avanzada;
- concesiones complejas;
- fraude económico;
- progresión histórica extensa.

## Fase 7 — perspectivas transitables, sólo si el producto base está validado

No forma parte de las estimaciones iniciales.

Orden conceptual:
1. Politician / Mayor.
2. Criminal.
3. Bank / Investor.
4. Contractor.
5. Union / Media.
6. Strategic Citizen.

Sistemas:
- RoleAssignment;
- Capability resolution;
- ControlContext;
- Gameplay LOD;
- delegación avanzada;
- Career Events;
- historial de carrera;
- transiciones entre roles.

## Fase 8 — life/society simulation, visión de muy largo plazo

No comprometida.

Podría incluir:
- carrera personal completa;
- envejecimiento;
- familia;
- educación;
- generaciones;
- herencia;
- dinastía.

Debe considerarse prácticamente una ampliación de producto de gran escala.

## Orden de magnitud
Sin multijugador: Early Access 16-22 meses; 1.0 24-30 meses; 1.900-2.900 jornadas-persona.
Multijugador competitivo: +400-700 jornadas-persona y +6-9 meses aproximadamente.

Las fases multiperspectiva no están incluidas en esas cifras.

Son estimaciones de planificación, no compromisos contractuales.
