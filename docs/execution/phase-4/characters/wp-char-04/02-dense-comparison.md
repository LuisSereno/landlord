# WP-CHAR-04 — Comparación B/D en ciudad densa

Fecha: 2026-11-25. Laboratorio Phaser aislado con diez edificios reales, dos vehículos y cinco
personajes Kenney. No es una captura de gameplay ni una promoción runtime.

## Resultado medido

| Viewport | Configuración | Zoom | Altura personaje | Área mundial visible | Edificios |
| --- | --- | ---: | ---: | ---: | ---: |
| 1280×720 | B | 1,00× | 34,0 px | 663.040 | 10 |
| 1280×720 | D | 1,15× | 39,1 px | 501.353 | 10 |
| 1920×1080 | B | 1,00× | 34,0 px | 1.766.400 | 10 |
| 1920×1080 | D | 1,15× | 39,1 px | 1.335.652 | 10 |

D aumenta la altura un **15 %**, pero reduce el área mundial visible un **24,4 %** en ambas
resoluciones. B conserva más contexto urbano y los cinco personajes siguen siendo legibles.

## Evidencia

- [Manifiesto de capturas](../../../../art/characters/candidates/wp-char-04/dense-comparison/manifest.json)
- [B · 1280×720](../../../../art/characters/candidates/wp-char-04/dense-comparison/1280x720/B-dense.png)
- [D · 1280×720](../../../../art/characters/candidates/wp-char-04/dense-comparison/1280x720/D-dense.png)
- [B · 1920×1080](../../../../art/characters/candidates/wp-char-04/dense-comparison/1920x1080/B-dense.png)
- [D · 1920×1080](../../../../art/characters/candidates/wp-char-04/dense-comparison/1920x1080/D-dense.png)

## Recomendación

**B (`zoom 1×`, personaje 34 px)** para producción. D queda como alternativa para inspección
cercana, no como default de ciudad. La elección técnica está documentada; la ratificación visual
del responsable sigue pendiente y no se marca ninguna configuración como aprobada por un agente.
