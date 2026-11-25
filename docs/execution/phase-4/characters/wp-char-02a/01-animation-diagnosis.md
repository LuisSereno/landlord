# WP-CHAR-02A · Diagnóstico de animación y rig Rocketbox

Fecha: 2026-11-24. Estado: **causa principal confirmada; rig descartado como fuente de deformación; corrección aislada demostrada**.

## 1. Problema observado

La lámina de WP-CHAR-01B mostraba piernas aparentemente cruzadas o deformadas en `Walk1`, brazos
abiertos y una pose poco representativa. Esa imagen sola no permitía distinguir entre una pose
intermedia legítima, root motion, retarget, transformación, cámara o deformación de malla.

## 2. Casos de control

Se usó `Male_Adult_12.fbx`, el mismo avatar del obrero A, con los clips `m_idle_neutral_02.max.fbx` y
`m_walk_neutral_02.max.fbx`. Todos los controles comparten fuente, normalización, iluminación,
materiales base y cámara 45°/30°.

| Control | Contenido | Resultado |
| --- | --- | --- |
| A | Avatar importado, sin clip externo ni compositor | Reposo/A-pose de la fuente; 80 huesos |
| B | Clip original sin compositor | Misma deformación que C; root motion visible |
| C | Clip original con `character_compositor.py` | Añade tinte y seis objetos rígidos; no cambia huesos ni ciclo |
| B/C corregido | Mismo clip; `IMPORT_ROOT` compensa XY, alinea el pie inferior a Z=0 y usa cámara local 2,05 | Ciclo completo encuadrado, sin penetración, cierre 1e-6 m |

Evidencia principal:
[`rocketbox-animation-diagnosis-sheet.png`](../../../../art/characters/prototypes/wp-char-02a/diagnostics/rocketbox/rocketbox-animation-diagnosis-sheet.png).

La primera corrida sin compensar se conserva en
[`initial-root-motion-run/`](../../../../art/characters/prototypes/wp-char-02a/diagnostics/rocketbox/initial-root-motion-run/).
La corrida intermedia que aisló sólo XY se conserva en
[`planar-root-correction-run/`](../../../../art/characters/prototypes/wp-char-02a/diagnostics/rocketbox/planar-root-correction-run/).

## 3. Inspección del rig

| Elemento | Medición |
| --- | --- |
| Armature | `Bip01` |
| Huesos | 80 |
| Hueso raíz | `Bip01 Pelvis` (no existe un hueso llamado `Bip01`) |
| Malla | `m007_hipoly_81_bodies`; un modificador Armature activo en viewport y render |
| Shape keys | Ninguno |
| NLA | Ninguna pista; acción activa directa |
| Escala del armature | `(0,01, 0,01, 0,01)`, heredada del FBX; `deltaScale=(1,1,1)` |
| Escala de `IMPORT_ROOT` | `(1,1,1)` |
| Tamaño normalizado | 1,3482 × 0,3605 × 1,8069 m |
| Jerarquía antes/después | SHA-256 idéntico: `230d758c3fa5d1cd2b4ea523c1289aa7e48998d05aec94592245f92c7f1835e5` |

`normalize_import_root()` (`tools/art-pipeline/blender/source_import.py:230`) sólo crea y transforma el
contenedor raíz. No modifica vértices, huesos, pesos ni animation data. La huella de jerarquía
permanece idéntica. No se observó doble aplicación de escala o desplazamiento.

## 4. Ciclo real y selección heredada

La acción de marcha importada por Blender 5.2 tiene:

- rango **1–33**, 32 frames útiles;
- **30 FPS**;
- una capa, un slot y **809 F-curvas** con 26.697 keyframes;
- interpolación lineal;
- sin curvas cíclicas explícitas;
- F-curves de localización en pelvis y vértebras, incluidas las tres coordenadas de pelvis.

El muestreo correctivo usa **1, 5, 9, 13, 17, 21, 25 y 29**. No duplica el frame final como novena
pose. El frame 33 se evalúa sólo para comprobar el cierre.

`apply_animation_clip()` (`tools/art-pipeline/blender/runtime_asset.py:689`) no muestrea un ciclo:
su contrato histórico es `frame 0 → inicio` y `frame 1 → inicio + (span // 2)`. Por tanto:

- `Walk0` = frame **1**;
- `Walk1` = frame **17**, exactamente el punto medio;
- los dos frames anteriores no representan ni el ciclo ni una transición completa.

La pose intermedia de frame 17 es anatómicamente válida. Su aspecto problemático procede de
combinarla con una raíz desplazada y un encuadre fijo, no de una pierna rota.

## 5. Causa confirmada: root motion sin compensar

