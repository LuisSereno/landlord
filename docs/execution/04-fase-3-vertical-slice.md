# Fase 3 — Vertical slice comercial

## Estado de ejecución — 2026-10-23

Fase 3 está `IN_PROGRESS`. WP3.2 — producción física y aptitud del terreno — está cerrado para
el slice funcional y cuenta con evidencia en
`docs/execution/phase-3/wp3-2-implementation-2026-10-23.md`. WP3.3 — baseline de proyección
financiera — también está cerrado según
`docs/execution/phase-3/wp3-3-financial-projection-2026-10-23.md`. WP3.4 está
`CONDITIONAL DONE`: el núcleo bancario funciona, con la crisis de deuda avanzada trazada a
WP3.9. WP3.5 a WP3.10 están `DONE`, con evidencia en sus informes de `phase-3`. WP3.13 permanece
condicionado al cierre de WP2.14; no se producen assets finales
mientras el Visual Direction Spike siga abierto.

## Objetivo

Convertir el prototipo validado en una porción representativa de la experiencia final: comprensible, visualmente coherente y con suficiente profundidad financiera, operativa y regulatoria para evaluar producción comercial.

Duración orientativa existente: 12-16 semanas; 300-450 jornadas-persona.

## Criterios de entrada

- Acta `GO` o `CONDITIONAL GO` de Gate 2 sin una condición que afecte al work package a iniciar.
- Core loop validado por playtests.
- Backlog de problemas de UX/balance priorizado.
- Budgets técnicos y schema de saves bajo control.
- Visual Direction Spike de WP2.14 cerrado con baseline aprobada, cámara,
  lighting, escala, atlas y provenance de inputs decididos para producción
  representativa.

## Resultado de fase

Una sesión de mayor duración en un distrito representativo ofrece decisiones sobre cartera, liquidez, deuda, impuestos, mantenimiento, seguro, zoning, permisos, subastas, competencia y una política municipal conectada, sin convertir el juego en un ERP ni en una colección de trámites.

## WP3.1 — Dirección de producto y contenido

- Definir escenario vertical, duración objetivo y estados iniciales.
- Congelar catálogo representativo de parcelas, edificios, negocios, tenants y upgrades.
- Crear guía de tono, naming y arte original.
- Definir métricas de comprensión, engagement, repetición y estrategia.
- Trazar todo contenido a autor/licencia y revisión IP.
- Decidir explícitamente qué contenido del prototipo se conserva, reescribe o elimina.

**Salida:** content lock del slice y guion de evaluación.

## WP3.2 — Producción física y aptitud del terreno

- Sustituir la activación abstracta de `ProductionFacility` por edificios productivos construibles sobre parcelas.
- Mantener compra inmediata de materiales en mercado como alternativa estratégica a la producción propia.
- Definir al menos tres instalaciones productivas originales para los recursos del slice, con zoning y costes data-driven.
- Añadir a las parcelas modificadores enteros de aptitud productiva por recurso/familia y mostrarlos antes de invertir.
- Calcular tasa efectiva según instalación, parcela, condición y upgrades, sin floats autoritativos.
- Hacer que las instalaciones utilicen las reglas normales de ownership, WorkOrder, crews, condition, structuralIntegrity, fuego, reparación y sabotaje.
- Mantener producción automática por calendario de juego, capacidad de inventario y coste operativo.
- Retirar `InvestInProduction` del flujo normal y conservar compatibilidad de saves/comandos de Gate 2 mediante migración explícita.
- Reinterpretar la inversión futura como upgrades físicos de la fábrica: capacidad, eficiencia, almacenamiento, seguridad o control ambiental.
- Extender la IA rival para construir instalaciones y decidir entre mercado y producción bajo las mismas reglas.
- Mantener fuera del slice minas, canteras, energía, materias primas intermedias y cadenas industriales complejas.

**Aceptación:** producir material exige poseer y construir un activo físico; dos parcelas distintas pueden producir rendimientos distintos; mercado y producción propia son alternativas económicamente legibles y una fábrica puede sufrir las mismas consecuencias físicas que cualquier otro edificio.

**Verificación:** el smoke browser cubre el recorrido estable de mercado, parcela industrial,
aptitud, construcción, crews, producción, ampliación y save/load. Los incidentes de fuego no se
fuerzan en ese smoke porque dependen del calendario y del estado del distrito; la pausa de
producción, la extinción/reanudación y la conservación del incidente histórico tras ruina y
`ClearRuin` se verifican de forma determinista en las pruebas de simulación y persistencia.

## WP3.3 — Modelo financiero y liquidez

