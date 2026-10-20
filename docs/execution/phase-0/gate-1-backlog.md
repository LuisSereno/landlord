# Backlog inicial de Gate 1 para Luna

Este backlog cubre WP1.1 y WP1.2. Cada tarea dura como máximo cuatro horas y no autoriza trabajo posterior. `READY` significa dependencias cerradas; las demás pasan de `TODO` a `READY` automáticamente al cerrarse sus dependencias y conservar válido el contrato.

## Reglas comunes

Contexto obligatorio para todas:

- `AGENTS.md`;
- D-046, D-047 y, para contratos, D-049/D-051;
- `docs/execution/00-modelo-de-ejecucion.md`.

Prohibido:

- elegir otras dependencias/versiones;
- crear paquetes no enumerados;
- añadir gameplay;
- usar `Math.random` o `Date.now` en simulation;
- importar UI/DOM/IndexedDB desde simulation;
- modificar decisiones sin detener la tarea.

Checks acumulativos previstos:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Antes de existir un script, una tarea sólo ejecuta los comandos que ya haya creado ella o una dependencia.

## DAG

```text
G1-WP01-T01
  -> G1-WP01-T02 -> G1-WP01-T04 -> G1-WP01-T05 -> T06 -> T07 -> T08 -> T09 -> T10
  -> G1-WP01-T03 -----------------^
G1-WP01-T10 -> G1-WP02-T01 -> T02 -> T03 -> T04 -> T05 -> T06 -> T07 -> T08
```

No existen dependencias inversas de WP1.2 a WP1.1.

## WP1.1 — Workspace reproducible

### G1-WP01-T01 — Crear raíz pnpm reproducible

Estado: DONE
Dependencias: ninguna  
Máximo: 2 h

- Crear `package.json`, `pnpm-workspace.yaml`, `.npmrc`, `.node-version` y lockfile.
- Declarar Node/pnpm y versiones exactas de D-046; no instalar aún dependencias específicas de paquetes que no existan.
- Scripts raíz llaman scripts recursivos sin Turborepo/Nx.
- `.npmrc` exige lockfile y peers estrictos compatibles con la selección.
- Aceptación: Node fuera de rango queda documentado/rechazado; segundo install no cambia lockfile.
- Checks: `pnpm install`, `pnpm install --frozen-lockfile` y `git diff --check`.

### G1-WP01-T02 — Crear app web mínima

Estado: DONE
Dependencias: G1-WP01-T01  
Máximo: 4 h

- Crear `apps/web` con Vite 8, React 19 y Phaser 4 en versiones exactas.
- Pantalla smoke estática; sin simulación, Worker, mapa ni reglas.
- Exports privados a la app; no importar fuentes internas de paquetes inexistentes.
- Aceptación: dev server y build de producción arrancan sin warnings propios.
- Checks: filtro web de typecheck/build.

### G1-WP01-T03 — Crear paquete simulation headless

Estado: DONE
Dependencias: G1-WP01-T01  
Máximo: 3 h

- Crear manifest, `src/index.ts` y test smoke de `packages/simulation`.
- TypeScript strict, ES2023 y sin librería DOM.
- Cero dependencias de React, Phaser, navegador o Node runtime en source.
- Aceptación: paquete se typecheckea y testea en Node sin mocks de browser.
- Checks: filtro simulation de typecheck/test.

### G1-WP01-T04 — Crear paquete shared

Estado: DONE
Dependencias: G1-WP01-T01, G1-WP01-T02, G1-WP01-T03  
Máximo: 3 h

- Crear manifest, entrypoint y test smoke.
- Añadir Zod exacto como dependencia runtime.
- Permitir imports desde web y simulation; no importar ninguno de ellos.
- Aceptación: export smoke consumible desde ambos paquetes sin deep imports.
- Checks: filtros shared, simulation y web.

### G1-WP01-T05 — Consolidar configuración TypeScript

Estado: DONE
Dependencias: G1-WP01-T04  
Máximo: 3 h

