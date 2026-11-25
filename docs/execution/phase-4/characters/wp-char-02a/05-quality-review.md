# WP-CHAR-02A · Revisión de calidad del obrero

Fecha: 2026-11-24. Estado: **PASS TÉCNICO / REVISIÓN ARTÍSTICA HUMANA PENDIENTE**. No se atribuye aprobación humana.

## 1. Láminas de revisión

Todas son composiciones offline con Pillow; no son capturas de Phaser.

| Lámina | Contenido |
| --- | --- |
| [01 · Antes/después](../../../../art/characters/prototypes/wp-char-02a/worker-reference/review/01-before-after.png) | Obrero A WP-CHAR-01B frente al nuevo, idle y walk medio |
| [02 · Original/nuevo](../../../../art/characters/prototypes/wp-char-02a/worker-reference/review/02-original-vs-new.png) | Kenney original frente al ajuste local |
| [03 · Idle](../../../../art/characters/prototypes/wp-char-02a/worker-reference/review/03-idle-before-after.png) | A-pose anterior frente a reposo relajado |
| [04 · Ocho poses](../../../../art/characters/prototypes/wp-char-02a/worker-reference/review/04-walk-eight-poses.png) | Ciclo walk completo, dirección 0 |
| [05 · Cuatro direcciones](../../../../art/characters/prototypes/wp-char-02a/worker-reference/review/05-four-directions.png) | Idle y walk medio en D0–D3 |
| [06 · Silueta 28 px](../../../../art/characters/prototypes/wp-char-02a/worker-reference/review/06-silhouette-28px.png) | Color y máscara de silueta a altura 28 px |
| [07 · Escalas](../../../../art/characters/prototypes/wp-char-02a/worker-reference/review/07-scales.png) | 0,5×, 1×, 2× y 2,5× |
| [08 · Ciudadano](../../../../art/characters/prototypes/wp-char-02a/worker-reference/review/08-worker-vs-citizen.png) | Nuevo obrero junto al ciudadano runtime existente |
| [09 · Calle offline](../../../../art/characters/prototypes/wp-char-02a/worker-reference/review/09-street-context-offline.png) | row_house, workshop, vehículos y ciudadano reales |

Manifiesto y validación:
[`review-manifest.json`](../../../../art/characters/prototypes/wp-char-02a/worker-reference/review/review-manifest.json),
[`review-validation.json`](../../../../art/characters/prototypes/wp-char-02a/worker-reference/review/review-validation.json).

## 2. Criterios de aceptación

| Criterio | Evidencia | Veredicto técnico | Límite artístico |
| --- | --- | --- | --- |
| Ropa | Casco/overol/calzado integrados en malla y atlas | PASS | Sin costuras ni arrugas; lenguaje de maqueta |
| Rig | 7 huesos, mallas skineadas, action slot enlazado | PASS | Sin rodillas ni codos intermedios |
| Idle | Brazos abajo, hombros relajados, pies apoyados | PASS | Muy sutil; no tiene ciclo de respiración publicado |
| Walk | Ocho poses, cierre exacto, root motion 0 | PASS | Marcha de juguete, no realista |
| Pies | Pie inferior alineado a Z=0 en 36/36 | PASS | No hay análisis de contacto por planta del pie |
| Brazos | Balanceo alternado y proporcionado | PASS | Rig simple; limita gestos finos |
| Silueta | 19 px de ancho a 28 px de alto en las cuatro direcciones | PASS | A 0,5× sólo se lee figura humana |
| Oficio | Casco y overol visibles sin accesorios añadidos | PASS | Color azul/ocres dominante; revisar gusto humano |
| Escala | 1,7966 m; comparación con ciudadano y calle | PASS | Composición urbana offline, no Phaser |
| Direcciones | D0–D3 con misma cámara y matriz | PASS | Iluminación lateral hace más oscuros D2/D3 |
| Iluminación | Contraste γ1,8 std 0,1503; p05 0,2772, p95 0,7219 | PASS | Espalda bastante oscura; no se alteró iluminación global |
| Transparencia | RGBA, alfa sin borde, 0 magenta | PASS | Ninguno |
| Procedencia | CC0, hashes de fuente y licencia | PASS | Ninguno |

## 3. Autoevaluación visual

1. **Identidad profesional.** El casco y el overol hacen que el personaje se lea como obrero a 28 px,
   incluso sin herramientas. Es una mejora clara frente al Rocketbox civil de WP-CHAR-01B.
2. **Proporciones.** La cabeza grande y el tronco compacto funcionan en la dirección de maqueta. No
   parece un avatar realista mal escalado.
3. **Marcha.** Las ocho muestras muestran alternancia de piernas y brazos. El rig de siete huesos no
   produce una zancada anatómica adulta, pero el resultado es legible y no hay piernas rotas.
4. **Materiales.** El atlas conserva colores planos y el material local es mate. La espalda (D2/D3)
   queda más oscura por la iluminación lateral; la silueta sigue siendo legible.
5. **Escala.** A 1× el obrero mide 19 px de ancho, frente a 16 px del anterior y 17 px del ciudadano.
   A 0,5× el oficio no es distinguible; a 2× y 2,5× se lee el vestuario.
6. **Contexto.** La composición de calle demuestra compatibilidad de volumen con row house, workshop
   y vehículos. Es una composición offline y no prueba integración Phaser ni orden de profundidad.
7. **Ropa.** No hay paneles rígidos ni prendas superpuestas. El uniforme es parte de la fuente; esto
   resuelve directamente el rechazo principal de WP-CHAR-01B.

## 4. Defectos pendientes

- Revisión humana de gusto, paleta y naturalidad; el prototipo no está aprobado.
- Rig de 7 huesos: aceptable para el objetivo actual, limitado para futuros gestos de trabajo.
- Iluminación posterior oscura; no se modificó la configuración global para disimularla.
- Sólo una pose idle por dirección; no es un ciclo de reposo completo.
- No se ha evaluado el personaje en Phaser, ni FPS, ni atlas, ni promoción runtime.
- No se han producido los otros cinco personajes.

## 5. Decisión recomendada

El resultado cumple el criterio técnico y visual mínimo de WP-CHAR-02A: un obrero estilizado, con
ropa integrada, casco, postura natural, marcha legible, cuatro orientaciones y silueta reconocible a
28 px. Se entrega para revisión humana con estado `PENDING_HUMAN_REVIEW`.

Las decisiones disponibles para el propietario son:

- `APPROVED_FOR_EXPANSION`: autorizar los otros cinco personajes;
- `REWORK_REQUIRED`: indicar defectos concretos;
- `SOURCE_REJECTED`: abandonar Kenney como base;
- `BLOCKED`: falta una capacidad técnica esencial.

No se promociona nada a runtime y no se declara aprobación artística.
