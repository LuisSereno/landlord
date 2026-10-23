# WP2.14 — progreso de ejecución del runbook

> Seguimiento del runbook `docs/art/WP2-14-CODEX-RUNBOOK.md` (rama remota
> `origin/docs/wp2-14-codex-runbook`, commit `3daa8e1`; no fusionado a main).
> Convención de estados del runbook: READY / IN_PROGRESS / REVIEW / BLOCKED / DONE.

## Contexto de gobernanza

WP2.14 ya fue cerrado el 2026-10-23 por una vía distinta al runbook, con acta en
`docs/execution/phase-2/wp2-14-visual-direction-spike-2026-10-23.md` y baseline
`graphic_civic` aprobada en la revisión de Gate 2. La ejecución real usó un único script
procedural (`tools/art-pipeline/blender/visual_direction_spike.py`) que renderiza escenas
golden completas, no el pipeline por-asset que describe el runbook.

H0 se ejecuta aquí como documentación retroactiva de gobernanza: fija el experimento y el
estado de partida **sin decidir nada nuevo** y sin alterar el cierre ya aprobado. Las fases
H1+ quedan mapeadas a su evidencia real; las que el runbook define y el repositorio no
cumple se marcan BLOCKED con la causa, no DONE por inercia.

## HEAD inicial

- `e8a91c5` (main, árbol limpio al inicio de H0).

## H0 — Preflight y congelación del experimento — DONE

Checks ejecutados:

- `pnpm art:staging:validate` → verde: "Validated 13 approved sources and 11 original asset briefs."
- Blender vía CLI → `Blender 5.2.2 LTS`, build 2026-09-15 (distribución fijada en
  `blender_artist/toolchain/`, extraída localmente; la carpeta está en `.gitignore` por D-054).
- 11 briefs del kit (`blender_artist/manifests/visual-direction-spike-kit.json`) referencian
  sólo IDs aprobados en `staging-sources.json`; ningún input proviene de la cuarentena
  (9 entradas en `quarantined`, incluidos `red_brick_4k.blend.zip` y los packs Kenney UI,
  que no se usan).
- Inventario de formatos reales de los packs del primer building y primer character
  (sólo listado, sin extraer ni usar):
  - `red_bricks_02_4k.blend.zip` → `.blend` + 2 `.jpg` + `.png` + `.exr`;
  - `wood_planks_grey_4k.blend.zip` → `.blend` + 2 `.jpg` + `.png` + `.exr`;
  - `Universal Base Characters[Standard].zip` → contiene un `.zip` anidado (formato interno
    pendiente de inventariar al desempaquetar en fase de character pipeline);
  - `Universal Animation Library[Standard].zip` → contiene un `.zip` anidado (idem).
- Experimento versionado: `blender_artist/manifests/wp2-14-experiment.json`.

## Decisiones todavía OPEN

Cerradas por el acta del spike (deuda documental: `docs/art/OPEN-DECISIONS.md` aún las lista
como abiertas — no se toca en esta fase): cámara (orto 45°/30°/roll 0), renderer EEVEE,
master PNG RGBA16 1024×576, dirección base `graphic_civic`.

Abiertas y vigentes según el acta del spike:

- escala física exacta de la celda tras perfilar una escena densa en Phaser;
- atlas packer definitivo y política Git LFS;
- número de direcciones y presupuesto de animación de personajes;
- budgets finales de memoria/draw calls con el distrito representativo integrado.

Abiertas en `OPEN-DECISIONS.md` sin tocar por el acta: setting visual 1925–1940, estética
(realismo estilizado + caricatura moderada), grid de referencia 128×64, master 2×, luz
canónica fija, día/noche, personajes 8 direcciones, GPU compression, TexturePacker o
alternativa, tipografías, repositorio artístico separado, Building Factory, Character
Factory, incorporación de third-party a Git.

## Tabla de fases

| Fase | Estado | Evidencia / causa |
|---|---|---|
| H0 Preflight | DONE | esta sesión; validator verde; Blender 5.2.2 LTS por CLI; experiment manifest |
| H1 Esqueleto de pipeline | DONE (vía alterna) | `visual_direction_spike.py`: cámara+light parametrizados, render headless reproducible (seed 42), validación `art:spike:validate`, smoke `smoke:art-lab`. Pendiente del runbook: metadata sidecar v1 por asset y tests unitarios de config |
| H2 Primer building end-to-end | BLOCKED | no existe cadena por-asset render→trim→metadata→atlas→Phaser→picking; el spike renderizó escenas completas y el acta difirió atlas/trim a WP3.13/Alpha |
| H3 Art Lab y golden scenes | DONE (vía alterna) | ruta `/art-lab` + `smoke:art-lab` + capturas reproducibles; sin visual regression con baseline explícita ni presets de zoom del runbook |
| H4 Character pipeline mínimo | BLOCKED | sin importación Quaternius en Blender ni frames por dirección |
| H5 Kit funcional neutral | DONE (vía alterna) | las 3 direcciones comparten el mismo kit funcional (acta, "Kit comparado"); no pasó por pipeline por-asset |
| H6 Generar A/B/C sin elegir | SUPERSEDED | A/B/C ya renderizadas y comparadas el 2026-10-23 por la vía del acta, con scoring y recomendación; handoff Extra High del runbook no creado porque X1/X2 ocurrieron en la revisión de Gate 2 |
| STOP Extra High #1 | SUPERSEDED | la selección ocurrió en revisión de gate, no desde una sesión High |
| X1 Revisión comparativa | DONE (vía gate review) | acta: tabla ponderada 93/85/82, `SELECT graphic_civic` |
| H7 Hardening | BLOCKED | cámara/render/output sí (acta); escala física, atlas strategy y metadata v1 abiertas |
| H8 Rehearsal de producción | BLOCKED | sin variaciones de assets ni medición de coste de repetición |
| STOP Extra High #2 | SUPERSEDED | X2 equivalente ejecutado en la revisión de Gate 2 (baseline aprobada) |
| X2 Ratificación final | DONE (vía gate review) | `gate-2-review-2026-10-23.md` + acta WP2.14; WP2.14 cerrado |

## Registro de sesiones

- 2026-10-23 — H0 ejecutado (documentación retroactiva post-cierre). HEAD inicial `e8a91c5`.
  Artefactos: este progreso + `blender_artist/manifests/wp2-14-experiment.json`.
