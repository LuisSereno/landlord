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

Implementado en WP4.1/WP4.3/WP4.7/WP3.9 y V.d.4/V.d-H1: precio de parcela por perfil y seed,
oferta/demanda segmentada, elasticidad de renta acotada, venta y subasta de activos con fianza y
ejecución. `baseLandValue`/`marketValue` con score entero desglosado, límite mensual del 5 % y
derechos adquiridos del ensayo de corredor; desde H1-09 el valor consume el `CoverageIndex` de los
servicios de V.d.5 y la densidad realmente vigente, sin sumar dos veces las amenidades cívicas.

Sigue abierto:
- coste de oportunidad de mantener solares vacíos;
- recalificación y política de suelo público más allá del programa municipal autorado (ver Urbanismo);
- incidencia de la fiscalidad sobre el precio del suelo, hoy canalizada sólo por la deseabilidad.

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

Implementado en WP4.5/WP4.6, V.d.3, V.d.5 y V.d-H1: administración, seguridad, transporte y limpieza;
equipamientos municipales físicos (14 por ciudad, con su parcela y sus edificios) operados por el
ayuntamiento; cobertura de seguridad y transporte calculada por grafo de viaje con gateways, demanda
asignada a la facility alcanzable de menor coste y capacidad efectiva modulada por presupuesto; desde
H1-05 un equipamiento sin edificio operacional aporta capacidad 0, y desde H1-06 la limpieza —única
excepción radial declarada— se calcula por distrito.

Sigue abierto:
- **escala del programa municipal:** 14 equipamientos para ~709 parcelas comercializables deja 100
  parcelas con cobertura de seguridad y 12 de 14 equipamientos saturados de forma permanente (medido
  en la campaña de 24 meses). Es el resultado de las capacidades fijas al autorar la receta municipal,
  no un defecto de integridad; cambiarlo necesita decisión del responsable;
- mantenimiento municipal de los equipamientos y su efecto presupuestario;
- concesiones y ownership público/privado de la red;
- transporte como oferta de viajes más allá del coste de grafo.

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

## Automatización (WP4.13)
- La delegación sólo cubre la organización del jugador; no hay gestores automáticos para el rival ni
  para terceros, ni una segunda perspectiva jugable.
- `ControlContext` no se implementa: no existe un consumidor real; la autorización sigue en
  `controlGrants` persona→organización.
- Ritmo acotado por diseño: el gestor de propiedad resuelve hasta 3 asignaciones/día y el de
  mantenimiento 1 reparación/día. Con carteras grandes queda cola (medido: 17 de 121 plazas a 800
  parcelas en 10 días); subir el tope es una decisión de balance, no un defecto.
- El gestor financiero no renegocia deuda existente ni cubre descubiertos si ya hay deuda viva.
- LOD de gameplay: no se introdujo maquinaria nueva; `buildStock` (O(edificios²)) sigue siendo el
  hotspot medido antes de aproximar.

## Arte (WP4.15)
- Los assets de Alpha son placeholders procedurales (SVG en data URI); el arte final Blender usa el
  mismo contrato `RuntimeAssetManifestV1` pero no se ejecuta en CI ni se versionan binarios.
- Los personajes se animan y comparan 4 vs 8 direcciones en el Art Lab, pero la escena jugable
  conserva el blitter de agentes hasta que exista un LOD de personaje medido.
- Estrategia de atlas: una textura por frame SVG en runtime para Alpha; el atlas raster final exige
  decidir almacenamiento (LFS) y empaquetado.
- La comparación visual estricta contra el baseline SHA-256 es opt-in; el antialiasing puede variar
  entre runners.
- El perfil de 400 sprites mide pintado DOM, no el frame Phaser; el frame del juego sigue cubierto por
  `pnpm benchmark:browser`.

## Cámara y Art Lab — cierre verificado (WP4.15-H.1)

- **Implementado:** picking con `camera.getWorldPoint`, pan dividido por zoom y wheel anclado al cursor; el smoke Alpha cubre clic real a 0.5/1/2/2.5x, pan y pan+zoom sobre Phaser.
- **Assets/Vite:** el manifest Blender vive en `src/generated/`; `public/` conserva sólo PNG y un check arquitectónico rechaza futuros imports TypeScript desde `public/`.
- **Art Lab:** herramienta Asset QA con building states/metadatos, comparación procedural vs Blender, Character QA, Technical QA y archivo visual secundario; `graphic_civic` sigue aprobada.
- **Regresión visual:** `pnpm art:visual` es local-only; CI conserva `smoke:art-lab`, `art:blender:check` y `art:binaries:check`.
- **Verificación completada:** browser smokes, `art:visual` y golden regenerados; CI remoto pendiente de push.
- Brief completo: `docs/execution/phase-4/wp4-15-h-1-camera-artlab-hardening-2026-10-26.md`.

