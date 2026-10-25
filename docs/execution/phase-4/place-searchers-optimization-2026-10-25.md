# Optimización exacta de `placeSearchers` — paso previo a WP4.13

## Estado

`DONE` el 2026-10-25. Es el paso (3) de la remediación de rendimiento de D-065/D-076, ejecutado
después de WP4.12-R y antes de WP4.13. No añade gameplay ni cambia reglas: transforma un recorrido
cuadrático en uno con la misma selección.

## Cambio

`placeSearchers` (en `housing-market.ts`) recorría, para cada búsqueda, todas las unidades del parque
y recalculaba `desirabilityOf` por cada par búsqueda × unidad. Ahora:

1. filtra las búsquedas colocables una sola vez (mismo orden por id que antes);
2. precalcula la deseabilidad de cada unidad una vez por segmento (3 × unidades en vez de búsquedas ×
   unidades);
3. ordena los candidatos por puntuación descendente y id ascendente —el mismo desempate anterior—;
4. cada búsqueda elige el primer candidato con plaza libre y renta asequible.

La selección es idéntica: los diez digestos dorados de conservación no cambian y los 12 tests de
`housing-market.test.ts` siguen verdes.

## Medición

**A/B del cierre de vivienda sobre el mismo estado** (ciudad de 800 parcelas, mes 7, 9 repeticiones
sobre copias restauradas del mismo snapshot):

| Versión | Mediana | Rango |
|---|---:|---|
| Antes | 19,40 ms | 13,85–31,08 ms |
| Después | 18,15 ms | 14,69–32,05 ms |

**A/B longitudinal del cierre completo** (misma campaña, 4 semillas × 6 cierres):

| Modo | Media antes | Media después | p95 antes | p95 después | Máximo antes | Máximo después |
|---|---:|---:|---:|---:|---:|---:|
| `none` | 28,44 ms | 28,13 ms | 35,84 ms | 31,62 ms | 39,31 ms | 31,70 ms |
| `representative` | 33,64 ms | 32,98 ms | 39,10 ms | 42,55 ms | 40,30 ms | 47,42 ms |
| `max` | 37,60 ms | 34,52 ms | 49,91 ms | 37,65 ms | 61,77 ms | 46,29 ms |

La cola mejora de forma clara en los escenarios cargados (`none` y `max`), que es donde había más
búsquedas que colocar; la media apenas se mueve porque no era el componente dominante. La medición
`natural` (8×6) oscila ±4 % entre ejecuciones y no se usa para atribuir el cambio.

## Hallazgo adyacente (medido, no corregido)

`describeHousingStock` —que ejecuta `buildStock`— tarda por sí solo 17,6 ms de mediana (rango
16,8–31,8 ms) en esa misma ciudad madura, es decir, prácticamente todo el cierre. El coste está en el
recuento de vecinos `O(edificios²)` dentro del radio de servicios. Es el siguiente candidato exacto
antes de plantear LOD; no se toca en este paso para no mezclar alcances. Queda registrado en
`ai-context/KNOWN-GAPS.md`.

## Verificación

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`: verdes (275 + 18 tests).
- Los diez digestos dorados no cambian; la optimización es exacta.
