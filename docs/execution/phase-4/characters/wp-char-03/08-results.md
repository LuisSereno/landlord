# WP-CHAR-03 — Acta final

Fecha de cierre técnico: 2026-11-24. Auditoría de cierre: 2026-11-25.

## 1. Identidad Git

- Worktree: `/home/luis/RepositorioGitHub/landlord-characters-03`.
- Rama: `wip/wp-char-03-scale-calibration`.
- SHA inicial: `3f012895b922692ca0877812bf643a017a581688`.
- SHA final de arte, laboratorio y evidencia: `268805cc9783527fd8390ab55b402167fe9730e7`.
- SHA técnico verificado en la auditoría de cierre: `45224a38ba133eeeb623a521eea7d90a9dc32024`.
- El commit de consolidación documental es posterior a ese SHA y no cambia renders, código ni resultados del laboratorio.
- Push, merge y rebase: no realizados.

Commits:

1. `5457e6a` — `art(characters): finalize Kenney profession corrections`
2. `268805c` — `test(characters): add isolated Phaser scale lab`
3. `45224a3` — `docs(characters): close WP-CHAR-03 scale calibration`

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
- Integridad de evidencia: 721 checks, 0 errores; 232 archivos y diez fuentes/dependencias con hash correcto.
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
- WP-CHAR-02C: commit `3f012895b922692ca0877812bf643a017a581688` disponible; su entrada aparece ahora `prunable` en el entorno de auditoría.
- WP-CHAR-02A/02B: sus entradas estaban `prunable` y los directorios no existen en el entorno final; no se eliminaron ni modificaron durante WP-CHAR-03. Sus commits `c4bc041` y `3b64d35` siguen disponibles y su evidencia está incorporada en la base.
- Diff de simulación, shared, edificios, runtime, manifiestos protegidos, escena principal y configuración global: vacío.
- Sin promoción runtime, sin cambios de cámara/zoom de producción y sin generar los otros nueve personajes.

## 8. Defectos pendientes

- Aprobación artística humana de supervisor, enforcer y bombero.
- Decisión de integrar B en producción después del cierre de edificios.
- Animaciones de trabajo/reparación/sabotaje no evaluadas.
- El enforcer sigue siendo oscuro a 14 px; B mejora su lectura a 34 px.
- Comparación posterior B frente a D en una ciudad suficientemente densa, preferiblemente tras cerrar la generación de edificios.
- Promoción futura de los personajes Kenney al runtime.
- Integración futura en la escena principal de Phaser.
- Producción de los nueve personajes restantes.
- No se declara `ARTISTIC_APPROVED`, `PRODUCTION_READY` ni `RUNTIME_READY`.

## 9. Decisiones de cierre

- **D-CHAR-01 — Familia artística:** Kenney Mini Characters es la familia principal; Rocketbox deja de ser la fuente artística preferida.
- **D-CHAR-02 — Altura de personajes:** 34 px es el objetivo provisional de referencia; 28 px se conserva como baseline. El contrato runtime de producción no cambia.
- **D-CHAR-03 — Escala inicial:** B (`zoom 1× / personaje 34 px`) es la recomendación actual y el default exclusivo del laboratorio.
- **D-CHAR-04 — Alternativa visual:** D (`zoom 1,15× / personaje 34 px`) queda como alternativa prometedora. Su comparación definitiva se hará en una ciudad más densa y no bloquea este cierre.
- **D-CHAR-05 — Integración:** los personajes nuevos no se promocionan al runtime; la integración en la escena principal requiere un trabajo posterior específico.
- **D-CHAR-06 — Estado artístico:** la calidad técnica está verificada; la aprobación artística definitiva y las variantes restantes siguen pendientes.

## 10. Estado de cierre

`WP-CHAR-03 — CLOSED_TECHNICAL / VISUAL_REVIEW_PENDING`

La revisión visual humana y las decisiones de integración enumeradas arriba no impiden el cierre técnico de los requisitos originales de WP-CHAR-03.

## 11. Enlaces de revisión

- [Cinco personajes × cuatro configuraciones](../../../../art/characters/prototypes/wp-char-03/review/five-by-four-configs.png)
- [B como predeterminado](../../../../art/characters/prototypes/wp-char-03/review/recommended-default.png)
- [Escena general A–D](../../../../art/characters/prototypes/wp-char-03/scale-comparison/general-four-configs.png)
- [Puerta A–D](../../../../art/characters/prototypes/wp-char-03/scale-comparison/door-four-configs.png)
- [Recomendación](07-recommendation.md)
- [Pruebas](06-tests.md)
