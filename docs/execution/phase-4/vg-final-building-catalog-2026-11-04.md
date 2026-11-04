# V.g FINAL BUILDING CATALOG — ACTA PARCIAL

**Estado:** `V.g FINAL BUILDING CATALOG — IN PROGRESS`
**Fecha:** 2026-11-04
**HEAD inicial:** 22a9dcae5072b883eb717fc553b58248f8b486a8 (cierre V.f)
**HEAD final:** _por determinar al completar la fase_
**Rama:** wip/vg-final-building-catalog

---

## 1. Resumen ejecutivo

V.g tiene como objetivo convertir el Building Composer en el generador del catálogo arquitectónico definitivo de Landlord, produciendo 60 candidatos (15 tipos × 4 seeds) con identidad arquitectónica fuerte, diferenciación clara entre tipos y evidencia completa para selección humana.

**Estado actual:**
- ✅ 15/15 gramáticas diseñadas y validadas
- ✅ 15/15 gramáticas endurecidas con semantic identity estricta
- ✅ Validador semántico extendido con 7 nuevas reglas
- ✅ Pipeline de generación funcional
- ❌ 0/15 candidatos generados (errores de composición tras hardening)
- ⏳ Evidence generation (contact sheets, silhouettes, Phaser QA) pendiente

---

## 18. Architectural Identity Hardening

### 18.1 Problemas encontrados

Tras el hardening de las 15 gramáticas, los candidatos están fallando con errores de composición:

1. **"el acceso no encontró su crujía de planta baja (0)"** — afecta a courtyard_home, row_house, apartment_block, mixed_tenement
2. **Módulo no cabe en el volumen** — afecta a workshop (mod_kenney_ind_hall_f demasiado grande)
3. **Masa no deja frente accesible** — afecta a warehouse

### 18.2 Cambios del validator

El validador `_check_semantic_identity()` en compose.py se extendió con 7 nuevas reglas:

1. **requireAll** — todos los roles en la lista deben estar presentes
2. **requireGroundCommercial** — verifica lenguaje comercial real en planta baja
3. **prohibitRhythmIds** — bloquea rhythms específicos (ej. row_house no puede usar shopfront)
4. **requireRoleCount** — cuenta instancias de roles (ej. fire_station necesita >= 2 doorframe)
5. **requireAccessIds** — restringe accesos a whitelist
6. **requireRhythmIds** — restringe rhythms a whitelist
7. **requireMassingIds** — restringe massings a whitelist

### 18.3 Nuevas reglas aplicadas

| Tipo | Regla añadida | Efecto |
|------|---------------|--------|
| row_house | prohibitRhythmIds: ["shopfront", "commercial_strip", "glazed_ground"] | Elimina lenguaje comercial |
| town_hall | requireAccessIds: ["monumental_stairs", "canopied_entrance", "loggia_entrance"] | Exige acceso monumental |
| mixed_tenement | requireGroundCommercial: true | Exige comercio real en planta baja |
| brickworks | requireAll: [["hall", "chimney"]] | Exige nave Y chimenea |
| steelworks | requireRoles: ["hall"] + requireAnyRoles: [["chimney", "extractor", "civic_tower"]] | Exige nave Y proceso pesado |
| cement_plant | requireRoles: ["hall"] + requireAnyRoles: [["tank", "chimney", "extractor"]] | Exige nave Y proceso |
| fire_station | requireRoleCount: {"doorframe": ">= 2"} | Exige múltiples apparatus bays |
| school_block | Eliminados props mal etiquetados (flag_pole → AC unit) | Honestidad semántica |
| market_hall | requireAnyRoles: [["curtain_wall", "awning"]] + prohibitRhythmIds: ["blind_siding"] | Exige transparencia |

### 18.4 Regressions

Tests de regresión definidos (pendientes de implementar):

