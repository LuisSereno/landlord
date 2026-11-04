# V.f Building Composer Spike — Acta Final (REWORK cerrado + revisión humana)

Fecha: 2026-11-04
Rama: `wip/vf-building-composer-spike`
HEAD al momento de la revisión humana: `b288069d` ("se sube todo"; el commit de cierre documental de
esta acta lo sucede). El HEAD documentado en la primera versión del acta era `29588db`; se corrige aquí.
Baseline de la rama: `wip/ve-integrated-correction@39640cf` (incorporado `8d1da1c` vía R8)
Estado: **V.f BUILDING COMPOSER SPIKE — DONE** (aprobado por el responsable en §15 tras revisión humana)

> Distinción explícita del responsable: **Building Composer: aprobado.** **Integración visual real
> dentro del juego (Phaser): todavía por demostrar.** §28 generó un montaje Blender, no el edificio
> ejecutándose en el tejido urbano V.d. Ese test in-game es el siguiente paso, fuera del alcance de V.f.

## 1. Alcance de esta acta

Esta acta cierra el REWORK declarado por el responsable el 2026-11-04 sobre el estado `c1a635b`.
El compositor se conservó (arquitectura, PRNG, procedencia, determinismo estructural); el arte y la
publicación de evidencia se corrigieron en capas R1→R9, y luego se arreglaron dos defectos técnicos
de geometría (§15/§17) y un defecto de determinismo de sprite (§8) que bloqueaban el 12/12.

## 2. Commits del REWORK (en orden)

| Commit | Capa | Qué hace |
|---|---|---|
| `b8ab354` | fix | Bug de píxel transparente: un proceso Blender por candidato |
| `c1a635b` | evidencia | Evidencia parcial pre-REWORK (10/12) |
| `c3a9e85` | R1 | Publicación atómica vía `attempts/<runId>/` + promotion |
| `665aa1a` | R2 | Separar world/night mood de architectural readability |
| `875ac10` | R3 | Invariantes semánticas por familia en el compositor |
| `9ad5209` | R4 | Chimeneas industriales sólo en `industrial_heavy` |
| `d1c1d45` | R5 | Gramática row_house curada a arquetipos domésticos |
| `45ab009` | R6 | cement_plant secondary obligatorio |
| `9d24284` | R7 | Separar determinismo de output final de estabilidad de sombra |
| `44ac92c` | R8 | Merge `wip/ve-integrated-correction` (`8d1da1c`) |
| `54eb6bb` | R3+ | town_hall acepta curtain_wall como acceso cívico |
| `c2c0fee` | R9 | Ajustes gramaticales a footprints reales del dominio |
| `845764e` | fix §17 | Bounds de soporte caja = position±size/2 |
| `b301b96` | fix §15 | Triángulos de conducto = 4·segments-4 |
| `719a4b2` | test | Regression §15/§17 sobre geometría declarada |
| `5a52251` | fix §8 | Recorte determinista + contrato de jitter GPU honesto |
| `8e93dc8` | fix checker | §32 meshObjects con soportes; §7 no lee prohibiciones |
| `29588db` | V.f.5 | Evidencia §27/§28/§29 |

## 3. Inventario de módulos, fuentes y StyleProfile

- Inventario V.f.0: 517 ficheros inspeccionados con Blender; 497 `whole_asset_only`; la modularidad
  útil de Quaternius está a nivel de fichero. 37 paneles de fachada, 31 esquinas, cornisas, cubiertas,
  puertas y módulos de 2/4 m. Catálogo final: 113 módulos, 113 fuentes.
- Fuentes por familia (colocada real, `licensedGeometryRatio`):
  - row_house: `quaternius_downtown_city_megakit` (100 %).
  - cement_plant: `kenney_city_industrial` + `quaternius_downtown_city_megakit` (0.996–1.0).
  - town_hall: `kaykit_city_builder_bits` + `quaternius_downtown_city_megakit` (+ kenney commercial/
    industrial según variante) (100 %).
- StyleProfile `graphic_civic_buildings_v1` regenerado tras R2/R4: brick value subió de 0.227 → 0.541
  (floor arquitectónico R2), `externalTreatment` v6 → v7.

