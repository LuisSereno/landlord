# D-111.2 — Runbook de calidad visual e integración arquitectónica

**Estado:** READY FOR EXECUTION; no es una aprobación de sprites ni de efectos en producción.  
**Fecha:** 2026-11-21.  
**Rama de trabajo:** wip/organization-headquarters.  
**HEAD documental de referencia:** dd4393a713c2ff3a909a282120958d04a0100e29. Antes de actuar, verificar el HEAD actual y conservar cualquier trabajo posterior o local.  
**Responsable de aprobación:** propietario de Landlord.  
**Motor:** Phaser 4.2.1, React y Blender 5.2.2 LTS.  
**Arquitectura:** Building Composer autoritativo, render Blender offline y sprites 2.5D para Phaser.  
**Dirección:** Material Maquette, con Graphic Civic como control A/B.

## 1. Encargo y decisión del propietario

El propietario ha revisado visualmente las seis hojas de D-111 y considera que **HiFi Architecture Builder, Arch Generator y Archimesh producen un salto arquitectónico importante**. Sus resultados deben volver a evaluarse como **herramientas de autoría y generación offline**, no descartarse de forma automática por número de triángulos, tiempo de Blender o ausencia inicial de materiales. Esto **no** equivale a aprobarlas en producción: hay que adaptar proporciones, estilo, procedencia y salida de sprites, y demostrar la mejora en un A/B legible.

También solicita:

1. Conservar Geometry Nodes y mejorar sus cinco módulos de fachada; generalizar la técnica solo a familias compatibles.
2. Utilizar Kenney Retro Textures Fantasy para cubiertas, zócalos, carpinterías o pavimentos donde aporte valor. Reutilizar superficies Poly Haven envejecidas en **edificios deteriorados o dañados**, sin confundir un edificio sano con uno abandonado.
3. Priorizar **partículas** de obra, industria e incendio y **bloom localizado y suave en farolas/ventanas**. Corregir escenas excesivamente oscuras o quemadas; no sumar todos los efectos indiscriminadamente.
4. Dar prioridad a la calidad de la geometría y el render **offline**. La producción completa ya ronda las **nueve horas** según el propietario; no imponer límites arbitrarios de segundos o triángulos al modelado. Evitar repeticiones innecesarias mediante caché y generación incremental.
5. Mantener el presupuesto de descarga, memoria y frame **durante la partida en navegador**. La libertad de producción offline NO elimina las obligaciones de rendimiento del runtime.
6. Generar hojas comparativas accesibles y breves, con capturas reales a escala de juego, y pedir revisión humana antes de promover candidatos al runtime.

**Objetivo:** una biblioteca reutilizable de capacidades arquitectónicas y visuales que permita mejorar edificios residenciales, comerciales, industriales y cívicos sin crear un sistema por tipo ni recuperar la antigua Building Factory.

## 2. Evidencia existente: NO repetir trabajo ya hecho

Leer estos documentos antes de modificar código:

- docs/engineering/adr/D-111-direccion-visual-maqueta-material.md
- docs/art/ART-BIBLE.md
- docs/art/ART-PIPELINE.md
- docs/art/BUILDING-COMPOSER.md
- docs/art/MATERIAL-MAQUETTE-DIRECTION.md
- docs/art/NEW-SOURCE-PACKS-2026-11-20.md
- docs/art/new-assets-integration/README.md
- docs/art/graphics-capabilities/README.md
- docs/art/graphics-capabilities/capabilities.json
- docs/art/graphics-capabilities/material-decisions.json
- docs/art/graphics-capabilities/evaluations/geometry-nodes.md
- docs/art/graphics-capabilities/evaluations/extensions.md
- docs/art/graphics-capabilities/evaluations/materials.md
- docs/art/graphics-capabilities/evaluations/pilots.md
- docs/art/graphics-capabilities/evaluations/phaser-fx-lab.md
- ai-context/ART.md

**Seis hojas de referencia existentes:** en docs/art/graphics-capabilities/evidence/sheets/: gn_facade_ab.png, extensions_sheet.png, materials_sheet.png, pilots_sheet.png, urban_context_sheet.png y phaser_sheet.png. No afirmar que faltan: existen y están versionadas. Todas las comparaciones nuevas deben ser tan fáciles de abrir como estas.

