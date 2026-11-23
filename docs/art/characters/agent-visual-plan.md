# Planificador visual de agentes

Estado: **implementado y probado; no conectado a Phaser**.

`apps/web/src/isometric/agent-visual-plan.ts` es una función pura que traduce agentes publicados por
`ViewProjectionV3` a descripciones visuales. No importa simulación, no muta la proyección y no
necesita que el agente pertenezca a una cuadrilla.

## Entrada

```ts
const plans = planAgentVisuals(projection, {
  appearances,
  previous,
});
```

- `projection` aporta identidad, organización, especialidad, distrito, celda, siguiente celda,
  salud, estado, `atBase`, `returningToBase`, tick y cadencia de movimiento.
- `appearances` es un inventario explícito de sprites disponibles. Cada entrada declara
  especialidad, ID de apariencia, ID de sprite, estado (`runtime_ready` o `candidate`), cuatro
  direcciones y animaciones `idle`/`walk`.
- `previous` es memoria opcional de presentación para conservar el rumbo de llegada cuando ya no
  hay `nextCell`. No se persiste ni entra en el dominio.

## Selección determinista

La apariencia se elige entre las candidatas `runtime_ready` completas de la misma especialidad,
ordenadas por ID y seleccionadas con FNV-1a de `agent.id`. La organización, el tick, el reloj real y
el orden del inventario no alteran la elección. Dos agentes conservan IDs independientes aunque
compartan variante.

El inventario puede usar `chr_worker` para `construction_worker`, preservando el contrato actual.
Un candidato aislado nunca se trata como runtime-ready.

## Visibilidad y movimiento

- Sólo se devuelven agentes cuyo `districtId` coincide con `observedDistrictId`.
- Los agentes con `atBase: true` se omiten, igual que la escena principal.
- `nextCell` determina rumbo, animación e interpolación. Sin paso se usa `idle` y se conserva el
  último rumbo conocido.
- Herido y muerto fuerzan `idle` y reciben un glifo de salud visible; no desaparecen por falta de
  clip.
- Técnico y enforcer se procesan sin consultar `economy` ni asignaciones de cuadrilla.

## Salida y fallback

Cada plan incluye sprite/apariencia, animación, dirección, celda autoritativa, celda renderizada,
estado, organización y salud. La organización se comunica con forma + color de marcador; nunca se
tiñe el sprite para inventar una profesión.

Si falta una apariencia válida, el plan sigue existiendo con `renderKind: "marker"`,
`markerKey` por especialidad y un motivo explícito:

- `missing_specialty`;
- `no_runtime_appearance`;
- `only_candidate_appearance`;
- `incomplete_runtime_appearance`.

Esto evita tanto la desaparición silenciosa como disfrazar un obrero de supervisor, técnico o
enforcer.

## Integración posterior

Cuando termine la fase de edificios, la escena podrá construir el inventario desde el manifiesto
runtime, llamar al planificador y reconciliar sus pools por `agentId`. La integración tocará
`IsometricSpikeScene.ts` y probablemente `crew-presence.ts`/`gameplay-visual-adapter.ts`; ninguno de
esos archivos se modifica en WP-CHAR-01.
