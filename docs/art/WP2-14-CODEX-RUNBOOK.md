# WP2.14 — Codex execution runbook

> Estado: READY para ejecución incremental.
>
> Modelo recomendado: GPT-5.6 Sol.
>
> Esfuerzo por defecto: **High**.
>
> Regla crítica: Codex **DEBE DETENERSE** en cada marcador `STOP — REQUIRES EXTRA HIGH`. No puede
> elegir dirección visual, congelar una baseline estética ni cerrar WP2.14 desde High.
>
> Este documento operacionaliza `VISUAL-DIRECTION-SPIKE.md`, `ART-BIBLE.md` y
> `ART-PIPELINE.md`. No los sustituye.

## 1. Objetivo

Cerrar G2-C01 con evidencia reproducible de que Landlord dispone de:

1. un pipeline Blender 5.2.2 LTS -> render transparente -> metadata/atlas -> Phaser;
2. un kit visual mínimo que representa el juego real;
3. 2–3 direcciones visuales originales comparables sobre contenido funcional equivalente;
4. mediciones de legibilidad, coste de producción y rendimiento;
5. provenance trazable;
6. una recomendación explícita y, sólo tras revisión Extra High, una baseline visual congelada.

El éxito no es producir mucho arte. El éxito es demostrar una línea de producción repetible y elegir
una dirección visual que pueda escalar al Vertical Slice.

## 2. Restricciones no negociables

- No copiar assets, layouts, personajes, UI, iconografía, trade dress ni composición de
  Constructor, Street Wars/Mob Rule u otras IP protegidas.
- Sólo usar fuentes propias, generadas con provenance o terceros aprobados en
  `blender_artist/manifests/staging-sources.json`.
- No versionar ZIPs, `.blend` pesados ni otros binarios externos hasta que Git LFS y la política
  de incorporación estén aprobados.
- No convertir el spike en producción masiva de arte.
- No rehacer gameplay para acomodar una propuesta visual. El arte se adapta a los contratos del juego.
- No cambiar Blender 5.2.2 LTS sin una decisión explícita.
- No introducir herramientas comerciales obligatorias.
- No introducir floats autoritativos ni dependencias visuales en save/load.
- No hacer que el runtime dependa de la existencia de Blender.
- No seleccionar una dirección visual en modo High.

## 3. Política de uso de razonamiento y tokens

### 3.1 High es el modo de trabajo

Usar GPT-5.6 Sol High para:

- inspección de repositorio;
- scripting de Blender;
- schemas y manifests;
- automatización;
- integración Phaser;
- tooling de Art Lab;
- tests y smoke;
- generación de las variantes A/B/C conforme a briefs ya definidos;
- recopilación de métricas;
- preparación de comparativas;
- correcciones técnicas cuyo resultado sea verificable.

### 3.2 Extra High se reserva para decisiones visuales irreversibles

Usar Extra High únicamente cuando este runbook lo indique para:

- comparar holísticamente las direcciones A/B/C;
- valorar coherencia visual, identidad propia y trade-offs no reducibles a una métrica;
- elegir o rechazar una dirección;
- congelar cámara, escala, lighting, paleta/material family y reglas de estilo;
- aprobar el cierre final de WP2.14.

### 3.3 Regla de parada

Cuando una fase llegue a un marcador:

`STOP — REQUIRES EXTRA HIGH`

Codex debe:

1. ejecutar todos los checks de esa fase;
2. dejar el repositorio limpio;
3. crear/actualizar el informe de handoff indicado;
4. enumerar exactamente qué artefactos debe revisar Extra High;
5. enumerar decisiones que siguen abiertas;
6. indicar el commit HEAD;
7. **terminar la sesión sin elegir, recomendar ni implementar la siguiente fase**.

No debe "adelantar trabajo" para ahorrar tiempo.

### 3.4 Presupuesto de contexto

Cada sesión debe leer sólo:

- este runbook;
- los documentos canónicos explícitamente indicados por la fase;
- los archivos de código que vaya a modificar;
- el informe/handoff de la fase anterior.

No cargar toda la investigación histórica salvo que una decisión concreta lo requiera.

Cada fase debe poder retomarse en una conversación nueva únicamente con Git.

## 4. Convención de estados

Cada subfase usa:

