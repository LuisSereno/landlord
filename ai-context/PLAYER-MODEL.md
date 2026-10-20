# Modelo de jugador y perspectivas

## Principio central

El motor no debe asumir:

player == company.

La identidad persistente del usuario debe poder representarse como una Person. Las organizaciones son entidades independientes del mundo.

## Modelo conceptual

PlayerIdentity
- playerId
- personId

Person
- patrimonio personal;
- relaciones;
- reputaciones;
- roles;
- memberships;
- offices;
- ownership interests;
- career history;
- legal/political/criminal status;
- life data futuro.

Organization
- Company;
- Government;
- Bank;
- Union;
- Media;
- Criminal Faction;
- Association.

RoleAssignment
- personId;
- organizationId opcional;
- role type;
- start/end;
- capabilities.

ControlContext
- personId;
- activeRole;
- activeOrganization;
- capabilities;
- visible information;
- UI modules;
- overlays.

## Capabilities

Ejemplos:
- BuyProperty;
- SellProperty;
- StartConstruction;
- BorrowMoney;
- HireEmployee;
- VotePolicy;
- ProposePolicy;
- SetBudget;
- OrderExtortion;
- NegotiateContract;
- VoteElection.

Las capacidades proceden de roles, cargos, ownership, licencias, delegaciones o estados legales.

## Multirol

Los roles no son clases exclusivas.

Una persona puede ser a la vez:
- propietaria;
- CEO;
- concejal;
- accionista;
- miembro de una asociación;
- vinculada con una facción criminal.

Esto puede generar conflictos de interés emergentes.

## Transiciones

Las carreras pueden avanzar o retroceder.

Ejemplos:
- citizen -> worker -> entrepreneur -> landlord;
- activist -> councillor -> mayor;
- criminal -> legitimate business;
- entrepreneur -> insolvency -> employee;
- mayor -> loses election -> private sector;
- entrepreneur -> illegal financing -> criminal connection.

No usar un árbol irreversible de clases.

## Gameplay LOD

El detalle jugable depende de la posición actual.

Citizen:
- person/housing/jobs: alto;
- company/politics: contexto.

Entrepreneur:
- company/property: alto;
- person: medio;
- politics: contexto.

Mayor:
- government/city: alto;
- private business: delegado.

La simulación global continúa; cambian interfaz, información, delegación y frecuencia de interacción.

## Delegación

Cuando una persona acumule responsabilidades, debe poder delegar:
- property management;
- finance;
- operations;
- staff;
- political staff.

El jugador define políticas y umbrales. La IA ejecuta y escala excepciones.

## Life State

Visión futura:
- person;
- age;
- career;
- roles;
- relationships;
- wealth;
- reputation;
- legal status;
- political status;
- criminal status;
- history.

No implementar un life simulator durante Gate 1/2.

## Career Events

Las transiciones deben surgir del mundo.

Ejemplos:
- empleador quiebra;
- oferta para presentarse a concejal;
- falta de financiación;
- amenaza de protección;
- oportunidad de comprar activos;
- escándalo;
- derrota electoral.

Evitar un selector artificial de clase cuando sea posible.

## Perspectivas futuras candidatas

1. Landlord / Entrepreneur — producto inicial.
2. Politician / Mayor — primera extensión natural.
3. Criminal.
4. Bank / Investor.
5. Contractor.
6. Union.
7. Media.
8. Strategic Citizen.
9. Full life simulator — visión muy lejana.

## Regla de alcance

Compatibilidad arquitectónica: sí, desde ahora.

Implementación completa de perspectivas alternativas: no, salvo decisión explícita futura.
