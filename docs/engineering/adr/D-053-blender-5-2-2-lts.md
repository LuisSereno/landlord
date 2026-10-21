# D-053 — Blender 5.2.2 LTS para toolchain artístico

Fecha: 2026-10-21.

Estado: aceptada.

## Contexto

La Art Pipeline Specification proponía Blender como DCC principal pero mantenía abierta la versión exacta. En el momento de cerrar esta decisión están mantenidas Blender 4.5 LTS y Blender 5.2 LTS.

El proyecto todavía no tiene una base histórica de scripts Blender, templates propios o cientos de ficheros .blend que obliguen a preservar compatibilidad con 4.5.

El propietario del proyecto ha instalado Blender 5.2.2 LTS.

## Decisión

Fijar:

```text
Blender 5.2.2 LTS
```

como versión exacta de preproducción del pipeline de arte.

Los scripts Python, templates, render headless y pruebas iniciales deben escribirse contra 5.2.2.

La rama 5.2 LTS tiene soporte oficial hasta julio de 2028.

Fuente oficial:
https://www.blender.org/releases/5-2/

## Razones

- es la LTS más reciente disponible para iniciar el pipeline;
- ofrece una ventana de soporte más larga que 4.5 para un pipeline nuevo;
- no existe deuda de compatibilidad previa;
- fijar una versión exacta reduce variaciones entre máquinas/CI;
- permite diseñar scripts directamente contra la API que realmente utilizará el proyecto.

## No decisión

Esto no significa:

- actualizar automáticamente al último Blender;
- utilizar toda novedad de 5.2;
- depender de features experimentales;
- convertir Geometry Nodes en requisito.

## Política de actualización

Una futura versión 5.2.x sólo puede sustituir 5.2.2 tras comprobar:

1. apertura de templates;
2. scripts Python;
3. render headless;
4. camera rig;
5. material library;
6. animation batch;
7. golden renders;
8. atlas output.

Cambiar de rama mayor/LTS requiere revisión explícita.

## Consecuencias

- `tools/versions.json` deberá declarar 5.2.2 cuando se implemente.
- CI de arte deberá ejecutar la misma versión o una imagen reproducible equivalente.
- La documentación que todavía mencione Blender 4.5 como baseline debe actualizarse.
- Los assets externos importados se normalizarán hacia el pipeline 5.2.2, no al revés.
