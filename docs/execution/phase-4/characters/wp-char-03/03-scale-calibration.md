# WP-CHAR-03 — Calibración de escala

Fecha: 2026-11-24. Estado: módulo puro y pruebas implementados; laboratorio Phaser pendiente.

## 1. Medición

Se midieron 84 PNG con Pillow y umbral de alfa `>2`:

- Obrero: 36 frames.
- Policía: 12 frames.
- Supervisor/enforcer/bombero: 36 frames nuevos.

Para cada frame se registran dimensión total, bounds visibles, altura visible y punto de apoyo. El apoyo se define como el centro horizontal de la fila visible más baja; no se añade padding.

Manifiesto de laboratorio: `apps/web/public/qa-character-scale/manifest.json`.
Copia legible de medidas: `docs/art/characters/prototypes/wp-char-03/sprite-measurements.json`.

## 2. Cálculo

`apps/web/src/character-scale-lab/scale-calibration.ts`:

- `scale = alturaObjetivoMundo / alturaVisible`.
- `originX = support.x / width`.
- `originY = support.y / height`.
- `alturaPantalla = alturaVisible × scale × zoomCámara`.

El origen se aplica con `setOrigin()` de Phaser. El punto de apoyo cae exactamente sobre la posición de celda obtenida con `gridToScreen()`.

Para animaciones con alturas de alfa variables se usa una escala estable por personaje/animación/dirección, calculada con la altura visible máxima. El frame más alto alcanza la altura objetivo; los demás conservan su variación natural sin bombear de escala.

## 3. Medidas relevantes

| Personaje | Idle D0 alto | Walk D0 alto | Escala estable 28 px | Escala estable 34 px |
|---|---:|---:|---:|---:|
| Obrero | 452 | 452 | 0,06195 | 0,07522 |
| Supervisor | 439 | 441 | 0,06349 | 0,07710 |
| Enforcer | 415 | 416 | 0,06731 | 0,08173 |
| Policía | 408 | 409 | 0,06846 | 0,08313 |
| Bombero | 458 | 460 | 0,06087 | 0,07391 |

La escala correcta no es `28/256`: varía aproximadamente entre `0,06087` y `0,08173` para 34 px.

## 4. Pruebas

`scale-calibration.test.ts` cubre:

- PNG con padding y sin padding.
- Alturas de alfa distintas dentro de un ciclo.
- Pivotes próximos al borde inferior.
- Imágenes vacías y dimensiones inválidas.
- Zooms 0,5×, 1×, 1,25× y 2,5×.
- Altura de pantalla objetivo y estabilidad de escala.

Resultado: **12/12 pruebas**.

## 5. Relación con el mundo

- Celda isométrica: 64×32 px.
- Celda física: 4 m.
- Densidad: 11,313708 px/m.
- La calibración usa alturas de píxeles del mundo isométrico, coherentes con los sprites de edificios y vehículos.
- El zoom de cámara multiplica la altura final en pantalla; no modifica la posición lógica ni la huella física.
