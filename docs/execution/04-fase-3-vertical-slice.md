# Fase 3 — Vertical slice comercial

## Objetivo

Convertir el prototipo validado en una porción representativa de la experiencia final: comprensible, visualmente coherente y con suficiente profundidad financiera, operativa y regulatoria para evaluar producción comercial.

Duración orientativa existente: 12-16 semanas; 300-450 jornadas-persona.

## Criterios de entrada

- Acta `GO` de Gate 2.
- Core loop validado por playtests.
- Backlog de problemas de UX/balance priorizado.
- Budgets técnicos y schema de saves bajo control.
- Dirección visual original aprobada para producción representativa.

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

## WP3.2 — Modelo financiero y liquidez

- Separar caja, activos, pasivos, patrimonio, ingreso y gasto.
- Añadir estados simplificados: resultado, cash flow y balance resumido.
- Definir periodos contables de juego y liquidación automática.
- Mostrar ratios útiles, no contabilidad manual.
- Añadir alertas y proyecciones de liquidez.
- Añadir tests de cierre de periodo, clasificación y conservación.

**Aceptación:** un jugador distingue negocio rentable de empresa sin liquidez y puede anticipar un déficit.

## WP3.3 — Banca y deuda

- Modelar banco como organización independiente.
- Definir préstamo mínimo: principal, interés, plazo, garantía y estado.
- Definir evaluación data-driven de riesgo/capacidad.
- Implementar solicitud, oferta, aceptación, amortización automática y mora.
- Implementar refinanciación limitada y consecuencia por impago.
- Integrar deuda en estados financieros y valoración de decisiones.
- Persistir calendario y evitar doble cobro tras load.
- Probar tipos, vencimientos, liquidez insuficiente y garantía.

**Aceptación:** deuda acelera crecimiento pero introduce vulnerabilidad comprensible; no crea caja sin pasivo.

## WP3.4 — Fiscalidad y tasas prioritarias

- Elegir pocos impuestos/tasas que afecten decisiones: propiedad, transacción y/o actividad.
- Definir base, rate, scope, periodicidad y beneficiario.
- Liquidar automáticamente y registrar en libro.
- Mostrar carga prevista antes de comprar/construir.
- Permitir que una policy modifique parámetros mediante modifiers.
- Probar periodos, exenciones explícitas, cambios de rate y load cerca del vencimiento.

**Aceptación:** la fiscalidad cambia rentabilidad/localización sin añadir clics rutinarios.

## WP3.5 — Mantenimiento y deterioro

- Definir condición de activos y curva data-driven.
- Liquidar mantenimiento recurrente automáticamente.
- Permitir política de mantenimiento y excepciones.
- Aplicar consecuencias graduales a renta, satisfacción, valor o riesgo.
- Crear comando de reparación/mejora con coste y capacidad.
- Mostrar backlog, coste y consecuencia de posponer.
- Probar deterioro, reparación, falta de caja y automatización.

**Aceptación:** mantener o diferir es una decisión; no exige pulsar “pagar mantenimiento” por edificio.

## WP3.6 — Seguros y eventos cubiertos

- Modelar aseguradora/contrato con prima, cobertura, límite y exclusión simples.
- Ofrecer coberturas comparables según riesgo del activo.
- Liquidar prima automáticamente.
- Implementar uno o dos eventos asegurables propios.
- Resolver siniestro con trazabilidad y sin resultados opacos.
- Integrar en liquidez y valoración.
- Probar cobertura, exclusión, límite, cancelación y persistencia.

**Aceptación:** asegurar reduce un riesgo a cambio de coste esperado; no elimina toda incertidumbre.

## WP3.7 — Zoning, licencias y permisos

- Definir pocas categorías de zoning útiles para el slice.
- Validar uso/altura/densidad mínima en construcción.
- Modelar permiso/licencia con autoridad, requisitos, estado y plazo.
- Automatizar trámites rutinarios o agruparlos; presentar sólo decisiones/excepciones.
- Conectar una policy a zoning, licencia o coste/tiempo.
- Mostrar antes de comprar el uso permitido y el riesgo regulatorio conocido.
- Probar compatibilidad, denegación, aprobación, cambio normativo y obra existente.

**Aceptación:** regulación crea oportunidades y restricciones sin ser una pantalla de papeleo repetitivo.

