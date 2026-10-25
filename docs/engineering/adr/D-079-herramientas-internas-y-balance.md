# D-079 — Herramientas internas, invariantes y dataset de balance versionado

Estado: aceptada el 2026-10-25 para WP4.14. No añade gameplay: entrega instrumentos de desarrollo y
medición reproducible para que los WPs de contenido no se acepten por impresión.

## Contexto

La Fase 4 acumula sistemas económicos (vivienda, empleo, presupuesto, contratos, reputación,
información, facciones, política, macroeventos y delegación) y sólo el coste del tick tenía un arnés
propio. Faltaba una lectura de balance comparable entre commits, un detector de invariantes y una
validación explícita de los catálogos data-driven. WP4.14 los añade sin abrir UI de desarrollo.

## Decisiones

1. **Las herramientas son arneses opt-in y scripts, no una pantalla de desarrollo.** El repositorio
   ya usa tests opt-in para district, coste del tick, soak y auditoría del Worker. Se mantiene ese
   patrón: `pnpm balance:campaign` (campaña), `pnpm state:inspect` (inspector de estado) y
   `node scripts/build-balance-dataset.mjs` (pipeline de dataset). No se introduce un editor visual
   de datos: el validador es una prueba que corre en CI.

2. **`measureBalance` mide seis familias y no decide nada.** Quiebras (préstamos impagados,
   organizaciones afectadas, subastas abiertas), vacancia (plazas, porcentaje, llegadas, salidas y
   movilidad total), concentración (cuota de la mayor organización, HHI de parcelas y de edificios),
   deuda (principal vivo y atrasos fiscales), presupuesto (reserva municipal, meses en déficit,
   ingresos, gasto y niveles de servicio) y una fila por organización. Es estado derivado: no entra
   en `GameState`, snapshot ni proyección.

3. **`detectInvariantViolations` es la lista de lo que la simulación no puede romper.** Cajas e
   inventarios no negativos y sin exceso de capacidad, contratos coherentes en ambos sentidos
   (edificio↔inquilino), referencias parcela↔edificio, principal y meses de préstamo en rango,
   umbrales de automatización válidos, intervalos e intensidad de macroeventos y niveles de servicio
   0–100. La campaña falla si aparece una sola violación; los tests plantan cada rotura para probar
   que el detector no es decorativo.

4. **Validador de catálogos.** Una prueba permanente comprueba que los edificios declaran costes,
   obra, capacidad, zoning y recursos coherentes; que los segmentos de vivienda apuntan a tipos
   existentes; que las ordenanzas y partidos tienen ids únicos y rangos válidos; que los partidos
   suman los escaños del concejo; que los macroeventos cubren los seis tipos con etiqueta y duración
   positiva; que los perfiles de facción cubren todas las familias; que los perfiles de distrito
   caben en 64×64 y declaran el zoning completo; y que las políticas numéricas conservan sus bandas.

5. **Campaña con seeds registradas y dataset versionado.** `alpha-baseline-v1.json` fija 8 semillas,
   12 meses, 200 parcelas y cuatro estrategias (pasivo, mantenimiento equilibrado, delegación con
   mantenimiento diferido y delegación con mantenimiento equilibrado). El dataset incluye filas por
   semilla, agregados, comparaciones por parejas y banderas de balance. El test regular valida el
   esquema, recalcula cada comparación desde las filas y exige cero invariantes rotas; el pipeline
   `scripts/build-balance-dataset.mjs` reproduce el archivo desde la salida cruda.

6. **Resultado de la baseline, registrado sin maquillar.** La delegación con mantenimiento diferido
   gana caja a la estrategia pasiva en 8/8 semillas y elimina la vacancia medida. El mantenimiento
   equilibrado pierde caja en 8/8 frente a la pasiva porque sube condición, renta y vacancia
   (31,84 % frente a 3,13 %) y además cuesta: se registra la bandera
   `maintenance_balanced_dominated_on_cash`. WP4.14 entrega la detección; corregir el balance es
   tuning posterior y no se mezcla con las herramientas.

## Consecuencias

- Cualquier cambio económico puede compararse contra `alpha-baseline-v1` con las mismas seeds.
- Un catálogo roto (zona inexistente, escaños que no suman, duración cero) rompe CI antes de llegar
  a la partida.
- Las decisiones de LOD siguen pendientes de D-065: el dataset no sustituye la medición de coste.
- El hallazgo de mantenimiento queda como deuda de balance en `ai-context/KNOWN-GAPS.md`; ningún
  número de gameplay se ajusta en este WP.