## 4. Arquitectura del compositor (conservada)

`compose.py` decide composición sin `bpy` → `scene.py` materializa en Blender. PRNG explícito y
estable, `compositionSignature`, procedencia módulo/fuente/licencia, footprint validado contra el
dominio, assets runtime no modificados. Invariantes semánticas R3 por familia; recorte determinista
R8 sobre bounds proyectados.

## 5. Gramáticas por familia (tras R3–R6)

- row_house: roofOptions sólo gables (sin flat_slab); accessOptions sólo centre_door (sin shopfront);
  propOptions vacío (sin chimenea industrial); secondaryOptions sólo none. Invariante: requiere
  door+doorframe, cubierta residencial, prohíbe chimney industrial y shopfront.
- cement_plant: secondary con maquinaria (silo/tanque/chimenea/depósito) obligatorio o, si el massing
  llena la parcela, la nave (`hall`/`block`) aporta identidad mínima. Invariante: ≥1 rol industrial.
- town_hall: acceso monumental (door/curtain_wall/access) + lenguaje cívico (column/pilaster/
  civic_tower/civic_block/plinth/water_tower).

## 6. Tabla de 12 candidatos (attempt runId 2026-11-04T1257)

| Type | Variant | Signature | Sources | Footprint | Tech QA | Visual status |
|---|---|---|---|---|---|---|
| row_house | 1000 | 342700bc8929 | quaternius_megakit | 4×1 | PASS | READY_FOR_HUMAN_REVIEW |
| row_house | 1001 | 1249437b120e | quaternius_megakit | 4×1 | PASS | READY_FOR_HUMAN_REVIEW |
| row_house | 1002 | 58b584267bf0 | quaternius_megakit | 4×1 | PASS | READY_FOR_HUMAN_REVIEW |
| row_house | 1003 | 2bce93262aad | quaternius_megakit | 4×1 | PASS | READY_FOR_HUMAN_REVIEW |
| cement_plant | 1000 | 0dcc929f21d1 | kenney_industrial,quaternius_megakit | 5×2 | PASS | READY_FOR_HUMAN_REVIEW |
| cement_plant | 1001 | 05fa2c2e25a7 | kenney_industrial,quaternius_megakit | 5×2 | PASS | READY_FOR_HUMAN_REVIEW |
| cement_plant | 1002 | 1e015e5ff01b | kenney_industrial,quaternius_megakit | 5×2 | PASS | READY_FOR_HUMAN_REVIEW |
| cement_plant | 1003 | 23e2dc3d1ad8 | kenney_industrial,quaternius_megakit | 5×2 | PASS | READY_FOR_HUMAN_REVIEW |
| town_hall | 1000 | 5db2aea1e8a3 | kaykit_bits,quaternius_megakit | 4×3 | PASS | READY_FOR_HUMAN_REVIEW |
| town_hall | 1001 | ecf5f6689fa0 | kaykit_bits,kenney_commercial,kenney_industrial,quaternius_megakit | 4×3 | PASS | READY_FOR_HUMAN_REVIEW |
| town_hall | 1002 | 363529f557e7 | kaykit_bits,kenney_industrial,quaternius_megakit | 4×3 | PASS | READY_FOR_HUMAN_REVIEW |
| town_hall | 1003 | 8ddc1a7d137f | kaykit_bits,kenney_commercial,quaternius_megakit | 4×3 | PASS | READY_FOR_HUMAN_REVIEW |

12/12 renderizados, 12 firmas únicas. `Visual status` = READY_FOR_HUMAN_REVIEW (el responsable no
ha aprobado ninguna variante explícitamente en sesión; no se marca APPROVED).

## 7. Defectos encontrados en cement_plant_1002/1003 y su corrección

- **§17 bounds (1002)**: `x.max` escena 9.000 ≠ composición 8.900. Causa raíz: `_box(x0,y0,x1,y1,z0,z1)`
  recibía los argumentos del soporte caja en orden `(xmin,ymin,zmin,xmax,ymax,zmax)`; el mínimo Z caía
  en la ranura del máximo X, produciendo una caja declarada cruzada/degenerada (x=[7.0,0.0]) que hacía
  que la unión perdiera el x.max real del soporte. Corrección (`845764e`): reordenar los argumentos a
  la firma real. Semántica canónica: bounds de soporte caja = position±size/2 por eje, min<max.
