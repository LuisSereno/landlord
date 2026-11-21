# D-111 §4 — Las tres extensiones arquitectónicas pendientes

**Esta hoja se escribió en D-111.1 y se reevaluó en D-111.2 WP02/WP03.** Se conserva el texto original de
cada veredicto y se añade debajo la medición que lo cambia o lo confirma, porque lo que rechazó la primera
pasada era en parte un motivo falso: se medía la escena histórica completa cuando lo que entra en un sprite
es el módulo horneado. Por instrucción del propietario, el número de triángulos **dejó de ser criterio de
rechazo offline**; siguen siendo criterio el resultado visual a 1× y 0,5×, la procedencia y el presupuesto
del navegador.

Instalación aislada, sin dependencias permanentes en el repo, headless primero y una prueba visual
por extensión. Perfiles separados del toolchain:

```bash
export BLENDER_USER_CONFIG=/tmp/d111-ext-lab/config/cfg
export BLENDER_USER_EXTENSIONS=/tmp/d111-ext-lab/config/ext
blender -b --factory-startup -P tools/art-pipeline/blender/ext_lab/<lab>.py -- --mood=day_civic
```

Los `.zip` se descargan del registro oficial a `/tmp/d111-ext-lab/dl/`; su `sha256`, URL de
registro, versión, licencia y línea de mando completa quedan en el JSON hermano de cada hoja.

| extensión | versión | licencia | fuente oficial | estado D-111.1 | estado D-111.2 | triángulos de la hoja |
|---|---|---|---|---|---|---|
| HiFi Architecture Builder | 4.6.7 | SPDX:GPL-3.0-or-later | extensions.blender.org | `tested` → rechazada | `tested` · **sin módulo adoptado** | 2 356 → 5 976 con receta sobre retícula |
| Arch Generator | 1.0.1 | SPDX:GPL-3.0-or-later | extensions.blender.org | `tested` → rechazada | `tested` · **módulo adoptado en perfil candidato** | 35 452 (escena) → **1 810** (módulo horneado) |
| Archimesh | 1.2.5 | SPDX:GPL-2.0-or-later | bundled en Blender 5.2 | `tested` → rechazada | `tested` · **sin módulo adoptado** | 244 373 (tres componentes) → 1 358 (vano horneado) |

Referentes de presupuesto: control megakit 9 522 tri, candidata GN 13 272 tri.

## HiFi Architecture Builder

Genera una fachada mixta de 3 plantas con cornisas, marcos y balcones (71 objetos, 2 356 tri). La
composición es correcta y el coste geométrico sería asumible.

Bloqueos técnicos medidos:

- No expone un modo headless estable: los generadores son operadores con contexto de ventana; hay
  que fabricar el contexto, y eso es glue frágil sobre una API no pensada para batch.
- Las proporciones de hueco no respetan el paso de crujía del perfil de estilo: el edificio no se
  alinea con la retícula de parcela del juego.
- La geometría nace de código GPL-3.0 de terceros. Landlord necesita declarar procedencia por
  módulo (`original` / `CC0-1.0`); un módulo GN propio se audita, uno generado por un add-on externo
  re-auditable en cada actualización de la extensión no.

**Resultado D-111.1: SIN MEJORA.** La hoja existe para documentarlo; no se inventa una imagen sustitutiva.

### Reevaluación (WP03)

Dos de los tres bloqueos originales eran **falsos como veredicto sobre la extensión** y uno es verdadero:

- *Proporción*: no era bloqueo de la herramienta sino de la receta. `hifi_lab.py --layout=grid` escribe la
  fachada sobre el paso de crujía del perfil y `gridAudit` lo mide: desvío máximo al centro de crujía
  **0,70 m → 0,00 m** (37 huecos auditados), desvío a la línea de forjado **0,55 m → 0,00 m**, postes de
  balaustrada **1,0562 m de paso → 2,0000 m** con desvío a junta 0,00 m. 135 llamadas, 5 976 tri, 5,15 s de
  render. Hoja: [`../evidence/v2/sheets/hifi_grid_ab.png`](../evidence/v2/sheets/hifi_grid_ab.png).
