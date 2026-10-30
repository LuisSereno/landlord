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
Parcelas, estadísticas, servicios, población, accesibilidad y condiciones urbanas. Su mapa es **local**:
los nueve distritos de la ciudad comparten el rango de coordenadas, así que un lugar es
`districtId + cell` y dos puntos de distritos distintos no están «lejos»: no tienen relación espacial
(D-093). Ninguna regla de radio, vecindad u onda expansiva puede comparar coordenadas sueltas.
La **demanda activa de servicios** es el desarrollo urbano del distrito, no su censo: las parcelas
vacantes conservan accesibilidad, pero no presionan la cola de ninguna facility (D-094 §1).

### Parcel
Owner, valor, zoning, restricciones, accesibilidad y building. Desde V.d es **multi-celda**
(`geometryCells`, frente vial, `disposition` `marketable | public`, `buildingIds` con varios edificios
y `baseLandValue`/`marketValue` con desglose entero). El suelo público es inalienable: no se compra,
no se vende, no se garantiza, no se licencia ni se edifica. Desde H2-10 una parcela vacante puede
exponer servicio **potencial** (facility alcanzable con capacidad residual) sin reservar slot,
pero ese potencial **no** revaloriza el suelo: land value consume disponibilidad operativa, no
potencial.

### Building
Type, level, state, condition, tenants, maintenance, insurance y obligaciones operativas. Su **huella**
(`footprintCells`) es autoritativa: lo que la simulación considera construido, lo que bloquea el paso,
lo que recibe una interacción táctica (D-093) y lo que coloca y ordena el sprite en el renderer
(D-094 §6). Vive en un distrito concreto. Su `orientation ∈ {0, 90, 180, 270}` es la rotación física
del sólido dentro de la parcela —no el azimut de cámara—, y hasta que el arte tenga frames
laterales no se representa visualmente (D-094 §7, deuda P2 declarada).

### Permit
Decisión municipal **con identidad propia** (`PermitId`) y ciclo de vida completo:
`approved | denied | expired | consumed`, con `consumedAtTick`. Se emite al resolver una solicitud, se
publica por parcela y tipo, y se gasta exactamente una vez al iniciar la obra; vender la parcela no
borra el expediente. Los derechos de densidad de un permiso adquirido son sólo de su titular.

### UrbanFacility
Función urbana (ayuntamiento, escuela, clínica, comisaría, parque de bomberos, mercado) separada del
edificio físico que la encarna, operada por el municipio. Su capacidad efectiva es **0 mientras ningún
edificio propio esté operacional**: un equipamiento destruido no presta servicio (D-093). La capacidad
se calcula en cohortes por servicio —no con una constante global— (D-094 §3) y el presupuesto
modula unidades de servicio, no cohortes enteras (D-094 §4). La asignación de demanda usa un
greedy determinista con capacidad y spillover hacia la siguiente alternativa alcanzable
(D-094 §2).

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
impulse el lobby o el concejo, una ley activa no se vuelve a sortear y tampoco la retira quien no la propuso:
`WithdrawPolicy` sólo acepta propuestas (D-076). La reputación también tiene autor, pero sólo el que la calle
conoce: un sabotaje con víctimas carga sobre el propietario y sobre el agresor público (`violent_sabotage`,
`publiclyAttributedOrganizationId`), mientras la autoría real sigue viviendo en `causedByOrganizationId` (D-072),
y desalojar hogares no mejora la lectura de la banca (D-075).
