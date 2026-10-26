# Fase 4 — Alpha sistémica

## Objetivo

Escalar el vertical slice a una ciudad con sistemas conectados, suficiente variación entre partidas y herramientas de balance. Esta fase construye el sustrato que podría soportar perspectivas futuras, pero el jugador sigue operando principalmente como empresario/promotor.

Duración orientativa existente: 16-24 semanas; 600-900 jornadas-persona.

## Criterios de entrada

- Vertical slice validado y financieramente legible.
- Arquitectura y rendimiento soportan crecimiento medido.
- Sistema de datos y migraciones estable.
- Problemas de micromanagement del slice resueltos o con plan probado.

> Excepción D-063 (2026-10-23): el responsable adelanta la producción de contenido de Fase 4
> sin la medición de sesiones reales que exigía el acta de WP3.15. La instrumentación
> persistente de cohortes/seed queda diferida y debe ejecutarse antes del cierre de Alpha
> (WP4.16). Los WPs se ejecutan incrementalmente con plan y checks por WP.

## WP4.1 — Distritos y generación reproducible

**Estado 2026-10-23:** `DONE`. Evidencia en
`docs/execution/phase-4/wp4-1-districts-generation-2026-10-23.md` y decisión de diseño en
`docs/engineering/adr/D-064-generacion-procedural-de-distritos.md`.

- Definir perfiles de distrito data-driven y composición propia.
- Generar topología, parcelas y parámetros desde seed.
- Validar jugabilidad mínima: accesos, suelo disponible y distribución económica.
- Separar identidad persistente del distrito de su representación visual.
- Añadir herramientas para inspeccionar/reproducir seeds problemáticas.
- Añadir fixtures de generación y hashes de resultado.

**Aceptación:** misma versión/seed genera el mismo distrito; variación no rompe el core loop.

## WP4.2 — Simulation LOD

**Estado 2026-10-23:** `DONE` con LOD agregado deliberadamente latente. Evidencia en
`docs/execution/phase-4/wp4-2-simulation-lod-2026-10-23.md` y decisión en
`docs/engineering/adr/D-065-coste-del-tick-y-lod-latente.md`. Se mide el coste por sistema y escala,
el crecimiento de barrio a ciudad es sublineal (exponente 0,74 en la media) y ninguna optimización
cambia el estado resultante. Ningún sistema excede los umbrales en la ciudad máxima factible (p95
0,1152 ms frente a 10 ms), así que la regla "implementar sólo para los sistemas que excedan budgets"
deja el estado agregado en diseño documentado con disparadores objetivos.

- Medir coste por sistema y entidad antes de agregar.
- Clasificar zona activa, cercana y lejana.
- Definir estado agregado por sistema y reglas de transición.
- Implementar sólo para los sistemas que exceden budgets.
- Probar conservación económica y coherencia al reactivar.
- Comparar resultado agregado frente a detallado dentro de tolerancias documentadas.

**Aceptación:** ampliar la ciudad no degrada linealmente el tick y no duplica/destruye valor al cambiar de LOD.

## WP4.3 — Oferta y demanda de vivienda

**Estado 2026-10-23:** `DONE`. Evidencia en
`docs/execution/phase-4/wp4-3-housing-market-2026-10-23.md` y decisión en
`docs/engineering/adr/D-066-mercado-de-vivienda-segmentado.md`. La demanda pasa a estar segmentada
en hogares, artesanos y comerciantes con presupuesto, tamaño, acoplamiento al empleo y preferencias
de edificio propias; la ocupación se limita por techo de población, plazas libres y plazas
asequibles, y el índice de renta se descubre por vacancia con paso y banda acotados. La evidencia
económica anterior se comparó observable por observable y no cambió; sólo se regeneraron los
digestos canónicos porque el estado persiste campos nuevos.

- Evolucionar pool de tenants a demanda segmentada.
- Definir hogares al nivel mínimo que produzca decisiones: renta, tamaño, empleo/preferencias.
- Modelar vacancy, asequibilidad y movilidad.
- Ajustar rentas/precios mediante reglas estables y acotadas.
- Conectar calidad, accesibilidad, seguridad y servicios.
- Añadir tests de shocks, falta de oferta y ausencia de demanda infinita.

**Aceptación:** construir más no garantiza ocupación; precios y vacancy responden a condiciones explicables.

## WP4.4 — Empleo y actividad económica

**Estado 2026-10-23:** `DONE`. Evidencia en
`docs/execution/phase-4/wp4-4-employment-2026-10-23.md` y decisión en
`docs/engineering/adr/D-067-empleo-agregado-y-capacidad-de-alquiler.md`. El mercado laboral es
agregado: puestos por planta productiva operativa, trabajadores por hogar contratado e índice
salarial acotado que se propaga al ingreso por segmento y al presupuesto de renta. Un cierre de
planta encadena paro, salario, ingreso, asequibilidad y vacancia sin regla de evento específica. La
evidencia económica anterior se comparó observable por observable y no cambió.