## Balance (hallazgo WP4.14, revisado 2026-10-25)
- **Dos datasets, no uno.** `docs/balance/synthetic-city-balance-v1.json` (antes
  `alpha-baseline-v1.json`) viene de `createScaledCity`: es un **arnés de carga** con 5 000 000 de caja
  y activos regalados, útil para invariantes y volumen, y **no** es una baseline de balance de gameplay.
  La baseline jugable es `docs/balance/playable-alpha-baseline-v1.json` (`pnpm balance:playable`,
  `createInitialState(seed)`, 12 000 de caja, 16 semillas × 12 meses × 4 estrategias, sólo comandos
  reales del jugador, 62-68 s).
- El mantenimiento equilibrado **no está dominado**: es una **señal fuerte para investigar**. La
  dominancia se afirmó desde el arnés de carga (0/8 semillas a favor, 31,84 % de vacancia frente a
  3,13 % y menos caja), donde `financeCashFloor` nunca se activa y las cajas quedan en 4,8–5,0
  millones. En la campaña jugable `maintained` gana a `passive` en 4 de 16 semillas (pierde en 12), por
  debajo del umbral de dominancia de 15/16, y convierte el gasto en activos: 4,00 edificios frente a
  3,13 y 15 712,56 de valor de catálogo frente a 12 375,31. La bandera
  `maintenance_balanced_dominated_on_cash` sólo describe el arnés; la jugable usa
  `maintenance_balanced_cash_signal_to_investigate`.
- **La caja final no es riqueza.** La rutina de crecimiento reinvierte todo lo que puede, así que
  `delegated_balanced` es la peor en caja (1 253,56) y la mejor en valor de catálogo (19 431,88). Toda
  lectura de dominancia sobre `playerCash` debe acompañarse de `playerParcels`, `playerBuildings` y
  `playerAssetBookValue`.
- **Ninguna estrategia domina en la campaña jugable**: ganadoras por semilla `passive` 8,
  `delegated_deferred` 5, `maintained` 2, `delegated_balanced` 1; comparaciones 6/16, 4/16 y 3/16;
  bandera `no_dominant_strategy_in_playable_campaign`. La delegación elimina la vacancia medida (0 %
  frente a 6,25 %) y añade 500 de deuda viva, pero no compra caja por sí sola
  (`automation_deferred_has_no_cash_advantage_playable`); el 8/8 del arnés no se traslada a la partida.
- Sin invariantes rotas ni préstamos impagados en las 64 campañas jugables y cero rechazos de comandos
  (`commandAudit` por estrategia y tipo lo acredita).
- Regenerar tras cualquier cambio económico: `pnpm balance:playable` y `pnpm balance:campaign`, y
  `node scripts/build-balance-dataset.mjs <log> <dataset.json> --dataset playable|synthetic`; comparar
  con los dos archivos de `docs/balance/`.
- Pendiente de tuning, ahora con datos jugables: coste y recuperación del mantenimiento equilibrado, y
  el ritmo de reinversión de la rutina frente a la caja disponible.
- **Actualización V.d-H1 (2026-10-29).** `pnpm balance:playable` corre hoy sobre la ciudad 3×3 completa
  (64 campañas, 4 estrategias × 16 seeds, 0 rechazos de comandos) y **sí** registra una estrategia
  dominante por caja: `delegated_deferred` gana en 16/16 seeds (`anyDominant: true`, umbral 15/16). La
  misma corrida sobre `95e8937` da el mismo resultado, así que no la introdujo el hardening. La
  harness la registra, no la afirma como requisito, y queda como señal de balance. La campaña con
  hitos 1/6/12/18/24 es `packages/simulation/src/h1-campaign-24-months.test.ts`.

## V.d-H1 — integridad urbana y cierre de V.d (2026-10-29)

- **V.d NO está cerrada.** El único requisito que falta es humano: la partida de §2.4 está en
  `docs/execution/phase-4/vd-final-playtest-checklist.md` como `PENDING HUMAN PLAYTEST`. El smoke
  automatizado del núcleo (`pnpm smoke:vd-core-loop`) recorre los 19 pasos por la interfaz real, pero
  no mide comprensión ni fricción y **no** sustituye esa sesión.