### Diagnóstico verificado que motiva esta iteración

- Geometry Nodes funciona y genera **cinco módulos originales** para ventanas, escaparates, zócalos, cornisas y puerta-balcón. Su A/B mejora profundidad; quedan pendientes la coherencia de materiales, la cornisa demasiado blanca y el recorte/envelope. La gramática aprobada no fue cambiada.
- Las tres extensiones de Blender se ejecutaron y dejaron PNG/JSON. Se descartaron para producción por contexto de ejecución, estilos/materiales o conteos de triángulos. **Se reabre su evaluación por instrucción del propietario**, dando más peso al resultado visual offline.
- El piloto anterior produjo candidatas para row_house y mixed_tenement; **warehouse y town_hall siguen sin nuevas candidatas**. NO resolverlo violando allowedFamilies: requieren módulos específicos industriales y cívicos.
- Kenney Retro Textures Fantasy ya tiene **ocho superficies comparadas**; material-decisions.json aprueba como candidato zócalo, madera, teja y pavimento; limita vidrio y rechaza ladrillo en estado sano. Poly Haven aporta superficies con desgaste que antes se rechazaron para edificios en buen estado.
- El FX Lab existe en apps/web/src/fx-lab/. Partículas y bloom por objeto mejoran la lectura. El bloom global por umbral es excesivo. La iluminación nocturna se corrigió parcialmente; queda estudiar el rango oscuro/quemado y una posible **degradación tras desmontar efectos**. Los benchmarks anteriores se hicieron con SwiftShader y máquina ocupada: no son una medición definitiva de GPU real.
- Los seis packs nuevos ya están inventariados; algunos solo están disponibles como candidatos. No descargar paquetes nuevos sin un hueco concreto. Ultimate Buildings fue aceptado como CC0 para ese pack por el propietario y tiene módulos usados experimentalmente. Conservar procedencia por fuente.
- Ningún resultado de este spike modifica actualmente GameState, guardados o catálogos runtime aprobados.

## 3. Reglas innegociables

- **Una tarea pequeña cada vez.** Hacer el cambio, un render/captura, inspeccionar la imagen, guardar evidencia, registrar decisión y avanzar. No abrir varias implementaciones grandes simultáneas.
- No crear Building Factory paralela; Building Composer conserva semilla, catálogo, familia, huella, plantas, orientación, anclajes, validaciones y manifiestos.
- No alterar GameState, guardados, economía, política ni topología vial para conseguir una mejora artística. Si se necesitan datos del estado del juego, leer los contratos existentes y derivar exclusivamente la presentación.
- Los módulos de extensiones pueden hornearse offline y reutilizarse como geometría 3D intermedia o sprites. No es necesario instalar extensiones en el navegador. Distinguir licencia del código GPL de una extensión, licencia de las fuentes incorporadas y condiciones de distribución de la geometría/exportación; no copiar código GPL sin revisión.
- No editar manualmente archivos generados cuando exista un generador autoritativo. Los manifiestos de QA se mantienen separados de los catálogos promocionados.
- No introducir cambios visuales en el runtime por defecto hasta revisión humana. Mantener Graphic Civic accesible como control.
- No utilizar una cifra de triángulos como motivo aislado para rechazar una técnica **offline**; comprobar primero si la silueta, los huecos y los detalles sobreviven a zoom 1× y 0,5×. Aun así, registrar memoria, capacidad de completar el lote y tamaño del sprite final.
- No producir el catálogo completo ni variantes masivas antes de aceptar los pilotos. Reutilizar cachés/artefactos por fingerprint de inputs (fuente+versión+semilla+material+perfil+orientación+estado) si el pipeline ya lo permite; proponer una solución mínima si no la permite.
- Informar únicamente de bloqueos reales y al final. Evitar textos intermedios extensos y suites completas repetidas.
- Entregar imágenes comparativas con enlaces directos, no solo rutas locales file:///.

## 4. Contrato de ejecución por pasos cortos

