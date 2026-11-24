# WP-CHAR-01B · Baseline visual y plan de producción

Fecha: 2026-11-24. Estado: **diagnóstico medido; producción aún no iniciada**.

> Trabajo exclusivo en `/home/luis/RepositorioGitHub/landlord-wp-char-01`. El repositorio
> original y el pipeline de edificios son de sólo lectura. No se promociona ningún personaje.

## 1. Repositorio y herramientas

| Elemento | Valor medido |
| --- | --- |
| Worktree | `/home/luis/RepositorioGitHub/landlord-wp-char-01` |
| Rama | `wip/wp-char-01-foundation` |
| SHA de partida | `745c5b0a8c80d5a78b492c6e6f07b266749a24d0` |
| Estado del worktree | limpio |
| Original | `0a6770d`, rama `wip/organization-headquarters`, limpio |
| Blender | 5.2.2 LTS, build `d13f752e3b9c` |
| Herramientas de imagen local | Pillow 10.2.0 |
| Node / pnpm | Node 24.19.0 / pnpm 12.11.2 |

La rama contiene los seis commits de WP-CHAR-01. No hay cambios locales ajenos que preservar.

## 2. Entregables anteriores reutilizables

- `character-factory.json`: 14 variantes y las seis operativas canónicas.
- `agent-visual-plan.ts` y sus 13 pruebas: no se modificarán.
- `render_phase1_candidates.mjs`: lote aislado, verificación de hashes, Blender en modo background,
  metadata por frame y salida fuera del runtime.
- `validate_phase1_candidates.py`: validación técnica de matriz, hashes, alfa, metadata y magenta.
- `compose_phase1_candidate_sheets.py`: láminas offline reproducibles con gamma y escala de juego.
- `candidates/`: 48 frames y tres láminas de WP-CHAR-01 se conservan como control histórico.
- `character-jobs-phase-1.json`: procedencia, clips y hashes de los tres prototipos anteriores.

La nueva producción usará `docs/art/characters/candidates/phase-1b/`; no sobrescribirá nada de
`candidates/`.

## 3. Diagnóstico visual de los tres prototipos

| Prototipo | Evidencia | Problema principal | Corrección |
| --- | --- | --- | --- |
| Supervisor | `Male_Adult_03`, chaqueta de oficina | Se lee como administrativo; sin casco/gorra ni documento | Chaqueta sobria, casco de obra y clipboard anclado |
| Obrero A | `Male_Adult_05`, idéntico a `chr_citizen` | Duplicación visual; sin casco ni herramienta | Cambiar a `Male_Adult_12`, añadir casco y cinturón de herramientas |
| Enforcer A | `Male_Adult_10`, chándal rojo | Ropa deportiva moderna y silueta poco industrial | Mute local a chaqueta oscura, gorra plana y volumen más sólido |

Problemas transversales medidos en WP-CHAR-01:

- El bake raw es demasiado oscuro; gamma 1,8 mejora la lectura y se conservará sólo en las láminas
  de comparación, no en los PNG fuente.
- `walk` frame 0 es prácticamente reposo; frame 1 introduce la zancada. Se comprobarán ambos hashes
  y poses, sin tocar reglas del motor.
- Las alturas importadas fueron 1,8072 m, 1,8124 m y 1,8313 m: escala coherente.
- El alfa toca el borde del lienzo en los 48 frames anteriores; el nuevo validador lo registrará y
  la revisión visual comprobará recortes.
- No hay aprobación artística previa que reutilizar.

## 4. Matriz de seis variantes operativas

Los IDs de Character Factory son los canónicos; los nombres de jobs de render llevan prefijo
`phase1b_` para no colisionar.

| ID canónico | Avatar base | Accesorios previstos | Ajuste local | Diferencia individual |
| --- | --- | --- | --- | --- |
| `supervisor` | `Male_Adult_03` | Casco de obra, clipboard | Chaqueta marrón/gris apagada | Capataz que supervisa, no administrativo |
| `construction_worker_a` | `Male_Adult_12` | Casco, cinturón de herramientas | Trabajo marrón/denim | Obrero A robusto y distinto de `chr_citizen` |
| `construction_worker_b` | `Male_Adult_09` | Gorra, bolsa de herramientas | Trabajo gris/marrón | Silueta y accesorio distintos del obrero A |
| `maintenance_technician` | `Male_Adult_02` | Gorra, bolsa y llave | Mono/mantenimiento azul gris u oliva | Técnico industrial, no obrero ni sanitario |
| `enforcer_male` | `Male_Adult_10` | Gorra plana, cuello/chaqueta reforzada | Carbón/marrón oscuro | Presencia intimidante sin armas |
| `enforcer_female` | `Female_Adult_09` | Abrigo corto pesado, sombrero de ala corta | Carbón/plum apagado | Segunda constitución y silueta de abrigo |

