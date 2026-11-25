# WP-CHAR-03 — Recomendación de escala

Fecha: 2026-11-24.

## 1. Decisión

**Recomendación: B — personajes de 34 px de altura visible, cámara a zoom 1×.**

El laboratorio usa B como predeterminado. La escena principal de producción no cambia.

## 2. Fundamentos

- A mantiene toda la ciudad, pero los personajes de 28 px siguen siendo demasiado pequeños para leer profesiones.
- B sube la altura visible un 21,4% sin cambiar cámara, edificios, vehículos, celdas ni huellas.
- B conserva los dos edificios y la composición general de A.
- C produce 35 px en pantalla, pero recorta más ciudad porque el zoom también agranda edificios y vehículos.
- D produce 39,1 px, pero es la opción con mayor pérdida de superficie visible.
- El rendimiento balanceado no muestra una penalización consistente de B.
- La integración es más simple que C/D: no requiere cambiar el zoom predeterminado de producción.

## 3. Calibración requerida

No usar `28/256`. Para Kenney:

- Medir bounds de alfa de cada frame.
- Calibrar una escala estable por personaje/animación/dirección.
- Usar la altura visible máxima del ciclo como referencia.
- Colocar el origen en el centro horizontal de la fila visible inferior.
- Objetivo de mundo: 34 px; zoom de cámara: 1×.

## 4. Plan mínimo de integración futura

No ejecutado en esta fase:

1. Aprobar arte y sprites Kenney para runtime.
2. Añadir el calibrador de alfa al pipeline de personajes de producción o convertir las medidas en metadata versionada.
3. Modificar `apps/web/src/isometric/IsometricSpikeScene.ts` en los puntos de creación de personajes para aplicar altura 34 y origen por apoyo, manteniendo el camino Rocketbox existente si sigue presente.
4. Evaluar si `visual-scale.ts` debe declarar una constante Kenney separada; no reutilizar `CHARACTER_RENDER_SCALE` para PNG de 512 px.
5. Añadir pruebas de cuatro direcciones, ocho frames, pivote, zoom y regresión de edificios/vehículos.
6. Promover assets sólo después de una gate visual humana y de actualizar manifiestos runtime protegidos.

## 5. Riesgos futuros

- Los sprites de 34 px pueden solaparse más con rótulos e indicadores.
- El culling y la profundidad deben seguir usando la celda lógica, no la caja del PNG.
- La selección por clic puede necesitar tolerancia si el sprite cubre más área.
- La calibración debe aplicarse por animación para evitar bombeo.
- El coste de texturas del laboratorio no debe trasladarse al runtime sin medición.

## 6. Estado

Recomendación técnica documentada. Aprobación artística y decisión de producción pendientes del propietario.
