# WP-CHAR-02C — Diagnóstico de defectos de cabeza

Fecha: 2026-11-24. Estado: diagnóstico técnico completo; revisión artística pendiente.

## 1. Método y controles

Se importaron los tres GLB de WP-CHAR-02B con Blender 5.2.2 LTS (`d13f752e3b9c`), se normalizaron a 1,8 m y se renderizaron con la cámara ortográfica 45°/30°, `orthoScale=2.3`, `targetZ=0.95`, EEVEE y fondo transparente.

Para cada personaje se generaron cinco controles:

- **A**: GLB original, sin modificar.
- **B**: candidato WP-CHAR-02B reconstruido con sus herramientas.
- **C**: candidato 02B sin accesorios.
- **Mapa de materiales**: un color por slot de material de `head-mesh`.
- **Mapa de piezas**: un color por componente conectado, agrupando vértices por posición para no confundir costuras UV con piezas.

Los controles B de supervisor y enforcer son idénticos píxel a píxel a los PNG archivados de WP-CHAR-02B. El bombero difiere en 11 píxeles, con delta máximo 3/255; la diferencia no altera la medición ni el defecto.

Evidencia:

- `docs/art/characters/prototypes/wp-char-02c/diagnostics-v3/head-defects-diagnosis.json`
- `docs/art/characters/prototypes/wp-char-02c/diagnostics/01-head-supervisor.png`
- `docs/art/characters/prototypes/wp-char-02c/diagnostics/01-head-enforcer.png`
- `docs/art/characters/prototypes/wp-char-02c/diagnostics/01-head-firefighter.png`
- `docs/art/characters/prototypes/wp-char-02c/diagnostics/head-diagnostics-manifest.json`

## 2. Supervisor

### Defecto observado

Zona blanca irregular en la coronilla, visible bajo el casco; el conjunto se lee como una persona mayor con un accesorio pequeño.

### Origen comprobado

- Fuente: `character-male-e.glb`.
- SHA-256: `7b67dbd3b1873a8182e78b1764db008496e4c3b871db59f45ed224852c238fd4`.
- `head-mesh` tiene 288 polígonos, nueve piezas y **un único material** `colormap`.
- La pieza superior del pelo es el componente 1 (72 polígonos; bounds locales Z `0.393250..0.671325`). El componente 5 añade 20 polígonos de flequillo.
- La zona blanca ya aparece en A y desaparece al retirar accesorios sólo porque el casco deja de cubrirla; es decir, no la crea el casco ni el recoloreado del cuerpo.
- WP-CHAR-02B sólo asigna materiales a `body-mesh`; no modifica `head-mesh`.
- La cabeza mide `1.207609 × 0.910607 × 0.885976 m`. El domo del casco mide `0.54 m` de ancho y el ala `0.64 m`: cobertura insuficiente de la pieza superior.

### Causa confirmada

Región clara del atlas original dentro de la pieza superior del pelo. No es un hueco, una normal invertida ni un accesorio invisible. La proporción de polígonos con normal hacia dentro (15,28%) no localiza la mancha y no se usa como explicación.

### Solución concreta

1. Reasignar localmente las piezas de pelo del supervisor a un material marrón oscuro, sin editar el atlas original.
2. Ampliar el casco/gorra de capataz: domo más ancho, ala frontal y banda lateral que cubran la coronilla.
3. Reforzar el chaleco ocrá y el portapapeles; conservar `character-male-e.glb` salvo que el smoke demuestre que la silueta sigue demasiado civil.

### Riesgos

- Un casco ancho puede ocultar demasiado rostro en D1/D2.
- El pelo recoloreado debe quedar limitado a componentes concretos; no puede teñir piel, gafas ni orejas.
- El portapapeles debe seguir el brazo sin atravesar el torso al caminar.

## 3. Enforcer

### Defecto observado

Círculo negro en la coronilla y una identidad dominada por barba, color oscuro y poca forma exterior.

### Origen comprobado

