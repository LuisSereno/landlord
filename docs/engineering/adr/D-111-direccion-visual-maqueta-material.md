# D-111 — Dirección visual de maqueta urbana material

Estado: dirección aceptada por el responsable el 2026-11-19; parámetros de producción sujetos al
spike de aceptación.

## Decisión

Landlord orienta el mundo y el HUD hacia una **maqueta urbana material**: arquitectura estilizada de
época, materiales mate reconocibles, luz cálida y lectura clara de la economía. El vocabulario combina
ladrillo, piedra, yeso, metal pintado, madera, vidrio oscuro, tierra, asfalto y vegetación salvia.
Se conserva la ambientación ficticia aproximada de 1925–1940 y la prioridad de silueta antes que
detalle.

`graphic_civic` permanece como brazo de control y baseline de runtime mientras se comparan tres
pilotos (`row_house`, `mixed_tenement`, `warehouse`) en la escena real. El HUD comparte los materiales
visuales de tinta, papel y latón, manteniendo contraste, accesibilidad y la jerarquía existente.

La aceptación de la dirección no aprueba automáticamente un grade concreto, una biblioteca externa,
efectos Phaser ni la promoción de sprites. Geometry Nodes, ajustes EEVEE, filtros, iluminación dinámica,
mapas de normales y partículas requieren evidencia separada antes de entrar en producción/runtime.

## Consecuencias

- Actualizar Art Bible y documentación operativa con esta dirección y el gate del spike.
- Usar staging/procedencia/licencias actuales para cualquier fuente nueva; no incorporar paquetes
  completos sólo por disponibilidad.
- Comparar día/noche, estados y escalas de juego; mantener D-101 y D-102 y los gates de accesibilidad.
- Sin cambios en dominio, `GameState`, snapshots o saves por razones visuales.

Ver `docs/art/MATERIAL-MAQUETTE-DIRECTION.md`.
