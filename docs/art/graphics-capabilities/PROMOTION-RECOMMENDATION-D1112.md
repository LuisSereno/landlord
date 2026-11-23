# PROMOTION-RECOMMENDATION-D1112 — recomendación independiente de promoción gráfica

**Fecha:** 2026-11-23 · **HEAD:** `ed8267e` · **Autor:** revisión técnica+artística solicitada por el
propietario tras FINAL-ASSET-QA. Ninguna clasificación de este documento constituye autorización de
promoción: `runtime-promotions.json` no se tocó y la decisión es conjunta (propietario + revisor).

Todas las imágenes citadas fueron examinadas directamente (lectura visual del PNG, no sólo metadata).

## 1. Resultado de Vitest

`245/249` = **245 passed + 4 skipped, 0 failed, 0 todo** (exit 0). Los cuatro son las pruebas opt-in
del mundo completo de 9 distritos (3 tras `VC9_FULLWORLD`, 1 tras `VH10_PERF`,
`full-world-integration.test.ts:66/160/172/212`): preexisten a D-111.2 (V.h.9/V.h.10), su omisión
está declarada en el código con motivo de coste, y no bloquean el trabajo gráfico. Detalle y tabla
por prueba: `VITEST-D1112-REVIEW.md`.

## 2. Clasificación de edificios

Base visual: `wp06_candidates_ab.png` (control vs candidata por perfil), las cuatro parejas a 1× de
`closure/urban/`, `four_candidates_in_phaser_half.png` (0,5×) y `modern_candidates_in_phaser.png`.

| Edificio | Variante | Calidad visual (1–5) | Legibilidad (1–5) | Categoría | Motivo |
|---|---|---:|---:|---|---|
| `mixed_tenement` | `gn_residential_v2` · seed 2 | 5 | 4 | **A** | El más completo: cornisa de piedra, crujía con paños diferenciados, puerta-balcón, tres plantas con ritmo shopfront abajo. A 1× se distingue de su control sin esfuerzo; a 0,5× conserva silueta propia. Sin defectos conocidos. |
| `row_house` | `gn_residential_v2` · seed 17 | 4 | 4 | **A** | Mansarda con remate, zócalo de sillar, vanos de arco en planta baja. El control antiguo era un bloque pardo casi ilegible; la candidata sí dice "adosado". A 0,5× mantiene lectura. |
| `warehouse` | `gn_industrial_v2` · seed 2 | 4 | 3 | **B** | Muelle de carga con pretíl y ventana de banda: identidad industrial real, no la caja gris del control. Defecto: el horneado `night_civic` deja la fachada oscura y a 0,5× se funde con el asfalto; el bake `day_civic` (`wp06_warehouse-burning-day`) lee mucho mejor. Ajuste concreto: emparejar bake día/noche por mood como hacen los residenciales. |
| `town_hall` | `ag_civic_v2` · seed 2 | 4 | 3 | **B** | La arcada Arch Generator es el mejor detalle arquitectónico del catálogo (estriado, capitel, orden civic). Defectos: el patio delantero es una losa desnuda y la esquina a pico sigue sin resolver (hueco declarado en el índice). A 0,5× el volumen es pequeño frente a su control V7. |

Legibilidad medida sobre capturas reales: a 1× los cuatro son inconfundibles; a 0,5×
`mixed_tenement` y `row_house` mantienen lectura y los otros dos la pierden parcialmente (sombra
oscura en `warehouse`, tamaño en `town_hall`).

## 3. Clasificación de estados

Base: `modern_building_condition_ab.png` (conservado/envejecido/dañado/en llamas del MISMO
`mixed_tenement`, examinado a 1,6× y 2,5×), `building_condition_states.png`, y las variantes
publicadas en `evidence/v2/candidates/`.

