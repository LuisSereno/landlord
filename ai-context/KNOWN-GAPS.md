# Huecos y decisiones pendientes

## Producto
- nombre comercial definitivo;
- época histórica o universo ficticio exacto;
- tono visual;
- grado de humor;
- nivel de violencia;
- progresión temporal final;
- monetización;
- distribución.

## Técnico
- pathfinding;
- backend framework.

Resuelto para Gate 1 el 2026-10-20:
- Phaser 4.2.1 confirmado con condiciones de revisión en D-050;
- PRNG interno `xoshiro128ss-v1` en D-048;
- snapshot y protocolo Worker v1 en D-051;
- entidades convencionales normalizadas, no ECS, en D-049;
- Vitest/Playwright y toolchain exacto en D-046;
- Zod en fronteras en D-049.

Pathfinding sigue abierto para producto; Gate 1 sólo compromete A* cardinal determinista del benchmark. Backend permanece fuera de alcance.

## Player model / multiperspectiva
- detalle de Person posterior a Gate 1;
- evolución de PlayerIdentity posterior al modelo mínimo;
- RoleAssignment;
- Capability resolver;
- ControlContext;
- ownership personal vs corporativo;
- cómo representar delegación;
- modelo de información visible;
- UI dinámica por perspectiva;
- cuándo introducir Gameplay LOD;
- cuándo permitir transiciones reales entre roles;
- si la partida inicial empieza directamente como empresario o como persona con background;
- envejecimiento;
- familia;
- herencia;
- dinastías;
- duración temporal de una vida.

Resuelto para Gate 1 en D-049/D-051: `PlayerIdentity -> Person`, `Organization`, `OrganizationControlGrant` y ownership explícito mínimos, sin roles/capabilities completos.

## Gate 1 — cierre técnico 2026-10-20
- soak de navegador de dos horas (Chromium/Firefox) aún requiere una sesión dedicada y artefacto archivado;
- latencia p95 del Worker y command/response ya está instrumentada en `pnpm audit:metrics`;
- serialización/validación p95 del snapshot técnico ya está instrumentada en `pnpm audit:metrics`;
- el bundle web inicial supera 500 kB minificados; no bloquea Gate 1, pero queda como optimización posterior.

## Economía inmobiliaria
- fórmula de valor de suelo;
- modelo de oferta/demanda;
- contratos de alquiler;
- vacancy;
- elasticidad de rentas;
- coste y frecuencia de mantenimiento;
- fórmula de deterioro.

## Fiscalidad
- impuestos concretos de la primera versión;
- bases imponibles;
- periodicidad;
- exenciones;
- relación entre impuesto y presupuesto municipal;
- grado de regionalización de tasas.

## Finanzas y banca
- modelo de tipos;
- loan-to-value;
- garantías;
- covenants simplificados;
- insolvencia;
- refinanciación;
- reglas de subasta;
- seguros;
- equity e inversores futuros.

## Urbanismo
- categorías definitivas de zoning;
- densidad;
- altura;
- cambio de uso;
- permisos;
- inspecciones;
- recalificación;
- modelo de accesibilidad.

## Sociedad y empleo
- tenant/household model;
- mercado laboral;
- salario;
- cualificación;
- migración;
- sindicatos;
- huelgas.

## Política
- número de concejales;
- modelo de voto;
- influencia;
- corrupción;
- elecciones;
- opinión pública;
- presupuesto municipal;
- licitaciones y concesiones;
- alcance de la primera perspectiva política jugable futura.

## Servicios públicos
- qué servicios simular explícitamente;
- financiación;
- efecto sobre suelo/población;
- ownership público/privado;
- concesiones.

## Crimen y justicia
- crime resolution;
- heat decay;
- evidencia;
- inspecciones corruptibles;
- litigios;
- embargo;
- confiscación;
- alcance de una perspectiva criminal jugable futura.

## Información
- visibilidad de datos;
- analistas;
- espionaje;
- coste de inteligencia;
- incertidumbre y precisión.

## Reputación y relaciones
- grupos de reputación;
- escalas;
- decay;
- efectos sistémicos;
- dimensiones de relaciones;
- memoria histórica;
- blackmail/debt/fear/trust.

## IA
- implementación Utility;
- planner;
- memoria;
- información imperfecta;
- personality model;
- toma de decisiones financieras;
- IA delegada para organizaciones del jugador.

## Arte
- tile size;
- ángulo isométrico;
- resolución;
- pipeline;
- animation budget.

## Legal
- clearance de marca;
- revisión final de similitud.

## Regla
No rellenar estos huecos de forma irreversible sin una decisión explícita, un spike o datos de playtesting.