- Separar caja, activos, pasivos, patrimonio, ingreso y gasto.
- Añadir estados simplificados: resultado, cash flow y balance resumido.
- Definir periodos contables de juego y liquidación automática.
- Mostrar ratios útiles, no contabilidad manual.
- Añadir alertas y proyecciones de liquidez.
- Añadir tests de cierre de periodo, clasificación y conservación.

**Aceptación:** un jugador distingue negocio rentable de empresa sin liquidez y puede anticipar un déficit.

## WP3.4 — Banca y deuda

**Estado 2026-10-23:** `CONDITIONAL DONE`. Evidencia en
`docs/execution/phase-3/wp3-4-banking-debt-2026-10-23.md`.

- Modelar banco como organización independiente.
- Definir préstamo mínimo: principal, interés, plazo, garantía y estado.
- Definir evaluación data-driven de riesgo/capacidad.
- Implementar solicitud, oferta, aceptación, amortización automática y mora.
- Implementar refinanciación limitada y consecuencia por impago.
- Integrar deuda en estados financieros y valoración de decisiones.
- Persistir calendario y evitar doble cobro tras load.
- Probar tipos, vencimientos, liquidez insuficiente y garantía.

**Aceptación:** deuda acelera crecimiento pero introduce vulnerabilidad comprensible; no crea caja sin pasivo.

## WP3.5 — Fiscalidad y tasas prioritarias

- Elegir pocos impuestos/tasas que afecten decisiones: propiedad, transacción y/o actividad.
- Definir base, rate, scope, periodicidad y beneficiario.
- Liquidar automáticamente y registrar en libro.
- Mostrar carga prevista antes de comprar/construir.
- Permitir que una policy modifique parámetros mediante modifiers.
- Probar periodos, exenciones explícitas, cambios de rate y load cerca del vencimiento.

**Aceptación:** la fiscalidad cambia rentabilidad/localización sin añadir clics rutinarios.

**Estado 2026-10-23:** `DONE`. Evidencia en
`docs/execution/phase-3/wp3-5-taxation-2026-10-23.md`.

## WP3.6 — Mantenimiento y deterioro

- Definir condición de activos y curva data-driven.
- Liquidar mantenimiento recurrente automáticamente.
- Permitir política de mantenimiento y excepciones.
- Aplicar consecuencias graduales a renta, satisfacción, valor o riesgo.
- Crear comando de reparación/mejora con coste y capacidad.
- Mostrar backlog, coste y consecuencia de posponer.
- Probar deterioro, reparación, falta de caja y automatización.

**Aceptación:** mantener o diferir es una decisión; no exige pulsar “pagar mantenimiento” por edificio.

**Estado 2026-10-23:** `DONE`. Evidencia en
`docs/execution/phase-3/wp3-6-maintenance-2026-10-23.md`.

## WP3.7 — Seguros y eventos cubiertos

- Modelar aseguradora/contrato con prima, cobertura, límite y exclusión simples.
- Ofrecer coberturas comparables según riesgo del activo.
- Liquidar prima automáticamente.
- Implementar uno o dos eventos asegurables propios.
- Resolver siniestro con trazabilidad y sin resultados opacos.
- Integrar en liquidez y valoración.
- Probar cobertura, exclusión, límite, cancelación y persistencia.

**Aceptación:** asegurar reduce un riesgo a cambio de coste esperado; no elimina toda incertidumbre.

**Estado 2026-10-23:** `DONE`. Evidencia en
`docs/execution/phase-3/wp3-7-insurance-2026-10-23.md`.

## WP3.8 — Zoning, licencias y permisos

- Definir pocas categorías de zoning útiles para el slice.
- Validar uso/altura/densidad mínima en construcción.
- Modelar permiso/licencia con autoridad, requisitos, estado y plazo.
- Automatizar trámites rutinarios o agruparlos; presentar sólo decisiones/excepciones.
- Conectar una policy a zoning, licencia o coste/tiempo.
- Mostrar antes de comprar el uso permitido y el riesgo regulatorio conocido.
- Probar compatibilidad, denegación, aprobación, cambio normativo y obra existente.

**Aceptación:** regulación crea oportunidades y restricciones sin ser una pantalla de papeleo repetitivo.

**Estado 2026-10-23:** `DONE`. Evidencia en
`docs/execution/phase-3/wp3-8-zoning-permits-2026-10-23.md`.

## WP3.9 — Subastas, ejecuciones e insolvencia inicial

- Definir activos que llegan a subasta por reglas económicas.
- Implementar puja/competencia con información limitada.
- Transferir ownership, cargas y caja atómicamente.
- Modelar mora y ejecución simplificada.
- Ofrecer recuperación razonable: venta, refinanciación o reestructuración limitada.
- Evitar game over automático por saldo puntual.
- Probar empate, fondos reservados, retirada, ejecución y save/load.