Se descartan `Female_Adult_04` y `Female_Adult_13` para esta pasada porque el guard R2 documentado
rechaza su normalización. `Female_Adult_09` sí importa limpio y aporta una segunda constitución sin
descargar recursos.

## 5. Recetas de animación y cámara

- Todos los personajes: 4 direcciones, `idle`/`walk`, frames 0 y 1.
- Avatares masculinos: clips `m_idle_*` y `m_walk_neutral_*` ya instalados, compatibles con `Bip01`.
- `Female_Adult_09`: `f_idle_breathe_01.max.fbx` y `f_walk_neutral_01.max.fbx`.
- Cámara del pipeline existente: ortográfica 1,7, `targetZ` 0,9, azimut base 45° + 90° por dirección.
- Render publicado: 256×256 con recorte del pipeline; fondo transparente.
- Escala de revisión: 28 px a 1×; láminas offline a 0,5×/1×/2×/2,5×.

## 6. Accesorios y materiales

Se implementará sólo una biblioteca pequeña:

- casco de trabajo estilizado;
- gorra plana de capataz/industrial;
- clipboard;
- cinturón de herramientas;
- bolsa de mantenimiento;
- llave de mano;
- cuello/abrigo reforzado para enforcer;
- sombrero de ala corta para enforcer B.

Geometría simple, materiales mates y pocos polígonos. Los accesorios deben parentarse a huesos
estables del armature; si el anclaje no es fiable, se descartan y se documenta. No se añadirán armas.
Los cambios de material serán locales a objetos/mallas del candidato, no ajustes globales de shaders
o iluminación.

## 7. Escala, materiales y contraste

- Referencia: personas de ~1,8 m; 1 celda ≈ 4 m.
- Paleta: marrón, gris, azul industrial, verde oliva, carbón y acentos ocres/apagados.
- Prohibido depender de rojo deportivo, alta visibilidad fluorescente o uniformes futuristas.
- La diferenciación debe venir de silueta, avatar, accesorio y vestuario; un recoloreo solo no cierra
  una variante.
- Las láminas aplicarán gamma 1,8 sólo para evaluar la lectura final; el bake y su hash permanecen
  intactos.

## 8. Diagnóstico inicial 13/14

- Character Factory real: **14** personajes, **6** operativos.
- Catálogo visual generado: **13** personajes y coverage `13/13` / `0/13`.
- Origen de la expectativa: `scripts/generate-visual-catalog.mjs:57-58`.
- Generador: `scripts/generate-visual-catalog.mjs:44-66`.
- Verificador: `art:catalog:check` compara el JSON serializado en `generate-visual-catalog.mjs:68-70`.
- Salida obsoleta: `apps/web/src/generated/visual-catalog.json:518-519`.
- Consumidor UI: `apps/web/src/VisualCatalog.tsx:148-165`.

El cambio mínimo diferido es derivar el denominador 14 y el conteo real de definiciones, manteniendo
`characterRenderedRoles` en 0 hasta que existan previews integrados. El parche exacto y la prueba
independiente se prepararán en la Etapa G; el generador y su salida no se tocan ahora.

## 9. Archivos protegidos

Siguen prohibidos `packages/simulation/**`, `packages/shared/**`, escena/adapter/crew/visual-scale,
manifiestos runtime, `asset-jobs.json`, manifiestos de edificios, promociones, `runtime_asset.py`,
Building Composer, generadores compartidos del catálogo, configuraciones globales, package/lockfile,
fixtures/tests de edificios y documentos centrales de estado/decisiones.

## 10. Criterio de esta etapa

La Etapa A queda completa cuando existe una receta principal para cada personaje, un único smoke
antes del lote y evidencia de que los archivos anteriores se conservan. No se renderizan 96 frames
antes de validar geometría, texturas, accesorios y cámara en una muestra.
