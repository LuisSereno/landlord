# WP-CHAR-02B · Inventario real de Kenney Mini Characters

Fecha: 2026-11-24. Estado: **20/20 GLB verificados y renderizados; clasificación visual completada**.

## 1. Método y controles

- Fuente: `/home/luis/RepositorioGitHub/landlord/blender_artist/staging/third_party/cc0/extracted/kenney/mini-characters/Models/GLB format/`.
- Licencia: CC0-1.0; `mini-characters/License.txt`, SHA-256
  `92aba6c40f4d09ea7c637c50b36147946632e5ade3c0296ca78be1effcd81661`.
- Blender 5.2.2 LTS, build `d13f752e3b9c`.
- Se importó cada GLB, se conservaron sólo la armature y sus mallas con modificador Armature y se
  excluyeron `Icosphere`, `Cube`, cámara, luz y `glTF_not_exported`.
- Escala de presentación: altura visible normalizada a **1,8 m**.
- Cámara común: ortográfica isométrica 45°/30°, `orthoScale=2,6`, `targetZ=1,0`.
- Un idle por modelo, 512×512 RGBA, fondo transparente.
- Material local mate; atlas original conservado.

Catálogo ampliado:
[`kenney-character-catalog.png`](../../../../art/characters/prototypes/wp-char-02b/catalog/kenney-character-catalog.png).

Catálogo a 28 px:
[`kenney-character-catalog-28px.png`](../../../../art/characters/prototypes/wp-char-02b/catalog/kenney-character-catalog-28px.png).

Datos medidos:
[`kenney-character-catalog.json`](../../../../art/characters/prototypes/wp-char-02b/catalog/kenney-character-catalog.json).
Validación:
[`kenney-character-catalog-validation.json`](../../../../art/characters/prototypes/wp-char-02b/catalog/kenney-character-catalog-validation.json).

## 2. Resultado común

Los 20 modelos comparten:

- rig de **7 huesos**;
- **32 acciones** embebidas, incluidas `idle` y `walk`;
- un material atlas `colormap`;
- dos mallas visibles skineadas (`body-mesh` y `head-mesh`);
- 686–947 triángulos por personaje;
- ausencia de articulaciones de codo y rodilla, aceptada como limitación del estilo Kenney.

Clasificación agregada: **8 SUITABLE**, **8 ADAPTABLE**, **4 UNSUITABLE**, 0 UNVERIFIED.

## 3. Tabla de los 20 personajes

