# WP-CHAR-01B · Informe de resultados

Fecha: 2026-11-24. Estado: **TECHNICAL_COMPLETE / VISUAL_REVIEW_PENDING**.

No se declara aprobación artística ni `RUNTIME_READY`. No se promocionó ningún personaje y no se
modificó el pipeline de edificios.

## A. Estado del repositorio

| Elemento | Valor |
| --- | --- |
| Worktree | `/home/luis/RepositorioGitHub/landlord-wp-char-01` |
| Rama | `wip/wp-char-01-foundation` |
| SHA inicial | `745c5b0a8c80d5a78b492c6e6f07b266749a24d0` |
| SHA funcional/artístico | `07c93c4` |
| Original | `0a6770d`, rama `wip/organization-headquarters`, limpio |
| Push / merge / rebase | No realizados |
| Cambios pendientes | Ninguno salvo el commit documental de cierre |

Commits de WP-CHAR-01B, en orden:

1. `5769095` — `docs(characters): establish WP-CHAR-01B visual baseline`
2. `194992f` — `feat(characters): add reusable character accessories`
3. `bf231b4` — `docs(characters): record WP-CHAR-01B composition smoke`
4. `fdf9694` — `docs(characters): record remaining operational smoke`
5. `8e6482e` — `test(characters): isolate character catalog coherence`
6. `7c0335c` — `feat(characters): refine operational wardrobe and anchors`
7. `77133d5` — `test(characters): add phase-1b visual review tools`
8. `a3fd37e` — `test(characters): validate phase-1b delivery bundle`
9. `07c93c4` — `art(characters): produce six operational phase-1b candidates`

El SHA del commit documental final se entrega en el mensaje de cierre; un acta no puede contener
su propio hash.

## B. Producción artística

| Personaje | Modelo base | Accesorios | Frames | Estado técnico | Estado visual |
| --- | --- | --- | ---: | --- | --- |
| Supervisor | `Male_Adult_03` | Casco, clipboard | 16 | `TECHNICAL_PASS` | `VISUAL_REVIEW` |
| Obrero A | `Male_Adult_12` | Casco, cinturón de herramientas | 16 | `TECHNICAL_PASS` | `VISUAL_REVIEW` |
| Obrero B | `Male_Adult_02` | Gorra, bolsa de herramientas | 16 | `TECHNICAL_PASS` | `VISUAL_REVIEW` |
| Técnico | `Female_Adult_09` | Gorra, cinturón, bolsa y llave | 16 | `TECHNICAL_PASS` | `VISUAL_REVIEW` |
| Enforcer A | `Male_Adult_09` | Gorra, cuello alto y solapas | 16 | `TECHNICAL_PASS` | `VISUAL_REVIEW` |
| Enforcer B | `Female_Adult_09` | Abrigo largo y sombrero | 16 | `TECHNICAL_PASS` | `VISUAL_REVIEW` |

- 6 personajes × 4 direcciones × 2 animaciones × 2 frames = **96 PNG**.
- 96 metadata JSON y 96 sidecars de composición.
- 11 láminas comparativas: 0,5×, 1×, 2×, 2,5×, antes/después, parejas, técnico, seis juntos,
  cuatro direcciones y controles runtime.
- Todas las láminas son composiciones offline con Pillow, no capturas de Phaser.
- Procedencia Microsoft Rocketbox (MIT); accesorios y materiales locales son composición original.
- El directorio phase-1b contiene 327 archivos, 115 PNG y 4.798.230 bytes; el PNG más grande ocupa
  155.961 bytes, por debajo de 1 MiB.

### B.1 Resultado visual

- Supervisor: el casco y clipboard corrigen la lectura administrativa; el documento es pequeño a 1×.
- Obrero A: cuerpo distinto de `chr_citizen`, casco y cinturón; sigue siendo una silueta genérica.
- Obrero B: gorra, jersey claro y bolsa; IoU de máscara 0,9386 frente a A, por lo que la diferencia
  depende sobre todo de vestuario/accesorio.
- Técnico: herramientas y cinturón aportan oficio, pero la base de blazer sigue visible y puede leer
  como oficinista/sanitario.
- Enforcer A: se eliminaron las rayas y el rojo deportivo del prototipo anterior; gorra, cuello alto y
  solapas dan presencia oscura.
- Enforcer B: abrigo envolvente y sombrero; IoU 0,7207 frente a enforcer A, la pareja más diferenciada.
- A 0,5× sólo se leen figuras; a 1× los roles dependen de color/accesorio; a 2×/2,5× se aprecia el
  vestuario y los materiales.
- Cuatro direcciones coherentes; deriva máxima de anclaje 3,814697265625e-5 < 1e-4.
- `idle` y `walk` tienen hashes distintos; `walk` frame 0 sigue siendo casi reposo.
- 0 píxeles magenta y 0 hashes duplicados. El alfa toca el borde en 96/96 frames y queda para
  revisión de recorte/clipping.

Evidencia principal: [PHASE-1B-CANDIDATES.md](../../../art/characters/PHASE-1B-CANDIDATES.md).

Láminas:

- [1×](../../../art/characters/candidates/phase-1b/phase1b-scale-1x.png)
- [Antes/después](../../../art/characters/candidates/phase-1b/phase1b-before-after.png)
- [Obreros A/B](../../../art/characters/candidates/phase-1b/phase1b-workers-pair.png)
- [Enforcers A/B](../../../art/characters/candidates/phase-1b/phase1b-enforcers-pair.png)
- [Técnico vs obreros](../../../art/characters/candidates/phase-1b/phase1b-technician-vs-workers.png)
- [Seis operativos](../../../art/characters/candidates/phase-1b/phase1b-six-operational.png)
- [Con controles runtime](../../../art/characters/candidates/phase-1b/phase1b-six-with-runtime-controls.png)

