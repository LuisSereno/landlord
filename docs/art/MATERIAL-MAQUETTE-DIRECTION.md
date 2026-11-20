# Dirección visual: maqueta urbana material

Estado: dirección de producto aprobada; aislamiento A/B implementado; aprobación del spike y valores de producción pendientes.

## Propósito

Conseguir que los materiales, la silueta y los estados del edificio se lean a escala de juego. La
ciudad debe sentirse como una maqueta urbana táctil de época, con una presentación clara para tomar
decisiones económicas. Se conserva la inspiración ficticia transatlántica aproximada de 1925–1940.

## Lenguaje visual

- Ladrillo, piedra, yeso, metal pintado, madera, vidrio oscuro, asfalto, tierra y vegetación salvia.
- Acabados mates, luz cálida y sombras legibles. Las texturas aportan materialidad sin dominar la
  forma ni convertirse en ruido a zoom lejano.
- Día y noche comparten identidad y contraste funcional. El HUD usa superficies de papel e tinta,
  acentos de latón y estados semánticos compatibles con los colores de organizaciones y municipio.
- La silueta y la categoría se leen antes que el detalle. El estado económico sigue comunicándose con
  los canales actuales de forma, glifo, texto y color.
- `graphic_civic` es el brazo de control del spike y queda preservado como baseline del runtime hasta
  que haya una promoción revisada.

## Spike de aceptación

Comparar bajo la misma cámara, escala y escena:

1. `row_house` — residencial bajo y ritmo de fachada.
2. `mixed_tenement` — edificio urbano con fachada comercial.
3. `warehouse` — volumen industrial y cubierta.
4. Una escena real con terreno, carretera, vegetación y un panel de HUD en día y noche.

Revisar 0,5×, 1×, 2× y 2,5×, incluyendo estados completos, obra, daño e incendio. La ficha por
piloto registra perfil de estilo, módulos y licencias, valores de EEVEE, dimensiones, pivote, huella,
hashes, bytes y capturas. Las propuestas permanecen como evidencia hasta superar la revisión visual.

## Límites de integración

- No cambiar `GameState`, snapshots, contratos de simulación ni economía para conseguir un efecto.
- No agregar bibliotecas, mapas de normales, luces o partículas al runtime sin una comparación
  medible frente al brazo de control y una ruta correcta sin WebGL.
- Los packs nuevos se incorporan mediante staging aprobado, procedencia y licencia verificables.
- El spike conserva los presupuestos D-101/D-102 y registra los resultados de rendimiento bajo la
  misma escena y equipo.

## Criterio para escalar

La dirección escala a producción sólo cuando los tres tipos piloto se distinguen por silueta y
familia, conservan el tono entre día/noche, se leen en zoom lejano, mantienen legible la escena densa
y no exceden los presupuestos de carga y memoria. La promoción de edificios y efectos es una decisión
posterior con evidencia de Art Lab y gameplay.

## Primer pase de implementación — 2026-11-19

Aplicados como exploración reversible los tokens de tinta, papel, piedra, latón, salvia y óxido en
el tema del HUD, junto con un suelo de día/noche más cálido y menos grano. `graphic_civic` y sus
sprites siguen intactos. El cambio no altera dominio, saves, manifiestos ni presupuesto de runtime.

La auditoría del pipeline encontró que los pilotos ya cuentan con lotes del Composer para estados y
orientaciones en `docs/art/quality-vj/batch/` y `batch-day/`; se conserva su procedencia y se usan como
control. Las fuentes geométricas y materiales registradas ya incluyen Quaternius MegaKit, Kenney y
Poly Haven. No se añadieron packs nuevos: las candidatas Quaternius Ultimate Buildings y Kenney
Modular Buildings/Building Kit no resuelven aún una carencia concreta del inventario. El perfil de
edificios permanece en `graphic_civic`; los parámetros de render, Geometry Nodes y receta de módulos
requieren una propuesta A/B propia antes de regenerar y comparar los tres tipos.

