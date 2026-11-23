# D1113-ART-ACCEPTANCE — registro de resultados y recomendación del agente (D-111.3)

**Fecha:** 2026-11-23 · **HEAD:** ver ledger `D1113-ART-REWORK-LEDGER.md`.
Opinión crítica del agente; **ninguna fila autoriza promoción** — la decisión es del propietario.
`runtime-promotions.json` no se tocó en todo D-111.3.

| Elemento | Resultado | Evidencia | Recomendación del agente | Decisión pendiente |
|---|---|---|---|---|
| Mixed Tenement | fachada sin franja (px verde-azulados −63 %), misma firma de composición | `evidence/d1113/facades/facade_fix_mixed_tenement_ab.png` · `final/d1113_city_candidates.png` | **APROBAR ARTÍSTICAMENTE** el complete corregido | promoción |
| Row House | franja de fachada desaparecida; el muro lateral conserva una sombra de alero natural y neutra | `facades/facade_fix_row_house_ab.png` | **APROBAR ARTÍSTICAMENTE**; la sombra de alero restante es natural | promoción |
| Warehouse | sin cambios (aprobado artísticamente por el propietario); sus variantes de daño/fuego ganan interior | `final/d1113_damage_fire.png` | mantener tal cual | — |
| Town Hall | nueva propuesta neoclásica monumental (receta `grand_neoclassical_hall` + columna y caliza originales): pórtico de 4 columnas blancas a 2 plantas, entablamento, frontón, escalinata, piano nobile | `townhall/town_hall_neoclassical_ab.png` · `final/d1113_town_hall.png` | la propuesta **resuelve el rechazo**; el frontón queda parcialmente tapado por la cornisa desde el ángulo de cámara y el anexo secundario es un volumen ciego — mejorables sin tocar la aprobación | aceptación de la nueva propuesta (sustituye al rechazado) |
| Envejecimiento | receta v3: diff medio 9,2→16,1/255 contra el conservado, 48 % de píxeles claramente distintos, sobrevive a 0,5× | `weathering_v3_ab.png` | **APROBAR la receta v3** para QA; el aged sigue sin sprite aprobado en runtime (D-080) | D-080 + promoción |
| Interiores dañados | forjados parciales, tabique, escalera, vigas; determinista, limitado al rectángulo del daño | `damaged_interior_mixed_tenement_ab.png` | **APROBAR** el sistema; el forjado superior flota sin apoyo visible a 1× (lectura doll-house aceptable) | integración en producción (requiere sprites damaged aprobados) |
| Interiores incendiados | el fuego lee DENTRO del edificio; llamas/humo aprobados intactos; anclajes idénticos al control (19/19 y 22/22) | `damage_fire_interiors_ab.png` | **APROBAR**; sin duplicación de humo ni geometría atravesada | ídem |
| Incendios y humo | intactos por decisión del propietario; verificados tras cada cambio | `damage_fire_interiors_ab.png` · `final/d1113_damage_fire.png` | sin cambios | — |
| Iluminación nocturna | intacta; los brazos nocturnos usan `night_balanced` sin recalibrar | `final/d1113_town_hall.png` · `final/d1113_damage_fire.png` | sin cambios | — |

## Clasificación sugerida (A/B/C/D, sin valor de autorización)

- **A — aprobaría ya:** fachadas corregidas de `mixed_tenement` y `row_house`; receta de envejecimiento v3; sistema de interior dressing (dañado y en llamas).
- **B — aprobar tras ajustes concretos:** town hall neoclásico (frontón/cornisa y anexo ciego); warehouse damaged/burning requieren la misma revisión humana que el resto.
- **C — mantener en QA:** todo; nada de D-111.3 está promocionado.
- **D — no recomendar:** ningún elemento de esta fase; los controles antiguos se conservan como referencia histórica.

## Validaciones ejecutadas (FASE 8)

Composer válido (17 gramáticas, 4 perfiles, candidatas 15) · contrato de weathering OK (test Blender,
interior alineado con brick) · licencias OK (3 bundles) · capabilities OK · `git diff --check` OK ·
validador de módulos: los 5 fallos sobre módulos nuevos de D-111.3 resueltos (categoría `interior`
añadida al vocabulario, fuentes originales aceptadas, jerarquías medidas); los 52 restantes son
preexistentes (GN sin texturas, §22 contextual, fire_flame/smoke) y no bloquean esta fase ·
captura Phaser: 14 brazos, 0 errores de página.
