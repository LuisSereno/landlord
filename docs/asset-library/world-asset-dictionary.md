# World Asset Dictionary (V.h.10 · §28)

Diccionario del vocabulario del World Asset Knowledge Base. La fuente de verdad es
`blender_artist/manifests/world-asset-index.json`; los `world-catalogs/*-assets.json` son vistas
generadas. Los nombres de archivo sirven sólo para el bootstrap de clasificación, **no** son el
contrato del juego (§4): el contrato son `assetId`, `category`, `semanticRoles`, `contexts`,
`vehicleClass`/`actorClass`/`animationClip`, `runtimeAssetId` y `runtimeReady`.

## Estados (§5)

| Estado | Significado |
|---|---|
| `indexed` | existe con procedencia, licencia y metadata técnica |
| `classified` | sabemos qué representa y dónde puede usarse (semanticRoles + contexts) |
| `runtime_ready` | hay pipeline/manifiesto/runtime ID que permite usarlo de verdad |

Un recurso puede quedar `classified` sin ser runtime-ready (§5): la reserva deliberada (materiales,
actores profesionales, piezas) permanece localizable sin saturar la escena.

## Categorías (§1/§6)

`architecture` (fachadas/techos/columnas/modillones para el Composer) · `building_mass` (volúmenes
de referencia Kenney/KayKit/megakit) · `urban_prop` (mobiliario y props urbanos) · `environment`
(vegetación, rocas, agua) · `infrastructure` (carreteras, vías, servicios) · `vehicle` · `actor` ·
`animation` · `material` · `ui` · `audio`.

## Campos clave

- `semanticRoles[]`: qué representa (p.ej. `monument`, `civic_landmark`, `emergency_vehicle`).
- `contexts[]`: dónde puede usarse (`plaza`, `clinic`, `industrial_logistics`, `road`…).
- `vehicleClass` (§15): `civilian|taxi|delivery|freight|garbage|police|fire|ambulance|construction|industrial|service`.
- `actorClass` (§16): `civilian|worker|maintenance|enforcer|service_worker|police|medical|firefighter`.
- `animationClip`: familia de clip (`idle|walk|run|sit|stand|…`).
- `placeable`: `true` sólo para vehículos/actores colocables; las **piezas** (ruedas, debris, karts,
  conos del Car Kit; pelo/cejas/cuerpo base de Quaternius) son `placeable:false` y rol
  `vehicle_part`/`actor_part` (§8: no promover piezas al vocabulario colocable).
- `runtimeAssetId`: el ID runtime estable en el atlas (`veh_firetruck`, `prp_bench`, …) cuando el
  asset está horneado; vincula vocabulario ↔ sprite sin depender del nombre de archivo.
- `runtimeLayer`: `blender_sprite` si runtime-ready, `none` en caso contrario.

## Taxonomías declaradas vs pobladas

- `vehicleClasses` (11 declaradas): 9 pobladas runtime-ready en v1
  (civilian, taxi, delivery, freight, garbage, police, fire, ambulance, construction).
  `industrial`/`service` declaradas sin miembro (gap P1, ver coverage).
- `actorClasses` (8 declaradas): 5 pobladas runtime-ready (V.h.11, avatares Rocketbox horneados con
  retarget de clips idle/walk): `civilian` (chr_citizen), `police` (chr_police), `medical`
  (chr_medical), `firefighter` (chr_firefighter), `worker` (chr_worker). Faltan `maintenance`,
  `enforcer`, `service_worker`. El rol profesional es por colocación (avatar stationed en su
  edificio), no uniforme literal: Rocketbox no codifica profesión por nombre.

## Overrides curados (§7)

`CURATED_OVERRIDES` en `build_world_asset_index.py` fija clasificación y metadata para los casos
importantes que la heurística de filename no resuelve (p.ej. `statue_obelisk.glb` →
`urban_prop/[monument,civic_landmark]/[plaza,civic_courtyard,park]`). La clasificación automática
(source + pack + filename + dimensiones medidas) cubre el resto; lo no medido queda `unmeasured`
con `runtimeReady=false` (provenance fail-closed, no se inventan medidas).

## Procedencia y licencia (§2/§3)

Todo asset declara `sourceId`, `sourcePath` y `license` (CC0-1.0 por defecto; MIT Rocketbox;
`original` para obra del proyecto). Los 10 zips autorizados CC0 pero **no adquiridos** no se
registran como activos (sin path/hash no hay registro válido): permanecen en cuarentena y se
listan en `world-asset-audit.md` como "autorizados pero no adquiridos".
