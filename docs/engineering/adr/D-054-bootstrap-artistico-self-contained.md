# D-054 — Bootstrap artístico self-contained

Fecha: 2026-10-21.

Estado: aceptada para preproducción / Gate 2.

## Contexto

Landlord es un proyecto de presupuesto limitado y el propietario no dispone actualmente de un artista 2D/3D colaborador ni quiere convertir una contratación artística temprana en requisito para validar el juego.

La investigación artística mostró que el pipeline 3D -> prerender y la disponibilidad de librerías CC0 permiten desplazar gran parte del trabajo desde producción manual hacia composición, automatización y dirección visual.

## Decisión

El Visual Direction Spike y las primeras fases de Gate 2 se diseñarán para funcionar sin artista contratado como dependencia del camino crítico.

Prioridad:

```text
CC0 assets
+ Landlord Style Layer
+ Blender automation
+ Building Factory
+ Character Factory
+ IA para concept/reference
+ revisión del propietario
```

Objetivo de gasto artístico directo del spike:

```text
~0 EUR
```

## Librería bootstrap

El propietario ya ha descargado localmente una selección de:

- Quaternius;
- Kenney;
- Poly Haven.

Inventario:
`docs/art/BOOTSTRAP-ASSET-LIBRARY.md`.

## Building Factory

La variedad de edificios debe intentar proceder de:

- módulos;
- presets;
- materiales;
- props;
- parámetros;
- estados;
- scripts Blender;

antes de recurrir a modelado único para cada edificio.

## Character Factory

La variedad de personajes debe intentar proceder de:

- base rigs;
- cuerpos;
- hairstyles;
- clothing presets futuros;
- palettes;
- props;
- animation library;
- batch prerender;

antes de crear manualmente cada sprite.

## IA

La IA puede utilizarse para:

- concept art;
- moodboards;
- paintover/reference;
- exploración;
- señalética ficticia;
- UI ideation.

No se adopta como pipeline principal de PNG aleatorios para edificios/personajes core.

## Third-party assets

Aunque los recursos seleccionados sean CC0/permisivos, no se subirán automáticamente al repositorio.

Antes:
- política Git LFS;
- provenance;
- evidencia de licencia;
- estructura third-party;
- selección de qué sources son realmente necesarios.

## Consecuencias

Positivas:
- coste inicial mínimo;
- menos dependencia externa;
- mayor reproducibilidad;
- más fácil escalar mediante scripts;
- buena compatibilidad con colaboración futura.

Riesgos:
- aspecto genérico de asset pack;
- incoherencia entre proveedores;
- límites de variedad;
- coste técnico del generador;
- necesidad futura de polish humano.

Mitigación principal:
el Visual Direction Spike debe demostrar un Landlord Style Layer capaz de transformar y unificar la materia prima.

## Revisión

Reconsiderar la necesidad de artista especializado cuando:
- el Vertical Slice esté validado;
- exista una carencia visual concreta;
- el coste/beneficio de contratar sea medible.
