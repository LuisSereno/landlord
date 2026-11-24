# WP-CHAR-03 — Acta final

Fecha: 2026-11-24.

## 1. Identidad Git

- Worktree: `/home/luis/RepositorioGitHub/landlord-characters-03`.
- Rama: `wip/wp-char-03-scale-calibration`.
- SHA inicial: `3f012895b922692ca0877812bf643a017a581688`.
- SHA final de arte, laboratorio y evidencia: `268805cc9783527fd8390ab55b402167fe9730e7`.
- El commit de cierre documental es posterior a ese SHA y no cambia renders ni código del laboratorio.
- Push, merge y rebase: no realizados.

Commits:

1. `5457e6a` — `art(characters): finalize Kenney profession corrections`
2. `268805c` — `test(characters): add isolated Phaser scale lab`

## 2. Cambios artísticos

- Supervisor: gafas eliminadas, casco cónico ajustado y clipboard bajado al costado.
- Enforcer: coleta eliminada, boca neutra y contraste entre chaqueta, mangas y piernas.
- Bombero: gafas eliminadas, casco posterior inclinado y franjas protectoras de 61 polígonos.
- Obrero y policía conservados sin modificaciones.
- 36 frames nuevos; 84 sprites medidos y copiados al laboratorio.

## 3. Laboratorio Phaser

- Página aislada `apps/web/char-scale-lab.html`.
- Calle, acera, dos edificios reales, dos vehículos reales y cinco personajes.
- Cámara, zoom anclado al cursor, pan, picking, profundidad y culling.
- Movimiento de obrero y enforcer a 1,4 celdas/s.
- Configuraciones A–D y arreglos `street`, `lineup`, `door`, `vehicle`.
- API `window.__charScaleLab` para capturas y pruebas.

## 4. Recomendación

**B — altura visible de personaje 34 px, cámara zoom 1×.**

B mejora la lectura profesional sin reducir la superficie de ciudad ni cambiar proporciones físicas. C y D agrandan más, pero recortan más los edificios y el mapa. B es el default del laboratorio; producción no cambia.

## 5. Resultados

- Calibración y configuración: 15/15 pruebas.
- Web: 452 passed / 4 skipped.
- Phaser: 74/74 comprobaciones, 54 capturas, 0 errores de navegador.
- Validación agregada: 463 checks, 0 errores.
- Typecheck, arquitectura, build web y build laboratorio: PASS.
- Web lint: 2 errores preexistentes reproducidos en WP-CHAR-02C; 0 nuevos.
- Rendimiento balanceado: medianas A 23,97, B 23,63, C 24,22 y D 25,19 FPS en software; no hay penalización consistente de B.

## 6. Archivos modificados

Sólo superficies autorizadas:

- `tools/art-pipeline/blender/characters/wp_char_03/`.
- `docs/art/characters/prototypes/wp-char-03/`.
- `docs/execution/phase-4/characters/wp-char-03/`.
- `apps/web/src/character-scale-lab/`.
- `apps/web/char-scale-lab.html`.
- `apps/web/public/qa-character-scale/`.

## 7. Aislamiento

- Repositorio original: limpio en `0a6770d183d6fe09529a9eeebee5da2d1d0369a5`.
- WP-CHAR-02C: limpio en `3f012895b922692ca0877812bf643a017a581688`.
- WP-CHAR-02A/02B: sus entradas estaban `prunable` y los directorios no existen en el entorno final; no se eliminaron ni modificaron durante WP-CHAR-03. Sus commits `c4bc041` y `3b64d35` siguen disponibles y su evidencia está incorporada en la base.
- Diff de simulación, shared, edificios, runtime, manifiestos protegidos, escena principal y configuración global: vacío.
- Sin promoción runtime, sin cambios de cámara/zoom de producción y sin generar los otros nueve personajes.

## 8. Defectos pendientes

- Aprobación artística humana de supervisor, enforcer y bombero.
- Decisión de integrar B en producción después del cierre de edificios.
- Animaciones de trabajo/reparación/sabotaje no evaluadas.
- El enforcer sigue siendo oscuro a 14 px; B mejora su lectura a 34 px.
- No se declara `ARTISTIC_APPROVED`, `PRODUCTION_READY` ni `RUNTIME_READY`.

## 9. Enlaces de revisión

- [Cinco personajes × cuatro configuraciones](../../../../art/characters/prototypes/wp-char-03/review/five-by-four-configs.png)
- [B como predeterminado](../../../../art/characters/prototypes/wp-char-03/review/recommended-default.png)
- [Escena general A–D](../../../../art/characters/prototypes/wp-char-03/scale-comparison/general-four-configs.png)
- [Puerta A–D](../../../../art/characters/prototypes/wp-char-03/scale-comparison/door-four-configs.png)
- [Recomendación](07-recommendation.md)
- [Pruebas](06-tests.md)
