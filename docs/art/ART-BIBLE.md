# Art Bible — Landlord

> Versión: 0.1
>
> Estado: especificación de preproducción.
>
> Propósito: definir cómo debe verse Landlord, qué información visual debe poder leerse durante la partida y qué restricciones deben respetar los assets de mundo, personajes, UI y VFX.
>
> Gobernanza: este documento distingue entre decisiones ya aceptadas y baselines artísticos provisionales. Todo valor marcado como BASELINE debe validarse mediante el Visual Direction Spike antes de entrar en producción masiva.

---

## 1. Leyenda de estados

Cada regla o parámetro de este documento pertenece a uno de estos estados:

- **DECIDED** — respaldado por una decisión vigente del proyecto y tratado como fuente de verdad.
- **BASELINE** — valor de trabajo recomendado para preproducción; debe medirse o validarse visualmente antes de congelarse.
- **OPEN** — no resuelto; no debe provocar decisiones irreversibles.
- **FUTURE** — deliberadamente diferido a una fase posterior.

Si este documento entra en conflicto con `ai-context/DECISIONS.md`, prevalece la decisión aceptada más reciente.

---

## 2. Objetivo visual del producto

### 2.1 North Star

> **Una ciudad industrial viva, atractiva pero moralmente ambigua, representada como una maqueta cinematográfica isométrica en la que riqueza, deterioro, poder y crimen pueden leerse antes de abrir un panel.**

Landlord no busca reproducir el lenguaje visual exacto de ningún juego existente. Debe ser inmediatamente legible como juego de gestión y, al mismo tiempo, construir una identidad propia.

### 2.2 Preguntas que el arte debe responder

A simple vista, el jugador debería poder inferir:

- qué tipo de distrito está observando;
- qué edificios son residenciales, comerciales, industriales, cívicos o ilícitos;
- qué propiedades son propias, neutrales o controladas por rivales;
- si un edificio prospera, se deteriora, está en construcción o abandonado;
- si una zona es atractiva, insegura, congestionada, cara o políticamente conflictiva;
- qué personajes o vehículos son relevantes;
- dónde está la siguiente interacción útil.

### 2.3 No objetivos

Landlord no persigue:

- fotorrealismo urbano;
- cámara 3D completamente libre;
- densidad visual que obligue a pausar para comprender;
- pixel art como dirección principal;
- una UI que imite tecnológicamente a juegos de finales de los 90;
- reconstrucción histórica tan literal que limite la claridad sistémica;
- espectáculo visual a costa de la legibilidad de la simulación.

---

## 3. Pilares visuales

### 3.1 Legibilidad antes que detalle — DECIDED COMO PRINCIPIO

Un edificio debe poder identificarse por silueta y masa antes de que el jugador lea un cartel.

El detalle sólo aporta valor si:

- sobrevive a la distancia real de juego;
- ayuda a reconocer función, clase, material o estado;
- refuerza la identidad visual.

### 3.2 Historia sin documentalismo — BASELINE

El setting de trabajo propone una ciudad ficticia transatlántica inspirada aproximadamente en 1925–1940.

Vocabulario visual candidato:

- industria de ladrillo;
- hormigón temprano;
- piedra cívica;
- influencia Art Déco moderada;
- tranvías y automóviles tempranos;
- cultura de prensa y cartelería;
- almacenes, row houses, hoteles, talleres y edificios municipales.

Debe evocar una época sin reproducir literalmente una ciudad real.

### 3.3 Caricatura material — BASELINE

Las formas pueden exagerarse moderadamente, pero los materiales deben resultar convincentes.

Familias principales:

- ladrillo rojizo/marrón;
- yeso cálido;
- piedra tallada;
- acero pintado oscuro;
- latón;
- madera;
- asfalto;
- vidrio;
- hollín;
- papel envejecido y cartelería pintada.

### 3.4 La economía se ve — REGLA DE DISEÑO

El estado económico debe alterar visualmente la ciudad.

Ejemplos:

- prosperidad → fachadas más limpias, señalética mejor, iluminación, vegetación;
- presión económica → reparaciones baratas, ladrillo expuesto, desorden, humo, desgaste;
- vacancy → persianas/tablones, interiores oscuros, rótulos apagados;
- crecimiento especulativo → obra, andamios, suministros, actividad logística;
- deterioro → manchas, tejados parcheados, cristales rotos, basura, elementos ausentes.