| Edificio | Estado | Categoría | Defecto pendiente | Recomendación |
|---|---|---|---|---|
| `mixed_tenement` | complete (conservado) | **A** | ninguno conocido | aprobar el sprite conservado |
| `mixed_tenement` | aged (proyección material) | **B** | a 1× la diferencia es sutil (ladrillo apagado, regueros suaves) y a 0,5× es efectivamente invisible | **reforzar visualmente el envejecido antes de aprobar**: más contraste en regueros verticales, suciedad diferenciada en la banda del forjado y hollín en los vanos; el bake a 2,5× ya demuestra que la receta funciona, sólo falta que sobreviva a la escala de juego |
| `mixed_tenement` | damaged | **A** | ninguno: sección de cubierta caída, forjados al aire y escombros comparten la gramática de la candidata | aprobar el dañado |
| `mixed_tenement` | burning (variante híbrida) | **A** | 1/16 focos (`fire:flame:window:1`) sin llama en el bake | aprobar el burning; el foco muerto es cosmetico y está registrado |
| `warehouse` | complete | **B** | emparejado de mood día/noche (ver §2) | aprobar tras emparejar bakes |
| `warehouse` | damaged | **B** | misma oscuridad de bake nocturno; sin captura propia en Phaser todavía | capturar en Phaser antes de decidir |
| `warehouse` | burning | **A** | ninguno conocido (22 anclajes reales, sin columna duplicada) | aprobar el burning |

`aged` **no está promocionado** al runtime y sigue siendo la decisión D-080 del propietario: hoy el
tier cae en el sprite `complete` (documentado, no simulado).

## 4. Incendios

Base: `modern_building_fire_ab.png` (cinco filas × día/noche, examinada completa).

- **Mejor configuración `mixed_tenement`: la MODERADA (8 de 16 focos).** En un edificio residencial
  estrecho el intenso acumula lenguas contiguas que ensucian la lectura de la fachada; el moderado
  reparte techo-fachada-vano sin tapar el edificio y de noche el glow sigue localizado.
- **Mejor configuración `warehouse`: la INTENSA (19 focos).** La nave es una superficie horizontal
  grande y plana: con 6 focos el fuego se lee como fogatas dispersas; el intenso forma un cuerpo
  continuo creíble sobre la cubierta de chapa sin llegar a recortar a blanco.
- **El humo convence**: una sola columna (horneada; el rig no duplica), deriva coherente en los dos
  moods. Es el mejor resultado de todo el paquete de efectos.
- **La intensidad de las llamas es adecuada** en las dos configuraciones recomendadas; el intenso en
  el tenement y el moderado en la nave son los que se sienten mal proporcionados.
- **¿Configuración por defecto?** Sí: foci ≈ superficie ardiendo — p. ej. `ceil(área de cubierta en
  celdas × factor)`, con la moderada como suelo. Debe ser una PALANCA de configuración visual QA, no
  un estado nuevo de simulación; la decisión de "incidente grande vs pequeño" pertenece al dominio
  cuando exista.
- **Falta medir antes de producción**: p95 de frame time del rig a 16/19 focos en GPU real (aquí
  llvmpipe), la transición damaged→burning en la misma candidata, y el fuego en el mundo real (sólo
  se fotografió en el lab y en la escena QA).

## 5. Iluminación

Base: `night_lighting_final_ab.png` (day_balanced / night_balanced / night_fire / night_fire 0,5× /
CANVAS), medidas σ 91 %, 0 px de recorte a blanco en WebGL.

- **day_balanced**: ya en producción por gates anteriores; sin cambios.
- **night_balanced — recomendarlo para producción.** Es el único tratamiento nocturno con evidencia
  completa: fachadas legibles por emisivos por tipo, farolas con bloom contenido, σ nocturna 91 %,
  desmontaje limpio en 8 ciclos. No oculta información (el contenido visible cae de 99,7 % a 87,3 %
  pero sin puntos ciegos: lo que desaparece es cielo y asfalto, no entidades).
- **night_fire — QA.** Sólo tiene evidencia en el lab con dos focos legacy; falta fotografiarlo con
  los incendios WP06 del A/B (el rig de las candidatas monta su propio glow y no hay captura de la
  combinación completa). No recomiendo nada no demostrado.
- **grading / bloom / dynamic lighting**: siguen QA. El grading cuesta +33,3 ms p95 medidos y el
  lighting de día es +60/67 ms: hoy restarían rendimiento sin ganar legibilidad. No promocionar.
- Combinaciones sólo probadas aisladas: `night_fire` + rig de candidatas (NO EVALUABLE), `grading`
  sobre la noche (NO EVALUABLE).