- Modelar negocios que demandan puestos y hogares que ofrecen trabajo de forma agregada o individual mínima.
- Definir salario/ingreso y conexión con capacidad de alquiler.
- Conectar cierres/aperturas con demanda residencial.
- Evitar simulación individual sin valor jugable.
- Añadir indicadores de empleo, salarios y commuting/accesibilidad.
- Probar desempleo, escasez laboral y shocks sectoriales.

**Aceptación:** empleo afecta vivienda, población y rentabilidad sin crear un simulador laboral completo.

## WP4.5 — Presupuesto municipal

**Estado 2026-10-23:** `DONE`. Evidencia en
`docs/execution/phase-4/wp4-5-municipal-budget-2026-10-23.md` y decisión en
`docs/engineering/adr/D-068-presupuesto-municipal.md`. El municipio usa una sola caja —el saldo de
su organización— y un libro con ingresos por fuente, gasto y descubierto por categoría. Paga por
prioridad (administración, seguridad, servicios) al final del tick; sin caja recorta y publica
niveles de servicio que reducen la deseabilidad del mercado de vivienda. Ocho de los diez casos de
conservación quedan idénticos; los dos que cruzan un cierre mensual sólo cambian en la caja
municipal y en sus propias transacciones.

- Modelar Government independiente con ingresos, gastos y reservas.
- Enrutar impuestos/tasas al beneficiario correcto.
- Definir ciclo presupuestario y categorías prioritarias.
- Evitar dinero municipal implícito o infinito.
- Mostrar presupuesto agregado e impacto de decisiones al jugador según información pública.
- Probar recaudación, déficit, recortes y persistencia.

**Aceptación:** las políticas fiscales tienen contraparte presupuestaria y trade-offs observables.

## WP4.6 — Servicios urbanos y accesibilidad

**Estado 2026-10-23:** `DONE` con el overlay de mapa diferido a WP4.15. Evidencia en
`docs/execution/phase-4/wp4-6-urban-services-2026-10-23.md` y decisión en
`docs/engineering/adr/D-069-servicios-urbanos-y-cobertura.md`. Transporte, seguridad y limpieza
tienen coste municipal, cobertura radial desde el centro del distrito y capacidad que se satura al
crecer; alimentan accesibilidad, seguridad y calidad del parque, y la tasa por unidad ocupada
sostiene el presupuesto. El dato de cobertura se publica en la proyección y se explica en el panel;
la capa visual sobre el mapa queda para el WP de representación.

- Priorizar pocos servicios con feedback económico claro: transporte, seguridad, limpieza u otro conjunto aprobado.
- Definir cobertura/capacidad/calidad y coste municipal.
- Conectar servicio con atractivo, suelo, actividad o riesgo.
- Modelar accesibilidad a nivel adecuado al rendimiento.
- Añadir overlays y explicación causal.
- Probar capacidad saturada, expansión, recorte y desigualdad territorial.

**Aceptación:** invertir o recortar servicios altera ciudad y base fiscal; no son simples buffs decorativos.

## WP4.7 — Contratos públicos

**Estado 2026-10-23:** `DONE`. Evidencia en
`docs/execution/phase-4/wp4-7-public-contracts-2026-10-23.md` y decisión en
`docs/engineering/adr/D-070-contratos-publicos.md`. El municipio es la autoridad: licita en el mes 2
y cada 3 meses, con dos objetos (obra pública, que exige edificios operativos, y suministro), ventana
de ofertas de un mes y máximo dos contratos activos. Gana la oferta más baja con desempate por
identificador; la fianza del 10 % se transfiere a la caja municipal, se devuelve al completar y se
retiene al incumplir, y el ciclo conserva el dinero total. La ejecución es un mes después del cierre y
se reintenta si la autoridad no tiene tesorería. El rival compite a través del mismo
`SubmitPublicBid`, sin privilegios. El cumplimiento queda como contadores
(`awarded`/`completed`/`defaulted`), la base que WP4.8 convertirá en reputación. Concesiones, hitos y
pliegos configurables siguen fuera de alcance.

- Definir autoridad, objeto, requisitos, ofertas, adjudicación y ejecución.
- Validar capacidad y conflictos básicos.
- Hacer competir a organizaciones IA bajo las mismas reglas.
- Conectar cumplimiento con caja y reputación.
- Mantener concesiones complejas fuera de alcance.
- Probar licitación sin ofertas, empate, incumplimiento y save/load.

## WP4.8 — Reputación multidimensional y relaciones

