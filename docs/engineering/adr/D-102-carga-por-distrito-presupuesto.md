# D-102 — Carga bajo demanda por distrito: el presupuesto mide bytes en arranque / por distrito, no el total servido

- **Estado:** aceptada en el spec WP4.15-V.j (2026-11-07) e implementada en V.j.5/V.j.6 (2026-11-09). Evidencia 9×3×4 aprobada por el responsable (2026-11-09).
- **Contexto:** V.j cierra la visualización completa del mundo con variantes reales por tipo×estado×etapa×orientación (360 renders de edificio, ~350 MB a renderScale 2) + vehículos 9×4. Servir todo eso en el bundle de arranque rompería D-101 (23 MiB) y el requisito de Beta de no cargar el catálogo global al inicio.
- **Decisión:**
  1. El catálogo de variantes se publica como **manifiesto JSON versionado** (`apps/web/src/generated/runtime-building-variants.json`, 360 entradas con src/sha/medidas/pivote) y los **PNG en un directorio servido pero gitignored** (`apps/web/public/assets/runtime/variants/`), generados por `scripts/promote-building-variants.mjs`. El repo no versiona los ~350 MB.
  2. El **arranque no carga imágenes de variantes** (sólo el manifiesto). Las texturas entran **bajo demanda** cuando un sprite las necesita, atribuidas a su distrito.
  3. **Caché acotada** (`DistrictTextureCache`, `apps/web/src/assets/district-texture-cache.ts`): presupuesto de memoria decodificada (96 MiB), protege el distrito observado y las texturas en uso, expulsa LRU el resto y elimina esas texturas de Phaser. Métricas vía `window.__districtAssetStats` (loaded/cache/evicted/byDistrict/budget).
  4. La proyección ya escopa `economy` al distrito observado (`createViewProjection`), así que la carga es por-district por construcción; los distritos visitados quedan calientes por LRU (preload de vecinos vía `neighborDistrictIds`, 4-adyacencia).
  5. El presupuesto de **arranque** sigue siendo D-101 (bundle runtime ≤ 23 MiB, medido 22,6 MB); el presupuesto de **variantes** es memoria de sesión (96 MiB), no tamaño del repo ni total servido.
- **Consecuencias:** el total servido puede ser grande (~350 MB) sin violar el presupuesto; lo que se mide y gatea es lo cargado en arranque y la memoria viva por distrito. Un clon fresco necesita correr el pipeline de promoción para tener los PNG (igual que el resto de arte generado).
- **Verificación:** `blender-assets.test.ts` (guard baseline + bundle ≤ 23 MiB), `check-binary-budget.mjs`, tests de `district-texture-cache` (7) y `building-variants` (6), captura QA 9×3×4 con 0 errores de página.
- **Relacionadas:** D-100/D-101 (presupuesto de binarios), D-099 (catálogos semánticos), V.j.5/V.j.6.
