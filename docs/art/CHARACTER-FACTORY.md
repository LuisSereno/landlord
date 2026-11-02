# Character Factory

V.e.4 define una factoría offline para 13 presentaciones canónicas. El manifiesto declara cuerpo,
pelo, ropa, paleta y prop por rol; no introduce esos roles en simulación.

`idle` y `walk` siguen siendo las únicas animaciones obligatorias del runtime, a cuatro direcciones.
`work`, `repair`, `carry`, `inspect`, `sit`, `panic` y `sabotage/action` son candidatos
`showcase-only` para retarget desde Universal Animation Library 1/2.

La selección de fuente es por rol: Quaternius es la base primaria por legibilidad y fiabilidad de
ingesta; Rocketbox queda como fuente secundaria para ropa/referencia hasta cerrar su remapeo de
texturas. No se declara ganador un pack completo.

```bash
pnpm art:character-factory:validate
```