**Estado 2026-10-24:** `DONE`. Evidencia en
`docs/execution/phase-4/wp4-8-reputation-2026-10-24.md` y decisión en
`docs/engineering/adr/D-071-reputacion-multidimensional.md`. Tres grupos con salida real, no ocho
barras: los residentes multiplican la deseabilidad del parque del casero (80–108 %), el gobierno fija
la influencia que deposita en cada empresa al cerrar el mes (0–3) y la banca ajusta la tasa base del
préstamo (−100…+250 pb). La memoria son hechos acotados —`kind`, `atTick`, `referenceId`, magnitud con
tope y el delta aplicado por grupo—, máximo 16 por organización y posición limitada a ±100. Un mismo
hecho se valora distinto: desplazar hogares resta ante vecinos y gobierno y suma ante la banca, que es
la aceptación del WP. *(Corregido por D-075/WP4.11-H: el desalojo dejó de sumar ante la banca —`banks 0`,
el +1 sin decaimiento era un descuento permanente comprable con desahucios—; el cruce entre grupos se
sigue probando, hoy con `contract_completed` (+2 banca) frente a `violent_sabotage` (−2 banca).)* Decae sólo la opinión (3/mes vecinos, 2/mes gobierno); el historial crediticio no
se borra con el tiempo. Empresarios, policía, sindicatos, criminales y medios quedan fuera hasta que
exista el canal que los consuma, y las relaciones entre organizaciones y la información imperfecta
pertenecen a WP4.9 y WP4.10.

- Elegir grupos/dimensiones con efecto real; evitar score universal.
- Registrar hechos relevantes como entradas de memoria acotadas.
- Definir decay sólo donde tenga sentido y sea testeable.
- Conectar reputación con financiación, tenants, gobierno o facciones.
- Separar hecho, percepción e información disponible.
- Probar valoraciones distintas del mismo actor.

**Aceptación:** una acción puede mejorar reputación con un grupo y empeorarla con otro.

## WP4.9 — Información imperfecta

**Estado 2026-10-24:** `DONE`. Evidencia en
`docs/execution/phase-4/wp4-9-information-2026-10-24.md` y decisión en
`docs/engineering/adr/D-072-informacion-imperfecta.md`. Cuatro accesos declarados en un registro central
(`public`, `own`, `inferred`, `private` sobre ~34 observables) donde el mismo número cambia de acceso
según de quién sea. La verdad privada la lee un único sitio, `trueValueFor`, que sólo usan el generador
de estimaciones y las pruebas. Cuatro cifras que valen una decisión —caja, deuda viva, impuestos
adeudados y puja prevista— con dos canales: `contacts` cuesta 150 u., enfría un mes y yerra ±6…±12 %;
`market` es gratis, yerra ±25…±50 % y sólo re-basa lo que ya se siguió y caducó hace tres meses. La
precisión envejece 2 puntos por mes hasta el suelo del 5 %. El expediente pertenece a un observador y el
juego lo serializa sin la cifra verdadeira; el ruido sale de un arroyo de PRNG propio, así que ningún
digesto dorado se mueve. Queda probado con un centinela privado que no aparece en la proyección y con
una partida cuyas creencias se envenenan y produce el mismo libro de contabilidad. El registro no filtra
automáticamente y el rival sigue leyendo el mundo completo: ambas correcciones pertenecen a WP4.10.

- Clasificar datos públicos, propios, inferidos y privados.
- Definir `information scope` sin implementar aún UI multirol completa.
- Crear mecanismos de análisis/contactos/investigación limitados.
- Representar precisión o antigüedad de estimaciones.
- Evitar que IA y UI lean el estado autoritativo completo.
- Probar filtraciones y ausencia de datos privados en proyecciones.

**Aceptación:** el jugador puede pagar por una cifra del rival y recibirla equivocada, y ni la
proyección ni ninguna regla contienen el dato privado del que salió la estimación.

## WP4.10 — IA estratégica y facciones

**Estado 2026-10-24:** `DONE`. Evidencia en
`docs/execution/phase-4/wp4-10-strategic-ai-factions-2026-10-24.md` y decisión en
`docs/engineering/adr/D-073-ia-estrategica-y-facciones.md`. Dos perfiles de facción con ocho familias de
objetivos, umbrales de reserva, mantenimiento, seguro y puja propios; el conservador reproduce exactamente los
números históricos, así que la comparación entre campañas es medible. Las relaciones sólo nacen de encuentros
que ocurren en el mundo —sabotaje, desbanco en subasta, licitación competida y roce territorial con la trama
real a una o dos celdas—, decaen 3 puntos al mes hacia cero y se borran al llegar. La memoria guarda doce
acciones con su destino, su resultado y su código de rechazo en una ventana de tres meses, y la antirrepetición
escala: −60 de utilidad al segundo rechazo y salida del menú al tercero. La campaña headless fue la que cambió
el diseño —sólo penalizar dejaba al rival con 101 acciones fallidas en doce meses golpeando la misma parcela;
con la supresión cierra con 12 y 190 ciclos cortados—. No hay planificador porque no hay secuencia que lo
necesite. `phase2.factions` es opcional y ningún perfil ni postura sale hacia la proyección: siete observables
privados del jugador alterados no mueven la decisión del rival.

