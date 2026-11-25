# WP-CHAR-02B · Revisión visual de los cuatro prototipos

Fecha: 2026-11-24. Estado: **TECHNICAL_COMPLETE / VISUAL_REVIEW_PENDING**. Ningún personaje está aprobado.

## 1. Láminas de revisión

Todas las composiciones son offline con Pillow; no son capturas de Phaser.

| Lámina | Contenido |
| --- | --- |
| [Catálogo Kenney](../../../../art/characters/prototypes/wp-char-02b/catalog/kenney-character-catalog.png) | 20 modelos humanos y especiales |
| [Catálogo 28 px](../../../../art/characters/prototypes/wp-char-02b/catalog/kenney-character-catalog-28px.png) | Los 20 a altura de juego |
| [Obrero vs supervisor](../../../../art/characters/prototypes/wp-char-02b/review/03-worker-vs-supervisor.png) | Referencia y candidato |
| [Obrero vs enforcer](../../../../art/characters/prototypes/wp-char-02b/review/04-worker-vs-enforcer.png) | Referencia y candidato |
| [Obrero vs policía](../../../../art/characters/prototypes/wp-char-02b/review/05-worker-vs-police.png) | Referencia y candidato |
| [Obrero vs bombero](../../../../art/characters/prototypes/wp-char-02b/review/06-worker-vs-firefighter.png) | Referencia y candidato |
| [Familia de cinco](../../../../art/characters/prototypes/wp-char-02b/review/07-five-family.png) | Obrero más cuatro profesiones |
| [Cuatro direcciones](../../../../art/characters/prototypes/wp-char-02b/review/08-four-directions.png) | Idle D0–D3 de los cuatro candidatos |
| [Muestras de marcha](../../../../art/characters/prototypes/wp-char-02b/review/09-walk-samples.png) | Ocho frames por candidato |
| [Escalas](../../../../art/characters/prototypes/wp-char-02b/review/10-scales.png) | 0,5×, 1×, 2× y 2,5× |
| [Calle offline](../../../../art/characters/prototypes/wp-char-02b/review/11-street-context-offline.png) | Edificios y vehículos runtime existentes |
| [Siluetas](../../../../art/characters/prototypes/wp-char-02b/review/12-silhouettes.png) | Máscaras negras a 28 px |
| [Sin etiquetas](../../../../art/characters/prototypes/wp-char-02b/review/13-unlabeled-professions.png) | Identidad sin nombres de profesión |

Manifiesto: [`review-manifest.json`](../../../../art/characters/prototypes/wp-char-02b/review/review-manifest.json).
Validación: [`review-validation.json`](../../../../art/characters/prototypes/wp-char-02b/review/review-validation.json).

## 2. Matriz individual

| Criterio | Supervisor | Enforcer | Policía | Bombero |
| --- | --- | --- | --- | --- |
| Profesión sin etiqueta | Sí: casco claro, chaleco y clipboard | Sí: volumen oscuro, gorra y barba | Sí: gorra/uniforme de policía integrados | Sí: casco de bombero, traje protector y bandas |
| Silueta diferenciable | Media-alta | Alta | Alta | Alta |
| Vestuario integrado | Sí; materiales sobre malla skineada | Sí; materiales sobre malla skineada | Sí; uniforme original | Sí; materiales/bandas sobre malla skineada |
| Animación | 8 frames distintos; sin clipping | 8 frames distintos; sin clipping | 8 frames distintos; sin clipping | 8 frames distintos; sin clipping |
| Escala 28 px | 20 px ancho | 20 px ancho | 18 px ancho | 20 px ancho |
| Materiales | Azul/ochre mate | Carbón muy oscuro | Azul oscuro mate | Carbón/amarillo reflectante |
| Accesorios | Sin clipping; deriva ≤7,5e-8 | Sin clipping; deriva ≤1,8e-7 | Sin clipping; deriva ≤3,0e-8 | Sin clipping; deriva ≤1,2e-7 |
| Cuatro vistas | Coherentes | Coherentes; detalle oscuro | Coherentes | Coherentes |
| Contexto urbano | Compatible | Compatible | Compatible | Compatible |
| Licencia | CC0 | CC0 | CC0 | CC0 |
| Pipeline | Reproducible | Reproducible | Reproducible | Reproducible |
| Estado | `TECHNICAL_PASS` / `VISUAL_REVIEW_PENDING` | `TECHNICAL_PASS` / `VISUAL_REVIEW_PENDING` | `TECHNICAL_PASS` / `VISUAL_REVIEW_PENDING` | `TECHNICAL_PASS` / `VISUAL_REVIEW_PENDING` |

## 3. Autoevaluación

### Supervisor

- Se distingue del obrero por base, gafas, casco claro, chaleco/material ochre y clipboard.
- No es el obrero con otro casco: cambia modelo, paleta, accesorio y lectura de mando.
- Riesgo: a 28 px el casco claro puede leerse como gorra; el clipboard es pequeño.

### Enforcer

- Las gafas, la barba y el volumen ancho crean una presencia sólida; la paleta carbón y la gorra lo
  separan del ciudadano.
- No lleva abrigo rígido ni armas.
- Riesgo: es el candidato más oscuro; a 28 px el interior se pierde y queda una silueta oscura. Requiere
  revisión humana de contraste, no una afirmación automática de aprobación.

### Policía

- Es el caso más directo: `male-c` ya contiene gorra e insignia y uniforme azul.
- La adaptación añade cinturón y distintivo rígido, no una profesión inventada con color.
- Se distingue claramente del enforcer por azul, gorra y ausencia de barba densa/volumen de enforcer.

### Bombero

- Se construyó sobre `male-b`, no sobre el obrero: cambia cuerpo, casco con escudo/alerón, material
  protector, bandas reflectantes, guantes y botas.
- No es el casco del obrero recoloreado; la geometría del casco y las bandas son distintas.
- Riesgo: la barba domina la lectura facial y el amarillo puede evocar al obrero a 28 px. El conjunto
  ampliado funciona, pero la aprobación humana debe decidir si la silueta pequeña es suficiente.

## 4. Diferenciación y escala

A 28 px las anchuras son: obrero 19 px, supervisor 20 px, enforcer 20 px, policía 18 px y bombero
20 px. La anchura por sí sola no distingue roles; lo hacen casco/gorra, barba/capucha, clipboard,
uniforme azul y bandas protectoras. A 0,5× sólo se leen figuras humanas, no profesiones.

Las siluetas negras muestran cinco formas relacionadas pero no idénticas. El obrero y el supervisor
son los más próximos; policía y bombero tienen cascos diferenciados; enforcer es el bloque oscuro más
compacto. La página sin etiquetas existe precisamente para que el propietario juzgue esta lectura sin
pista semántica.

## 5. Defectos pendientes

- Rig de siete huesos: sin codos/rodillas; adecuado para paseo, limitado para gestos finos.
- Una sola pose idle por dirección; no hay ciclo de reposo completo.
- Enforcer oscuro: revisar contraste y legibilidad a 28 px.
- Bombero con barba: revisar si la identidad profesional supera a la apariencia de ciudadano robusto.
- Supervisor: revisar casco y clipboard a escala pequeña.
- No hay integración Phaser, atlas, FPS ni promoción runtime.
- Enforcer B no está producido; la matriz lo marca como adaptación de malla de alto riesgo.

## 6. Decisión

Los cuatro prototipos son técnicamente válidos y están listos para revisión humana. No se asigna
`APPROVED` ni `RUNTIME_READY`. La decisión del propietario puede autorizar la expansión, pedir rework
concreto o rechazar una fuente/estilo.
