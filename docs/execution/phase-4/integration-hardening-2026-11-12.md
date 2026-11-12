# Hardening de integración — acta de cierre (2026-11-12)

Rama: `wip/vh-world-visual-foundation`. HEAD de los gates de código: `29e26f9`
(`test: Gate E gameplay automático…`). Los commits posteriores a este HEAD son sólo documentación
(acta, CURRENT-STATE, KNOWN-GAPS). **No se ha hecho merge a `develop`/`main` ni push.**

Objetivo: terminar y revisar críticamente el hardening de integración sobre D-106 (solares de mercado
accionables) y cerrar los gates A–G sin aceptar resultados parciales.

## D-106 — solución adoptada (sustituye la corrección provisional)

La corrección provisional reclasificaba como público todo solar sin proyecto individual, eliminando
solares pequeños con valor real dentro de un complejo multi-parcela. Se sustituyó por:

1. **Evaluación pura y única** `evaluateActionableSite` (`packages/simulation/src/development-placement.ts`):
   contrato de solar (`siteContractRejection`, compartido con `resolveDevelopmentPlacementSite` mediante
   hooks de propiedad/ocupación en los puntos exactos) + `enumerateFootprintCandidates` (retranqueos,
   cobertura, FAR, frente y toque físico de cada parcela requerida). UI, comandos, IA y automatización
   siguen leyendo `enumerateDevelopmentPlacementCandidates`; nadie duplica reglas.
2. **Bucle del generador** `enforceMarketableActionability` (`market-actionability.ts`): tras parcelar,
   evalúa cada solar (individual primero, luego sitios de 2/3 parcelas con
   `enumerateCompatibleDevelopmentSites`); el residuo sin jugada se fusiona con el vecino compatible
   (mismo distrito/manzana/norma) de mayor borde compartido, con veto morfológico (`parcelDepthFits` +
   frente mínimo, el mismo envelope que `validateUrbanFabric`) y preservando el ancla autorada; se
   reevalúa hasta punto fijo; sin salida, queda público/no comercializable.
3. **Mínimos/zoning/oferta:** si la reclasificación rompe mínimos, `validatePlayability` emite el issue y
   el bucle de 12 intentos recompone. La acería tiene garantía ciudad-global: `createCity` recompone el
   primer distrito industrial que pueda hospedar un sitio triple legal (`STEELWORKS_SITE_MISSING`).

Tests: `market-actionability.test.ts` (preservación del solar pequeño multi-parcela, fusión por mayor
borde, ancla, reclasificación, veto morfológico, determinismo, regresión seed 15, paridad con el comando,
acería ciudad-global en seeds 20/33).

## Gates

| Gate | Comando | HEAD | Resultado | Evidencia |
|------|---------|------|-----------|-----------|
| A baseline | `pnpm test` + `test:architecture` | 29e26f9 | **0 failed**: shared 80, simulation 593 (+20 skip), web 277 (+4 skip); guard de arquitectura verde | `/tmp/gateA.log` (local) |
| B sweep | `PLACEMENT_REACHABILITY=1 PLACEMENT_REACHABILITY_SEEDS=1..60 pnpm placement:reachability` | 29e26f9 | 60 seeds: 0 solares sin jugada, 0 complejos que no tocan todas sus parcelas, 9 tipos privados disponibles ciudad-global en cada seed | `docs/execution/phase-4/vd7c-placement-reachability.json` |
| C road-system | `vitest run road-system-acceptance.test.ts` (+ suite) | 80bfa57 | v2/ave3/full/motorway: roles, laneSense, medianas, intersecciones, costuras mixtas; cobertura y valor leen el corredor en v4 | `packages/simulation/src/road-system-acceptance.test.ts` |
| D browser QA | `node scripts/vh-world-visual-capture.mjs` + `scripts/vd-road-qa-capture.mjs` | d2b9d4b | 27 capturas distrito + 5 detalles + 3 sheets + 8 viales; revisadas una a una; 0 pageerrors | `docs/art/world-visual-foundation/pixel-qa/` (+ `road-qa-manifest.json`) |
| E gameplay | `pnpm gameplay:acceptance` | 29e26f9 | 9 tipos privados + acería multi-parcela construidos con comandos reales; renta cobrada; reparación/incendio/ruina/ClearRuin; save/load idempotente; automatización; 15 tipos en ciudad; determinismo | `docs/execution/phase-4/gameplay-acceptance.json` |
| F balance/rendimiento | `pnpm balance:playable`, `pnpm services:balance`, `pnpm system:cost:monthly` | 29e26f9 | verde. `delegated_deferred` 16/16 por caja (señal preexistente). Cierre mensual maduro p95 **38,47 ms** (800 parcelas, 48 muestras) | `docs/execution/phase-4/vd-hardening-monthly-close.json` |
| G docs | edición de CURRENT-STATE / KNOWN-GAPS / acta | (docs) | reconciliación documental; sólo se limpia lo efectivamente cerrado | este archivo |

## Investigación EIO (Gate A)

- **Reproducción histórica:** el acta de V.d-UX documentó `Input/output error (os error 5)` en todo spawn
  de `pnpm`/`git` cuando el `PATH` incluía entradas de un SSD externo desconectado
  (`/media/luis/CacheSSD/...`) y `/snap/bin` roto; `execvp` devuelve EIO (no ENOENT) al recorrer esas entradas.
- **Entorno actual:** el SSD está montado (autofs + ext4, `idle-timeout=5min`). Con el `PATH` heredado,
  20/20 spawns de `git` y 10/10 de `pnpm` succeed; **0 EIO** en la corrida completa de Gate A.
- **Frecuencia hoy:** 0/30 spawns; el EIO sólo aparece si el autofs expira (SSD ocioso >5 min) durante una
  corrida larga. Es un fallo de **entorno**, no del repo, del wrapper, de pnpm, del TTY ni del runner.
- **Conclusión / mitigación:** los gates se ejecutan con un `PATH` saneado
  (`/home/luis/.local/share/nodejs/v24.19.0/bin:…:/usr/bin:/bin`), que evita las entradas autofs. No se
  aceptó «el binario directo pasa» como solución: se verificó `pnpm` completo bajo PATH limpio y se aisló
  la causa raíz (autofs/PATH). No se tocó `package.json` ni el gestor por este motivo.

## Deuda declarada (no cerrada por este hardening)

- Playtest humano de V.d: `PENDING HUMAN PLAYTEST` (los smokes y el gameplay automático no lo sustituyen).
- Escala del programa municipal bajo desarrollo extremo (>75 %) y `delegated_deferred` dominante por caja:
  señales de balance preexistentes, reproducidas idénticas antes del hardening.
- Cierre mensual fuera del presupuesto p95 / disparador de 5 ms de D-065 (p95 maduro 38,47 ms medido aquí);
  el disparador de 60 ms no es evaluable con el harness actual (deuda de instrumentación, KNOWN-GAPS).
- Orientación física de edificios no representada (P2, H2-03); no-determinismo raster byte-level de Blender (V.i).
- Asimetría preexistente de save/load en agentes (`travel:null` vs ausente al restaurar): el gate E usa
  idempotencia de carga (restaurar dos veces) como propiedad de determinismo; la igualdad live↔restaurado
  para agentes con `travel:null` queda como deuda de fidelidad de snapshot, no introducida por este hardening.

## Regla de cierre

No se declara terminado nada cortado por timeout del runner: todos los gates anteriores completaron con
código de salida 0 y sus aserciones. La integración a `develop`/`main` y el push quedan pendientes de
revisión humana.