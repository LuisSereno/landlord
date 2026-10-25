# WP4.11-H.1 — Follow-up de corrección del hardening Alpha

## Estado

`IN_PROGRESS`. Mini-checkpoint autorizado por la auditoría humana de WP4.11-H (baseline `83cc25a`)
antes de abrir WP4.12. Seis puntos, ninguno de gameplay nuevo.

## Baseline

- HEAD inicial: `83cc25aac6531145e18dc0b76fa17820d0613883`
  (`docs: reconcile phase4 alpha state after hardening`), verificado igual que `origin/main` tras
  `git fetch` y con el árbol limpio. Ese es exactamente el commit auditado, sin trabajo posterior.
- Ninguno de los seis hallazgos estaba corregido por otro trabajo: se relleyeron `commands.ts`,
  `systems.ts`, `snapshot.ts`, `canonical-state.test.ts`, `system-cost.ts`, `App.tsx`, `reputation.ts`
  y los ADR D-065/D-071/D-075 antes de tocar nada.
- Ninguna corrección revierte una decisión de WP4.11-H: D-075 se mantiene y este checkpoint la
  amplía (D-076).

## Hallazgos y correcciones

### 1 — El concejo no tenía autoridad real sobre su propia ley (`P1`)

- **Finding:** `WithdrawPolicy` seguía aceptando `["proposed", "active"]` y el botón de la UI se
  habilitaba para ambos, igual que en WP3.11.
- **Impacto:** `elecciones → partido gobernante → ordenanza impuesta por el concejo → la jugadora
  pulsa "Retirar política actual" → la ley desaparece`. Contradice la premisa de D-074 (una regla del
  distrito cambia sin que la jugadora la pida) y, además, silencia al gobierno: el debate siguiente
  estaba programado contra `expiresAtTick`, así que retirar antes deja `nextDebateTick` en el futuro
  lejano.
- **Causa raíz:** la regla nació en WP3.11, cuando toda la política la controlaba el jugador, y WP4.11
  cambió el modelo sin revisar el comando heredado.
- **Fix:** `WithdrawPolicy` sólo retira `proposed` (D-076 punto 1). La ley en vigor caduca por
  `MUNICIPAL_POLICY_DURATION_TICKS`. El botón pasa a *Retirar propuesta actual* y sólo se habilita
  con una propuesta sobre la mesa.
- **Tests:** `municipal-politics.test.ts` — una ordenanza realmente impuesta por el concejo (semilla
  buscada hasta que el debate prospera) rechaza la retirada con `POLICY_NOT_AVAILABLE` y conserva su
  `expiresAtTick`; al llegar a la caducidad la mesa queda libre y `ProposePolicy` vuelve a aceptarse.
  `phase2.test.ts` — la ordenanza aprobada por lobby ya no se retira y sus modificadores siguen
  aplicados (coste 3300 u.).
- **Docs:** la nota de WP3.11 que afirmaba "retira una propuesta o una política activa" queda
  marcada como parcialmente superendada por D-076.

## Verificación reproducible

Pendiente del cierre: `format:check`, `lint`, `typecheck`, `test`, `build` y CI remoto en verde.