Cada WP tiene: **entrada**, **cambio mínimo**, **evidencia** y **cierre**. Completar en orden cuando exista dependencia; los pasos independientes pueden continuar tras un bloqueo. Usar un commit lógico por WP o por grupo muy pequeño de cambios; dejar un registro compacto de DONE/PARTIAL/BLOCKED junto a la evidencia.

### WP00 — Congelar referencia y situación real

- [ ] Confirmar rama, HEAD, árbol de trabajo y versiones de Phaser/Blender. No sobrescribir trabajo local ajeno.
- [ ] Registrar seis sheets existentes, manifiestos y rutas de reproducción; usar como control, no regenerarlos por rutina.
- [ ] Abrir una carpeta de evidencia NUEVA para esta iteración (por ejemplo docs/art/graphics-capabilities/evidence/v2/) y un índice README corto.
- [ ] Registrar los cuatro edificios objetivo: row_house, mixed_tenement, warehouse y town_hall, con huellas/planta obtenidas del catálogo, no inventadas.
- **Cierre:** baseline y entradas reproducibles; cero cambios en runtime.

### WP01 — Reparar la calidad de los cinco módulos Geometry Nodes

- [ ] Revisar tools/art-pipeline/blender/gn_facade_grammar.py y los cinco módulos registrados.
- [ ] Unificar colores y tratamiento de gn_brick_wall, gn_stone_trim y gn_dark_glass con el perfil material; corregir cornisa demasiado blanca.
- [ ] Corregir framing/envelope, pivote y recorte alfa: no permitir sprites cortados por sobresalientes.
- [ ] Crear una candidata de fachada comercial y residencial con huecos en profundidad y puerta-balcón físicamente enlazada.
- [ ] Renderizar control y candidata con cámara, seed y escala declaradas; inspeccionar 1× y 0,5×.
- **Cierre:** una sheet GN v2 donde la mejora se reconozca y el sprite no esté recortado; módulos reproducibles. No modificar silenciosamente gramáticas aprobadas.

### WP02 — Arch Generator como autoría de arquitectura cívica

- [ ] Reutilizar tools/art-pipeline/blender/ext_lab/arch_generator_lab.py y el perfil aislado de extensiones.
- [ ] Crear **un módulo cívico útil**: pórtico, arco, cornisa o entrada para town_hall; mantener el paso de crujía y la huella canónica de ese edificio.
- [ ] Aplicar materiales de piedra/revoco adecuados, sin dejar la pieza completamente blanca; comparar el resultado de época con el lenguaje Material Maquette.
- [ ] Si la malla es excesiva, explorar simplificación/horneado **después** de comprobar la calidad; preservar silueta y detalles que se aprecian a 1×.
- [ ] Registrar versión, comando headless/adaptador, procedencia, medidas y sheet control/candidata.
- **Cierre:** componente cívico renderizado y medido, reutilizable o bloqueo técnico real. No descartar solo por 35.452 triángulos.

### WP03 — HiFi y Archimesh como herramientas de componentes

- [ ] Reutilizar hifi_lab.py y archimesh_lab.py; trabajar con perfil Blender aislado.
- [ ] De HiFi, producir una muestra de fachada residencial/comercial con ventanas, marcos, balcones y cornisas coherentes a la retícula de Landlord. Resolver el contexto headless únicamente en la operación necesaria.
- [ ] De Archimesh, producir una muestra reducida de puerta, ventana o cubierta; explorar simplificación o bake de malla para uso offline.
- [ ] Evaluar por separado si mejoran realmente el render frente al componente GN, Kenney o Quaternius equivalente. No dar por adoptados los tres si alguno no aporta detalle visible.
- [ ] Normalizar los componentes útiles a sourceId, selector/archivo, pivot, dimensions, allowedFamilies y prueba de importación. Conservar licencia del código de herramienta por separado.
- **Cierre:** una sheet de tres columnas (control, HiFi, Archimesh) con componentes identificados, o razones concretas de descarte. Al menos una muestra visual por herramienta.

### WP04 — Materiales limpios, envejecidos y dañados (offline)

