# D-111 §4 — Las tres extensiones arquitectónicas pendientes

Instalación aislada, sin dependencias permanentes en el repo, headless primero y una prueba visual
por extensión. Perfiles separados del toolchain:

```bash
export BLENDER_USER_CONFIG=/tmp/d111-ext-lab/config/cfg
export BLENDER_USER_EXTENSIONS=/tmp/d111-ext-lab/config/ext
blender -b --factory-startup -P tools/art-pipeline/blender/ext_lab/<lab>.py -- --mood=day_civic
```

Los `.zip` se descargan del registro oficial a `/tmp/d111-ext-lab/dl/`; su `sha256`, URL de
registro, versión, licencia y línea de mando completa quedan en el JSON hermano de cada hoja.

| extensión | versión | licencia | fuente oficial | estado | triángulos de la hoja |
|---|---|---|---|---|---|
| HiFi Architecture Builder | 4.6.7 | SPDX:GPL-3.0-or-later | extensions.blender.org | `tested` → rechazada | 2 356 |
| Arch Generator | 1.0.1 | SPDX:GPL-3.0-or-later | extensions.blender.org | `tested` → rechazada | 35 452 |
| Archimesh | 1.2.5 | SPDX:GPL-2.0-or-later | bundled en Blender 5.2 | `tested` → rechazada | 244 373 |

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

**Resultado: SIN MEJORA.** La hoja existe para documentarlo; no se inventa una imagen sustitutiva.

## Arch Generator

Un `town_hall` cívico de 20×12 m con pórtico arcado y portal monumental (120 objetos, 35 452 tri).
Es la salida arquitectónicamente más rica de las tres: arcos, columnas, frontón, entablamento.

Bloqueos:

- 35 452 triángulos = 3,7× la candidata GN y 3,7× el presupuesto de un sprite de edificio.
- Sale sin material asignado (todo blanco): la extensión modela, no pinta; habría que construir el
  perfil de materiales encima, que es exactamente el trabajo que ya hace el Composer.
- Su vocabulario es de estilos históricos nombrados; no hay forma de pedirle "Graphic Civic".

**Resultado: SIN MEJORA para el juego, ALTA MEJORA para arquitectura.** Se conserva la hoja como
referencia de composición cívica para quien afine los módulos GN.

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

**Resultado: SIN MEJORA.**

## Integración

Ninguna de las tres entra en el pipeline. No se añaden dependencias permanentes, no se guardan
assets de terceros en Git y el `ext_lab` queda documentado como vía de re-evaluación barata:
añadir una extensión nueva es escribir un `<x>_lab.py` con el mismo `lab_common.render_evidence`.
