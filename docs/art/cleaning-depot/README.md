# Depósito municipal de limpieza

Estado: dominio y fallback semántico implementados; 48 candidatas Composer y 144 capturas en la
ciudad Phaser validadas técnicamente. La aprobación visual humana sigue pendiente; no hay promoción
runtime. D-112.

## Contrato

- Tipo `cleaning_depot`, exclusivamente municipal.
- Huella física 3×1, solar reservado 4×2, una parcela con mínimo 8 celdas.
- Cero renta y cero capacidad; mantenimiento municipal normal.
- Cada edificio operativo propiedad del municipio suma 6 celdas al radio de limpieza de su distrito,
  con máximo configurable 36.
- Obra, incendio, colapso inminente, ruina o propiedad privada no aportan bonus.
- Sin depósito se conserva exactamente la cobertura radial anterior. Transporte y seguridad no
  cambian.

## Arte Composer

La nave usa una crujía de 4 m de chapa perfilada original, tres portones de servicio separados 4 m,
cubierta plana y ventilación de azotea. El frente no lleva escaparates: la identidad es una nave
municipal compacta, no un local comercial, una fábrica ni un cuartel de bomberos.

El contrato cubre seis estados, cuatro orientaciones y dos moods (48 candidatas). La señal
`LIMPIEZA` y el azul municipal pertenecen al renderer; el PNG no hornea color de organización.

## Evidencia

`packages/simulation/src/cleaning-depot.test.ts` cubre baseline sin depósito, mejora de borde,
aislamiento por distrito, propiedad, estados, tope, save/load v3 y carga de partidas anteriores. Las
fixtures de generador v5 y los diez digestos se regeneraron por medición.

- `candidate-matrix.json`: 48 activos con hashes, firma, huella, pivote, escala y visibilidad de acceso.
- `gameplay-capture-v1/capture-manifest.json`: 144 capturas, tres zooms y cero errores de página;
  los PNG quedan locales hasta aprobación.
- `review/`: láminas de candidatas y captura del fallback `LIMPIEZA`.
- `validation.json`: gate técnico separado de la aprobación artística.

El fallback procedural es una nave de tres bahías con contenedores y señal municipal; no se presenta
como asset final. La captura de la señal runtime queda en `review/fallback-signage.png`. La promoción
Composer requiere procedencia, matriz, captura en ciudad, presupuesto y aprobación visual humana.

El procedimiento completo para regenerar los PNG locales está en
[ART-PIPELINE §44](../ART-PIPELINE.md). La verificación de la evidencia existente es:

```bash
DEPOT_REQUIRE_LOCAL_ASSETS=1 pnpm art:cleaning-depot:validate
pnpm art:cleaning-depot:validate:test
pnpm art:docs:links:check
```
