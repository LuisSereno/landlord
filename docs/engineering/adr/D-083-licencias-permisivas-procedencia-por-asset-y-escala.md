# D-083 — Licencias de terceros: allowlist SPDX, procedencia por asset y escala física declarada

Estado: aceptada el 2026-10-26 como parte de WP4.15-V.a. Abre la parte de procedencia de D-054 y
corrige D-080 en el campo `provenance` de `RuntimeAssetManifestV1`.

## Contexto

WP4.15-V necesitaba personajes vestidos creíbles para una ciudad. Los Quaternius Universal Base
Characters llegan en ropa interior y no existe un pack CC0 de ropa urbana, así que se adoptó
**Microsoft Rocketbox**, que es **MIT** y no CC0.

El repo no podía declararlo. Había tres bloqueos independientes:

1. `packages/shared/src/assets.ts` fijaba `provenance.license` a
   `z.enum(["original", "cc0", "cc_by"])`. No existía valor MIT: cualquier bundle con un asset
   Rocketbox habría sido inválido en `pnpm test`.
2. `scripts/validate-art-staging.mjs` exigía a la vez `path.startsWith(".../third_party/cc0/")` y
   `license === "CC0-1.0"`. Rocketbox incumplía las dos.
3. El validador calculaba el SHA-256 de un **archivo físico**. Una fuente obtenida por `git clone`
   no tiene archivo, así que no había forma de registrar su integridad.

Y un problema de fondo: contrato y validador representaban la misma licencia con literales
distintos (`cc0` en Zod, `CC0-1.0` en el registro). Dos representaciones de un mismo hecho
siempre acaban divergiendo.

A eso se sumó un hallazgo de las mediciones de V.a0: cada pack está autorreferido a su propia
unidad. Ocho fixtures medidos tal como los entrega el importador:

| Fixture                       | x × y × z en unidades de la fuente |
| ----------------------------- | ---------------------------------- |
| Kenney `building-a`           | 0.88 × 0.94 × 1.29                 |
| Kenney `road-straight`        | 1.00 × 1.00 × 0.02                 |
| Kenney `road-curve`           | 2.00 × 2.00 × 0.02                 |
| Kenney `police` (car kit)     | 1.50 × 3.10 × 1.30                 |
| Kenney `tree_pineTallB_d`     | 0.39 × 0.39 × 1.94                 |
| KayKit `building_A`           | 2.00 × 2.00 × 1.65                 |
| KayKit `bench`                | 0.40 × 0.15 × 0.10                 |
| Quaternius `Building_Medium_2`| 15.06 × 13.06 × 25.01              |
| Rocketbox `Male_Adult_05`     | 1.35 × 0.37 × **1.812 m**          |

Quaternius y Rocketbox ya están en metros. Los city kits de Kenney están en casillas (una losa de
road = 1×1, una curva = 2×2). KayKit usa bloques de 2 unidades. Y el **car kit de Kenney no
comparte unidad con su propio city kit**: a 4 m/unidad una furgonetta saldría de 6 m de ancha,
mientras que a 1.3 m/unidad sale 1.95 × 4.03 × 1.69 m, que es un vehículo real.

## Decisiones

### 1. Allowlist canónica única, con literales SPDX

`blender_artist/manifests/license-allowlist.json` pasa a ser la lista canónica:

```json
{
  "allowed": ["original", "CC0-1.0", "MIT", "CC-BY-4.0"],
  "directoryByLicense": { "original": null, "CC0-1.0": "cc0", "MIT": "mit", "CC-BY-4.0": "cc-by" },
  "attributionRequiredFor": ["MIT", "CC-BY-4.0"],
  "denied": ["CC-BY-3.0", "CC-BY-NC-4.0", "NC", "ND", "all-rights-reserved", "GPL-3.0", "..."]
}
```

- El enum de Zod usa **los mismos literales**; se eliminan `cc0`/`cc_by`/`mit` en minúscula.
- `packages/shared/src/assets.test.ts` aserta que `ASSET_LICENSES` y `allowed` coinciden, y que
  ninguna licencia permitida aparece en `denied`. Sin este test, contrato y validador volverían a
  divergir.
- **Política estrictamente allowlist**: CC-BY-3.0 está denegada aunque sea permisible, porque
  ningún asset la necesita. Habilitar una licencia es una edición visible en revisión, no una
  inferencia del pipeline.