## C. Resultados de validación

| Comando | Resultado |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm test:architecture` | PASS |
| `pnpm art:character-factory:validate` | PASS: 14/14, 5 runtime-existing |
| `node scripts/validate-character-factory.mjs --self-test` | PASS: 10/10 |
| `pnpm --filter @landlord/web test` | PASS: 437 tests, 4 skipped |
| `pnpm art:blender:check` | PASS: 263 imágenes/jobs, 22.594.162 bytes |
| `pnpm art:licenses:check` | PASS |
| `python3 .../validate_phase1_candidates.py --manifest .../phase-1b/candidate-manifest.json` | PASS: 6 jobs, 96 frames, 0 errores |
| `python3 .../measure_phase1b_visuals.py` | PASS: 6 personajes, 5 parejas, 0 hashes duplicados |
| `python3 .../validate_phase1b_delivery.py` | PASS: 96 frames, 11 láminas, 5 parejas |
| ESLint de herramientas `.mjs` nuevas | PASS |
| `pnpm lint` global | FAIL: 37 errores previos; 2 en el validador de WP-CHAR-01 y 35 en archivos no tocados |
| `pnpm art:catalog:check` | FAIL: catálogo visual obsoleto 13/14 |
| `node .../validate_character_catalog_coherence.mjs` | FAIL esperado: 14 en factoría, 13 en catálogo, falta `medical_professional` |
| `pnpm art:jobs:validate` | FAIL previo: `qa_mini_male`, `qa_mini_female`, `qa_mini_worker` |
| `pnpm art:binaries:check` | FAIL: 135 violaciones idénticas al baseline; 0 en personajes |
| `pnpm test` final | FAIL: 20 tests / 12 archivos de simulación; 610 pasados, 20 omitidos |
| `git diff --check` | PASS |

### C.1 Comparación con WP-CHAR-01

- Typecheck, arquitectura, Character Factory, Blender, licencias y suite web conservan su resultado.
- La suite web sigue en 437 pasadas / 4 omitidas.
- `pnpm lint` no estaba medido en el cierre anterior; ahora queda clasificado como deuda previa, no
  como regresión de WP-CHAR-01B.
- `art:catalog:check`, `art:jobs:validate` y `art:binaries:check` siguen rojos por las mismas causas
  conocidas.
- `pnpm test` final: **20 fallos / 12 archivos**, 610 pasados y 20 omitidos. El baseline tenía 21
  fallos / 13 archivos. La única diferencia es que `headquarters.test.ts` pasó en esta corrida; no
  apareció ningún fallo nuevo.
- `generate-alpha-fixture.test.ts` volvió a reescribir `scripts/fixtures/alpha-phase4.snapshot.json`.
  El diff se atribuyó al test y se revirtió sólo en el worktree; el hash volvió a
  `3fa10e245309b09383b43ea39c31925a4ef767ab`.

## D. Problemas pendientes

### Arte

- Revisión humana de los seis candidatos; ninguno está aprobado.
- Obrero A/B comparten silueta corporal en gran medida.
- El técnico conserva una base de blazer poco industrial.
- El clipboard del supervisor es pequeño a escala de juego.
- El alfa toca el borde en todos los frames; revisar recorte/clipping.

### Animación

- `walk` frame 0 es casi reposo; evaluar cadencia y selección de poses.
- Faltan clips de trabajo, reparación, sabotaje y daño.
- No se modificaron reglas del motor ni animaciones autoritativas.

### Integración Phaser

- Diferida: no se tocó `IsometricSpikeScene.ts`, `crew-presence.ts`,
  `gameplay-visual-adapter.ts` ni `visual-scale.ts`.
- No existe captura real de Phaser de estos candidatos; las láminas están etiquetadas como offline.

### Herramientas compartidas

- Catálogo visual 13/14: diagnóstico y parche propuesto en
  [04-catalog-integration-dependency.md](04-catalog-integration-dependency.md).
- `art:jobs:validate` conserva los tres IDs `qa_mini_*` inválidos.
- `art:binaries:check` conserva 135 violaciones históricas.

### Aislamiento

- Diff contra `745c5b0`: 340 archivos cambiados incluyendo este informe, 0 archivos protegidos.
- Original limpio en `0a6770d`; staging y toolchain sólo leídos.
- Sin cambios en simulación, shared, edificios, manifiestos runtime, renderer principal ni
  configuración global.

## E. Siguiente fase

1. Revisión humana de las once láminas y selección/rework de los seis candidatos.
2. Promoción controlada sólo de los personajes aprobados, con actualización de manifiestos runtime
   en un WP autorizado.
3. Construir el inventario de apariencias desde el manifiesto runtime y conectar
   `planAgentVisuals` a Phaser.
4. Retirar marcadores genéricos sólo donde exista un sprite adecuado; conservar fallbacks explícitos.
5. Añadir animaciones de trabajo, reparación, sabotaje y daño con validación de cuatro direcciones.
6. Medir rendimiento y escalado con personajes reales en la escena.
7. Aplicar la corrección 13/14 después de cerrar edificios, en un árbol limpio y revisando que el diff
   del catálogo no toque edificios.
