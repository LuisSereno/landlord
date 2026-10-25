# Roadmap condensado

## Histórico — Fase 3 / Vertical Slice (cerrada)

> Esta sección describe el alcance con el que se construyó el slice. Los sistemas que aquí figuran
> como "no implementar todavía" (fiscalidad, banca, seguros, política) ya están implementados en
> Fase 4; el estado vigente está en `PROJECT-STATE.md`.

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

## Alpha sistémica (Fase 4)

Cerrado: distritos generados (4.1), coste medido y LOD latente (4.2), mercado de vivienda (4.3),
empleo (4.4), presupuesto municipal (4.5), servicios urbanos (4.6), contratos públicos (4.7),
reputación (4.8), información imperfecta (4.9), IA estratégica y facciones (4.10), política y
elecciones (4.11) y hardening transversal (4.11-H, D-075).

Pendiente: macroeventos (4.12), automatización y delegación (4.13), herramientas internas y balance
(4.14), pipeline artístico y escalado (4.15), robustez y cierre Alpha (4.16).

Diferido dentro de lo ya cerrado:
- expediente de inteligencia propio de las facciones y varias facciones autónomas (WP4.10);
- planificador de largo horizonte (disparador: decisiones que necesiten más de un tick);
- commuting explícito por agente;
- optimización del cierre mensual de vivienda (disparador de D-065 alcanzado en WP4.11-H).

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