- Introducir perfiles de facción con objetivos, recursos, relaciones y memoria.
- Añadir planner sólo para secuencias que utility aislada no resuelva.
- Hacer que facciones interactúen entre sí.
- Incorporar empleo, demanda, presupuesto, reputación e información parcial.
- Añadir detección de ciclos y antirrepetición.
- Ejecutar campañas headless, comparar estrategias y detectar cheats/invariantes rotos.

**Aceptación:** dos perfiles con la misma semilla terminan con carteras y caja distintas, y un bucle de
acciones rechazadas se corta solo en vez de repetirse hasta que el mundo cambie; ninguna postura ni perfil del
rival aparece en la proyección del jugador.

## WP4.11 — Política y elecciones iniciales

**Estado 2026-10-24:** `DONE`. Evidencia en
`docs/execution/phase-4/wp4-11-municipal-politics-2026-10-24.md` y decisión en
`docs/engineering/adr/D-074-politica-y-elecciones-municipales.md`. Concejo ficticio de nueve escaños, legislatura
de seis meses y debate dos meses después de la elección. La opinión son cinco ejes —vivienda, empleo, seguridad,
servicios e impuestos— calculados cada mes desde subsistemas que ya existían, sin estado social nuevo: la renta
frente al presupuesto de renta del hogar, la tasa de empleo del distrito, la presión policial con sus ruinas y
siniestros, el nivel de servicio realmente pagado y la recaudación del mes sobre la renta que paga el distrito.
Este último eje se definió como carga vivida y no como tipos legales después de medir: ninguna ordenanza del
catálogo sube tasas, así que un eje de tipos habría quedado clavado en 100 para siempre, y eso obliga a que
`politics` cierre el mes justo antes que `municipal`, que es quien vuelca la recaudación. La saliencia por
segmento es un dato, la apelación de un partido es la media ponderada de sus posiciones sobre los asuntos que
duelen y el que gobierna pierde una fracción proporcional a lo mucho que prometió en los asuntos rotos. La
participación sube con la queja (58 % tranquilo frente a 64 % degradado en la ciudad de 24 parcelas) y los escaños
se reparten por resto mayor. La transferencia institucional tiene tres canales sobre reglas existentes: el orden de
pago del presupuesto pasa a ser el del partido que gobierna, el concejo intenta imponer su propia ordenanza
posponiendo el debate un mes si otra ley ocupa la mesa, y el alineamiento modula ±25 puntos la probabilidad del
`LobbyPolicy` —la misma ley con la misma influencia sale 65 % afín, 48 % hostil—. Son tres plataformas
exclusivamente datos (cinco posiciones, una permutación de gasto, una ordenanza del catálogo y sus escaños de
apertura) y ningún candidato; la nomenclatura ficticia está vigilada por prueba. `phase2.politics` es opcional,
entra por primera vez en `canonicalizeState` y la proyección no publica ni un identificador de hogar.

- Definir instituciones y calendario municipal ficticios.
- Modelar preferencias a partir de vivienda, empleo, seguridad, servicios e impuestos.
- Añadir candidatos/partidos ficticios con posiciones data-driven.
- Conectar opinión, presupuesto y policies.
- Evitar equivalencias directas con partidos reales.
- Probar cambio de apoyo, participación, resultado y transferencia institucional.

**Aceptación:** las elecciones emergen del estado social y no garantizan el resultado deseado por el jugador.

**Verificado 2026-10-24:** en la campaña headless de dos años (ciudad de 24 parcelas, seed 4) el gobierno alterna
por el estado social y no por la jugadora —apertura con la Liga del Trabajo Local, Suelo Común al mes 6 con la
vivienda a 93, vuelta a la Liga al mes 12 cuando el empleo cae a 89 y la renta deja de ser el asunto dominante,
Suelo Común al 18 con el empleo otra vez en 100— y el concejo debate tres veces (meses 8, 14 y 20), falla dos
sorteos y en el 20 pone en vigor una ordenanza que nadie del jugador pidió. Con 0 y con 50 de influencia la
participación, los escaños y el gobernante salen idénticamente; el sistema no mueve ni un saldo ni una
transacción. El resultado no está garantizado en ningún sentido: la ley que el concejo quiere también se sortea.