- `READY`: puede empezar;
- `IN_PROGRESS`: hay cambios no cerrados;
- `REVIEW`: implementación terminada, falta revisión humana/modelo;
- `BLOCKED`: falta una dependencia concreta;
- `DONE`: criterios de aceptación y checks satisfechos.

Registrar progreso en:

`docs/execution/phase-2/wp2-14-progress.md`

No marcar WP2.14 global como DONE hasta la revisión Extra High final.

## 5. Estructura objetivo mínima

Codex puede ajustar nombres si la arquitectura existente lo exige, pero debe preservar esta
separación conceptual:

```text
tools/art-pipeline/
  blender/
  validate/
  pack/
  manifests/

art/
  blender/templates/        # sólo cuando LFS/policy lo permita
  manifests/

assets-generated/
  frames/
  atlases/
  manifests/

apps/web/
  ... Art Lab / runtime ingestion

blender_artist/
  manifests/
  staging/                  # local/ignored
  generated/                # local/ignored salvo evidencia ligera aprobada
```

Los artefactos generados grandes no deben entrar en Git por inercia. Para evidencia versionada preferir
JSON, Markdown y capturas ligeras expresamente aprobadas.

---

# Fase H0 — Preflight y congelación del experimento

**Modelo:** GPT-5.6 Sol High.

## Objetivo

Asegurar que el spike es reproducible antes de escribir pipeline.

## Leer

- `docs/art/ART-BIBLE.md`
- `docs/art/ART-PIPELINE.md`
- `docs/art/VISUAL-DIRECTION-SPIKE.md`
- `docs/art/OPEN-DECISIONS.md`
- `docs/art/PERFORMANCE-BUDGET.md`
- `docs/art/ASSET-NAMING.md`
- `docs/art/CONTRIBUTING-ART.md`
- `blender_artist/manifests/staging-sources.json`
- `blender_artist/manifests/visual-direction-spike-kit.json`

## Tareas

1. Ejecutar `pnpm art:staging:validate`.
2. Confirmar Blender 5.2.2 LTS mediante CLI.
3. Confirmar que los 11 briefs del kit no dependen de fuentes en cuarentena.
4. Inventariar qué formatos reales contiene cada pack local necesario para el primer building y
   el primer character, sin extraer ni usar archivos no aprobados.
5. Crear `docs/execution/phase-2/wp2-14-progress.md` con:
   - HEAD inicial;
   - versión Blender;
   - estado del staging;
   - lista de decisiones todavía OPEN;
   - tabla de fases de este runbook.
6. Crear un manifest de experimento, por ejemplo
   `blender_artist/manifests/wp2-14-experiment.json`, que fije:
   - schemaVersion;
   - kitId;
   - Blender version;
   - seed/config si aplica;
   - nombres A/B/C;
   - estado de cada variante;
   - rutas de resultados;
   - fecha/commit de origen.
7. No fijar todavía valores OPEN como si fueran decisiones.

## PASS

- staging validation verde;
- Blender exacto accesible;
- experimento versionado;
- ningún input de cuarentena usado;
- progreso documentado.

## FAIL

- fuente sin provenance;
- Blender distinto sin decisión;
- dependencia de binarios no accesibles;
- cualquier propuesta que ya declare una estética ganadora.

## Commit sugerido

`art: bootstrap WP2.14 reproducible experiment`

---

# Fase H1 — Esqueleto de pipeline Blender

**Modelo:** GPT-5.6 Sol High.

## Objetivo

Conseguir un pipeline reproducible con geometría de prueba, antes de dedicar tiempo a arte.

## Tareas

1. Crear un script canónico de cámara que:
   - use cámara ortográfica;
   - reciba azimuth/elevation/ortho scale desde configuración;
   - no duplique "magic numbers" por asset;
   - oriente a un target/anchor explícito.
2. Crear un lighting rig parametrizable.
3. Crear validación de escena para:
   - `ANCHOR_ROOT`;
   - footprint;
   - transforms;
   - colecciones/naming;
   - cámara;
   - output RGBA;
   - resolución.
4. Crear render headless de un primitive/blockout.
5. Hacer que dos ejecuciones con la misma entrada generen metadata equivalente y render
   reproducible dentro de la tolerancia definida.
6. Generar sidecar metadata v1 con al menos:
   - assetId;
   - source;
   - renderer;
   - Blender version;
   - camera config;
   - footprint;
   - anchor/pivot;
   - frame bounds;
   - output dimensions;
   - provenance refs.
