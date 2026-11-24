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