## 6. Selección final personal

Si yo fuera el director artístico y el responsable técnico, esto es lo que haría:

**Mis tres mejores candidatos:**

1. **`mixed_tenement`** — es el edificio que mejor demuestra la dirección artística: arquitectura
   legible, materiales con tratado real, y estados conservado/dañado/burning coherentes. Promocionar
   la familia entera de estados existentes junto con el sprite, no el complete solo.
2. **`row_house`** — el cambio visual frente a su control es el más grande de los cuatro; es el
   edificio residencial barato que llena calles, así que su impacto visual en partida es mayor que
   el del tenement.
3. **`warehouse` burning** — el muelle de carga con pretíl y los 22 anclajes hacen el mejor incendio
   del catálogo; aprobaría el burning y esperaría el emparejado de bakes para el complete.

**Las tres mejoras visuales prioritarias:**

1. **Reforzar el `aged` a escala 1×** (contraste de regueros, banda de forjado, hollín de vanos) —
   es la pieza que separa "material proyectado" de "material percibido", y desbloquea D-080 con
   evidencia real.
2. **Emaparejar bake día/noche como política del catálogo** (el warehouse nocturno oscuro es el
   contraejemplo; los residenciales son el modelo).
3. **Resolver el patio del `town_hall`** — la arcada merece un antepatio con mobiliario público
   (`planGameplayPublicSpaceFurniture`) y la esquina a pico necesita una decisión, no un parche.

**Qué NO promocionaría todavía:** el sprite `aged` (invisibles a 0,5×), `town_hall` (patío/esquina),
`warehouse` complete (hasta emparejar bakes), `warehouse` damaged (sin captura Phaser), `grading`,
`bloom` global y `dynamic lighting` de día (coste p95 medido sin beneficio de legibilidad), y todo
el laboratorio HiFi/Archimesh como tales (HiFi es un generador de fachada de laboratorio monótono —
su valor ya está absorbido en las gramáticas; Archimesh quedó `rejected`).

**Si sólo se pudiera aprobar una primera promoción pequeña:** `mixed_tenement` en sus cuatro
estados con el incendio MODERADO como configuración por defecto y `night_balanced` como tratamiento
nocturno. Un solo edificio, coherente en los cuatro estados, con fuego y noche medidos — es la
apuesta que enseña el juego completo (construir, deteriorar, arder, de noche) con el menor riesgo.

## 7. Evidencias

- Edificios y legibilidad: `evidence/v2/sheets/wp06_candidates_ab.png` ·
  `evidence/v2/closure/urban/{row_house,mixed_tenement,town_hall,warehouse}_pair_10x.png` ·
  `evidence/v2/closure/urban/four_candidates_in_phaser_half.png` ·
  `evidence/v2/final-assets/modern_candidates_in_phaser.png`
- Estados: `evidence/v2/final-assets/modern_building_condition_ab.png` (1,6× y 2,5×) ·
  `evidence/v2/sheets/building_condition_states.png` ·
  `evidence/v2/sheets/weathering_states.png`
- Incendios: `evidence/v2/final-assets/modern_building_fire_ab.png` ·
  `evidence/v2/closure/fire/hybrid_fire_ab.png`
- Iluminación: `evidence/v2/closure/night/night_lighting_final_ab.png`
- Herramientas: `evidence/v2/sheets/gn_v2_ab.png` (Geometry Nodes) ·
  `evidence/v2/sheets/ag_civic_ab.png` (Arch Generator) ·
  `evidence/v2/sheets/hifi_grid_ab.png` (HiFi) ·
  `evidence/v2/sheets/industrial_warehouse_ab.png` (módulos industriales 4 m sobre base Kenney) ·
  los propios candidatos integran módulos Kenney/Quaternius (`wp06_*.json → sourceIds`)
- Coherencia con Material Maquette: **evaluación parcial** — los candidatos comparten el tratado de
  materiales (atlases estilizados, sin albedo plano) pero no existe una captura de candidatas WP06
  bajo el perfil `material_maquette_buildings_v1`; el spike `docs/art/material-maquette-spike/ab/`
  fotografía el mundo sin edificios. NO EVALUABLE en el nivel de sprite.
