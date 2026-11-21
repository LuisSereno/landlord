# FASE 2 — diagnóstico de los incendios actuales (control congelado)

**Objetivo del documento:** explicar por qué el fuego y el humo se ven pobres antes de sustituirlos. Nada de
esto es opinión de gusto: cada punto tiene su causa en una línea concreta del compositor o del laboratorio y su
número medido sobre el control.

- HEAD de partida: `8b42a64` (FASE 1). Semilla del control: `2`, estado `burning`, orientación la que resuelve el
  propio compositor para esa semilla.
- Corridas de control (cuatro, ninguna de mundo completo):

```bash
node scripts/build-building-composer.mjs --types=$TIPO --seeds=2 --states=burning --mood=$MOOD \
  --prefix=f2ctl_${TIPO}_${MOOD} --outDir=/tmp/fase2/$TIPO-$MOOD --metrics=/tmp/fase2/metrics-$TIPO-$MOOD.json
```

- Archivo | qué es
  --- | ---
  `control_mixed_tenement_day.png` / `_night.png` | cívico de 3 plantas, sobre 10,00 m de envoltoria
  `control_warehouse_day.png` / `_night.png` | nave de 1 planta, sobre 6,42 m de envoltoria
  `control_*.json` | la metadata de cada corrida, con `transforms`, `damageTreatment` y `envelopeMeters`
  `fire_control_sheet.png` | las seis lecturas pedidas (1× día, 1× noche, 0,5× día) por tipo
  `fire_control_detail.png` | la misma zona de llamas ampliada, en 1× y en 0,5×

`warehouse` se incluyó exactamente por lo que pide el encargo: aporta una comprobación de escala distinta. Es el
edificio más bajo y ancho del par, y esa diferencia es la que permite cerrar el punto 10 del análisis.

## Los números del control

Medidos sobre los cuatro PNG versionados y sus JSON, con una máscara de píxel cálido (`R−B > 50 y R > 170`) y
etiquetado de componentes conexas:

| medida | `mixed_tenement` 3 plantas | `warehouse` 1 planta |
| --- | --- | --- |
| envoltoria en z | 10,00 m | 6,42 m |
| llamas declaradas | 5 | 5 |
| **llamas visibles** | **2** (1321 px y 1320 px) | 5 (1322/1320/1319/1309 px + 1 recortada a 168 px) |
| z de las llamas | 1,65 y 1,95 m | 1,65 y 1,95 m |
| x de las llamas | 1,84 · 3,12 · 4,40 · 5,68 · 6,96 | 1,84 · 3,12 · 4,40 · 5,68 · 6,96 |
| tope del humo | 6,42 m | 6,42 m |
| pico de emisión de día | RGB (255, 255, 165) | RGB (255, 255, 181) |
| pico de emisión de noche | RGB (233, 211, 173) | RGB (237, 213, 177) |
| saturación media de la llama | 114 de día → 78 de noche | 109 de día → 76 de noche |
| `soot` | 0,7 sobre 24 materiales | 0,7 sobre 16 materiales |
| `flameEmissionStrength` | 2,0 en los dos materiales | 2,0 en los dos materiales |

Las dos columnas centrales son la clave de todo el diagnóstico: **un edificio de 10,00 m y otro de 6,42 m reciben
literalmente el mismo incendio**, posición por posición. No es una coincidencia de render; es que el incendio no
mira al edificio.

## Análisis de los diez puntos del encargo

### 1 · Formas repetidas de las llamas

`_compose_fire()` (`compose.py:1842`) coloca cinco veces `mod_original_fire_flame` con `rotationDegrees: 0` y sin
escala. El módulo (`create_original_state_modules.py:111`) es un único cluster de tres conos (radios 0,28/0,18/0,16
m, profundidades 1,0/0,7/0,6 m) horneado como una sola malla de 108 triángulos. Cinco instancias de la misma malla
con la misma rotación son cinco siluetas idénticas: los blobs medidos difieren en 1–13 px de área, que es la
proyección, no la forma.

### 2 · Falta de variación de altura

La única variación vertical es `z = base_z + (0.3 if i % 2 else 0.0)`: dos valores, 1,65 y 1,95 m. Como el módulo
mide 1,00 m y no se escala, el conjunto de llamas ocupa dos alturas exactamente iguales y alternas. No hay llama
grande y llama chica; hay dos plantillas.

