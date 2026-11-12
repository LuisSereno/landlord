# Integración a `develop` — plan y acta (2026-11-12)

Rama origen: `wip/vh-world-visual-foundation` @ `b587d97` (árbol limpio).
Destino: `develop` @ `b9356cf` (local == `origin/develop`).

## Estado verificado (solo lectura)

- `develop` es **ancestro estricto** de la rama origen: **243 commits por integrar, 0 por detrás** →
  integración **sin conflictos** (fast-forward posible; se recomienda merge `--no-ff` vía PR).
- `origin/wip/vh-world-visual-foundation` @ `c9a592b` (por detrás; el push de la rama es fast-forward).
- CI (`.github/workflows/ci.yml`) se dispara en `push: main` y `pull_request` (cualquier destino).
  **Un push directo a `develop` NO lanza CI; un PR `wip→develop` sí.**
- La nota antigua de divergencia en `b750fb3` está superada: `develop` local y remoto coinciden.

## Estrategia

PR `wip/vh-world-visual-foundation → develop` para obtener CI + revisión humana; merge `--no-ff`
tras aprobación y CI verde. El riesgo no es de conflictos (ancestro) sino de **CI (presupuesto de
binarios)** y de superficie (243 commits: World Visual Foundation V.h/V.j/V.k/V.l + V.d-7C + hardening D-106).

## Precondiciones / STOP (decisión del responsable)

1. **Autorización explícita** de push de rama, apertura de PR y merge a `develop`. *(Otorgada para la
   mecánica push+PR en esta sesión; el merge queda gateado.)*
2. **Presupuesto de binarios (D-105):** `pnpm art:binaries:check` falla con 16 binarios >1 MiB
   (`apps/web/public/assets/runtime/blender-day/`, `docs/art/day-candidates/`) trackeados y sin excepción
   en `BINARY-ALLOWLIST.json`. Es deuda **preexistente** y **bloqueante del CI**. Decidir: excepciones
   nombradas (D-100), gitignore o LFS. **STOP hasta decidir.**
3. **Playtest humano de V.d** sigue `PENDING HUMAN PLAYTEST`. Integrar a `develop` no cierra V.d; el
   responsable decide si integra antes o después. **STOP de producto.**
4. CI-equivalente completo en verde (incl. smokes de navegador y `build`).

## Pasos

Ejecutados en esta sesión (autorizados): push fast-forward de la rama y apertura del PR `wip→develop`
(cuerpo en `integration-pr-body.md`). **No ejecutado:** merge a `develop` (gateado por STOP 2/3/4).

Pendientes (comandos exactos, no ejecutados):

```bash
# Tras resolver STOP 2 y con CI verde + aprobación:
git checkout develop && git pull --ff-only origin develop
git merge --no-ff wip/vh-world-visual-foundation
# Verificación post-merge (checklist abajo) y, con autorización:
git push origin develop
```

## Checklist de verificación (CI-equivalente + gates)

Estado local a `b587d97`: ✅ verde · ⛔ bloqueado/preexistente · ⬜ pendiente de correr.

- ✅ `pnpm lint` (incl. `check:architecture`)
- ✅ `pnpm typecheck`
- ✅ `pnpm test` (shared 80, simulation 593+20skip, web 277+4skip; 0 failed)
- ✅ `pnpm format:check`
- ✅ `pnpm art:licenses:check`
- ✅ `pnpm art:jobs:validate`
- ⛔ `pnpm art:binaries:check` — 16 violaciones D-105 (preexistente; STOP 2)
- ⬜ `pnpm build`
- ⬜ `pnpm smoke:phase2` · ⬜ `pnpm smoke:alpha` · ⬜ `pnpm smoke:art-lab` (Chromium)
- ⬜ `pnpm art:blender:check`
- Gates del hardening (ya verdes en la rama, re-correr post-merge):
  - ✅ `PLACEMENT_REACHABILITY=1 PLACEMENT_REACHABILITY_SEEDS=1..60 pnpm placement:reachability`
  - ✅ `pnpm gameplay:acceptance`
  - ✅ `pnpm balance:playable` · ✅ `pnpm services:balance` · ✅ `pnpm system:cost:monthly`
  - ⬜ `pnpm fabric:gate` (100 seeds × 9 perfiles)

## Conflictos y goldens

Sin conflictos esperados (ancestro). Digestos dorados y fixtures ya regenerados con atribución en la
rama; si tras el merge hubiera drift, regenerar **sólo** con atribución medida, nunca a mano para verde.

## Rollback

`git revert -m 1 <merge-commit>` en `develop` (el `--no-ff` facilita revertir el bloque), o
`git reset --hard b9356cf` antes de push. Ninguna acción destructiva sin autorización.

## Riesgos / deuda que viaja con la integración

Presupuesto de binarios D-105 (bloqueante CI); playtest humano V.d; escala municipal y
`delegated_deferred` dominante (señales preexistentes); cierre mensual p95 38,47 ms fuera de D-065;
orientación física P2; no-determinismo raster byte-level de Blender; asimetría save/load `travel:null`.

## Referencias

- Acta del hardening: `integration-hardening-2026-11-12.md` (gates A–G, D-106, investigación EIO).
- Cuerpo del PR: `integration-pr-body.md`.