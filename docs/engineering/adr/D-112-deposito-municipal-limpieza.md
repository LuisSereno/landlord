# D-112 — Depósito municipal de limpieza

Estado: aceptada por el encargo de cierre de catálogo del 2026-11-25. Implementación de dominio y
fallback semántico completadas; arte Composer promovido pendiente de revisión humana.

## Problema

La limpieza básica es radial por distrito y funciona sin edificios físicos. El catálogo necesitaba un
equipamiento municipal configurable que mejorara esa cobertura sin convertir la limpieza en otro
servicio de grafo ni permitir que una compañía lo construya.

## Decisión

- `cleaning_depot` es un `BuildingType` y `UrbanFacilityKind` municipal, con parcela pública,
  operador municipal, cero renta y cero capacidad de vivienda.
- Huella física 3×1, solar reservado 4×2, una parcela con mínimo 8 celdas.
- Cada edificio operativo propiedad del municipio añade **6 celdas** al radio de limpieza de su
  distrito. El radio máximo configurable es **36**.
- Obra, `burning`, `collapse_pending`, `ruin` o propiedad privada no aportan bonificación.
- La limpieza sin depósito conserva exactamente la fórmula anterior. Transporte y seguridad siguen
  en el grafo y no reciben bonificación.
- El programa inicial añade un depósito en `barrio_del_umbral`; las empresas no pueden construirlo
  sobre suelo público ni privado.

## Datos y persistencia

La bonificación vive en `BuildingDefinition.cleaningRadiusBonusCells`; el máximo vive en
`URBAN_SERVICE_POLICY.cleaning.maxRadiusCells`. El edificio y la facility ya existen en SnapshotV3,
por lo que no se añade un campo persistido ni una migración. Una partida v3 sin depósito carga y
conserva la cobertura básica.

El generador sube a v5. Su versión participa en la derivación de semilla de distrito, así que las
doce ciudades canónicas cambian de geometría y digesto. Las fixtures se regeneraron con una medición
única sobre v5: 15 facilities/edificios municipales, 7 espacios públicos y 699–723 parcelas en las
doce seeds canónicas.

## Verificación

`packages/simulation/src/cleaning-depot.test.ts` cubre:

- ausencia de depósito = baseline exacto;
- +6 local y mejora de una parcela de borde;
- aislamiento del distrito y de los servicios de grafo;
- propiedad municipal y estados no operativos;
- tope de radio;
- save/load v3 idempotente;
- carga de un estado v3 anterior sin depósito.

La suite focalizada de cierre pasó 60/60 pruebas, incluidas city seeds, distritos, digestos, UI y
assets procedurales.

## Límite artístico

El fallback procedural es semántico y no se presenta como arte final. La promoción de un sprite
Composer requiere procedencia, matriz de estados/orientaciones, captura en ciudad, presupuesto y
aprobación visual humana.
