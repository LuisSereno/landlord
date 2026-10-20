# Fases 5 y 6 — Beta, lanzamiento y operación

## Propósito

Transformar una alpha sistémica validada en un producto distribuible, observable, accesible y mantenible. Esta etapa prioriza estabilidad, contenido, balance y operación sobre la introducción de sistemas fundamentales nuevos.

Las estimaciones documentales existentes son:

- Fase 5 / beta online: 10-14 semanas; 350-500 jornadas-persona.
- Fase 6 / lanzamiento: 12-18 semanas; 400-650 jornadas-persona.

## Condición previa de planificación

Antes de iniciar se decidirán explícitamente:

- modelo de distribución y monetización;
- navegadores/hardware soportados;
- política de privacidad, telemetría y crash reporting;
- necesidad real de cuentas y cloud save;
- idiomas de lanzamiento;
- alcance de contenido y definición de 1.0;
- si cualquier capacidad online aporta valor suficiente.

“Beta online” no implica multijugador. Puede significar distribución web, cuentas/cloud y telemetría; el multijugador requiere su propio gate.

## Fase 5 — Beta

### WP5.1 — Feature/content lock

- Congelar sistemas de lanzamiento.
- Clasificar backlog en blocker, must, should y post-launch.
- Eliminar o desactivar features incompletas que dañen comprensión.
- Cerrar formatos de datos y plan de compatibilidad de saves.
- Definir criterios de severidad y SLA interno de triage.

### WP5.2 — Backend mínimo, sólo si está aprobado

- Documentar casos de uso: cuenta, cloud save, configuración remota o telemetría.
- Modelar amenazas y datos personales antes de implementar.
- Elegir stack mediante ADR actualizado.
- Mantener simulación single-player local autoritativa salvo cambio explícito.
- Implementar autenticación, slots, timestamps, backups y conflicto de sync.
- Añadir límites, validación, logs seguros y estrategia de eliminación/exportación.
- Probar modo offline, reconexión, conflicto y fallo parcial.

**Regla:** no introducir microservicios, Kubernetes ni Redis por defecto.

### WP5.3 — Seguridad y anti-exploit proporcional

- Inventariar superficies: web, saves, datos, backend y herramientas.
- Validar todo input externo y contenido data-driven.
- Tratar saves locales como no confiables si llegan al backend.
- Proteger secretos y separar configuraciones.
- Revisar dependencias y cabeceras web.
- Añadir rate limiting y autorización donde exista servicio.
- Definir qué exploits importan en single-player y cuáles no justifican coste.

### WP5.4 — Telemetría y observabilidad

- Definir eventos mínimos ligados a decisiones de producto.
- Evitar capturar contenido o identidad innecesarios.
- Versionar esquema de eventos y validar payloads.
- Crear dashboards de crash, rendimiento, funnels y save failures.
- Permitir consentimiento/opt-out según requisitos aplicables.
- Probar que la telemetría no altera simulación ni bloquea offline.

### WP5.5 — Compatibilidad y rendimiento

- Matriz de browsers, resoluciones, escalado y hardware.
- Automatizar smoke tests en targets principales.
- Perfilar partidas tempranas y maduras.
- Definir quality settings si aportan valor.
- Validar worker, IndexedDB, almacenamiento limitado y pestañas suspendidas.
- Ejecutar soak, stress y pruebas de recuperación.

### WP5.6 — Balance beta

- Ejecutar cohortes de seeds y simulaciones masivas por versión.
- Medir estrategias dominantes, soft-locks, quiebras y duración de bucles.
- Separar tuning de bugs de modelo.
- Mantener changelog de balance y datasets versionados.
- Usar telemetría como evidencia, no como sustituto de playtests cualitativos.

### WP5.7 — QA de saves y releases

- Matriz de migraciones desde cada versión soportada.
- Golden saves tempranos, medios, tardíos y corruptos.
- Ensayar rollback de build sin corromper saves nuevos.
- Automatizar smoke post-deploy.
- Definir canal de beta y reporte de bugs con seed/save/version.

### WP5.8 — Gate separado de multijugador

Sólo si se solicita evaluarlo:

- definir problema de jugador y modo concreto;
- prototipar servidor autoritativo y sincronización;
- medir coste de seguridad, latencia, QA y operación;
- decidir `GO/STOP` sin contaminar el lanzamiento single-player.

No se añade multijugador como tarea secundaria de beta.

## Fase 6 — Lanzamiento

### WP6.1 — Contenido y progresión

- Completar catálogo aprobado de distritos, edificios, policies y eventos.
- Validar que cada contenido introduce una decisión o variación útil.
- Revisar consistencia de datos, copy, dificultad y desbloqueos.
- Eliminar cadenas o referencias demasiado próximas a IP ajena.

### WP6.2 — Tutorial y onboarding

- Enseñar el core loop mediante acciones reales, no párrafos largos.
- Introducir deuda, regulación y riesgo cuando el jugador puede usarlos.
- Permitir repetir/omitir ayudas.
- Testear con usuarios sin contexto y medir bloqueos.

### WP6.3 — Accesibilidad y localización

- Definir estándar objetivo y checklist.
- Navegación por teclado, foco, contraste, escalado y no dependencia exclusiva del color.
- Externalizar strings, pluralización, números, moneda y fechas.
- Pseudolocalizar antes de contratar traducción.
- Validar clipping y fuentes en cada idioma.

### WP6.4 — Arte, audio y presentación final

- Completar style guide, pipeline y budgets.
- Asegurar coherencia y legibilidad isométrica.
- Crear feedback de eventos económicos, políticos y de riesgo.
- Licenciar/documentar cada asset, fuente y audio.
- Ejecutar revisión de similitud global e IP antes de comercializar.

### WP6.5 — Release engineering

- Builds reproducibles y versionado semántico/de producto.
- Entornos de preview, staging y production sólo donde aporten valor.
- Checklist de deploy, rollback y migraciones.
- Monitorización de errores, disponibilidad de servicios y costes.
- Backups y restauración probados si existe cloud.
- Página de estado/soporte sólo según necesidades reales.

### WP6.6 — QA final

- Regression completa y exploratoria por sistemas cruzados.
- Campañas largas, edge cases económicos y recuperación de insolvencia.
- Compatibilidad de saves y migraciones.
- Performance, memoria, accesibilidad, seguridad y privacidad.
- Revisión legal de marca, términos, licencias y similitud.
- Cero blockers conocidos; excepciones documentadas y aceptadas.

### WP6.7 — Operación post-lanzamiento

- Proceso de triage y hotfix con criterios claros.
- Cadencia de releases sostenible.
- Métricas de salud y producto con responsables.
- Política de compatibilidad de saves.
- Canal de feedback y clasificación de solicitudes.
- Postmortems sin culpa para incidentes relevantes.

## Criterios de lanzamiento

- Core loop y sistemas prioritarios son comprensibles y estables.
- No hay pérdida conocida de saves en recorridos soportados.
- Rendimiento cumple budgets en la matriz publicada.
- Seguridad, privacidad, licencias e IP han sido revisadas.
- Tutorial, accesibilidad y localización objetivo están verificadas.
- Deploy y rollback han sido ensayados.
- Soporte y ownership post-lanzamiento están asignados.

## Sistemas candidatos, no automáticos

Insolvencia avanzada, justicia inicial, concesiones, sindicatos y negociación avanzada sólo entran si el product lock los aprueba. Equity, holdings, fraude complejo y perspectivas alternativas permanecen posteriores.
