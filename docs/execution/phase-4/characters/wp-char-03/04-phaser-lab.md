# WP-CHAR-03 — Laboratorio Phaser

Fecha: 2026-11-24. Estado: laboratorio funcional; configuración recomendada B aplicada sólo aquí.

## 1. Inicio

```bash
pnpm --filter @landlord/web dev --host 127.0.0.1 --port 5173
```

URL: `http://127.0.0.1:5173/char-scale-lab.html`.

La página es una entrada adicional de Vite. No sustituye `index.html` ni modifica la configuración global.

## 2. Build aislado

```bash
pnpm --filter @landlord/web exec vite build --config src/character-scale-lab/vite.config.ts
pnpm --filter @landlord/web exec vite preview --config src/character-scale-lab/vite.config.ts --host 127.0.0.1 --port 4173
```

Salida: `apps/web/dist-character-scale-lab/`. El build de producción normal sigue emitiendo sólo `index.html`.

## 3. Escena

- Calle, acera, retícula y mobiliario urbario simple.
- `row_house` y `workshop` reales, con pivote y escala de manifiesto.
- `veh_truck` y `veh_delivery` reales.
- Obrero, supervisor, enforcer, policía y bombero.
- Referencia de puerta de 2 m y rectángulo de vehículo.
- Cámara centrada en un punto mundial fijo por arreglo.
- Movimiento de obrero y enforcer a 1,4 celdas/s; ocho muestras walk normalizadas.
- Profundidad isométrica por celda y soporte de suelo por frame.

## 4. Controles

- A–D: configuraciones exactas de escala.
- `street`, `lineup`, `door`, `vehicle`: arreglos reproducibles.
- Pausa, retícula, pivotes, referencias y movimiento.
- Restablecer cámara, posiciones y configuración B.
- Botón derecho: pan. Rueda: zoom 0,5×–2,5× anclado al cursor. Clic izquierdo: picking.

API de automatización: `window.__charScaleLab`, con `setConfig`, `setArrangement`, `setMotionPhase`, `setCharacterDirection`, `setZoom`, `getState`, `worldToScreen`, `screenToWorld` y `pickAtScreen`.

## 5. Recursos

Los 84 PNG de personajes se copiaron a `apps/web/public/qa-character-scale/sprites/` y se midieron por alfa. El manifiesto conserva SHA de origen y copia.

Edificios y vehículos se leen de `apps/web/public/assets/runtime/blender-day/`; no se copian ni regeneran.

## 6. Capturas

```bash
node tools/art-pipeline/blender/characters/wp_char_03/capture_phaser_lab.mjs
node tools/art-pipeline/blender/characters/wp_char_03/measure_phaser_performance.mjs
python3 tools/art-pipeline/blender/characters/wp_char_03/compose_phaser_contact_sheets.py
```

Las capturas se guardan en `docs/art/characters/prototypes/wp-char-03/phaser-captures/` y son de Phaser ejecutándose en Chromium. Las hojas de contacto son composiciones de esas capturas, no sustitutos de la prueba.
