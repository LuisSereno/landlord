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

WP-CHAR-04 produjo el smoke técnico de los 14 y el batch completo 14×4×(1 idle+8 walk)=504.
El batch pasó 13.894 comprobaciones con 0 errores y 504 hashes únicos; las 14 advertencias son la
pose walk-0 idéntica a idle en la fuente. Luis aprobó globalmente los 14 personajes y la
configuración B (`zoom 1×`, 34 px) el 2026-11-26. Los 504 frames están promovidos en los bundles
runtime diurno y nocturno; Rocketbox permanece sólo como fallback legacy.

```bash
pnpm art:character-factory:validate
node scripts/validate-character-factory.mjs --self-test
node tools/art-pipeline/blender/characters/validate_character_catalog_coherence.mjs
pnpm art:catalog:generate
pnpm art:catalog:check
```

La regeneración del smoke, el batch de 504 frames y la captura de los 14 a escala de juego está
descrita en [ART-PIPELINE §44](ART-PIPELINE.md). La promoción runtime se ejecuta con
`scripts/promote-character-batch.mjs` y exige el plan aprobado, el batch validado y el acta humana.

El catálogo generado declara 14/14 definiciones y 14/14 personajes runtime-ready.
