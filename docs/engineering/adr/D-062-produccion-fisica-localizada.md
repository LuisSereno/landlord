# D-062 — Producción física localizada después de Gate 2

Estado: **Aceptada para el Vertical Slice**
Fecha: 2026-10-23

## Contexto

Gate 2 necesitaba validar rápidamente la decisión entre comprar materiales en mercado y producirlos
internamente. Para ello se introdujo una abstracción mínima: cada organización dispone de instalaciones
lógicas inactivas y el comando `InvestInProduction` paga un coste para activarlas.

Ese modelo ha permitido probar ciclos, costes operativos, inventario y la alternativa mercado/producción,
pero la instalación no ocupa una parcela, no se construye, no es un `Building` y queda aislada de
condition, integridad estructural, fuego, reparación, sabotaje, zoning y valor del suelo.

La abstracción resulta adecuada para el Gate que se está evaluando, pero no debe convertirse en el
modelo definitivo.

## Decisión

Después de cerrar Gate 2, la producción propia de materiales se materializará mediante edificios
productivos construibles sobre parcelas.

El loop objetivo será:

```text
comprar parcela
-> construir instalación productiva
-> completar WorkOrder con crews
-> producir lentamente según calendario
-> almacenar material
-> consumirlo en construcción
```

El mercado de materiales seguirá disponible en paralelo como alternativa inmediata.

### Localización y aptitud

Las parcelas dispondrán de modificadores productivos data-driven por recurso o familia productiva.
La localización debe importar: una parcela puede ser especialmente adecuada para una producción y
mediocre para otra.

El modelo concreto se cerrará en el Vertical Slice, pero utilizará enteros/fixed-point y no floats
autoritativos.

### Integración sistémica

Una fábrica física es un activo normal y participa en los sistemas existentes o futuros aplicables:

- ownership y valor del suelo;
- zoning;
- coste y tiempo de construcción;
- crews/WorkOrders;
- condition y structuralIntegrity;
- mantenimiento y reparación;
- incendios y ruina;
- sabotaje;
- fiscalidad y seguros cuando existan;
- policies/modifiers aplicables.

### Mercado frente a integración vertical

La decisión debe conservar un trade-off:

- mercado: disponibilidad inmediata, no consume parcela, evita inversión industrial, pero expone a precio;
- producción propia: menor coste/autonomía potencial, pero exige suelo, capital, tiempo, operación y riesgo.

### Significado de inversión

Cuando este modelo se implemente, `InvestInProduction` deja de ser una acción normal de UI.
"Invertir" pasa a significar ampliar/mejorar una instalación física existente: capacidad,
eficiencia, almacenamiento, seguridad o control ambiental.

Los comandos/saves antiguos conservarán compatibilidad mediante una migración explícita.

## Alcance

Se programa como **WP3.2 del Vertical Slice** y no modifica los criterios de aceptación del Gate 2
que se está probando.

No incluye todavía:

- minas o canteras simuladas;
- extracción física de materias primas;
- energía;
- redes logísticas complejas;
- cadenas industriales de varios intermedios;
- trabajadores industriales adicionales por edificio;
- simulación tipo factory-game.

## Consecuencias

### Positivas

- conecta producción con suelo e inmobiliario;
- hace visible y atacable la infraestructura económica;
- da significado estratégico a parcelas industriales;
- integra WP2.15 con economía;
- hace más legible mercado frente a integración vertical;
- permite upgrades productivos coherentes.

### Costes

- requiere migrar la abstracción `ProductionFacility`;
- aumenta el catálogo de edificios y balance;
- exige definir suitability, zoning y UI de productividad;
- obliga a ampliar la IA rival.

## Evidencia requerida

WP3.2 no se considerará terminado hasta demostrar:

1. construcción de una instalación desde parcela vacía;
2. cero producción antes de finalizar la obra;
3. producción automática posterior;
4. dos parcelas con distinto rendimiento para la misma instalación;
5. compra equivalente en mercado;
6. interrupción por daño/fuego y recuperación por reparación;
7. decisión rival entre mercado y producción sin reglas privilegiadas;
8. save/load determinista y migración del baseline de Gate 2.