- Crear config base strict y configs por workspace.
- Activar `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `useUnknownInCatchVariables` y `noEmit` para checks.
- Simulation mantiene ES2023 sin DOM; web añade libs de browser.
- Aceptación: un fixture temporal que use `document` en simulation falla; retirarlo deja checks verdes.
- Checks: `pnpm typecheck`.

### G1-WP01-T06 — Configurar ESLint y Prettier

Estado: DONE
Dependencias: G1-WP01-T05  
Máximo: 4 h

- Flat config ESLint con TypeScript y hooks de React.
- Prettier separado; lint no reescribe.
- `no-restricted-imports` en simulation/shared según D-047.
- Prohibir `Math.random` y `Date.now` dentro de simulation.
- Aceptación: fixtures temporales de imports/random fallan y se retiran antes de cerrar.
- Checks: `pnpm lint`, `pnpm typecheck`.

### G1-WP01-T07 — Configurar Vitest

Estado: DONE
Dependencias: G1-WP01-T06  
Máximo: 3 h

- Config común mínima y tests smoke de los tres workspaces.
- Entorno Node por defecto; no jsdom global.
- Instalar `fake-indexeddb` pero usarlo sólo cuando exista adapter.
- Aceptación: tests se descubren por workspace y fallos propagan exit code.
- Checks: `pnpm test`.

### G1-WP01-T08 — Cerrar build de producción

Estado: DONE
Dependencias: G1-WP01-T07  
Máximo: 2 h

- Script raíz construye sólo artefactos necesarios.
- Simulation/shared siguen consumibles por web sin publicar paquetes.
- No introducir optimización personalizada.
- Aceptación: build limpio y preview muestra smoke web.
- Checks: `pnpm build`, smoke manual documentado.

### G1-WP01-T09 — Añadir CI base

Estado: DONE
Dependencias: G1-WP01-T08  
Máximo: 4 h

- Workflow GitHub Actions con Node 24.19.0 y pnpm 12.11.2.
- Pasos: checkout, setup, install congelado, lint, typecheck, test, build.
- Cache sólo de pnpm; no cachear resultados que oculten checks.
- Chromium/Firefox se añaden cuando exista primer E2E, no se descarga un browser sin test.
- Aceptación: workflow válido y mismos scripts que local.

### G1-WP01-T10 — Añadir test negativo de fronteras

Estado: DONE
Dependencias: G1-WP01-T09  
Máximo: 3 h

- Añadir check automatizado de imports prohibidos además de ESLint.
- Debe inspeccionar source, no tests/config.
- Casos: simulation->web/React/Phaser/DOM/IndexedDB y shared->simulation/web.
- Aceptación: fixture prohibido hace fallar el check; al retirarlo toda la suite pasa.
- Checks: suite completa.

## WP1.2 — Primitivas compartidas

### G1-WP02-T01 — Añadir tipo Brand e IDs

Estado: DONE
Dependencias: G1-WP01-T10  
Máximo: 3 h

- Crear módulo público de branded primitives en shared.
- Definir IDs de `contracts.md`, sin allocator todavía.
- Añadir constructors/parsers sólo cuando validen runtime; no usar casts dispersos.
- Tests: formato válido, prefijo incorrecto, vacío y longitud extrema.

### G1-WP02-T02 — Añadir Tick, Seed y GridCell

Estado: DONE
Dependencias: G1-WP02-T01  
Máximo: 3 h

- Implementar schemas/constructors con safe integers y límites documentados.
- GridCell valida enteros no negativos; bounds del mapa pertenece al comando, no al tipo.
- Tests: límites, float, NaN, infinito, negativo y seed máxima.

### G1-WP02-T03 — Añadir Money

Estado: DONE
Dependencias: G1-WP02-T02  
Máximo: 3 h

- Unidad menor como safe integer no negativo en Gate 1.
- Constructor y suma/resta checked; resta negativa devuelve resultado estructurado, no clamp.
- No añadir moneda, formato o floats.
- Tests: cero, máximo seguro, overflow, float y saldo insuficiente.

### G1-WP02-T04 — Definir request envelopes

Estado: DONE
Dependencias: G1-WP02-T03  
Máximo: 4 h

- Implementar tipos y schemas de las seis requests de `contracts.md`.
- Discriminated union exhaustiva por `type`.
- Rechazar campos/valores incompatibles conforme a Zod policy documentada.
- Tests: un ejemplo válido por request y versiones/payloads inválidos.

### G1-WP02-T05 — Definir responses y errores

Estado: DONE
Dependencias: G1-WP02-T04  
Máximo: 3 h

- Implementar cuatro responses y union de códigos exacta.
- Notificaciones usan `requestId: null`; respuestas correlacionadas no.
- No añadir stack traces al wire contract.
- Tests: discriminantes, correlación y error desconocido.

### G1-WP02-T06 — Definir comando y evento

Estado: DONE
Dependencias: G1-WP02-T05  
Máximo: 4 h

- Implementar `PlaceTestStructure` y `TestStructurePlaced` sin dispatcher.
- Actor y acting organization son obligatorios.
- Tests: roundtrip, campo ausente, cell inválida e ID con prefijo erróneo.

### G1-WP02-T07 — Definir snapshot y proyección v1

Estado: DONE
Dependencias: G1-WP02-T06  
Máximo: 4 h

- Implementar schemas exactos de `contracts.md` sin hidratación a Maps.
- Validar unicidad y referencias en una segunda fase de validación pura.
- Tests: fixture mínimo válido, entidad duplicada, referencia rota, PRNG inválido y schema incompatible.

### G1-WP02-T08 — Verificar structured clone y exports

Estado: DONE
Dependencias: G1-WP02-T07  
Máximo: 3 h

- Crear tests que clonen cada request/response, comando/evento, proyección y snapshot.
- Confirmar ausencia de funciones, Maps, classes, BigInt y objetos DOM en wire data.
- Revisar entrypoint público; prohibir deep imports en consumidores.
- Checks: lint, typecheck, tests y build completos.

## Regla de cierre

Cada tarea copia su sección a `PLANTILLA-TAREA-LUNA.md`, añade rutas reales después de T01 y entrega diff + resultados. El revisor cambia estado en este backlog sólo después de verificar evidencia. Ninguna tarea declara Gate 1 completado.
