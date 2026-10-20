# Workflow para agentes

## Antes de trabajar
1. Leer ai-context/README.md.
2. Leer PROJECT-STATE.md.
3. Leer DECISIONS.md.
4. Leer arquitectura y dominio.
5. Leer documento canónico del área.
6. Inspeccionar código real.
7. Confirmar Gate actual.

## Al proponer cambios
Indicar:
- objetivo;
- archivos afectados;
- decisión de diseño;
- riesgos;
- tests;
- impacto en saves;
- impacto performance;
- impacto IP.

## Al implementar
Preferir incrementos verticales pequeños:
input -> command -> domain -> event -> projection -> render -> test.

## Al terminar
Actualizar:
- tests;
- docs;
- PROJECT-STATE;
- DECISIONS si hubo decisión;
- KNOWN-GAPS si se cerró o abrió un hueco.

## No hacer
- arquitectura distribuida sin necesidad;
- lógica económica en React;
- dominio acoplado a Phaser;
- random no determinista;
- LLM en loop crítico;
- copiar contenido histórico;
- declarar una función como operativa sin evidencia.