- Fuente: `character-male-g.glb`.
- SHA-256: `14e4b60c26a330b8dcd52f1e5a36ba124869600f9fa94075fbc6a4665f6f6525`.
- `head-mesh` tiene 343 polígonos, once piezas y un único material `colormap`.
- El componente 1 (72 polígonos) es la pieza superior del pelo; el círculo ya está presente en A.
- La barba pertenece al componente 2 (64 polígonos) y el bigote al componente 3 (28 polígonos).
- La gorra de 02B no tapa el círculo en todas las direcciones. Su deriva de anclaje es `1.788139e-7 m`, descartando un fallo de animación.
- WP-CHAR-02B no modifica la cabeza; el círculo no procede de sus materiales regionales.

### Causa confirmada

Región oscura del atlas original en la pieza superior del pelo. No es un agujero geométrico ni una intersección de la gorra.

### Solución concreta

1. Evaluar `character-raider.glb` como base alternativa dentro de Kenney: tiene silueta más ancha, cabeza sin barba y gorra integrada.
2. Si el smoke confirma la mejora, recolorear localmente su gorra/pelo y usar materiales de chaqueta azul-gris/carbón sobre la malla skineada.
3. Añadir contraste de camisa/cuello y cinturón; no añadir armas ni paneles rígidos.
4. Documentar el cambio de base y conservar el GLB original como control.

### Riesgos

- Cambiar de base altera proporciones y requiere revalidar cámara, suelo y accesorios.
- Una paleta demasiado clara puede confundirse con el policía; debe mantener valor medio-bajo y silueta sin insignia.
- La gorra integrada debe recolorearse por piezas, no por un tinte global de cabeza.

## 4. Bombero

### Defecto observado

Casco amarillo diminuto, barba dominante y ropa oscura con poca lectura de protección contra incendios.

### Origen comprobado

- Fuente: `character-male-b.glb`.
- SHA-256: `81464391ab3291bc78d23c33d5a5313cfab43469285a8e1f02b974aecbd4f943`.
- `head-mesh` tiene 236 polígonos, ocho piezas y un único material `colormap`.
- La barba es el componente 1 (64 polígonos; bounds locales Z `0.263250..0.423250`). Es geometría original, no un material añadido.
- Cabeza: `1.234345 × 1.058708 × 1.083484 m`.
- Casco 02B: domo `0.58 × 0.54 × 0.36 m`; ala `0.72 × 0.72 × 0.045 m`. Domino/anchura de cabeza = **46,99%**; ala/anchura = **58,33%**.
- El anclaje es correcto: deriva máxima `5.960464e-8 m`. El problema es escala y cobertura, no animación.

### Causa confirmada

Dos causas independientes: la base tiene una barba geométrica dominante y el casco está dimensionado para una cabeza más pequeña de lo que el avatar Kenney presenta tras normalizar.

### Solución concreta

1. Evaluar `character-male-a.glb`, sin barba y con pelo corto, como base alternativa dentro de Kenney.
2. Crear un casco low-poly nuevo, anclado a `head`, con domo ancho, visera frontal, reborde posterior y cresta. Cobertura objetivo: domo ≥80% y ala ≥90% del ancho de cabeza, sin bajar la visera sobre los ojos.
3. Uniforme carbón con dos franjas ocres, guantes y botas robustas; cuello protector mediante material en la malla existente.
4. Mantener el casco del obrero como control negativo: no puede quedar como un simple cambio de color.

### Riesgos

- Un casco ancho puede recortarse en cámara o intersectar orejas.
- Cambiar a `male-a` exige demostrar superioridad visual y revalidar el rig de siete huesos.
- Las franjas por bandas de altura deben sobrevivir a las ocho muestras de marcha sin desaparecer.

## 5. Archivos afectados

Nuevos y autorizados:

- `tools/art-pipeline/blender/characters/wp_char_02c/diagnose_head_defects.py`
- `tools/art-pipeline/blender/characters/wp_char_02c/compose_head_diagnostics.py`
- `docs/art/characters/prototypes/wp-char-02c/diagnostics/`
- `docs/art/characters/prototypes/wp-char-02c/diagnostics-v2/`
- `docs/art/characters/prototypes/wp-char-02c/diagnostics-v3/`
- `docs/execution/phase-4/characters/wp-char-02c/01-head-defects.md`
- `docs/execution/phase-4/characters/wp-char-02c/PROGRESS.md`

No se modificaron GLB, atlas, WP-CHAR-02A/02B, simulación, Phaser, edificios ni manifiestos runtime.