### 3 · Separación excesiva entre focos

`x0 = rect[0] + span*0,15`, `x1 = rect[2] − 0,4`, cinco huecos iguales. Sobre la huella dañada de 8,0 m resulta
Δx = 1,282 m exacto (progresión aritmética medida en el JSON). Cada llama mide 0,66 m de ancho, así que entre llama
y llama quedan **0,62 m de forjado vacío**: el metronomo se lee como una valla de conos, no como un frente en
combustión.

### 4 · Apariencia rígida o artificial

Viene de 1 y 3 juntas y de la geometría del módulo: conos de revolución con 10 vértices, aristas vivas y sin
inflexión. En `fire_control_detail.png` se ve el perfil recto del cono y la costura del triángulo superior. Un
fuego real no tiene líneas rectas; este sí.

### 5 · Falta de profundidad

El cluster es una sola malla con dos materiales (`flame_outer`/`flame_inner`); no hay capas internas que se
ocluyan entre sí, así que la llama no tiene volumen propio. Y a nivel de composición, en `mixed_tenement` **tres
de las cinco llamas están ocultas por el muro medianero que la sección deja en pie**: el fuego se coloca sin
comprobar si va a ser visible desde la cámara. Lo que se ve no es un incendio de tres plantas; son dos conos en un
rincón.

### 6 · Emisión que se vuelve blanca

Medido: de día el píxel más brillante de la llama es (255, 255, 165) — satura en R y G, es decir blanco-amarillo
sin paso por naranja. De noche baja a (233, 211, 173) y la saturación media cae de 114 a 78: **de noche el fuego es
más pálido y más apagado que de día**, que es exactamente lo contrario de lo que debe pasar. La causa está en
`boost_flame_emission` (`scene.py`), que escribe el mismo `Emission Strength = 2,0` en `flame_outer` y en
`flame_inner`; los dos materiales sólo se distinguen en el color base, así que no hay núcleo caliente — no puede
haberlo.

### 7 · Humo insuficiente o mal localizado

Dos módulos de humo, en z 2,55 y 4,25, con tope en 6,42 m. En `mixed_tenement` el pretil queda a ~10 m y la cámara
mira con 30° de elevación: **la columna entera de humo muere 3,6 m por debajo del pretil y no se ve ni un píxel de
humo en el render** (visible en `control_mixed_tenement_day.png`). En `warehouse`, que sí mide 6,42 m, el humo
aparece y confirma que el problema es la cota, no la textura. La causa es la misma del punto 10: `base_z` es una
constante y el humo se ancla a `base_z + 0,9` y `base_z + 2,6`.

### 8 · Humo excesivamente uniforme

`mod_original_fire_smoke` es cuatro UV-sphere idénticas de radios 0,32→0,5 m en z 0,4/0,85/1,3/1,75 con **un solo
material y alfa fijo 0,85** (casi opaco). Dos instancias de ese módulo apilan ocho bolas del mismo tamaño: en
`fire_control_detail.png` se lee como un collar de cuentas, no como una columna que se dispersa. No hay variación
de opacidad, ni de tamaño al ascender, ni deriva lateral.

### 9 · Capas que atraviesan fachadas o cubiertas

Dos casos medidos. a) Las llamas de `mixed_tenement` a x 1,84–6,96 m atraviesan el muro interior que la sección
conserva: por eso sólo dos emergen. b) La cornisa no se retira nunca: el filtro de `_compose_damage` es
`purpose in ("dormer", "cornice")` y las etiquetas reales están prefijadas por lado e índice
(`cornice:front:1` … `cornice:right:4`), por lo que **las 24 cornisas del control sobreviven a la sección de
cubierta** y el pretil intacto es la tapa que oculta el humo. Esto es el defecto que el encargo reserva para
FASE 6.3; aquí queda medido porque es la causa directa de que el incendio no remate.

### 10 · Falta de relación entre daños geométricos y posición del fuego

Es el fondo de todo lo anterior y está en tres líneas:

- `base_z = self.level * 0.55`, y `self.level` es `profile.floor_height` (`compose.py:165`), o sea **la altura de
  planta (3,0 m), no el número de plantas**. Resultado: 1,65 m para cualquier edificio del catálogo. La prueba
  empírica es la tabla de arriba: el mismo z en el de 3 plantas y en el de 1.
