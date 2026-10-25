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

Implementado en WP4.1/WP4.3/WP4.7/WP3.9: precio de parcela por perfil y seed, oferta/demanda
segmentada, elasticidad de renta acotada, venta y subasta de activos con fianza y ejecución.

Sigue abierto:
- fórmula de valor de suelo a largo plazo (hoy el precio es un dato de generación, no un mercado de
  suelo);
- coste de oportunidad de mantener solares vacíos;
- política de suelo público y recalificación (ver Urbanismo).

## Producción física

Implementado en D-062 y WP3.2: fábricas construibles, aptitud de parcela por recurso, mercado de
materiales como alternativa, integración con crews/condición/fuego/sabotaje/reparación y upgrades.

Sigue abierto:
- catálogo definitivo de instalaciones por bioma/perfil;
- logística y contaminación;
- migración de instalaciones legacy más allá de `InvestInProduction`.

## Fiscalidad

Implementado en WP3.5/WP4.5/WP4.6: contribución y transmisión, tasa por unidad ocupada, tesorería
municipal, exenciones, modificadores de ordenanza, atrasos, presupuesto por prioridad y niveles de
servicio.

Sigue abierto:
- tipos legales ajustables por el jugador (hoy sólo cambian por ordenanza del catálogo);
- impuestos locales adicionales (basuras, plusvalía, IBI comercial);
- regionalización de tasas y varias jurisdicciones;
- incidencia fiscal sobre el precio del suelo.

## Finanzas y banca

Implementado: banco independiente, garantía, oferta, desembolso, amortización, mora, default con
subasta, pujas reservadas, refinanciación limitada, reputación crediticia y persistencia (WP3.4,
WP3.9, WP4.8).

Sigue abierto:
- insolvencia colectiva y reestructuración avanzada;
- equity, inversores y mercado secundario de deuda;
- covenants y loan-to-value dinámicos;
- segundo prestamista.

## Sociedad y empleo

Implementado en WP4.3/WP4.4: hogares con segmento, presupuesto, tamaño, satisfacción y ciclo de
búsqueda; mercado laboral agregado con salario e ingreso por segmento conectado a la asequibilidad.

Sigue abierto:
- commuting explícito por agente (hoy el empleo es agregado);
- cualificación y formación;
- migración entre distritos;
- sindicatos y huelgas;
- ciclo de vida del hogar y re-alojamiento de desplazados (hoy quedan fuera del censo y del mercado).

## Política

Implementado en WP4.11: concejo ficticio de nueve escaños, elección cada seis meses, cinco ejes de
opinión, participación por queja, partidos data-driven, debate de ordenanza, alineamiento del
concejo y transferencia al presupuesto.

Sigue abierto:
- corrupción y financiación de campañas;
- candidatos con identidad propia y campaña mediática;
- número de concejales y sistema electoral configurables (hoy constantes de institución);
- perspectiva política jugable;
- renovación legislativa compleja y coaliciones;
- playtest que valide si el clima político se lee.

## Servicios públicos

Implementado en WP4.5/WP4.6: administración, seguridad, transporte y limpieza; cobertura radial,
saturación por crecimiento, tasa por unidad ocupada y recortes con nivel de servicio.

Sigue abierto:
- concesiones y ownership público/privado de la red;
- servicios adicionales (agua, salud, educación);
- efecto explícito sobre migración y precio del suelo más allá de la deseabilidad;
- edificios de servicio en el mapa.

## Información

Implementado en WP4.9: registro de accesos público/propio/inferido/privado, expediente por
observador, cuatro clases de estimación con error y antigüedad, coste y cooldown, y pruebas de fuga.

Sigue abierto:
- el registro es un contrato declarado, **no un interceptor**: una regla nueva puede leer un
  observable privado sin que el compilador lo impida;