El chequeo `art:building-style:build:check` estaba roto porque el generador leía el grade del nivel
raíz en vez de resolver `activeMood` y su herencia. Se corrigió la resolución en el generador. Los
filtros Phaser, luz dinámica, mapas de normales, partículas, `TilemapGPULayer` y promoción de arte
siguen fuera de runtime hasta demostrar una mejora y medir coste.

## Auditoría e implementación A/B — 2026-11-19

`graphic_civic` vuelve a ser un control seleccionable para HUD y terreno. La candidata material usa
tokens y superficies aisladas bajo `data-visual-direction`; `?artQa=1` habilita los botones «Control»
y «Maqueta». La elección se refleja en la URL y en el DOM para repintar la escena, sin persistir en
partidas ni preferencias locales. Las capturas de control/candidata se guardan en
`docs/art/material-maquette-spike/ab/` con SHA-256, resolución, cámara y errores de página.

El resolvedor JS de mood ahora aplica y retira `bandOverrides` igual que el pipeline Python. Sus
pruebas cubren los tres perfiles reales, herencia, override, perfil faltante, ciclo y banda inválida.
La salida Blender del spike acepta `--mood` para conservar en metadata el mood efectivo.

El primer A/B de edificios ya conserva tres propuestas deterministas del Composer (`row_house`,
`mixed_tenement`, `warehouse`, seed 1010) y manifiestos con hashes en
`docs/art/material-maquette-spike/`. Usan la gramática actual, el perfil `graphic_civic` y mood
`day_civic`; sirven para revisar variación arquitectónica y procedencia, no para afirmar que ya se
aprobó el nuevo material de fachada. Falta revisarlos en la ciudad real, día/noche, escalas 0,5×, 1×,
2× y 2,5×, orientaciones y estados. La promoción continúa cerrada hasta la revisión humana.

## D-111: experimentos de material y composición — 2026-11-19

Se corrigieron las gramáticas de los tres pilotos antes de promover nada: `row_house` reparte cuatro
accesos a lo largo de la fachada; `mixed_tenement` exige un acceso comercial con toldo físico; y
`warehouse` se construye como un único volumen de bandas con cuatro huecos frontales de 2×3 m, sin
equipos en la cubierta. La persiana grande para cerrar los huecos sigue pendiente de un módulo
adecuado.

El perfil `material_maquette_buildings_v1` es un experimento aparte, con la misma semilla, huella,
plantas, ejes y transformaciones que `graphic_civic_buildings_v1`. Añade materiales PBR CC0 de Poly
Haven para ladrillo y chapa, con rugosidad alta y normal atenuada, además de comparar EEVEE a 96
muestras con ray tracing frente al control. El informe de igualdad de geometría y las capturas están
en `docs/art/material-maquette-spike/experiments/`; los manifiestos registran licencia y hashes de
las fuentes y texturas. Esta variante no cambia sprites ni recursos de runtime.

La prueba de Geometry Nodes repite ocho instancias del mismo módulo y verifica sus posiciones frente
a la disposición determinista del Composer. La prueba funciona en Blender 5.2.2, pero no muestra una
ventaja suficiente para integrarla: su preparación tarda más que enlazar los ocho objetos y el tiempo
de render no mide una mejora de producción. El Composer continúa siendo responsable de semillas,
validación y salida.

Se evaluó Kenney Modular Buildings 2.1 en staging CC0. Sus módulos de puerta, ventana y toldo son
domésticos y no incluyen puerta de carga, dock leveler ni persiana a escala de camión; por eso no se
selecciona para `warehouse`. El inventario y el motivo están en
`docs/art/material-maquette-spike/experiments/kenney-modular-buildings-evaluation.json`. No se añade
ese archivo fuente al runtime ni a una selección de producción.

