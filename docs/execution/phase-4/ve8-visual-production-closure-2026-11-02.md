# V.e.8 — QA, performance y cierre (2026-11-02)

Estado: **V.e COMPLETE — CANDIDATES READY FOR HUMAN VISUAL QA**.

El catálogo reúne 15/15 edificios, 60/60 estados, 13/13 roles, 2/2 animaciones runtime, 6/6
vehículos, 15 categorías de props y 11 terrenos. `purchase gaps: 0`; la decisión es
`NO PURCHASE REQUIRED`.

El smoke valida cards, estados, imágenes, personajes, categorías, contadores, canvas Phaser y cero
errores de página. Produce 16 capturas versionadas bajo `docs/art/golden/visual-catalog/` para una
revisión humana rápida. `?static=1`, lazy images, secciones diferidas y chunk dinámico del showcase
limitan coste; Vite mantiene un warning heredado de chunk principal mayor de 500 kB.

No se promovió ningún candidato V.e al gameplay. El flujo permanece candidate → catalog → visual
QA → promote.
