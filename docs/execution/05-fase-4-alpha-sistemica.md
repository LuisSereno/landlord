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

- Evolucionar pool de tenants a demanda segmentada.
- Definir hogares al nivel mínimo que produzca decisiones: renta, tamaño, empleo/preferencias.
- Modelar vacancy, asequibilidad y movilidad.
- Ajustar rentas/precios mediante reglas estables y acotadas.
- Conectar calidad, accesibilidad, seguridad y servicios.
- Añadir tests de shocks, falta de oferta y ausencia de demanda infinita.

**Aceptación:** construir más no garantiza ocupación; precios y vacancy responden a condiciones explicables.

## WP4.4 — Empleo y actividad económica

- Modelar negocios que demandan puestos y hogares que ofrecen trabajo de forma agregada o individual mínima.
- Definir salario/ingreso y conexión con capacidad de alquiler.
- Conectar cierres/aperturas con demanda residencial.
- Evitar simulación individual sin valor jugable.
- Añadir indicadores de empleo, salarios y commuting/accesibilidad.
- Probar desempleo, escasez laboral y shocks sectoriales.

**Aceptación:** empleo afecta vivienda, población y rentabilidad sin crear un simulador laboral completo.

## WP4.5 — Presupuesto municipal

- Modelar Government independiente con ingresos, gastos y reservas.
- Enrutar impuestos/tasas al beneficiario correcto.
- Definir ciclo presupuestario y categorías prioritarias.
- Evitar dinero municipal implícito o infinito.
- Mostrar presupuesto agregado e impacto de decisiones al jugador según información pública.
- Probar recaudación, déficit, recortes y persistencia.

**Aceptación:** las políticas fiscales tienen contraparte presupuestaria y trade-offs observables.

## WP4.6 — Servicios urbanos y accesibilidad

- Priorizar pocos servicios con feedback económico claro: transporte, seguridad, limpieza u otro conjunto aprobado.
- Definir cobertura/capacidad/calidad y coste municipal.
- Conectar servicio con atractivo, suelo, actividad o riesgo.
- Modelar accesibilidad a nivel adecuado al rendimiento.
- Añadir overlays y explicación causal.
- Probar capacidad saturada, expansión, recorte y desigualdad territorial.

**Aceptación:** invertir o recortar servicios altera ciudad y base fiscal; no son simples buffs decorativos.

## WP4.7 — Contratos públicos

- Definir autoridad, objeto, requisitos, ofertas, adjudicación y ejecución.
- Validar capacidad y conflictos básicos.
- Hacer competir a organizaciones IA bajo las mismas reglas.
- Conectar cumplimiento con caja y reputación.
- Mantener concesiones complejas fuera de alcance.
- Probar licitación sin ofertas, empate, incumplimiento y save/load.

## WP4.8 — Reputación multidimensional y relaciones

- Elegir grupos/dimensiones con efecto real; evitar score universal.
- Registrar hechos relevantes como entradas de memoria acotadas.
- Definir decay sólo donde tenga sentido y sea testeable.
- Conectar reputación con financiación, tenants, gobierno o facciones.
- Separar hecho, percepción e información disponible.
- Probar valoraciones distintas del mismo actor.

**Aceptación:** una acción puede mejorar reputación con un grupo y empeorarla con otro.

## WP4.9 — Información imperfecta

- Clasificar datos públicos, propios, inferidos y privados.
- Definir `information scope` sin implementar aún UI multirol completa.
- Crear mecanismos de análisis/contactos/investigación limitados.
- Representar precisión o antigüedad de estimaciones.
- Evitar que IA y UI lean el estado autoritativo completo.
- Probar filtraciones y ausencia de datos privados en proyecciones.

## WP4.10 — IA estratégica y facciones

- Introducir perfiles de facción con objetivos, recursos, relaciones y memoria.
- Añadir planner sólo para secuencias que utility aislada no resuelva.
- Hacer que facciones interactúen entre sí.
- Incorporar empleo, demanda, presupuesto, reputación e información parcial.
- Añadir detección de ciclos y antirrepetición.
- Ejecutar campañas headless, comparar estrategias y detectar cheats/invariantes rotos.

## WP4.11 — Política y elecciones iniciales

- Definir instituciones y calendario municipal ficticios.
- Modelar preferencias a partir de vivienda, empleo, seguridad, servicios e impuestos.
- Añadir candidatos/partidos ficticios con posiciones data-driven.
- Conectar opinión, presupuesto y policies.
- Evitar equivalencias directas con partidos reales.
- Probar cambio de apoyo, participación, resultado y transferencia institucional.

**Aceptación:** las elecciones emergen del estado social y no garantizan el resultado deseado por el jugador.

## WP4.12 — Eventos macroeconómicos

- Definir shocks condicionados y acotados: tipos, escasez, recesión o migración.
- Conectar eventos a sistemas existentes mediante modifiers/eventos, no excepciones dispersas.
- Mostrar señales previas cuando el diseño lo requiera.
- Permitir que IA reaccione.
- Probar inicio, stacking, finalización, save/load y recuperación.

## WP4.13 — Automatización, delegación y Gameplay LOD mínimo

- Medir tareas repetidas en carteras grandes.
- Añadir gestores/políticas/umbrales para propiedad, finanzas y mantenimiento.
- Enviar excepciones a una bandeja priorizada.
- Hacer que automatización use los mismos comandos y permisos.
- Mantener una única perspectiva jugable principal.
- Preparar `ControlContext` sólo hasta donde exista un consumidor real.

**Aceptación:** duplicar cartera no duplica interacciones rutinarias y la automatización no salta reglas.

## WP4.14 — Herramientas internas y balance

- Crear inspector de estado sólo para desarrollo.
- Crear editor/validador de datos o pipeline equivalente.
- Ejecutar simulaciones masivas con seeds registradas.
- Medir quiebras, vacancy, concentración, movilidad, deuda y presupuesto.
- Detectar estrategias dominantes e invariantes económicas rotas.
- Versionar datasets de balance y resultados comparables.

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

## WP4.16 — Robustez y cierre alpha

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
