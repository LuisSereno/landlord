# V.e.3 — estados de edificios (2026-11-02)

> **SUPERSEDED (2026-11-02, remediación de geometría de fuente, D-098).** Los 60/60 estados de este
> WP se generaron sobre la geometría inventada de la Building Factory, retirada el mismo día. Sobre
> geometría importada real sólo existe hoy el estado `complete`; el condicionamiento de estados es
> un WP pendiente reabierto por la remediación. Historial, no referencia.

Estado: **V.e.3 VISUAL STATES PASS**.

La Building Factory genera cuatro estados distintos para sus 14 candidatos y conserva los cuatro
estados originales de `courtyard_home`: 60/60 renders con SHA-256 únicos por edificio.

- `construction`: cimentación, estructura parcial, andamios, acopio, barreras y conos.
- `damaged`: silueta conservada, hollín, huecos oscuros y escombros.
- `burning`: base dañada más fallback contractual de llama/humo; el runtime podrá superponer VFX.
- `complete`: diseño aprobado en V.e.2.

`pnpm art:building-factory:review` produce localmente
`all-building-states.png` y aborta si dos estados de un tipo comparten hash. Los candidatos siguen
siendo `evidence`: no hay promoción automática.
