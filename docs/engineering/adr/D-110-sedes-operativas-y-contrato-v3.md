# D-110 — Sedes operativas de organización y contrato v3

Estado: decidido para la integración inicial.

## Contexto

Las cuadrillas necesitan un punto físico de origen y retorno, pero `PlayerIdentity` no es propietario del edificio: la sede pertenece a una `Organization`. El motor ya distingue distrito local, traslado por gateways y movimiento A* dentro del distrito.

## Decisión

- `headquarters` es un edificio económico construible con variantes visuales persistidas `cupola` y `courtyard`, ambas con reglas idénticas.
- La sede requiere dos parcelas contiguas y 16 celdas combinadas, ocupa 4×2 celdas, cuesta 4 500, reserva 4 cemento / 8 ladrillo / 2 acero y requiere 96 unidades de trabajo. Capacidad y renta son cero; mantenimiento e impuestos ordinarios se mantienen.
- Una organización inicial tiene como máximo una sede en obra u operativa. El tipo pertenece a la organización y sus agentes operativos retornan al acceso de servicio al completar una orden. Las transferencias interdistritales siguen el grafo de gateways y preservan el estado de retorno.
- Hasta construirla, el ancla de aparición es el local provisional. Perder o dejar inoperativa la sede restaura ese origen y permite construir una nueva.
- Los colores de organización son datos estables: jugador `#4DB6AC`, rival `#D97757`; azul cívico queda reservado al municipio. Cada edificio muestra una sola identidad de organización.
- Snapshot y protocolo pasan a v3. No se migran partidas v2; el almacenamiento las conserva como incompatibles hasta borrado explícito.
- La IA rival emite `StartConstruction` y pasa por las mismas reglas de propiedad, permisos, materiales, caja y colocación que el jugador.
- Las referencias conceptuales no son assets runtime. Los modelos de composición y sprites finales requieren procedencia aprobada y revisión visual en gameplay antes de promoción.

## Consecuencias

El snapshot conserva `organizationBases`, variante, accesos, presencia en base y estado de retorno. La proyección publica sedes y agentes presentes. El renderer consume la variante persistida. Las partidas v2 quedan fuera del contrato de carga y permanecen disponibles para eliminación explícita.
