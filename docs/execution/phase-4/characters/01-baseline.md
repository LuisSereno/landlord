# WP-CHAR-01 · Auditoría de compatibilidad

Fecha: 2026-11-23. Estado: **baseline medido; fase en ejecución**.

> Esta auditoría no aprueba arte ni integra personajes en la escena. El trabajo se hace en un
> worktree independiente y deja intactos simulación, edificios, renderer principal y manifiestos
> runtime compartidos.

## 1. Repositorio y aislamiento

| Elemento | Valor medido |
| --- | --- |
| Repositorio original | `/home/luis/RepositorioGitHub/landlord` |
| Rama original | `wip/organization-headquarters` |
| HEAD original al iniciar | `0a6770d183d6fe09529a9eeebee5da2d1d0369a5` |
| Estado original | limpio |
| Worktree | `/home/luis/RepositorioGitHub/landlord-wp-char-01` |
| Rama de trabajo | `wip/wp-char-01-foundation` |
| SHA de partida | `0a6770d183d6fe09529a9eeebee5da2d1d0369a5` |
| Referencia remota citada por el encargo | `743aea4e04e7d89b39a6c4106c9be61171965d6c` |
| Relación con la referencia | ancestro del HEAD de partida; no se restauró ni retrocedió |

El original no recibió `checkout`, `reset`, `stash`, `pull`, `rebase` ni edición de archivos. El
worktree se creó desde el HEAD limpio porque contiene la implementación vigente de personajes y
sedes operativas. Staging y toolchain están ignorados por Git y no se copian al worktree.

## 2. Evidencia → hallazgo → consecuencia

| Evidencia | Hallazgo | Consecuencia para WP-CHAR-01 |
| --- | --- | --- |
| `character-factory.json` | 13 variantes; faltan sanitario; enforcers marcados `showcase/future`; `construction` y `maintenance` no son las especialidades literales del dominio | Reconciliar a 14 variantes y validar semántica, no sólo nombres |
| `actor-assets.json` | 122 entradas: 18 Rocketbox, 44 Quaternius y 60 Kenney; 5 runtime-ready | No confundir catálogo, candidato y sprite publicado |
| `runtime-assets-blender.json` + `pnpm art:blender:check` | 5 personajes Rocketbox con 4 direcciones, `idle`/`walk` y 2 poses por dirección; 263 imágenes/jobs verificados | Conservar el contrato y sus claves; no promocionar candidatos |
| `crew-presence.ts:208` | `CREW_CHARACTER = "chr_worker"` para todo miembro de cuadrilla | Supervisor, obrero y técnico comparten hoy apariencia |
| `IsometricSpikeScene.ts:2894` | La escena filtra distrito observado y `!agent.atBase` | El planificador debe repetir esa visibilidad sin modificar la escena |
| `projection.ts:634` | La proyección publica agentes del observado más los de la organización del jugador | El plan debe filtrar por distrito; no todos los publicados son dibujables |
| `domain.ts:521` | Las cuatro especialidades son `supervisor`, `construction_worker`, `maintenance_technician`, `enforcer` | No añadir profesiones públicas al dominio |
| `generate-visual-catalog.mjs:57` | El catálogo generado endurece `13/13` y `0/13` renderizados | Queda como dependencia posterior; este WP no modifica el generador ni su salida |

## 3. Roster operativo real

Cada una de las dos empresas inicia con 8 agentes: 2 supervisores, 4 obreros, 1 técnico de
mantenimiento y 1 enforcer. Son 16 agentes operativos entre jugador y rival. Las cuadrillas físicas
contienen un supervisor y dos obreros; técnico y enforcer no pertenecen necesariamente a una
cuadrilla (`district-profiles.ts:110`, `domain.ts:563`).

La proyección ya publica identidad, organización, especialidad, distrito, celda, siguiente celda,
salud, estado, `atBase` y `returningToBase`. No hace falta añadir campos al dominio para construir
una descripción visual.

## 4. Estado de las 14 variantes objetivo