### 3.5 Oscuridad con humor — REGLA DE TONO

La ciudad puede contener crimen, corrupción e desigualdad sin convertirse en un mundo monocromático y permanentemente deprimente.

El humor puede proceder de:

- timing de animación;
- reacciones de personajes;
- props;
- señalética original;
- exageración de silueta;
- pequeñas situaciones emergentes.

Nunca debe depender de copiar personajes o gags reconocibles de otras IP.

---

## 4. Marco de referencias

Las referencias sirven para extraer principios, no para copiar soluciones.

| Referencia | Principio útil | Qué evitar |
|---|---|---|
| Constructor / Mob Rule | siluetas fuertes, escenas isométricas bitmap legibles, personalidad | edificios, personajes, UI, iconos o trade dress reconocibles |
| Anno 1800 | riqueza material, modularidad arquitectónica, progreso social visible | presupuesto de detalle propio de 3D completo |
| SimCity 2000/3000/4 | capas urbanas legibles y estructura basada en tiles | convertir la baja resolución histórica en objetivo |
| Tropico | política/economía visibles mediante ciudad y personajes | identidad tropical concreta |
| Frostpunk | atmósfera y VFX como identidad de producto | oscuridad que oculte datos económicos |
| Prison Architect / RimWorld | forma antes que detalle, claridad sistémica | abstracción excesiva de assets premium |
| Two Point | exageración controlada, personajes claros | tono totalmente cartoon |
| Cities: Skylines | disciplina de assets, metadata y ecosistema de contenido | perseguir fotorrealismo 3D |
| Banished | coherencia de materiales y asentamiento orgánico | alcance de producción 3D demasiado caro |

### 4.1 Regla anti-copia — DECIDED

Landlord es una IP original.

No se deben recrear o calcar:

- edificios reconocibles de franquicias;
- personajes;
- mapas;
- layouts de interfaz;
- iconografía;
- logotipos;
- carteles;
- música;
- diálogos;
- poses;
- paletas/composiciones que actúen como trade dress.

Las capturas de referencia sirven únicamente para análisis comparativo.

---

## 5. Perspectiva y cámara

### 5.1 Representación — DECIDED

El mundo se presenta en **2.5D isométrico/dimétrico**.

### 5.2 Proyección — BASELINE

Propuesta inicial:

- proyección: ortográfica;
- azimut: ~45°;
- elevación: ~30° sobre el horizonte;
- roll: 0;
- relación proyectada de celda lógica: 2:1.

Los valores exactos se congelarán únicamente tras calibrar el Visual Direction Spike.

### 5.3 Grid visual — BASELINE

Referencia de trabajo:

```text
1 celda lógica
-> footprint proyectado de 128 x 64 px al zoom de referencia

master de render
-> equivalente 256 x 128 px por celda
```

La altura total del sprite no queda limitada por esas dimensiones.

### 5.4 Rotación — OPEN

Para Vertical Slice se asume inicialmente una cámara fija.

Consecuencias:

- un edificio necesita una sola vista canónica;
- personajes sí pueden requerir múltiples direcciones;
- sólo se generarán R0/R90/R180/R270 si gameplay o cámara lo justifican.

No producir cuatro vistas de cada edificio “por si acaso”.

---

## 6. Escala

### 6.1 Escala lógica y escala visual

Gameplay y apariencia deben ser coherentes, pero no idénticos.

Se permiten ajustes deliberados:

- puertas ligeramente sobredimensionadas;
- personajes algo mayores de lo estrictamente real;
- carreteras adaptadas a legibilidad;
- carteles reforzados visualmente.

### 6.2 Escala física — OPEN

Propuesta:

```text
1 unidad Blender = 1 metro
1 celda Landlord ≈ 4 x 4 metros
```

Debe validarse contra:

- tamaño de personajes;
- vehículos;
- row houses;
- edificios industriales;
- anchos de calle;
- densidad urbana.

Ningún artista debe “escalar a ojo” un asset individual para una captura concreta.

---

## 7. Lenguaje de formas

### 7.1 Residencial

Baja renta:

- fachadas estrechas;
- repetición vertical;
- reparaciones asimétricas;
- chimeneas y servicios visibles;
- cubierta simple;
- más clutter.

Clase media:

