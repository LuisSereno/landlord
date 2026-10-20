# Convenciones

## Lenguaje
TypeScript strict cuando comience la implementación.

## Nombres
Código en inglés.
Documentación puede estar en español.

## Dependencias
Dominio no importa UI.

## Commands
Imperativo:
BuyParcel, StartConstruction, AssignTenant.

## Events
Pasado:
ParcelPurchased, ConstructionStarted, TenantAssigned.

## IDs
IDs opacos y estables. No usar índices de arrays como identidad.

## Dinero
Evitar floats ingenuos para moneda. Preferir unidad menor entera o tipo Money.

## Tiempo
No usar Date.now como tiempo de juego.

## Random
No usar Math.random en simulation.

## Tests
Cada bug determinista debe generar test de regresión cuando sea posible.

## Datos
Validar schema al cargar contenido.

## Save
Cada cambio persistente evalúa migrations.

## Performance
Instrumentar antes de optimizar.

## Documentación
Si una decisión cambia:
1. código;
2. tests;
3. ai-context/DECISIONS.md;
4. documento canónico correspondiente.
