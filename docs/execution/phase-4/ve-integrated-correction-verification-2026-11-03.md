# Verificación A/B de `wip/ve-integrated-correction` (2026-11-03)

Esta nota compara las cuatro suites que ya fallaban en el baseline económico antes de la
integración visual. No se usa para cerrar V.d-7B: `12-multiparcel-building.png` y el playtest
humano siguen pendientes.

## Método reproducible

Se ejecuta el mismo comando contra ambos árboles, sin regenerar fixtures:

```bash
vitest run --config vitest.config.ts \
  packages/simulation/src/city-seeds.test.ts \
  packages/simulation/src/district-generation.test.ts \
  packages/simulation/src/tick-conservation.test.ts \
  packages/simulation/src/vd7a-multiparcel.test.ts \
  --reporter=json --outputFile=/tmp/landlord-vitest.json
```

- **Baseline:** `develop` / `b9356cf256d6039bac8b5887110677bfc8848de3`.
- **Candidato:** `wip/ve-integrated-correction` en el HEAD verificado de esta rama.
- Se compararon los cuatro nombres de test fallidos, el primer mensaje de aserción y el recuento
  de tests; ambos árboles producen 4 aserciones fallidas y 49 pasadas.

## Resultado

| Suite | Test fallido idéntico | Fingerprint de aserción | Clasificación |
|---|---|---|---|
| `city-seeds.test.ts` | `cada seed reproduce su medida: nueve distritos, programa municipal y geometría` | `seed 1: expected { …(12) } to deeply equal { …(12) }` | BASELINE DEBT / NO REGRESSION |
| `district-generation.test.ts` | `conserva los hashes de las fixtures publicadas` | `barrio_del_umbral seed 1: expected { Object (...) } to deeply equal { Object (...) }` | BASELINE DEBT / NO REGRESSION |
| `tick-conservation.test.ts` | `mantiene el digesto de carreras largas al optimizar el coste del tick` | `expected [ …(10) ] to deeply equal []` | BASELINE DEBT / NO REGRESSION |
| `vd7a-multiparcel.test.ts` | `K · la huella puede cruzar la frontera catastral interna` | `expected false to be true` | BASELINE DEBT / NO REGRESSION |

No hay una nueva aserción fallida ni cambio de fingerprint entre `develop` y la rama integradora.
Estas cuatro deudas no bloquean la convergencia visual, pero sí deben resolverse antes de declarar
la suite de simulación completamente verde.
