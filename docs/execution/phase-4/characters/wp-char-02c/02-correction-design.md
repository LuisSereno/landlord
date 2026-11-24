# WP-CHAR-02C — Diseño de corrección

Fecha: 2026-11-24. Estado: diseño en ejecución; smoke y revisión humana pendientes.

## 1. Límites

- Familia: Kenney Mini Characters, CC0, rig de siete huesos y 32 acciones.
- Sólo `idle` y `walk`; cuatro idle y ocho walk en D0 por candidato.
- Materiales locales sobre mallas skineadas; accesorios rígidos sólo para casco, gorra, cinturón y clipboard.
- Ningún panel rígido para simular chaqueta, pantalón o manga.
- Cámara/iluminación heredadas de WP-CHAR-02B: ortográfica 45°/30°, `orthoScale=2.3`, `targetZ=0.95`, EEVEE, 512×512 RGBA.
- El obrero de WP-CHAR-02A y el policía de WP-CHAR-02B son controles; no se regeneran.

## 2. Supervisor

**Base:** se conserva `character-male-e.glb` para aislar la corrección del pelo y del casco.

- Pelo: componentes 1 y 5 de `head-mesh` pasan a marrón oscuro local. El atlas original no se edita.
- Casco de capataz: domo ancho color arena, banda oscura, visera frontal y ala de mayor cobertura. No reproduce el casco amarillo integrado del obrero.
- Chaleco ocrá con dos franjas claras, mangas azul industrial, pantalón denim y botas marrones.
- Clipboard grande, anclado al antebrazo, con papel y clip; debe leerse como instrumento de trabajo, no como adorno flotante.
- Criterio de smoke: ninguna zona blanca, casco proporcionado, silueta de autoridad de obra y diferencia clara frente al obrero.

## 3. Enforcer

**Cambio de base candidato:** `character-raider.glb`, hash `00db0d50e4da865d95c7fd9caad9a49277f8809423f5d318387caa1dce7861d4`.

Motivo medido: `character-male-g.glb` incluye una barba geométrica dominante y su atlas produce el círculo oscuro. El raider de Kenney ofrece una silueta más ancha, cabeza sin barba y gorra integrada. El cambio se aceptará sólo si el smoke mejora la identidad sin parecer policía.

- Gorra/pelo: tratamiento local por componentes; color carbón.
- Chaqueta azul-gris/carbón con cuello/camisa de valor distinto, cinturón y botas negras.
- Sin arma, insignia, placas modernas ni chaqueta de paneles rígidos.
- Criterio de smoke: círculo ausente, rostro limpio, volumen corporal robusto y paleta/silueta distintas del policía.

## 4. Bombero

**Cambio de base candidato:** `character-male-a.glb`, hash `c1cba637e1d946822df07385fabf9d1bc55255ce19e0e8f7124d767e03987126`.

Motivo medido: `character-male-b.glb` tiene una barba de 64 polígonos que domina el rostro. `male-a` es humano Kenney sin barba y con pelo corto; permite que el casco y el uniforme protijan.

- Casco nuevo: domo ancho amarillo/ocre, visera frontal, reborde posterior ancho, escudos frontal/trasero y cresta.
- Cobertura objetivo: domo ≥80% y ala ≥90% del ancho de cabeza; la visera no puede cruzar la línea de ojos.
- Uniforme carbón con dos franjas amarillas, guantes, botas robustas y cuello de material contrastado.
- Criterio de smoke: casco dominante y reconocible, barba ausente, ropa protectora visible y distinción real frente al obrero.

## 5. Policía

Se reutilizan sus 12 frames y metadatos de WP-CHAR-02B. Sólo se abriría rework si una medición nueva demuestra clipping, deriva de accesorio, pérdida de frame o regresión de identidad.

## 6. Riesgos y controles

- Cada cambio de base exige hash, licencia, siete huesos, 32 acciones, suelo y cámara.
- Los accesorios se validan con `validate_anchor_drift`; el límite heredado es `0,0001 m`.
- El lote no empieza hasta revisar idle y walk de cada personaje.
- Un candidato que no alcance identidad visual quedará `REWORK_REQUIRED`, no `ARTISTIC_APPROVED`.
- Estado máximo del paquete: `TECHNICAL_COMPLETE / VISUAL_REVIEW_PENDING`.
