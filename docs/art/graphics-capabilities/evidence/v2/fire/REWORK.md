# FASE 3 — el incendio re-autorado en Blender (brazo candidata)

Este documento acompaña a [`DIAGNOSIS.md`](DIAGNOSIS.md), que explica qué estaba mal. Aquí se registra qué se
cambió, en qué orden, con qué medida concreta que forzó cada cambio, y qué cuesta. Ningún sprite de esta carpeta
ha entrado en el runtime: la hoja A/B es evidencia para la revisión visual humana, no un promocionado.

- HEAD de partida del brazo candidata: `d123a16` (cierre de FASE 2).
- Semilla `2`, estado `burning`, orientación y encuadre los que resuelve el propio compositor para esa semilla.
- Cuatro corridas, ninguna de mundo completo:

```bash
node scripts/build-building-composer.mjs --types=$TIPO --mood=$MOOD --seeds=2 --states=burning \
  --keepAttempts --prefix=f3candG --outDir=/tmp/fase3/candG/$TIPO-$MOOD \
  --metrics=/tmp/fase3/candG/metrics-$TIPO-$MOOD.json
```

- Archivo | qué es

  Archivo | qué es
  --- | ---
  `control_<tipo>_<mood>.png/.json` | el brazo congelado de FASE 2, sin tocar
  `candidata_<tipo>_<mood>.png/.json` | la pasada G, re-autorada, con su metadata
  `fire_blender_ab.png` | hoja 1× con el pie medido sobre cada fotograma
  `fire_blender_ab_half.png` | hoja 0,5× = escala real de juego
  `fire_blender_ab_readings.json` | las mismas cifras en texto, para comparar sin abrir Blender

Las cifras de este documento salen de `python3 tools/art-pipeline/blender/ext_lab/fire_ab_sheet.py`, que lee los
PNG+JSON versionados aquí y no re-renderiza nada.

## Las cinco capas que cambiaron

1. **El módulo de llama deja de ser un cono plano.** `create_original_state_modules.py` autoró tres zonas
   (núcleo 2,6 / cuerpo 1,9 / borde 1,1 de emisión) dentro de `fire_flame.glb`, y `boost_flame_emission()` las
   reescala por un solo factor en vez de escribir el mismo número en todos los materiales: amarillo dentro,
   naranja en el cuerpo, rojo en el filo. El control escribía un valor único y elegía el color por un sufijo
   `_inner` que ya no existía.
2. **El fuego se mide contra el hueco, no contra una constante.** `_compose_fire()` pone entre 1 y 4 focos según
   el frente quemado (`clusters = min(4, frente/2,4 m)`), cada uno con una dominante que cruza el hueco
   (`0,85–1,25 × altura del piso`) y 3–4 satélites bajos apretados alrededor (`±0,8 m`). Antes eran cinco copias
   hermanas a Δx fijo, que se leían como una valla de conos.
3. **La columna nace del fuego, no del solar.** El eje de humo es el baricentro de las lenguas ponderado por su
   altura y arranca `0,35 × hueco` por debajo de la punta media dominante. El control lo plantaba en el centro
   del rectángulo de daño y la bola tapaba todo el incendio.
4. **El incendio alumbra.** `apply_fire_glow()` enciende como mucho dos luces puntuales derivadas de una cuota:
   a 2,5 m del foco el fuego aporta 1,25× la irradiancia de la clave del mood, así que la potencia se despeja de
   `P = E·4πd²` y da 412 W de día y 231 W de noche con las mismas líneas de código. El pase de sombra las apaga y
   las devuelve, porque ese pase pinta sobre un plano blanco y cualquier luz suelta lo lava.
5. **Hollín localizado y mallas VFX sin rayo de sombra.** `apply_soot()` usa un campo escalar sobre la caja
   quemada (núcleo 0,63 / 0,55 de opacidad, cero fuera) en vez de multiplicar los 24 materiales por el mismo
   marrón, y `clear_vfx_shadow_rays()` apaga el rayo de sombra en llama y humo.

## Las pasadas y la medida que forzó cada una

| Pasada | Qué salía mal, medido | Qué se cambió |
| --- | --- | --- |
| D | la primera bocanada de humo nacía a 0,40 m y el fuego subía de 0,10 a 3,57 m: la bola quedaba delante y tapaba el incendio | el arranque pasa a depender de lo que arde, no del forjado |
| E | `base_z = punta − 0,3` despegaba la pluma 3 m del suelo; la bombilla a 0,55 de la altura de llama quemaba un agujero blanco en el forjado; las dominantes estiradas 3:1 salían en astillas | baricentro ponderado + `punta − 0,35·hueco`; altura de bombilla 0,85; cuota 1,0 → 1,25; girth dominante 0,50–0,62 |
| F | el sol seguía proyectando la malla de la llama: cuña negra justo debajo de cada hoguera sobre el suelo que el fuego debía iluminar (visible en la nave nocturna) | `visible_shadow = False` en los objetos con material `flame_*` / `fire_smoke_*` |
| G | — | estado final promocionado a esta carpeta |

