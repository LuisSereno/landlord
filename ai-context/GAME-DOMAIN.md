# Dominio del juego

## Identidad y control

### PlayerIdentity
Identifica al usuario y referencia una Person. No contiene directamente patrimonio empresarial.

### Person
Actor persistente con relaciones, reputaciones, roles, memberships, ownership, offices e historial.

### RoleAssignment
Vincula Person, rol y opcionalmente Organization, con vigencia y capabilities.

### ControlContext
Define perspectiva activa:
- Person;
- active role;
- active organization;
- capabilities;
- information scope;
- UI/overlays.

## Entidades/agregados conceptuales

### Game
Tiempo, seed, mundo y economía global.

### District
Parcelas, estadísticas, servicios, población, accesibilidad y condiciones urbanas.

### Parcel
Owner, valor, zoning, restricciones, accesibilidad y building.

### Building
Type, level, state, condition, tenants, maintenance, insurance y obligaciones operativas.

### Organization
Concepto colectivo independiente. Puede representar Company, Government, Bank, Union, Media, Association o Criminal Faction.

### Company
Cash, assets, liabilities, equity, reputation, tax position y capacidad financiera.

### Bank
Criterios de riesgo, cartera, liquidez y condiciones de financiación.

### Loan
Principal, interés, plazo, garantía, estado y covenant simplificado.

### InsurancePolicy
Cobertura, prima, límites y riesgos cubiertos.

### Actor
Person u otros agentes especializados del mundo.

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

- identity/control;
- roles/capabilities;
- relationships;
- career history;
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
- macro events;
- gameplay LOD;
- delegation.

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

Carrera personal -> relaciones -> oportunidades -> roles -> capabilities -> nuevas decisiones.

Decisiones históricas -> memoria del mundo -> consecuencias en roles futuros.

## Core loop inicial

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

## Core loop de largo plazo

vivir/operar
-> adquirir posición
-> acumular capital financiero/social/político/criminal
-> asumir roles
-> delegar
-> perder/cambiar roles
-> afrontar consecuencias históricas
-> continuar trayectoria.

## Regla UX

El dominio puede ser complejo; la operación rutinaria no debe serlo.

El motor liquida automáticamente obligaciones periódicas. El jugador decide estrategias, excepciones y políticas de gestión.

Cambiar de perspectiva debe cambiar información, overlays y responsabilidades, no crear otro mundo paralelo.
