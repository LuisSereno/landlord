# WP-CHAR-03 · Progreso

## 2026-11-24 · Etapa A — Baseline

- Creado worktree aislado desde `3f012895b922692ca0877812bf643a017a581688`.
- Rama: `wip/wp-char-03-scale-calibration`.
- Leídas las referencias artísticas y localizados los contratos Phaser de coordenadas, escala, cámara, picking, pivotes y assets.
- Confirmado: los Kenney son candidatos de laboratorio; no están en producción.
- Creado `01-baseline.md` y `tools/art-pipeline/blender/characters/wp_char_03/manifest.json`.
- Próximo paso: smoke de supervisor sin gafas, con casco angular y clipboard bajado al costado.

## 2026-11-24 · Etapas B–C — Arte y medición

- Supervisor: gafas eliminadas, casco angular y clipboard bajado; smoke aceptado.
- Enforcer: coleta eliminada, boca neutra y contraste de chaqueta; smoke aceptado.
- Bombero: gafas eliminadas, casco posterior inclinado y franjas de 61 polígonos; smoke aceptado.
- Renderizados 36 frames finales nuevos; obrero y policía conservados.
- Creadas tres comparativas offline en `art-before-after/`.
- Medidos 84 sprites y copiados a `apps/web/public/qa-character-scale/`.
- Implementado `scale-calibration.ts` con escala estable por animación y pivote de apoyo.
- Pruebas de calibración: 12/12.
- Documentos creados: `02-art-corrections.md`, `03-scale-calibration.md`.
- Próximo paso: laboratorio Phaser aislado con configuraciones A–D.

## 2026-11-24 · Etapas D–H — Phaser, capturas y recomendación

- Laboratorio creado en `char-scale-lab.html` con edificios/vehículos reales, cinco personajes, cámara, picking, movimiento y controles.
- Configuraciones A–D implementadas y capturadas en 1280×720 y 1920×1080.
- 54 capturas reales, 0 errores de navegador; 74/74 pruebas funcionales.
- Rendimiento balanceado en dos órdenes; no hay penalización consistente de B.
- Recomendación: **B, 34 px con zoom 1×**; aplicada como default sólo del laboratorio.
- Pruebas unitarias 15/15; web 452/452; typecheck, arquitectura y builds PASS.
- Validación agregada: 463 checks, 0 errores.
- Web lint: sólo 2 errores preexistentes, reproducidos en 02C.
- Documentos 04–07 creados.
- Pendiente: acta 08, manifiesto agregado, commits y auditoría final de aislamiento.

## 2026-11-24 · Cierre

- Commits de arte/calibración y laboratorio/evidencia creados.
- Acta 08 creada con SHA de contenido `268805cc9783527fd8390ab55b402167fe9730e7`.
- Original y 02C limpios; diff protegido vacío.
- 02A/02B siguen como entradas prunable y sus commits/evidencias permanecen disponibles.
- Estado máximo: `TECHNICAL_COMPLETE / VISUAL_REVIEW_PENDING`.
- Pendiente único: revisión humana y decisión de integración futura.

## 2026-11-25 · Auditoría final de cierre

- HEAD técnico verificado: `45224a38ba133eeeb623a521eea7d90a9dc32024`; worktree limpio.
- Evidencia releída sin regenerarla: 232 archivos, diez fuentes/dependencias y 721/721 checks de hash.
- Capturas verificadas: 54, con cobertura A–D en 1280×720 y 1920×1080; 74/74 comprobaciones Phaser.
- Código del laboratorio sin cambios desde `268805c`; diff de componentes protegidos vacío.
- Acta 08 consolidada con D-CHAR-01…06 y estado `CLOSED_TECHNICAL / VISUAL_REVIEW_PENDING`.
- Sin cambios funcionales ni nuevas pruebas: la evidencia existente sigue siendo válida para el HEAD técnico.
