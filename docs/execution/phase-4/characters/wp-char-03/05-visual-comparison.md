# WP-CHAR-03 — Comparación visual A–D

Fecha: 2026-11-24. Evidencia: capturas reales de Phaser en Chromium.

## 1. Configuraciones medidas

| Configuración | Zoom | Altura mundo | Pantalla objetivo | Resultado visual |
|---|---:|---:|---:|---|
| A | 1× | 28 px | 28 px | Referencia; ciudad completa, personajes pequeños |
| B | 1× | 34 px | 34 px | Mejor equilibrio; personajes legibles sin recortar edificios |
| C | 1,25× | 28 px | 35 px | Ciudad más cercana; pierde superficie y recorta más el edificio izquierdo |
| D | 1,15× | 34 px | 39,1 px | Más legible, pero reduce más la ciudad y acerca los bordes |

Las alturas reales se leen del estado de Phaser. El enforcer queda ligeramente por debajo de la altura objetivo en algunos frames de walk porque la calibración usa la altura máxima del ciclo y evita bombeo de escala.

## 2. Láminas

- [Cinco personajes × cuatro configuraciones](../../../../art/characters/prototypes/wp-char-03/review/five-by-four-configs.png)
- [Escena general A–D](../../../../art/characters/prototypes/wp-char-03/scale-comparison/general-four-configs.png)
- [Puerta A–D](../../../../art/characters/prototypes/wp-char-03/scale-comparison/door-four-configs.png)
- [B como predeterminado del laboratorio](../../../../art/characters/prototypes/wp-char-03/review/recommended-default.png)

## 3. Criterios observados

- **Personaje/puerta:** A es demasiado pequeño; B y C dan una referencia cómoda; D es el más grande.
- **Personaje/vehículo:** B mantiene proporción creíble; D hace al personaje casi tan alto como el vehículo.
- **Ciudad visible:** A y B conservan ambos edificios; C y D recortan parte del izquierdo.
- **Profesiones:** B permite leer casco del bombero y distinguir enforcer/policía sin ampliación extrema.
- **Marcha:** estable en las cuatro configuraciones; sin cambios bruscos de escala.
- **Nitidez:** los PNG de 512 px conservan detalle suficiente a 34 px y zoom 1×.
- **Solapamientos:** ninguno bloquea puerta o vehículo en B; C/D exigen más atención al borde.

## 4. Conclusión visual

**B — Personajes mayores, zoom 1×** es la configuración recomendada. No es la que hace los personajes más grandes, pero sí la que mejora la lectura sin pagar el recorte de ciudad de C/D.

La aprobación artística final sigue pendiente del propietario.