7. Añadir tests unitarios para config/schema cuando sea viable sin lanzar Blender.
8. Añadir un smoke opt-in que invoque Blender real si está instalado.
9. Documentar un solo comando para ejecutar el flujo.

## No hacer

- texturizar edificios finales;
- seleccionar paleta final;
- decidir cámara definitiva;
- empaquetar cientos de assets.

## PASS

```text
source/blockout
-> Blender CLI
-> validation
-> transparent PNG
-> metadata
```

se ejecuta sin pasos manuales ocultos.

## Evidencia

Actualizar `wp2-14-progress.md` con comandos y outputs.

## Commit sugerido

`art: add deterministic Blender render pipeline skeleton`

---

# Fase H2 — Primer building end-to-end

**Modelo:** GPT-5.6 Sol High.

## Asset objetivo

`bld_res_rowhouse_ember_a` salvo impedimento documentado.

## Objetivo

Demostrar por primera vez:

```text
editable source
-> render
-> trim
-> metadata
-> runtime texture
-> Phaser
-> selección/depth/picking
```

## Tareas

1. Construir un blockout original compatible con el footprint previsto.
2. Aplicar materiales aprobados del staging, sin intentar todavía "final art".
3. Usar cámara/light config parametrizados de H1.
4. Renderizar al menos:
   - complete;
   - damaged;
   - construction/blockout si el pipeline lo soporta sin trabajo desproporcionado.
5. Implementar trim que preserve el pivot/anchor.
6. Implementar o seleccionar el formato mínimo de atlas/manifest necesario para una sola familia.
7. Integrarlo en Phaser mediante una capa visual que no cambie estado autoritativo.
8. Crear un modo Art Lab o escena técnica donde se vea:
   - sobre grid;
   - detrás/delante de otro sprite;
   - seleccionado;
   - con ownership overlay;
   - a varios zooms.
9. Verificar que save/load no serializa rutas o estado de render.
10. Capturar métricas:
    - tamaño de PNG;
    - dimensiones;
    - memoria estimada;
    - número de texturas/draw calls relevantes;
    - tiempo de render headless.
11. Documentar cualquier paso manual. Si existe, marcarlo como deuda.

## PASS

Un cambio visible en la fuente puede regenerarse con un comando y reaparecer correctamente en Phaser.

## FAIL

- edición manual de atlas generado;
- pivot corregido a mano en React/Phaser para este asset;
- parámetros exclusivos hardcodeados fuera de metadata;
- arte visual acoplado al snapshot.

## Commit sugerido

`art: render first building end to end`

---

# Fase H3 — Art Lab y golden-scene infrastructure

**Modelo:** GPT-5.6 Sol High.

## Objetivo

Crear el entorno donde después se puedan comparar A/B/C sin opinión informal ni screenshots
inconsistentes.

## Tareas

1. Implementar una escena/ruta Art Lab determinista.
2. Definir una golden scene mínima con posiciones fijas:
   - carretera/parcela;
   - residencial;
   - industrial blockout;
   - worker/civilian placeholder;
   - prop/vehículo;
   - overlay de selección;
   - ownership;
   - HUD representativo.
3. Implementar presets de zoom 50/75/100/150/200 %.
4. Capturar screenshots reproducibles con Playwright.
5. Añadir visual regression con baseline explícita.
6. Registrar viewport, DPR y navegador.
7. Añadir prueba de depth sorting y anchor.
8. Añadir modo de color-vision/monochrome si ya existe soporte; si no, preparar capturas
   transformadas para evaluación sin convertirlo en feature de producto.
9. Medir frame time y carga en una escena representativa, aunque use blockouts.

## Regla

Las golden scenes son instrumentos de comparación, no screenshots de marketing.

## PASS

Un comando genera el mismo conjunto nombrado de screenshots para una configuración visual dada.

## Commit sugerido

`art: add deterministic Art Lab and golden scene capture`

---

# Fase H4 — Character pipeline mínimo

**Modelo:** GPT-5.6 Sol High.

## Objetivo

Evitar elegir un estilo de edificios que luego sea incompatible con personajes.

## Tareas

1. Tomar únicamente las fuentes Quaternius aprobadas del manifest.
2. Probar importación/normalización en Blender 5.2.2.
3. Aplicar una transformación visual propia mínima:
   - proporciones;
   - workwear/civilian differentiation;
   - materiales/paleta provisional;
   - silueta.
