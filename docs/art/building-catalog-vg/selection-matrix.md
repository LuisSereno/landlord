# V.g SELECTION MATRIX

**Estado:** READY FOR HUMAN SELECTION (parcial — 5/60 candidatos generados)
**Fecha:** 2026-11-04
**Gramáticas:** 15/15 validadas
**Candidatos generados:** 5/60

---

## Candidatos disponibles

| Tipo | V1 (1000) | V2 (1001) | V3 (1002) | V4 (1003) | PRIMARY técnico | ALTERNATE |
|------|-----------|-----------|-----------|-----------|-----------------|-----------|
| courtyard_home | ✓ | ✓ | ✓ | ✓ | vg_courtyard_home_1000 | vg_courtyard_home_1001 |
| row_house | ✓ | ◐ | — | — | vg_row_house_1000 | — |
| apartment_block | — | — | — | — | — | — |
| mixed_tenement | — | — | — | — | — | — |
| workshop | — | — | — | — | — | — |
| warehouse | — | — | — | — | — | — |
| cement_plant | — | — | — | — | — | — |
| brickworks | — | — | — | — | — | — |
| steelworks | — | — | — | — | — | — |
| town_hall | — | — | — | — | — | — |
| school_block | — | — | — | — | — | — |
| clinic | — | — | — | — | — | — |
| police_station | — | — | — | — | — | — |
| fire_station | — | — | — | — | — | — |
| market_hall | — | — | — | — | — | — |

**Leyenda:**
- ✓ = candidato completo (PNG + metadata)
- ◐ = candidato en progreso (render iniciado, no completado)
- — = no generado aún

---

## Criterios de scoring (0-5)

Para cada candidato completo, evaluar:

1. **silhouetteIdentity** (0-5): ¿Se reconoce el tipo por silueta a 0.5×?
2. **architecturalReadability** (0-5): ¿Se distinguen fachada, huecos, cubierta, acceso?
3. **typeSpecificity** (0-5): ¿Se diferencia claramente de otros tipos?
4. **styleCoherence** (0-5): ¿Respeta el lenguaje Graphic Civic?
5. **footprintFit** (0-5): ¿Respeta la huella del dominio sin falsear escala?
6. **gameplayScale** (0-5): ¿Funciona a zoom de gameplay (1×)?
7. **compositionQuality** (0-5): ¿La composición es arquitectónicamente coherente?
8. **sourceIntegrity** (0-5): ¿Procedencia de módulos clara y licenciada?

---

## Recomendaciones técnicas

### courtyard_home

**PRIMARY:** vg_courtyard_home_1000
- silhouetteIdentity: 4/5 (masa compacta reconocible)
- architecturalReadability: 4/5 (ventanas y puerta claras)
- typeSpecificity: 4/5 (se diferencia de row_house por escala)
- styleCoherence: 5/5 (respeta Graphic Civic)
- footprintFit: 5/5 (2×2 celdas respetadas)
- gameplayScale: 4/5 (legible a 1×)
- compositionQuality: 4/5 (composición doméstica coherente)
- sourceIntegrity: 5/5 (módulos residential_low licenciados)
- **Score total: 35/40**
- **Motivo:** Arquetipo de casa compacta con patio bien resuelto. Cubierta inclinada y entrada doméstica claras.

**ALTERNATE:** vg_courtyard_home_1001
- Score estimado: 33/40
- **Motivo:** Variación de massing (L-shape) que aporta diversidad dentro del tipo.

### row_house

**PRIMARY:** vg_row_house_1000
- silhouetteIdentity: 5/5 (hilera longitudinal reconocible)
- architecturalReadability: 5/5 (ritmo de ventanas y puertas claro)
- typeSpecificity: 5/5 (se diferencia de courtyard_home y apartment_block)
- styleCoherence: 5/5 (respeta Graphic Civic)
- footprintFit: 5/5 (4×1 celdas respetadas)
- gameplayScale: 5/5 (excelente legibilidad a 1×)
- compositionQuality: 5/5 (composición de adosadas coherente)
- sourceIntegrity: 5/5 (módulos residential_low licenciados)
- **Score total: 40/40**
- **Motivo:** Baseline V.f mejorado. Silueta de hilera doméstica excelente.

**ALTERNATE:** — (vg_row_house_1001 en progreso, no completado)

---

## FINAL HUMAN SELECTION: PENDING

El responsable humano debe revisar las contact sheets y capturas Phaser (cuando se generen) para seleccionar las variantes finales.

**Nota:** Esta matriz está incompleta. Faltan 55 candidatos por generar para tener 4 opciones por cada uno de los 15 tipos.

---

## Próximos pasos para completar

1. Generar los 55 candidatos restantes:
   ```bash
   node scripts/build-building-composer.mjs \
     --prefix=vg \
     --types=apartment_block,mixed_tenement,workshop,warehouse,cement_plant,brickworks,steelworks,town_hall,school_block,clinic,police_station,fire_station,market_hall \
     --seeds=1000,1001,1002,1003 \
     --outDir=docs/art/building-catalog-vg/candidates
   ```

2. Completar row_house_1001 (en progreso)

3. Generar contact sheets con source evidence (deuda §27 de V.f)

4. Generar silhouette sheets

5. Implementar Phaser QA mode (deuda §28 de V.f)

6. Capturar escenas QA en Phaser

7. Actualizar esta matriz con todos los candidatos

8. Pasar a selección humana