- **§15 triángulos (1003)**: escena 7143 ≠ composición 7147 (Δ=4). Causa raíz: un conducto se declaraba
  con `4·segments`, pero un cilindro NGON de Blender triangula en `4·segments-4` (2·segments laterales +
  2·(segments-2) tapas). La bajante del depósito (segments=8) declaraba 32, la escena medía 28.
  Corrección (`b301b96`): `4·segments-4`. Regression test (`719a4b2`) fija ambas magnitudes a nivel de
  datos, sin render; demostrado que falla con los bugs reintroducidos.

## 8. Determinismo (R7/§8)

Medido con doble render en procesos separados, un defecto adicional de fase:

- **Dimensiones/pivot no reproducibles**: `trim_and_scale` recortaba por el bounding box del alpha
  renderizado; la cobertura AA de EEVEE Next jittera ±1 LSB y la corrección de paridad lo amplifica a
  ±2, cambiando width/height y pivot. Corrección (`5a52251`): `deterministic_crop_rect` proyecta los
  bounds del edificio ∪ su sombra y da una caja determinista. Resultado: dims/pivot/alpha byte-idénticos.
- **Raster no byte-idéntico (irreducible)**: demostrado que la sombra de EEVEE Next cambia de sha incluso
  con sombras duras y shadow_step_count=1, y el albedo jittera a 1 muestra. Byte-identidad del PNG es
  inalcanzable en este entorno GPU. Contrato honesto: gate DURO en determinismo estructural (firma+pivot+
  dims+alpha) y cota MEDIDA para el raster (meanAbsDiff<4/255, grossFraction<2% de píxeles >16 LSB).

Resultado §8 (seed 1000 por familia, dos procesos):

| Familia | status | compositionDeterministic | meanAbsDiff | shadow bit-estable |
|---|---|---|---|---|
| row_house | COMPOSITION_DETERMINISTIC_GPU_JITTER | true | 0.0 | false |
| cement_plant | COMPOSITION_DETERMINISTIC_GPU_JITTER | true | 0.0 | true |
| town_hall | COMPOSITION_DETERMINISTIC_GPU_JITTER | true | 0.0 | true |

## 9. Promoción atómica (R1/§7)

Verificado con fallo inyectado (gramática temporal que exigía un rol imposible a town_hall): la corrida
abortó con EXIT=1 y el directorio de evidencia previa quedó byte-idéntico (hash y nº de ficheros
inalterados). La promoción sólo ocurre tras 12/12; `attempts/<runId>/` no se versiona.

## 10. Runtime hashes before/after (§26)

- `runtime-assets.json`: `a0095574bf9f22ff…` → `a0095574bf9f22ff…` (igual).
- `runtime-assets-blender.json`: `5dbfe22a4a25247b…` → `5dbfe22a4a25247b…` (igual).

Nada se promovió al bundle durante el spike.

## 11. Métricas

- 12/12 candidatos, 12 firmas únicas.
- Triángulos: 2506–18848. RenderTime: 8.2–23.4 s. Peak RSS: 6561 MB. Total corrida: ~1100 s.

## 12. Screenshots / evidencia

- §27 contact sheets: `docs/art/golden/vf-building-composer/{row_house,cement_plant,town_hall}-contact-sheet.png`
- §28 urban context: `docs/art/golden/vf-building-composer/context/*` (9 renders, 3 zooms × 3 familias)
- §29 golden: `docs/art/golden/vf-building-composer/` (10 imágenes: 6 contact/context + scale-comparison
  + material-comparison + 1280x720 + 1920x1080)
- candidatos: `docs/art/building-composer/candidates/vf_*.png|json` + `manifest.json` + `regenerate/`

## 13. P0 / P1 / P2

- **P0**: ninguno abierto.
- **P1 (cerrados en este REWORK)**: publicación atómica (R1); legibilidad de fachada (R2); invariantes
  semánticos (R3); chimenea industrial en residencial (R4); gramática row_house (R5); cement_plant sin
  identidad (R6); determinismo honesto (R7); baseline integrado (R8); §15/§17 geometría de soportes;
  §8 dims/pivot reproducibles.
