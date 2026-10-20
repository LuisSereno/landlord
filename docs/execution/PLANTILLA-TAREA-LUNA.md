# Plantilla de tarea para Luna

Copiar esta plantilla para cada tarea. Sustituir todos los marcadores. Si una sección no aplica, escribir `No aplica` y explicar en una frase.

````md
# [ID] — [resultado concreto en imperativo]

Estado: READY
Gate: [Gate 1 / Gate 2 / Vertical slice / ...]
Tipo: [SPIKE | ADR | FEATURE | ENABLER | TEST | DOC | OPS]
Responsable: [nombre/agente]
Dependencias: [IDs DONE]
Estimación máxima: [0,5 h / 1 h / 2 h / 4 h]

## Resultado esperado

[Una oración que describa el cambio observable, no la actividad.]

## Problema que resuelve

[Problema de jugador, riesgo técnico o condición del gate.]

## Contexto obligatorio

Leer únicamente:
- `AGENTS.md`;
- `[ruta y sección exacta]`;
- `[contrato o test relacionado]`.

## Alcance

Modificar/crear:
- `[ruta prevista]` — [responsabilidad].

Implementar:
1. [acción explícita];
2. [acción explícita];
3. [acción explícita].

## Fuera de alcance

- [comportamiento que podría parecer relacionado];
- [refactor o sistema futuro];
- cambios en [módulo].

## Contrato

Entrada:
- [tipo, unidad, restricciones].

Salida:
- [tipo y semántica].

Errores/rechazos:
- `[CODE]`: [condición exacta].

Invariantes:
- [siempre cierto];
- [determinismo/ownership/dinero/tiempo].

## Pasos de implementación

1. [paso mecánico y localizado].
2. [paso mecánico y localizado].
3. [añadir tests].
4. [actualizar documentación si aplica].

No elijas nuevas librerías ni cambies contratos públicos. Si el contrato descrito no encaja con el código real, detente y comunica la discrepancia.

## Casos de aceptación

- Dado [estado], cuando [acción], entonces [resultado].
- Dado [estado inválido], cuando [acción], entonces [rechazo] y el estado no cambia.
- Repetir con la misma seed y comandos produce [evidencia idéntica].

## Tests requeridos

- `[nombre del test]`: [qué demuestra].
- `[nombre del test]`: [qué demuestra].

Ejecutar:
```sh
[comando exacto]
```

## Impactos

- Persistencia/saves: [ninguno o detalle y migración].
- Rendimiento: [ninguno o medición].
- IP: [ninguno o revisión].
- Player model: [actor, organization, ownership, capability].

## Definition of Done

- [ ] Comportamiento implementado sólo dentro del alcance.
- [ ] Tests requeridos verdes.
- [ ] Typecheck/lint verdes.
- [ ] Sin `Math.random`, `Date.now` ni lógica de dominio en UI.
- [ ] Documentación afectada actualizada.
- [ ] Resumen final con archivos, checks y decisiones no tomadas.
````

## Ejemplo de tamaño correcto

`G1-WP03-T02 — Exportar e importar el estado del PRNG` es una tarea adecuada si el algoritmo y el formato ya se decidieron. “Implementar determinismo” no lo es: mezcla selección de algoritmo, reloj, orden de sistemas, serialización, IDs y tests.

## Instrucción breve reutilizable para Luna

> Ejecuta únicamente la tarea adjunta. Respeta `AGENTS.md`. No amplíes alcance ni adoptes decisiones nuevas. Lee las rutas indicadas, inspecciona primero el código real, implementa el cambio y sus tests, ejecuta exactamente los checks solicitados y entrega un resumen de archivos y resultados. Si falta un contrato o aparece una contradicción documental, detente y describe el bloqueo con evidencia.