## WP3.8 — Subastas, ejecuciones e insolvencia inicial

- Definir activos que llegan a subasta por reglas económicas.
- Implementar puja/competencia con información limitada.
- Transferir ownership, cargas y caja atómicamente.
- Modelar mora y ejecución simplificada.
- Ofrecer recuperación razonable: venta, refinanciación o reestructuración limitada.
- Evitar game over automático por saldo puntual.
- Probar empate, fondos reservados, retirada, ejecución y save/load.

**Aceptación:** las crisis generan riesgo y oportunidades; ninguna ruta viola ownership o crea activos duplicados.

## WP3.9 — IA rival financiera

- Extender utility con liquidez, deuda, retorno, riesgo y sinergia territorial.
- Limitar información según su scope.
- Añadir decisiones de financiar, vender, pujar, mantener y asegurar.
- Registrar memoria de pérdidas y cambios de estrategia.
- Probar recuperación, insolvencia, no repetición y ausencia de cheats.
- Ejecutar torneos headless entre perfiles data-driven.

**Aceptación:** perfiles distintos producen estrategias observables y respetan los mismos contratos de comando.

## WP3.10 — Política municipal integrada

- Ampliar el sistema a un conjunto pequeño de policies con trade-offs.
- Conectar al menos fiscalidad, zoning y/o seguridad con economía real.
- Mostrar apoyos, efectos, fechas y grados de incertidumbre apropiados.
- Añadir lobby limitado por relaciones/recursos, no compra directa de resultado.
- Hacer que actores IA ponderen sus propios intereses.
- Probar stacking/precedencia de modifiers y retirada de policies.

**Aceptación:** la política modifica decisiones inmobiliarias y no funciona como minijuego aislado.

## WP3.11 — Automatización y UX de escala

- Identificar las cinco operaciones más repetidas en playtests.
- Añadir batch, regla de gestión o delegación limitada para las que no sean decisiones.
- Crear bandeja de excepciones y alertas priorizadas.
- Añadir comparadores de activos, préstamos y seguros.
- Implementar filtros/overlays de ownership, rentabilidad, condición, zoning y riesgo.
- Mejorar onboarding, accesibilidad, estados vacíos y recuperación de errores.
- Validar que crecer no multiplica clics linealmente.

## WP3.12 — Arte, audio y rendimiento representativos

- Construir pipeline documentado para tiles/sprites/atlas originales.
- Producir un distrito, edificios y feedback visual representativos.
- Definir budgets de atlas, animaciones, draw calls y memoria.
- Añadir audio y feedback sin reutilizar referencias protegidas.
- Crear pruebas visuales/regresión donde aporten valor.
- Perfilar escena real y optimizar sólo cuellos medidos.

## WP3.13 — Persistencia, cloud spike y observabilidad

- Versionar y migrar todos los sistemas nuevos.
- Mantener fixtures de Gate 1, Gate 2 y slice.
- Mejorar recuperación/autosaves y diagnóstico de save corrupto.
- Evaluar cloud save mediante spike; no construir backend completo sin decisión.
- Añadir captura de errores y telemetría local/consentida según alcance.
- Medir snapshots y tiempos de carga de una partida madura.

## WP3.14 — Validación del slice

- Ejecutar suite determinista, económica, de worker, UI, save y performance.
- Ejecutar simulaciones headless de balance con seeds de referencia.
- Realizar playtests de comprensión, estrategia, ritmo y carga operativa.
- Auditar accesibilidad básica, IP y privacidad/telemetría.
- Registrar deuda y alcance recomendado de alpha.
- Emitir decisión de inversión: avanzar, rework o reducir alcance.

## Orden recomendado

1. Congelar escenario y datos representativos.
2. Implementar finanzas/deuda y luego costes operativos.
3. Añadir regulación y mercado de crisis.
4. Actualizar IA después de estabilizar los contratos del jugador.
5. Tratar UX, automatización, persistencia y rendimiento como líneas continuas.
6. Completar arte final del slice sólo tras fijar métricas y cámara.

## Fuera de alcance

- Presupuesto municipal completo, empleo y servicios urbanos sistémicos.
- Elecciones completas y perspectiva de alcalde.
- Justicia, sindicatos, equity/holdings y concesiones complejas.
- Life simulation, multijugador y mundo regional amplio.