- *Triángulos*: 98 tri para el vano horneado, por debajo de los 216 del control. Dejaron de ser motivo.
- *División del hueco*: **verdadero y decisivo**. `WINDOW_FLAT` expone ancho, alto, profundidad, grosor de
  marco y cota de base; ninguno parte el vano, así que no hay montantes ni travesero y el hueco se lee como
  un solo ojo. Y `PILLAR` no es una pilastra: genera una columna exenta de 0,34 m que queda **0,42 m por
  delante de la cara del paño**, con el relieve invertido (alféizar +0,33 y dintel +0,30 salen más que el
  marco, porque se resuelven con bloques `CEILING`). Prueba:
  [`../evidence/v2/ext/hifi_window_bay_2m_high.png`](../evidence/v2/ext/hifi_window_bay_2m_high.png).

**Resultado D-111.2: EVALUADA, SIN MÓDULO ADOPTADO.** El bloqueo ya no es estético ni de coste: es que la
extensión no sabe expresar la unidad mínima de la fachada de Landlord. La receta sobre retícula sí es
reutilizable como forma de conducirla.

## Arch Generator

Un `town_hall` cívico de 20×12 m con pórtico arcado y portal monumental (120 objetos, 35 452 tri).
Es la salida arquitectónicamente más rica de las tres: arcos, columnas, frontón, entablamento.

Bloqueos:

- 35 452 triángulos = 3,7× la candidata GN y 3,7× el presupuesto de un sprite de edificio.
- Sale sin material asignado (todo blanco): la extensión modela, no pinta; habría que construir el
  perfil de materiales encima, que es exactamente el trabajo que ya hace el Composer.
- Su vocabulario es de estilos históricos nombrados; no hay forma de pedirle "Graphic Civic".

**Resultado D-111.1: SIN MEJORA para el juego, ALTA MEJORA para arquitectura.** Se conserva la hoja como
referencia de composición cívica para quien afine los módulos GN.

### Reevaluación (WP02)

El rechazo se retira, y el motivo era medible como equivocado. La cifra de 35 452 triángulos correspondía a
**la escena histórica entera** que la extensión genera para un `town_hall` de 20×12 m, no a una pieza
consumible. Horneando sólo el vano a la caja canónica de 2 m con
`tools/art-pipeline/blender/ext_lab/ag_module_bake.py` el resultado es `mod_ag_arcade_bay_2m`: **920
vértices / 1 810 triángulos**, caja `x[-1,1] · y[-0,15;0,35] · z[0,3]` m, sha256
`cd84ed402a5100b8d41338a586214abd6d42bf1b2955ea66a0a8ec447a2b31a1`. La arcade se corta **por el eje del
estribo** (`x = ±1,00` m) para que dos bays contiguos reconstruyan un pilar y no dos —comprobado tileando
tres copias: 5 430 = 3 × 1 810—. El material no lo pone la extensión (sale blanca, como se dijo): se toma
de los mismos buckets de `gn_facade_grammar.MATERIALS` que el resto del alzado.

Aplicado sobre `town_hall` seed 2 con el perfil candidato `ag_civic_v2`: 18 418 → 44 374 tri, mismo envelope
(9,998 m), misma huella, mismos nueve ejes sorteados y las mismas 82 colocaciones, con 21 `window_bay`
convertidos 1:1. Hojas: [`../evidence/v2/sheets/ag_civic_ab.png`](../evidence/v2/sheets/ag_civic_ab.png) y
[`../evidence/v2/candidates/wp06_town_hall-candidata.png`](../evidence/v2/candidates/wp06_town_hall-candidata.png).

**Resultado D-111.2: EVALUADA Y UTILIZADA como herramienta de autoría offline.** El módulo está registrado
en el catálogo y consumido por un perfil de candidato; **no está promovido al runtime**, y quedan dos
trabajos que una gramática no resuelve: el cierre de la crujía en esquina y los 0,50 m de profundidad del
vano, que piden geometría nueva.