En la marcha original, la raíz/pelvis recorre **1,247305 m en XY**. El rango Y va de `0,022152` a
`-1,225148`; el rango Z es 0,035133 m. El final de la acción está a **1,438300 m** del inicio, por lo
que el clip no cierra en el sitio.

Consecuencias medidas:

- la cámara fija recorta **8/8** muestras;
- a partir de frame 13 el avatar sale por el lateral izquierdo;
- el pie izquierdo penetra hasta **0,044911 m** y el derecho hasta **0,069204 m**;
- sin alinear el suelo sólo hay 3 contactos izquierdos y 1 derecho dentro de ±0,02 m;
- la supuesta pose “cruzada” cambia de lectura según el instante y la proyección.

El compositor no agrava este problema: B y C tienen transforms de huesos idénticos en las ocho
muestras y exactamente el mismo resumen de marcha. Los accesorios rígidos tienen deriva 0 en idle y
no son la causa del root motion.

## 6. Prueba correctiva aislada

La herramienta nueva counter-translada `IMPORT_ROOT` en XY para mantener la raíz en su posición
inicial. Después alinea el pie inferior a Z=0 y abre localmente la ortográfica a 2,05. No edita la
acción, la pose, los huesos, los pesos ni la malla; sólo corrige el contenedor y el encuadre del
experimento.

Resultado medido:

| Métrica | Original | Corregido |
| --- | ---: | ---: |
| Desplazamiento planar de raíz | 1,247305 m | 0 m |
| Muestras recortadas | 8/8 | 0/8 |
| Penetración máxima izquierda | 0,044911 m | 0 m |
| Penetración máxima derecha | 0,069204 m | 0 m |
| Cierre de ciclo, hueso más alejado | 1,438301 m | 0,000001 m |
| Contactos izquierdo/derecho | 3 / 1 | 4 / 5 |
| Separación mínima entre pies | 0,219227 m | 0,219227 m |
| Flexión de rodilla derecha | 49,6846°–97,1039° | 49,6847°–97,1040° |

La secuencia corregida muestra alternancia de piernas, flexión de rodillas, balanceo de brazos y
tronco estable. No hay saltos de malla ni cambios topológicos. El pie de apoyo queda sobre la
rejilla en todas las muestras. Esto descarta un error grave de rig, skinning o retarget.

## 7. Solución propuesta

1. Para futuros sprites Rocketbox, tratar el clip como root-motion y generar una copia local
   reproducible que elimine la traslación planar o compense el contenedor por frame.
2. Alinear el pie de apoyo a Z=0 por frame y verificar que el ciclo cierre sin duplicar el extremo.
3. Usar una ortográfica local con margen suficiente; no recortar el avatar para ocultar el defecto.
4. Mantener el muestreo de ocho instantes como evidencia, sin asumir que ocho es el formato runtime
   definitivo.
5. No modificar `runtime_asset.py` ni `source_import.py`: la corrección vive en
   `tools/art-pipeline/blender/characters/wp_char_02a/diagnose_rocketbox_animation.py`.

## 8. Límites pendientes

- El clip original no es cíclico in situ y no tiene modificadores Cycles; la corrección de contenedor
  resuelve el cierre visual, pero una animación runtime requerirá decisión de cadencia y loop.
- La alineación vertical por el pie inferior introduce un bob contenido (rango de pelvis 0,078023 m
  tras la corrección) y debe evaluarse a 28 px antes de adoptarla.
- El reposo heredado conserva una A-pose bastante abierta. No es un defecto de rig, pero no satisface
  el idle natural exigido al nuevo obrero.
- La deformación es coherente; la calidad artística realista/oscura y el vestuario siguen siendo
  problemas separados, tratados en `02-clothing-diagnosis.md` y en la comparación de fuentes.

## 9. Resultado de la prueba

La validación independiente ejecutó **219 comprobaciones, 0 errores**: 35 renders, hashes de fuente
y dependencias, 512×512 RGBA, ocho muestras distintas por control, jerarquía preservada, métricas
B/C idénticas, raíz corregida, pies sin penetración y cierre de ciclo.

Evidencia legible por máquina:
[`rocketbox-animation-diagnosis.json`](../../../../art/characters/prototypes/wp-char-02a/diagnostics/rocketbox/rocketbox-animation-diagnosis.json)
y
[`rocketbox-animation-diagnosis-validation.json`](../../../../art/characters/prototypes/wp-char-02a/diagnostics/rocketbox/rocketbox-animation-diagnosis-validation.json).

**Decisión de Etapa A:** continuar con la comparación de fuentes. El rig Rocketbox no está roto; la
causa principal de la marcha anterior es root motion + selección de sólo inicio/medio + cámara fija.
La corrección aislada está demostrada, pero no convierte Rocketbox en la base artística final por sí
sola.