Quaternius Ultimate Buildings permanece sin evaluar: su página oficial identifica 76 modelos CC0,
pero el endpoint de descarga devolvió una respuesta de cuota excedida y no se pudo inspeccionar un
archivo del pack. No se descarta ni se incorpora.

**Actualización 2026-11-20:** el propietario aportó posteriormente una carpeta de Ultimate Buildings.
Está en staging con hash de árbol e indexada como candidata; el fallo de descarga anterior describe
sólo la prueba D-111 del día 19. Todavía no se han medido ni probado sus módulos en Blender. La ficha
específica dice CC0 y el propietario aceptó esa licencia para este pack; se retiró el bloqueo de
licencia. Retro Urban Kit también está disponible en staging y aporta piezas de garaje que
merecen un nuevo ensayo para `warehouse`. Véase
[registro de paquetes nuevos](NEW-SOURCE-PACKS-2026-11-20.md).

Se generaron las capturas de los tres pilotos en contexto de calle, a 0,5× y 1×, de día y noche, para
el control y el perfil material. Las capturas A/B de HUD y terreno se mantienen por separado, en
`docs/art/material-maquette-spike/ab/`. Siguen pendientes la revisión humana, la combinación de HUD
con ciudad poblada, escalas 2× y 2,5×, cuatro orientaciones, estados de obra/daño/incendio y medición
de runtime. No se amplía el catálogo ni se activa Phaser FX hasta superar esos gates.

## Ejecución del spike de capacidades — 2026-11-20

El encargo de ejecución de D-111 pidió probar de verdad las capacidades gráficas sin explotar y
documentarlas para reutilizarlas, no otro inventario. Su resultado vive en
[la matriz de capacidades](graphics-capabilities/README.md) y en sus cuatro hojas de revisión
(`graphics-capabilities/evidence/sheets/`). Las tres condiciones experimentales del ADR quedan
así cubiertas:

1. **A/B de materiales y render EEVEE sobre geometría idéntica** (§5): cupón, UV métrica, cámara, luz
   y mood iguales en los tres brazos. Kenney Retro Textures Fantasy gana en teja, zócalo y pavimento y
   pierde en ladrillo y revoco; Poly Haven conserva el relieve donde existe el escaneo y **no se
   sustituye automáticamente**. La decisión es por superficie y está en `material-decisions.json`.
2. **Prueba real de Geometry Nodes con geometría licenciada** (§3): cinco módulos originales de crujía
   de 2 m que resuelven los roles de fachada dentro de la gramática. El A/B de `mixed_tenement`
   (9 522 → 13 272 triángulos) **sí mejora la lectura del hueco**, y corrige la conclusión del
   2026-11-19, que había medido sólo repetición de instancias y no una fachada completa. El Composer
   conserva semilla, validación, procedencia y salida.
3. **A/B integrado en contexto urbano** (§8.6): control y candidata GN plantados sobre calzada, acera,
   parcela, árbol, personaje y vehículo de escala a 1440×900, a 1× y 0,5×, con el mood `day_civic` de
   los pilotos. A 0,5× la candidata sigue leyendo ventanas; el control las pierde en sombra plana.

`row_house` y `mixed_tenement` tienen candidata. `warehouse` y `town_hall` no: el invariante de
familia del Composer cortó los módulos GN antes del render y las cuatro piezas de garaje de Retro Urban
miden 1,00 m de frente, insuficiente para la caja de un camión. Se registró la restricción con su
medición en vez de relajar la regla para obtener una imagen.

Los efectos de Phaser 4 estaban aplazados por el ADR a «una fase posterior»; el propio encargo los
incluyó en esta pasada (§7) y se midieron sobre la calle de QA, sin activar nada en runtime. Ver
`graphics-capabilities/evaluations/phaser-fx-lab.md`.

Nada de esto promociona sprites, perfiles ni filtros: la promoción sigue siendo revisión humana, y
`graphic_civic` permanece como control.
