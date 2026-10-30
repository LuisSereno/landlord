# Playtest humano de cierre de V.d — checklist

- **Estado: `PENDING HUMAN PLAYTEST`.** Este documento no registra una sesión jugada por una
  persona. Nadie ha jugado la partida de cierre, así que ninguna línea está verificada.
- **Fecha del documento:** 2026-10-29.
- **Commit base:** `c0bda82` (develop, con los doce commits de V.d-H1 sin push).
- **Motivo:** §2.4 del plan V.d-H1 exige una sesión humana para cerrar la fase. El agente que
  ejecutó el hardening dispone de un smoke automatizado en navegador (§2.3, `pnpm
  smoke:vd-core-loop`, 19 pasos) y de harnesses deterministas, pero un script que pulsa botones y
  lee el DOM **no** mide comprensión, fricción ni diversión. Presentar el smoke como playtest
  sería una falsa evidencia de cierre, así que la fase queda pendiente de una persona.

## Cómo se rellena

Una sesión, sin atajos por consola: build de producción o `pnpm --filter @landlord/web dev`, seed
`1` y otra seed a elección del playtester, velocidad normal y 4×, veinte a treinta minutos.
Cada línea se marca `OK`, `REGULAR`, `MAL` o `NO PROBADO` y se escribe lo visto en la columna de
observaciones. `OK` requiere haberlo hecho por la interfaz, no por comando.

## 1. Primer contacto y orientación

| # | Comprobación | Resultado esperado | Marcado | Observaciones |
|---|---|---|---|---|
| 1.1 | Al abrir la partida se entiende qué distrito se está mirando y cuál es el objetivo | El HUD nombra el distrito observado y el dinero | | |
| 1.2 | Cámara: arrastre, zoom y cambio de distrito con los nueve accesibles | Se llega a los nueve distritos y el mapa no se queda en blanco | | |
| 1.3 | Cambiar de distrito observado no cambia el estado de la partida (sólo la vista) | La caja y los activos siguen idénticos al volver | | |

## 2. Núcleo: comprar → construir → ocupar → cobrar

| # | Comprobación | Resultado esperado | Marcado | Observaciones |
|---|---|---|---|---|
| 2.1 | Comprar una parcela en el mercado local | Precio, caja y propiedad coherentes | | |
| 2.2 | Solicitar un permiso y leer su decisión en la parcela | La parcela muestra el permiso vigente con su estado, no sólo «aprobado/denegado» | | |
| 2.3 | Iniciar la obra con el permiso aprobado | El permiso pasa a consumido y la parcela queda en obra | | |
| 2.4 | Intentar construir un uso incompatible con el código urbanístico | La opción no aparece o se rechaza con mensaje claro | | |
| 2.5 | Esperar ocupación y cobrar renta | Ingresos visibles en el libro de caja | | |

## 3. Edificios múltiples por parcela (H1-07)

| # | Comprobación | Resultado esperado | Marcado | Observaciones |
|---|---|---|---|---|
| 3.1 | Seleccionar una parcela con varios edificios | Aparece «Edificios de la parcela» con todos ellos | | |
| 3.2 | Acciones de edificio sin selección previa | La UI pide elegir y no actúa sobre el primero de la lista | | |
| 3.3 | Cambiar de selección y actuar | Mantenimiento, Bomberos, inspección y venta afectan al edificio elegido | | |
| 3.4 | Seleccionar otro activo y volver | La elección anterior no se queda colgada | | |

## 4. Ocupación visual de parcelas multi-celda (H1-08)

| # | Comprobación | Resultado esperado | Marcado | Observaciones |
|---|---|---|---|---|
| 4.1 | Edificio grande (galería, fábrica, pabellón) | Vehículos, farolas y decoración rodean el volumen pintado, no se montan encima | | |
| 4.2 | Lote vacío | El arbolado no tapa la parcela ni se apila en una esquina | | |
| 4.3 | Rotar/alejar la cámara sobre una manzana densa | Sin parpadeo ni props duplicados | | |

## 5. Servicios municipales reales (H1-05, H1-06)

| # | Comprobación | Resultado esperado | Marcado | Observaciones |
|---|---|---|---|---|
| 5.1 | Capa «Bomberos» | El radio sigue a los equipos del distrito, no a un punto teórico | | |
| 5.2 | Incendio en un equipamiento (comisaría, escuela o mercado) | Cobertura de seguridad/bomberos cae mientras arde y sube al reparar | | |
| 5.3 | Capa «Seguridad» | Se distinguen parcelas cubiertas y descubiertas dentro del mismo distrito | | |
| 5.4 | Limpieza | El barrido de limpieza se nota en el distrito contratado y no drena presupuesto por las estrellas | | |
| 5.5 | Saturación | Con demanda alta el equipamiento declara saturación y el jugador entiende la consecuencia | | |

## 6. Valor del suelo y densidad (H1-09)

| # | Comprobación | Resultado esperado | Marcado | Observaciones |
|---|---|---|---|---|
| 6.1 | Capa «Valor del suelo» | Centro y corredores car; borde de ciudad barato; sin ruido sal y pimienta | | |
| 6.2 | Parcela junto a un equipamiento activo | Valor visiblemente mayor que la misma parcela con el equipamiento quemado | | |
| 6.3 | Aprobar una ordenanza de densidad | El skyline y el valor reaccionan; al vencer o cambiar de gobierno, deja de contar | | |
| 6.4 | Comparar dos parcelas parecidas | La diferencia se explica por accesibilidad, uso y servicios, no por azar | | |

## 7. Acción entre distritos (H1-01, escenario E)

| # | Comprobación | Resultado esperado | Marcado | Observaciones |
|---|---|---|---|---|
| 7.1 | Enviar una cuadrilla propia a otro distrito | No aparece como objetivo válido nada de otro distrito por cercanía de coordenadas | | |
| 7.2 | Un incendio en distrito vecino | Se atiende si la ruta existe; no se teletransporta | | |
| 7.3 | Interferencia (sabotaje) contra un rival en otro distrito | Requiere camino real | | |

## 8. Suelo público y municipio (invariantes §9)

| # | Comprobación | Resultado esperado | Marcado | Observaciones |
|---|---|---|---|---|
| 8.1 | Parcela pública | No puede comprarse, venderse, hipotecarse ni edificarse; aparece como «Ayuntamiento» | | |
| 8.2 | Equipamientos y espacios públicos | Se ven como edificios suyos, con su solar | | |

## 9. Guard y carga (deuda conocida)

| # | Comprobación | Resultado esperado | Marcado | Observaciones |
|---|---|---|---|---|
| 9.1 | Guardar y cargar tras 20 minutos de juego | La partida continúa sin cambios extraños | | |
| 9.2 | Primer cierre de caja del mes | Se nota un hitch de arranque (~300 ms) y luego es estable: es deuda declarada, no un fallo nuevo | | |

## Criterio de cierre

- V.d **no** se declara `CLOSED` mientras este documento esté en `PENDING HUMAN PLAYTEST` o
  cualquier línea obligatoria esté en `NO PROBADO`.
- Si aparece un defecto, se abre entrada en
  [vd-h1-urban-integrity-hardening-2026-10-29.md](file:///home/luis/RepositorioGitHub/landlord/docs/execution/phase-4/vd-h1-urban-integrity-hardening-2026-10-29.md)
  como problema nuevo con su prioridad y su test de regresión, y se vuelve a jugar la línea
  afectada.
- Al terminar: cambiar el estado a `DONE`, fecha, nombre del playtester, build y seeds usadas, y
  enlazar desde `docs/INDEX.md`.
