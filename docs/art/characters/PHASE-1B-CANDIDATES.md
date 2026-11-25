# WP-CHAR-01B · Candidatos operativos

Fecha: 2026-11-24. Estado: **TECHNICAL_COMPLETE / VISUAL_REVIEW_PENDING**.

No se ha aprobado arte ni promocionado ningún personaje. Todos los archivos permanecen en
`docs/art/characters/candidates/phase-1b/` con `runtimePromotion: false`.

## Producción

| Personaje | Modelo base | Accesorios | Frames | Estado técnico | Estado visual |
| --- | --- | --- | ---: | --- | --- |
| Supervisor | `Male_Adult_03` | Casco, clipboard | 16 | `TECHNICAL_PASS` | `VISUAL_REVIEW` |
| Obrero A | `Male_Adult_12` | Casco, cinturón de herramientas | 16 | `TECHNICAL_PASS` | `VISUAL_REVIEW` |
| Obrero B | `Male_Adult_02` | Gorra, bolsa de herramientas | 16 | `TECHNICAL_PASS` | `VISUAL_REVIEW` |
| Técnico | `Female_Adult_09` | Gorra, cinturón, bolsa y llave | 16 | `TECHNICAL_PASS` | `VISUAL_REVIEW` |
| Enforcer A | `Male_Adult_09` | Gorra, cuello alto y solapas | 16 | `TECHNICAL_PASS` | `VISUAL_REVIEW` |
| Enforcer B | `Female_Adult_09` | Abrigo largo y sombrero | 16 | `TECHNICAL_PASS` | `VISUAL_REVIEW` |

Cada personaje incluye 4 direcciones × `idle`/`walk` × 2 frames. Los sidecars de composición
registran material, accesorios, huesos, objetos y deriva de anclaje.

## Láminas de revisión

Todas son **composiciones offline con Pillow**, no capturas de Phaser.

- [Escala 0,5×](candidates/phase-1b/phase1b-scale-0_5x.png)
- [Escala 1×](candidates/phase-1b/phase1b-scale-1x.png)
- [Escala 2×](candidates/phase-1b/phase1b-scale-2x.png)
- [Escala 2,5×](candidates/phase-1b/phase1b-scale-2_5x.png)
- [Antes/después](candidates/phase-1b/phase1b-before-after.png)
- [Obrero A vs obrero B](candidates/phase-1b/phase1b-workers-pair.png)
- [Enforcer A vs enforcer B](candidates/phase-1b/phase1b-enforcers-pair.png)
- [Técnico vs obreros](candidates/phase-1b/phase1b-technician-vs-workers.png)
- [Seis operativos](candidates/phase-1b/phase1b-six-operational.png)
- [Cuatro direcciones](candidates/phase-1b/phase1b-four-directions.png)
- [Seis operativos con controles runtime](candidates/phase-1b/phase1b-six-with-runtime-controls.png)

## Autoevaluación visual

1. **Supervisor.** El casco y el clipboard corrigen la lectura administrativa. A 28 px el casco se
   distingue; el clipboard es pequeño y puede necesitar una silueta más grande o una pose de
   inspección en una pasada futura.
2. **Obrero A.** Cambia el cuerpo respecto a `chr_citizen` y añade casco/cinturón. Se lee como obrero
   de construcción, aunque chaqueta y casco siguen siendo genéricos.
3. **Obrero B.** Gorra, jersey claro y bolsa lo separan del obrero A. La máscara normalizada tiene
   IoU 0,9386 con A: la diferencia es sobre todo vestuario/accesorio, no una silueta corporal muy
   distinta. Revisión humana debe decidir si basta.
4. **Técnico.** Cinturón, bolsa y llave aportan identidad industrial, pero la base de blazer sigue
   visible. Es el candidato con mayor riesgo de leerse como oficinista o sanitario.
5. **Enforcer A.** Se eliminaron las rayas deportivas y el rojo moderno del prototipo anterior. Gorra,
   cuello alto y solapas dan una presencia oscura; a 1× el detalle se pierde, pero la silueta sigue
   distinta de los obreros.
6. **Enforcer B.** Abrigo envolvente y sombrero crean una segunda silueta clara. IoU 0,7207 frente a
   enforcer A: es la pareja más diferenciada.
7. **Escala.** A 0,5× sólo se leen figuras humanas; a 1× se distinguen roles por color/accesorio con
   dificultad; a 2× y 2,5× se aprecian vestuario, herramientas y coherencia de materiales.
8. **Orientaciones.** Las cuatro vistas mantienen escala, cámara y accesorios alineados. La deriva
   máxima medida es 3,814697265625e-5, por debajo de 1e-4.
9. **Animación.** `idle` y `walk` tienen hashes distintos en las cuatro direcciones. `walk` frame 0
   sigue siendo casi reposo; frame 1 introduce la zancada, igual que el control runtime.
10. **Integridad.** 0 píxeles magenta y 0 hashes duplicados. El alfa toca el borde en los 96 frames;
    no se marca como error automático, pero requiere revisión de recorte/clipping.

## Métricas orientativas

| Par | IoU de máscara | Diferencia media de luminancia |
| --- | ---: | ---: |
| Obrero A vs obrero B | 0,9386 | 7,200 |
| Enforcer A vs enforcer B | 0,7207 | 11,400 |
| Supervisor anterior vs nuevo | 0,9053 | 4,659 |
| Obrero anterior vs nuevo | 0,8077 | 11,008 |
| Enforcer anterior vs nuevo | 0,8900 | 6,451 |

Contraste de luminancia normalizado: desviación estándar entre 53,052 y 66,001. Estas métricas no
sustituyen la evaluación artística.

## Evidencia técnica

- [Manifiesto de candidatos](candidates/phase-1b/candidate-manifest.json)
- [Validación técnica](candidates/phase-1b/candidate-validation.json)
- [Validación de entrega](candidates/phase-1b/delivery-validation.json)
- [Hashes de láminas](candidates/phase-1b/review-sheets.json)
- [Métricas visuales](candidates/phase-1b/visual-metrics.json)
- [Inspección de fuentes](candidates/phase-1b/source-inspection.json)

## Reproducción

```bash
node tools/art-pipeline/blender/characters/render_phase1_candidates.mjs \
  --source-root /home/luis/RepositorioGitHub/landlord \
  --manifest blender_artist/manifests/character-jobs-phase-1b.json \
  --compositor tools/art-pipeline/blender/characters/character_compositor.py
python3 tools/art-pipeline/blender/characters/validate_phase1_candidates.py \
  --manifest docs/art/characters/candidates/phase-1b/candidate-manifest.json
python3 tools/art-pipeline/blender/characters/compose_phase1b_review_sheets.py
python3 tools/art-pipeline/blender/characters/measure_phase1b_visuals.py
python3 tools/art-pipeline/blender/characters/validate_phase1b_delivery.py
```

## Atribución

Personajes basados en Microsoft Rocketbox, Copyright (c) 2020 Microsoft, licencia MIT. Los accesorios
y materiales locales son composición original del pipeline de Landlord.