- [ ] Inspeccionar primero cómo expresa HOY la simulación condición/mantenimiento/daño/incendio y qué estados y variantes admite el pipeline de sprites. No introducir campos nuevos por conveniencia gráfica.
- [ ] Definir una **proyección visual derivada** de los valores/estados existentes: buena conservación, envejecimiento y daño físico. No confundir suciedad superficial con daño estructural.
- [ ] Reutilizar decisiones existentes de Kenney: teja, madera, zócalo y pavimento como candidatos para buen estado; restricciones de vidrio según día/noche. Reaprovechar Poly Haven manchado/oxidado para envejecimiento; reservar grietas, roturas, marcas de fuego y geometría de destrucción para daño.
- [ ] Generar el **mismo edificio** en tres estados bajo misma cámara/geometría de base; indicar qué texturas o decals se han cambiado. Si el daño exige geometría adicional, declararla en evidencia.
- [ ] Definir contrato de selección por material semántico + estado visual + mood, sin tocar directamente los recursos runtime aprobados; incorporar a QA del pipeline de materiales mediante el generador existente o un adaptador con contrato claro.
- **Cierre:** hoja A/B/C (conservado/envejecido/dañado) a 1× y 0,5×, de día. Al menos una variante nocturna para comprobar la emisión; no asociar desgaste a un umbral inventado de economía.

### WP05 — Industrial: warehouse nuevo, sin falsear la familia

- [ ] Mantener la familia industrial correcta y el footprint de warehouse. No reutilizar módulos GN residenciales forzando allowedFamilies.
- [ ] Generar una crujía industrial original de 4 m o adaptar un módulo CC0 válido, con portón útil para camión (no la cochera de 1 m de Retro Urban), junta de nave y cubierta coherente.
- [ ] Construir variante warehouse con portón, puerta de personal, cubierta y material de chapa apropiado; comparar escala contra vehículo.
- [ ] A/B de control y candidata a 1× y 0,5×; registrar sourceId y módulos.
- **Cierre:** nueva candidata industrial reconocible, sin huecos presentados como muelles completos. Si no es viable, bloqueo documentado con alternativa concreta.

### WP06 — Cívico y viviendas: integración en Composer

- [ ] Crear candidato town_hall con al menos un componente útil de Arch Generator, HiFi o Archimesh si supera QA, o pieza propia equivalente si los adaptadores no son viables.
- [ ] Integrar componentes GN/HiFi útiles en row_house y mixed_tenement sin alterar sus roles funcionales: vivienda adosada diferenciable; planta comercial con escaparates reales; balcones ligados a puertas.
- [ ] Utilizar catálogo modular y recetas de familia, no scripts especiales por tipo. Crear rutas de selección de candidatos independientes de gramáticas de producción; evitar parches temporales peligrosos que puedan dejar el repo inconsistente.
- [ ] Generar UNA candidata por familia y verificar huella, orientación, altura, pivote, licencias y ausencia de colisiones evidentes.
- **Cierre:** cuatro candidatas revisables (row_house, mixed_tenement, warehouse, town_hall), preferiblemente dos técnicas diferentes donde aporten valor. No generar todo el catálogo.

### WP07 — Iluminación nocturna, bloom y partículas Phaser

- [ ] Empezar por apps/web/src/fx-lab/, no activar por defecto en el juego. Leer evaluations/phaser-fx-lab.md y los dos PNG de defectos ya guardados.
- [ ] Definir dos presets QA **legibles** (día/noche): luz ambiental mínima suficiente para distinguir fachadas, intensidad de farola acotada, halos localizados, sin blancos quemados y sin bloquear zonas exteriores en negro. Ajustar exposición, radio y color con capturas.
- [ ] Priorizar bloom **por objeto** (farolas/ventanas) y partículas de humo, polvo e incendio. No incluir bloom global por umbral en el preset recomendado.
- [ ] Vincular partículas solamente a eventos/estados REALES de simulación cuando se prototipe su paso a gameplay; en FX Lab permitir fixtures sintéticos explícitamente rotulados. Nunca generar humo/incendios falsos en la partida.
- [ ] Revisar montaje/desmontaje de normal maps y filtros: el control final debe recuperar recursos y coste razonablemente. Mantener fallback CANVAS sin error y sin perder información crítica.
- [ ] Capturar día, noche y noche con efectos sobre la misma escena; medir únicamente un smoke y p95 breve. Los datos SwiftShader no autorizan promoción, ni un p95 medido en equipo ocupado la descarta automáticamente.
- **Cierre:** hoja con escenas bien expuestas, partículas legibles, farolas suaves, fallback correcto y limitaciones de GPU honestamente declaradas.