4. Validar rig/animation import.
5. Elegir únicamente para el spike un set mínimo:
   - idle;
   - walk.
6. Renderizar primero 4 direcciones si 8 no es necesario para validar pipeline; medir el coste de
   duplicar a 8 antes de decidir.
7. Integrar worker y civilian en Art Lab.
8. Capturar tamaño, frames, memoria y coste de render.
9. No congelar aún 4 vs 8 direcciones.

## PASS

Un personaje recorre Blender -> frames -> metadata -> Phaser mediante el mismo principio reproducible.

## Commit sugerido

`art: validate minimal character render pipeline`

---

# Fase H5 — Completar kit funcional neutral

**Modelo:** GPT-5.6 Sol High.

## Objetivo

Tener todo el contenido funcional necesario para comparar estilos sin que una variante tenga más
contenido que otra.

## Kit mínimo

- road/curb/parcel;
- grass/dirt;
- residential;
- industrial/commercial;
- worker;
- civilian;
- vehicle o prop móvil;
- construction state;
- damaged state;
- smoke/dust;
- selection;
- ownership;
- economy overlay;
- HUD panel;
- icon family.

## Tareas

1. Completar blockouts/primeras versiones de todos los elementos.
2. Mantener una representación neutral y funcional.
3. Verificar al menos una escena que combine inputs de dos proveedores distintos.
4. Pasar todo por el pipeline; no introducir PNGs artesanales sin fuente/metadata.
5. Verificar naming y provenance.
6. Capturar golden scene neutral.

## PASS

Las futuras A/B/C pueden construirse variando estilo sobre el mismo contenido funcional.

## Commit sugerido

`art: complete neutral visual direction spike kit`

---

# Fase H6 — Generar direcciones A/B/C sin elegir

**Modelo:** GPT-5.6 Sol High.

## Objetivo

Producir 2–3 hipótesis comparables, no declarar una ganadora.

## Reglas de comparabilidad

Las direcciones deben compartir:

- footprints;
- cámara candidata por familia o parámetros explícitos;
- funciones de gameplay;
- número equivalente de assets;
- estados equivalentes;
- misma golden scene;
- mismo viewport y zooms.

Pueden variar deliberadamente:

- proporciones;
- material treatment;
- hue/saturation/value ranges;
- grime;
- lighting complexity;
- silhouettes;
- era adaptation;
- prop density;
- UI skin;
- icon treatment.

## Propuesta de etiquetas neutrales

- `A` — no usar nombres que impliquen "premium", "mejor", "final".
- `B`
- `C`

## Tareas

1. Escribir antes de renderizar un brief de una página por variante.
2. Aplicar las diferencias de forma data-driven cuando sea viable.
3. Generar todas las golden captures a 50/75/100/150/200 %.
4. Generar capturas de:
   - normal;
   - construction;
   - damaged/burning si ya existe;
   - selección;
   - ownership;
   - escena densa.
5. Medir:
   - tamaño descargable;
   - memoria;
   - draw calls/texture switches observables;
   - frame time;
   - tiempo de render;
   - número de pasos manuales;
   - número de excepciones por asset.
6. Completar provenance y similarity review técnica.
7. No ajustar una variante después de ver que "pierde" una métrica salvo para corregir un bug
   objetivo; registrar cualquier re-render.

## Scoring objetivo que sí puede hacer High

Calcular automáticamente los componentes medibles del rubric:

- rendimiento;
- memoria/descarga;
- automatización;
- coste de producción aproximado;
- legibilidad técnica cuando pueda expresarse mediante tamaño/silueta/contraste medible.

No inventar puntuaciones subjetivas de calidad visual o identidad.

## Salida requerida

Crear:

`docs/execution/phase-2/wp2-14-extra-high-handoff-1.md`

Debe contener:

- commit exacto;
- tabla A/B/C;
- rutas a screenshots;
- manifests;
- métricas;
- problemas conocidos;
- matriz de decisiones abiertas;
- scoring objetivo parcial;
- preguntas que requieren juicio visual.

---

# STOP — REQUIRES EXTRA HIGH #1

Al terminar H6, **DETENERSE**.

No:

- elegir A/B/C;
- fusionar características entre variantes;
- declarar estilo ganador;
- cambiar `OPEN-DECISIONS.md` a cerrado;
- actualizar Art Bible como baseline final;
- comenzar producción representativa.

