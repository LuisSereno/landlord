# Decisiones abiertas de arte y pipeline

> Esta matriz evita que recomendaciones de investigación se conviertan accidentalmente en decisiones aceptadas.

| Decisión | Baseline propuesto | Estado | Mecanismo de cierre |
|---|---|---|---|
| Estética | realismo estilizado + caricatura moderada | abierta | Visual Direction Spike |
| Setting visual inicial | ciudad ficticia 1925–1940 | abierta de producto | Product + Art review |
| Cámara | ortográfica 45° / ~30° | abierta | calibración del spike |
| Footprint visual | 2:1 | abierta | calibración del spike |
| Grid de referencia | 128×64 px | abierta | legibilidad + memoria |
| Master | 2× | abierta | QA HiDPI + descarga |
| Escala física | 1 cell ≈ 4×4 m | abierta | prueba de densidad |
| Blender | 4.5 LTS o LTS fijada | abierta | Technical Art decision |
| Renderer | EEVEE producción | abierta | benchmark de batch render |
| Luz | canónica fija NW visual | abierta | comparación visual |
| Día/noche | estilizado, sin sol físico móvil en v1 | abierta | Product/Tech Art review |
| Personajes | 8 direcciones | abierta | animation budget |
| Atlas | 2048² multipack | abierta | profiling real |
| Runtime textures | PNG RGBA inicial | abierta | profiling/compatibilidad |
| GPU compression | posterior | diferida | profiling Alpha/Beta |
| Texture packing | TexturePacker o alternativa CI | abierta | coste/licencia/reproducibilidad |
| Git LFS | binarios fuente grandes | abierta | repo policy antes de assets |
| Tipografías | familias abiertas/licenciadas | abierta | UI design + legal |
| Golden scenes | Art Lab + Playwright | propuesta | spike técnico |
| Repo de arte separado | no inicialmente | diferida | revisar al crecer binarios |

## Ya decidido fuera de esta matriz

- D-001: IP original.
- D-003: dirección inicial 2.5D isométrica.
- D-050: Phaser confirmado para Gate 1.
- React se mantiene para HUD/paneles según arquitectura vigente, no como renderer de entidades.

Cerrar cualquier fila con impacto arquitectónico duradero requiere registrar la decisión conforme a las convenciones del repositorio.
