# V.e.6 — Visual Catalog (2026-11-02)

Estado: **V.e.6 CATALOG PASS**.

`/visual-catalog` ofrece doce anclas navegables, 15 cards de edificios, comparación 15×4 con aviso
de SHA duplicado, 13 roles, animaciones, vehículos, props, terrenos, parcelas, overlays y cobertura.
`?static=1` desactiva movimiento; imágenes usan lazy loading y las secciones `content-visibility`.

El JSON web se genera desde los tres manifiestos de producción y el runtime real. El test compara
15/15 edificios y 60/60 estados y exige cero duplicados en el baseline mostrado.