| Modelo | SHA-256 | Mallas / huesos / clips | Triángulos | Altura fuente → escala | Ropa y accesorios visibles | Clase | Utilidad Landlord |
| --- | --- | --- | ---: | --- | --- | --- | --- |
| `character-male-a.glb` | `c1cba637e1d9…` | 2 / 7 / 32 | 771 | 0,6713 m → ×2,6813 | Gafas, camiseta verde, pantalón azul y zapatillas amarillas | SUITABLE | Ciudadano A o técnico |
| `character-male-b.glb` | `81464391ab32…` | 2 / 7 / 32 | 686 | 0,6613 m → ×2,7218 | Barba, camiseta naranja, complexión corpulenta | ADAPTABLE | Bombero o supervisor robusto |
| `character-male-c.glb` | `6bb3b1ac8b19…` | 2 / 7 / 32 | 837 | 0,7928 m → ×2,2705 | Gorra y uniforme azul de policía integrados | SUITABLE | Policía |
| `character-male-d.glb` | `bded80fb5163…` | 2 / 7 / 32 | 759 | 0,7218 m → ×2,4939 | Traje oscuro y corbata | SUITABLE | Profesional municipal o civil formal |
| `character-male-e.glb` | `7b67dbd3b187…` | 2 / 7 / 32 | 758 | 0,6760 m → ×2,6629 | Gafas, camisa blanca y mono/tirantes amarillos | ADAPTABLE | Supervisor u obrero B |
| `character-male-f.glb` | `83fa60802557…` | 2 / 7 / 32 | 749 | 0,6713 m → ×2,6813 | Camiseta verde, mono marrón y calzado claro | ADAPTABLE | Obrero B o técnico |
| `character-male-g.glb` | `14e4b60c26a3…` | 2 / 7 / 32 | 877 | 0,6713 m → ×2,6813 | Gafas, barba, camisa azul y delantal/mono marrón | ADAPTABLE | Enforcer A |
| `character-female-a.glb` | `10e4f70e4279…` | 2 / 7 / 32 | 924 | 0,7755 m → ×2,3210 | Conjunto violeta con dos pistolas azules integradas | ADAPTABLE | Enforcer B tras retirar armas; no civil tal cual |
| `character-female-b.glb` | `3a0e6c3e431a…` | 2 / 7 / 32 | 790 | 0,7234 m → ×2,4884 | Coletas/diadema amarillas, camiseta amarilla y mono violeta | SUITABLE | Ciudadana A |
| `character-female-c.glb` | `163ed5cb5b13…` | 2 / 7 / 32 | 780 | 0,7755 m → ×2,3210 | Pelo oscuro, diadema roja, camiseta azul/roja y parte inferior marrón | SUITABLE | Ciudadana B o municipal |
| `character-female-d.glb` | `788767a12ed8…` | 2 / 7 / 32 | 845 | 0,7755 m → ×2,3210 | Traje y pelo rojizo | SUITABLE | Profesional municipal |
| `character-female-e.glb` | `265a52129eb1…` | 2 / 7 / 32 | 804 | 0,7165 m → ×2,5123 | Bata clara integrada | SUITABLE | Sanitario |
| `character-female-f.glb` | `67ec9b7d30a5…` | 2 / 7 / 32 | 836 | 0,6713 m → ×2,6813 | Coleta, camiseta de rayas, pantalón azul y detalle amarillo | ADAPTABLE | Obrero B o técnico |
| `character-worker.glb` | `c8e0cd7a9873…` | 2 / 7 / 32 | 893 | 0,8241 m → ×2,1841 | Casco amarillo, camisa azul, mono marrón y calzado claro | SUITABLE | Obrero A; referencia 02A |
| `character-soldier.glb` | `5efff735e893…` | 2 / 7 / 32 | 947 | 0,7549 m → ×2,3845 | Uniforme y casco verdes de soldado genérico | ADAPTABLE | Policía/guardia o bombero con adaptación |
| `character-raider.glb` | `00db0d50e4da…` | 2 / 7 / 32 | 880 | 0,7165 m → ×2,5123 | Camiseta verde y mono marrón; aspecto civil | ADAPTABLE | Obrero B, técnico o civil trabajador |
| `character-knight.glb` | `c596aef8085d…` | 2 / 7 / 32 | 780 | 0,8136 m → ×2,2124 | Armadura medieval | UNSUITABLE | Fuera de catálogo |
| `character-alien.glb` | `c95efdc214cb…` | 2 / 7 / 32 | 926 | 0,6976 m → ×2,5801 | Criatura alienígena | UNSUITABLE | Fuera de catálogo |
| `character-robot.glb` | `ce2e1622c975…` | 2 / 7 / 32 | 870 | 0,8445 m → ×2,1314 | Robot futurista | UNSUITABLE | Fuera de catálogo |
| `character-zombie.glb` | `f13105173ed2…` | 2 / 7 / 32 | 703 | 0,6713 m → ×2,6813 | No-muerto de piel verde | UNSUITABLE | Fuera de catálogo |

Los hashes completos están en el JSON del catálogo; la tabla usa prefijos para conservar
legibilidad. Ninguna fuente se modificó.

## 4. Decisiones de inventario

- `male-c` es una prueba directa de que el paquete sí contiene uniforme policial; no debe usarse un
  personaje azul genérico como sustituto.
- `female-e` ya contiene bata médica; el sanitario puede evaluarse sin prototipo completo en esta fase.
- `worker` conserva la aprobación artística del propietario como referencia de estilo, no como
  autorización de promoción runtime.
- `male-e`, `male-g`, `male-b` y `male-d` ofrecen bases distintas para supervisor, enforcer, bombero y
  profesional formal.
- `soldier` es un soldado genérico, no fantasía; puede adaptarse con paleta y uniforme, pero no debe
  introducirse tal cual. `raider` es visualmente un civil con mono marrón, pese a su nombre.
- `knight`, `alien`, `robot` y `zombie` no deben introducirse como población corriente.
- `female-a` incluye dos pistolas skineadas; no es apropiada como civil genérica sin retirarlas.

## 5. Resultado de validación

La validación ejecutó **353 comprobaciones, 0 errores**: fuentes y licencia, 20 hashes únicos, 32
acciones por modelo, acciones `idle`/`walk`, altura normalizada, 512×512 RGBA, alfa sin borde, cero
magenta, encuadre y dos láminas finales.