- `_damage_rect` se construye uniendo los bounds retirados pero **conserva sólo x e y** (`compose.py:1816`); la z
  de la cubierta se descarta, así que el compositor no sabe ni puede saber a qué altura está el hueco que él mismo
  abrió.
- `n = 5` está fijado a mano y `cy` es el centro de la huella: ni el número de focos ni su reparto dependen del
  área dañada, sino del ancho de la parcela.

Un incendio que no nace del hueco de la sección, que no sube con la altura del edificio y que no cambia con el
tamaño del daño no puede leerse como un incendio de ese edificio.

## La única decisión: qué es offline y qué es dinámico

El encargo pide priorizar una solución híbrida y no duplicar llamas y humo hasta que el edificio se vea ardiendo
dos veces. Este es el reparto, y es el que se ejecuta en FASE 3 y FASE 4:

**Blender (sprite offline, congelado en el asset):**
- el edificio dañado y su sección real, con la cubierta y la cornisa retiradas donde el daño las quita;
- las **zonas carbonizadas localizadas** (hollín con máscara sobre la fachada bajo el hueco y en los cantos del
  forjado seccionado, no un tinte uniforme sobre los 24 materiales);
- los **focos persistentes**: la base del incendio, con geometría variada en altura y ancho, agrupada en focos
  naturales derivados del área dañada y anclada a la cota del hueco;
- la **humareda baja** que da cuerpo al arranque de la columna, para que el sprite por sí solo ya cuente el fuego.

**Phaser 4 (tiempo real, sobre el mismo sprite):**
- las **llamas animadas** que lamen los focos persistentes, con núcleo amarillo, cuerpo naranja y borde rojizo;
- el **humo ascendente** que sale del hueco y se dispersa, con tamaño y opacidad crecientes;
- las **brasas** que saltan del foco;
- las **variaciones de intensidad** del frente y el **resplandor localizado** sobre la fachada y el suelo cercanos.

La regla que evita la duplicación: **Blender fija dónde arde y cuánto; Phaser fija cómo late.** El sprite no lleva
la columna de humo alta ni las lenguas animadas; el laboratorio no vuelve a dibujar los focos que ya están
horneados. Para que eso sea verificable y no una frase, FASE 3 deja en la metadata de cada composición un
`fireAnchors` con la posición en metros de cada foco y su cota, y FASE 4 ancla los emisores a esa lista en lugar
del desplazamiento universal `y − 26` px que usa hoy `FxLabScene.placeEmitters()` (`FxLabScene.ts:532`).

## Defectos del lado Phaser que este control también deja vistos

No son del sprite y se arreglan en FASE 4/5, pero se registran aquí porque forman parte del diagnóstico:

- `fx-particles.ts` construye el emisor `fire` sobre `makeEmber()`, un disco suave redondo: el cuerpo de la llama
  dinámico es una bola, no una lengua.
- `FxLabScene.placeEmitters()` pone **un solo anclaje por sprite** (`y − 26` px), aunque el sprite contenga cinco
  focos; y el emisor de humo del fuego reutiliza la familia `industrial-smoke`.
- `buildEffect("particles")` se desmonta con `setEmittersActive(false)` → `stop(true)`, sin destruir; y
  `buildEmissiveTexture` añade las texturas `${key}-emissive` y `fx-tex-lamp-glow` que ningún `teardown()`
  elimina, mientras `normalMaps` y `flatNormals` crecen en cada activación. Es la fuga que FASE 5.3 exige medir.
- `attachNormalMaps` (`fx-effects.ts`) restaura con `if (previous) putNormal(...)`: en la primera activación
  `previous` es `null`, así que **el normal inyectado no se retira nunca** y el objeto sigue iluminándose con la
  textura sustituta después de apagar el efecto.

## Cierre de la fase

Cuatro PNG de control, cuatro JSON, una hoja de las seis lecturas pedidas y un detalle ampliado, todo versionado
aquí. No se ha generado ninguna variante nueva de fuego: el encargo pide diagnóstico breve y capturas de
referencia, y decenas de variantes llegarían sin control contra el que comparar.