- ritmo de fachada claro;
- ventanas regulares;
- toldos;
- ladrillo limpio;
- ornamentación contenida.

Alta renta:

- mayor simetría;
- piedra/yeso decorado;
- latón;
- vidrio;
- accesos destacados;
- vegetación cuidada.

### 7.2 Comercial

La función debe leerse mediante volumen y fachada.

Ejemplos:

- hotel → masa vertical + entrada/marquesina;
- restaurante → fachada + toldos + señalética;
- oficina → repetición vertical de huecos;
- cine/teatro → marquesina o volumen frontal dominante;
- retail → planta baja visualmente abierta.

### 7.3 Industrial

Prioridades:

- masa horizontal;
- chimeneas, vents o rooftop equipment;
- carga/descarga;
- grandes puertas;
- depósitos, anexos;
- puntos previstos para humo/vapor.

### 7.4 Cívico

Debe comunicar institución y autoridad mediante:

- simetría;
- materiales pesados;
- escalinata/plinto;
- verticalidad;
- ornamentación controlada;
- entorno más ordenado.

---

## 8. Materiales

### 8.1 Biblioteca de materiales

Preferir familias reutilizables frente a texturas únicas por asset.

Ejemplo:

```text
mat_brick_red_01
mat_brick_dirty_01
mat_plaster_warm_01
mat_stone_light_01
mat_steel_painted_01
mat_brass_01
mat_asphalt_01
mat_wood_dark_01
mat_glass_smoked_01
```

### 8.2 Regla de legibilidad

A escala de juego:

- la masa importa más que el microdetalle;
- la agrupación de ventanas importa más que sus perfiles;
- el hollín y grandes manchas importan más que decals microscópicos;
- la separación de valor/color importa más que ruido de alta frecuencia.

---

## 9. Paleta

### 9.1 Tokens preliminares — BASELINE

| Token | Valor | Uso |
|---|---:|---|
| `coal` | `#25282A` | acero, tejados, neutro oscuro |
| `warm_plaster` | `#D6C4A1` | yeso/piedra clara |
| `brick` | `#8C503D` | vivienda e industria |
| `brass` | `#B08A50` | riqueza, señalética, acentos |
| `petrol` | `#315A5E` | industria/transporte |
| `olive` | `#696C52` | utilities/entorno |
| `paper` | `#E8DFC8` | documentos/UI |
| `danger` | `#A74339` | alerta/policía/pérdida |

No constituyen una paleta cerrada del mundo.

### 9.2 Jerarquía de valor

En zoom de referencia:

1. silueta interactiva;
2. selección/ownership;
3. categoría funcional;
4. estado/condición;
5. detalle superficial.

Una textura nunca debe competir con selección o feedback.

---

## 10. Iluminación y clima

### 10.1 Iluminación canónica — BASELINE

Propuesta:

- key fijo desde noroeste visual;
- sombras hacia sureste visual;
- fill ambiental suave;
- daylight neutro-cálido;
- AO discreto;
- evitar negros empastados;
- fondo transparente.

### 10.2 Día/noche — OPEN

No se asume un sol físico móvil en v0.1.

Si se necesita noche:

- grading;
- variantes de ventanas/emissive;
- overlays;
- VFX;
- estados precomputados.

Un ciclo solar completo requerirá una decisión específica.

### 10.3 Clima

Candidatos:

- lluvia;
- niebla;
- neblina industrial;
- reflejo en asfalto;
- variaciones de humo.

El clima debe reforzar identidad sin ocultar información.

---

## 11. Terreno, parcelas y carreteras

### 11.1 Separación visual/lógica — REGLA

Nunca derivar colisión u ocupación de la transparencia de un sprite.

```text
visual tile != logical cell
```

La lógica debe definir:

- walkable;
- buildable;
- road;
- terrain;
- district;
- occupancy;
- zoning;
- ownership.

### 11.2 Familias iniciales

- grass;
- dirt;
- mud;
- asphalt;
- pavement;
- industrial ground;
- water.

### 11.3 Carreteras

Composición modular:

```text
base
+ road surface
+ curb
+ markings
+ decals
+ props
```

Evitar un bitmap exclusivo por combinación de calle.

---

## 12. Edificios

### 12.1 Estados mínimos candidatos

```text
planned
foundation
construction_50
complete
damaged
```

Opcionales:

```text
abandoned
upgraded_1
upgraded_2
```