La siguiente sesión debe ejecutarse con GPT-5.6 Sol **Extra High** y comenzar leyendo
`wp2-14-extra-high-handoff-1.md`.

---

# Fase X1 — Revisión visual comparativa

**Modelo obligatorio:** GPT-5.6 Sol Extra High.

## Objetivo

Evaluar A/B/C como sistema visual completo.

## Inputs

Sólo:

- handoff #1;
- golden screenshots A/B/C;
- manifests/métricas;
- Art Bible;
- Visual Direction Spike rubric;
- OPEN-DECISIONS.

## Evaluar

Aplicar los pesos canónicos:

| Criterio | Peso |
|---|---:|
| Legibilidad 50/75/100/150/200 % | 20 % |
| Identidad propia / distancia de IP | 15 % |
| Coste de producción repetible | 15 % |
| Rendimiento web y memoria | 15 % |
| Variación modular | 10 % |
| Calidad visual percibida | 10 % |
| Facilidad para colaboradores | 5 % |
| Automatización reproducible | 5 % |
| Accesibilidad / color blindness | 5 % |

## Resultado permitido

Uno de:

- `SELECT A`;
- `SELECT B`;
- `SELECT C`;
- `REWORK A/B/C` con cambios acotados;
- `NO DIRECTION ACCEPTABLE`.

No crear una cuarta dirección improvisada sin justificar por qué las tres hipótesis fallan.

## Entregable

`docs/execution/phase-2/wp2-14-extra-high-review-1.md`

Debe explicar cada puntuación y separar dato medido de juicio visual.

Si hay SELECT, registrar qué parámetros quedan candidatos a congelación y cuáles requieren todavía
calibración técnica.

---

# Fase H7 — Hardening de la dirección seleccionada

**Modelo:** volver a GPT-5.6 Sol High.

Sólo ejecutar si X1 selecciona una dirección o prescribe un rework concreto.

## Objetivo

Convertir la decisión estética en una baseline técnicamente reproducible.

## Tareas

1. Aplicar únicamente el rework autorizado por X1.
2. Calibrar cámara:
   - azimuth;
   - elevation;
   - ortho scale;
   - relación tile/footprint.
3. Calibrar:
   - cell physical scale;
   - character/building/vehicle ratios;
   - lighting rig;
   - master resolution.
4. Probar 4 vs 8 direcciones para personajes y medir impacto.
5. Probar atlas candidate(s) sin casarse con una herramienta comercial innecesaria.
6. Fijar metadata schema v1.
7. Fijar runtime format baseline.
8. Medir escena densa.
9. Ejecutar visual regression.
10. Verificar combinación de proveedores bajo la dirección elegida.
11. Cerrar pasos manuales que impidan reproducibilidad.
12. Actualizar documentación sólo como `CANDIDATE FINAL`, no todavía `DECIDED`.

## PASS

La dirección seleccionada se regenera desde fuentes y mantiene legibilidad/rendimiento dentro de
budgets aceptables sin excepciones artesanales por asset.

## Commit sugerido

`art: harden selected WP2.14 visual baseline`

---

# Fase H8 — Rehearsal de producción

**Modelo:** GPT-5.6 Sol High.

## Objetivo

Demostrar que la baseline no funciona sólo para los dos assets del spike.

## Tareas

Crear variaciones pequeñas sin "hacer contenido":

- 2 variantes del residencial;
- 1 variante del industrial;
- 2 props adicionales;
- 1 variante de worker/civilian.

Medir:

- tiempo de preparación;
- reutilización de materiales;
- número de excepciones;
- tiempo de batch render;
- crecimiento de atlas/memoria;
- legibilidad en Art Lab.

La finalidad es detectar una baseline visual bonita pero cara o frágil.

## Salida

Crear:

`docs/execution/phase-2/wp2-14-extra-high-handoff-2.md`

con toda la evidencia final.

---

# STOP — REQUIRES EXTRA HIGH #2

Al terminar H8, **DETENERSE**.

No cerrar G2-C01 ni WP2.14 desde High.

---

# Fase X2 — Ratificación final de WP2.14

**Modelo obligatorio:** GPT-5.6 Sol Extra High.

## Objetivo

Decidir si la baseline está lista para gobernar WP3.13.