- segundo observador (perspectiva ciudadana/criminal);
- desinformación deliberada y fuentes que mientan de forma sistemática;
- expediente de inteligencia propio de las facciones (DEFERRED en WP4.10);
- retención y auditoría de accesos.

## Reputación y relaciones

Implementado en WP4.8/WP4.11-H/WP4.11-H.1: tres grupos con valoraciones distintas, hechos con
magnitud topada, memoria acotada, decaimiento sólo de la opinión pública, banca neutral ante
desalojos y `violent_sabotage` atribuido al agresor **sólo si el sabotaje quedó públicamente
atribuido** (`publiclyAttributedOrganizationId`); la autoría real vive en `causedByOrganizationId` y
no mancha a quien nadie vio (D-076).

Sigue abierto:
- más grupos o dimensiones (hoy residents, municipality, banks);
- blackmail/debt/fear/trust;
- relaciones bilaterales ricas más allá de la postura escalar de facciones;
- efectos reputacionales de terceros (medios, rumores);
- la onda expansiva de un colapso no propaga la atribución al incidente secundario (`blast`), así que
  las víctimas indirectas de un saboteador visto no cuentan contra él;
- investigar un sabotaje no atribuido para convertir `causedByOrganizationId` en atribución pública.

## IA

Implementado: utilidad determinista, dos perfiles de facción, postura por encuentro, memoria
antirrepetición, cota de información y puja modulada por hostilidad (WP4.10).

Sigue abierto:
- planificador de secuencias de más de un tick (disparador: cualquier decisión que necesite reservar
  caja para una subasta futura);
- expediente de inteligencia como entrada de la IA (DEFERRED);
- varias facciones autónomas con repertorios propios (DEFERRED);
- personalidad más allá de dos perfiles y barrido de parámetros;
- IA delegada para organizaciones del jugador;
- comportamiento criminal autónomo del rival.

## Rendimiento y Alpha

- El cierre mensual de 800 parcelas es la frontera cara: p50 ~28 ms, p95 ~37 ms y máximo ~38 ms frente a
  un tick ordinario con p95 ~0,08 ms, y `housing` concentra ~69 % del cierre (D-065, corregido de métrica
  en D-076: el antiguo "p95 mensual" era el máximo de un solo cierre en una ventana de seis ticks). **La
  distribución es PROVISIONAL**: `measureMonthlyCloses` entrega hoy 8 layouts × 3 posiciones sintéticas
  del reloj, no 24 campañas longitudinales, así que las muestras 2 y 3 no han vivido el cierre anterior y
  llegan con préstamos (`nextPaymentTick`), buscadores y stock en su estado de siembra. La asimetría y la
  concentración en `housing` son firmes; las magnitudes absolutas, no. Cruza el presupuesto p95 y el
  disparador de 5 ms, y desde D-076 cruzarlo **abre remediación obligatoria**: cuatro pasos en orden
  antes de WP4.13 — (1) reescribir `measureMonthlyCloses` como campaña longitudinal real (recomendado 8
  semillas × 6-12 cierres para separar mes 1 / meses 2-3 / meses maduros 4-12), (2) volver a medir y
  publicar el baseline definitivo, (3) optimizar `placeSearchers` exacto (O(búsquedas × unidades) en el
  cierre) preservando los diez digestos, (4) re-medir y sólo si sigue fuera, evaluar LOD. WP4.12 no debe
  añadir trabajo nuevo al cierre sin volver a medir, entendido ya como "medir longitudinalmente".
- El estado canónico completo hace más caras las campañas headless largas (la de dos años tarda
  ~5 s); no afecta al tick de producto.
- El fixture del smoke Alpha es un snapshot versionado de 160 KB y debe regenerarse con los goldens.
- Tuning pendiente: 15 números políticos, perfiles de facción y márgenes de información elegidos a
  mano, sin barrido.
- Playtest instrumentado de 30–60 minutos diferido por D-063; debe ejecutarse antes de WP4.16.

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