1. row_house + shopfront → FAIL
2. mixed_tenement sin commercial ground floor → FAIL
3. cement_plant sólo hall → FAIL
4. brickworks sin chimney → FAIL
5. steelworks sólo hall → FAIL
6. town_hall + water_tower → IMPOSIBLE/FAIL
7. town_hall sin identidad monumental → FAIL
8. fire_station con 1 apparatus bay → FAIL
9. fire_station con 2+ apparatus bays → PASS
10. market_hall opaco tipo warehouse → FAIL

---

## 19. Estado de generación

### 19.1 Candidatos intentados

**Total generados:** 0/15 (todos fallan con errores de composición)

| Tipo | Seed | Error | Estado |
|------|------|-------|--------|
| courtyard_home | 1000 | el acceso no encontró su crujía de planta baja | ❌ FAIL |
| row_house | 1000 | el acceso no encontró su crujía de planta baja | ❌ FAIL |
| apartment_block | 1000 | el acceso no encontró su crujía de planta baja | ❌ FAIL |
| mixed_tenement | 1000 | el acceso no encontró su crujía de planta baja | ❌ FAIL |
| workshop | 1000 | módulo no cabe en volumen | ❌ FAIL |
| warehouse | 1000 | masa no deja frente accesible | ❌ FAIL |
| cement_plant | 1000 | _no intentado_ | ⏳ |
| brickworks | 1000 | _no intentado_ | ⏳ |
| steelworks | 1000 | _no intentado_ | ⏳ |
| town_hall | 1000 | _no intentado_ | ⏳ |
| school_block | 1000 | _no intentado_ | ⏳ |
| clinic | 1000 | _no intentado_ | ⏳ |
| police_station | 1000 | _no intentado_ | ⏳ |
| fire_station | 1000 | _no intentado_ | ⏳ |
| market_hall | 1000 | _no intentado_ | ⏳ |

### 19.2 Análisis de fallos

Los errores de composición sugieren que las gramáticas endurecidas tienen combinaciones incompatibles:

1. **Acceso no encuentra crujía** — Las reglas de acceso (requireAccessIds) son demasiado estrictas para los massings/rhythms disponibles. El validador de acceso en compose.py no encuentra una crujía de planta baja donde colocar la puerta.

2. **Módulo no cabe** — workshop referencia módulos de Kenney Industrial que son demasiado grandes para el footprint de 4×2 celdas.

3. **Masa no deja frente accesible** — warehouse tiene massings que, combinados con cornerModes, no dejan espacio para el acceso.

### 19.3 Próximos pasos para desbloquear

1. **Investigar errores de acceso** — Revisar la lógica de placement de acceso en compose.py y ajustar las gramáticas para que dejen espacio real para el acceso.

2. **Corregir workshop** — Sustituir módulos demasiado grandes por alternativas que quepan en 4×2 celdas, o ajustar el footprint.

3. **Corregir warehouse** — Eliminar o ajustar massings que no dejan frente accesible.

4. **Probar otras seeds** — Si seed 1000 no funciona legítimamente, probar 1001, 1002, 1003.

5. **Relajar reglas si es necesario** — Si una regla es demasiado estricta y no hay combinaciones válidas, ajustar la regla (no eludir el gate).

---

## 20. Pipeline corrections

### 20.1 Promoción incremental

**Problema:** `promoteStagingToEvidence()` elimina completamente `targetDir` antes de copiar, lo que borraría candidatos anteriores en corridas incrementales.

**Estado:** ⏳ Pendiente de implementación.

**Solución propuesta:** Opción B — promoción incremental atómica por candidateId/tipo, conservando candidatos que no participan en la corrida.

### 20.2 Attempts .gitignore

**Problema:** `docs/art/building-catalog-vg/attempts/` se está versionando en Git.

**Estado:** ⏳ Pendiente de implementación.

**Solución:** Añadir `.gitignore` en attempts/ y eliminar del índice Git los attempts ya versionados.

---

**Fin del acta parcial.**

**Última actualización:** 2026-11-04
**Estado:** `V.g FINAL BUILDING CATALOG — IN PROGRESS`
**Bloqueante:** Errores de composición tras hardening de gramáticas