**Aceptación:** las crisis generan riesgo y oportunidades; ninguna ruta viola ownership o crea activos duplicados.

**Estado 2026-10-23:** `DONE`. Evidencia en
`docs/execution/phase-3/wp3-9-auctions-insolvency-2026-10-23.md`.

## WP3.10 — IA rival financiera

- Extender utility con liquidez, deuda, retorno, riesgo y sinergia territorial.
- Limitar información según su scope.
- Añadir decisiones de financiar, vender, pujar, mantener y asegurar.
- Registrar memoria de pérdidas y cambios de estrategia.
- Probar recuperación, insolvencia, no repetición y ausencia de cheats.
- Ejecutar torneos headless entre perfiles data-driven.

**Aceptación:** perfiles distintos producen estrategias observables y respetan los mismos contratos de comando.

**Estado 2026-10-23:** `DONE`. Evidencia en
`docs/execution/phase-3/wp3-10-rival-financial-ai-2026-10-23.md`.

## WP3.11 — Política municipal integrada

- Ampliar el sistema a un conjunto pequeño de policies con trade-offs.
- Conectar al menos fiscalidad, zoning y/o seguridad con economía real.
- Mostrar apoyos, efectos, fechas y grados de incertidumbre apropiados.
- Añadir lobby limitado por relaciones/recursos, no compra directa de resultado.
- Hacer que actores IA ponderen sus propios intereses.
- Probar stacking/precedencia de modifiers y retirada de policies.

**Aceptación:** la política modifica decisiones inmobiliarias y no funciona como minijuego aislado.

## WP3.12 — Automatización y UX de escala

- Identificar las cinco operaciones más repetidas en playtests.
- Añadir batch, regla de gestión o delegación limitada para las que no sean decisiones.
- Crear bandeja de excepciones y alertas priorizadas.
- Añadir comparadores de activos, préstamos y seguros.
- Implementar filtros/overlays de ownership, rentabilidad, condición, zoning y riesgo.
- Mejorar onboarding, accesibilidad, estados vacíos y recuperación de errores.
- Validar que crecer no multiplica clics linealmente.

## WP3.13 — Arte, audio y rendimiento representativos

- Aplicar el pipeline y los templates aprobados en WP2.14; no rediseñar cámara,
  formatos o gobernanza de provenance dentro de producción de contenido.
- Producir un distrito, edificios, personajes, props, VFX, HUD e iconos
  representativos a partir de fuentes originales o con licencia registrada.
- Generar de forma reproducible estados de construcción/deterioro y metadata
  de anchors, footprints y atlas; no editar manualmente el runtime generado.
- Aplicar budgets validados para atlas, animaciones, draw calls, memoria y
  descarga; todo cambio de presupuesto exige medición y revisión.
- Añadir audio y feedback sin reutilizar referencias protegidas.
- Mantener Art Lab, golden scenes y regresión visual donde aporten valor.
- Perfilar escena real y optimizar sólo cuellos medidos.

## WP3.14 — Persistencia, cloud spike y observabilidad

- Versionar y migrar todos los sistemas nuevos.
- Mantener fixtures de Gate 1, Gate 2 y slice.
- Mejorar recuperación/autosaves y diagnóstico de save corrupto.
- Evaluar cloud save mediante spike; no construir backend completo sin decisión.
- Añadir captura de errores y telemetría local/consentida según alcance.
- Medir snapshots y tiempos de carga de una partida madura.

## WP3.15 — Validación del slice

- Ejecutar suite determinista, económica, de worker, UI, save y performance.
- Ejecutar simulaciones headless de balance con seeds de referencia.
- Realizar playtests de comprensión, estrategia, ritmo y carga operativa.
- Auditar accesibilidad básica, IP y privacidad/telemetría.
- Registrar deuda y alcance recomendado de alpha.
- Emitir decisión de inversión: avanzar, rework o reducir alcance.

## Orden recomendado

1. Congelar escenario y datos representativos.
2. Materializar producción física y aptitud del terreno antes de balancear cadenas económicas más profundas.
3. Implementar finanzas/deuda y luego costes operativos.
4. Añadir regulación y mercado de crisis.
5. Actualizar IA después de estabilizar los contratos del jugador.
6. Tratar UX, automatización, persistencia y rendimiento como líneas continuas.
7. Completar arte representativo sólo después de la aprobación de WP2.14 y de
   fijar métricas, cámara y budgets.

## Fuera de alcance

- Presupuesto municipal completo, empleo y servicios urbanos sistémicos.
- Elecciones completas y perspectiva de alcalde.
- Justicia, sindicatos, equity/holdings y concesiones complejas.
- Life simulation, multijugador y mundo regional amplio.
