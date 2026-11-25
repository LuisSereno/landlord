# WP-CHAR-03 — Correcciones artísticas

Fecha: 2026-11-24. Estado: smoke y lote producidos; revisión visual humana pendiente.

## 1. Supervisor

- Base conservada: `character-male-e.glb`.
- Gafas eliminadas localmente: componente 2, 52 polígonos.
- Casco reconstruido con corona cónica de 8 lados, visera, banda y cresta; deja de parecer una boina.
- Clipboard bajado 0,24 m respecto al anclaje anterior y reducido a 0,22×0,30 m; queda junto al costado, no junto a la oreja.
- Pelo y chaleco conservan el tratamiento de 02C.

Evidencia: `docs/art/characters/prototypes/wp-char-03/art-before-after/supervisor-before-after.png`.

## 2. Enforcer

- Base conservada: `character-raider.glb`.
- Coleta eliminada localmente: componente 1, 76 polígonos.
- Sonrisa sustituida por una boca neutra: componente 5, 8 polígonos, más línea rígida anclada a `head`.
- Chaqueta pizarra, mangas carbón y pantalón carbón; cinturón conservado.
- El material opcional de camisa sigue con 0 polígonos; no se le atribuye contraste. La mejora procede de chaqueta/mangas/piernas y de la cabeza más limpia.

Evidencia: `docs/art/characters/prototypes/wp-char-03/art-before-after/enforcer-before-after.png`.

## 3. Bombero

- Base conservada: `character-male-a.glb`.
- Gafas eliminadas localmente: componente 2, 52 polígonos.
- Casco reconstruido con corona cónica de 10 lados, visera, reborde posterior inclinado −18°, escudo frontal y cresta.
- Franjas reflectantes ensanchadas: 61 polígonos frente a 16 en 02C.
- Uniforme carbón, guantes y botas conservados.

Evidencia: `docs/art/characters/prototypes/wp-char-03/art-before-after/firefighter-before-after.png`.

## 4. Lote

- Supervisor: 4 idle + 8 walk D0.
- Enforcer: 4 idle + 8 walk D0.
- Bombero: 4 idle + 8 walk D0.
- Total nuevo: 36 frames.
- Obrero y policía conservados sin cambios.

Las salidas están en `docs/art/characters/prototypes/wp-char-03/prototypes/`. Cada reporte incluye hash de fuente, materiales, componentes eliminados, accesorios, anclajes, cámara, Blender y hash de imagen.

## 5. Defectos pendientes

- Aprobación artística humana.
- Validación visual de las cuatro orientaciones y del ciclo walk completo en Phaser.
- El enforcer sigue siendo oscuro a 14 px; el laboratorio medirá su lectura a 28/34 px.
- No se produjeron los otros nueve personajes ni se promovió ningún asset.
