# V.d.6 — Presentación y dressing contextual

Fecha: 2026-10-29. Rama: `develop`.

## Alcance ejecutado (PLAN_improvements.md §V.d.6)

1. **Adapter multi-cell.** El plano de suelo pinta todas las celdas de cada parcela (`cells`), no
   sólo el ancla. El apron se dibuja alrededor de cada celda y la decoración evita todas ellas.
   `gameplayGeometryKey` incluye el conjunto canónico de celdas, por lo que dos proyecciones con la
   misma topología no re-bakean por caja, tick o reputación.
2. **Formas cívicas.** La factoría procedural publica seis assets nuevos (ayuntamiento, colegio,
   clínica, comisaría, parque de bomberos y mercado), con los cuatro estados y provenance
   `original`. El adapter mapea esos tipos a su asset propio en vez de reutilizar vivienda o
   comercio. El manifiesto queda en 145.076 bytes, dentro del budget Alpha de 200 KB.
3. **Overlays.** Además de propiedad, rentabilidad, condición, zoning, riesgo, valor y servicios,
   la capa de mapa añade uso, código urbanístico y rol urbano. El inspector de equipamiento publica
   demanda, capacidad efectiva, cobertura y saturación; el de parcela publica el desglose de valor.
4. **Picking.** La selección resuelve una parcela si la celda pulsada pertenece a cualquiera de sus
   celdas, no sólo al ancla; la identidad visible sigue siendo un único `ParcelId`.
5. **Dressing existente.** Se conservan árboles, farolas, semáforos, bancos, papeleras y vehículos
   deterministas; plazas y parques se pintan desde `publicSpaces` y los edificios municipales usan
   sus formas cívicas. Los props siguen siendo derivados y efímeros.
6. **Capturas golden.** Seis capturas locales en `docs/art/golden/vd6/`: centro cívico con panel,
   centro con HUD oculto, residencial, industria con cobertura de seguridad, valor del suelo y
   ordenanza de densidad.

## Gate visual, criterio por criterio

| Criterio | Resultado | Evidencia |
|---|---|---|
| Con HUD oculto se distinguen centro, residencial, industria, verde, suelo público y parcelas comprables | PASS | `vd6-centro-hud-off.jpg`: edificio cívico, plaza pavimentada, suelo público verde y parcelas privadas en marrón; overlays de rol/uso/valor en las otras capturas |
| No hay objetos sobre vías, huellas o espacios incompatibles | PASS | planificador de decoración y mobiliario excluye vías/parcelas; tests de adapter y `planGameplayDecorations` |
| El distrito activo cambia sin fuga de sprites ni re-bake continuo | PASS | `pnpm smoke:alpha` cambia de distrito y conserva caja; la clave de geometría excluye tick/caja |
| Picking correcto a 0.5×, 1×, 2× y 2.5× | PASS | `pnpm smoke:alpha` recorre los cuatro zooms y resuelve celdas; selección por cualquier celda de la parcela en App |
| Perfil denso mantiene el budget vigente | PASS | manifiesto 145.076 B < 200.000; 11 edificios × 4 estados y 2 personajes; sin binarios nuevos |
| Ningún asset copia identidad, layout o trade dress de otra IP | PASS | seis SVG procedurales originales, provenance `original`; sin material de terceros en este cambio |

## Verificación ejecutada

- `pnpm lint` — verde (1 warning de `console.log` en el gate de evidencia).
- `pnpm typecheck` — verde en shared, simulation y web.
- `pnpm format:check` — verde.
- Tests: shared **49**, simulation **376** (13 skipped de harnesses opt-in), web **92**.
- `pnpm build` — verde.
- `pnpm smoke:alpha` — verde.
- Capturas: `docs/art/golden/vd6/vd6-*.jpg` (6).

## Deuda y riesgos

- **Manifest V2.** Se conserva el contrato V1: ya declara cuatro estados, huella, pivote,
  orientaciones de props y provenance por asset. Las orientaciones de edificios asimétricos y la
  huella de dominio explícita por tipo quedan como deuda de Beta; los assets cívicos actuales usan
  el pivote y la huella compartidos.
- **Arte cívico procedural.** Las seis formas cívicas son SVG originales de la factoría; no hay
  modelos Blender específicos. La ruta Blender sigue disponible para sustituirlos sin cambiar el
  contrato runtime.
- **Capturas golden locales.** Son JPEG de evidencia visual, no un pixel-diff cross-environment:
  el pipeline ya documentó que ese diff es inestable fuera de un entorno fijo (D-081).
- **Servicio saturado.** La captura de industria muestra la capa de seguridad; la saturación se
  explica en el inspector con demanda/capacidad, no con un degradado continuo.
- **Densidad.** La captura de la ordenanza muestra el overlay de código; el efecto de +1 planta se
  valida en `development-density.test.ts`, no en píxeles.

## Cierre de V.d

V.d.0–V.d.6 quedan cerradas. La hardenización final (§6) es la siguiente tarea: fixtures de 12 city
seeds, campaña de dos años en nueve distritos, incendio cross-system con bomberos, colapso/seguro/
reparación/subasta multi-cell, smoke final y actualización del inspector de ciudad.
