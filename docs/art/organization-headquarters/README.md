# Sedes operativas de organización

Estado: 96 variantes Composer y 288 capturas validadas técnicamente, aprobadas por luis el
2026-11-26 y promovidas a los manifiestos runtime de día y noche. D-110.

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
- `candidates-day-v1/` y `candidates-night-v1/`: PNG y sidecars locales de origen; los PNG
  promovidos se sirven desde `apps/web/public/assets/runtime/variants*` sin versionar binarios.
- `review/`: láminas de completado, estados, noche y una selección de capturas de gameplay.
- `gameplay-capture-v1/capture-manifest.json`: 288 capturas, dos identidades, tres zooms y cero
  errores de página; los PNG quedan locales hasta aprobación.
- `validation.json`: resultado del gate técnico, separado de la aprobación artística.
- `technical-audit.json`: auditoría por asset de PNG, fuentes, licencias, hashes y procedencia de
  las 288 capturas; los avisos de borde quedan para revisión visual.
- `promotion-plan.json`: aprobación humana registrada, promoción manual ejecutada y hashes de los
  manifiestos runtime protegidos.

El procedimiento completo para regenerar los PNG locales está en
[ART-PIPELINE §44](../ART-PIPELINE.md). La verificación de la evidencia existente es:

```bash
HQ_REQUIRE_LOCAL_ASSETS=1 pnpm art:headquarters:validate
pnpm art:headquarters:audit
pnpm art:headquarters:validate:test
pnpm art:docs:links:check
```

## Gate humano

Luis aprobó globalmente las dos variantes y sus 96 assets el 2026-11-26; el registro está en
`docs/execution/phase-4/catalog-closure/04-human-review.md`. La promoción manual quedó ejecutada y
los manifiestos runtime de día/noche contienen 432 variantes. El playtest humano V.d sigue
independiente y permanece `PENDING HUMAN PLAYTEST`.
