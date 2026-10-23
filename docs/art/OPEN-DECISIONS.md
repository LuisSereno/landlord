# Decisiones abiertas de arte y pipeline

> Esta matriz evita que recomendaciones de investigación se conviertan accidentalmente en decisiones aceptadas.

| Decisión | Baseline propuesto | Estado | Mecanismo de cierre |
|---|---|---|---|
| Estética | realismo estilizado + caricatura moderada | parcial — dirección `graphic_civic` aprobada; setting y tono siguen abiertos | Visual Direction Spike |
| Setting visual inicial | ciudad ficticia 1925–1940 | abierta de producto | Product + Art review |
| Cámara | ortográfica 45° / ~30° | **cerrada — acta WP2.14 (2026-10-23): azimut 45°, elevación 30°, roll 0** | calibración del spike |
| Footprint visual | 2:1 | abierta | calibración del spike |
| Grid de referencia | 128×64 px | abierta | legibilidad + memoria |
| Master | 2× | abierta — el acta fija master PNG RGBA16 1024×576; política HiDPI/2× sin resolver | QA HiDPI + descarga |
| Escala física | 1 cell ≈ 4×4 m | abierta — pendiente de escena densa en Phaser | prueba de densidad |
| Blender | 5.2.2 LTS | **cerrada — D-053** | versión pinneada para preproducción |
| Renderer | EEVEE producción | **cerrada — acta WP2.14: EEVEE headless** | benchmark de batch render |
| Luz | canónica fija NW visual | abierta | comparación visual |
| Día/noche | estilizado, sin sol físico móvil en v1 | abierta | Product/Tech Art review |
| Personajes | 8 direcciones | abierta — decisión 4 vs 8 medida en WP4.15 | animation budget |
| Atlas | 2048² multipack | abierta — pasa a WP4.15 | profiling real |
| Runtime textures | PNG RGBA inicial | **cerrada como master — acta WP2.14: PNG RGBA 16-bit transparente**; formato runtime derivado sigue en WP4.15 | profiling/compatibilidad |
| GPU compression | posterior | diferida | profiling Alpha/Beta |
| Texture packing | TexturePacker o alternativa CI | abierta — pasa a WP4.15 | coste/licencia/reproducibilidad |
| Git LFS | binarios fuente grandes | abierta — pasa a WP4.15 | repo policy antes de assets |
| Tipografías | familias abiertas/licenciadas | abierta | UI design + legal |
| Golden scenes | Art Lab + Playwright | **cerrada para el spike — Art Lab `/art-lab` + smoke automatizado**; visual regression con baseline por asset sigue en WP4.15 | spike técnico |
| Repo de arte separado | no inicialmente | diferida | revisar al crecer binarios |
| Building Factory | generación modular/procedural offline | abierta — pasa a WP4.15 | primer asset end-to-end + spike |
| Character Factory | base rig + variantes offline + batch directions | abierta — pasa a WP4.15 | personaje del spike |
| Assets third-party en Git | staging local por ahora | abierta | aprobar LFS + provenance + estructura |

## Ya decidido fuera de esta matriz

- D-001: IP original.
- D-003: dirección inicial 2.5D isométrica.
- D-050: Phaser confirmado para Gate 1.
- D-053: Blender 5.2.2 LTS fijado como toolchain artístico inicial.
- D-054: bootstrap artístico self-contained, CC0/procedural-first para primeras fases.
- React se mantiene para HUD/paneles según arquitectura vigente, no como renderer de entidades.

Cerrar cualquier fila con impacto arquitectónico duradero requiere registrar la decisión conforme a las convenciones del repositorio.
