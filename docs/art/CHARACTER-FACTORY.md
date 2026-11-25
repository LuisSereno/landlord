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

Los cinco prototipos Kenney existentes son `construction_worker_a`, `supervisor`, `enforcer_male`,
`police` y `firefighter`. Los nueve restantes se producen en WP-CHAR-04. La validación técnica no
equivale a aprobación artística: el estado humano permanece explícito en el manifiesto.

```bash
pnpm art:character-factory:validate
node scripts/validate-character-factory.mjs --self-test
node tools/art-pipeline/blender/characters/validate_character_catalog_coherence.mjs
pnpm art:catalog:generate
pnpm art:catalog:check
```

El catálogo generado declara 14/14 definiciones y no presenta candidatos como sprites runtime
aprobados.