## Lo que mide la hoja

| Panel | focos visibles / declarados | alturas de llama distintas | recorte | tope de humo | sobre pretil | luz de fuego | mallas sin sombra | sprite | KiB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cívico día · control | 2 / 5 | 1 | 0 px | 6,42 m | −3,58 m | ninguna | 0 | 1082×1063 | 1432 |
| cívico día · candidata | 11 / 16 | 14 | 0 px | 13,25 m | +4,25 m | 2×412 W | 19 | 1082×1233 | 1583 |
| cívico noche · control | 2 / 5 | 1 | 0 px | 6,42 m | −3,58 m | ninguna | 0 | 1082×1063 | 1261 |
| cívico noche · candidata | 10 / 16 | 14 | 0 px | 13,25 m | +4,25 m | 2×231 W | 19 | 1082×1233 | 1382 |
| nave día · control | 5 / 5 | 1 | 0 px | 6,42 m | 0,00 m | ninguna | 0 | 1417×1097 | 1283 |
| nave día · candidata | 5 / 19 | 18 | 0 px | 6,79 m | +3,79 m | 2×412 W | 22 | 1417×1119 | 1350 |
| nave noche · control | 5 / 5 | 1 | 0 px | 6,42 m | 0,00 m | ninguna | 0 | 1417×1097 | 968 |
| nave noche · candidata | 7 / 19 | 18 | 0 px | 6,79 m | +3,79 m | 2×231 W | 22 | 1417×1119 | 1027 |

Lecturas que hay que saber leer, porque su número solo miente:

- **focos visibles / declarados** cuenta componentes conexas del mapa cálido, no lenguas. En la nave los 19
  focos declarados se sueldan en 5 manchas: es fuego denso, no fuego escaso. En el control pasa lo contrario —
  declara 5 y se ven 2— porque las lenguas idénticas se apilan unas sobre otras.
- **alturas de llama distintas** es la medida de profundidad que sustituye a "más llamas": el control tiene **1**
  altura repetida; la candidata, 14 en el cívico y 18 en la nave.
- **sobre pretil** se mide contra el plano de la cubierta seccionada (`damageRegion.z.max`), no contra la
  envoltoria: en el control la envoltoria la marcaba el edificio y daba +0,00 justo donde estaba roto.
- **recorte** es el píxel opaco con los tres canales en 255. Está en 0 en los ocho paneles, que es lo que pedía
  el cierre de fase ("sin recortes ni sobreexposición"); el pico más caliente de la candidata es (255,255,171) y
  conserva su canal azul.

## Coste real

El lienzo crece porque la pluma ahora sobrepasa el pretil: el cívico pasa de 1428×1402 a 1428×1626 px de canvas
(+224 px de alto) y el sprite recortado de 1082×1063 a 1082×1233. En bytes, **+151 KiB (10,5 %) de día** y
**+121 KiB** de noche en el cívico; **+67 KiB (5,2 %)** en la nave. Es un coste que sólo afecta al estado
`burning` —un fotograma de los 288 del catálogo— y va a revisión junto con la decisión de promocionar.

## Criterio de cierre de la fase

"El incendio mejora visiblemente su forma, profundidad y humo, sin recortes ni sobreexposición":

- forma: fuego en focos con dominante y satélites, dentro de la huella quemada, ninguno montado sobre cubierta
  intacta (el frente deja 0,9 m de banda a cada lado);
- profundidad: 14/18 alturas de llama frente a 1, gradiente de tres zonas de emisión;
- humo: anclado al baricentro del fuego, arranca 1,2–1,5 m bajo la punta (ya no tapa el incendio) y remata
  +4,25 m / +3,79 m sobre el pretil;
- recortes: 0 px en los ocho paneles;
- luz: el incendio ilumina su propio piso y el paño de alrededor, de día y de noche, sin agujero blanco.

No se pidió "más llamas ni más humo" y no es lo que hay: el número de lenguas declaradas sube (5 → 16/19) pero
la superficie cálida visible apenas cambia; lo que cambia es la jerarquía dentro del fuego.

## Pendiente explícito

- **Revisión visual humana.** Nada de esto está en `blender_artist/output/` ni en el runtime; los sprites
  aprobados del catálogo siguen dibujando el incendio viejo.
- La luz de fuego es **offline**: vive en el render de Blender. En el navegador la tendrán que hacer FASE 4
  (partículas y anclaje a `fireAnchors`) y FASE 5 (presets de exposición/bloom), y allí sí rige el presupuesto de
  rendimiento.
- FASE 3 no toca el laboratorio Phaser: no se han duplicado llamas ni humo en tiempo de juego.