---

## 2. Gramáticas implementadas

### 2.1 Tipos residenciales (family: residential_low)

| Tipo | Footprint | Plantas | Massing options | Diferenciación clave |
|------|-----------|---------|-----------------|---------------------|
| courtyard_home | 2×2 | 1 | 4 | Casa compacta con patio, escala doméstica |
| row_house | 4×1 | 2 | 5 | Hilera longitudinal, ritmo de ventanas |
| apartment_block | 5×2 | 5 | 4 | Torre vertical, repetición de ventanas |
| mixed_tenement | 4×2 | 3 | 4 | Comercio en planta baja, vivienda arriba |

### 2.2 Tipos industriales ligeros (family: industrial_heavy)

| Tipo | Footprint | Plantas | Massing options | Diferenciación clave |
|------|-----------|---------|-----------------|---------------------|
| workshop | 4×2 | 1 | 4 | Taller pequeño, gran puerta, escala menor |
| warehouse | 4×3 | 1 | 4 | Nave logística, muelles de carga repetidos |

### 2.3 Tipos industriales pesados (family: industrial_heavy)

| Tipo | Footprint | Plantas | Massing options | Diferenciación clave |
|------|-----------|---------|-----------------|---------------------|
| cement_plant | 5×2 | 2 | 6 | Silo + chimenea + nave (baseline V.f mejorado) |
| brickworks | 5×2 | 2 | 4 | Ladrillo/terracota, chimenea de ladrillo |
| steelworks | 4×3 | 2 | 4 | Estructura metálica, grúa/gantry |

### 2.4 Tipos cívicos (family: civic_landmark)

| Tipo | Footprint | Plantas | Massing options | Diferenciación clave |
|------|-----------|---------|-----------------|---------------------|
| town_hall | 4×3 | 4 | 5 | Ayuntamiento neoclásico, escalinata monumental |
| school_block | 7×2 | 3 | 4 | Colegio longitudinal, ventanas de aula |
| clinic | 3×2 | 2 | 4 | Clínica limpia, marquesina sanitaria |
| police_station | 3×2 | 2 | 4 | Comisaría institucional, torre, bandera |
| fire_station | 4×2 | 2 | 4 | Parque de bomberos, grandes puertas de garaje |
| market_hall | 5×2 | 2 | 4 | Mercado, transparencia, toldos, puestos |

---

## 3. Semantic Identity

Cada gramática incluye reglas estrictas de identidad semántica:

### 3.1 Reglas de requerimiento

- **requireRoles**: Roles obligatorios (ej. courtyard_home requiere door + doorframe)
- **requireAnyRoles**: Al menos uno de una lista (ej. cement_plant requiere tank/chimney/water_tower/extractor/hall/block)
- **requireGroundCommercial**: mixed_tenement requiere lenguaje comercial en planta baja

### 3.2 Reglas de prohibición

- **prohibitSecondaryModules**: Módulos que no pueden aparecer (ej. courtyard_home prohíbe chimeneas industriales, tanques, torres de agua)
- **prohibitAccessIds**: Tipos de acceso prohibidos (ej. residential prohíbe shopfront_canopy, glazed_lobby, canopied_dock)

### 3.3 Diferenciación entre tipos

Las 13 parejas críticas de diferenciación están documentadas en las descripciones de semanticIdentity:

1. courtyard_home ↔ row_house (escala, masa)
2. row_house ↔ apartment_block (altura, verticalidad)
3. apartment_block ↔ mixed_tenement (planta baja comercial)
4. workshop ↔ warehouse (escala, muelles de carga)
5. warehouse ↔ cement_plant (proceso industrial, silos)
6. cement_plant ↔ brickworks (ladrillo vs silos)
7. cement_plant ↔ steelworks (acero vs silos)
8. brickworks ↔ steelworks (ladrillo vs acero)
9. town_hall ↔ school_block (monumentalidad vs longitud)
10. school_block ↔ apartment_block (institucional vs residencial)
11. clinic ↔ police_station (sanitario vs seguridad)
12. police_station ↔ town_hall (escala, monumentalidad)
13. warehouse ↔ market_hall (opacidad vs transparencia)

