# D-088 — Ciudad 3×3 de nueve distritos y escala física permanente

Estado: ratificada el 2026-10-28 por el responsable para V.d.0, en la medida en que refleja
las decisiones fijadas en `PLAN_improvements.md`. Ciudad 3×3, escala física y simultaneidad de los nueve distritos.
Los detalles de implementación añadidos por esta ADR se listan al final, en
"Adiciones respecto a `PLAN_improvements.md`", y no forman parte de la ratificación.

## Contexto

Hoy Landlord es un distrito. `GameState` lo declara una sola vez
([packages/simulation/src/state.ts:143](packages/simulation/src/state.ts)) como
`map: { width: 64; height: 64; blockedCells; roads }` más `phase2.district` singular, y toda entidad
espacial cuelga de ese único mapa. `Parcel` es un punto
([packages/shared/src/domain.ts:261](packages/shared/src/domain.ts), campo `cell`), no un terreno.

El problema no es de ambición técnica sino de legibilidad: `PLAN_improvements.md` §2 lo formula así —
"el mapa no permite comprender visualmente por qué un terreno es residencial, caro, accesible o
estratégico". Y la medición interna lo confirma desde dos direcciones distintas:

- **D-085** cerró la topología vial autoritativa midiendo que el cuello visual del juego eran las
  calles, pero dejó `V.c.2D` (acceso y edificabilidad como regla real) diferida: la vía ya es dato,
  todavía no es consecuencia.
- **La nota de prioridad visual posterior a V.c.3-H** identificó que el siguiente cuello no son los
  props sino la **densidad de edificios y frentes**. Añadir más street dressing sobre parcelas-punto
  no lo cierra.

## Decisiones

### 1. La escala física 4 m/celda es un contrato, no un parámetro de render

D-083 ya la declaró. Se mantiene en V.d y se usa para dimensionar el mundo:

- celda = 4 m → distrito = 64 × 64 celdas = **256 × 256 m** (6,55 ha);
- ciudad = 3 × 3 distritos = **768 × 768 m** (58,98 ha);
- una manzana típica de ensanche europeo (≈ 40 × 60 m) son 10 × 15 celdas, y una parcela residencial
  de frente 8 m y fondo 18 m son 2 × 5 celdas. Sin esta relación, los envelopes del benchmark
  morfológico (§Fase 0) no son traducibles a parámetros del generador.

Cambiar la escala física rompería a la vez el style layer de Blender, los assets ya producidos y las
métricas de referencia. Es una decisión de otra fase, no de V.d.

### 2. Nueve distritos simultáneos con detalle completo; LOD sólo si se mide

`PLAN_improvements.md` §1 es explícito: "Los nueve distritos avanzarán simultáneamente con detalle
completo; sólo se introducirá LOD si los benchmarks vigentes demuestran que es necesario".

Esa frase conviene leerla contra el historial, porque el riesgo es real y ya está documentado:

- D-065 fijó los umbrales y estableció que cruzar el disparador de 5 ms **abre remediación obligatoria**
  (medir → optimizar exacto → re-medir → sólo entonces LOD);
- D-076 reescribió D-065 en ese sentido y dejó la distribución del cierre como *provisional*;
- D-078 y la auditoría posterior registraron que el cierre mensual de 800 parcelas **ya cruzaba** el
  presupuesto p95, con `housing` concentrando ~69 % del coste y `buildStock` como segundo candidato.

El mapa de un distrito son 4 096 celdas. Nueve distritos son 36 864 celdas y, con las recetas del plan,
bastante más parcelas y edificios. Es esperable que el cierre mensual se salga del presupuesto **por
el mero factor 9**. Por eso esta ADR fija el orden, no el resultado:

1. la ciudad multidistrito se mide con el harness existente (`pnpm system:cost`, `pnpm benchmark`);
2. si un sistema cruza umbral, se optimiza exacto primero;
3. LOD sólo después, y con decisión propia.