| Variante canónica | Cantidad | Prioridad | Clase visual | Estado actual medido |
| --- | ---: | --- | --- | --- |
| Supervisor de obra | 1 | P0 | operativa | Declarada en factoría; sin sprite propio. En cuadrilla usa `chr_worker` |
| Obreros de construcción | 2 | P0 | operativa | Dos declaraciones Quaternius; un único sprite runtime genérico `chr_worker` |
| Técnico de mantenimiento | 1 | P0 | operativa | Declarado; sin sprite propio. Fuera de cuadrilla se representa con marcador |
| Matones / enforcers | 2 | P0 | operativa | Existen como agentes; la factoría los clasifica incorrectamente como futuros y no tienen sprite |
| Ciudadanos | 4 | P1 | ambiental | Cuatro declaraciones; `chr_citizen` es el único avatar runtime específico. `vecino_variante` es procedural legacy |
| Policía | 1 | P1 | contexto cívico | `chr_police` runtime; la ropa no identifica claramente el oficio |
| Bombero | 1 | P1 | contexto cívico | `chr_firefighter` runtime; la ropa no identifica claramente el oficio |
| Sanitario | 1 | P1 | contexto cívico | `chr_medical` runtime; falta como variante canónica de la factoría |
| Profesional municipal | 1 | P2 | contexto cívico | Declarado; sin sprite runtime |
| **Total** | **14** | | | La factoría actual sólo declara **13** |

Las profesiones públicas son visuales/contextuales. No se convierten en agentes operativos ni en
especialidades nuevas. Los inquilinos y la población siguen agregados.

## 5. Fuentes, candidatos y runtime-ready

### 5.1 Inventario catalogado

| Fuente | Entradas en catálogo | Runtime-ready | Uso permitido en esta fase |
| --- | ---: | ---: | --- |
| Microsoft Rocketbox | 18 | 5 | Fuente de los actores que aparecen en el juego; MIT |
| Quaternius Universal Base Characters | 44 | 0 | Referencia offline de proporciones/silueta; CC0-1.0 |
| Kenney Mini Characters | 60 | 0 | Comparación visual; CC0-1.0; no seleccionado para población |
| **Total actores** | **122** | **5** | Entradas, no 122 personajes únicos |
| Animaciones Rocketbox + Quaternius | 26 | 0 en el catálogo de clips | Los clips fuente no equivalen a clips horneados/validados |

El subconjunto local Rocketbox contiene 9 avatares adultos (18 FBX contando faciales) y 15 clips.
Quaternius contiene 2 cuerpos base y 8 peinados; no contiene ropa urbana completa, cascos ni
clipboards. Kenney contiene 43 GLB, de los cuales 20 son personajes con clips embebidos. Su prueba
previa a 256 px mostró silueta pequeña/oscura y proporciones distintas del control Rocketbox.

### 5.2 Procedencia del runtime actual

| Runtime | Avatar fuente | Idle | Walk | Licencia |
| --- | --- | --- | --- | --- |
| `chr_worker` | `Male_Adult_12` | `m_idle_neutral_02` | `m_walk_neutral_02` | MIT |
| `chr_citizen` | `Male_Adult_05` | `m_idle_breathe_01` | `m_walk_neutral_01` | MIT |
| `chr_police` | `Male_Adult_02` | `m_idle_neutral_01` | `m_walk_neutral_01` | MIT |
| `chr_firefighter` | `Male_Adult_09` | `m_idle_breathe_02` | `m_walk_neutral_02` | MIT |
| `chr_medical` | `Female_Adult_09` | `f_idle_breathe_01` | `f_walk_neutral_01` | MIT |

Las rutas relativas están en `asset-jobs.json:44-197`. Los 5 modelos y sus 10 clips existen en el
staging del original. Los 16 PNG por personaje existen en el worktree y el chequeo de integridad
confirma hashes y completitud.

### 5.3 Regla de procedencia

Para los personajes que aparezcan en el juego manda la restricción de proyecto: **Rocketbox es la
fuente runtime**. Quaternius puede seguir como referencia de diseño y experimento offline; Kenney
queda como comparación. Esta reconciliación no promueve automáticamente ninguna variante.

## 6. Animaciones

- Contrato runtime: 4 direcciones, `idle` y `walk`, 2 poses por dirección (8 frames por clip).
- Cadencia publicada: `idle` 400 ms/frame; `walk` 180 ms/frame.
- Candidatas no runtime: `work`, `repair`, `carry`, `inspect`, `sit`, `panic`, `sabotage_action`.
- El catálogo de animaciones lista 26 clips fuente y ninguno como runtime-ready: describe archivos
  fuente, no el resultado horneado.
- La escena actual conserva marcador para herido/muerto porque los clips no representan ese estado.

## 7. Dependencias del pipeline