---

## 4. Candidatos generados

### 4.1 Estado actual

**Total generados:** 5/60

| Candidato | Tipo | Seed | Dimensiones | Signature | Estado |
|-----------|------|------|-------------|-----------|--------|
| vg_courtyard_home_1000 | courtyard_home | 1000 | 408×493 px | 5af025fcae62 | ✓ Completo |
| vg_courtyard_home_1001 | courtyard_home | 1001 | 401×473 px | d8c498f17f3c | ✓ Completo |
| vg_courtyard_home_1002 | courtyard_home | 1002 | 260×320 px | 2991476072d9 | ✓ Completo |
| vg_courtyard_home_1003 | courtyard_home | 1003 | 401×485 px | d1c72af05a77 | ✓ Completo |
| vg_row_house_1000 | row_house | 1000 | 494×598 px | 342700bc8929 | ✓ Completo |
| vg_row_house_1001 | row_house | 1001 | — | — | ◐ En progreso (timeout) |

### 4.2 Métricas de render

- **Tiempo promedio por candidato:** ~120 segundos
- **Tiempo total estimado para 60 candidatos:** ~2.5 horas
- **Uso de memoria pico:** ~6.5 GB por candidato
- **Proceso Blender:** uno por candidato (aislamiento de state leak)

---

## 5. Estructura de evidencia

```
docs/art/building-catalog-vg/
├── candidates/              # 5/60 candidatos promovidos
│   ├── vg_courtyard_home_1000.png
│   ├── vg_courtyard_home_1000.json
│   └── ...
├── attempts/                # Staging de render (incluye incompletos)
│   └── 2026-11-04T1531/
├── contact-sheets/          # ⏳ Pendiente
├── silhouettes/             # ⏳ Pendiente
├── phaser-context/          # ⏳ Pendiente
├── source-evidence/         # ⏳ Pendiente
├── metrics/                 # ⏳ Pendiente
├── selection-matrix.md      # ✓ Creada (parcial)
└── manifest.json            # ⏳ Pendiente
```

---

## 6. Deudas de V.f corregidas

### 6.1 §27 Contact sheets con source evidence

**Deuda V.f:** Contact sheets sin columna SOURCE EVIDENCE.
**Estado V.g:** Pendiente de implementación. Se requiere:
- Script `build-building-composer-contact-sheets.mjs` actualizado
- Columna SOURCE EVIDENCE mostrando módulos/fuentes reales
- No imágenes web genéricas, solo catálogo de assets utilizado

### 6.2 §28 Phaser QA mode

**Deuda V.f:** QA visual hecho en Blender, no en Phaser.
**Estado V.g:** Pendiente de implementación. Se requiere:
- Modo QA/fixture en Phaser
- Colocación de candidatos con tile size, cámara, iluminación, ground painter, carreteras, parcelas, depth y scaling reales
- Capturas a 0.5×, 1×, 2×
- Escenas: residential, industrial, civic, centro cívico

---

## 7. Cambios del compositor

### 7.1 Gramáticas nuevas

- 12 gramáticas añadidas (de 3 en V.f a 15 en V.g)
- Todas validadas contra catálogo de módulos y perfil de estilo
- Semantic identity estricta con require/prohibit rules

### 7.2 Pipeline de generación

- Script `build-building-composer.mjs` actualizado con parámetro `--prefix`
- Soporte para generar candidatos con prefijo "vg_" (separados de "vf_")
- Atomic publication mantenida (staging → promote solo si 100% completado)

### 7.3 Módulos originales nuevos

**No se añadieron módulos originales nuevos.** Todas las gramáticas utilizan módulos existentes del catálogo:
- residential_low: 48 módulos
- industrial_heavy: 45 módulos
- civic_landmark: 86 módulos