**Corregido en WP4.11-H (2026-10-25):** el censo electoral ya no incluye `available` ni `displaced`, la tasa de
servicios entra en el eje fiscal con el mismo devengo que la cobra, `canonicalizeState` cubre todos los agregados
Alpha, el benchmark mensual mide el cierre, `lastReason` del rival sale de la proyección, la oferta pública y el
encargo de inteligencia son jugables, la UI usa las cuatro categorías reales y muestra el concejo, una ordenanza
activa no se vuelve a sortear y la duración es única. Ver
`docs/execution/phase-4/wp4-11-h-alpha-systems-hardening-2026-10-25.md` y D-075.

## WP4.11-H — Hardening transversal de los sistemas Alpha

**Estado 2026-10-25:** `DONE` con deuda de rendimiento declarada. No es WP4.12. Evidencia en
`docs/execution/phase-4/wp4-11-h-alpha-systems-hardening-2026-10-25.md` y decisión en
`docs/engineering/adr/D-075-hardening-alpha-sistemica.md`. Baseline `4374c97`, sin commits posteriores
en `origin/main` al iniciar.

- Censo electoral = residentes efectivos; `available` y `displaced` no votan.
- La tasa de servicios entra en `taxesMood` mediante `municipalServiceFee`, sin doble cobro.
- `canonicalizeState` completo y estable; diez goldens regenerados con atribución exacta.
- Referencias de snapshot validadas hasta WP4.11 y partidos validados al restaurar.
- Benchmark `month` cruza el cierre real después del warmup.
- `lastReason`/`lastAction` fuera de la proyección; sólo huella pública.
- `SubmitPublicBid` y `CommissionIntelligence` jugables; UI municipal y panel del concejo.
- Ordenanza activa no re-sorteada; duración única; desplazamiento normalizado; `violent_sabotage`;
  banca neutral ante desalojos.
- CI verde: formato, lint con toolchain vendorizado excluido, typecheck, tests, build y smokes.

**Aceptación:** la baseline no gana funcionalidad de juego nueva y CI `main` queda completamente verde.

**Rendimiento medido:** el cierre mensual de 800 parcelas mide 28,4 ms (housing 65 %, 42,8 ms
instrumentado), cruza el presupuesto p95 de D-065 y su disparador de 5 ms. LOD no se implementa por
alcance; la optimización de `runHousingMarket` queda como deuda antes de WP4.13.

> **Corregido por WP4.11-H.1 (D-076):** aquel "28,4 ms de p95" era el máximo de un solo cierre —la
> ventana `month` tiene seis muestras—, no un p95. El arnés separa ahora `ordinaryTick` y `monthClose` y
> `measureMonthlyCloses` entrega una distribución **PROVISIONAL** sobre 8 layouts × 3 posiciones
> sintéticas del reloj: p50 ~28 ms, p95 ~37 ms, máximo ~38 ms en la ciudad de 800 parcelas, frente a un
> tick ordinario con p95 ~0,08 ms. No son 24 campañas: cada muestra arranca una ciudad nueva y salta el
> reloj, así que las muestras 2 y 3 no han vivido el cierre anterior y llegan con `nextPaymentTick`,
> buscadores y stock en su estado de siembra. La asimetría cierre/tick y la cuota de `housing` quedan
> firmes; las magnitudes absolutas, no. El disparador de D-065 cambia de significado: cruzarlo abre
> remediación obligatoria en cuatro pasos —reescritura longitudinal de `measureMonthlyCloses`, volver a
> medir, optimizar `placeSearchers` exacto y sólo entonces evaluar LOD— así que esa secuencia es previa a
> WP4.13 y WP4.12 no debe añadir trabajo nuevo al cierre mensual sin volver a medir, ya entendido como
> "medir longitudinalmente".

## WP4.11-H.1 — Follow-up de corrección del hardening

**Estado 2026-10-25:** `DONE`, con la deuda de rendimiento que se declara abajo. Responde a la auditoría
humana de WP4.11-H sobre `83cc25a`; no añade gameplay. Evidencia en
`docs/execution/phase-4/wp4-11-h-1-alpha-follow-up-2026-10-25.md` y decisión en
`docs/engineering/adr/D-076-follow-up-hardening-alpha.md`.

- `WithdrawPolicy` sólo retira propuestas: la ordenanza `active` es norma municipal y caduca sola.
- El sabotaje no detectado no mancha al atacante: `publiclyAttributedOrganizationId` manda para la
  reputación, `causedByOrganizationId` queda como verdad del motor.
- D-071, el acta de WP4.8 y el resumen de Fase 4 dejan de prometer `banks +1` por desalojo (última
  entrega de este checkpoint).
- El snapshot comprueba el tipo de organización en los roles de empresa; los tests de canonicalización
  mutan entidades reales y `canonicalizeState` suelta los controles del reloj.
