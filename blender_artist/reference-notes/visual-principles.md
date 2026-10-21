# Inventario de principios visuales

Este documento conserva sólo principios abstractos para diseñar arte original.
No contiene capturas, sprites, mapas, audio, interfaz ni nombres de contenido de
referencias históricas.

## Lectura de la escena

- La silueta y masa de un edificio deben comunicar su función antes que sus
  detalles pequeños.
- Terreno, edificios, personajes, vehículos e interacción necesitan capas de
  contraste separadas; el feedback de propiedad y selección no puede competir
  con la textura.
- La ciudad se debe leer por bloques y rutas, incluso cuando la densidad sube.

## Economía visible

- El progreso se expresa con materiales, mantenimiento, ocupación, señalética
  propia, iluminación y props, no con una familia de assets ajena.
- Los estados `planned`, `foundation`, `construction_50`, `complete` y `damaged`
  deben ser distinguibles por masa, silueta y grandes cambios de material.
- Humo, vapor, obra y deterioro se limitan para mantener la información de
  gameplay visible.

## Límites de originalidad

- La ciudad será ficticia, transatlántica y situada de forma evocadora entre
  1925 y 1940; no reproducirá ciudades, edificios ni trade dress concretos.
- Se aplicarán la paleta, la cámara y el lenguaje de formas de la Art Bible.
- Cada propuesta pasa una revisión humana de similitud antes de convertirse en
  source o runtime asset.
