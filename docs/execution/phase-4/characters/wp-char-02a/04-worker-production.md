# WP-CHAR-02A · Producción del obrero de referencia

Fecha: 2026-11-24. Estado: **obrero producido y validado técnicamente; aprobación artística humana pendiente**.

## 1. Fuente y licencia

- Modelo: Kenney Mini Characters `character-worker.glb`.
- SHA-256: `c8e0cd7a98737f33f0a6a6c9f2575054baff3b443925b57f0451ba3268128319`.
- Licencia: CC0-1.0; archivo `mini-characters/License.txt`, SHA-256
  `92aba6c40f4d09ea7c637c50b36147946632e5ade3c0296ca78be1effcd81661`.
- La fuente se lee desde `/home/luis/RepositorioGitHub/landlord/blender_artist/staging/third_party/`
  y no se modifica.

## 2. Modelo, rig y vestuario

- Dos mallas skineadas: `body-mesh` (992 vértices, 562 polígonos) y `head-mesh`
  (559 vértices, 331 polígonos); **893 triángulos**.
- Armature `character-worker`, **7 huesos**: `root`, dos piernas, torso, dos brazos y cabeza.
- El casco, el overol, la camisa y el calzado están integrados en la geometría y el atlas `colormap`.
- No se añade chaqueta, abrigo, pantalón, manga ni panel rígido. No hay accesorios flotantes.
- El `Icosphere` de 2 m que el importador glTF crea en `glTF_not_exported` se excluye antes de medir
  y normalizar. Sólo entran la armature y sus mallas skineadas.

## 3. Escala y materiales

- Escala de importación: ×2,18.
- Altura normalizada: **1,796590 m**; caja idle 1,447522 × 1,011552 × 1,796590 m.
- Material: copia local del atlas `colormap` para cada malla. La textura original se conserva.
- Ajustes locales: metallic 0, roughness 0,9, specular 0,22.
- No se modifica ningún material de la fuente ni el style layer global.

## 4. Animación

| Clip | Acción | Rango Blender | Muestras publicadas |
| --- | --- | --- | --- |
| Idle | `idle` | 0–32, 24 FPS | 1 pose de reposo por dirección |
| Walk | `walk` | 0–16, 24 FPS | frames 0, 2, 4, 6, 8, 10, 12 y 14 |

- Blender 5.2 requiere enlazar `action` y `action_slot`; la herramienta lo hace explícitamente.
- El muestreo excluye el frame 16 para no duplicar el inicio como octava pose.
- Medición del ciclo completo: **0 m de root motion planar**, **0 m de diferencia de cierre** entre
  primer y último frame para todos los huesos.
- El clip original tiene un rango vertical de malla de −0,057505 a 0,067964 m. El renderizador
  counter-translada `IMPORT_ROOT` en Z para que el pie inferior quede en Z=0 en cada frame. No edita
  la acción ni la pose.
- La marcha es estilizada y sin rodillas/codos intermedios; es coherente con la maqueta, no realista.

## 5. Cámara y render

- Cámara ortográfica isométrica: azimut base 45° + 90° por dirección, elevación 30°.
- `orthoScale=2,05`, `targetZ=0,9`.
- Cuatro direcciones: D0=45°, D1=135°, D2=225°, D3=315°.
- Render 512×512 RGBA, EEVEE, fondo transparente.
- La iluminación del style layer se crea una sola vez por escena; no se acumula entre direcciones.
- Matriz final: **4 direcciones × (1 idle + 8 walk) = 36 frames**.

## 6. Herramientas

Todas las herramientas nuevas están en
`tools/art-pipeline/blender/characters/wp_char_02a/`:

- `render_worker_reference.py`: importa, normaliza, duplica materiales, enlaza acciones, alinea el
  suelo y renderiza las cuatro direcciones.
- `inspect_worker_cycle.py`: mide root motion y cierre del ciclo completo.
- `validate_worker_reference.py`: valida hashes, matriz, dimensiones, alfa, magenta, suelo, cámara,
  slots y diferencias entre frames.
- `compose_worker_review_sheets.py`: genera las nueve láminas offline y su manifiesto de hashes.
- `validate_worker_review_package.py`: valida láminas, inputs, ciclo y paquete.

El pipeline compartido `runtime_asset.py` y `source_import.py` se usa como dependencia de sólo
lectura; no se modifica.

## 7. Resultado técnico

- 36/36 frames con hash único.
- 512×512 RGBA, sin píxeles magenta.
- Alfa despejada de los cuatro bordes del lienzo.
- 0/36 muestras recortadas por cámara.
- 0 de penetración tras la alineación de suelo.
- 8 frames de marcha distintos por dirección; diferencia media absoluta mínima entre consecutivos:
  3,3625/255.
- Validación de frames: **401 comprobaciones, 0 errores**.
- Validación del paquete de revisión: **94 comprobaciones, 0 errores**.

Evidencia principal:
[`worker-reference.json`](../../../../art/characters/prototypes/wp-char-02a/worker-reference/final/worker-reference.json),
[`worker-reference-validation.json`](../../../../art/characters/prototypes/wp-char-02a/worker-reference/final/worker-reference-validation.json)
y
[`worker-cycle-closure.json`](../../../../art/characters/prototypes/wp-char-02a/worker-reference/final/worker-cycle-closure.json).

## 8. Estado

El obrero es un **prototipo offline**, no un asset runtime. `runtimePromotion` permanece `false`.
No se generan supervisor, segundo obrero, técnico ni enforcers. La ampliación queda condicionada a
revisión humana de este obrero.