### WP08 — Captura de mundo y comparación humana

- [ ] Reutilizar Art Lab, la ruta QA del compositor, el contexto urbano y scripts existentes; evitar montajes engañosos que no reflejen la escala de Phaser.
- [ ] Crear/actualizar **una sheet resumen de 4 edificios** control/candidata con encuadre, seed, huella y luz comparables.
- [ ] Crear sheet de 3 estados materiales, sheet de arquitectura avanzada (GN, HiFi, Arch Generator, Archimesh) y sheet de FX nocturnos. Puede haber 4–6 sheets en total; no duplicar cientos de fotogramas.
- [ ] Incluir al menos una calle urbana poblada a 1440×900, zoom 1× y 0,5×, con vehículos, vegetación, terreno y nuevas fachadas en presentación QA.
- [ ] Corregir rótulos cortados, recortes alfa, capturas negras, escenas lavadas, archivos rotos o artefactos que no correspondan al brazo anunciado.
- **Cierre:** índice HTML o Markdown simple con enlaces directos a los PNG GitHub; cada imagen lleva JSON hermano de procedencia y parámetros. Marcar SIN EVIDENCIA donde falte, sin inventar sustitutos.

### WP09 — Consolidar, validación mínima y entregar para decisión

- [ ] Actualizar docs/art/graphics-capabilities/capabilities.json y evaluaciones con **estados verdaderos**, especialmente la reevaluación de extensiones antes rechazadas. Mantener historial de sus decisiones, no borrar los resultados anteriores.
- [ ] Documentar generadores/adaptadores, parámetros, fuentes y consumidores por familia. Actualizar BUILDING-COMPOSER.md, MATERIAL-MAQUETTE-DIRECTION.md, ART-PIPELINE.md y ai-context/ART.md donde realmente cambien las reglas.
- [ ] Actualizar D-111 con la instrucción del propietario sobre calidad offline, deterioro y efectos selectivos; registrar los cambios como enmienda y no atribuirlos retrospectivamente a D-111 original.
- [ ] Ejecutar solo validaciones afectadas: git diff --check, formato de archivos tocados, Composer/estilo/licencia si cambian sus contratos, art:capabilities:check; typecheck y build web **una sola vez** si cambia Phaser. Un smoke de imagen por tecnología relevante. No usar suites generales, soak ni benchmarks de nueve distritos salvo regresión explícita.
- [ ] Releer el índice de imágenes y comprobar enlaces; entregar número de candidatas, cambios reales, costes offline, pruebas mínimas, deuda preexistente y limitaciones.
- **Cierre:** PARTIAL / READY FOR HUMAN VISUAL REVIEW / BLOCKED. Nunca DONE de promoción sin aprobación del propietario.

## 5. Reglas de aceptación visual (aplicar en WP01–WP08)

1. **Arquitectura:** se reconoce tipo y función a 1× sin leer la etiqueta; a 0,5× conserva silueta/huecos principales. La nueva pieza cambia algo visible, no solo seed o paleta.
2. **Conservación y daño:** un inmueble sano parece mantenido; el envejecido muestra uso/desgaste; el dañado comunica un incidente o destrucción cuando lo autoriza el estado del juego.
3. **Noche:** se reconoce el pavimento y la fachada incluso fuera del halo; las farolas producen grupos de luz diferenciables, sin saturación general ni viñeteado que oculte información económica.
4. **Contexto:** los cuatro pilotos encajan con la cámara y el terreno, sin huecos fuera de huella, props atravesados ni módulos de otra familia.
5. **Reproducibilidad:** semilla, perfiles, fuentes, hashes y transformaciones se registran; comparar determinismo de receta/geometría, no exigir PNG byte-idéntico si EEVEE introduce ruido mínimo (ver geometry-nodes.md).
6. **Viabilidad web:** no subir texturas de producción ni activar FX globales sin comprobar tamaño/caché/frame. Los límites offline de triángulos no se trasladan sin justificación al sprite final.
7. **Decisión humana:** en la hoja final indicar qué mejoras se solicitan para promoción y cuáles permanecen en QA. No promover automáticamente.

