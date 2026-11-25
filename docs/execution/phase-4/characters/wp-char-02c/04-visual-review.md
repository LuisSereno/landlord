# WP-CHAR-02C — Revisión visual

Fecha: 2026-11-24. Estado: `TECHNICAL_COMPLETE / VISUAL_REVIEW_PENDING` del paquete; ningún personaje tiene aprobación artística humana.

## 1. Qué se corrigió

### Supervisor

- La mancha clara de la coronilla desaparece porque el pelo original se sustituye por material local y el casco cubre más superficie.
- El casco de capataz tiene domo, ala frontal, visera y banda; no es el casco amarillo integrado del obrero.
- Chaleco ocrá y clipboard grande comunican autoridad de obra.
- En cuatro direcciones el casco permanece anclado y no corta el rostro.
- A 28 px se distingue del obrero por color de casco/vestimenta y por el clipboard; la silueta sigue siendo la misma familia Kenney.

**Lectura local:** mejora visible y técnicamente estable. **Aprobación:** pendiente.

### Enforcer

- El círculo negro de la coronilla desaparece con el cambio a `character-raider.glb`.
- La barba dominante desaparece; el rostro es limpio y la expresión original aporta dureza sin depender de vello facial.
- La gorra integrada se recolorea a carbón. No se añade una segunda gorra.
- Chaqueta pizarra, mangas carbón, cinturón y volumen corporal robusto lo separan del policía.
- A 28 px el policía conserva azul/insignia; el enforcer es carbón, sin insignia y con capa/cola de pelo distinta.

**Lectura local:** círculo y barba resueltos; identidad criminal estilizada sin arma. **Aprobación:** pendiente.

### Bombero

- La barba de `male-b` desaparece con el cambio a `male-a`.
- El casco pasa de un domo del 47% al 86% del ancho de cabeza y el ala al 95%.
- Visera, reborde posterior, escudos y cresta crean una silueta de protección contra incendios.
- Uniforme carbón con franjas amarillas, guantes y botas robustas.
- A 28 px el amarillo del casco y las franjas diferencia al bombero del obrero, cuyo casco es arena y cuya ropa es azul.

**Lectura local:** corrección prioritaria resuelta a nivel de identidad y anclaje. **Aprobación:** pendiente.

### Policía

- Se conserva su reporte y sus 12 frames de WP-CHAR-02B.
- El validador original vuelve a pasar 542/542 comprobaciones.
- Gorra azul, insignia, uniforme y silueta siguen intactos.
- No se detectó un defecto nuevo que justificara regenerarlo.

**Estado:** control conservado, no rework.

## 2. Láminas de revisión

Todas son composiciones offline, no capturas de Phaser.

### Antes/después

1. [Supervisor antes/después](../../../../art/characters/prototypes/wp-char-02c/review/01-before-after-supervisor.png)
2. [Enforcer antes/después](../../../../art/characters/prototypes/wp-char-02c/review/02-before-after-enforcer.png)
3. [Bombero antes/después](../../../../art/characters/prototypes/wp-char-02c/review/03-before-after-firefighter.png)
4. [Controles obrero/policía](../../../../art/characters/prototypes/wp-char-02c/review/04-controls.png)

### Familia e identidad

5. [Familia de cinco ampliada](../../../../art/characters/prototypes/wp-char-02c/review/05-five-family.png)
6. [Familia a 28 px con ampliación pixelada](../../../../art/characters/prototypes/wp-char-02c/review/06-five-family-28px.png)
7. [Siluetas 02B frente a 02C](../../../../art/characters/prototypes/wp-char-02c/review/09-silhouettes-before-after.png)
8. [Escala 0,5×/1×/2×/2,5×](../../../../art/characters/prototypes/wp-char-02c/review/10-scales.png)
9. [Prueba sin etiquetas, números 1–5](../../../../art/characters/prototypes/wp-char-02c/review/11-unlabeled-professions.png)

### Animación y contexto

10. [Cuatro direcciones](../../../../art/characters/prototypes/wp-char-02c/review/07-four-directions.png)
11. [Ocho muestras de marcha](../../../../art/characters/prototypes/wp-char-02c/review/08-walk-samples.png)
12. [Composición urbana offline](../../../../art/characters/prototypes/wp-char-02c/review/12-street-context-offline.png)

## 3. Evaluación por criterio

| Criterio | Resultado local | Evidencia |
|---|---|---|
| Supervisor sin mancha | Cumplido | 01 y diagnóstico A/B/C |
| Enforcer sin círculo | Cumplido | 02 y diagnóstico A/B/C |
| Bombero con casco reconocible | Cumplido | 03, 05, 06, 10 |
| Bombero sin barba dominante | Cumplido | 03 |
| Policía conservado | Cumplido | 04 y validación 02B |
| Familia Kenney coherente | Cumplido localmente | 05, 06, 07 |
| Marcha sin clipping/desanclaje | Cumplido técnicamente | 08 y 488 checks |
| Escala 28 px | Revisable; identidad por color/forma | 06, 09, 10, 11 |
| Contexto urbano | Composición offline coherente | 12 |
| Aprobación artística humana | **Pendiente** | Propietario |

## 4. Límites honestos

- El enforcer sigue siendo oscuro a 14 px; a 28 px depende de capa/gorra y del contraste con el policía azul.
- El supervisor conserva gafas y rostro de base mayor; la autoridad procede del casco, chaleco y clipboard, no de eliminar esos rasgos.
- El bombero comparte tono de piel y gafas con el obrero; la profesión se distingue por casco, franjas y uniforme.
- Las láminas con gamma 1,8 facilitan revisión offline; no son una captura del runtime ni una prueba de FPS.
- No se evaluaron animaciones `work`, `repair`, `carry`, `inspect` o `sabotage_action`.
- No se integró Phaser, no se promovió ningún asset y no se produjeron los otros nueve personajes.

## 5. Decisión solicitada al propietario

Revisar especialmente:

1. `05-five-family.png` y `11-unlabeled-professions.png`.
2. `06-five-family-28px.png` y `10-scales.png`.
3. `03-before-after-firefighter.png`.
4. `04-controls.png` para policía/enforcer y obrero/bombero.

Decidir si se autoriza el rework como referencia para los siguientes personajes, si se pide un ajuste concreto o si algún candidato queda `REWORK_REQUIRED`.
