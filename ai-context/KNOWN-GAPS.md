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
- el retest browser de 10 minutos a 10 Hz está archivado en
  `docs/execution/phase-1/gate-1-retest-2026-10-21.md`: Firefox y Chromium pasan;
- el soak reducido de 30 minutos medidos en Chromium a 2 Hz fue estable, pero no sustituye el
  umbral de frame a 10 Hz;
- la instrumentación de comando/respuesta, backlog, proyección y save/load del harness browser
  quedó cerrada para Gate 1; los comandos del benchmark son probes de transporte y no sustituyen
  la integración de contenido del producto;
- latencia p95 del Worker y command/response ya está instrumentada en `pnpm audit:metrics`;
- serialización/validación p95 del snapshot técnico ya está instrumentada en `pnpm audit:metrics`;
- el bundle web inicial supera 500 kB minificados; no bloquea Gate 1, pero queda como optimización posterior.
- la política de eventos/snapshots está resuelta en D-055; quedan para Gate 2 los primeros
  registros históricos concretos y su retención, no un event log ilimitado.

## Economía inmobiliaria
- fórmula de valor de suelo;
- modelo de oferta/demanda;
- elasticidad de rentas;
- venta y subasta de activos.

## Producción física
Decidido en D-062 para después de Gate 2:
- sustituir la activación abstracta `InvestInProduction` por fábricas construibles;
- mantener mercado de materiales como alternativa inmediata;
- introducir aptitud productiva de parcela por recurso/familia;
- integrar fábricas con crews, condition, structuralIntegrity, fuego, sabotaje y reparación;
- convertir "inversión" en upgrades de activos productivos.

Pendiente para implementación del Vertical Slice:
- nombres y catálogo definitivos de instalaciones productivas;
- escala de suitability y fórmula exacta de rendimiento;
- balance mercado frente a coste unitario propio;
- capacidad/almacenamiento por instalación;
- upgrades concretos;
- reglas de zoning/contaminación/logística;
- migración de `ProductionFacility`/saves de Gate 2;
- comportamiento de IA para elegir mercado, construir fábrica o ampliar capacidad.

## Gate 2 / Fase 3 — estado 2026-10-23
- Implementados parcelas, caja, mercado de materiales, inversión productiva abstracta de Gate 2, obras, dos crews
  agregadas y asignables, tenants finitos multiunidad, presupuesto/satisfacción, renta mensual,
  deterioro/reparación, upgrades, rival utility mínimo, crimen/policía con cooldown, ordenanza
  incierta, HUD y save/load.
- WP2.11 tiene ya layout de juego, mapa principal, inspector contextual, onboarding, velocidad,
  costes previos, producción, cuadrilla, tenants, renta, progreso, cancelación y libro de caja.
- La prueba manual del responsable fue OK, pero no dejó duración, seeds ni métricas cuantitativas;
  siguen pendientes para el balance financiero posterior.
- Gate 2 está en `CONDITIONAL GO`; el Visual Direction Spike sigue abierto y bloquea sólo el arte
  representativo de WP3.13.
- El rival completa compra, mercado, inversión productiva, construcción, ocupación y renta con
  utility determinista, reserva de liquidez y cooldown ante fallos. Su profundidad sigue siendo
  deliberadamente mínima y sólo se amplía si el playtest lo justifica.
- D-061 queda implementado en el núcleo: agents operativos, crews físicas, pathfinding, fuego,
  integridad estructural, daño espacial, heridas, muerte, casualties, ruina y migración aditiva.
- WP3.2 / D-062 está cerrado para el slice funcional: fábrica física, aptitud de parcela, mercado,
  fuego/recuperación, rival y migración de snapshots tienen cobertura determinista.
- No se autoriza por ello una life simulation ni un sistema de combate amplio. `InvestInProduction`
  sigue siendo válido únicamente para migrar instalaciones legacy.

## Fiscalidad
- impuestos concretos de la primera versión;
- bases imponibles;
- periodicidad;
- exenciones;
- relación entre impuesto y presupuesto municipal;
- grado de regionalización de tasas.

## Finanzas y banca
- WP3.3 está cerrado como proyección derivada de activos, pasivos, patrimonio, periodo y previsión.
- WP3.4 tiene el núcleo de deuda implementado: banco independiente, garantía, oferta,
  desembolso, amortización, mora y persistencia. Refinanciación, ejecución y reestructuración
  avanzada siguen en WP3.9.
- WP3.5 tiene implementadas las tasas prioritarias de transmisión y propiedad, tesorería
  municipal, exenciones, modificadores de ordenanza, previsión y atrasos.
- WP3.6 tiene implementadas liquidación automática de mantenimiento, políticas equilibrada y
  diferida, backlog por edificio, deterioro progresivo, consecuencias en renta/valor/riesgo,
  integración con reparación, proyección y persistencia.
- WP3.7 tiene implementadas aseguradora independiente, coberturas comparables, primas inicial y
  recurrente, exclusiones, franquicia, límites, caducidad por impago, claims trazables y
  persistencia.
- WP3.8 tiene implementados usos por zoning, riesgo regulatorio visible, permisos municipales,
  aprobación/denegación determinista, caducidad, renovación automática de rutina y persistencia.
- WP3.9 tiene implementados default con subasta, pujas reservadas, empate/retirada, ejecución
  atómica, refinanciación limitada y persistencia. La insolvencia colectiva avanzada sigue fuera
  del slice.
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
La investigación y el baseline de preproducción están documentados en `docs/art/` y `docs/research/05-art-direction-and-pipeline-research.md`.

Decidido:
- 2.5D isométrico como dirección inicial (D-003);
- Phaser para Gate 1 (D-050).

Propuesto, pendiente de Visual Direction Spike:
- pipeline Blender -> prerender 2D/2.5D;
- EEVEE como render de producción;
- cámara ortográfica 45° / ~30° y footprint 2:1;
- grid 128×64 con master 2×;
- escala física aproximada de celda;
- lighting rig canónico;
- estética de realismo estilizado;
- setting visual 1925–1940;
- personajes de 8 direcciones;
- atlas 2048² multipack;
- PNG RGBA como baseline runtime;
- Git LFS para fuentes grandes;
- Art Lab + golden scenes + Playwright.

Pendiente:
- ejecutar 2–3 direcciones visuales originales;
- elegir estilo final y época exacta;
- ratificar cámara, tile metrics y escala;
- medir animation budget;
- validar budgets de textura, memoria y descarga;
- seleccionar packer definitivo compatible con contribución abierta;
- implementar y validar scripts/templates contra Blender 5.2.2 LTS;
- definir tipografías y licencias;
- aprobar política de assets generados/asistidos por IA;
- decidir cuándo aplicar compresión GPU y variantes HiDPI;
- decidir si el repositorio artístico debe separarse al crecer;
- diseñar Building Factory y su schema de presets;
- diseñar Character Factory y reglas de variación offline;
- definir estructura third-party y política de incorporación de la librería bootstrap;
- decidir política Git LFS antes de versionar binarios externos;
- probar importación/normalización de Quaternius/Kenney en Blender 5.2.2;
- validar que el Landlord Style Layer unifica assets de proveedores distintos.

## Legal
- clearance de marca;
- revisión final de similitud.

## Regla
No rellenar estos huecos de forma irreversible sin una decisión explícita, un spike o datos de playtesting.
