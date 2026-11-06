# World Asset Audit (V.h.1)

Auditoría total del staging disponible. `discovered` = archivos bajo la fuente; `indexed` =
recursos visuales con procedencia+licencia; `classified` = con categoría/roles semánticos;
`runtime-ready` = ya promovidos a un pipeline runtime (catálogo de módulos). Los zips
`quarantined` cuyos archivos no están en disco no se registran como activos: sin path/hash no
hay trazabilidad válida, así que permanecen en cuarentena como *autorizados pero no adquiridos*.

| Source | Files discovered | Indexed | Classified | Runtime-ready | Excluded | Reason |
|---|---:|---:|---:|---:|---:|---|
| src_kaykit_city_builder_bits | 208 | 105 | 105 | 10 | 103 |  |
| src_kenney_car_kit | 259 | 204 | 204 | 9 | 55 |  |
| src_kenney_city_commercial | 219 | 173 | 173 | 7 | 46 |  |
| src_kenney_city_industrial | 201 | 159 | 159 | 21 | 42 |  |
| src_kenney_city_roads | 487 | 387 | 387 | 20 | 100 |  |
| src_kenney_city_suburban | 216 | 171 | 171 | 6 | 45 |  |
| src_kenney_nature_kit | 3618 | 2627 | 2627 | 19 | 991 |  |
| src_microsoft_rocketbox | 156 | 62 | 62 | 5 | 94 |  |
| src_polyhaven_materials | 30 | 23 | 23 | 0 | 7 |  |
| src_quaternius_animation_library | 9 | 7 | 7 | 0 | 2 |  |
| src_quaternius_animation_library_2 | 13 | 10 | 10 | 0 | 3 |  |
| src_quaternius_base_characters | 112 | 92 | 92 | 0 | 20 |  |
| src_quaternius_downtown_city_megakit | 691 | 534 | 534 | 101 | 157 |  |

## Quarantined autorizados pero no adquiridos

- `FBX-20261021T083555Z-1-001.zip` — autorizado CC0 por el responsable pero el archivo no está en staging; sin path/hash no hay registro válido (provenance fail-closed). Permanece en cuarentena hasta adquirirse.
- `Ultimate Nature Pack - Jun 2019-20261021T084100Z-1-001.zip` — autorizado CC0 por el responsable pero el archivo no está en staging; sin path/hash no hay registro válido (provenance fail-closed). Permanece en cuarentena hasta adquirirse.
- `aerial_asphalt_01_4k.blend.zip` — autorizado CC0 por el responsable pero el archivo no está en staging; sin path/hash no hay registro válido (provenance fail-closed). Permanece en cuarentena hasta adquirirse.
- `brick_pavement_4k.blend.zip` — autorizado CC0 por el responsable pero el archivo no está en staging; sin path/hash no hay registro válido (provenance fail-closed). Permanece en cuarentena hasta adquirirse.
- `pavement_03_4k.blend.zip` — autorizado CC0 por el responsable pero el archivo no está en staging; sin path/hash no hay registro válido (provenance fail-closed). Permanece en cuarentena hasta adquirirse.
- `red_brick_4k.blend.zip` — autorizado CC0 por el responsable pero el archivo no está en staging; sin path/hash no hay registro válido (provenance fail-closed). Permanece en cuarentena hasta adquirirse.
- `kenney_board-game-icons.zip` — autorizado CC0 por el responsable pero el archivo no está en staging; sin path/hash no hay registro válido (provenance fail-closed). Permanece en cuarentena hasta adquirirse.
- `kenney_game-icons.zip` — autorizado CC0 por el responsable pero el archivo no está en staging; sin path/hash no hay registro válido (provenance fail-closed). Permanece en cuarentena hasta adquirirse.
- `kenney_ui-audio.zip` — autorizado CC0 por el responsable pero el archivo no está en staging; sin path/hash no hay registro válido (provenance fail-closed). Permanece en cuarentena hasta adquirirse.
- `kenney_ui-pack.zip` — autorizado CC0 por el responsable pero el archivo no está en staging; sin path/hash no hay registro válido (provenance fail-closed). Permanece en cuarentena hasta adquirirse.

**Totales:** 4554 assets indexados · 198 runtime-ready · 10 quarantined sin adquirir.
