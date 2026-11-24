# WP-CHAR-03 — Pruebas y rendimiento

Fecha: 2026-11-24.

## 1. Pruebas unitarias

- Calibración de alfa, pivote, padding, alturas variables y zooms: **12/12**.
- Configuraciones A–D, default B y arreglos reproducibles: **3/3**.
- Total laboratorio: **15/15**.

## 2. Navegador Phaser

Chromium headless real:

- 1280×720: **37/37** comprobaciones.
- 1920×1080: **37/37** comprobaciones.
- Total: **74/74**.
- 0 errores de página, 0 errores de consola.
- 54 capturas, todas con hash y tamaño <1 MiB.

Cobertura:

- Zoom 0,5×, 1×, 1,15×, 1,25× y 2,5×.
- Pan con botón derecho.
- Zoom anclado al cursor.
- Picking API y clic real sobre celda.
- Posición lógica invariante ante zoom.
- Cinco personajes y cuatro direcciones.
- Ciclo walk `0…7→0`, escala estable y cambio de posición.
- Profundidad por celda y culling a 0,5×.
- Restablecer devuelve B.

## 3. Gates web

| Gate | Resultado |
|---|---|
| Typecheck workspace | PASS |
| Typecheck web | PASS |
| Web tests | **452 passed / 4 skipped** |
| Arquitectura | PASS |
| Build web producción | PASS |
| Build laboratorio aislado | PASS |
| Validación agregada WP-CHAR-03 | **460 checks, 0 errores** |
| Web lint | 2 errores preexistentes, reproducidos en WP-CHAR-02C |

Errores lint heredados: `fx-candidate-qa.test.ts:46` y `terrain-paint.ts:239`. El laboratorio no añade errores ni avisos.

## 4. Rendimiento

Entorno: Chromium headless con rasterización por software; no representa FPS de GPU de producción.

Medición balanceada, dos rondas en orden A→B→C→D y D→C→B→A:

| Config | Muestras FPS | Mediana |
|---|---|---:|
| A | 24,99 / 22,95 | 23,97 |
| B | 24,13 / 23,13 | 23,63 |
| C | 25,18 / 23,25 | 24,22 |
| D | 25,94 / 24,44 | 25,19 |

Las diferencias son pequeñas y no monotónicas entre rondas. No se atribuye una penalización consistente a B.

Escenario: 9 sprites (5 personajes + 2 edificios + 2 vehículos), 90 texturas, aproximadamente 96.622.940 bytes de texturas estimados. La memoria es propia del laboratorio porque genera versiones Canvas con LUT; no se promueve al runtime.

## 5. Regresiones

- Simulación, shared, edificios, runtime y escena principal sin diff.
- Obrero y policía conservados.
- No se declaró PASS global: lint mantiene deuda heredada.
- No se ejecutó de nuevo la suite completa de simulación porque el diff de ese dominio es vacío y WP-CHAR-02C ya dejó su baseline 20/12.
