# Sedes operativas de organización

Estado: contrato de gameplay implementado; dos candidatos del Building Composer generados en las cuatro orientaciones; captura en gameplay, cobertura de estados y aprobación visual/procedencia pendientes antes de promoverlos al runtime.

## Referencias

- `concepts/headquarters-mansion-cupola-reference.png`: concepto A, mansión urbana con mirador, ala lateral y cochera. Imagen generada para orientar la silueta; no es geometría ni sprite de runtime.
- `concepts/headquarters-courtyard-reference.png`: concepto B, residencia en U con patio de servicio y cubierta distinta. Imagen generada para orientar la silueta; no es geometría ni sprite de runtime.

Ambos conceptos se usan junto con Graphic Civic. Los modelos finales deben componerse desde módulos del catálogo aprobado en `blender_artist/manifests/building-modules.json`, y conservar manifiesto de composición, fuentes, licencia, hashes y capturas. Antes de añadir sus sprites a los bundles se deben revisar en la ciudad real los cuatro rumbos, estados de obra y zooms publicados, además de colisión, color, carga y presupuesto.

## Candidatos Composer

Los renders aislados y su metadata están en [`candidates/`](candidates/):

- `headquarters_cupola`: incluye el módulo original de mirador `mod_original_school_cupola` y módulos licenciados de fachada/cubierta.
- `headquarters_courtyard`: composición residencial modular en U para formar un patio de servicio abierto.
- Cada modelo tiene cuatro orientaciones con su manifiesto; las composiciones declaran 100 % de módulos licenciados y alrededor de 12–13 mil triángulos.

Son candidatos de escala de laboratorio. Todavía no se han revisado en la ciudad de gameplay y no contienen los acentos de organización horneados. La variante A tampoco tiene cochera en este primer candidato. La variante B debe comprobar que el patio y el acceso se lean a los zooms de juego. No promover estos PNG al runtime como están.

## Identidad

- Compañía del jugador: turquesa `#4DB6AC`, emblema geométrico de rombo.
- Compañía rival: terracota `#D97757`, emblema geométrico de triángulo.
- Azul cívico queda reservado al municipio.
- Una sede muestra un solo color de organización; el color es un acento y no sustituye el emblema.

## Contrato funcional

El tipo económico `headquarters` mide 4×2 celdas y usa dos parcelas contiguas con 16 celdas combinadas como mínimo. Cuesta 4 500, consume 4 cemento, 8 ladrillos, 2 acero y 96 unidades de trabajo. No recibe inquilinos ni produce renta; paga los costes normales de mantenimiento e impuestos. `cupola` y `courtyard` son identidades visuales persistidas del mismo tipo y no cambian reglas.

Cada organización inicial conserva un local provisional en su ancla de aparición. Puede tener una sede en obra o terminada. La sede terminada publica accesos principal y de servicio; los agentes operativos usan el acceso de servicio. El renderer debe escoger su asset por `headquartersVariantId` persistido, nunca sortearlo por frame o seed de render.

## Gate de promoción pendiente

La integración funcional usa por ahora un placeholder doméstico compartido hasta que ambos modelos derivados de fuentes aprobadas estén validados y capturados en gameplay. No presentar los conceptos ni los renders aislados como sprites finales ni declarar cubierto el requisito visual hasta cerrar ese gate.
