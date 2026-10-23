# Roadmap condensado

## Ahora — Fase 3 / Vertical Slice

Implementar y validar el bucle jugable sobre el núcleo de Gate 1:
- parcelas y compra;
- caja y libro económico;
- producción material;
- construcción y baseline de crews agregadas, a sustituir en la validación por agentes físicos;
- tenants, ocupación y renta;
- upgrade;
- rival determinista;
- riesgo ilegal y policía mínima;
- una ordenanza municipal;
- UX y save/load integral.
- spike mínimo de agentes, daño e incidentes (WP2.15 / D-061).

Restricciones:
- no player == company;
- ownership separado de control;
- actor explícito en comandos relevantes;
- organizaciones independientes.

No implementar todavía:
- fiscalidad avanzada;
- banca;
- seguros;
- política compleja;
- roles jugables alternativos;
- life simulation.

## Estado del baseline de Gate 2

El candidato económico funcional está implementado y es jugable en navegador. La prueba manual del
responsable fue OK, WP2.15 está cerrado y Gate 2 tiene `CONDITIONAL GO`. La condición restante es
WP2.14: dirección visual, provenance, métricas y recomendación antes de producir arte representativo.
WP2.15 no amplía el producto a life simulation: prueba personas funcionales, trabajo físico,
mantenimiento, sabotaje, fuego y consecuencias espaciales con alcance mínimo.

La experiencia sigue siendo Landlord/Entrepreneur.

La producción física localizada de WP3.2 ya está cerrada para el slice funcional; finanzas, deuda,
fiscalidad, seguros, zoning, subastas y automatización siguen siendo los próximos incrementos de
Fase 3. `InvestInProduction` sólo permanece para migrar instalaciones legacy.

## Vertical slice

Prioridad funcional:
- producción física localizada: fábricas construibles, aptitud de parcela y mercado alternativo;
- impuestos/tasas principales;
- mantenimiento;
- deterioro;
- seguros;
- deuda bancaria;
- liquidez;
- zonificación;
- licencias;
- subastas;
- estados financieros simplificados;
- arte representativo;
- mejor IA;
- política municipal;
- automation;
- cloud save.

## Alpha sistémica

Añadir:
- distritos generados;
- housing demand;
- employment;
- municipal budget;
- public services;
- public contracts;
- multidimensional reputation;
- imperfect information;
- macro events;
- society;
- elections;
- macroeconomy.

Esta fase construye buena parte del sustrato necesario para futuras perspectivas.

## Post-producto / expansiones

Orden conceptual recomendado:
1. Politician / Mayor.
2. Criminal.
3. Bank / Investor.
4. Contractor.
5. Union / Media si aportan suficiente profundidad.
6. Strategic Citizen.
7. Full life simulation sólo si todo el sistema anterior está consolidado.

Posibles capacidades futuras:
- roles transitables;
- multirol;
- Career Events;
- Gameplay LOD;
- trayectoria vital;
- envejecimiento;
- herencia/dinastía.

## Regla

Un sistema puede estar aprobado conceptualmente sin pertenecer al Gate actual.

Preservar opcionalidad no significa implementar anticipadamente.
