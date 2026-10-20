# Identidad del jugador, roles y capabilities

## Objetivo

Evitar que el motor quede acoplado a la suposición:

player == company.

La implementación inicial puede ofrecer una única experiencia empresarial, pero el modelo de dominio debe poder representar una persona que:
- posee organizaciones;
- trabaja para organizaciones;
- ocupa cargos;
- pertenece a facciones;
- controla organizaciones;
- cambia de rol.

---

## Modelo conceptual mínimo

### Person

Representa una persona persistente del mundo.

Campos conceptuales:
- id;
- identity/profile;
- relationships;
- reputations;
- memberships;
- roles;
- offices;
- ownership interests;
- career history;
- legal status;
- optional age/life data futuro.

### Organization

Superclase conceptual o interfaz de entidades colectivas.

Tipos posibles:
- Company;
- Government;
- Bank;
- Union;
- Media;
- CriminalFaction;
- Association.

No es obligatorio usar herencia OO. Puede modelarse por composición.

### RoleAssignment

Une una Person con un papel:

- personId;
- organizationId?;
- roleType;
- startTick;
- endTick?;
- permissions/capabilities;
- metadata.

### PlayerIdentity

- playerId;
- personId.

No contiene directamente cash ni buildings.

### ControlContext

Determina qué está controlando el jugador en un momento dado:

- personId;
- activeRoleId?;
- activeOrganizationId?;
- activeCapabilities;
- informationScope;
- viewProfile.

---

## Capabilities

Las capabilities son permisos de gameplay.

Ejemplos:
- BuyProperty;
- SellProperty;
- StartConstruction;
- HireEmployee;
- BorrowMoney;
- ProposePolicy;
- VotePolicy;
- SetBudget;
- OrderExtortion;
- NegotiateContract;
- VoteElection.

Una capability puede proceder de:
- un rol;
- un cargo;
- ownership;
- licencia;
- estado legal;
- delegación.

No debe confundirse capability con UI.

La UI se deriva de las capabilities disponibles.

---

## Commands

Los comandos deben identificar actor e intención.

Ejemplo conceptual:

BuyParcelCommand
- issuedByPersonId;
- actingAsOrganizationId;
- parcelId;
- offer;

El motor valida:
1. identidad;
2. capability;
3. autoridad sobre la organización;
4. restricciones del mundo;
5. recursos.

Esto permite que el mismo comando sea utilizado por humano o IA.

---

## Delegación

Una persona puede otorgar autoridad limitada a otro actor o agente.

Ejemplos:
- property manager;
- CFO;
- general manager;
- chief of staff.

La delegación puede representarse mediante:
- role assignment;
- policy;
- permission scope;
- budget;
- escalation rules.

El sistema de automatización no debe saltarse las mismas reglas del dominio que aplican al jugador.

---

## Información visible

Las capabilities responden a "qué puede hacer".
El information scope responde a "qué puede saber".

Ejemplo:
un alcalde puede ver estadísticas agregadas municipales que un ciudadano no ve.
Un empresario puede conocer su contabilidad completa.
Un criminal puede conocer redes ilegales desconocidas por actores públicos.

El motor debe evitar entregar automáticamente información privada a cualquier controller.

---

## Gameplay LOD

La simulación global no debe apagarse al cambiar de rol.

Cambia:
- detalle de UI;
- frecuencia de interacción;
- delegación;
- alertas;
- overlays;
- información.

No cambia:
- causalidad del mundo;
- ownership real;
- economía;
- relaciones;
- políticas.

---

## MVP

No implementar todavía un framework complejo de roles si añade riesgo innecesario.

Requisito mínimo de arquitectura:
- no almacenar estado económico en un singleton Player;
- usar actor/person/company IDs explícitos;
- comandos con actor;
- ownership separado del control;
- entidades colectivas independientes.

Es suficiente para mantener abierta la evolución futura.

---

## Antipatrones

Evitar:

game.player.money
game.player.buildings
game.player.isMayor
game.player.isCriminal

Preferir:

company.cash
asset.ownerOrganizationId
person.roles
controlContext.activeOrganizationId
capabilityResolver.can(personId, action, target)

El objetivo no es construir abstracción por estética, sino evitar una reescritura cuando aparezcan nuevas perspectivas.
