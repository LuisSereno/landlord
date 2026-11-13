# D-105 — Grado diurno neutro-cálido y selector de presentación

Estado: ACEPTADA · 2026-11-11

## Contexto

El primer grado `graphic_civic` se horneó con una lectura nocturna que contradecía la Art Bible.
El cambio debía ser reversible, determinista y completamente ajeno al dominio de simulación.

## Decisión

- `day_civic` es el grado visual preferido: key 4.2, fill 1.15, mundo `[0.52,0.60,0.70]`,
  Standard/Medium Contrast, exposure 0 y sombras suaves.
- `night_civic` permanece disponible como perfil explícito; no se elimina ni se migra por sorpresa.
- El suelo de runtime tiene una paleta diurna paralela y el HUD ofrece Día/Noche en la esquina
  superior derecha.
- La preferencia vive en `localStorage` y sólo afecta presentación. No se persiste en snapshots ni
  se envía al Worker.
- El horneado completo de los PNG es una promoción posterior por familia; el selector no afirma que
  un PNG nocturno ya publicado sea diurno.

## Evidencia y límites

El mismo `row_house` ancla pasó de `medV=0.251/P90V=0.286` en noche a
`medV=0.475/P90V=0.573` en día. La aprobación estética cubre este ancla; la promoción completa
sigue condicionada a guards, peso de binarios y revisión de contact sheet.

## Consecuencias

El resolutor de `render_settings.py` es la única puerta de selección del mood Blender. El runtime
reconstruye únicamente el canvas al cambiar la preferencia, por lo que una partida en curso conserva
el mismo estado autoritativo y los mismos digestos.