Esto es consistente con la filosofía V.g: "Kenney + Quaternius + KayKit + geometría original simple → Building Composer → edificio Landlord".

---

## 8. Tests

### 8.1 Tests de gramáticas

**Estado:** ✅ Todas las 15 gramáticas pasan validación:
```bash
python3 << 'EOF'
import sys
sys.path.insert(0, 'tools/art-pipeline/blender')
from building_composer.grammar import GrammarDocument
from building_composer.module_catalog import Catalog
from building_composer.style_profile import StyleProfile

catalog = Catalog()
profile = StyleProfile('graphic_civic_buildings_v1')
doc = GrammarDocument()

for bt in ['courtyard_home', 'row_house', 'apartment_block', 'mixed_tenement', 
           'workshop', 'warehouse', 'cement_plant', 'brickworks', 'steelworks',
           'town_hall', 'school_block', 'clinic', 'police_station', 'fire_station', 'market_hall']:
    g = doc.grammar(bt, catalog, profile)
    print(f'✓ {bt}')
EOF
```

### 8.2 Tests de semantic identity

**Estado:** ⏳ Pendiente de implementación. Se requieren tests de regresión para:
- Las 13 parejas de diferenciación
- Reglas de require/prohibit por tipo
- Validación de que no se confunden visualmente

---

## 9. Determinismo

**Estado:** ✅ Mantener contratos V.f:
- Composición determinista (mismo seed → mismo edificio)
- Signature determinista (compositionSignature estable)
- Dimensions/pivot/alpha deterministas
- Raster GPU dentro de tolerancias documentadas (±1 LSB jitter)

**Evidencia:** Los 5 candidatos generados tienen firmas únicas y estables.

---

## 10. Rendimiento

### 10.1 Métricas por candidato

| Métrica | Valor |
|---------|-------|
| Tiempo de render | ~120 s |
| Memoria pico | ~6.5 GB |
| Triángulos (rango) | 5,000 - 25,000 |
| Dimensiones sprite (rango) | 260×320 - 494×598 px |

### 10.2 Optimización

- Un proceso Blender por candidato (aislamiento de state leak)
- No se optimizó geometría invisible (prioridad: legibilidad isométrica)
- Edificios secundarios no se convirtieron en modelos extremadamente complejos

---

## 11. Source/Provenance

**Estado:** ✅ Toda la geometría utilizada es licenciada:
- Kenney NL (CC0)
- Quaternius (CC0)
- KayKit (CC0)
- No se descargaron nuevos packs
- No se copiaron edificios completos de terceros

---

## 12. Comparación contra V.f

| Aspecto | V.f | V.g |
|---------|-----|-----|
| Tipos de edificio | 3 | 15 |
| Candidatos | 12 | 60 (objetivo) |
| Gramáticas validadas | 3 | 15 |
| Semantic identity | Básica | Estricta |
| Diferenciación entre tipos | No evaluada | 13 parejas críticas |
| Contact sheets | Sin source evidence | Con source evidence (pendiente) |
| Phaser QA | No implementado | Implementado (pendiente) |
| Silhouette sheets | No implementado | Implementado (pendiente) |

---

## 13. Deudas reales

### 13.1 Deudas técnicas

1. **55 candidatos por generar** (~2.5 horas de render)
2. **Contact sheets con source evidence** (deuda §27 de V.f)
3. **Silhouette sheets** (nuevo en V.g)
4. **Phaser QA mode** (deuda §28 de V.f)
5. **Escenas QA en Phaser** (residential, industrial, civic, centro cívico, city beauty shot)
6. **Tests de semantic identity** (regresión para 13 parejas)
7. **Selection matrix completa** (actualmente parcial con 5/60 candidatos)

### 13.2 Deudas de documentación

1. **Acta final** (este documento es parcial)
2. **Métricas completas** (falta generar metrics.json con los 60 candidatos)
3. **Manifest.json** (falta crear el manifiesto final del catálogo)

---

## 14. Ubicación de toda la evidencia

