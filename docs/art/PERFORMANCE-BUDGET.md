# Performance Budget y QA visual de arte

> Versión: 0.1 — baseline de medición, no límite universal.
>
> Los targets sólo se ratifican tras medir el Visual Direction Spike en los navegadores objetivo y escenas representativas.

## QA visual, rendimiento, accesibilidad y localización

La producción artística debe tener Definition of Done técnica, no sólo aprobación del artista.

**Presupuesto de GPU**

Una textura RGBA8 sin comprimir de:

```text
2048 × 2048 × 4 bytes
≈ 16 MiB
```

Una de:

```text
4096 × 4096 × 4
≈ 64 MiB
```

Por eso **4096² no debe ser nuestro tamaño de atlas automático**.

Presupuesto inicial de Vertical Slice:

| Métrica | Target | Warning | Fail |
|---|---:|---:|---:|
| atlas page | 2048² | 4096² excepcional | >4096 |
| world texture resident | ≤96 MiB | 96–128 MiB | >128 MiB |
| total texture resident | ≤128 MiB | 128–192 MiB | >192 MiB |
| atlas pages visibles | ≤6 | 7–10 | >10 |
| draw calls frame normal | ≤150 | 150–250 | >250 |
| frame target | 60 FPS | 45–60 | <45 |
| frame budget | 16,67 ms | 16,67–22 ms | >22 ms |
| initial critical art download | ≤20 MB | 20–30 MB | >30 MB |
| oversized single runtime file | ≤4 MB ideal | 4–8 MB | revisar |

Son **presupuestos de proyecto propuestos**, no límites técnicos universales.

El atlas de 2048 se elige porque ofrece una granularidad razonable y TexturePacker lo usa como máximo predeterminado; Phaser puede dividir automáticamente grupos mediante multiatlas.

No obsesionaría al equipo con “un draw call”. El objetivo es evitar:

```text
texture switch
blend-mode switch
massive overdraw
unnecessary layers
```

y medir escenas reales.

**Art Lab**

Crearía una escena especial dentro del juego:

```text
/art-lab
```

con:

```text
camera calibration
tile calibration
all terrain
all building states
all characters
all animations
all VFX
UI components
palette tests
lighting references
```

No depende del gameplay.

Es una herramienta para:

- artistas;
- programación;
- QA;
- screenshots;
- visual regression.

**Golden scenes**

Como mínimo:

```text
golden_small_residential
golden_dense_commercial
golden_industrial
golden_construction
golden_crowd
golden_ui_economy
golden_ui_politics
```

Cada build genera screenshot.

Playwright permite realizar comparaciones visuales con `expect(page).toHaveScreenshot()` y almacenar los snapshots de referencia con una ruta controlada. También admite snapshots WebP lossless.

Ejemplo conceptual:

```typescript
await page.goto("/art-lab?scene=industrial&seed=42");

await expect(page).toHaveScreenshot(
  "industrial-golden.webp"
);
```

Para análisis más granular, Pixelmatch realiza comparación a nivel de píxel, detecta antialiasing y utiliza una métrica perceptual de diferencia de color.

No pondría tolerancia cero para todos los navegadores/GPU.

Tendríamos:

```text
deterministic DOM UI
→ very strict

Phaser/WebGL
→ small perceptual tolerance
```

Los goldens deben generarse dentro de un entorno reproducible:

```text
same browser
same OS/container
same viewport
same DPR
same seed
same asset build
```

**QA de legibilidad**

Cada edificio debe probarse a:

```text
50 %
75 %
100 %
150 %
200 %
```

Preguntas:

```text
¿Se identifica la categoría?

¿Se distingue del vecino?

¿Se distingue complete de construction?

¿Se ve quién lo posee?

¿Se identifica damage?

¿El personaje sigue visible?

¿Los VFX ocultan información?
```

Un buen asset puede ser artísticamente excelente y ser malo como asset de estrategia.

**Tests de color**

Visualizar todas las escenas en:

```text
normal
protanopia simulation
deuteranopia simulation
tritanopia simulation
grayscale
high contrast
```

La ownership de cuatro facciones no puede ser:

```text
red
slightly different red
green
slightly different green
```

Debe combinar:

```text
colour
pattern
outline
icon
```

**Accesibilidad UI**

Baseline WCAG 2.2 AA:

- 4,5:1 para texto normal;
- 3:1 para texto grande;
- zoom textual hasta 200 %;
- targets mínimos compatibles con el criterio 24×24 CSS px, pero Landlord buscará 36–44 px;
- focus visible;
- keyboard navigation;
- no comunicar estados sólo mediante color.

Importante: la accesibilidad afecta a la Art Bible desde el principio. No es una tarea de QA final.

**Pseudo-localización**

En CI debería existir:

```text
EN
ES
pseudo-expanded
pseudo-accented
RTL test
```

Ejemplo:

```text
Buy
↓
[!! Ɓüÿ þŕöþéŕţÿ — expanded string !!]
```

W3C documenta que precisamente las cadenas cortas pueden sufrir los mayores porcentajes de expansión al traducirse.

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