- El directorio de staging codifica la familia de licencia:
  `blender_artist/staging/third_party/<cc0|mit|cc-by>/`. Rocketbox se reubicó a `mit/rocketbox/`.

### 2. Procedencia por asset, atribución obligatoria bajo evidencia

`AssetProvenanceV1` se declara en cada asset (`buildings`, `characters`, y las futuras `terrain`,
`props`, `vehicles`). `provenance` del bundle pasa a ser resumen y valor por defecto, porque un
bundle real mezclará CC0 (Kenney/Quaternius) con MIT (Rocketbox).

Cuando `license ∈ attributionRequiredFor`, `superRefine` exige un objeto `attribution` con
`sourceUrl`, `licenseUrl`, `attributionText`, `verifiedAt` y `licenseFileSha256`. Sin evidencia,
Zod revienta: la puerta de MIT se abre sólo con su condición cumplida.

Esto corrige D-080, que asumía `provenance` único por bundle.

### 3. Dos anclas de integridad

- `zip-sha256` (comportamiento actual): hash del archivo físico bajo staging, política D-054.
- `git-commit` (nuevo): commit SHA de 40 hex del repositorio de origen **más** el SHA-256 del
  aviso de licencia que viaja con el material (`LICENSE-MIT.txt`). Cubre las fuentes clonadas sin
  ZIP, que antes no eran registrables.

`scripts/extract-cc0-packs.mjs` ignora las fuentes sin archivo: no hay nada que desempaquetar, y
su evidencia la valida el validador de staging.

### 4. Guarda de licencias en CI

`scripts/check-third-party-license.mjs` (`pnpm art:licenses:check`, paso de CI) lee los manifiestos
runtime generados y cruza cada procedencia contra el registro y el allowlist. Falla si:

- la licencia no está en el allowlist o está en la denylist;
- un `sourceId` no existe o su licencia no coincide con la declarada (un MIT pasado por CC0);
- una licencia que exige atribución no la declara, o le falta algún campo;
- `attribution.sourceUrl` no coincide con la URL registrada de la fuente.

Verificado **por negativo**: inyectar `{"license": "MIT"}` sin atribución en
`runtime-assets-blender.json` produce
`bundle-blender.characters.vecino_variante: MIT exige atribución y no la declara` y salida 1.

`art:staging:validate` **no** se añade a CI: valida los archivos físicos de staging que D-054
mantiene fuera de Git, así que sólo puede correr en la máquina del artista.

### 5. Escala física declarada por fuente, no inferida

Cada fuente registra `unitScale` en `staging-sources.json`, con el mapeo del contexto:
city kits de Kenney y KayKit = 4.0 (una casilla = una celda de 4 m del style layer), car kit de
Kenney = 1.3, Quaternius y Rocketbox = 1.0.

No se infiere de la bounding box: un coche grande y un edificio pequeño harían que una heurística
tomara la decisión equivocada, y el fallo sería silencioso. Un job puede sobrescribir el valor de
su fuente sólo como excepción documentada.

La normalización que aplica esa escala (`normalize_import_root()`) actúa **exclusivamente sobre el
contenedor raíz importado** — scale + translation — y nunca sobre vértices, matrices locales,
huesos, skinning o animación, porque en un personaje el mesh deformado pertenece a un `Armature` y
editar sus vértices rompería el rig y el root motion.

## Consecuencias

- `blender_artist/manifests/staging-sources.json` gana `unitScale` e `integrity`; Rocketbox entra
  en el registro como `src_microsoft_rocketbox` con licencia MIT.
- `packages/shared/src/assets.ts` exporta `ASSET_LICENSES`, `ATTRIBUTION_REQUIRED_LICENSES`,
  `assetAttributionSchema` y `assetProvenanceSchema`.
- CI suma un paso (`art:licenses:check`); el presupuesto de binarios gana una segunda dimensión
  (`maxBundleBytes`, ver D-081 y `asset-metrics.json`).
- La atribución MIT queda satisfecha hoy conservando el aviso junto al material y registrando la
  evidencia en el manifiesto. **Dónde se muestra al usuario final** (THIRD_PARTY_NOTICES, pantalla
  de créditos, contenido del paquete de distribución) sigue abierto: MIT no obliga a un aviso en la
  UI, pero la decisión de producto queda pendiente de D-054.
