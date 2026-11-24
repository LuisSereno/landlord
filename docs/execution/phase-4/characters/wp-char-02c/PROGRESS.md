# WP-CHAR-02C · Progreso

## 2026-11-24 · Etapa 0 — Aislamiento y lecturas

- Worktree creado: `/home/luis/RepositorioGitHub/landlord-characters-02c`.
- Rama: `wip/wp-char-02c-visual-rework`.
- SHA inicial: `3b64d35f55a1507581704ed6f89206d8d0b4890e`.
- WP-CHAR-02B verificado limpio en `3b64d35`; el worktree nuevo también está limpio.
- Leídas las reglas de `AGENTS.md`, el contexto obligatorio y los informes de WP-CHAR-02A/02B.
- Confirmados: Kenney es la familia decidida, el obrero es referencia artística y el estado máximo sigue siendo `TECHNICAL_COMPLETE / VISUAL_REVIEW_PENDING`.
- Próximo paso: diagnóstico A/B/C de supervisor, enforcer y bombero con geometría, materiales y accesorios medidos.

## 2026-11-24 · Etapa A — Diagnóstico de cabeza

- Generados 15 renders A/B/C en `diagnostics-v3`; las primeras corridas se conservan como `diagnostics/` y `diagnostics-v2/`.
- Confirmado: supervisor y enforcer heredan regiones del atlas de pelo; el bombero hereda una barba geométrica y un casco demasiado pequeño.
- Medido el casco del bombero: domo 47% y ala 58% del ancho de cabeza; deriva de anclaje <0,000001 m.
- Creadas tres láminas de diagnóstico y `01-head-defects.md`.
- Decisión: probar `character-raider.glb` para enforcer y `character-male-a.glb` para bombero; conservar `character-male-e.glb` para supervisor mientras el smoke no indique lo contrario.
- Validación ejecutada: Blender `--python-exit-code 1`, 15/15 renders, hashes de fuente/licencia y controles B comparados píxel a píxel con 02B.
- Pendiente: corrección progresiva y smoke de supervisor.

## 2026-11-24 · Etapa B — Supervisor

- Creados `character-experiments-02c.json`, `02-correction-design.md` y el renderizador local reutilizable.
- Conservado `character-male-e.glb`; recoloreados localmente 92 polígonos de pelo (componentes 1 y 5).
- Casco de capataz reconstruido: domo 76% y ala 88% del ancho de cabeza; clipboard 25×35 cm.
- Generados idle y walk 4/8 en `prototypes/supervisor/smoke/`.
- Medido: deriva máxima de accesorios `1.490116e-7 m`, suelo Z=0, 0 clipping, atlas empaquetado sin cambios.
- Revisión local: mancha blanca ausente, casco proporcionado, chaleco/clipboard reconocibles y silueta distinta del obrero a 28 px.
- Lámina: `docs/art/characters/prototypes/wp-char-02c/review/02-smoke-supervisor.png`.
- Decisión: smoke aceptado para lote limitado; aprobación artística sigue pendiente del propietario.
- Próximo paso: enforcer.

## 2026-11-24 · Etapa C — Enforcer

- Inspeccionadas las bases alternativas: `diagnostics-v3/alternative-source-heads.json`.
- Cambio de base aceptado localmente: `character-male-g.glb` → `character-raider.glb`; elimina la barba geométrica y conserva rig/acciones Kenney.
- Gorra integrada recoloreada localmente (componentes 0 y 1, 178 polígonos); no se añade una segunda gorra.
- Primer smoke archivado en `prototypes/enforcer/smoke-v1/` por pérdida de detalle; chaqueta aclarada a pizarra y camisa azul-gris.
- Generados idle y walk 4/8 en `prototypes/enforcer/smoke/`.
- Medido: deriva máxima `5.960465e-8 m`, suelo Z=0, 0 clipping, atlas sin cambios.
- Revisión local: círculo ausente, rostro limpio, chaqueta con contraste y silueta robusta distinta del obrero; comparación formal con policía reservada para el paquete final.
- Lámina: `docs/art/characters/prototypes/wp-char-02c/review/02-smoke-enforcer.png`.
- Decisión: smoke aceptado para lote limitado; aprobación artística sigue pendiente.
- Próximo paso: bombero.
