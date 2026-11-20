# D-111 — Dirección visual de maqueta urbana material

Estado: dirección aceptada por el responsable el 2026-11-19; parámetros de producción sujetos al
spike de aceptación.

## Decisión

Landlord orienta el mundo y el HUD hacia una **maqueta urbana material**: arquitectura estilizada de
época, materiales mate reconocibles, luz cálida y lectura clara de la economía. El vocabulario combina
ladrillo, piedra, yeso, metal pintado, madera, vidrio oscuro, tierra, asfalto y vegetación salvia.
Se conserva la ambientación ficticia aproximada de 1925–1940 y la prioridad de silueta antes que
detalle.

`graphic_civic` permanece como brazo de control y baseline de runtime mientras se comparan tres
pilotos (`row_house`, `mixed_tenement`, `warehouse`) en la escena real. El HUD comparte los materiales
visuales de tinta, papel y latón, manteniendo contraste, accesibilidad y la jerarquía existente.

La aceptación de la dirección no aprueba automáticamente un grade concreto, una biblioteca externa,
efectos Phaser ni la promoción de sprites. Geometry Nodes, ajustes EEVEE, filtros, iluminación dinámica,
mapas de normales y partículas requieren evidencia separada antes de entrar en producción/runtime.

## Consecuencias

- Actualizar Art Bible y documentación operativa con esta dirección y el gate del spike.
- Usar staging/procedencia/licencias actuales para cualquier fuente nueva; no incorporar paquetes
  completos sólo por disponibilidad.
- Comparar día/noche, estados y escalas de juego; mantener D-101 y D-102 y los gates de accesibilidad.
- Sin cambios en dominio, `GameState`, snapshots o saves por razones visuales.

Ver `docs/art/MATERIAL-MAQUETTE-DIRECTION.md`.

## Condición experimental añadida — 2026-11-19

La renovación arquitectónica no se considera evaluada por nuevas seeds, combinaciones de módulos ya
usados o cambios de color del suelo. Antes de aprobar la fase, la evidencia debe incluir por separado:

1. Un A/B de materiales y render EEVEE sobre idénticas composiciones, semillas, cámara y resolución.
   Todo material nuevo debe registrar licencia, asset ID, ruta/hash de fuente y superficies a las que
   se asigna.
2. Una prueba real de Geometry Nodes para repetición modular con geometría licenciada existente,
   midiendo coincidencia de puntos/instancias y coste frente al control Python. El Composer conserva
   autoridad sobre seed, receta, validación, procedencia y salida.
3. Un A/B integrado de las gramáticas piloto y materiales seleccionados sobre contexto de calle con
   suelo, carretera y vegetación, a 0,5× y 1×, de día y noche.

Quaternius Ultimate Buildings, Kenney Modular Buildings y otras fuentes sólo se incorporan si el
inventario evidencia una carencia que las piezas registradas no pueden cubrir. La evaluación de una
fuente nueva debe pasar por staging, licencia e inventario antes de producir candidato. Si una
técnica o fuente se descarta, el informe guarda su prueba y el motivo técnico. El gate no requiere
instalar herramientas que no mejoren el resultado.

Los efectos Phaser quedan para una fase posterior: sólo se prueban cuando la composición y el
tratamiento de Blender superan estos pilotos; siguen siendo experimentales y no se activan en runtime
por esta decisión.

Actualización de fuentes (2026-11-20): cinco packs nuevos de Kenney y Quaternius Ultimate Buildings
se registraron en staging e índice global como candidatos, sin promoción automática. Retro Urban Kit
aporta una posible pieza de garaje para el piloto `warehouse`. La licencia específica CC0 de Ultimate
Buildings fue aceptado por el propietario bajo el CC0 indicado en su ficha específica; se retiró
el bloqueo de licencia. Registro: `docs/art/NEW-SOURCE-PACKS-2026-11-20.md`.

Ejecución de la adenda del propietario (2026-11-20): se midieron los 102 modelos de Ultimate
Buildings en Blender y se habilitó la importación de sus `.blend` para conservar texturas. Se
seleccionó un balcón medido y se añadió una receta candidata para `mixed_tenement`. El catálogo
principal de sprites permanece intacto hasta revisión visual humana. Registro de cobertura y
limitaciones: `docs/art/new-assets-integration/README.md`.

## Resultados del spike de capacidades — 2026-11-20

El encargo de ejecución de esta decisión (D-111 §0–§12) priorizó **generar imágenes útiles para
revisión humana** sobre producir baterías de pruebas, y trajo a esta pasada los efectos de Phaser que
la adenda del 19 había aplazado. Su registro completo, con la matriz de 19 tecnologías y las seis hojas
de revisión, es `docs/art/graphics-capabilities/`.

Qué se cumplió de la condición experimental:

1. A/B de materiales y EEVEE sobre geometría idéntica: hecho, con decisión **por superficie** y
   licencia/asset ID/hash de fuente registrados. Poly Haven no se sustituye automáticamente.
2. Prueba real de Geometry Nodes con geometría licenciada: hecho. A diferencia del pase del 19 (que
   sólo medía repetición de instancias), aquí la gramática resuelve los roles de fachada de
   `mixed_tenement` y `row_house`. Veredicto: **MEJORA VISUAL** en la lectura del hueco; el coste de
   preparación no es criterio de aceptación.
3. A/B integrado en contexto urbano a 0,5× y 1×: hecho a 1440×900 sobre tramo de calle con suelo,
   calzada, acera, vegetación, personaje y vehículo de escala, con `day_civic` (el mood de los
   pilotos). La noche queda cubierta por el laboratorio de Phaser (§8.5).

Frontera de la técnica, medida y registrada en lugar de disimulada: la gramática GN es una gramática de
**fachada continua de fábrica**. `warehouse` (`industrial_heavy`) y `town_hall` (`civic_landmark`)
recibieron `GrammarError` antes del render porque los módulos declaran `allowedFamilies:
["residential_low"]`. No se relajó el invariante para obtener la imagen; la extensión a esas dos
familias es un WP nuevo con su propia medición.

Estado de la decisión: **sin cambios**. La aceptación de la dirección sigue en pie, la promoción de
sprites, perfiles de material, filtros, luces y partículas sigue siendo revisión humana y ningún
efecto queda activado por defecto. `graphic_civic` permanece como control de runtime. No hubo cambios
de dominio, `GameState`, guardados ni topología vial por razones visuales; el laboratorio de QA es la
única superficie que lee las banderas de efectos.
