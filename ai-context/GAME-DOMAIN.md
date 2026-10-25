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
Person u otros agentes especializados del mundo. Para el spike D-061, un agente operativo debe
tener posición, salud, especialidad, tarea y afiliación explícitas; no equivale al jugador ni a
la organización.

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
- tactical agents;
- damage and incidents;
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

Agente -> tarea -> movimiento -> efecto -> incidente -> daño/respuesta -> consecuencia económica.

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

Lo que sabe cada perspectiva ya está declarado: `INFORMATION_POLICY.scopeByObservable`
(`packages/simulation/src/information.ts`) etiqueta los observables como `public`, `own`, `inferred` o
`private`, y una perspectiva nueva se define eligiendo su observador, no inventando otro estado (D-072).
Las relaciones entre organizaciones tampoco son decorativas: la postura de `factions` sólo se forma por
encuentros que ocurren en el mundo —sabotaje, desbanco en subasta, licitación competida, compartir manzana—,
decae con el tiempo y se olvida si deja de haber roce (D-073).
La política municipal tampoco es una capa aparte: los cinco ejes de opinión (`municipal-politics.ts`) se calculan
leyendo el mercado de vivienda, el mercado laboral, el crime, los servicios pagados y la recaudación real del mes
—incluida la tasa de servicios devengada, medida con el mismo helper que la cobra—, así que votar cambia quién
recorta el presupuesto y qué ley intenta aprobarse el concejo —sin garantizar el resultado que la jugadora quiere,
que es la regla del WP4.11 (D-074)—. El padrón son los residentes efectivos: un hogar vota sólo con contrato
vigente y edificio existente; los que buscan piso y los desplazados no votan, y la queja por desplazamiento se
reparte por proporción de hogares afectados, no por recuento absoluto (D-075). Una ordenanza dura lo mismo la
impulse el lobby o el concejo, y una ley activa no se vuelve a sortear. La reputación también tiene autor: un
sabotaje con víctimas carga sobre el propietario y sobre quien lo causó (`violent_sabotage`), y desalojar hogares
no mejora la lectura de la banca (D-075).