### 12.2 Escala de condición

```text
pristine
used
neglected
damaged
abandoned
```

No todos requieren una malla distinta.

Usar combinaciones de:

- material swaps;
- decals;
- props ausentes/rotos;
- huecos tapiados;
- iluminación;
- vegetación;
- humo/polvo;
- señalética.

### 12.3 Prueba de silueta

Un edificio supera revisión si su categoría general puede distinguirse a 50–75% de zoom sin leer carteles.

### 12.4 Señalética

La señalética refuerza función, nunca debe ser el único identificador.

Evitar texto localizado bakeado.

---

## 13. Personajes

### 13.1 Estilo — BASELINE

Proporción moderadamente estilizada.

Objetivos:

- ocupación/arquetipo visible;
- pose clara;
- props importantes sobredimensionados cuando ayuden;
- facing reconocible;
- contraste de ropa controlado.

### 13.2 Direcciones — BASELINE

```text
N  NE  E  SE  S  SW  W  NW
```

No asumir mirroring seguro.

Flag opcional:

```json
{
  "mirrorSafe": true
}
```

### 13.3 Presupuesto de animación — BASELINE

| Clip | Frames | FPS | Loop |
|---|---:|---:|---|
| idle | 6–8 | 6 | sí |
| walk | 8 | 10–12 | sí |
| carry | 8 | 10–12 | sí |
| work | 10–16 | 10–12 | sí |
| talk | 6–10 | 8 | sí |
| interact | 8–12 | 10 | no |
| injured | 4–8 | 6 | según caso |

Son presupuestos de producción, no limitaciones del motor.

### 13.4 Modularidad

Preferencia offline:

```text
base rig
+ body preset
+ clothing preset
+ hair preset
+ palette preset
-> batch render
-> final sprite
```

Runtime layering sólo para necesidades específicas:

- objeto transportado;
- selección;
- accesorio puntual;
- marcador de facción;
- estado temporal.

---

## 14. Vehículos y props móviles

Prioridades:

1. silueta;
2. clase;
3. identidad de servicio/facción;
4. condición;
5. trim fino.

Animar sólo lo necesario:

- rodadura;
- orientación;
- exhaust;
- luces;
- carga/descarga.

---

## 15. VFX

### 15.1 Prioridad

```text
1. información
2. feedback
3. atmósfera
4. espectáculo
```

### 15.2 VFX sprite

- polvo de obra;
- humo;
- chispas;
- vapor;
- fuego;
- hojas/papel;
- salpicaduras;
- explosiones pequeñas.

### 15.3 Feedback runtime/procedural

- selection ring;
- placement footprint;
- zoning;
- ownership;
- influence;
- rutas;
- máscaras de área;
- flechas.

Evitar capas de transparencias grandes que oculten gameplay.

---

## 16. Overlays y legibilidad sistémica

Familias principales:

- ownership;
- property value;
- rent;
- zoning;
- accessibility;
- crime/heat;
- political influence;
- service coverage;
- demand;
- pollution/industrial pressure.

Reglas:

- siempre existe estado OFF;
- no depender sólo de rojo/verde;
- selección visible sobre overlay;
- leyenda estable;
- evitar conflicto con colores de facciones.

---

## 17. Lenguaje visual de UI

### 17.1 Tecnología — DECIDED POR ARQUITECTURA

HUD, paneles, tablas y pantallas complejas se implementan en React/DOM.

Las entidades del mundo permanecen en Phaser.

### 17.2 Tema visual — BASELINE

Combinar:

- papel/documento;
- metal/latón;
- prensa;
- jerarquía informativa moderna.

Evitar una interfaz “disfrazada” que perjudique datos.

### 17.3 Tipografía

Roles:

```text
display
-> branding/títulos puntuales

ui sans
-> texto operativo

tabular numeric
-> finanzas/estadísticas
```

Familias exactas: OPEN hasta revisar licencia/localización.

### 17.4 Localización

No bakear texto operativo cuando pueda ser DOM/SVG.

Soportar:

- expansión;
- wrapping;
- pseudo-localización;
- formatos numéricos;
- futura prueba RTL.

---

## 18. Accesibilidad

Baseline: WCAG 2.2 AA para UI DOM donde aplique.

Reglas:

