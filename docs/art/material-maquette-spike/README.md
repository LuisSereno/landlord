# Spike de maqueta material — evidencia A/B

Estado: evidencia técnica generada; revisión visual humana y promoción pendientes.

## HUD y terreno

Cuatro capturas de la misma ciudad nueva, viewport 1440×900, zoom 1× y cámara sin desplazamiento.
El brazo cambia entre `graphic_civic` y `material_maquette_candidate`; los controles se activan sólo
con `?artQa=1`. El manifiesto registra SHA-256 y cámara.

| Momento | Control | Candidata |
| --- | --- | --- |
| Día | [captura](ab/day-graphic_civic.png) | [captura](ab/day-material_maquette_candidate.png) |
| Noche | [captura](ab/night-graphic_civic.png) | [captura](ab/night-material_maquette_candidate.png) |

La escena está vacía de edificios al iniciar una ciudad nueva; estas capturas aíslan terreno, HUD,
contraste y encuadre. No sirven como gate de fachadas.

## Building Composer

Primera generación histórica: tres salidas con Composer, seed 1010, mood `day_civic`, perfil
`graphic_civic_buildings_v1`, Blender 5.2.2 y orientación 0°. La tira compara cada propuesta con el
lote diurno histórico del mismo tipo.

| Tipo | PNG candidato | Firma de composición | SHA-256 | Módulos | Geometría licenciada |
| --- | --- | --- | --- | ---: | ---: |
| `row_house` | [PNG](candidates/mm_row_house_1010.png) | `05e6a6747525c4b7f74636d5d6250af7b33caaa173523e93036e90a53bcb4522` | `8f222ba7751755d6b730ef1aab751e5ae37fc580f256f54d22cf486b6c497bd7` | 9 | 100 % |
| `mixed_tenement` | [PNG](candidates/mm_mixed_tenement_1010.png) | `4276ccb5f7576f5b742f11833e1e30c0b0764dcc060f33cc6c6a60a6abdf43a6` | `9a63fb8d4a39bf16e95b9adac70800c2f82cd97a5433405eb4408ae750f81273` | 9 | 100 % |
| `warehouse` | [PNG](candidates/mm_warehouse_1010.png) | `0bd43b81777d34afaa51a0411a9d0bec06fd329f71f6b284b04e20c54434a68b` | `3d41aa997975e141dd40f5aca8dad53b4e250813a6e4a980a19672259e5af725` | 10 | 100 % |

[Tira de comparación](candidates/contact-sheet.png) · [manifiesto de muestras portable](candidates/samples.json) ·
[manifiesto Composer completo](candidates/manifest.json) · [métricas](candidates/metrics.json)

El lote conserva detalle por módulo, procedencia, hashes, huella, plantas, pivote y parámetros en los
JSON de cada candidato. El manifiesto confirma que los hashes de
`runtime-assets.json` y `runtime-assets-blender.json` son idénticos antes/después. Ningún candidato
está conectado al catálogo jugable.

## Experimentos controlados D-111

Se añadieron recetas corregidas: cuatro accesos repetidos para `row_house`, acceso comercial físico
con toldo obligatorio para `mixed_tenement`, y una sola nave longitudinal para `warehouse`, sin los
accesorios de cubierta que alteraban su lectura. La variante material usa esta misma composición,
semilla, orientación y cámara que el control.

| Evidencia | Resultado |
| --- | --- |
| [Control Graphic Civic](experiments/day-control-final/) | PNG y JSON por piloto |
| [Perfil PBR material](experiments/day-material-final/) | PNG y manifiestos con procedencia Poly Haven CC0 y hashes de cada textura |
| [Igualdad de geometría](experiments/geometry-ab.json) | 3/3 pilotos; misma huella, plantas, ejes, módulos, posiciones y transformaciones |
| [Prueba de Geometry Nodes](experiments/geometry-nodes/geometry-nodes-report.json) | 8/8 instancias en las mismas posiciones del control enlazado |
| [Evaluación Kenney Modular Buildings](experiments/kenney-modular-buildings-evaluation.json) | CC0 verificado; descartado para muelles porque sólo aporta puertas y módulos de escala peatonal |
| [Evaluación Quaternius Ultimate Buildings](experiments/quaternius-ultimate-buildings-evaluation.json) | Fuente CC0 identificada; la descarga oficial devolvió límite de cuota, así que queda sin evaluar y no se descarta |

El contexto urbano de 1280×720 combina los pilotos con calle, acera, árbol, personaje y coche. Todos
usan el mismo `orthoScale` por tipo y zoom; el informe verifica las 12 parejas de día/noche y 0,5×/1×.

| Iluminación | Control | Material |
| --- | --- | --- |
| Día | [capturas](experiments/context/control-day-final/) | [capturas](experiments/context/material-day-final/) |
| Noche | [capturas](experiments/context/control-night-final/) | [capturas](experiments/context/material-night-final/) |

[Informe de cámara A/B](experiments/context/context-ab.json)

El perfil material usa ladrillo rojo PBR para los pilotos residenciales y chapa corrugada para el
almacén; eleva EEVEE de 64 a 96 muestras y activa ray tracing. El informe registra licencia, hashes
de archivos fuente/mapas, resolución, triángulos, tiempos y bytes. Los recursos generados del runtime
conservan su hash antes/después. Geometry Nodes conserva la repetición determinista, pero su
preparación resultó más lenta que enlazar objetos y el render no demostró una mejora; no se integra al
Composer por ahora.

`warehouse` usa ahora un único volumen de bandas y cuatro huecos frontales de 2 m, alineados con la
misma fachada. Sigue pendiente una puerta enrollable grande para cerrar los huecos. La evaluación de
Kenney confirma que ese pack no resuelve esa carencia; Quaternius permanece candidato sin evaluar.
Los materiales y las recetas permanecen en el pipeline de evidencia, sin promoción al catálogo de
runtime.

Las capturas HUD/terreno están separadas de las capturas calle/pilotos: todavía falta combinarlas en
una ciudad poblada. La aprobación visual humana también sigue pendiente.

## Alcance que queda abierto

- Revisión humana de la dirección y de cada piloto dentro de la ciudad real.
- Comparación de edificios a 0,5×, 1×, 2× y 2,5×, día/noche, cuatro orientaciones y estados completos,
  obra, daño e incendio.
- No se midió aquí rendimiento de frame ni descarga/memoria de runtime: sólo constan el tiempo offline
  de Blender y hashes de recursos de runtime sin cambios. No se añadieron FX ni se modificó la
  materialización de sprites.