`wp4-2` ya dejó el LOD agregado documentado pero latente; V.d no lo activa por defecto.

### 3. Los nueve distritos existen desde el inicio y son observables

No hay desbloqueo progresivo ni niebla de guerra urbana: el jugador puede mirar Mercado del Norte en el
tick uno. Lo que cambia es su **cartera**, no su conocimiento del mapa. Esto simplifica generación,
snapshot y proyección, y preserva la regla de D-072: lo privado sigue siendo la caja, la estrategia y
la memoria del rival, no la geometría.

### 4. El municipio es de ciudad; las medidas son de distrito

`PLAN_improvements.md` §1 fija la frontera: vivienda, suelo, vacancia, demanda y puestos se miden por
distrito; municipio, política, banca, salario base y macroeventos siguen siendo globales. Es la
decisión que evita dos fallos simétricos: nueve presupuestos municipales (microgestión y dinero
artificial) o una media única que borre la diferencia entre distritos (el objetivo entero de V.d).

Ver D-091 para la consecuencia en mercados híbridos.

### 5. Composición inicial autorada, geometría procedural

`ciudad_del_umbral_v1` fija los nueve nombres y funciones dominantes
(`PLAN_improvements.md` §4.1). El generador decide la geometría dentro de cada distrito; la receta de
rol urbano decide su carácter. La ciudad no es un mosaico aleatorio, y el jugador puede formarse un
modelo mental estable entre partidas: el ferrocarril siempre está al sur, el centro cívico siempre en
(1,1).

### 6. Layout conceptual, no topología rígida

`City.layout = { columns: 3, rows: 3 }` es la forma del perfil inicial, no una restricción del modelo.
`City.districtIds` y `City.connections` son listas: una ciudad futura puede tener otra rejilla o
distritos no adyacentes sin reescribir el contrato. Lo que **sí** queda fijado es que la adyacencia
autoritativa se declara en `connections`, nunca se infiere de la rejilla: dos distritos vecinos en el
layout sin conexión declarada no son alcanzables.

## Alternativas descartadas

- **Un distrito grande de 192×192.** Más barato (un mapa, un generador) pero destruye la unidad de
  medida del plan: los mercados distritales, la cobertura de equipamientos y la comparación de
  oportunidades entre barrios necesitan fronteras nombradas, no regiones de un mapa único.
- **Distritos activos bajo demanda, el resto congelado.** Resuelve el rendimiento y rompe el
  determinismo observable: un distrito congelado no reacciona a una ordenanza ni a un macroevento
  mientras nadie lo mira, y al activarse aparece un pasado incoherente.
- **Ciudad infinita / expansión por tiles.** Excluida explícitamente en §1 y fuera del gate.

## Consecuencias

- `GameState` deja de tener un mapa; pasa a `WorldState` con `city` y `districts` (D-089 define el
  contrato persistido).
- El coste por tick y el cierre mensual se vuelven a medir **como obligación de gate**, no como
  observación.
- Phaser renderiza un distrito observado; la vista estratégica es React (D-090 define la proyección).
- El benchmark morfológico de Fase 0 deja de ser un documento de investigación y pasa a ser una
  comparación automática por receta, con envelopes como criterio.

## No decide

- El número de distritos de ciudades futuras (V.d entrega nueve).
- LOD: latente, sólo se activa con medición que lo exija.
- Tráfico, commuting individual, peatones inter-distrito y perspectivas política/criminal jugables:
  excluidos por §1 y por AGENTS.md.

## Adiciones respecto a `PLAN_improvements.md`

El plan fija la rejilla 3×3, la escala, la simultaneidad y la frontera ciudad/distrito. Esta ADR
añade un detalle que el plan no formula: la adyacencia autoritativa vive en `City.connections` y
**nunca se infiere de la rejilla**. Se deriva de §3.1 (que declara `connections` como dato), pero la
regla explícita es una decisión propia y se marca como tal.
