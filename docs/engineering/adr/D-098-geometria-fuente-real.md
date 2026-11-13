# D-098 — Geometría de fuente real obligatoria

Estado: **Aceptada**  
Fecha: 2026-11-02  
Fase: V.e — remediación de producción visual

## Contexto

La primera iteración de V.e usaba una Building Factory procedural cuyos presets declaraban
familias de terceros, aunque esas fuentes no entraban físicamente en el render. Además, la
matriz visual presentaba estados fabricados como si fueran cobertura de producción. Esto impedía
auditar procedencia y confundía evidencia candidata con assets aptos para runtime.

## Decisión

1. Cada edificio de dominio se registra en `blender_artist/manifests/building-catalog.json`.
   Las entradas `imported` deben declarar `sourceId` y `sourcePath`, y el validador los cruza con
   `asset-jobs.json`, staging y los metadatos Blender.
2. Un job procedural no puede citar una familia de terceros como si fuera su geometría importada.
3. Sólo se publica el estado que exista sobre la fuente importada. Hoy son 14 edificios importados
   con `complete`; `courtyard_home` conserva su conjunto legacy procedural congelado de cuatro
   estados. Los estados restantes son deuda de producción, no imágenes sintéticas.
4. Los renders bajo `apps/web/public/assets/evidence/buildings/` son **evidencia candidata**.
   No se promocionan al bundle runtime sin QA visual y revisión de procedencia.
5. Se retiran `building_factory.py`, `building-factory.json`, sus validadores y sus renderers.
   V.e.2 y V.e.3 quedan supersedidas por esta decisión.

## Consecuencias

- El catálogo actual declara honestamente 15 edificios y 18/60 estados renderizados.
- Los 14 edificios importados tienen geometría Kenney CC0 verificable; no se afirma cobertura de
  estados que todavía no existe.
- La matriz de cobertura se genera desde el catálogo y la evidencia, no desde los presets
  históricos de la fábrica.
- El runtime mantiene su separación de la evidencia: la promoción exige QA posterior.
- La futura producción de estados condicionados debe importar o construir explícitamente esa
  geometría y añadir su procedencia antes de cambiar los contadores.

## Verificación

```bash
pnpm art:jobs:validate
pnpm art:building-catalog:validate
pnpm art:coverage:audit:check
pnpm art:sources:audit:check
pnpm art:licenses:check
pnpm art:binaries:check
```

La captura `12-multiparcel-building.png` y el playtest humano de V.d-7B siguen pendientes y no se
consideran resueltos por esta decisión.
