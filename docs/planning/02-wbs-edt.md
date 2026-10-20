# EDT / WBS

## 0. Producto
Visión, público, pilares, identidad de IP, métricas, glosario, Definition of Done.

## 1. Plataforma
Monorepo, TypeScript, Vite, lint, tests, CI, build y despliegue de pruebas.

## 2. Render
Mapa isométrico, cámara, zoom, depth sorting, picking, overlays, animaciones y feedback.

## 3. Simulación
Clock, fixed tick, seed, PRNG, entidades, comandos, eventos, snapshots, headless runner e instrumentación.

## 4. Mundo y urbanismo
Distrito, parcelas, ownership, ocupación, valor de suelo, accesibilidad, zoning, cambio de uso, restricciones y recalificación.

## 5. Construcción
Catálogo, validación, coste, obra, trabajadores, finalización, demolición, upgrade, permisos e inspecciones.

## 6. Recursos
Inventario, cemento, ladrillo, acero, fábricas, capacidad y consumo.

## 7. Inmobiliario
Tenant, compatibilidad, contrato, renta, satisfacción, vacancy, mantenimiento, deterioro, valoración, oferta/demanda y subastas.

## 8. Empresa y finanzas
Caja, ingresos, costes, balance, liquidez, deuda, interés, garantías, seguros, insolvencia, ejecución, equity futuro y automatización.

## 9. Fiscalidad
Property tax, impuestos empresariales, tasas, licencias, compraventa, sanciones, bonificaciones y liquidación automática.

## 10. IA rival
Objetivos, observación, utility, compra, construcción, liquidez, crédito, memoria y recuperación.

## 11. Crimen
Acción ilegal, coste, detección, heat, consecuencias, sabotaje, corrupción y expansión futura.

## 12. Policía y justicia
Presión, investigación, respuesta, presupuesto, sanciones, embargo, litigios y justicia futura.

## 13. Política
Policies, propuestas, concejales, predisposición, influencia, votación, enactment, modifiers, expiración, presupuesto municipal y elecciones futuras.

## 14. Sociedad y trabajo
Hogares, empleo, salarios, movilidad, sindicatos futuros, protestas, asociaciones y opinión pública.

## 15. Servicios urbanos
Transporte, accesibilidad, limpieza, seguridad, educación, salud, ocio e infraestructura.

## 16. Contratación pública y concesiones
Licitaciones, ofertas, capacidad, reputación, adjudicación, ejecución contractual y concesiones futuras.

## 17. Información y reputación
Reputación multidimensional, información imperfecta, analistas, contactos, investigación y espionaje futuro.

## 18. Negociación
Compraventas, préstamos entre actores, participaciones, joint ventures, treguas y acuerdos.

## 19. Eventos y macroeconomía
Booms, crisis, tipos, escasez, huelgas, incendios, migraciones, cierres de empresas y shocks condicionados.

## 20. UX
HUD, tooltips, paneles de parcela/edificio/economía/rival/política, alertas, automatización y accesibilidad.

## 21. Persistencia
Schema, save, load, autosave, migrations, recovery y cloud futuro.

## 22. QA
Unit, determinismo, fixtures, integración, performance, soak, balance simulation y pruebas económicas.

## 23. Arte
Dirección visual, tiles, edificios, workers, tenants, VFX, UI y audio.

## 24. Identidad, roles y multiperspectiva

### 24.1 Compatibilidad base
- PlayerIdentity separado de Company;
- Person persistente;
- Organization independiente;
- ownership separado de control;
- actor explícito en comandos relevantes.

### 24.2 Roles/capabilities futuros
- RoleAssignment;
- capability resolver;
- offices;
- memberships;
- delegations;
- ControlContext.

### 24.3 Gameplay LOD futuro
- UI por perspectiva;
- overlays;
- information scope;
- delegación;
- escalado de excepciones.

### 24.4 Trayectoria futura
- career history;
- Career Events;
- transiciones bidireccionales;
- multirol;
- conflictos de interés.

### 24.5 Perspectivas futuras
- politician/mayor;
- criminal;
- bank/investor;
- contractor;
- union/media;
- strategic citizen.

### 24.6 Life simulation de muy largo plazo
- age;
- family;
- education;
- inheritance;
- generations;
- dynasty.

Sólo 24.1 condiciona la arquitectura inicial. El resto permanece fuera del producto base hasta decisión explícita.