- Corregidos y con test los diez hallazgos H1-01…H1-10 (D-093); añadidos las doce city seeds canónicas,
  la campaña instrumentada de 24 meses con hitos y `RuntimeAssetManifestV2`.
- **Guardados:** un `SnapshotV2` anterior a H1 (permisos indexados por parcela) se rechaza por nombre
  con `UnsupportedPermitContractError` y no se migra. Es la tercera incompatibilidad declarada tras v1
  (D-089) y pre-V.d.1 (D-090); ninguna se resuelve con rellenos.
- **Deuda de rendimiento que sigue viva:** el primer cierre del mes construye el grafo de servicios una
  vez (~312 ms p95 medidos en V.d.5) y los siguientes reutilizan caché. Es un hitch de carga, no un
  coste recurrente; se conserva como deuda declarada y no se optimizó cambiando reglas.
- **Deuda de balance medida y no parcheada:** escala del programa municipal (ver Servicios públicos) y
  `delegated_deferred` dominante en la campaña jugable. Reproducida idéntica en `95e8937`, así que
  predato a H1; `balance:playable` la registra pero no la afirma como requisito.
- **Capturas golden:** siguen siendo JPEG de evidencia local, no pixel-diff cross-environment (D-081
  documentó esa inestabilidad).
- **Arte cívico:** los seis edificios cívicos son SVG procedurales originales; la ruta Blender puede
  sustituirlos sin tocar el contrato runtime, que ya declara huella de dominio y orientaciones.
- **Conservado a propósito:** los guards de jugabilidad específicos por perfil introducidos después de
  V.d.3. No volver a un límite global del 85 %.

## Rendimiento y Alpha

- El cierre mensual de 800 parcelas es la frontera cara. Medido como campaña longitudinal real en
  WP4.12-R (`measureMonthlyCloses`, una ciudad por semilla que vive sus cierres en secuencia):
  `natural` 8 semillas × 6 cierres da media 30,12 ms, p50 29,01 ms, p95 40,87 ms y máximo 48,53 ms,
  frente a un tick ordinario con p95 0,079 ms. El desglose por maduración (mes 1 30,97 ms · meses 2-3
  29,25 ms · maduros 4+ 30,41 ms) no muestra degradación con la edad: el coste es estructural del
  cierre. A/B con la misma metodología: sin shocks 28,44 ms de media; tres shocks representativos
  33,64 ms; los seis permitidos 37,60 ms. El delta de los shocks es económico —más vacancia y más
  buscadores que el cierre recorre—, no del lookup de modifiers, que está acotado a seis eventos.
  **Sigue fuera del presupuesto p95 y del disparador de 5 ms de D-065.**
- La optimización exacta de `placeSearchers` está hecha (D-065/D-076, acta del 2026-10-25) y también
  la de `buildStock` (WP4.15-H, misma fecha): el recuento de vecinos dentro del radio pasó de
  todos-contra-todos a un índice espacial de buckets con test de equivalencia contra el barrido
  completo; los diez digestos no cambian y `describeHousingStock` baja de 17,6 ms a 2,70 ms de mediana
  con 607 edificios (coste por edificio decreciente con la escala). El cierre mensual queda en
  `none` 15,50 ms de media (p95 17,13), `representative` 17,34 ms, `max` 18,94 ms (p95 19,18) y
  `natural` 16,48 ms de media. **Sigue fuera del presupuesto p95 y del disparador de 5 ms de D-065**,
  pero ya sin hotspot único: el cierre instrumentado reparte ~11 ms entre sistemas (`housing` 3,9 ms
  el mayor). Con los dos cuadráticos conocidos optimizados de forma exacta, la decisión de LOD
  agregado con su benchmark pertenece a WP4.16, que la lleva como precondición documentada.
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

Cerrado tras el spike (WP2.14, 2026-10-23) y WP4.15/WP4.15-H (2026-10-25):
- cámara ortográfica 45°/~30°; Art Lab + golden scenes + Playwright, con regresión visual por
  pixel-diff tolerante ejecutada en CI (D-081);
- ruta Blender -> render -> trim -> metadata -> Phaser, demostrada de extremo a extremo para un
  edificio y una variante de personaje con bundle versionado y verificado (D-081);
- atlas 2048² multipack, texture packing y Git LFS: reclasificados como requisitos de Beta con
  criterio de reapertura medido y presupuesto de binarios con guarda en CI (D-081).

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
