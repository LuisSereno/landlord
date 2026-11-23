# WP-CHAR-01 · Primeros candidatos gráficos

Fecha: 2026-11-23. Estado: **candidatos técnicamente válidos; rework artístico recomendado; no
promocionados**.

## Resultado técnico

- 3 arquetipos × 4 direcciones × 2 animaciones × 2 frames = **48 PNG**.
- Fuente: Microsoft Rocketbox (MIT), ya instalada en el repositorio original y leída sin
  modificarla.
- Blender: 5.2.2 LTS, build `d13f752e3b9c`.
- Validación independiente: **48/48 frames**, 0 errores de hash, matriz, metadata, alfa o texturas
  magenta.
- `idle` y `walk` tienen hashes distintos; cada clip conserva dos poses.
- Todos los PNG siguen en `docs/art/characters/candidates/`; `runtimePromotion` es `false`.
- La aprobación visual humana sigue pendiente.

Evidencia:

- [Manifiesto de candidatos](candidates/candidate-manifest.json)
- [Validación técnica](candidates/candidate-validation.json)
- [Hashes de láminas](candidates/contact-sheets.json)
- [Lámina raw](candidates/phase1-candidates-raw.png)
- [Lámina gameplay con gamma 1,8](candidates/phase1-candidates-gameplay.png)
- [Lámina a 28 px de alto](candidates/phase1-candidates-1x.png)

Las láminas muestran las 16 posiciones por arquetipo y dos controles runtime (`chr_worker` y
`chr_citizen`). El gamma deja los personajes más legibles que el bake raw, coincide con el ajuste
actual de Phaser y no modifica los PNG de runtime.

## Fuentes seleccionadas

| Candidato | Avatar Rocketbox | Lectura visual observada | Decisión |
| --- | --- | --- | --- |
| Supervisor | `Male_Adult_03` | Chaqueta de oficina; se lee como administrativo/gerente | No aprobar como capataz; falta casco/clipboard y silueta de obra |
| Obrero | `Male_Adult_05` | Chaleco utilitario; es el mismo avatar de `chr_citizen` | Conservar como referencia de vestuario, no como variante final |
| Enforcer | `Male_Adult_10` | Chándal rojo con rayas blancas | Rechazar para la dirección actual; resulta moderno y poco industrial |

## Autoevaluación visual

1. **Profesión.** A 28 px se distinguen figuras humanas y, débilmente, el rojo del enforcer, pero no
   se identifican con fiabilidad supervisor, obrero o matón. No se cumple todavía el criterio de
   oficio reconocible por silueta y vestuario.
2. **Época.** El chándal del enforcer contradice claramente el baseline industrial 1925–1940. El
   supervisor viste de oficina y el obrero no tiene casco ni herramienta.
3. **Variedad.** El obrero candidato comparte geometría exacta con el control `chr_citizen`; no
   resuelve la variedad canónica de dos obreros.
4. **Animación.** `walk` frame 0 es prácticamente reposo, también en el control existente; frame 1
   introduce la zancada. El ciclo de dos poses funciona como prueba, pero necesita evaluación de
   cadencia y lectura en movimiento antes de aprobarse.
5. **Escala y contraste.** Las alturas importadas son coherentes con personas de ~1,8 m y la lámina
   a 28 px conserva la silueta. El bake raw es demasiado oscuro; gamma 1,8 mejora la lectura.
6. **Bordes.** El validador registra que el alfa toca el borde del lienzo en los frames. No lo
   clasifica como error automático, pero queda como revisión de recorte/clipping para la pasada
   final.

**Veredicto:** los tres archivos son experimentos útiles, no assets finales. No se promueve ninguno
a runtime ni se cambia la apariencia actual de las cuadrillas.

## Siguiente pasada artística

- Composición offline en Blender sobre Rocketbox: casco/clipboard para supervisor, casco y
  herramienta para obrero, vestuario/pose de época para enforcer.
- Buscar una segunda variante de obrero que no duplique `chr_citizen` y evitar los avatares
  `Female_Adult_04`/`Female_Adult_13` hasta resolver el guard R2.
- Revisar las cuatro direcciones y los dos clips a 28 px, con movimiento real y fondos de juego.
- Mantener estado `candidate` hasta revisión humana; sólo entonces valorar promoción.

## Reproducción

Desde la raíz del worktree:

```bash
node tools/art-pipeline/blender/characters/render_phase1_candidates.mjs \
  --source-root /home/luis/RepositorioGitHub/landlord
python3 tools/art-pipeline/blender/characters/validate_phase1_candidates.py
python3 tools/art-pipeline/blender/characters/compose_phase1_candidate_sheets.py
```

La herramienta comprueba hashes de fuente, clips, licencia, script runtime y style layer antes y
durante el render. No escribe en el repositorio original ni invoca los manifests de edificios.

## Atribución

Personajes basados en Microsoft Rocketbox, Copyright (c) 2020 Microsoft, licencia MIT. El aviso y su
hash están registrados en `character-jobs-phase-1.json` y `candidate-manifest.json`.
