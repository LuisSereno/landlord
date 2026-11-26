# WP-CHAR-04 — Smoke de los 14 personajes Kenney

Fecha: 2026-11-25. Rama: `wip/organization-headquarters`. Estado:
`TECHNICAL_SMOKE_COMPLETE / HUMAN_VISUAL_REVIEW_PENDING`.

## Contrato

- 14 presentaciones canónicas, todas con fuente Kenney Mini Characters CC0.
- Batch eventual: cuatro direcciones × (1 idle + 8 walk) = 36 frames por rol, 504 total.
- Smoke ejecutado: D0 idle-00 y una pose de marcha D0 por rol, 28 frames.
- Rocketbox permanece como runtime legado; ningún candidato Kenney está aprobado para runtime.

## Evidencia

- [Lámina de revisión offline revisada](../../../../art/characters/candidates/wp-char-04/smoke/2026-11-25-smoke-15/contact-sheet.png)
- [Validación independiente revisada](../../../../art/characters/candidates/wp-char-04/smoke/2026-11-25-smoke-15/smoke-validation.json)
- [Ejecución y hashes revisados](../../../../art/characters/candidates/wp-char-04/smoke/2026-11-25-smoke-15/execution.json)
- [Lámina anterior conservada para comparar](../../../../art/characters/candidates/wp-char-04/smoke/2026-11-25-smoke-06/contact-sheet.png)
- [Diagnóstico de animación de enforcer B](../../../../art/characters/candidates/wp-char-04/diagnostics/enforcer-female/animation-diagnosis.json)

Resultado: **1.528 comprobaciones, 0 errores, 0 advertencias, 28 hashes únicos**. Se verifican
proceso Blender, sentinel, salida fresca, fuente/licencia, atlas, cámara, suelo, alfa, bordes,
magenta, deriva de accesorios y sidecars por frame.

Revisión `smoke-15`: el trabajador B mantiene la chaqueta naranja y los dos agentes de seguridad
usan tonos gris pizarra más legibles. Los cascos y la gorra cubren la parte superior del pelo; la
gorra del técnico tiene copa y visera. El casco del supervisor y la gorra del técnico se desplazaron
0,12 unidades hacia atrás sobre la cabeza. Se retiraron libreta, carpetas, bolso y caja de herramientas
que aparecían incrustados en los brazos; el rig Kenney de siete huesos no tiene manos independientes
para sujetarlos con fiabilidad. El pelo original del trabajador B se elimina localmente bajo el casco.
La técnica recupera el pelo y la gorra de `smoke-13`, según la revisión visual del usuario; se descartó
la sustitución de pelo de `smoke-14`. Estas son propuestas visuales,
aún sin aprobación humana ni promoción runtime.

## Corrección medida

`character-female-a.glb` en walk frame 8 es una pose de paso casi idéntica a reposo. Los controles
separados demostraron que la chaqueta skineada no congela el rig. El smoke de `enforcer_female` usa
walk sample 2/frame 4; el batch conserva las ocho muestras contractuales.

## Gate humano

La lámina es una composición offline, no una captura del motor. El responsable debe revisar
profesión a 28/34 px, contraste oscuro, accesorios y ajuste de chaqueta/cuello. Sólo después se
renderiza el batch completo y se promueve a runtime. El playtest V.d sigue independiente y
`PENDING HUMAN PLAYTEST`.
