# WP-CHAR-02B · Cobertura Kenney de los 14 personajes

Fecha: 2026-11-24. Estado: **matriz completa; cuatro profesiones difíciles en smoke técnico**.

## 1. Criterios

- `DIRECT`: el modelo representa razonablemente el personaje sin cambios importantes.
- `MINOR_ADAPTATION`: materiales locales y/o accesorios rígidos razonables.
- `MESH_ADAPTATION`: requiere modificar geometría o vestuario skineado.
- `UNRESOLVED`: no existe solución viable demostrada.

La clasificación de una variante técnicamente construible no implica aprobación visual humana.

## 2. Matriz de cobertura

| Personaje | ID canónico | Modelo base | Cobertura | Modificación necesaria | Riesgo |
| --- | --- | --- | --- | --- | --- |
| Supervisor | `supervisor` | `character-male-e.glb` | MINOR_ADAPTATION | Materiales de supervisor sobre malla existente, casco diferenciador y clipboard | Medio |
| Obrero A | `construction_worker_a` | `character-worker.glb` | DIRECT | Ninguna esencial; receta 02A conservada | Bajo |
| Obrero B | `construction_worker_b` | `character-male-f.glb` | MINOR_ADAPTATION | Casco, paleta y herramienta; silueta distinta del obrero A | Medio |
| Técnico | `maintenance_technician` | `character-female-f.glb` | MINOR_ADAPTATION | Ajustar paleta y herramienta; verificar silueta femenina | Medio |
| Enforcer A | `enforcer_male` | `character-male-g.glb` | MINOR_ADAPTATION | Materiales oscuros, gorra y cinturón; sin abrigo rígido | Medio |
| Enforcer B | `enforcer_female` | `character-female-a.glb` | MESH_ADAPTATION | Retirar las dos pistolas integradas y crear chaqueta pesada skineada; no demostrada | Alto |
| Ciudadano A | `civilian_male_a` | `character-male-a.glb` | DIRECT | Ninguna esencial | Bajo |
| Ciudadano B | `civilian_male_b` | `character-male-d.glb` | DIRECT | Ninguna esencial; folder opcional | Bajo |
| Ciudadana A | `civilian_female_a` | `character-female-b.glb` | DIRECT | Ninguna esencial | Bajo |
| Ciudadana B | `civilian_female_b` | `character-female-c.glb` | DIRECT | Ninguna esencial | Bajo |
| Policía | `police` | `character-male-c.glb` | DIRECT | Insignia y cinturón menores; uniforme/gorra ya integrados | Bajo |
| Bombero | `firefighter` | `character-male-b.glb` | MESH_ADAPTATION | Materiales protectores y bandas sobre malla skineada, casco de bombero propio | Medio-alto |
| Sanitario | `medical_professional` | `character-female-e.glb` | DIRECT | Ninguna esencial; bolsa médica opcional | Bajo |
| Profesional municipal | `municipal_professional` | `character-female-d.glb` | DIRECT | Ninguna esencial; folder opcional | Bajo |

## 3. Conteos

| Cobertura | Cantidad |
| --- | ---: |
| DIRECT | 8 |
| MINOR_ADAPTATION | 4 |
| MESH_ADAPTATION | 2 |
| UNRESOLVED | 0 |

No hay profesiones declaradas resueltas por un simple cambio de color. Policía y sanitario usan
vestuario integrado real; supervisor, enforcer y bombero añaden silueta/material/accesorios propios.
Enforcer B sigue siendo el caso de mayor riesgo porque no se ha producido su chaqueta pesada.

## 4. Diferenciación de siluetas

- Obrero A: casco de obra y overol azul/ocre.
- Supervisor: base distinta, casco claro, chaleco/material ochre y clipboard.
- Enforcer A: gafas/barba, volumen ancho, paleta carbón y gorra.
- Policía: gorra de policía y uniforme azul integrados.
- Bombero: base neutral, casco de bombero con escudo/alerón, bandas reflectantes y guantes.
- Cuatro civiles: dos masculinos y dos femeninos con cuerpos, pelo y ropa distintos.
- Sanitario: bata clara.
- Municipal: traje formal femenino.

## 5. Límites

- El rig de siete huesos no permite gestos finos de trabajo, reparación o sabotaje; esos clips deberán
  evaluarse por separado.
- Enforcer B no tiene prototipo en esta fase y puede requerir malla skineada original.
- La matriz demuestra viabilidad de base, no calidad final de las 14 variantes.
- No se modifica Character Factory ni se promociona ningún personaje.
