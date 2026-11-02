# V.d-7B — cierre técnico incompleto (2026-11-02)

Estado: **BLOCKED — no apto para revisión visual humana**.

## Alcance completado

La rama implementa selección semántica, geometría completa de parcelas, frente vial como segmentos,
picking directo, contexto multi-parcela, tooltip portal, lenguaje de facilities basado en capacidad
efectiva y preferencias de huella del dominio con escala uniforme del sprite.

## Evidencia pendiente

No hay captura válida `12-multiparcel-building.png`: debe mostrar un edificio terminado,
seleccionado mediante gameplay real, con huella física, contexto catastral de dos o más parcelas y
panel sin IDs técnicos. No se inyectó estado para simularla. Por ello no hay inventario 16/16 ni
SHA-256 final, ni se emite una decisión de revisión humana.

## Gates

Los checks focalizados de tipos, lint y build se ejecutaron durante la rama; el cierre completo
(suite, smokes, arte, FPS y bundle comparativo) queda sin certificar porque debe correr sobre un
HEAD que haya producido las 16 capturas válidas.

## Deuda y siguiente paso

Diagnosticar el avance de la obra multi-parcela con el hook observacional del harness y generar la
captura 12 por el flujo normal. Después regenerar el paquete entero y repetir gates. Esta acta no
cierra V.d ni sustituye el playtest humano pendiente.
