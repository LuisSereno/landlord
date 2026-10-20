# Visión multiperspectiva y trayectoria vital

## Propósito

Landlord se diseña inicialmente como un juego de empresa, propiedad e influencia urbana. Sin embargo, la simulación debe poder evolucionar en el futuro hacia una experiencia donde una misma persona pueda ocupar distintas posiciones dentro de la ciudad y pasar de una capa a otra de forma orgánica.

La idea no es construir varios juegos independientes ni añadir un selector artificial de "modo empresario / modo político / modo criminal".

La visión de largo plazo es:

> Una única ciudad simulada, una identidad persistente del jugador y múltiples roles adquiribles, combinables y perdibles dentro de la misma vida.

Esta visión es deliberadamente posterior al producto inicial. Su valor actual es arquitectónico: evitar que el motor asuma que el jugador siempre es una empresa inmobiliaria.

---

## 1. Identidad persistente del jugador

La identidad fundamental del jugador debe poder representarse como una persona.

Conceptualmente:

Player
-> Person
   -> patrimonio
   -> empleo
   -> relaciones
   -> reputaciones
   -> habilidades
   -> historial
   -> afiliaciones
   -> cargos
   -> empresas
   -> propiedades
   -> influencia
   -> situación legal

La empresa, el Ayuntamiento, una banda criminal o un banco son organizaciones del mundo. La persona puede fundarlas, poseerlas, dirigirlas, trabajar para ellas o abandonar sus cargos.

Esto separa:

- quién es el jugador;
- qué posee;
- qué organización dirige;
- qué cargos ocupa;
- qué capacidades tiene en ese momento.

---

## 2. Roles como posiciones, no como clases

Los roles no son clases mutuamente excluyentes.

Una persona puede ser simultáneamente:
- propietaria;
- empresaria;
- concejal;
- inversora;
- miembro de una asociación;
- relacionada con una facción criminal.

Ejemplo conceptual:

Person
- owns: 14 properties
- CEO: Construction Company
- office: Councillor
- shareholder: Newspaper
- secret relation: Criminal Faction

La riqueza del sistema nace de los conflictos entre esos intereses.

---

## 3. Trayectorias posibles

Las siguientes rutas son ejemplos, no árboles rígidos.

### Laboral / empresarial

Citizen
-> Worker
-> Manager
-> Entrepreneur
-> Property Owner
-> Company Owner
-> Magnate

### Política

Citizen
-> Activist
-> Councillor
-> Mayor
-> senior political/institutional roles futuros

### Criminal

Citizen
-> Petty Crime
-> Gang Member
-> Gang Leader
-> Criminal Organization

### Financiera

Citizen / Entrepreneur
-> Investor
-> Lender
-> Investment Company
-> Bank / Fund management futuro

### Laboral colectiva

Worker
-> Union Member
-> Representative
-> Union Leader

Las trayectorias pueden cruzarse.

---

## 4. Las transiciones no son unidireccionales

El sistema debe permitir ascenso, descenso y reconversión.

Ejemplos:

Mayor
-> pierde elecciones
-> vuelve a actividad privada.

Entrepreneur
-> quiebra
-> vende activos
-> trabaja para otra empresa.

Criminal
-> blanquea capital
-> crea negocio legítimo
-> gana influencia política.

Business Owner
-> crisis
-> financiación ilegal
-> relación criminal.

Politician
-> escándalo
-> inhabilitación
-> consultoría / empresa / retiro.

La trayectoria de una partida no debe ser un árbol de mejoras irreversible.

---

## 5. Cambio de perspectiva sin cambiar de mundo

Cada rol interpreta la misma ciudad con información y acciones distintas.

### Perspectiva empresarial

Overlays:
- property value;
- rents;
- ownership;
- demand;
- commercial activity;
- financing.

Acciones:
- buy;
- sell;
- build;
- finance;
- hire;
- lobby.

### Perspectiva política

Overlays:
- voters;
- tax revenue;
- public services;
- crime;
- employment;
- housing pressure;
- public approval.

Acciones:
- propose policy;
- vote;
- budget;
- zone;
- contract;
- regulate.

### Perspectiva criminal

Overlays:
- territory;
- protection;
- police heat;
- rival influence;
- illicit cash;
- laundering channels.

Acciones:
- extort;
- protect;
- sabotage;
- bribe;
- negotiate;
- launder.

### Perspectiva ciudadana

Overlays:
- jobs;
- housing cost;
- transport;
- services;
- personal network.

Acciones:
- work;
- move;
- consume;
- study;
- vote;
- save;
- invest;
- start business.

La ciudad no cambia de simulación. Cambian las capacidades, el detalle, la interfaz y la información relevante.

---

## 6. Capitales múltiples

El dinero deja de ser el único recurso importante.

### Capital financiero
- cash;
- assets;
- credit;
- equity.