## Archimesh

Comparación a escala real de puerta, ventana con alfeizar y cubierta frente a Quaternius y Kenney
(26 objetos, 244 373 tri). Viene bundled con Blender, así que no hay que instalar nada: es la única
de las tres sin descarga externa.

Bloqueos:

- 244 373 triángulos para tres componentes: 25× la candidata GN completa.
- El realismo de los perfiles de carpintería no se lee a zoom 1×; se convierte en ruido de borde.
- La ventana Archimesh sí confirma el diagnóstico de §3: lo que falta en megakit no es detalle, es
  **profundidad de marco**. Esa lección ya está capturada por `mod_gn_window_bay_2m` con 3 750 tri
  en todo el edificio, no 235 000 en una ventana.

**Resultado D-111.1: SIN MEJORA.**

### Reevaluación (WP03)

Se retira «244 373 triángulos» como motivo: es la suma de puerta + ventana + cubierta de una escena de
render arquitectónico, y el vano horneado a la caja canónica son 1 358 tri. El bloqueo que queda es
geométrico y está medido pieza a pieza, que es lo que la primera pasada no pudo decir.

`build_archimesh` sí divide el hueco (genera `Window.L` y `Window.R` con su manija), pero el componente está
pensado para un muro de obra: mide **0,54 m de fondo** y el paño canónico de Landlord **0,10 m**
(y ∈ [−0,15; −0,05]). Asentado por detrás, las hojas caen en y = −0,105 y −0,055 y las manijas en −0,146 y
−0,097: **todo dentro del muro**. En el fotograma el hueco muestra el color del ladrillo, no vidrio —la
carpintería está oculta por construcción, no «demasiado pequeña»—. Adelantarla para ver el vidrio saca el
alféizar, que ya pide +0,39 m frente al límite canónico de +0,35 m.

El despiece (`partsBreakdown` en el JSON hermano) cierra además la pregunta de si aporta detalle: de los
1 488 triángulos pedidos, **912 (61,3 %) son las dos manijas**, 356 las hojas y 208 el marco. Y los presets
`model=2` / `model=1` generan **el mismo lote** medido al milímetro: `model` no es una palanca de calidad.
Prueba: [`../evidence/v2/ext/archimesh_window_bay_2m_high.png`](../evidence/v2/ext/archimesh_window_bay_2m_high.png)
y la columna de tres brazos [`../evidence/v2/sheets/ext_window_columns.png`](../evidence/v2/sheets/ext_window_columns.png).

**Resultado D-111.2: EVALUADA, SIN MÓDULO ADOPTADO.** Lo reutilizable no es la malla sino la auditoría que
produjo esta respuesta: `ext_module_bake.py` registra `trianglesRequested`, `trianglesSurviving`,
`maxRequestedFrontYMeters` y el límite canónico por pieza, así que saber si una pieza de extensión cabe se
decide en un minuto y no a opinión.

## Integración

**D-111.1:** ninguna de las tres entró en el pipeline. **D-111.2:** entra una, por la vía estrecha.

- Arch Generator aporta un módulo real (`mod_ag_arcade_bay_2m`) registrado en el catálogo y consumido por el
  perfil candidato `ag_civic_v2`. HiFi y Archimesh quedan evaluadas sin módulo adoptado, con el bloqueo
  concreto escrito arriba.
- Ninguna de las tres está en el runtime: los perfiles de candidato son QA y `runtime-promotions.json` no se
  tocó. Ningún `.py` GPL de las extensiones entra en el repositorio; se publica el GLB horneado y su
  procedencia, y las extensiones viven instaladas sólo en el perfil aislado `/tmp/d111-ext-lab` con su
  `sha256` registrado en la evidencia.
- No se guardan assets de terceros en Git y el `ext_lab` queda documentado como vía de re-evaluación barata:
  añadir una extensión nueva es escribir un `<x>_lab.py` con el mismo `lab_common.render_evidence`, y
  hornear un componente con `ext_module_bake.py` si la pregunta es «cabe en la caja canónica».
