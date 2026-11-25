# WP-CHAR-02A · Diagnóstico de ropa y accesorios

Fecha: 2026-11-24. Estado: **causa de la ropa artificial confirmada; sustitución aún no producida**.

## 1. Evidencia

WP-CHAR-01B no sustituyó la ropa de los avatares Rocketbox. `apply_body_tint()`
(`tools/art-pipeline/blender/characters/character_compositor.py:128`) duplica el material `body`,
multiplica su textura por un color y cambia valores locales de roughness/specular. La malla original,
su silueta y sus prendas siguen siendo las mismas.

Las piezas nuevas se crean como objetos independientes y reciben una constraint `CHILD_OF` a un
solo hueso (`attach_to_bone()`). No tienen modificador Armature ni pesos de deformación. Por tanto:

- un casco, una gorra, una bolsa, una llave, un clipboard o un cinturón pueden ser accesorios
  rígidos válidos;
- una chaqueta, un cuello, unas solapas o un abrigo completos no pueden comportarse como prenda
  si están formados por piezas rígidas ancladas a un único hueso.

## 2. Matriz de elementos

| Elemento | Implementación WP-CHAR-01B | Defecto demostrado | Acción WP-CHAR-02A |
| --- | --- | --- | --- |
| Ropa base Rocketbox | Malla original con material `body` teñido | La silueta y el tipo de prenda no cambian; sigue siendo ropa contemporánea/civil | No usar el tinte como sustituto de vestuario |
| Casco | Esfera/cilindro/caja rígidos a `Bip01 Head` | La integración visual es aceptable, pero el casco no convierte al avatar en obrero | Conservar sólo como accesorio rígido sobre una base estilizada |
| Gorra | Esfera/caja rígidas a `Bip01 Head` | Mismo problema de identidad que el casco | Conservar como accesorio rígido opcional |
| Cinturón | Toro y bolsas rígidos a `Bip01 Pelvis` | Puede funcionar como cinturón; no arregla chaqueta/pantalón base | Conservar si la base lo necesita |
| Bolsa | Caja y asa rígidas a la mano | Riesgo de flotar o golpear el cuerpo según la pose | Usar sólo si el smoke lo justifica |
| Llave | Cilindro y anilla rígidos a la mano | A escala pequeña puede parecer un palo | Reducir/simplificar o eliminar |
| Cuello reforzado | Cilindro/toro rígidos a `Bip01 Neck` | Cubre la ropa original pero no sigue hombros/tronco; parece superpuesto | Eliminar de la nueva prenda |
| Solapas | Dos cajas rígidas a `Bip01 Spine2` | No deforman con el pecho; lectura de panel pegado | Eliminar; usar prenda integrada o skineada |
| Abrigo enforcer B | Cono abierto, cinturón y solapas rígidos a `Bip01 Spine2` | No tiene pesos ni flexión de cadera/torso; se lee como una carcasa | Rechazar esta solución de abrigo |
| Materiales | Copia local del material body | Oscuridad/detalle realista sigue presente; el tinte no estiliza la geometría | Evaluar materiales planos/mate de una base low-poly |

## 3. Diagnóstico por personaje

| Personaje | Ropa original visible | Geometría añadida | Problema resultante |
| --- | --- | --- | --- |
| Supervisor | Chaqueta/americana administrativa | Casco y clipboard | Sigue leyendo como hombre de traje con sombrero |
| Obrero A | Chaqueta vaquera, camiseta y vaqueros | Casco y cinturón | Sigue leyendo como ciudadano; el casco no integra uniforme |
| Obrero B | Jersey civil y pantalón | Gorra y bolsa | Sigue leyendo como ciudadano con gorra |
| Técnico | Blazer y ropa de oficina | Gorra, cinturón, bolsa y llave | La base de oficinista domina; los accesorios no crean mono |
| Enforcer A | Camiseta/chaqueta oscura | Gorra, cuello rígido y solapas | La superposición parece armadura/paneles, no ropa natural |
| Enforcer B | Blazer | Abrigo cónico rígido y sombrero | El abrigo no se deforma y pertenece a otro lenguaje visual |

## 4. Causa confirmada

El problema no es sólo de color ni de colocación. La cadena fue:

1. se conservó una prenda realista incompatible;
2. se la tiñó para intentar cambiar su identidad;
3. se añadieron piezas rígidas para simular accesorios o prendas completas;
4. las piezas no compartían la deformación del cuerpo;
5. el resultado conservaba simultáneamente dos sistemas de vestuario.

La solución aceptable es una de estas dos:

- elegir una base cuya ropa ya esté integrada y sea adecuada;
- crear una prenda low-poly con pesos de armature correctos.

No se construirán abrigos, chaquetas, pantalones o mangas mediante paneles rígidos. Los accesorios
rígidos se limitan a casco, gorra, herramienta, clipboard o bolsa pequeña.

## 5. Decisión

WP-CHAR-01B queda **técnicamente conservado y artísticamente rechazado**. Sus archivos no se borran.
WP-CHAR-02A no producirá los otros cinco personajes ni otra variante de estos seis: primero debe
demostrar un único obrero con vestuario integrado.