- no comunicar estado sólo por color;
- combinar ownership con outline/pattern/icon cuando sea necesario;
- positivo/negativo = signo + icono + color;
- revisar protanopia, deuteranopia, tritanopia y grayscale;
- focus visible;
- evitar targets minúsculos;
- UI operativa usable con zoom textual al 200%.

---

## 19. Zoom y Visual LOD

### 19.1 Zooms de evaluación

```text
50%
75%
100%
150%
200%
```

### 19.2 Capas

```text
NEAR
- sprite high resolution
- props
- personajes animados
- VFX completos

MID
- misma familia / mip chain
- menos VFX menores

FAR
- resolución reducida si es necesario
- menos personajes
- señalética/props menores ocultos

MAP
- abstracción de distrito
- iconos / bloques / heatmaps
```

Visual LOD y Simulation LOD son sistemas distintos aunque puedan coordinarse.

---

## 20. Presupuesto de densidad y legibilidad

Una escena falla aunque cada asset sea bueno si:

- las siluetas se fusionan;
- señalética compite con selección;
- VFX oculta calles/parcelas;
- personajes desaparecen contra terreno;
- ownership no se lee;
- no se reconoce la clase del distrito;
- todos los edificios usan el mismo rango de valores.

El Art Lab debe incluir escenas densas.

---

## 21. Audio relacionado con presentación

La Art Bible no gobierna todo el audio, pero sí la coherencia audiovisual.

Ejemplos candidatos:

- barrio de baja renta → reparaciones, tráfico viejo, perros, actividad densa;
- industrial → maquinaria, vapor, golpes;
- centro rico → tráfico más limpio, música interior, comercio;
- criminalidad alta → sirenas lejanas, discusiones, cristales.

Usar concurrencia/prioridad para evitar ruido constante.

---

## 22. Do / Don't

### Do

- identificar edificio por silueta;
- exagerar lo que comunica función;
- mostrar prosperidad/deterioro físicamente;
- reutilizar materiales;
- preservar selection/ownership;
- variar con props;
- probar escenas densas;
- mantener identidad ficticia;
- documentar excepciones.

### Don't

- copiar assets reconocibles;
- depender del cartel para identificar función;
- crear microdetalle invisible;
- ensuciar toda la escena por igual;
- usar rojo/verde como única señal;
- bakear texto que debe localizarse;
- ajustar cámara manualmente por asset;
- pulir un asset cuyo footprint no está aprobado;
- producir orientaciones innecesarias.

---

## 23. Golden scenes

Objetivo:

```text
golden_small_residential
golden_dense_commercial
golden_industrial
golden_construction
golden_crowd
golden_ui_economy
golden_ui_politics
```

Cada escena define:

- seed;
- cámara;
- zoom;
- viewport;
- DPR;
- versión de assets;
- screenshot esperado.

---

## 24. Criterio de cierre del Visual Direction Spike

La Art Bible pasa a estado production-ready cuando se comparan 2–3 direcciones originales con el mismo kit:

- edificio residencial;
- edificio industrial/comercial;
- carretera/acera/parcela;
- terreno;
- worker;
- civilian;
- vehículo/prop móvil;
- props/vegetación;
- construcción/daño;
- ownership/selection;
- overlay económico;
- panel HUD;
- familia de iconos;
- VFX atmosférico.

Criterios:

- legibilidad;
- identidad/IP distance;
- coste de producción;
- rendimiento web;
- variación modular;
- calidad percibida;
- facilidad para colaboradores;
- automatización;
- accesibilidad.

---

## 25. Decisiones abiertas antes de producción masiva

- estilo final;
- época exacta;
- elevación de cámara;
- dimensiones proyectadas de celda;
- escala física;
- resolución master;
- versión Blender;
- renderer;
- light rig;
- número de direcciones;
- animation budget;
- atlas baseline;
- formato runtime;
- tipografías;
- GPU compression;
- alcance de noche/clima.

Ver [OPEN-DECISIONS.md](OPEN-DECISIONS.md).

---

## 26. Definición de éxito

Una Art Bible útil permite a un nuevo artista responder sin depender del creador original:

- cómo debe verse Landlord;
- qué información tiene prioridad;
- qué puede variar;
- qué debe mantenerse consistente;
- cómo diferenciar inspiración de copia;
- cuándo un asset está listo para revisión.

La Art Bible define **qué** producir.

El Art Pipeline Specification define **cómo** producirlo de forma reproducible.
