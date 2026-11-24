# WP-CHAR-02C — Producción

Fecha: 2026-11-24. Estado: lote técnico producido; revisión visual humana pendiente.

## 1. Worktree y herramientas

- Worktree: `/home/luis/RepositorioGitHub/landlord-characters-02c`.
- Rama: `wip/wp-char-02c-visual-rework`.
- Base: `3b64d35f55a1507581704ed6f89206d8d0b4890e`.
- Blender: 5.2.2 LTS, build `d13f752e3b9c`.
- Renderizador: `tools/art-pipeline/blender/characters/wp_char_02c/render_profession_rework.py`.
- Manifiesto: `blender_artist/manifests/character-experiments-02c.json`.
- Cámara: ortográfica 45°/30°, `orthoScale=2.3`, `targetZ=0.95`.
- Salida: 512×512 RGBA, EEVEE, fondo transparente, gamma de revisión 1,8 sólo en láminas.

## 2. Fuentes y decisiones

| Personaje | Fuente final | SHA-256 | Decisión |
|---|---|---|---|
| Supervisor | `character-male-e.glb` | `7b67dbd3b1873a8182e78b1764db008496e4c3b871db59f45ed224852c238fd4` | Conserva base; corrige pelo y casco localmente |
| Enforcer | `character-raider.glb` | `00db0d50e4da865d95c7fd9caad9a49277f8809423f5d318387caa1dce7861d4` | Cambio justificado: sin barba, silueta más robusta |
| Bombero | `character-male-a.glb` | `c1cba637e1d946822df07385fabf9d1bc55255ce19e0e8f7124d767e03987126` | Cambio justificado: sin barba, casco protagonista |
| Policía | `character-male-c.glb` | `6bb3b1ac8b196fd005dd5cb73621cd88d8a44d1f0f92fcf0c03f3b47ac9b9a74` | Control conservado; 0 frames nuevos |
| Obrero | `character-worker.glb` | `c8e0cd7a98737f33f0a6a6c9f2575054baff3b443925b57f0451ba3268128319` | Referencia artística conservada |

Licencia Kenney: CC0-1.0, SHA-256 `92aba6c40f4d09ea7c637c50b36147946632e5ade3c0296ca78be1effcd81661`.

## 3. Modificaciones

### Supervisor

- Pelo local: componentes 1 y 5, 92 polígonos, material marrón oscuro.
- Cuerpo: chaleco ocrá, mangas azul industrial, pantalón denim y botas marrones.
- Casco de capataz: domo 0,92 m, ala 1,06 m, visera y banda; ala = 87,78% del ancho de cabeza.
- Clipboard: tablero 0,25×0,35 m, papel y clip; anclado a `arm-left`.
- Sin edición de vértices, atlas o GLB.

### Enforcer

- Pelo/gorra integrada local: componentes 0 y 1, 178 polígonos, material carbón.
- Cuerpo: chaqueta pizarra, mangas carbón, pantalón carbón y botas negras.
- Cinturón y hebilla anclados a `torso`.
- El material opcional de camisa quedó con 0 polígonos asignados; no se le atribuye contraste visual. La diferenciación real procede de chaqueta, mangas, gorra y silueta.
- Sin arma, insignia, paneles rígidos ni edición de fuente.

### Bombero

- Pelo corto local: componente 0, 77 polígonos.
- Casco: domo 1,04 m (85,53% de cabeza), ala 1,16 m (95,40%), visera, reborde posterior, escudos y cresta.
- Uniforme: carbón, dos franjas amarillas, guantes y botas robustas.
- Cinturón anclado a `torso`.
- Sin edición de vértices, atlas o GLB.

## 4. Lote

| Rol | Idle | Walk D0 | Total |
|---|---:|---:|---:|
| Supervisor | 4 | 8 | 12 |
| Enforcer | 4 | 8 | 12 |
| Bombero | 4 | 8 | 12 |
| **Nuevo** | **12** | **24** | **36** |
| Policía conservado | 4 | 8 | 12 |

Walk usa frames `[0,2,4,6,8,10,12,14]`, excluyendo el frame final duplicado. Los 36 hashes nuevos son globalmente únicos.

Metadatos por frame y candidato:

- `docs/art/characters/prototypes/wp-char-02c/prototypes/<rol>/final/<rol>-prototype.json`
- Incluyen fuente, SHA, licencia, materiales, piezas de cabeza, geometría añadida, accesorios, anclajes, animaciones, cámara, Blender, hash de imagen, estado técnico y defectos pendientes.

## 5. Mediciones

| Rol | Deriva máxima de accesorio | Altura normalizada | Máx. Y de cámara | Mín. Y de cámara | MAD antes/después idle |
|---|---:|---:|---:|---:|---:|
| Supervisor | `1.490116e-7 m` | 1,8 m | 0,975905 | 0,055948 | 5,9589 |
| Enforcer | `5.960464e-8 m` | 1,8 m | 0,925774 | 0,039777 | 19,4148 |
| Bombero | `1.192093e-7 m` | 1,8 m | 0,982964 | 0,052199 | 14,3767 |

- 0 frames recortados.
- Suelo mínimo Z = 0 en los 36 frames.
- Todas las diferencias consecutivas de walk superan MAD 1,0; el mínimo medido es 2,6361.
- Los hashes de atlas empaquetado antes/después son idénticos por valor.
- Los GLB externos conservan su SHA después de renderizar.

## 6. Validación

- `validate_profession_rework.py`: **488 checks, 0 errores**.
- `validate_final_review.py`: **161 checks, 0 errores**.
- Control WP-CHAR-02B revalidado con su validador original: **542 checks, 0 errores**.
- Todas las láminas finales están por debajo de 1 MiB.

Evidencia:

- `docs/art/characters/prototypes/wp-char-02c/controls/rework-validation.json`
- `docs/art/characters/prototypes/wp-char-02c/controls/review-validation.json`
- `docs/art/characters/prototypes/wp-char-02c/controls/wp-char-02b-prototype-validation.json`

## 7. Reproducción

```bash
BLENDER=/home/luis/RepositorioGitHub/landlord/blender_artist/toolchain/blender-5.2.2-linux-x64/blender
SOURCE=/home/luis/RepositorioGitHub/landlord

$BLENDER --background --factory-startup --python-exit-code 1 \
  --python tools/art-pipeline/blender/characters/wp_char_02c/render_profession_rework.py -- \
  --manifest blender_artist/manifests/character-experiments-02c.json \
  --source-root "$SOURCE" \
  --output docs/art/characters/prototypes/wp-char-02c/prototypes \
  --runtime-asset tools/art-pipeline/blender/runtime_asset.py \
  --role supervisor --final
```

Repetir con `enforcer` y `firefighter`. El script rechaza salidas no vacías para no confundir archivos previos con la ejecución actual.
