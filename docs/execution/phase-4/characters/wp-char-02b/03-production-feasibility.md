# WP-CHAR-02B · Viabilidad de una familia Kenney de 14 personajes

Fecha: 2026-11-24. Recomendación: **KENNEY_WITH_TARGETED_CUSTOM_MESHES**.

## 1. Respuesta corta

Kenney puede cubrir el catálogo sin mezclar Rocketbox/Quaternius, pero no todo es directo. La evidencia
actual permite afirmar:

- 8 personajes con modelos directos;
- 4 con pequeñas adaptaciones de material/accesorio;
- 2 con adaptación de vestuario/malla skineada;
- 0 profesiones sin una vía técnica identificada, aunque Enforcer B sigue sin demostrar.

La recomendación no es `KENNEY_FULL_FAMILY_CANDIDATE` porque Enforcer B y el acabado final del bombero
requieren trabajo de malla/vestuario y revisión humana. Tampoco es `KENNEY_HYBRID_REQUIRED`: no hay
evidencia de que haga falta introducir otra fuente para mantener el estilo.

## 2. Preguntas de viabilidad

### 2.1 ¿Cuántos pueden usar modelos sin cambios importantes?

**8 DIRECT**: Obrero A, cuatro civiles, policía, sanitario y profesional municipal.

### 2.2 ¿Cuántos requieren pequeños accesorios o materiales?

**4 MINOR_ADAPTATION**: supervisor, obrero B, técnico y enforcer A.

### 2.3 ¿Cuántos requieren modificar vestuario o geometría?

**2 MESH_ADAPTATION**: enforcer B y bombero. El bombero ya tiene una prueba de materiales protectores
y bandas sobre la malla existente; Enforcer B requiere retirar las pistolas de `female-a` y construir
una chaqueta pesada skineada o elegir otra base.

### 2.4 ¿Qué profesiones no tienen solución viable demostrada?

Ninguna está declarada `UNRESOLVED` porque todas tienen una vía técnica. Sin embargo, **Enforcer B no
está demostrado visualmente** y es el principal riesgo; si la chaqueta skineada no funciona, debe pasar
a `UNRESOLVED` o `REWORK_REQUIRED`.

### 2.5 ¿Qué modelos base pueden reutilizarse?

- `character-worker.glb`: obrero A.
- `character-male-e.glb`: supervisor.
- `character-male-f.glb`: obrero B.
- `character-female-f.glb`: técnico.
- `character-male-g.glb`: enforcer A.
- `character-female-a.glb`: enforcer B tras retirar armas.
- `character-male-a.glb`, `character-male-d.glb`, `character-female-b.glb`,
  `character-female-c.glb`: cuatro civiles.
- `character-male-c.glb`: policía.
- `character-male-b.glb`: bombero.
- `character-female-e.glb`: sanitario.
- `character-female-d.glb`: profesional municipal.

`character-raider.glb` es en realidad un civil con mono marrón y puede sustituir a un obrero/técnico.
`character-soldier.glb` es adaptable, no fantasía, pero su lenguaje militar contemporáneo exige más
trabajo y no se seleccionó para los prototipos.

### 2.6 ¿Cuántas siluetas realmente diferentes se pueden producir?

La selección usa 14 bases distintas y el catálogo demuestra variación de cuerpo, pelo, ropa y volumen.
La limitación real es el rig compartido de siete huesos: las piernas/brazos tienen poca articulación,
por lo que la diferenciación fina de pose debe venir de accesorios, cabeza, volumen y material, no de
gestos complejos. Las cinco siluetas revisadas son distintas, aunque obrero/supervisor son las más
cercanas.

### 2.7 ¿Las cuatro variantes civiles son suficientemente diversas?

Sí a nivel de catálogo: `male-a`, `male-d`, `female-b` y `female-c` ofrecen dos masculinos y dos
femeninos, distinto pelo, ropa y lectura formal/informal. No se ha producido el lote civil final; la
viabilidad es de base, no aprobación visual.

### 2.8 ¿Hay limitaciones para trabajo, reparación o sabotaje?

Sí. Los 32 clips incluyen `pick-up`, `interact-left/right`, `holding-*` y ataques, pero no existe una
biblioteca específica de reparación/sabajote de Landlord. El rig de siete huesos no permite agarrar con
dedos ni doblar codos/rodillas. Estas animaciones requieren una evaluación y posiblemente poses/acciones
adicionales; no deben darse por resueltas con `walk`.

### 2.9 ¿Es viable reemplazar progresivamente los ciudadanos Rocketbox?

Técnicamente sí: el catálogo Kenney ofrece cuatro civiles directos y el pipeline 02A/02B ya produce
sprites transparentes con misma cámara y escala. La sustitución debe ser gradual y tras aprobación
humana; primero producción offline, luego integración runtime en un WP autorizado.

### 2.10 ¿Hace falta Quaternius u otra fuente?

No para el catálogo actual. Quaternius ofrecería más articulación, pero obliga a crear ropa y armonizar
un estilo adulto más detallado. Si en el futuro se requieren gestos finos de manos o animaciones de
trabajo realistas, puede evaluarse como fuente especializada, no como mezcla casual dentro de la
familia Kenney.

## 3. Coste relativo

| Categoría | Trabajo esperado | Coste relativo |
| --- | --- | --- |
| DIRECT | Material local mate, cámara, suelo, renders | Bajo |
| MINOR_ADAPTATION | Lo anterior + accesorio rígido/paleta | Bajo-medio |
| MESH_ADAPTATION | Modificar pesos/geometría/vestuario y QA de intersecciones | Medio-alto |
| Animaciones de trabajo | Selección/creación de clips y validación de gestos | Alto, fuera de esta fase |

## 4. Estrategia recomendada

1. Congelar el obrero 02A como referencia de estilo.
2. Producir primero los ocho DIRECT con el pipeline existente.
3. Añadir los cuatro MINOR_ADAPTATION con revisión smoke individual.
4. Desarrollar Enforcer B y el acabado del bombero como mallas/vestuario objetivo, no como paneles
   rígidos.
5. Evaluar por separado animaciones `work`, `repair`, `carry`, `inspect` y `sabotage_action`.
6. No promover a runtime ni expandir a otros nueve hasta recibir aprobación humana de la familia.

## 5. Decisión

**KENNEY_WITH_TARGETED_CUSTOM_MESHES** es la recomendación respaldada por la evidencia. La familia es
viable y coherente, pero el trabajo no es uniforme: la mayoría es directo o menor, y dos variantes
necesitan adaptación de malla/vestuario. La aprobación artística y la promoción runtime siguen fuera
de WP-CHAR-02B.
