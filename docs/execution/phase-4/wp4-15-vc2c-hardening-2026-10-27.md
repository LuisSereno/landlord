# WP4.15-V.c.2C-H — Road rendering hardening

**Fecha:** 2026-10-27  
**Baseline:** `f0d31ea`  
**Estado:** PASS  
**Alcance:** tooling, contratos, documentación y merge readiness. Sin cambios de gameplay, arte ni
algoritmo vial.

## Motivo

La revisión remota confirmó `ROAD_TOPOLOGY_CORE = PASS` y `GRAPHIC_CIVIC_ROADS = PASS`, pero detectó
deuda pequeña que podía confundir a agentes posteriores o degradar la evidencia de CI. Esta subfase
la cierra antes de abrir V.c.3.

## Correcciones

- eliminado `findConnector`, BFS de strings muerto tras la adopción de `indexedConnector`;
- el snapshot valida el orden completo de segmentos (`from.y`, `from.x`, `class`, `to.y`, `to.x`);
- el schema de proyección sólo admite road cells canónicas `x:y` dentro de `[0,63]`;
- el smoke Phase 2 importa el reloj monotónico de Node y conserva permanentemente `failure` durante
  cleanup, sin `throw` dentro de `finally`;
- el harness FPS registra el HEAD real, usa un artifact genérico y captura respuestas HTTP >= 400;
- el log periódico `[FPS]` sólo aparece con `?fpsDebug=1`;
- el HTML declara favicon vacío explícito para eliminar la petición implícita a `/favicon.ico`;
- `PROJECT-STATE`, D-085 y el acta de promoción reflejan que V.c.2B/C están cerradas.

## Deuda que no reabre el core

`segmentsFromCells` compacta filas horizontales pero no minimiza tramos verticales. El conjunto de
celdas, sus clases, IDs, determinismo, payload y render no cambian. Se conserva como deuda de formato
hasta que exista un consumidor de clases/orientaciones que justifique migración y nuevos goldens.

## Auditoría de dos archivos históricos

Ambos entraron en el commit WIP `3302bcc`, no en `origin/main`:

- `scripts/install-blender-lts.sh`: **conservar**. Instala exactamente Blender 5.2.2, toolchain fijado
  por D-053, y no participa en runtime ni CI.
- `tools/art-pipeline/blender/model_gangster_clothing.py`: **retirar**. Era un prototipo no referenciado,
  con rutas absolutas al workspace y staging local, sin job/manifest/provenance ni consumidor en el
  pipeline aprobado. Permanece recuperable desde la historia Git (`3302bcc`).

## Gates

La subfase no altera los gates ya aceptados:

```text
WP4.15-V.c.2B = CLOSED
ROAD_TOPOLOGY_CORE = PASS

WP4.15-V.c.2C = CLOSED
GRAPHIC_CIVIC_ROADS = PASS
```

V.c.3 no comienza dentro de este trabajo.

## Validación

- suite completa: 424 tests PASS, 12 opt-in skipped;
- lint: 0 errores y 0 warnings; arquitectura PASS;
- typecheck, build y format PASS;
- guards de assets, Blender, binarios y licencias PASS;
- prueba negativa del smoke: artifact final `FAIL` conserva fase y mensaje tras cleanup;
- navegador sobre preview: 0 respuestas HTTP >= 400 y 0 errores de consola.
