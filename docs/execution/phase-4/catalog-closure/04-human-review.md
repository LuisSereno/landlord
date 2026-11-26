# Revisión humana de cierre de catálogo — 2026-11-25

Estado: `APPROVED BY OWNER — 2026-11-26`. Ninguna aprobación automática sustituye esta revisión.
Para regenerar evidencia PNG local usa [ART-PIPELINE §44](../../../art/ART-PIPELINE.md); ese
procedimiento no cambia este resultado.

Aprobación humana explícita: luis, 2026-11-26, mensaje «Todo APPROVED creo que el resultado es
bastante bueno». Alcance: los 14 personajes Kenney de `smoke-15` y `batch-03`, la configuración B
(34 px/zoom 1×), `headquarters_cupola`, `headquarters_courtyard`, `cleaning_depot` y
`prp_waste_heap`, incluidas todas las capturas y estados presentados. No aprueba el playtest V.d.

## Personajes Kenney

Versión visual de referencia: `wp-char-04/smoke/2026-11-25-smoke-15`. Conserva el trabajador B
corregido y la técnica con el aspecto restaurado. El smoke de 28 frames no valida el batch de 504.

- [Lámina final del batch de 504 frames](../../../art/characters/candidates/wp-char-04/batch/2026-11-25-batch-03/final-sheet.png)
- [Manifiesto de la lámina final](../../../art/characters/candidates/wp-char-04/batch/2026-11-25-batch-03/final-sheet.json)
- [Validación independiente del batch](../../../art/characters/candidates/wp-char-04/batch/2026-11-25-batch-03/batch-validation.json)
- [Manifiesto del subconjunto Phaser a 34 px](../../../art/characters/candidates/wp-char-04/batch/2026-11-25-batch-03/scale-lab-manifest.json)
- [Manifiesto de 16 capturas a 34 px](../../../art/characters/candidates/wp-char-04/batch/2026-11-25-batch-03/scale-captures/manifest.json)
- [Lámina canónica smoke-15](../../../art/characters/candidates/wp-char-04/smoke/2026-11-25-smoke-15/contact-sheet.png)
- [Registro técnico del smoke](../characters/wp-char-04/01-smoke-results.md)
- [Comparación B/D en ciudad densa](../characters/wp-char-04/02-dense-comparison.md)

### Decisiones por personaje

| Asset | Evidencia técnica | Decisión humana | Autor y fecha |
| --- | --- | --- | --- |
| `civilian_male_a` | smoke-15 + batch-03 | `APPROVED` | luis · 2026-11-26 |
| `civilian_male_b` | smoke-15 + batch-03 | `APPROVED` | luis · 2026-11-26 |
| `civilian_female_a` | smoke-15 + batch-03 | `APPROVED` | luis · 2026-11-26 |
| `civilian_female_b` | smoke-15 + batch-03 | `APPROVED` | luis · 2026-11-26 |
| `supervisor` | smoke-15 + batch-03 | `APPROVED` | luis · 2026-11-26 |
| `construction_worker_a` | smoke-15 + batch-03 | `APPROVED` | luis · 2026-11-26 |
| `construction_worker_b` | smoke-15 + batch-03; chaqueta naranja conservada | `APPROVED` | luis · 2026-11-26 |
| `maintenance_technician` | smoke-15 + batch-03; pelo/gorra restaurados | `APPROVED` | luis · 2026-11-26 |
| `enforcer_male` | smoke-15 + batch-03 | `APPROVED` | luis · 2026-11-26 |
| `enforcer_female` | smoke-15 + batch-03; chaqueta/cuello a revisar en ciclo completo | `APPROVED` | luis · 2026-11-26 |
| `police` | smoke-15 + batch-03 | `APPROVED` | luis · 2026-11-26 |
| `firefighter` | smoke-15 + batch-03 | `APPROVED` | luis · 2026-11-26 |
| `medical_professional` | smoke-15 + batch-03 | `APPROVED` | luis · 2026-11-26 |
| `municipal_professional` | smoke-15 + batch-03 | `APPROVED` | luis · 2026-11-26 |

Criterios aprobados:

- [x] Profesión legible a 28/34 px en los 14 roles.
- [x] Idle/walk y cuatro direcciones revisados en el batch completo.
- [x] Ajuste de chaqueta/cuello de `enforcer_female` y contraste de roles oscuros.
- [x] Accesorios sin recorte ni deriva.
- [x] Configuración B ratificada frente a D en ciudad densa.
- [x] Presupuesto de assets y carga por distrito.

