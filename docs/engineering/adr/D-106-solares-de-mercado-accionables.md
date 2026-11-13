# D-106 — Los solares de mercado son oportunidades accionables

Estado: aceptada el 2026-11-12 por el responsable.

## Decisión

Una parcela vacante con `disposition: "marketable"` no puede ser una compra trampa. En el estado
recién generado debe pertenecer a, como mínimo, un proyecto privado permitido que tenga una colocación
autoritativa válida.

La oportunidad puede ser de dos formas:

1. un proyecto de una parcela colocado en la propia parcela; o
2. un proyecto de dos o tres parcelas cuya selección exacta incluya esa parcela, con parcelas
   contiguas, misma norma urbanística y una huella válida que toque físicamente todas ellas.

No se exige que toda parcela pequeña admita un edificio aislado: eliminaría la decisión de ensamblar
suelo para industria. Tampoco se exige que sea asequible como primera compra. Se exige que no se venda
como edificable si no participa en ninguna jugada legal. Una geometría residual sin esa salida debe
ser pública/no comercializable o fusionarse durante la generación; no puede aparecer en el catálogo
de compra.

## Implementación y gate

`placement-reachability.test.ts`, activado con `PLACEMENT_REACHABILITY=1`, recorre los proyectos que
puede preparar una jugadora en una ciudad nueva. Además de registrar selecciones concretas sin
candidata (información útil para razones UX), acumula cada parcela que participa en al menos una
colocación válida y falla si alguna parcela de mercado queda fuera. El contrato se evalúa contra la
misma enumeración y colocación autoritativas que usan UI, comandos, IA y automatización.

Esto distingue correctamente un intento inválido —por ejemplo, un taller de 8 celdas sobre un solar
de 7— de un solar invendible: el primero es normal si esa parcela participa en otra opción legal; el
segundo es un defecto de generación.

Relacionadas: D-096 (conjuntos multi-parcela exactos), D-097 (enumeración determinista compartida) y
V.d-7C.

## Implementación (2026-11-12)

- `siteContractRejection` y `siteFrontagesFor` (`packages/simulation/src/development-placement.ts`)
  extraen el contrato de solar del comando como función pura. `resolveDevelopmentPlacementSite`
  delega en ella inyectando propiedad y ocupación en los puntos exactos donde antes las hacía en
  línea: mismos códigos de rechazo y mismo orden.
- `evaluateActionableSite` = contrato de solar + `enumerateFootprintCandidates` (retranqueos,
  cobertura, FAR, frente y toque físico de cada parcela requerida). Es la evaluación única de
  «sitio accionable» que consumen el generador y las sondas; UI, comandos, IA y automatización
  siguen leyendo `enumerateDevelopmentPlacementCandidates`, que comparte exactamente estas reglas.
- `enforceMarketableActionability` (`packages/simulation/src/market-actionability.ts`) se ejecuta
  tras parcelar: evalúa cada solar marketable (proyecto individual primero; si no, sitios de dos o
  tres parcelas con `enumerateCompatibleDevelopmentSites`). El residuo sin jugada legal se fusiona
  con el vecino compatible (mismo distrito, manzana y norma) de mayor borde compartido, con veto
  morfológico (`parcelDepthFits` + frente mínimo, el mismo envelope que `validateUrbanFabric`), y
  se reevalúa hasta punto fijo. El ancla autorada conserva su id y su referencia económica. Sin
  salida, el solar queda público/no comercializable (valor 0, municipio). Si la reclasificación
  rompe mínimos de parcela, zoning o asequibilidad, `validatePlayability` emite el issue y el bucle
  de doce intentos recompone la geometría.
- La corrección provisional que reclasificaba todo solar sin proyecto individual queda sustituida:
  eliminaba solares pequeños con valor real dentro de un complejo multi-parcela.
- Tests: `market-actionability.test.ts` (preservación del solar pequeño multi-parcela, fusión por
  mayor borde, ancla, reclasificación, veto morfológico, determinismo, regresión de la seed 15 y
  paridad del evaluador puro con la enumeración del comando).
- Impacto medido en el corpus canónico: sólo la seed 2026 cambia (718 parcelas, 703 marketables,
  15 públicas; la validación de mínimos recompone +1 manzana industrial); `city-fixtures.ts`
  regenerado con atribución y la envolvente 700–760 intacta. Barrido de las seeds 1–30: cero
  solares trampa y cero residuos públicos con valor multi-parcela.