| Componente | Papel | Alcance en este WP |
| --- | --- | --- |
| `scripts/validate-character-factory.mjs` | Valida el manifiesto declarativo | Autorizado actualizar |
| `scripts/build-blender-assets.mjs` | Itera `asset-jobs.json`, invoca Blender y ensambla bundle | Sólo lectura; protegido |
| `tools/art-pipeline/blender/runtime_asset.py` | Importa, retargetea, renderiza, recorta y escribe metadata | Sólo lectura; protegido |
| `blender_artist/manifests/asset-jobs.json` | Jobs runtime actuales | Protegido; no añadir jobs aquí |
| `apps/web/src/generated/runtime-assets-blender.json` | Contrato de sprites runtime | Protegido; no regenerar |
| `scripts/generate-visual-catalog.mjs` | Copia la factoría a un catálogo visual y endurece `/13` | Dependencia posterior; no modificar |
| `crew-presence.ts` | Puerta actual de cuadrillas | Protegido; el nuevo planificador no lo modifica |
| `IsometricSpikeScene.ts` | Integración Phaser | Protegido; integración diferida |

El worktree no contiene `blender_artist/staging/third_party/` ni `blender_artist/toolchain/`.
Están disponibles en el original y pueden leerse por ruta absoluta sin alterarlos. Blender medido:
**5.2.2 LTS**, build `d13f752e3b9c`, en el toolchain del original.

`runtime_asset.py:1067` exige que la fuente quede bajo su `REPO_ROOT` para escribir metadata. Una
herramienta nueva puede invocar la copia original del script con fuentes del original y salidas
absolutas dentro del worktree; no necesita editar el script ni copiar paquetes completos.

## 8. Limitaciones detectadas

1. No existe un supervisor de obra literal en el subconjunto Rocketbox instalado. Un avatar
   administrativo es una aproximación, no un capataz aprobado.
2. `Female_Adult_04` y `Female_Adult_13` disparan el guard de normalización R2 documentado; no se
   usarán para esta primera pasada sin autorizar trabajo de pipeline.
3. Las profesiones públicas runtime no tienen uniformidad suficientemente literal.
4. Técnico y enforcer no tienen sprites específicos; el marcador actual es un fallback, no arte
   terminado.
5. Los peatones ambientales no son agentes autoritativos ni ejecutan rutas del motor. Esta fase no
   crea población individual ni tráfico peatonal.
6. El catálogo visual generado contiene `13/13` y `0/13`; su actualización requiere modificar un
   generador compartido fuera de la superficie autorizada.
7. La integración Phaser necesita tocar la escena principal y probablemente el adapter; queda
   diferida hasta cerrar la fase de edificios.
8. Ningún prototipo se promociona a runtime ni se declara aprobado sin revisión visual humana.

## 9. Archivos protegidos

No se modifican: `packages/simulation/**`; `packages/shared/src/domain.ts`,
`projection.ts`, `assets.ts`; manifiestos `building-*.json`, `runtime-promotions.json`,
`asset-jobs.json`; `apps/web/src/generated/runtime-assets*.json`;
`apps/web/public/assets/runtime/blender/`; Building Composer y sus scripts;
`runtime_asset.py`; `IsometricSpikeScene.ts`; `gameplay-visual-adapter.ts`;
`crew-presence.ts`; `package.json`, `pnpm-lock.yaml`, configuración global de build,
`AGENTS.md`, `ai-context/DECISIONS.md` y `ai-context/PROJECT-STATE.md`.

Tampoco se regeneran assets, fixtures, snapshots ni capturas de edificios ni se cambian parámetros
globales de iluminación, cámara, escala o materiales del renderer.

## 10. Baseline de validación

| Comando | Resultado previo a la edición |
| --- | --- |
| `pnpm art:character-factory:validate` | PASS: 13/13 roles, 4 direcciones, `idle`/`walk`, 7 animaciones showcase |
| `pnpm art:blender:check` | PASS: 263 imágenes, 263 jobs, 22.594.162 bytes |
| `pnpm art:catalog:check` | PASS: catálogo generado coherente con el baseline histórico `13/13` |
| `pnpm typecheck` | PASS: los 4 workspaces |
| `pnpm test` | Resultado de control registrado antes del primer commit de código |

La validación de Character Factory actual sólo comprueba estructura básica y 13 nombres. No
comprueba especialidades, categoría operativo/ambient, procedencia runtime, hashes ni coherencia
entre `runtimeReady` y los sprites reales. Es uno de los objetivos de la Etapa B.
