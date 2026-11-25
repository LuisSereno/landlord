# Building Catalog

Los 17 tipos económicos de dominio y el estado de su geometría de fuente REAL. Sustituye a la Building Factory de
V.e.2, retirada el 2026-11-02 por la remediación de geometría de fuente (D-098): aquella componía
primitivas propias mientras sus presets declaraban fuentes Kenney/Quaternius/KayKit/Poly Haven que
nunca entraban al render.

## Uso

```bash
pnpm art:building-catalog:validate   # catálogo ↔ asset-jobs: la fuente declarada debe importarse
pnpm art:building-evidence:render    # renderiza y publica la evidencia candidata
```

El segundo comando renderiza vía `scripts/build-blender-assets.mjs` (Blender 5.2.2 local) y publica
en `apps/web/public/assets/evidence/buildings/` + `apps/web/src/generated/building-evidence.json`.
Las hojas de contacto quedan en `blender_artist/generated/ve-source-remediation/` (ignoradas por Git).

## Fuentes de verdad

- `blender_artist/manifests/building-catalog.json`: un registro por edificio de dominio con
  `mode` (`imported` | `legacy-procedural`), `jobId`, `sourceId`, `sourcePath`, licencia, plantas,
  footprint y categoría.
- `blender_artist/manifests/asset-jobs.json`: el job de render real de cada edificio (cámara,
  resolución, estados declarados).
- `blender_artist/manifests/staging-sources.json`: registro de paquetes terceros con licencia y
  `unitScale`.

## Regla de procedencia

Ninguna entrada `imported` puede declarar un `sourceId` o una ruta que su job no importe: el
validador cruza catálogo contra manifiesto y contra el archivo físico en staging. A la inversa,
ningún building job `procedural` puede citar familias de terceros en su razón. El render de
evidencia verifica además los metadatos Blender (`origin: licensed`, `source.path`, `source.id`,
licencia) y rechaza imágenes duplicadas entre edificios o estados.

## Límite actual

La geometría importada renderiza sólo el estado `complete`. El condicionamiento
`construction/damaged/burning` sobre fuentes de terceros es un WP pendiente (V.e.3 quedó reabierto
por esta remediación); el catálogo lo muestra como estado pendiente en vez de fabricarlo.
`courtyard_home` conserva su job legacy procedural congelado con sus cuatro estados.
Nada de esta evidencia se promueve al bundle runtime sin QA visual del responsable.

## Sede operativa

`headquarters` es el nuevo tipo económico. Sus dos referencias de silueta y el contrato para producir
modelos están en [organization-headquarters](organization-headquarters/README.md). Las dos variantes
ya tienen 96 candidatas Composer con procedencia y matriz validadas, pero no forman parte del bundle
runtime: siguen pendientes la captura/revisión visual en ciudad y la aprobación humana.

## Depósito municipal de limpieza

`cleaning_depot` es el decimoséptimo tipo económico. Es municipal, con huella 3×1, solar 4×2, una
parcela/8 celdas, cero renta y cero capacidad. Cada edificio operativo propiedad del municipio suma
6 celdas al radio radial de limpieza de su distrito (máximo 36); sin depósito se conserva el baseline
anterior. SnapshotV3 no cambia. El fallback procedural es semántico y no se presenta como arte final.
La gramática Composer usa chapa perfilada original de 4 m y tres portones de servicio; el lote y su
promoción siguen sujetos a captura y aprobación humana (D-112).