- La tasa de servicios aparece en el panel como cifra prevista, no como el acumulado que siempre vale 0.
- D-065 reescrito con su disparador como obligación de remediación; el cierre medido como distribución y
  la ventana `fire` calentando sin incendios.

**Rendimiento:** antes de WP4.13, en orden: (1) reescribir `measureMonthlyCloses` como campaña
longitudinal real (una ciudad por semilla que vive sus cierres en secuencia; recomendado 8 semillas ×
6-12 cierres para separar mes 1 / meses 2-3 / meses maduros), (2) volver a medir y publicar el baseline
definitivo, (3) optimizar `placeSearchers` exacto en `runHousingMarket` preservando los diez digestos,
(4) re-medir y sólo si el cierre sigue fuera del presupuesto, evaluar LOD. La métrica publicada hoy es
PROVISIONAL: 8 layouts × 3 posiciones sintéticas, no 24 campañas. Ver nota de revisión 2026-10-25 en
`docs/engineering/adr/D-065-coste-del-tick-y-lod-latente.md` y `D-076-follow-up-hardening-alpha.md`.

## WP4.12 — Eventos macroeconómicos

- Definir shocks condicionados y acotados: tipos, escasez, recesión o migración.
- Conectar eventos a sistemas existentes mediante modifiers/eventos, no excepciones dispersas.
- Mostrar señales previas cuando el diseño lo requiera.
- Permitir que IA reaccione.
- Probar inicio, stacking, finalización, save/load y recuperación.

**Estado 2026-10-25:** `DONE` tras WP4.12-R, que reabre el cierre anterior (`50e7f49`) por auditoría
humana. Evidencia en `docs/execution/phase-4/wp4-12-macro-events-2026-10-25.md` y decisión en
`docs/engineering/adr/D-077-macroeventos-acotados.md`.

- Seis tipos con duración en meses del juego (`GAME_MONTH_TICKS`), no en días.
- Cota estructural: un evento por tipo, seis como máximo; agregación O(eventos activos), nunca
  barrido de entidades.
- Trigger mensual determinista con PRNG propio derivado de la seed, sin desplazar el arroyo
  económico; el arroyo y el próximo sorteo viven en snapshot y estado canónico.
- Los seis modifiers tienen consumidor central: materiales (mercado, arranque de obra y proyección),
  renta (`askingRentFor`), demanda y señal de vacancia, deriva salarial y esfuerzo de obra.
- La IA rival sesga su utilidad por familia de objetivos con información pública; la proyección
  publica eventos, intensidad, ventana y efectos agregados.
- Persistencia aditiva con derivación desde la seed para partidas anteriores; diez digestos
  regenerados con atribución verificada (el delta es superficie canónica).
- Benchmark longitudinal con A/B `natural | none | representative | max`, desglose mes 1 / meses 2-3
  / maduros 4+ y muestra por cierre con `tenants`, `buildings`, `vacantSlots` y `loansDue`.

## WP4.13 — Automatización, delegación y Gameplay LOD mínimo

- Medir tareas repetidas en carteras grandes.
- Añadir gestores/políticas/umbrales para propiedad, finanzas y mantenimiento.
- Enviar excepciones a una bandeja priorizada.
- Hacer que automatización use los mismos comandos y permisos.
- Mantener una única perspectiva jugable principal.
- Preparar `ControlContext` sólo hasta donde exista un consumidor real.

**Aceptación:** duplicar cartera no duplica interacciones rutinarias y la automatización no salta reglas.

**Estado 2026-10-25:** `DONE`. Evidencia en
`docs/execution/phase-4/wp4-13-automation-2026-10-25.md` y decisión en
`docs/engineering/adr/D-078-delegacion-y-excepciones.md`.

- `phase2.automation` con property, finance, umbral de reparación y suelo de caja; manual por defecto.
- Sistema diario `automation` después de `rival`, sólo para la organización del jugador y sólo por el
  dispatcher: mismos comandos, permisos, validaciones y libro.
- Gestores acotados: 3 asignaciones/día, un préstamo/día con garantía libre, una reparación/día con
  cuadrilla libre.
- Bandeja priorizada reutilizando `alerts`, ampliada con seguros; rutina contada antes de delegar.
- Medición 50/200/800 parcelas: 6/28/121 interacciones manuales; 0 del jugador con gestor.
- Sin LOD nuevo (la deuda de `buildStock` sigue abierta) y sin `ControlContext` (sin consumidor).
- Diez digestos regenerados por superficie (`phase2.automation`), sin delta económico.

## WP4.14 — Herramientas internas y balance

