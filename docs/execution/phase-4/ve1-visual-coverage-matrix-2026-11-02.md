# V.e.1 — matriz de cobertura visual (2026-11-02)

Estado: **V.e.1 COVERAGE BASELINE PASS**. No equivale a producción visual terminada.

## Cobertura medida

- 15/15 tipos de dominio tienen fallback procedural.
- 60/60 estados procedurales tienen SHA-256 distintos dentro de su edificio.
- 1/15 tipos de dominio (`courtyard_home`) tiene candidato Blender nominal con cuatro estados
  diferenciados.
- El bundle Blender contiene siete arquetipos; seis reutilizan el mismo frame para complete,
  construction, damaged y burning, por lo que se registran como `VISUAL STATE GAP`.
- Los 15 `final source` permanecen pendientes de QA y promoción.

La matriz canónica está en `docs/art/VISUAL-COVERAGE-MATRIX.md`; su evidencia estructurada vive en
`docs/art/visual-catalog/coverage-audit.json`. Ambas se generan y comprueban con
`art:coverage:audit` / `art:coverage:audit:check`.

## Huella preferida

Esta rama parte de `develop`, donde `BuildingDefinition.preferredFootprint` aún no está integrado.
La columna usa `RuntimeAssetManifestV2.domainFootprint` como baseline espacial existente y marca la
dependencia de V.d-7B. No convierte el asset en regla de simulación ni duplica el contrato pendiente.

## Decisión

La matriz permite comenzar V.e.2 con asignaciones candidatas explícitas, pero ningún fallback
procedural se declara “final” sólo por cubrir el contrato. Primero deben producirse siluetas propias,
estados diferenciados, pivote/escala correctos y QA visual.
