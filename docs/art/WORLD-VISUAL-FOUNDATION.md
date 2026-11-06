# WORLD VISUAL FOUNDATION (WP4.15-V.h)

Sistema visual que usa de forma sistemática los recursos del proyecto para generar una ciudad
coherente, variada y determinista sobre la simulación existente. La prioridad es la **ciudad
completa convincente**, no el edificio aislado perfecto.

## 1. Principio arquitectónico: Asset Knowledge Base común

No se meten recursos indiscriminadamente en el Building Composer. Hay una base de conocimiento
común y capas separadas que consumen sólo lo que les corresponde:

```
WORLD ASSET KNOWLEDGE BASE  (blender_artist/manifests/world-asset-index.json)
│  estados: indexed → classified → runtime_ready        (§5)
│  subcatálogos = VISTAS GENERADAS (world-catalogs/*-assets.json)   (§6)
│
├── architecture / building_mass   → Building Composer (sólo fachada/techo/masas/props intrínsecos, §8)
├── urban_prop / environment / infrastructure → public-space, street y parcel dressing
├── vehicle   → vocabulary §15 + colocación contextual estática (V.h.6)
├── actor / animation → vocabulary §16 + actores ambientales presentacionales (V.h.7)
├── material  → biblioteca semántica por lenguaje visual (V.h.4, §10)
└── ui / audio → clasificados para uso futuro (no mundo 3D)
```

Separación estricta: simulación autoritativa → proyección (`ViewProjectionV2`) → presentación
determinista (este adapter) → asset generation / building composition / dressing. **Nada de
decoración entra en `GameState`** (§1): todo el dressing deriva de la proyección + seeds estables.

## 2. Capas de presentación (apps/web/src/isometric/gameplay-visual-adapter.ts)

| Capa | Función | Origen |
|---|---|---|
| groundPlan / roadVisuals | terreno y marcas viales | `projection.map.roads` |
| buildings | sprites de edificio (archetype Blender o fallback procedural) | `projection.economy.buildings` |
| streetFurniture | farolas/semáforos en calzada | roads |
| parkedVehicles | aparcamiento ambiental 55/25/20 sedan/taxi/truck | roads (celdas rectas) |
| contextVehicles | vehículo por tipo de edificio (fire→firetruck, clinic→ambulance…) §15 | buildings |
| publicSpaceFurniture | monumento/bancos/farolas/jardineras por kind de espacio §13 | `projection.publicSpaces` + facilities |
| parcelDressing | espacio libre de la parcela por tipo de solar §14 | parcels + buildings |
| ambientActors | peatones presentacionales idle/walk §16 | publicSpaces |

Cada capa es una función pura determinista; el renderer (`IsometricSpikeScene`) sólo coloca sprites
del atlas y salta graciosamente los assets ausentes.

## 3. Determinismo (§17)

Todo deriva de stable ID + district ID + coordenadas + contexto semántico + seed estable
(`spatialHash(x, y, salt)`). Nunca de tick, `Math.random()`, dinero, cámara u orden de iteración no
canónico. Mismo estado urbano → mismo mundo visual. Verificado por tests (V.h.5-V.h.9) y por el
bake (re-hornear produce PNG byte-idénticos: 0 modificados en el bake de V.h.6).

## 4. Graphic Civic como unificador (§19)

Todos los packs (Kenney, Quaternius, KayKit, Rocketbox, Poly Haven) pasan por el mismo lenguaje:
escala, dirección de luz, palette, saturación/valor, sombra horneada, cámara isométrica 45°,
filtering LINEAR. Los materiales reales se remapean al style profile (nunca fotorealismo
incompatible): ver `styleAdaptation` en `material-assets.json`.

## 5. Perfiles de contexto (§11/§12, V.h.8)

`district-visual-profiles.ts`: 7 roles urbanos con multiplicadores de densidad por categoría
(trees/bushes/lighting/benches/bins/vehicles/pedestrians/fencing/gardens/props/debris/signage) +
vocabulario favored/avoided + vacantLot. `BUILDING_CONTEXT_PROFILES`: vocabulario por BuildingType.
El perfil del distrito observado modula parcel dressing y actores ambientales → cívico e industrial
visten distinto (medido en `full-world-integration.test.ts`).

## 6. Budgets (§20)

Los budgets no son un número fijo: escalan con el rol urbano (perfiles), el tamaño del espacio
público (actores: celdas/12, cap 4-6), el tamaño de la parcela (dressing: celdas libres/6, cap 3-4)
y la longitud de vía (aparcamiento: separación por línea + hash). Nunca saturan (§18): props no
pisan huella ni calzada ni accesos; monumentos no bloquean corredores peatonales.

## 7. Evidencia y QA

- Integración 9/9 distritos (modelo runtime, capas + referencias + cobertura):
  `VC9_FULLWORLD=1 pnpm --filter @landlord/web test` → `full-world-integration.test.ts`.
- Performance (§26): `VH10_PERF=1 …` → `docs/art/world-visual-foundation/performance.json`
  (antes 69 imágenes/3 vehículos → después 81/9; 2720 objetos presentacionales; 551 ms generar 9 distritos).
- Cobertura: `docs/asset-library/world-asset-coverage.md`. Auditoría: `world-asset-audit.md`.
  Diccionario: `world-asset-dictionary.md`.
- Píxeles civic-core (town_hall V7 + plaza, APPROVED baseline): `blender_artist/showcase/vg-civic-core/`.
- **Contact sheet 9 distritos × 3 escalas (§23/§29)**: requiere la app interactiva (no hay Chrome
  headless en CI/este entorno). Reproducción: `pnpm --filter @landlord/web dev`, abrir la app,
  seleccionar cada distrito en el panel CityView y capturar a 0.5x/1x/2x; montar con
  `montage district-*.png -tile 3x3 -geometry +4+4 contact-sheet.png`. Se deja como P1 para la
  review humana (ver `world-asset-coverage.md` → Gaps).

## 8. Gates (§33)

ASSET_SOURCE_AUDIT · WORLD_ASSET_INDEX · SEMANTIC_CLASSIFICATION · LICENSE_PROVENANCE ·
RUNTIME_ASSET_REFERENCES · WORLD_DRESSING_DETERMINISM · 9/9 DISTRICTS RENDER ·
BUILDING_VISUAL_COVERAGE · PUBLIC_SPACE_VISUAL_COVERAGE · PERFORMANCE = PASS/NO REGRESSION.
Todos con datos medidos (tests + bake + performance.json); el estado final es
`WP4.15-V.h — WORLD VISUAL FOUNDATION: READY FOR HUMAN REVIEW` (§35).