Resultado humano: **APPROVED** para los 14 personajes y la configuración B.
El batch conserva 14 advertencias: en cada rol, la muestra walk-0 de la fuente es píxel-idéntica a
idle; las otras siete muestras y cada par adyacente tienen movimiento medible.

## Sedes y depósito

### Sedes de organización

- [Lámina de completado diurno](../../../art/organization-headquarters/review/complete-day.png)
- [Lámina de completado nocturno](../../../art/organization-headquarters/review/complete-night.png)
- [Lámina de estados diurnos](../../../art/organization-headquarters/review/states-day.png)
- [Capturas reales de ciudad](../../../art/organization-headquarters/review/gameplay-overview.png)
- [Matriz de 96 candidatas](../../../art/organization-headquarters/candidate-matrix.json)
- [Auditoría técnica por asset](../../../art/organization-headquarters/technical-audit.json)
- [Manifiesto de 288 capturas](../../../art/organization-headquarters/gameplay-capture-v1/capture-manifest.json)

| Asset | Evidencia técnica | Decisión humana | Autor y fecha |
| --- | --- | --- | --- |
| `headquarters_cupola` | 48 candidatas + 144 capturas | `APPROVED` | luis · 2026-11-26 |
| `headquarters_courtyard` | 48 candidatas + 144 capturas | `APPROVED` | luis · 2026-11-26 |

- [x] Seis estados, cuatro orientaciones y ambos moods.
- [x] Cochera/patio de servicio y emblemas de organización en ciudad.
- [x] Placa neutral y color/forma runtime a 0,5×/1×/1,5×.
- [x] Presupuesto de descarga/caché y conducta con y sin variante promovida.

### Depósito municipal de limpieza

- [Lámina de completado diurno](../../../art/cleaning-depot/review/complete-day.png)
- [Lámina de completado nocturno](../../../art/cleaning-depot/review/complete-night.png)
- [Lámina de estados diurnos](../../../art/cleaning-depot/review/states-day.png)
- [Matriz de 48 candidatas](../../../art/cleaning-depot/candidate-matrix.json)
- [Auditoría técnica por asset](../../../art/cleaning-depot/technical-audit.json)
- [Manifiesto de 144 capturas](../../../art/cleaning-depot/gameplay-capture-v1/capture-manifest.json)

Capturas locales para inspección en la máquina preparada:
`docs/art/cleaning-depot/gameplay-capture-v1/cd_cleaning_depot_complete_o0_day_civic_z1.png`,
`cd_cleaning_depot_complete_o0_night_civic_z1.png`,
`cd_cleaning_depot_foundation_o0_day_civic_z1.png` y
`cd_cleaning_depot_burning_o0_night_civic_z1.png`.

| Asset | Evidencia técnica | Decisión humana | Autor y fecha |
| --- | --- | --- | --- |
| `cleaning_depot` | 48 candidatas + 144 capturas | `APPROVED` | luis · 2026-11-26 |
| `prp_waste_heap` (patio) | 4 azimuts × día/noche, hashes runtime verificados | `APPROVED` | luis · 2026-11-26 |

- [x] Procedencia, matriz de estados/orientaciones y captura en ciudad.
- [x] Lectura municipal y tres bahías que no parezcan escaparates.
- [x] Patio con camión, contenedor y montón a escala de juego.
- [x] Comportamiento con y sin depósito.

Resultado humano de sedes y depósito: **APPROVED**.

## Cómo registrar una decisión

El responsable debe sustituir `PENDING` por `APPROVED` o `REJECTED` en cada fila, añadir autor y
fecha, y describir el alcance exacto (variante, estados, moods, orientaciones y capturas). Una
aprobación parcial no habilita los assets omitidos. El agente no inferirá decisiones de mensajes
parciales, silencio, tests automáticos ni de una conversación anterior.

## Verificación posterior a la aprobación

La promoción y la verificación en la ciudad real están registradas en
[world-activation-2026-11-26/manifest.json](../../../art/world-activation-2026-11-26/manifest.json):
13 capturas, día/noche, seis estados, cuadrillas idle/walk y save/load SnapshotV3. Esta verificación
técnica no modifica el alcance de la aprobación humana anterior.

## V.d

El playtest humano de V.d sigue `PENDING HUMAN PLAYTEST` en
`docs/execution/phase-4/vd-final-playtest-checklist.md`. Este cierre de catálogo no lo aprueba.
