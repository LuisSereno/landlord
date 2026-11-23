# facade_diagnosis — causa de las franjas negras de fachada (D-111.3 FASE 1)

**Fecha:** 2026-11-23 · **Edificio de prueba:** `mixed_tenement` seed 2 · `gn_residential_v2` · `day_civic`
**Evidencia:** `facade_diagnosis.png` (+ `facade_diagnosis.json`) · renders fuente en `facade_lab/`

## Reproducción (Paso 1.1)

Re-render del candidato con el pipeline oficial (`build-building-composer.mjs --candidate=gn_residential_v2
--seeds=2 --states=complete --mood=day_civic`): firma de composición idéntica a la publicada
(`94f1106d02e6…`), mismas dimensiones 1048×1046, diferencia máxima de píxel 3/255 en 39 píxeles
(jitter AA conocido). **La franja se reproduce.** Lo mismo con `row_house` seed 17 (firma
`5468186522ad…`): su franja está en el muro lateral de ladrillo, bajo el alero de la mansarda.

## Laboratorio A/B (Paso 1.2)

Sonda Blender única (`tools/`-externa, cámara y encuadre del compositor, 720², sin pase de sombra de
suelo ni recorte). Región medida: cabeceras de los paños encastrados de la fachada izquierda; umbral
suma RGB < 230.

| Celda | Materiales | Key SUN | px oscuros | RGB medio |
|---|---|---|---:|---|
| **A control** | reales | activa (day_civic: energía 4,2, ángulo 1,5°) | **10 968** | (52, 53, 53) |
| **C sin sombra key** | reales | `use_shadow=False` + ray-tracing off | **5 505** | (60, 54, 46) |
| **G key cenital** | reales | key en (6,−12,60) | **7 059** | (53, 49, 41) |
| **H key desde atrás** | reales | key en (−6,12,12) | 11 817 | (42, 45, 45) |
| **E cristales opacos** | reales, `MI_Glass`/`gn_dark_glass` opacos neutros | activa | **4 319** | (71, 60, 47) |
| **B materiales neutros** | gris plano, sombras activas | activa | 0 | — |

Nota de método: la primera corrida mutaba los materiales en B antes de C/G/H; se re-ejecutó con el
orden limpio (C con materiales reales antes de tocar nada). Los datos de esta página son de la
corrida limpia.

## Causa determinada (Paso 1.3)

1. **La franja es una sombra proyectada real de la luz key.** Con materiales reales, apagar la sombra
   de la key elimina la mitad del contenido oscuro de la región (A 10 968 → C 5 505) y visualmente
   los paños quedan uniformes. No es AO (C también apaga ray-tracing/GTAO), no es geometría
   coplanar ni normales invertidas: con materiales neutros la misma sombra existe y lee como
   sombreado suave (visible en el parapeto de B), no como franja negra.
2. **El ocultador es la carpintería saliente del propio módulo de vano GN.** El módulo
   `mod_gn_window_bay_2m` proyecta antepecho y dintel hasta 0,20-0,25 m sobre el plano de fachada
   (`gn_facade_grammar.py`: caja de antepecho `(…, t+0.20, …)` y dintel `(…, t+0.05, …)`, más el
   marco en relieve). Renderizando sólo los módulos GN la franja se reproduce sola; renderizando
   sólo los módulos MegaKit, no. Subiendo la key a cenital (G) la franja se deshace: son sombras de
   elementos horizontales salientes sobre el paño vertical que tienen debajo.
3. **El vidrio agrava y tiñe.** Con los cristales reales hechos opacos (E) la región cae por debajo
   incluso de la celda sin sombra: el vidrio oscurece su propia barra y participa como ocultador
   fino. En `row_house` el mismo papel lo hace el alero de la mansarda.
4. **Por qué lee "negro-verdoso" y no "sombra".** En la zona en sombra la key cálida (4,2,
   (1,0.96,0.88)) desaparece y dominan el relleno y el ambiente fríos (fill 1,15 (0.5,0.62,0.8);
   rim 0,9 (0.55,0.7,0.9); mundo 0,9×(0.52,0.6,0.7)). El ladrillo cálido pierde su componente R y la
   banda queda desaturada verdosa (medido en el PNG publicado: RGB ≈ (46,62,62) frente a ladrillo
   iluminado (146,135,122)) — a 60 px/m se lee como una mancha negra inexplicable, no como sombra.

| Pregunta del encargo | Respuesta |
|---|---|
| Módulo responsable | `mod_gn_window_bay_2m` (carpintería saliente); en `row_house`, además el alero de la mansarda |
| Material | ninguno defectuoso; el tinte viene del balance key cálida vs ambiente frío sobre ladrillo cálido |
| Posición | cabecera de cada paño entre vanos (mixed_tenement) y muro lateral bajo el alero (row_house) |
| Condición | key SUN con sombra activa + elementos horizontales salientes + ambiente frío dominante en sombra |
| Evidencia | `facade_diagnosis.png` (celdas A/C/G/E) + repro byte-idéntico del publicado |

## Consecuencia para FASE 2 (no aplicada todavía)

La corrección no debe apagar sombras globalmente ni tocar la iluminación nocturna aprobada. Las dos
palancas quirúrgicas que se derivan del diagnóstico: (a) reducir la proyección saliente de la
carpintería del módulo de vano (la profundidad del REVECO de 8,5 cm y los marcos se conservan — ahí
vive la profundidad real de las ventanas); (b) neutralizar el tinte frío del ambiente de día para
que la sombra que quede lea como sombra y no como mancha. Ambas se validan en FASE 2 antes de
regenerar los candidatos.