## Revisar

1. dirección visual;
2. cámara;
3. footprint;
4. grid;
5. escala;
6. lighting;
7. palette/material family;
8. master resolution;
9. character directions/FPS;
10. atlas strategy;
11. metadata/runtime format;
12. budgets;
13. provenance;
14. mixed-provider coherence;
15. Art Lab/golden scenes;
16. coste de repetición;
17. distancia de IP ajenas.

## Resultado permitido

- `GO`: cerrar WP2.14 y G2-C01;
- `CONDITIONAL GO`: únicamente con condiciones no ambiguas y acotadas;
- `REWORK`;
- `STOP ART PRODUCTION`.

## Si el resultado es GO

Entonces, y sólo entonces:

- actualizar `OPEN-DECISIONS.md`;
- actualizar Art Bible/Pipeline de BASELINE a DECIDED donde corresponda;
- registrar ADR(s) de parámetros duraderos;
- actualizar `gate-2-review-2026-10-23.md` o crear addendum de cierre de G2-C01;
- actualizar `ai-context/PROJECT-STATE.md`, `ROADMAP.md`, `KNOWN-GAPS.md`;
- habilitar WP3.13.

---

# 6. Definition of Done global de WP2.14

WP2.14 sólo está DONE si:

- [ ] existen 2–3 direcciones realmente renderizadas y comparadas;
- [ ] una dirección fue seleccionada mediante revisión Extra High;
- [ ] el primer building recorre pipeline completo;
- [ ] character pipeline mínimo validado;
- [ ] Art Lab reproducible;
- [ ] golden captures reproducibles;
- [ ] camera/light/scale cerrados o explícitamente diferidos con justificación;
- [ ] metadata/runtime format v1 cerrados;
- [ ] atlas strategy medida;
- [ ] anchors/depth/selection pasan smoke;
- [ ] legibilidad 50/75/100/150/200 revisada;
- [ ] escena densa medida;
- [ ] color-vision/contraste revisados;
- [ ] provenance completa;
- [ ] mezcla de al menos dos proveedores coherente;
- [ ] ningún asset de IP de referencia entra en pipeline;
- [ ] no hay pasos manuales críticos ocultos;
- [ ] documentación refleja las decisiones reales;
- [ ] CI relevante verde;
- [ ] X2 ratifica GO.

# 7. Qué NO significa DONE

No requiere:

- ciudad completa;
- catálogo final de edificios;
- personajes finales;
- todas las animaciones;
- audio completo;
- marketing art;
- todas las estaciones/climas;
- ciclo día/noche final;
- producción masiva;
- optimización final de GPU compression.

# 8. Protocolo de sesión para Codex

Al comenzar cada sesión:

1. leer este runbook;
2. leer `wp2-14-progress.md`;
3. identificar la primera fase no DONE;
4. comprobar HEAD y working tree;
5. trabajar sólo esa fase;
6. ejecutar sus checks;
7. actualizar progreso;
8. commit atómico;
9. detenerse si aparece un STOP.

Al finalizar una sesión High, responder con:

```text
WP2.14 phase: Hx
Status: DONE | REVIEW | BLOCKED
HEAD: <sha>

Implemented:
- ...

Evidence:
- ...

Checks:
- ...

Open issues:
- ...

Next allowed phase:
- ...

Reasoning mode required next:
- High | Extra High

STOP REQUIRED:
- yes | no
```

Si `STOP REQUIRED: yes`, no continuar aunque queden tokens.

# 9. Reglas para conservar tokens

- No volver a resumir toda la documentación en cada sesión.
- No explorar el repositorio completo si la fase enumera archivos concretos.
- No generar alternativas visuales adicionales salvo fallo medido.
- No reescribir archivos enteros si basta un cambio localizado.
- No ejecutar benchmarks largos durante iteraciones intermedias; usar smoke corto y reservar
  benchmark completo para H6/H8.
- No pedir a Extra High trabajo mecánico que High puede resolver.
- No usar Extra High para lint, format, schemas, manifests, scripting o CI.
- Mantener handoffs de Extra High centrados en evidencia y decisiones, no en logs completos.

# 10. Regla de gobernanza final

High construye, mide y prepara evidencia.

Extra High decide cuando la decisión sea estética, transversal y costosa de revertir.

Ningún agente puede saltarse esta separación para "terminar WP2.14 de una vez".
