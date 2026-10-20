# Fase 0 — Preparación y cierre de definición

Estado: DONE el 2026-10-20. El acta y los entregables se encuentran en [`phase-0/PHASE-0-CLOSURE.md`](phase-0/PHASE-0-CLOSURE.md).

## Objetivo

Dejar el repositorio preparado para ejecutar Gate 1 sin decisiones ocultas, con herramientas mínimas, contratos iniciales y un backlog verificable. Esta fase no crea gameplay ni resuelve por anticipado el diseño económico.

## Problema que resuelve

El repositorio contiene una visión amplia, pero todavía no tiene código, manifiesto de paquetes, CI, criterios cuantitativos de benchmark ni decisiones sobre herramientas básicas. Empezar directamente a programar trasladaría esas ambigüedades a cambios difíciles de revisar.

## Criterios de entrada

- Documentación base disponible.
- Gate 1 identificado como próximo objetivo.
- Acceso a un navegador de escritorio y a un entorno Node compatible.

## Criterios de salida

- Las decisiones mínimas de tooling están registradas.
- El backlog de Gate 1 está ordenado y estimado.
- Existe una escena y una carga de benchmark descritas sin depender de assets protegidos.
- Los comandos de instalación, test, lint, typecheck y build están definidos.
- Los riesgos críticos tienen propietario y señal de alerta.
- No quedan elecciones de producto necesarias para comenzar Gate 1.

## WP0.1 — Baseline de producto y alcance

**Resultado:** una ficha de Gate 1 aprobable y sin ambigüedad de alcance.

### Tareas

- `F0-WP01-T01` — Crear una tabla `IN/OUT` de Gate 1 usando `PROJECT-STATE`, `DECISIONS` y `gates-and-mvp`.
- `F0-WP01-T02` — Definir la demo exacta: abrir escena, mover cámara, seleccionar celda/entidad, enviar comando al worker, avanzar ticks, guardar, recargar y comparar estado.
- `F0-WP01-T03` — Definir el escenario técnico de referencia: dimensiones de mapa, 500 agentes simplificados, 100 edificios y patrón de movimiento básico.
- `F0-WP01-T04` — Documentar los navegadores y hardware de referencia para medir, sin convertirlos aún en requisitos comerciales.
- `F0-WP01-T05` — Crear el formato del acta de gate con evidencia exigida.

### Aceptación

- Cada elemento del Gate 1 aparece una sola vez como incluido, excluido o decisión previa.
- La demo puede ser reproducida por otra persona siguiendo una lista numerada.
- No aparecen tenants, crimen, fiscalidad avanzada, banca ni perspectivas alternativas como implementación del gate.

## WP0.2 — Decisiones mínimas de plataforma

**Resultado:** ADRs breves para las decisiones necesarias antes del scaffold.

### Tareas

- `F0-WP02-T01` — Confirmar versión LTS de Node y package manager; registrar versión y política de lockfile.
- `F0-WP02-T02` — Elegir estructura de workspace mínima entre npm/pnpm, evitando herramientas adicionales sin beneficio medido.
- `F0-WP02-T03` — Elegir runner de tests compatible con TypeScript/Vite y ejecución headless.
- `F0-WP02-T04` — Elegir lint/format y reglas de frontera de imports.
- `F0-WP02-T05` — Evaluar 2-3 PRNGs deterministas o implementación propia; decidir algoritmo, estado serializable y vectores de prueba.
- `F0-WP02-T06` — Elegir validación de schemas para datos y snapshots, midiendo coste y ergonomía.
- `F0-WP02-T07` — Decidir modelo inicial de entidades convencionales frente a ECS mediante un spike pequeño; no construir un ECS genérico.
- `F0-WP02-T08` — Confirmar Phaser para el spike y documentar condiciones concretas que obligarían a revisarlo.

### Aceptación

- Cada ADR incluye contexto, alternativas, decisión, consecuencias y condición de revisión.
- PRNG y schemas tienen una prueba mínima ejecutable o un prototipo reproducible.
- Ninguna elección añade backend, microservicios, Redis o infraestructura de producción.

## WP0.3 — Arquitectura inicial de paquetes

**Resultado:** mapa de módulos mínimo para Gate 1.

### Estructura objetivo inicial

```text
apps/
  web/                 Phaser + React; sin reglas de negocio
packages/
  simulation/          Estado, reloj, PRNG, comandos, eventos y sistemas
  shared/              Contratos serializables entre web y worker
  game-data/           Definiciones tipadas y validadas cuando sean necesarias
```