- **P2 (limitaciones que permanecen)**:
  - El raster no es byte-idéntico entre procesos (jitter GPU de EEVEE Next, ±1 LSB / sombra). Aceptado y
    acotado; no es un defecto del compositor. Byte-identidad exigiría cambiar de rasterizador.
  - Un proceso Blender por candidato (aislamiento del state leak de transparencia). Correcto pero caro
    (~90 s y pico 6.5 GB por candidato). El state leak subyacente de EEVEE/Blender no se ha resuelto.
  - `attempts/` se borra tras promoción salvo `--keepAttempts`; una corrida fallida deja diagnóstico pero
    no evidencia.

## 14. Recomendación

El Building Composer cumple su gate: 12/12 reproducibles, procedencia íntegra, identidad visual por
familia, determinismo estructural byte-idéntico, publicación atómica. El responsable ha realizado la
revisión visual humana (§15) y **escalaría el sistema a los 15 edificios de dominio**. La siguiente
etapa no es otra ronda de este spike, sino **integrar una selección de candidatos en el juego real**
(Phaser, dentro del tejido urbano V.d) para el test in-game que §28 todavía no ejecuta.

## 15. Revisión humana (responsable, 2026-11-04)

El responsable revisó las 12 variantes sobre §27/§28/§29 y las clasificó. Esto sustituye la nota de
"No se aprueba ninguna variante" de la primera versión del acta: **la aprobación la otorga el humano,
no el agente.** Criterio de aceptación §31: ≥2/4 variantes visualmente aceptables por familia → CUMPLIDO.

| Familia | Variante | Valoración humana |
|---|---|---|
| row_house | 1000 | PASS |
| row_house | 1001 | PASS |
| row_house | 1002 | PASS |
| row_house | 1003 | REWORK futuro (muro demasiado ciego; parece almacén residencializado) |
| cement_plant | 1000 | ACEPTABLE |
| cement_plant | 1001 | PASS |
| cement_plant | 1002 | ACEPTABLE (chimenea exenta demasiado aislada, composición fragmentada) |
| cement_plant | 1003 | PASS |
| town_hall | 1000 | PASS |
| town_hall | 1001 | REWORK futuro |
| town_hall | 1002 | PASS con reservas |
| town_hall | 1003 | REWORK futuro |

**Variantes seleccionables para producción:** `row_house 1000/1001/1002`, `cement_plant 1001/1003`,
`town_hall 1000/1002`.

Observación semántica del responsable para el escalado (no reabre V.f): el `water_tower` admitido como
lenguaje cívico en town_hall produce la asociación contraria (utility industrial sobre edificio
institucional). Retirar `water_tower` del vocabulario de identidad de `civic_landmark` al escalar.

## 16. Salvedades formales registradas en el cierre

- **§27**: la especificación pide `procedural | source evidence | v1 | v2 | v3 | v4`. Las contact sheets
  actuales son `procedural | v1 | v2 | v3 | v4`: falta la columna independiente de *source evidence*.
  No se repite V.f (la mejora ya se verificó comparando con los renders directos D-098), pero §27 no
  coincide al 100 % con la especificación. Queda como deuda menor.
- **§28**: se titula "QA in-game". Lo generado es un montaje Blender (`build_building_composer_context.py`),
  útil pero NO el edificio ejecutándose en Phaser. La integración visual real queda por demostrar.
- **Integridad de fuentes `archived`**: `validate-art-staging.mjs` para fuentes archivadas comprueba que
  `extractDir` existe y no está vacío, pero no demuestra que el contenido extraído siga siendo
  byte-equivalente al archive original. Es una relajación real del control de integridad; se trata por
  separado, fuera de V.f.
- **CI**: no hay checks de GitHub asociados al HEAD actual; los verdes documentados son ejecuciones
  locales del agente, no una corrida CI remota independiente.
- **Scope de commits**: `b288069d` ("se sube todo") agrupa los cambios de `staging-sources`/
  `license-allowlist`/`validate-art-staging` (repo cleanup de otra sesión) en un commit separado de los
  de V.f; se dejan conceptualmente fuera del cierre del compositor.
