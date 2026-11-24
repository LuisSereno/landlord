# WP-CHAR-02A · Comparación de Rocketbox, Kenney y Quaternius

Fecha: 2026-11-24. Estado: **evidencia renderizada; Kenney seleccionado como base del obrero de referencia**.

## 1. Método

Se renderizaron 12 imágenes: una pose idle y tres instantes de marcha por fuente. Todas usan:

- cámara ortográfica isométrica 45°/30°;
- `orthoScale=2,05`, `targetZ=0,9`;
- misma iluminación y style layer del pipeline;
- suelo diagnóstico con rejilla de 0,25 m;
- personaje normalizado a aproximadamente 1,8 m;
- fondo opaco sólo para la comparación; los sprites finales serán transparentes.

Rocketbox se muestra con la corrección de root motion y suelo demostrada en la Etapa A. Quaternius
usa `Superhero_Male_FullBody.gltf` con `Idle_Loop` y `Walk_Loop` de UAL1. Kenney usa
`character-worker.glb` con sus acciones embebidas `idle` y `walk`.

Evidencia:

- [Comparación ampliada](../../../art/characters/prototypes/wp-char-02a/source-comparison/source-comparison-enlarged.png)
- [Comparación a 28 px](../../../art/characters/prototypes/wp-char-02a/source-comparison/source-comparison-28px.png)
- [Manifiesto de renders](../../../art/characters/prototypes/wp-char-02a/source-comparison/source-comparison.json)
- [Validación independiente](../../../art/characters/prototypes/wp-char-02a/source-comparison/source-comparison-validation.json)

## 2. Hallazgos por fuente

### Rocketbox corregido

- 80 huesos, 6.722 triángulos, 1,8069 m.
- Marcha anatómicamente coherente tras compensar 1,247 m de root motion y alinear el pie.
- Ropa contemporánea integrada, pero no comunica obrero de construcción sin accesorios.
- A 28 px mide 16–19 px de ancho; la chaqueta y el rostro realista dominan el detalle.
- El compositor anterior no arregla la identidad profesional y tiende a oscurecer la imagen.
- Coste técnico alto: root motion, suelo, cámara, vestuario y materiales siguen requiriendo corrección.

### Kenney Mini Characters

- 7 huesos, 893 triángulos, 1,7966 m tras escalar ×2,18.
- Casco, overol, camisa y calzado forman parte de la misma malla/atlas; no son accesorios superpuestos.
- La cabeza y el casco dominan una silueta clara; a 28 px mide 19–22 px de ancho.
- `idle` es sutil y `walk` tiene balanceo de brazos y piernas. La ausencia de rodillas/codos limita la
  naturalidad, pero el movimiento de juguete es coherente con una maqueta estilizada.
- La marcha se mantiene en el sitio; el mayor ajuste es alinear el pie inferior a Z=0 en cada frame.
- Un material atlas y 893 triángulos permiten iterar y producir las cuatro direcciones con bajo coste.

### Quaternius + UAL1

- 65 huesos, 14.318 triángulos, 1,8196 m.
- Marcha natural y buen rig; `Idle_Loop`/`Walk_Loop` deforman correctamente al enlazar el
  `action_slot` de Blender 5.2.
- El cuerpo es un superheroe musculoso en ropa interior: no hay vestuario laboral instalado.
- A 28 px mide 9–14 px de ancho; la silueta es demasiado estrecha y el detalle anatómico se pierde.
- Vestirlo exige modelar una prenda low-poly y transferir pesos, además de resolver dos rutas de
  normales (`*_png.png`) que el importador no encuentra.
- Es una buena alternativa para naturalidad, pero no resuelve el obrero sin trabajo artístico adicional.

## 3. Matriz de evaluación

| Criterio | Rocketbox | Kenney | Quaternius |
| --- | --- | --- | --- |
| Proporciones apropiadas | Adulto realista; demasiado detalle | Chibi moderado; buena lectura a 28 px | Adulto muy estrecho y detallado |
| Calidad de marcha | Natural tras corrección de raíz/suelo | Clara y estilizada; sin articulaciones intermedias | Natural y articulada |
| Ropa integrada | Sí, pero civil/contemporánea | **Sí, uniforme de obrero con casco** | No; sólo ropa interior |
| Silueta a 28 px | 16–19 px; genérica | **19–22 px; oficio reconocible** | 9–14 px; genérica |
| Coherencia Material Maqueta | Requiere simplificar material y geometría | **Formas low-poly y colores planos** | Requiere simplificar material y geometría |
| Facilidad de producir seis roles | Alta complejidad de raíz/vestuario | **Media-baja; atlas y rig simple** | Media-alta; vestuario y pesos nuevos |
| Complejidad técnica | Alta: root motion, suelo, cámara | **Baja: acción embebida y suelo** | Media: slot, texturas y vestuario |
| Riesgos pendientes | Realismo, ropa civil, root motion | Rig de 7 huesos; marcha de juguete | Sin ropa; superheroe; detalle fino |

No se asignan puntuaciones inventadas: la decisión procede de los renders y de las restricciones de
vestuario integrado.

## 4. Correcciones técnicas encontradas

1. **Rocketbox:** el clip de marcha es root-motion y no cierra in situ. La Etapa A lo demuestra y
   prueba una corrección aislada.
2. **Quaternius:** en Blender 5.2, asignar `action` sin enlazar `action_slot` deja el cuerpo en
   T-pose. La herramienta nueva enlaza `action.slots[0]` y verifica poses distintas.
3. **Quaternius:** dos texturas normales solicitan `T_Hair_1_Normal_png.png` y
   `T_Eye_Normal_png.png`; se remapean en memoria a los archivos `*_Normal.png` existentes.
4. **Kenney:** el importador crea un `Icosphere` de 2 m en `glTF_not_exported`. Se excluye antes de
   normalizar; de lo contrario contamina la escala del personaje.

## 5. Decisión

**Base seleccionada: Kenney `character-worker.glb`.**

Motivo: es la única opción que ya entrega el requisito principal —obrero reconocible con ropa y
casco integrados— y mantiene una silueta legible a 28 px sin añadir paneles rígidos ni reconstruir
vestuario. Su limitación de articulaciones es aceptable para un prototipo de maqueta, pero deberá
quedar visible en la revisión humana.

Quaternius queda como alternativa si el propietario prioriza naturalidad y autoriza modelado de ropa.
Rocketbox queda como control histórico y referencia de movimiento, no como base de sustitución.

La selección no promueve nada a runtime ni autoriza producir los otros cinco personajes.