No crear todavía `server`, `economy`, `ai`, `pathfinding` o `network` como paquetes separados si sólo contendrían placeholders. Se extraen cuando exista una frontera real.

### Tareas

- `F0-WP03-T01` — Dibujar dependencias permitidas y prohibidas.
- `F0-WP03-T02` — Definir exports públicos previstos por paquete.
- `F0-WP03-T03` — Definir convención de IDs opacos, `Money`, `Tick` y errores estructurados.
- `F0-WP03-T04` — Especificar el sobre del protocolo worker: versión, request ID, payload y resultado/error.
- `F0-WP03-T05` — Especificar el snapshot mínimo: schema, engine version, seed, tick, estado PRNG y entidades técnicas.
- `F0-WP03-T06` — Revisar el modelo mínimo de identidad: `PlayerIdentity -> Person`, `Organization` independiente y ownership explícito; evitar capabilities completas.

### Aceptación

- `simulation` no depende de navegador, UI ni persistencia IndexedDB.
- `shared` no contiene lógica de dominio mutable.
- No existe un singleton `Player` con caja o edificios.
- Los contratos pueden cruzar `postMessage` mediante structured clone.

## WP0.4 — Estrategia de calidad y evidencia

**Resultado:** matriz que convierte cada riesgo de Gate 1 en una prueba.

### Tareas

- `F0-WP04-T01` — Definir fixtures de seeds y secuencias de comandos.
- `F0-WP04-T02` — Definir cómo calcular una representación/hash canónica del estado.
- `F0-WP04-T03` — Diseñar el benchmark con warm-up, repeticiones, percentiles y metadatos del entorno.
- `F0-WP04-T04` — Diseñar el soak y la forma de detectar crecimiento sostenido de memoria.
- `F0-WP04-T05` — Definir una estrategia de tests de protocolo Worker y de IndexedDB.
- `F0-WP04-T06` — Preparar checklist de revisión IP para assets temporales, nombres y copy.
- `F0-WP04-T07` — Mapear riesgos del registro existente a señal, mitigación, contingencia y propietario.

### Aceptación

- Cada criterio de Gate 1 tiene una evidencia automática o una demo repetible.
- Las métricas incluyen unidad, entorno y método; no sólo un número aislado.
- Los assets del spike son propios, generados o con licencia compatible y trazable.

## WP0.5 — Backlog listo para Luna

**Resultado:** primeras tareas de Gate 1 preparadas con la plantilla.

### Tareas

- `F0-WP05-T01` — Desglosar WP1.1 y WP1.2 en tareas máximas de cuatro horas.
- `F0-WP05-T02` — Añadir rutas exactas y comandos de comprobación después de crear el scaffold.
- `F0-WP05-T03` — Marcar dependencias como un DAG y detectar ciclos.
- `F0-WP05-T04` — Preparar al menos una tarea negativa: regla que impida importar DOM/Phaser desde simulation.
- `F0-WP05-T05` — Revisar cada prompt con la Definition of Ready.

## Secuencia recomendada

1. WP0.1 fija el resultado.
2. WP0.2 resuelve las elecciones bloqueantes.
3. WP0.3 concreta contratos y fronteras.
4. WP0.4 define cómo se probará.
5. WP0.5 empaqueta el trabajo para ejecución de baja ambigüedad.

WP0.2 y WP0.4 pueden avanzar en paralelo después de WP0.1, pero la arquitectura se cierra sólo tras conocer las decisiones de tooling.

## Riesgos y respuestas

| Riesgo | Señal | Respuesta |
|---|---|---|
| Diseñar todo el producto antes del spike | Paquetes vacíos o interfaces sin consumidor | Eliminar placeholders y limitarse al Gate 1 |
| Elegir por preferencia sin evidencia | ADR sin alternativas ni spike | Ejecutar comparación mínima y registrar datos |
| Benchmarks irreproducibles | No consta hardware, build o seed | Invalidar medición y repetir con plantilla |
| Luna toma decisiones implícitas | Cambia contrato o añade dependencia | Revertir esa parte, crear ADR y reemitir tarea |
| Confundir compatibilidad futura con implementación | Aparece sistema completo de roles | Reducir a IDs y ownership mínimos |

## Entregables

- ADRs de tooling y arquitectura mínima.
- Ficha de Gate 1 y guion de demo.
- Diseño de benchmark y soak.
- Matriz de riesgos actualizada.
- Backlog inicial `READY` para Gate 1.
- Acta de cierre de Fase 0.