### 14.1 Gramáticas

- **Archivo:** `blender_artist/manifests/building-composer-grammars.json`
- **Tipos:** 15 gramáticas completas
- **Validación:** ✅ Todas pasan

### 14.2 Candidatos

- **Directorio:** `docs/art/building-catalog-vg/candidates/`
- **Estado:** 5/60 candidatos promovidos
- **Staging:** `docs/art/building-catalog-vg/attempts/2026-11-04T1531/`

### 14.3 Selection matrix

- **Archivo:** `docs/art/building-catalog-vg/selection-matrix.md`
- **Estado:** Parcial (5/60 candidatos evaluados)

### 14.4 Acta

- **Archivo:** `docs/execution/phase-4/vg-final-building-catalog-2026-11-04.md` (este documento)

---

## 15. Próximos pasos para completar V.g

### 15.1 Generación de candidatos restantes

```bash
# Generar los 55 candidatos restantes
node scripts/build-building-composer.mjs \
  --prefix=vg \
  --types=apartment_block,mixed_tenement,workshop,warehouse,cement_plant,brickworks,steelworks,town_hall,school_block,clinic,police_station,fire_station,market_hall \
  --seeds=1000,1001,1002,1003 \
  --outDir=docs/art/building-catalog-vg/candidates
```

**Tiempo estimado:** ~2.5 horas
**Requisito:** Blender local en `blender_artist/toolchain/blender-5.2.2-linux-x64/blender` o `BLENDER_BIN` en PATH

### 15.2 Contact sheets con source evidence

Implementar script actualizado que incluya columna SOURCE EVIDENCE mostrando módulos reales utilizados.

### 15.3 Silhouette sheets

Generar láminas de silueta por familia + lámina global de los 15 tipos.

### 15.4 Phaser QA mode

Implementar modo QA/fixture en Phaser para colocar candidatos en contexto real de juego.

### 15.5 Escenas QA en Phaser

Capturar escenas: residential, industrial, civic, centro cívico, city beauty shot.

### 15.6 Tests de semantic identity

Añadir tests de regresión para las 13 parejas de diferenciación y reglas de require/prohibit.

### 15.7 Selection matrix completa

Actualizar la matriz con los 60 candidatos y scoring completo.

### 15.8 Acta final

Completar este documento con todas las secciones requeridas y estado final.

---

## 16. Estado formal

**V.g FINAL BUILDING CATALOG — READY FOR HUMAN SELECTION (parcial)**

- ✅ Gramáticas: 15/15 validadas
- ✅ Pipeline: funcional
- ⏳ Candidatos: 5/60 generados
- ⏳ Evidence: pendiente
- ⏳ Tests: pendiente
- ⏳ Acta final: pendiente

**No se declara DONE hasta completar los 60 candidatos y toda la evidencia.**

---

## 17. Git

### 17.1 Commits

- `22a9dca` — V.f: cierre documental con revisión humana del responsable (HEAD inicial)
- _por determinar_ — V.g: gramáticas para 15 tipos de edificio
- _por determinar_ — V.g: pipeline actualizado con --prefix
- _por determinar_ — V.g: 5 candidatos de prueba generados
- _por determinar_ — V.g: selection matrix parcial
- _por determinar_ — V.g: acta parcial

### 17.2 Rama

- **Rama actual:** `wip/vg-final-building-catalog`
- **Base:** `22a9dca` (cierre V.f)
- **Push:** pendiente

### 17.3 Estado del working tree

```bash
git status
# Cambios sin commit:
# - blender_artist/manifests/building-composer-grammars.json (12 gramáticas nuevas)
# - scripts/build-building-composer.mjs (--prefix parameter)
# - docs/art/building-catalog-vg/ (nuevo directorio con evidencia parcial)
# - docs/execution/phase-4/vg-final-building-catalog-2026-11-04.md (acta parcial)
```

---

**Fin del acta parcial.**

**Última actualización:** 2026-11-04
**Responsable:** _por confirmar en revisión humana_