### Capital social
- contacts;
- trust;
- relationships;
- family;
- network.

### Capital político
- influence;
- support;
- office;
- coalition strength.

### Capital reputacional
- prestige;
- credibility;
- trust by stakeholder group.

### Capital criminal
- territory;
- fear;
- illicit network;
- protection;
- criminal contacts.

Una persona puede ser fuerte en un tipo y débil en otro.

---

## 7. Relaciones persistentes

Las relaciones se convierten en un sistema central.

Posibles dimensiones:
- trust;
- loyalty;
- fear;
- debt;
- friendship;
- family;
- rivalry;
- blackmail;
- business interest;
- political affinity;
- criminal obligation.

Las relaciones conectan sistemas y permiten consecuencias retardadas.

Una ayuda financiera puede generar dependencia política años después.

Un antiguo socio puede convertirse en rival.

Un periodista aliado puede investigar después al jugador si cambia la relación.

---

## 8. Conflictos de interés

El sistema multiperspectiva permite conflictos orgánicos.

Ejemplo:
- el jugador posee suelo industrial;
- además es concejal;
- se vota una recalificación industrial -> residencial.

La decisión puede afectar:
- patrimonio;
- reputación;
- investigación;
- relaciones;
- prensa;
- oposición;
- apoyo empresarial;
- confianza ciudadana.

El juego no necesita una misión escrita para producir esta situación.

---

## 9. Consecuencias históricas de la carrera

La ciudad conserva memoria de las acciones del jugador.

Ejemplo:

Año 1:
promotor construye vivienda barata y reduce mantenimiento.

Año 8:
aumenta deterioro del barrio.

Año 15:
el mismo personaje entra en política.

Ahora debe gestionar un problema parcialmente creado por sus propias decisiones anteriores.

Otro ejemplo:

Como alcalde se construye una estación.
Años después, fuera de la política, el personaje puede invertir en terrenos cuyo valor cambió por aquella infraestructura.

El mundo conserva causalidad entre etapas de la vida.

---

## 10. Gameplay LOD

No todas las capas pueden tener el mismo nivel de detalle al mismo tiempo.

Se introduce el concepto de Gameplay Level of Detail.

### Si el jugador actúa principalmente como ciudadano
- persona: detalle alto;
- hogar: alto;
- empresa: bajo;
- política: contexto;
- ciudad: agregada donde sea posible.

### Si actúa como empresario
- persona: medio;
- empresa: alto;
- propiedades: alto;
- política: contexto;
- ciudad: simulación sistémica.

### Si actúa como alcalde
- persona: medio/bajo;
- gobierno: alto;
- ciudad: alto;
- empresa propia: delegada;
- propiedades: delegadas.

El mismo principio de Simulation LOD se aplica a la experiencia jugable.

---

## 11. Delegación obligatoria

Los cambios de escala exigen delegación.

Un alcalde que posee cuarenta edificios no debe administrar manualmente cuarenta contratos, reparaciones y tenants.

Ejemplos de roles delegados:
- Property Manager;
- General Manager;
- CFO;
- Operations Manager;
- Campaign Manager;
- Chief of Staff.

El jugador define políticas:

Property Management Policy
- minimum occupancy;
- rent strategy;
- maintenance threshold;
- renovation budget;
- debt tolerance.

La IA ejecuta y escala excepciones.

Regla:

> Cambiar de nivel de responsabilidad debe reducir microgestión de las capas inferiores, no añadirla.

---

## 12. Capabilities

Las acciones disponibles no deben estar codificadas mediante condicionales globales como:

if playerIsMayor
if playerIsLandlord
if playerIsCriminal

Modelo conceptual:

Person
-> Roles
-> Memberships
-> Ownership
-> Offices
-> Capabilities

Ejemplos:

CEO:
- HireEmployee
- BorrowMoney
- BuyProperty
- SignContract

Councillor:
- VotePolicy
- ProposePolicy

Mayor:
- ProposeBudget
- AppointOfficial
- InitiatePublicProject

PropertyOwner:
- RentProperty
- SellProperty

GangLeader:
- OrderExtortion
- ControlTerritory

Citizen:
- RentHome
- ApplyForJob
- Vote
- StartBusiness

Una persona puede obtener capacidades de varias fuentes simultáneamente.

---

## 13. ControlContext

El motor debe poder distinguir identidad y contexto de control.

Modelo conceptual:

PlayerIdentity
- personId

ControlContext
- activeRole
- activeOrganizationId?
- capabilities
- visibleInformation
- uiModules
- overlays

Esto permite que la misma persona cambie de perspectiva sin cambiar de mundo ni de identidad.

---

## 14. Life State

Además del World State se prevé conceptualmente un estado de trayectoria del jugador.