- Crear inspector de estado sólo para desarrollo.
- Crear editor/validador de datos o pipeline equivalente.
- Ejecutar simulaciones masivas con seeds registradas.
- Medir quiebras, vacancy, concentración, movilidad, deuda y presupuesto.
- Detectar estrategias dominantes e invariantes económicas rotas.
- Versionar datasets de balance y resultados comparables.

**Estado 2026-10-25:** `DONE`. Evidencia en
`docs/execution/phase-4/wp4-14-internal-tools-2026-10-25.md`, decisión en
`docs/engineering/adr/D-079-herramientas-internas-y-balance.md` y dataset en `docs/balance/`.

- `measureBalance` y `detectInvariantViolations` en `packages/simulation/src/balance.ts`.
- Validador permanente de catálogos (edificios, vivienda, ordenanzas, partidos, macroeventos,
  facciones, distritos y políticas).
- Inspector de estado opt-in (`pnpm state:inspect`).
- Campaña `pnpm balance:campaign` con 8 semillas × 12 meses × 200 parcelas × 4 estrategias y dataset
  versionado `alpha-baseline-v1` con validación de esquema y recálculo de comparaciones.
- Hallazgo registrado: mantenimiento equilibrado dominado en caja (0/8); delegación con
  mantenimiento diferido domina a la pasiva (8/8). Sin rebalanceo en este WP.
- **Revisión 2026-10-25 (auditoría externa):** ese dataset medía el arnés de carga `createScaledCity`
  (5 000 000 de caja y activos regalados), no una partida real. Se renombra a
  `docs/balance/synthetic-city-balance-v1.json` y se conserva como test de esfuerzo; se añade la
  campaña jugable `pnpm balance:playable` sobre `createInitialState(seed)` con 16 semillas × 12 meses ×
  4 estrategias ejecutadas sólo con comandos reales del jugador, versionada en
  `docs/balance/playable-alpha-baseline-v1.json`. Con datos jugables **ninguna estrategia domina** y el
  "mantenimiento equilibrado dominado" queda como **señal fuerte para investigar** (4/16 a favor). Ver
  la nota de revisión del acta y `docs/balance/README.md`.

## WP4.15 — Pipeline artístico y escalado de contenido

Resultado: convertir la baseline `graphic_civic` en una línea de producción por-asset
reproducible y suficientemente barata para Alpha. Traslada a Fase 4 las fases pendientes
del runbook WP2.14 (H2/H4/H7/H8), cuyo gate ya está cerrado.

- Building source -> Blender -> render -> trim -> metadata -> atlas -> Phaser.
- Pivots y depth sorting sin hacks por asset.
- States complete/construction/damaged/burning.
- Character import/normalización.
- Idle/walk y decisión 4 vs 8 direcciones medida.
- Atlas strategy definitiva.
- Metadata schema v1.
- Política Git LFS.
- Building Factory / Character Factory mínimos si aportan ahorro real.
- Profiling de distrito denso.
- Visual regression por assets/golden scenes.
- Ensayo de variaciones para medir coste de producción.

**Aceptación:** un nuevo building y una variante de personaje se generan e integran sin
trabajo manual oculto, dentro de budgets medidos.

**Estado 2026-10-25:** `DONE` con los diferidos declarados. Evidencia en
`docs/execution/phase-4/wp4-15-art-pipeline-2026-10-25.md`, decisión en
`docs/engineering/adr/D-080-contrato-assets-y-factoria.md` y manual en `docs/art/RUNTIME-ASSETS.md`.

- Contrato `RuntimeAssetManifestV1` en shared: edificios con huella, pivote y cuatro estados;
  personajes con 4/8 direcciones e `idle`/`walk`; hashes y provenance.
- Factoría procedural determinista: 5 edificios × 4 estados y 2 variantes de personaje, 68 SVG en
  data URIs (manifiesto 106 KB, sin binarios ni LFS); `art:assets:check` detecta ediciones manuales.
- Integración Phaser: pivote y depth desde metadata, estados complete/construction/damaged/burning;
  personajes animados en el Art Lab (4 vs 8 direcciones).
- Validación en CI de esquema, hashes, estados, direcciones y budgets; captura visual con baseline
  SHA-256 opt-in; perfil de 400 sprites a 60 FPS DOM.
- Diferidos: arte final Blender (mismo contrato, no en CI), personajes en la escena jugable (LOD de
  personaje pendiente) y atlas raster/LFS para el arte final.

