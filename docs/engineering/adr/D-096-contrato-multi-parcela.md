# D-096 — Contrato multi-parcela: proyectos sobre un conjunto catastral exacto

Fecha: 2026-10-30. Estado: aceptada. Fase: V.d-7A (cierre de dominio; V.d-7B visual pendiente).

## Contexto

V.d permitía varios edificios dentro de una parcela multi-celda, pero un edificio nunca podía
ocupar más de una parcela catastral. La revisión humana del juego pidió la mecánica inversa:
cementeras, ladrilleras, naves y acerías que necesitan **varias parcelas contiguas**. Fusionar
parcelas estaba prohibido: cada una conserva identidad, valor, dueño, impuestos, frente vial y
posibilidad futura de venta.

El contrato anterior `Building.parcelId` era, además, una única fuente de verdad que atravesaba
comandos, permisos, índice, completion, upgrade, repair, ruina, venta, colateral, snapshot,
proyección, worker y IA rival. Cambiarlo exigía propagarlo entero o dejar dos verdades ambiguas.

## Decisiones

1. **`parcelIds: ParcelId[]` es la única fuente de verdad** en `Building`, `ConstructionSite`,
   `Permit`, `StartConstruction.payload` y `RequestPermit.payload`. El orden es canónico
   (`canonicalParcelIds`: únicos + lexicográfico) y nunca se confía en el orden del cliente.
2. **Invariantes del conjunto**: longitud ≥ 1, sin duplicados, mismo distrito, mismo
   `developmentCodeId`, unión 4-conexa por borde, propiedad válida, `marketable`, área combinada
   suficiente y ocupación compatible. Un contacto diagonal no sostiene un proyecto.
3. **`BuildingDefinition.siteRequirements`** declara `requiredParcels`, `minCombinedAreaCells` y
   `requireEdgeContiguous`. Nave, ladrillera y cementera exigen 2; acería 3; el resto 1. Los
   municipales conservan 1. No se redefine la mecánica con `targetFootprintCells`.
4. **Huella sobre la unión**: `chooseFootprint` trabaja con las celdas y frentes combinados. La
   frontera catastral interna no bloquea la huella; el envelope normativo se aplica sobre la unión
   porque en esta versión todas las parcelas comparten código urbanístico.
5. **Reserva de complejo**: mientras exista obra, edificio o ruina, ninguna parcela del conjunto
   puede iniciar otro proyecto (`PARCEL_OCCUPIED`). Los edificios de una parcela conservan la
   convivencia actual dentro de su solar.
6. **Permiso ligado al conjunto exacto**: `buildingType + canonical(parcelIds)`. `[A,B]` no vale
   para `[A,C]`, `[A]` ni `[A,B,C]`. Al iniciar la obra el permiso exacto queda `consumed`.
7. **Ciclo de vida hereda el conjunto sin recalcular**: completion copia `site.parcelIds` en el
   edificio; upgrade, repair y `ClearRuin` copian `building.parcelIds`. La ruina sigue reservando
   todas sus parcelas hasta que termina su limpieza.
8. **`currentUses` se reconcilia en todas las parcelas** al completar, arruinar y limpiar. El
   índice (`buildBuildingIndex`) indexa el edificio bajo cada `parcelIds`; `buildingsOnParcel` y
   `activeSiteOnParcel` responden igual desde cualquiera de ellas. Los índices siguen siendo
   derivados y no se persisten.
9. **Venta individual bloqueada**: `SellParcel` rechaza cualquier parcela con edificio, obra o
   ruina. No se implementa venta conjunta en esta fase.
10. **Colateral prorrateado exacto**: el valor del edificio se reparte `floor(C/n)` por parcela y
   el resto (+1) a las primeras `remainder` en orden canónico. La suma de contribuciones es
    siempre el valor completo; el índice multi-parcela no puede contar el edificio n veces. LTV y
    política bancaria no cambian.
11. **Snapshot**: `SnapshotV2` conserva `schemaVersion: 2`, pero las entidades ahora llevan
    `parcelIds`. Un guardado V2 anterior sin `parcelIds` es estructuralmente incompatible y se
    rechaza; no se inventa migración.
12. **Proyección**: `economy.buildings[]` y `economy.constructionSites[]` publican `parcelIds`.
    Los permisos se siguen publicando por parcela (no existe entidad `Permit` separada en la
    proyección). `primaryParcelId` queda como ancla de presentación/navegación, nunca como regla
    económica.
13. **Selección de site común para IA y automatización**: `findDevelopmentSite` es puro,
    determinista y limitado (máximo 3 parcelas Alpha). El rival recorre sus opciones de producción
    en orden y elige la primera que cabe en su terreno; si no hay site válido, no construye. La
    automatización actual no emite `StartConstruction`; las reparaciones que abre heredan el
    conjunto del edificio.

## Consecuencias

- **Determinismo.** Los diez golden digests y las doce medidas de ciudad cambian sólo por
  superficie canónica: al normalizar `parcelIds` de un elemento a `parcelId` y reordenar claves,
  los diez golden recuperan exactamente sus valores anteriores. `scenario:seed-1:36000` se
  verificó además con `requiredParcels = 1` en todas las definiciones: devuelve el mismo digesto,
  cajas, transacciones y edificios. Ninguna constante económica cambió.
- **IA.** `rivalActionTarget` sigue distinguiendo el objetivo de un `StartConstruction`: usa el
  join canónico de `parcelIds`, que para una parcela coincide con el `parcelId` anterior. Así la
  memoria antirrepetición no colapsa todos los rechazos en `"*"` ni altera escenarios largos.
  El código urbanístico de la IA se lee de la parcela, no del bloque, coherente con la regla de
  que la parcela manda.
- **Jugabilidad observada.** La ciudad generada contiene pares industriales contiguos naturales,
  y tripletes naturales: la acería (3 parcelas) se verifica sobre ciudades generadas reales; la
  produce. Queda registrado como deuda de contenido/generación, no como regla a relajar en V.d-7A.
- **Lo que no cierra esta fase.** V.d-7B sigue pendiente: límites visuales de parcela, frente
  vial dibujado, selección semántica, picking de sprites de edificio/obra, portal de tooltips,
  lenguaje player-facing de facilities y smoke/capturas visuales. El playtest humano sigue
  `PENDING HUMAN PLAYTEST`; V.d no se declara cerrada.
