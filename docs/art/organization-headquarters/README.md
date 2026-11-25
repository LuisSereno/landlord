# Sedes operativas de organización

Estado: 96 candidatas Composer y 288 capturas en la ciudad Phaser validadas técnicamente. La
aprobación visual humana sigue pendiente; ninguna candidata está promovida al runtime. D-110.

## Contrato visual

| Variante | Identidad | Acceso de servicio |
| --- | --- | --- |
| `headquarters_cupola` | Mansión urbana simétrica con mirador original y alas laterales | Cochera trasera visible a 180°/270° |
| `headquarters_courtyard` | Residencia en U con patio de servicio abierto | Umbral frontal y puerta trasera visible a 180°/270° |

Ambas comparten huella 4×2, seis estados (`complete`, `foundation`, `structure`, `finishing`,
`damaged`, `burning`), cuatro orientaciones físicas y dos moods (`day_civic`, `night_civic`). Cada
variante aporta 48 assets y la matriz completa 96.

La placa y el rombo son neutros: el color y la forma de organización se pintan en runtime. El
jugador usa turquesa `#4DB6AC`/rombo, el rival terracota `#D97757`/triángulo y el azul cívico queda
reservado al municipio.

## Evidencia y procedencia

- `candidate-matrix.json`: índices, hashes, firma de composición, huella, pivote, escala, accesos y
  detalles arquitectónicos de las 96 candidatas.
- `candidates-day-v1/` y `candidates-night-v1/`: PNG y sidecars locales; los PNG no se versionan
  hasta aprobación humana.
- `review/`: láminas de completado, estados, noche y una selección de capturas de gameplay.
- `gameplay-capture-v1/capture-manifest.json`: 288 capturas, dos identidades, tres zooms y cero
  errores de página; los PNG quedan locales hasta aprobación.
- `validation.json`: resultado del gate técnico, separado de la aprobación artística.
- `promotion-plan.json`: promoción manual condicionada a aprobación humana y protege los manifiestos
  runtime vigentes.

Comandos reproducibles:

```bash
pnpm art:headquarters:assemble
HQ_REQUIRE_LOCAL_ASSETS=1 pnpm art:headquarters:validate
pnpm art:headquarters:validate:test
pnpm art:headquarters:capture
python3 scripts/compose-headquarters-review-sheets.py
```

## Gate humano

Revisar las 288 capturas en ciudad (dos identidades, tres zooms), cochera/patio de servicio,
emblemas, presupuesto y conducta con y sin variante promovida. Sólo después de una aprobación
explícita se puede editar `runtime-promotions.json` o un manifiesto runtime. El playtest humano V.d
sigue independiente y permanece `PENDING HUMAN PLAYTEST`.
