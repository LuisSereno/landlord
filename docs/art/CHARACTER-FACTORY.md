# Character Factory

La factoría define **14 presentaciones canónicas**: 6 operativas y 8 ambientales/contextuales. No
introduce roles nuevos en simulación; los cuatro specialties operativos siguen siendo
`supervisor`, `construction_worker`, `maintenance_technician` y `enforcer`.

## Familia y contrato

- Familia de producción: **Kenney Mini Characters (CC0)**.
- Rocketbox queda como runtime legado hasta que una promoción humana apruebe los sprites Kenney.
- Animaciones runtime: `idle` y `walk`, cuatro direcciones.
- `work`, `repair`, `carry`, `inspect`, `sit`, `panic` y `sabotage_action` siguen siendo candidatos
  showcase-only.
- Escala/pivote, hashes, procedencia y presupuesto se validan antes de cualquier promoción.

## Estado del cierre

WP-CHAR-04 produjo el smoke técnico de los 14: 28 frames, 1.528 comprobaciones, 0 errores y 0
advertencias. Los cinco prototipos anteriores se reutilizaron y los nueve restantes ya tienen
candidato Kenney. La comparación B/D en ciudad densa recomienda técnicamente B (`zoom 1×`, 34 px):
D aumenta un 15 % la altura pero reduce un 24,4 % el área visible. La validación técnica no equivale
a aprobación artística: el batch completo de 504 frames y la promoción runtime siguen pendientes de
revisión humana.

```bash
pnpm art:character-factory:validate
node scripts/validate-character-factory.mjs --self-test
node tools/art-pipeline/blender/characters/validate_character_catalog_coherence.mjs
pnpm art:catalog:generate
pnpm art:catalog:check
```

El catálogo generado declara 14/14 definiciones y no presenta candidatos como sprites runtime
aprobados.
