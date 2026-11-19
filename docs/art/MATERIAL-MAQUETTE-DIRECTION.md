# Dirección visual: maqueta urbana material

Estado: dirección de producto aprobada; spike visual y valores de producción pendientes.

## Propósito

Conseguir que los materiales, la silueta y los estados del edificio se lean a escala de juego. La
ciudad debe sentirse como una maqueta urbana táctil de época, con una presentación clara para tomar
decisiones económicas. Se conserva la inspiración ficticia transatlántica aproximada de 1925–1940.

## Lenguaje visual

- Ladrillo, piedra, yeso, metal pintado, madera, vidrio oscuro, asfalto, tierra y vegetación salvia.
- Acabados mates, luz cálida y sombras legibles. Las texturas aportan materialidad sin dominar la
  forma ni convertirse en ruido a zoom lejano.
- Día y noche comparten identidad y contraste funcional. El HUD usa superficies de papel e tinta,
  acentos de latón y estados semánticos compatibles con los colores de organizaciones y municipio.
- La silueta y la categoría se leen antes que el detalle. El estado económico sigue comunicándose con
  los canales actuales de forma, glifo, texto y color.
- `graphic_civic` es el brazo de control del spike y queda preservado como baseline del runtime hasta
  que haya una promoción revisada.

## Spike de aceptación

Comparar bajo la misma cámara, escala y escena:

1. `row_house` — residencial bajo y ritmo de fachada.
2. `mixed_tenement` — edificio urbano con fachada comercial.
3. `warehouse` — volumen industrial y cubierta.
4. Una escena real con terreno, carretera, vegetación y un panel de HUD en día y noche.

Revisar 0,5×, 1×, 2× y 2,5×, incluyendo estados completos, obra, daño e incendio. La ficha por
piloto registra perfil de estilo, módulos y licencias, valores de EEVEE, dimensiones, pivote, huella,
hashes, bytes y capturas. Las propuestas permanecen como evidencia hasta superar la revisión visual.

## Límites de integración

- No cambiar `GameState`, snapshots, contratos de simulación ni economía para conseguir un efecto.
- No agregar bibliotecas, mapas de normales, luces o partículas al runtime sin una comparación
  medible frente al brazo de control y una ruta correcta sin WebGL.
- Los packs nuevos se incorporan mediante staging aprobado, procedencia y licencia verificables.
- El spike conserva los presupuestos D-101/D-102 y registra los resultados de rendimiento bajo la
  misma escena y equipo.

## Criterio para escalar

La dirección escala a producción sólo cuando los tres tipos piloto se distinguen por silueta y
familia, conservan el tono entre día/noche, se leen en zoom lejano, mantienen legible la escena densa
y no exceden los presupuestos de carga y memoria. La promoción de edificios y efectos es una decisión
posterior con evidencia de Art Lab y gameplay.

## Primer pase de implementación — 2026-11-19

Aplicados como exploración reversible los tokens de tinta, papel, piedra, latón, salvia y óxido en
el tema del HUD, junto con un suelo de día/noche más cálido y menos grano. `graphic_civic` y sus
sprites siguen intactos. El cambio no altera dominio, saves, manifiestos ni presupuesto de runtime.

La auditoría del pipeline encontró que los pilotos ya cuentan con lotes del Composer para estados y
orientaciones en `docs/art/quality-vj/batch/` y `batch-day/`; se conserva su procedencia y se usan como
control. Las fuentes geométricas y materiales registradas ya incluyen Quaternius MegaKit, Kenney y
Poly Haven. No se añadieron packs nuevos: las candidatas Quaternius Ultimate Buildings y Kenney
Modular Buildings/Building Kit no resuelven aún una carencia concreta del inventario. El perfil de
edificios permanece en `graphic_civic`; los parámetros de render, Geometry Nodes y receta de módulos
requieren una propuesta A/B propia antes de regenerar y comparar los tres tipos.

El chequeo `art:building-style:build:check` estaba roto porque el generador leía el grade del nivel
raíz en vez de resolver `activeMood` y su herencia. Se corrigió la resolución en el generador. Los
filtros Phaser, luz dinámica, mapas de normales, partículas, `TilemapGPULayer` y promoción de arte
siguen fuera de runtime hasta demostrar una mejora y medir coste.
