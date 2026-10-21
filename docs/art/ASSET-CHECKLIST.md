# Asset Checklist / Definition of Done

> Versión: 0.1.
>
> Un asset no está terminado sólo porque se vea bien. Debe superar controles de fuente, metadata, integración, rendimiento, provenance y legibilidad.

**Checklist visual automatizable**

```text
[ ] no missing manifest
[ ] valid asset ID
[ ] valid source
[ ] license present
[ ] author/provenance present
[ ] dimensions allowed
[ ] alpha present where expected
[ ] no unexpected transparent border
[ ] anchor exists
[ ] footprint valid
[ ] atlas group valid
[ ] no duplicate ID
[ ] required states present
[ ] required animation frames present
[ ] no case-sensitive path collision
[ ] atlas ≤ budget
[ ] visual snapshot accepted
```


**Definition of Done para entregar un building**

```text
ART

[ ] respeta Art Bible
[ ] silueta legible
[ ] escala aprobada
[ ] materiales aprobados
[ ] lighting rig oficial
[ ] no contiene elementos IP ajenos

SOURCE

[ ] .blend limpio
[ ] nombres válidos
[ ] origin correcto
[ ] ANCHOR_ROOT presente
[ ] footprint definido
[ ] transforms saneados
[ ] materiales reutilizables donde corresponda

RENDER

[ ] cámara oficial
[ ] fondo transparente
[ ] master correcto
[ ] alpha limpio
[ ] estados obligatorios
[ ] orientaciones obligatorias

PIPELINE

[ ] metadata válida
[ ] provenance
[ ] author
[ ] license
[ ] atlasGroup
[ ] tags
[ ] render reproducible headless

ENGINE

[ ] carga en Phaser
[ ] pivot correcto
[ ] depth sorting correcto
[ ] selección correcta
[ ] placement correcto
[ ] save/load no depende del asset visual

PERFORMANCE

[ ] atlas dentro de budget
[ ] tamaño runtime correcto
[ ] sin texture switches innecesarios
[ ] probado en escena densa

QA

[ ] golden screenshot
[ ] visual diff aprobado
[ ] legible en zoom far
[ ] probado contra fondos distintos
```