## 6. Política de esfuerzo y comunicación para agente básico

- Seguir WP00 → WP09. Cada WP debe dejar un resultado observable y un commit pequeño. No pasar a producir cientos de edificios.
- Para cada WP: leer **solo** los archivos mencionados en ese WP y sus imports necesarios, efectuar el cambio mínimo, renderizar/capturar una imagen, inspeccionar imagen, registrar una nota de hasta 8 líneas y continuar.
- Mantener un ledger corto en la carpeta de evidencia con WP, commit, estado, artefacto principal y bloqueo si existe. No escribir transcripciones completas de consola.
- Reducir mensajes intermedios: solo un bloqueo esencial; resumen definitivo al acabar.
- Si falta una herramienta o un binario local, dejar BLOCKED en ese WP; no falsificar éxito. Continuar con WPs independientes.
- No modificar código de simulación para fabricar condiciones visuales. Si no existe una señal de dominio, usar fixtures QA rotulados y dejar integración real pendiente.
- Commit y push normales exclusivamente a wip/organization-headquarters, si el acceso está disponible; nunca force push. Antes de publicar verificar que no hay cambios remotos nuevos; no sobrescribirlos.
- El informe final debe responder de forma muy breve: qué mejoró, qué está integrado en la generación, qué queda solo en QA, links a 4–6 sheets, y qué requiere aprobación. No reclamar «finalizado» si warehouse/town_hall o estados no tienen evidencia.

## 7. Entradas y comandos verificables

El repositorio dispone de estas acciones; comprobar los argumentos antes de ejecutar generadores:

- pnpm art:building-composer:validate
- pnpm art:building-modules:build:check
- pnpm art:building-style:build:check
- pnpm art:licenses:check
- pnpm art:capabilities:check
- pnpm art:fx-lab:capture
- pnpm art:fx-lab:smoke
- pnpm --filter @landlord/web typecheck
- pnpm --filter @landlord/web build

Otros scripts y evidencia ya existentes:

- tools/art-pipeline/blender/gn_facade_grammar.py
- tools/art-pipeline/blender/ext_lab/{hifi_lab,arch_generator_lab,archimesh_lab,material_lab,garage_probe,compose_review_sheets}.py
- tools/art-pipeline/blender/build_building_composer_context.py
- scripts/build-building-composer.mjs
- scripts/fx-lab-capture.mjs
- apps/web/src/fx-lab/
- docs/art/graphics-capabilities/evidence/

Los cambios de superficies preferidas deben pasar por el generador autoritativo tools/art-pipeline/blender/build_world_material_library.py; no manipular manualmente el derivado world-catalogs/material-assets.json ni marcar retro textures runtimeReady para simular integración.

## 8. Producto final esperado

Una segunda iteración D-111 con:

- Cuatro pilotos arquitectónicos mejorados y comparados.
- Reutilización demostrada de Geometry Nodes y de los componentes útiles de HiFi, Arch Generator y Archimesh, o bloqueos justificados por evidencia.
- Variante de edificio conservado, envejecido y dañado, derivada de información del juego o de fixtures QA declarados.
- Iluminación nocturna equilibrada, bloom muy moderado por objeto y partículas visualmente claras en Phaser QA.
- 4–6 hojas comparativas directas a 0,5× y 1×, más sus parámetros.
- Matriz de capacidades actualizada y procedimiento repetible para futuros edificios.
- Ninguna modificación de GameState o promoción a producción sin una aprobación posterior expresa.

**El criterio de éxito es visual y operativo: mejor ciudad, arquitectura reutilizable y producción offline reproducible. La cantidad de tests o el número de triángulos no es el objetivo.**