**Revisión 2026-10-25 (WP4.15-H):** la auditoría separó dos alcances que este WP mezclaba. La
infraestructura de assets runtime está `DONE` (contrato, factoría procedural, integración Phaser) y
la **ruta Blender queda demostrada de extremo a extremo** para un edificio y una variante de
personaje: `tools/art-pipeline/blender/runtime_asset.py` (render EEVEE transparente → recorte →
reducción → metadata con pivote proyectado) y `scripts/build-blender-assets.mjs` publican el bundle
`apps/web/public/assets/runtime/blender/runtime-assets-blender.json`, verificado por
`art:blender:check` y consumido por Phaser en la escena densa. Lo que **no** pertenece a Alpha y pasa
al gate de Beta con decisión registrada (D-081): atlas/texture packing y adopción+migración de Git
LFS. La regresión visual deja de ser opt-in: `pnpm art:visual` compara contra un golden versionado
con pixel-diff tolerante en CI, y el perfil denso se mide en Phaser de verdad (400 sprites con
cambio de frame y scroll a 60 FPS de mediana), no con DOM estático. También se corrigen la huella en
el depth/posición del sprite y la animación de caminar por dirección.

**Revisión 2026-10-26 (D-082, supersedes ubicación/CI de este párrafo):** el JSON importable pasa a
`apps/web/src/generated/runtime-assets-blender.json` y `public/` conserva sólo los PNG. Además,
`art:visual` pasa a QA local por diferencias cross-environment; CI conserva el smoke estructural,
integridad Blender y budget de binarios.

### Puntos de gate de Beta añadidos por D-081

- Adoptar Git LFS y migrar/desduplicar los masters 16-bit del spike (hoy excepciones en
  `docs/art/BINARY-ALLOWLIST.json`).
- Estrategia de atlas/texture packing, con criterio de reapertura medido: perfil denso por debajo de
  55 FPS o más de 64 texturas en el runtime.
- Línea por-asset completa (todos los edificios y personajes Alpha por la ruta Blender) y rig/batch
  de personajes.

## WP4.15-H.1 — Corrección de cámara y Art Lab QA

**Estado 2026-10-26:** `DONE` con verificación local completada; pendiente de CI remoto tras push. Evidencia/brief en
`docs/execution/phase-4/wp4-15-h-1-camera-artlab-hardening-2026-10-26.md` y decisión en D-082.

- Corregir pantalla -> mundo con `camera.getWorldPoint`; el picking debe coincidir a 0.5x–2.5x.
- Escalar el pan por zoom y mantener el punto bajo cursor al hacer wheel.
- Mover el manifiesto Blender importable de `public/` a `src/generated/`, dejando los PNG en
  `public/assets/runtime/blender/`.
- Reconducir el Art Lab a Asset QA: baseline aprobada, archivo histórico secundario, matriz de estados,
  personajes y comparación procedural/Blender del asset E2E.
- Reconciliar D-081/WP4.15-H con la realidad del workflow: `art:visual` es local-only; CI mantiene
  smoke Art Lab, integridad Blender y budget de binarios.
- Añadir regresiones browser de picking/pan/zoom y eliminar los warnings de Vite.

**Aceptación:** interacción isométrica exacta bajo zoom/pan, dev server sin imports de `public/`,
Art Lab útil como QA y toda la cadena local/remota verde sin tocar simulación.

## WP4.16 — Robustez y cierre alpha

**Precondición (revisión 2026-10-26):** no abrir hasta cerrar WP4.15-H.1 (D-082), además del endurecimiento WP4.15-H. El
hotspot `buildStock` quedó optimizado de forma exacta el 2026-10-25 (17,6 → 2,70 ms de mediana con
607 edificios) y el cierre mensual bajó a 15,5–18,9 ms de media según modo macro, todavía por encima
del presupuesto de 10 ms p95 de D-065/D-076: el coste restante está repartido entre sistemas, así que
la decisión de LOD agregado con su benchmark posterior pertenece a este WP y no a un parche suelto.

- Migrar fixtures de todas las fases.
- Ejecutar pruebas largas, performance por LOD y recuperación.
- Revisar accesibilidad, onboarding y legibilidad causal.
- Realizar playtests longitudinales y de estilos distintos.
- Auditar privacidad/telemetría, IP y seguridad del cliente.
- Clasificar features incompletas: completar, recortar o diferir.
- Definir contenido y calidad requeridos para beta.

## Dependencias clave

- Distritos y LOD preceden a expansión de población masiva.
- Vivienda y empleo preceden a elecciones con preferencias significativas.
- Presupuesto precede a servicios y contratos públicos.
- Reputación e information scope preceden a IA/facciones más sofisticadas.
- Automatización se diseña con datos reales de repetición, no por especulación.
- WP4.15 (producción artística) precede a WP4.16 (cierre alpha): la robustez final se
  evalúa sobre el contenido representativo ya integrado.

## Fuera de alcance

- Perspectivas jugables alternativas completas.
- Justicia avanzada, sindicatos detallados, holdings/equity y concesiones complejas.
- Envejecimiento, familia, generaciones y dinastía.
- Multijugador salvo decisión separada posterior.