PlayerLifeState:
- personId;
- age;
- careerHistory;
- roles;
- memberships;
- offices;
- relationships;
- wealth;
- reputation;
- legalStatus;
- politicalStatus;
- criminalStatus;
- knownInformation;
- historicalMilestones.

Este estado no implica que el MVP simule una vida completa. Es un modelo de compatibilidad futura.

---

## 15. Career Events

Las transiciones importantes deben emerger del estado y no funcionar como un menú de clases.

Ejemplos:

"Tu empleador ha quebrado."
Opciones:
- buscar otro trabajo;
- comprar activos;
- crear empresa;
- unirse a competidor.

"Un grupo local te propone presentarte a concejal."
- aceptar;
- rechazar;
- negociar apoyo.

"Una organización criminal exige protección."
- pagar;
- negarse;
- negociar;
- colaborar;
- informar a policía.

"Tu empresa pierde financiación."
- vender activos;
- refinanciar;
- aceptar socio;
- recurrir a financiación ilegal.

Los Career Events conectan mundos sin convertir la experiencia en una campaña lineal.

---

## 16. Tiempo, envejecimiento y carrera

En una fase avanzada la edad puede dar sentido a la trayectoria:

22 -> worker
28 -> entrepreneur
37 -> councillor
45 -> mayor
53 -> pierde elecciones
57 -> investor

Esto transforma la partida de una simple acumulación de edificios en la historia de una carrera.

No es requisito de MVP ni vertical slice.

---

## 17. Generaciones y sucesión

Visión de muy largo plazo.

Si la simulación cubre décadas:
- muerte;
- herencia;
- estate;
- herederos;
- sucesión empresarial;
- continuidad familiar.

El jugador podría continuar mediante familia/dinastía.

Esto permitiría partidas extremadamente largas, pero supone un salto de alcance muy importante.

No debe condicionar Gate 1 salvo evitar modelos incompatibles.

---

## 18. Perspectivas futuras candidatas

### Landlord / Entrepreneur
Producto inicial.

Reutilización: base.

### Politician / Mayor
Muy alta reutilización:
- taxes;
- zoning;
- budget;
- services;
- police;
- housing;
- employment;
- contracts.

Es la primera perspectiva alternativa recomendada si el producto base funciona.

### Criminal
Alta reutilización:
- territory;
- crime;
- police;
- businesses;
- laundering;
- corruption;
- influence.

### Bank / Investor
Alta reutilización:
- loans;
- risk;
- collateral;
- defaults;
- auctions;
- distressed assets.

### Contractor
Alta reutilización:
- public/private contracts;
- workers;
- materials;
- schedules;
- margins.

### Union
Reutilización media:
- workers;
- wages;
- employment;
- politics;
- strikes.

### Media
Reutilización media:
- reputation;
- politics;
- investigations;
- advertising;
- public opinion.

### Strategic Citizen
Alta complejidad, pero posible:
- employment;
- housing;
- savings;
- consumption;
- voting;
- entrepreneurship.

### Full life simulator
Muy alta complejidad.
No se considera objetivo actual.

---

## 19. Tres niveles de ambición

### Nivel 1 — Landlord
Producto inicial.

El jugador opera principalmente como empresario/promotor.
Otros roles son IA.

### Nivel 2 — Roles transitables
Expansión futura.

Roles:
- entrepreneur;
- politician;
- criminal;
- investor;
- contractor.

Se permiten transiciones y coexistencia.

### Nivel 3 — Life / society simulation
Visión de largo plazo.

Incluye:
- citizen;
- worker;
- family;
- education;
- career;
- ageing;
- generations.

No se diseña en detalle durante el desarrollo inicial.

---

## 20. Restricción arquitectónica actual

Aunque los niveles 2 y 3 no se implementen ahora, el núcleo debe evitar cuatro cierres prematuros:

1. No asumir player == company.
2. Tratar empresas, gobiernos y facciones como organizaciones independientes.
3. Separar acciones disponibles mediante roles/capabilities.
4. Permitir historial y relaciones persistentes para actores relevantes.

Esto ofrece compatibilidad futura con un coste relativamente bajo ahora.

---

## 21. Posicionamiento

Landlord sigue siendo el producto y nombre de trabajo actual.

La arquitectura de simulación podría ser más amplia conceptualmente:

Urban Society Simulation
-> Landlord experience
-> Politics experience
-> Criminal experience
-> Citizen experience

No se recomienda cambiar ahora el posicionamiento comercial ni el nombre.

El objetivo es preservar opcionalidad, no ampliar el alcance inmediato.

---

## 22. Regla de alcance

Esta visión no autoriza a implementar:
- life simulation;
- ageing;
- family;
- playable mayor;
- playable criminal career;
- playable citizen career;
- succession;
- dynasty;
- multi-role UI completa;

durante Gate 1 o Gate 2 salvo decisión explícita posterior.

Sí autoriza a tomar decisiones de arquitectura que eviten impedirlas en el futuro.
