# D-050 — Phaser para el spike de Gate 1

Estado: Aceptada  
Fecha: 2026-10-20  
Alcance: Gate 1

## Contexto

Phaser era la opción propuesta, pendiente de confirmación mediante spike. La fase técnica necesita una opción concreta para medir isométrico, picking, cámara y rendimiento.

## Decisión

Usar Phaser `4.2.1` en Gate 1. Phaser representa mapa, cámara, sprites, overlays y picking. React representa HUD, menús y paneles. Ninguno contiene reglas autoritativas.

La ocupación, ownership y autorización proceden de proyecciones confirmadas por simulation. El render puede interpolar posiciones sin escribir estado de dominio.

La decisión se reabre sólo si el spike demuestra:

- picking incorrecto sin workaround mantenible;
- frame time p95 fuera de D-052;
- memory leak reproducible atribuible al motor;
- incompatibilidad con Worker/proyección, Chromium o Firefox;
- necesidad de parchear internals no públicos.

El fallo genera spike comparativo y nuevo ADR; no autoriza sustitución dentro de la tarea que detecta el problema.

## Alternativas descartadas

- Canvas/WebGL propio: incrementa coste antes de probar el producto.
- React para entidades por frame: mezcla UI declarativa con render de alta frecuencia.
- 3D completo: fuera de alcance y contrario a la dirección 2.5D inicial.

## Consecuencias

- Gate 1 debe medir Phaser con la escena de referencia, no con una escena vacía.
- Los assets técnicos serán geometría original simple y con procedencia registrada.
- Una limitación visual no puede trasladar reglas al render.

## Condición de revisión

Las cinco condiciones anteriores o una incompatibilidad de licencia/distribución demostrada.
