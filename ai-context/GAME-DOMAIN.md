# Dominio del juego

## Entidades/agregados conceptuales

### Game
Tiempo, seed, mundo y economía global.

### District
Parcelas, estadísticas, servicios, población, accesibilidad y condiciones urbanas.

### Parcel
Owner, valor, zoning, restricciones, accesibilidad y building.

### Building
Type, level, state, condition, tenants, maintenance, insurance y obligaciones operativas.

### Company
Cash, assets, liabilities, equity, reputation, tax position y capacidad financiera.

### Bank
Criterios de riesgo, cartera, liquidez y condiciones de financiación.

### Loan
Principal, interés, plazo, garantía, estado y covenant simplificado.

### InsurancePolicy
Cobertura, prima, límites y riesgos cubiertos.

### Actor
Worker, tenant, manager, political actor, inspector, banker o criminal.

### Faction
Resources, strategy, relationships y territory/influence.

### Government
Mayor, council, policies, budget, revenue, expenses y approval.

### Policy
Category, modifiers, support y fechas.

### Tax
Base, rate, scope, exemptions, periodicity y beneficiary.

### Permit
Type, subject, status, requirements y authority.

### PublicContract
Authority, scope, bid, requirements, award y execution state.

### Reputation
Valoración por grupo, no una única puntuación global.

## Sistemas

- real estate;
- construction;
- resources;
- tenants;
- finance;
- banking;
- taxation;
- insurance;
- maintenance;
- insolvency;
- auctions;
- zoning;
- permits;
- AI;
- crime;
- police;
- politics;
- municipal budget;
- society;
- employment;
- public services;
- public procurement;
- reputation;
- imperfect information;
- procedural world;
- progression;
- macro events.

## Feedback loops

Economía -> sociedad -> política -> regulación -> economía.

Crimen -> policía -> política -> crimen.

Urbanismo -> suelo -> población -> política -> urbanismo.

Empresa -> deuda -> crecimiento -> riesgo -> liquidación/oportunidad.

Fiscalidad -> rentabilidad -> oferta -> precios -> inversión -> recaudación.

Presupuesto municipal -> servicios -> atractivo -> suelo -> actividad -> base fiscal.

Empleo -> renta -> vivienda -> población -> política -> regulación.

Crédito -> inversión -> precios -> deuda -> riesgo -> ejecuciones -> oportunidades.

Mantenimiento -> condición -> renta -> satisfacción -> valor -> costes.

## Core loop

comprar
-> producir
-> construir
-> ocupar
-> cobrar
-> mantener
-> mejorar
-> financiar
-> competir
-> asumir riesgo
-> adaptarse a regulación
-> reinvertir.

## Regla UX

El dominio puede ser complejo; la operación rutinaria no debe serlo.

El motor liquida automáticamente obligaciones periódicas. El jugador decide estrategias, excepciones y políticas de gestión.
