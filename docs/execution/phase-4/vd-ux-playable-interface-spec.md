# V.d-UX — Playable Interface, Contextual UX and Visual Vocabulary

> Estado: **SPEC READY / NOT IMPLEMENTED**  
> Rama objetivo: `develop`  
> Base observada al redactar: `b750fb3a166d810e566c53bed688eb33f0cb5f02`  
> Fecha: 2026-10-30  
> Propósito: convertir la Alpha técnicamente jugable de Landlord en una experiencia que un jugador pueda comprender, navegar y operar sin conocer la arquitectura interna de la simulación.

---

## 1. Resumen ejecutivo

V.d ha construido una ciudad 3×3, parcelas multi-cell, edificios multi-footprint, economía inmobiliaria, producción, deuda, política municipal, servicios espaciales, overlays, agentes y una presentación isométrica funcional. El problema principal ya no es la ausencia de sistemas, sino la **forma en la que esos sistemas se presentan al jugador**.

La interfaz actual conserva demasiadas características de una herramienta interna de Alpha:

- un panel lateral permanente que compite con la ciudad por espacio;
- múltiples sistemas heterogéneos visibles a la vez;
- botones de política, producción, materiales, cartera y construcción mezclados en una misma superficie;
- textos con IDs internos, ticks y vocabulario de implementación;
- jerarquía insuficiente entre información primaria y detalle técnico;
- ausencia de una iconografía coherente;
- ausencia de miniaturas de los objetos que el jugador va a construir;
- poca ayuda contextual;
- notificaciones poco conectadas con el lugar o sistema que las origina;
- onboarding basado en instrucciones textuales en vez de acciones contextuales.

Esta fase NO añade nuevas reglas de simulación. Su objetivo es crear una **Playable UX Shell** encima del estado y los comandos ya existentes.

Resultado esperado:

> El jugador interactúa con una ciudad, edificios, instituciones, dinero, inquilinos, materiales, riesgos y decisiones. Nunca debería sentir que está operando directamente `GameState`, IDs, ticks o estructuras internas del motor.

---

## 2. Fuentes de verdad y precedencia

El agente que ejecute esta fase debe leer antes de modificar código:

1. `AGENTS.md`;
2. `ai-context/README.md`;
3. `ai-context/PROJECT-STATE.md`;
4. `ai-context/DECISIONS.md`;
5. `ai-context/ARCHITECTURE.md`;
6. `ai-context/GAME-DOMAIN.md`;
7. `docs/INDEX.md`;
8. `docs/product/02-game-design.md`;
9. `docs/art/ART-BIBLE.md`;
10. `docs/execution/phase-3/wp3-12-automation-ux-2026-10-23.md`;
11. `docs/execution/phase-4/vd-h1-urban-integrity-hardening-2026-10-29.md`;
12. `docs/execution/phase-4/vd-h2-presentation-service-closure-2026-10-30.md`;
13. este documento.

Si el código actual contradice ejemplos antiguos, no se debe forzar el código a coincidir con un ejemplo histórico. Se debe conservar el comportamiento vigente y registrar/corregir la deuda documental.

---

## 3. Principios no negociables

### 3.1 La ciudad es el producto; la UI es soporte

El viewport isométrico debe ocupar la mayor parte de la pantalla. No debe existir un panel administrativo permanentemente abierto que robe aproximadamente un tercio del espacio útil sin que el jugador lo haya solicitado.

### 3.2 Contexto antes que catálogo

La selección gobierna la interfaz:

- seleccionar una parcela muestra información y acciones de esa parcela;
- seleccionar un edificio muestra información y acciones de ese edificio;
- seleccionar una obra muestra progreso, requisitos y cuadrillas;
- seleccionar el Ayuntamiento abre el contexto institucional municipal;
- seleccionar un activo rival sólo muestra información que el jugador puede conocer;
- las acciones globales se agrupan en hubs globales, no se mezclan con cualquier selección.

### 3.3 Progressive disclosure

Cada superficie debe tener tres niveles:

1. resumen para decidir;
2. detalle contextual para actuar;
3. explicación avanzada para aprender.

El jugador no debe recibir todos los datos posibles en el primer nivel.

### 3.4 El lenguaje de dominio nunca es el lenguaje de implementación

Queda prohibido mostrar al jugador:

- `tick`;
- `commandId`;
- `parcel_000...`;
- `building_000...`;
- `crew_000...`;
- `org_000...`;
- nombres de enums;
- nombres de propiedades de TypeScript;
- textos como `approved`, `consumed`, `cooldown`, `workRequired` o similares sin traducción semántica.

Internamente pueden seguir existiendo. La prohibición afecta a presentación, tooltips, alertas, inspector y mensajes de éxito/error visibles.

### 3.5 Icono + texto en decisiones importantes

Durante Alpha/Beta ninguna acción irreversible o económicamente importante debe depender de un icono sin etiqueta.

Correcto:

`[icono] Construir`

Incorrecto:

`[icono sin texto]`

Los iconos compactos sin texto se reservan para acciones universales y aprendidas, como cerrar, ayuda, notificaciones o velocidad, siempre con tooltip y `aria-label`.

### 3.6 El color nunca es la única señal

Propiedad, riesgo, disponibilidad, categorías y alertas deben combinar color con al menos otra señal: icono, patrón, texto, borde o forma.

### 3.7 El render no inventa reglas

React/Phaser no decide elegibilidad, precio, cobertura, riesgo ni permisos. Consume la proyección autoritativa y envía comandos normales.

### 3.8 Esta fase no crea sistemas nuevos

No añadir por necesidades de UI:

- un banco físico si todavía no existe como entidad espacial;
- nuevas facilities municipales;
- nuevos impuestos;
- nuevas ordenanzas;
- nuevas reglas de población;
- nuevas mecánicas de producción;
- una enciclopedia con hechos que el motor no soporta;
- una nueva economía o tutorial autoritativo.

---

## 4. Objetivos de experiencia

Al terminar V.d-UX, un usuario nuevo debe poder:

1. entender dónde está su dinero y si gana o pierde dinero;
2. reconocer una parcela comprable sin leer documentación externa;
3. comprar una parcela;
4. elegir visualmente qué quiere construir;
5. distinguir una casa, un taller, una cementera, una acería, una ladrillera y otros edificios antes de leer toda su ficha;
6. identificar qué materiales necesita;
7. iniciar una obra y asignar una cuadrilla;
8. entender el progreso sin ver ticks;
9. navegar a un problema desde una notificación;
10. localizar gobierno/política desde el Ayuntamiento o su acceso global;
11. localizar préstamos/deuda desde Finanzas/Banco;
12. obtener ayuda contextual sobre una métrica o acción;
13. comprender por qué una acción está deshabilitada;
14. cambiar de overlay sin manejar un selector técnico;
15. completar el bucle `comprar → producir/comprar materiales → construir → ocupar → cobrar` sin consultar el código o una guía externa.

---

## 5. Arquitectura de información objetivo

### 5.1 Shell global

La pantalla de juego se compone de:

1. **HUD superior compacto**;
2. **viewport isométrico dominante**;
3. **toolbar de herramientas/capas**;
4. **panel contextual colapsable** sólo cuando existe una selección o hub abierto;
5. **centro de notificaciones** bajo demanda;
6. **tooltips/popovers de ayuda** bajo demanda.

### 5.2 HUD superior

Debe mostrar únicamente información de consulta frecuente:

- caja disponible;
- resultado mensual resumido si existe en proyección;
- fecha de juego;
- velocidad y pausa;
- recursos principales cuando sean relevantes;
- campana de notificaciones con contador;
- ayuda;
- guardar/cargar;
- acceso de desarrollo a Art Lab sólo en modo/dev adecuado, no como acción principal del jugador final.

No debe convertirse en un segundo panel de administración.

### 5.3 Panel contextual

Desktop baseline:

- aparece a la derecha;
- colapsable;
- ancho objetivo aproximado 360–420 px;
- nunca debe ocupar más de aproximadamente 35 % del viewport en resoluciones objetivo;
- contiene cabecera, resumen, acciones primarias y detalle por pestañas/secciones;
- al cerrarlo, la ciudad recupera el espacio.

### 5.4 Toolbar

Debe evitar un `<select>` textual para las funciones de uso continuo.

Baseline:

- Propiedad;
- Valor;
- Zonificación/uso;
- Servicios;
- Riesgo;
- Construcción cuando proceda.

Cada herramienta combina icono, etiqueta accesible y tooltip.

---

## 6. Paneles contextuales por entidad

### 6.1 Parcela vacante

Primer nivel:

- nombre/localización legible;
- precio;
- propietario o disponibilidad;
- uso/código resumido en lenguaje humano;
- potencial de servicios;
- valor/riesgo resumidos;
- acción primaria `Comprar` si procede.

Segundo nivel:

- superficie/huella;
- usos admitidos;
- potencial normativo;
- aptitud productiva;
- impuestos/cargas estimados;
- detalle de servicios;
- regulación.

Nunca mostrar el ID técnico como nombre principal.

### 6.2 Parcela propia

Debe priorizar:

- estado;
- edificios existentes;
- obra activa;
- acciones de construir/vender/financiar cuando sean legales;
- valor y rentabilidad.

### 6.3 Edificio propio

Resumen recomendado:

- miniatura/icono del tipo;
- nombre amigable;
- ocupación;
- ingresos/gastos cuando existan;
- condición;
- mantenimiento;
- rentabilidad;
- estado de seguro/deuda si aplica.

Acciones agrupadas:

- Inquilinos;
- Mantenimiento;
- Mejorar;
- Seguro;
- Finanzas;
- Vender.

No mostrar todas las acciones si el edificio no las admite.

### 6.4 Edificio rival

Mostrar exclusivamente información permitida por el sistema de información vigente.

No filtrar datos privados por comodidad de UX.

Acciones tácticas deben aparecer sólo cuando el contrato de capacidades/actor las permita.

### 6.5 Obra

Mostrar:

- qué se está construyendo, con miniatura;
- progreso en porcentaje;
- estimación temporal en lenguaje del juego cuando sea posible;
- cuadrillas asignadas con nombres amigables;
- materiales/reservas relevantes;
- cancelar obra;
- problemas de obra.

Prohibido mostrar `workRequired`, ticks o IDs de crew como contenido primario.

### 6.6 Facility cívica

Mostrar función, estado, capacidad/utilización con semántica correcta, distrito servido y acceso a la institución si procede.

### 6.7 Ayuntamiento

El Ayuntamiento es el hogar contextual de:

- ordenanzas;
- fiscalidad municipal;
- presupuesto y servicios;
- concejo/elecciones si están disponibles;
- reputación municipal relevante.

Debe existir además un acceso global `Gobierno` que pueda abrir el mismo hub y, si procede, ofrecer `Ir al Ayuntamiento`.

No obligar al jugador a encontrar físicamente el Ayuntamiento cada vez.

### 6.8 Finanzas / banco

El dominio actual tiene banca, deuda, garantías, refinanciación y subastas, pero no debe inventarse un edificio físico de banco sólo para la UI.

Crear un hub global `Finanzas`/`Banco` que agrupe:

- ofertas de préstamo;
- préstamos activos;
- garantías;
- atrasos/impagos;
- refinanciación;
- subastas relevantes.

Si en una fase futura existe un banco físico, el hub podrá vincularse a él.

### 6.9 Producción

Una fábrica/taller debe concentrar:

- recurso producido;
- ciclo/progreso traducido;
- materias primas;
- producción prevista;
- condición;
- mantenimiento;
- ampliaciones;
- incidencias.

---

## 7. UX-04 — Visual Vocabulary & Iconography

Esta sección es obligatoria y forma parte del Definition of Done de V.d-UX.

### 7.1 Regla central

Todo objeto físico seleccionable debe tener:

1. representación en el mundo;
2. representación reconocible en menús/listas;
3. nombre legible para el jugador.

### 7.2 Edificios: miniatura del asset real

Para `BuildingType` NO usar como primera opción un icono genérico de fábrica/casa.

Crear un componente, helper o equivalente conceptual:

`BuildingThumbnail(buildingType, state?)`

Fuente:

`RuntimeAssetManifestV2`.

Baseline:

- usar el frame `complete`;
- mantener proporciones;
- `object-fit: contain` o equivalente;
- fondo neutro coherente con la UI;
- no rasterizar manualmente una segunda colección;
- si Blender sustituye el asset procedural y el runtime lo selecciona, la arquitectura debe permitir actualizar la miniatura sin mantener iconos duplicados.

Los 15 tipos actuales deben tener thumbnail verificable.

### 7.3 Selector de construcción visual

El selector no debe ser una lista textual larga.

Debe usar categorías y tarjetas:

- Vivienda;
- Comercio/Mixto;
- Industria;
- Producción;
- otras sólo si el catálogo actual las justifica.

Cada tarjeta contiene como mínimo:

- miniatura;
- nombre;
- coste principal;
- función principal;
- estado habilitado/deshabilitado.

Al seleccionar una tarjeta aparece el detalle:

- descripción breve;
- coste;
- materiales;
- capacidad/uso;
- producción si aplica;
- requisitos;
- motivo exacto si no puede construirse;
- botón `Construir`.

### 7.4 Recursos

Crear una representación visual consistente para:

- cemento;
- ladrillo;
- acero.

Debe funcionar en:

- HUD;
- tarjetas de construcción;
- compras de materiales;
- producción;
- tooltips.

El icono acompaña al texto en superficies de aprendizaje. Puede quedar solo con tooltip en HUD compacto.

### 7.5 Iconografía semántica

Debe existir un registro único de iconos semánticos, por ejemplo `UiIconName`/`iconCatalog`, no SVG arbitrarios repartidos por componentes.

Conjunto mínimo:

- money;
- income;
- expense;
- finance/bank;
- loan/debt;
- government/town-hall;
- ordinance/document;
- tax;
- housing;
- industry;
- production;
- materials;
- construction;
- tenants;
- maintenance;
- security;
- fire;
- health;
- education;
- market;
- insurance;
- auction;
- rival/competition;
- ownership;
- land-value;
- zoning/use;
- services;
- risk;
- notifications;
- help;
- info;
- warning;
- error;
- success;
- navigate/focus-on-map.

### 7.6 Especificación técnica de iconos

Para evitar dependencia artística prematura:

- usar SVG DOM;
- naming `ico_*` en assets si se versionan como archivos;
- `viewBox` común, recomendado `0 0 24 24`;
- `currentColor` para heredar el contexto;
- grosor visual consistente;
- `stroke-linecap`/`stroke-linejoin` coherentes;
- no usar emoji como iconografía del producto;
- no mezclar familias visuales diferentes.

El agente NO debe añadir una dependencia externa de iconos sin:

1. verificar licencia;
2. documentarla;
3. demostrar que no rompe budgets;
4. justificar por qué el registro interno no es suficiente.

Baseline preferido para esta fase: catálogo SVG interno y pequeño.

### 7.7 Accesibilidad de iconos

- iconos decorativos: `aria-hidden=true`;
- iconos interactivos: botón con `aria-label`;
- tooltip accesible por hover y focus;
- el significado crítico nunca depende sólo del color o del icono.

---

## 8. Centro de notificaciones

### 8.1 Objetivo

Transformar alertas derivadas en decisiones navegables.

### 8.2 Campana

HUD superior derecho:

- campana;
- contador de no leídas;
- apertura de panel/popover;
- agrupación por prioridad/categoría.

### 8.3 Categorías

Baseline:

- Urgente;
- Finanzas;
- Propiedades;
- Producción;
- Gobierno;
- Competencia;
- Información.

Usar categorías existentes/derivables; no inventar eventos de simulación.

### 8.4 Acción de navegación

Una notificación debe poder resolver un target semántico:

- parcela;
- edificio;
- obra;
- distrito;
- Ayuntamiento;
- hub de Finanzas;
- panel de Gobierno;
- producción.

Acciones posibles:

- `Ir al edificio`;
- `Ver parcela`;
- `Abrir Finanzas`;
- `Abrir Gobierno`;
- `Ver producción`.

Si el target no es espacial, abrir el hub correspondiente. No crear coordenadas ficticias.

### 8.5 Estado leído/no leído

Es estado de presentación, no una regla autoritativa de simulación.

Puede mantenerse localmente sin modificar determinismo del motor.

---

## 9. Indicadores en el mundo

Los badges flotantes se reservan a información accionable y espacial.

Prioridad:

1. incendio/colapso;
2. problema que bloquea una operación;
3. mantenimiento crítico;
4. obra bloqueada;
5. falta de materiales;
6. oportunidad/estado secundario sólo si no genera clutter.

Reglas:

- máximo visual razonable por edificio;
- combinar múltiples avisos bajo un indicador si compiten;
- ocultar o simplificar en zoom lejano;
- hover explica;
- click selecciona entidad y abre sección pertinente;
- no llenar toda la ciudad de iconos persistentes.

---

## 10. Ayuda contextual

### 10.1 Tooltip universal

Todo concepto no trivial debe tener explicación breve cuando el usuario pasa el ratón o enfoca con teclado.

Ejemplo conceptual:

`Rentabilidad 7,4 %`

Tooltip:

`Beneficio anual estimado respecto al capital invertido. Incluye los ingresos y gastos que el juego puede calcular actualmente.`

### 10.2 Botón de ayuda contextual

Paneles complejos deben tener un `?` o acción `Ayuda`.

El popover explica:

- qué representa el sistema;
- qué puede hacer el jugador;
- qué efectos principales tiene;
- enlace interno a ayuda ampliada si existe.

### 10.3 Catálogo de ayuda

Implementar una fuente de datos única en web, no párrafos hardcoded en veinte componentes.

Ejemplo conceptual:

`helpCatalog['land_value']`

Campos sugeridos:

- title;
- summary;
- details opcional;
- relatedActions opcional.

No debe contener reglas que contradigan al motor.

---

## 11. Traducción de tiempo e identidad

### 11.1 Tiempo

Ningún tick se muestra al jugador.

Ejemplos de transformación:

- `approved hasta tick 218212` → `Permiso válido hasta 17 de marzo`;
- `cooldown 7200 ticks` → `Disponible de nuevo en 2 días`;
- `nextSettlementTick` → `Próximo cobro: 1 de febrero`;
- `progress/workRequired` → `35 % completado`.

Si la proyección actual no aporta datos suficientes para transformar un tick sin duplicar reglas de calendario en React, ampliar la proyección con un valor semántico derivado. No copiar constantes privadas del motor al DOM.

### 11.2 IDs

Los IDs siguen siendo necesarios para comandos, logs y debugging, pero no como labels.

Ejemplos:

- `crew_00000002` → `Cuadrilla 2` o nombre semántico derivado estable;
- `org_00000004` → nombre de organización del catálogo;
- `parcel_*` → dirección/nombre de parcela o `Parcela de Avenida ...` cuando exista esa semántica;
- `building_*` → nombre del edificio/tipo + localización.

El modo debug puede mostrar IDs detrás de una opción de desarrollo explícita.

---

## 12. Onboarding progresivo

Eliminar como solución final el bloque permanente `Cómo jugar esta prueba`.

Reemplazarlo por objetivos contextuales discretos, derivados del estado:

### Paso 1 — Primera parcela

`Compra tu primera parcela`

Acción:

`Mostrar parcelas disponibles`.

### Paso 2 — Primer proyecto

`Elige qué construir`.

### Paso 3 — Recursos

Mostrar qué falta con iconos de material.

### Paso 4 — Obra

`Asigna una cuadrilla`.

### Paso 5 — Operación

Según el tipo:

- ocupar/alquilar;
- producir;
- mantener.

### Paso 6 — Finanzas/política

Introducir sólo cuando exista una razón contextual para hacerlo.

El onboarding no es una misión autoritativa nueva. Es una capa de presentación.

---

## 13. Hubs globales

### 13.1 Gobierno

Shortcut global + entrada desde Ayuntamiento.

Contenido sólo si el sistema existe:

- ordenanzas;
- impuestos;
- servicios municipales;
- concejo/política;
- reputación municipal.

### 13.2 Finanzas

Shortcut global.

Contenido:

- caja/posición financiera;
- ofertas de préstamo;
- préstamos;
- garantías;
- atrasos;
- refinanciación;
- subastas.

### 13.3 Cartera

Debe aprovechar lo implementado en WP3.12:

- activos;
- renta;
- condición;
- mantenimiento;
- deuda;
- seguro;
- excepciones.

El comparador no debe estar abierto permanentemente.

---

## 14. Overlays

Reemplazar el selector textual principal por una herramienta visual.

Grupos recomendados:

- Propiedad;
- Valor;
- Zonificación/Uso;
- Servicios;
- Riesgo.

Los sub-overlays pueden aparecer después de abrir el grupo `Servicios` o equivalente.

Cada overlay debe:

- tener icono;
- label;
- tooltip;
- leyenda cuando el color tenga significado;
- botón claro para volver a vista normal.

---

## 15. Diseño visual de UI

V.d-UX debe respetar la Art Bible:

- oscuro pero legible;
- materiales/tono industrial sin convertir cada panel en decoración pesada;
- jerarquía tipográfica clara;
- densidad moderada;
- estados hover/focus/selected/disabled inequívocos;
- botones primarios diferenciados de secundarios;
- espaciado consistente;
- sin apariencia de dashboard empresarial genérico.

Introducir design tokens CSS si todavía no existen de forma suficiente:

- spacing;
- radius;
- panel/background;
- text primary/secondary/muted;
- border;
- focus ring;
- status semantic;
- typography sizes;
- z-index layers.

No hacer una reescritura estética completa si no es necesaria para la arquitectura.

---

## 16. Estados vacíos, disabled y errores

Un botón deshabilitado siempre debe poder explicar por qué.

Ejemplos:

- `Necesitas 2 ladrillos más`;
- `Esta parcela no permite uso industrial`;
- `No tienes una cuadrilla libre`;
- `El permiso ha caducado`;
- `Necesitas comprar la parcela antes de construir`.

No usar mensajes genéricos como `acción no disponible` si el motor puede aportar una razón concreta.

Errores técnicos no deben volcar excepciones o enums al jugador.

---

## 17. Resoluciones y accesibilidad

Objetivo principal: desktop.

QA obligatorio al menos en:

- 1280×720;
- 1440×900;
- 1920×1080;
- una resolución ultrawide razonable.

Requisitos:

- el panel contextual no tapa el foco de selección de forma permanente;
- textos no se cortan sin alternativa;
- scroll sólo dentro de superficies que lo necesitan;
- foco de teclado visible;
- Escape cierra popover/modal/panel según jerarquía;
- tooltips accesibles por teclado;
- `prefers-reduced-motion` respetado en animaciones UI nuevas;
- no depender sólo de color;
- tamaños de hit target razonables.

Mobile/touch completo queda fuera del alcance salvo que el proyecto lo decida expresamente.

---

## 18. Modelo técnico de componentes

El agente puede adaptar nombres a la estructura real, pero la separación conceptual debe existir.

Componentes/servicios esperados o equivalentes:

- `GameHud`;
- `GameToolbar`;
- `ContextPanel`;
- `EntityHeader`;
- `ParcelPanel`;
- `BuildingPanel`;
- `ConstructionPanel`;
- `TownHallPanel`/`GovernmentHub`;
- `FinanceHub`;
- `PortfolioHub`;
- `BuildCatalog`;
- `BuildingCard`;
- `BuildingThumbnail`;
- `ResourceIcon`;
- `UiIcon`;
- `NotificationCenter`;
- `WorldIndicatorLayer`;
- `HelpTooltip`;
- `HelpPopover`;
- `GameTimeLabel` helpers;
- `playerFacingLabel` helpers.

No es obligatorio crear un archivo por nombre; sí evitar volver a concentrar toda la UI en un `App.tsx` monolítico.

---

## 19. Datos y proyección

### 19.1 Regla

La UI sólo debe mostrar información que:

- ya existe en la proyección;
- puede derivarse sin duplicar reglas;
- o se añade a la proyección como dato derivado y validado.

### 19.2 Permitido ampliar proyección

Ejemplos legítimos:

- display-ready date/duration;
- labels de organización;
- razones estructuradas de disabled cuando actualmente sólo existe un boolean;
- target semántico de una alerta;
- summary económico ya derivable.

### 19.3 No permitido

- leer `GameState` directamente desde React para saltarse la proyección;
- importar reglas privadas de simulación para reconstruir elegibilidad;
- inferir información del rival que el sistema de información no expone;
- mutar estado desde componentes.

---

## 20. Plan de ejecución

El trabajo debe hacerse en paquetes secuenciales. No intentar todo en un único commit.

### UX-00 — Inventory & shell contract

Objetivo:

- inventariar superficies actuales de `App.tsx`;
- mapear cada bloque a HUD, contexto, hub, notificación, ayuda o eliminación;
- crear una tabla de migración;
- no cambiar reglas.

Entregable:

`docs/execution/phase-4/vd-ux-ui-inventory.md` o sección equivalente en el acta.

### UX-01 — Game shell

- HUD superior compacto;
- viewport dominante;
- panel contextual colapsable;
- toolbar;
- mover Guardar/Cargar/Ayuda/Notificaciones;
- conservar capacidades actuales.

### UX-02 — Entity contextual panels

- parcela;
- edificio;
- obra;
- rival;
- facility.

### UX-03 — Institutional/global hubs

- Gobierno/Ayuntamiento;
- Finanzas;
- Cartera.

### UX-04 — Visual vocabulary & iconography

- `UiIcon` registry;
- resource icons;
- 15 building thumbnails;
- visual build catalog;
- overlay icons;
- status icons.

### UX-05 — Notifications & world indicators

- bell;
- categories;
- navigation;
- world badges prioritised.

### UX-06 — Contextual help

- tooltips;
- `?` popovers;
- help catalog;
- disabled reasons.

### UX-07 — Player-facing language

- eliminate ticks;
- eliminate raw IDs;
- translate technical statuses;
- date/duration formatters.

### UX-08 — Progressive onboarding

- first parcel;
- construction;
- resources;
- crew;
- operation;
- contextual introduction to finance/government.

### UX-09 — Overlays

- visual toolbar;
- legends;
- sub-overlays;
- clear normal-view exit.

### UX-10 — Responsive/accessibility hardening

- target resolutions;
- keyboard/focus;
- reduced motion;
- overflow;
- readable density.

### UX-11 — Browser QA and evidence

- smoke;
- screenshots;
- regression;
- manual checklist preparation.

---

## 21. Orden recomendado de commits

Ejemplo:

1. `refactor: split the playable game shell from alpha inspector UI`
2. `feat: add contextual parcel building and construction panels`
3. `feat: add government finance and portfolio hubs`
4. `feat: add unified UI icon vocabulary and building thumbnails`
5. `feat: add actionable notification center and world indicators`
6. `feat: add contextual help and disabled action reasons`
7. `fix: remove internal ticks and ids from player facing UI`
8. `feat: add progressive first-session onboarding`
9. `feat: replace map layer select with accessible overlay toolbar`
10. `test: add V.d UX browser acceptance coverage`
11. `docs: record V.d UX playable shell evidence`.

El agente puede dividir más, pero no debe producir un commit masivo de toda la UI.

---

## 22. Acceptance criteria

### 22.1 Shell

- [ ] la ciudad domina visualmente la pantalla;
- [ ] el panel derecho ya no está permanentemente abierto;
- [ ] el HUD contiene sólo estado frecuente;
- [ ] la selección abre contexto relevante;
- [ ] cerrar contexto devuelve espacio al mapa.

### 22.2 Construcción e iconografía

- [ ] los 15 `BuildingType` tienen thumbnail;
- [ ] casa/cementera/acería/ladrillera/taller/etc. se distinguen visualmente;
- [ ] selector por tarjetas, no lista textual larga;
- [ ] cemento/ladrillo/acero tienen iconos consistentes;
- [ ] acciones importantes usan icono + texto;
- [ ] no se usan emojis como iconos de producto;
- [ ] iconos críticos tienen tooltip/aria-label.

### 22.3 Contexto

- [ ] parcela vacante no muestra acciones irrelevantes;
- [ ] edificio propio agrupa sus operaciones;
- [ ] obra muestra progreso y cuadrillas sin IDs técnicos;
- [ ] rival respeta information boundaries;
- [ ] Ayuntamiento concentra gobierno;
- [ ] Finanzas concentra banca/deuda sin inventar edificio físico.

### 22.4 Notificaciones

- [ ] campana con contador;
- [ ] panel de historial;
- [ ] categorías;
- [ ] acción navega a entidad/hub;
- [ ] incendio/problema espacial puede generar badge en mundo;
- [ ] read/unread no modifica simulación.

### 22.5 Ayuda

- [ ] métricas no triviales tienen tooltip;
- [ ] paneles complejos tienen ayuda contextual;
- [ ] acciones disabled explican causa;
- [ ] ayuda se mantiene desde una fuente central.

### 22.6 Lenguaje

- [ ] cero `tick` visibles;
- [ ] cero IDs internos visibles en flujo normal;
- [ ] estados técnicos traducidos;
- [ ] fechas y duraciones expresadas en tiempo de juego;
- [ ] debug técnico sólo en modo de desarrollo explícito.

### 22.7 Onboarding

- [ ] un jugador nuevo recibe una siguiente acción clara;
- [ ] el bloque permanente `Cómo jugar esta prueba` deja de ser la solución principal;
- [ ] onboarding no crea reglas autoritativas nuevas;
- [ ] finance/government aparecen contextualizados, no todos al minuto cero.

### 22.8 Accesibilidad/resolución

- [ ] 1280×720 usable;
- [ ] 1440×900 usable;
- [ ] 1920×1080 usable;
- [ ] ultrawide usable;
- [ ] navegación/focus razonables;
- [ ] no hay información crítica sólo por color.

---

## 23. Tests obligatorios

### Unit/component

- mapping de `BuildingType` → thumbnail;
- catálogo 15/15;
- mapping de recursos → iconos;
- player-facing labels no devuelven IDs internos;
- formatters de tiempo no contienen la palabra `tick`;
- targets de notificación resuelven entidad/hub;
- disabled reason renderiza explicación;
- ayuda catalogada resuelve claves usadas;
- icon buttons tienen accessible name.

### Browser

Crear o ampliar smoke dedicado, recomendado:

`pnpm smoke:vd-ux`

Flujo mínimo:

1. carga partida;
2. HUD visible;
3. selecciona parcela;
4. compra;
5. abre construir;
6. verifica thumbnails;
7. selecciona edificio;
8. inicia obra;
9. asigna crew;
10. abre notificaciones;
11. navega a target;
12. abre Gobierno;
13. abre Finanzas;
14. consulta ayuda;
15. cambia overlay;
16. valida que no hay `tick`/IDs visibles;
17. valida cero page errors.

El smoke no sustituye el playtest humano.

---

## 24. QA visual y evidencia

Capturas obligatorias, al menos:

1. estado normal sin panel;
2. parcela seleccionada;
3. catálogo de construcción con varias tarjetas;
4. detalle de cementera;
5. edificio residencial seleccionado;
6. obra con progreso;
7. Ayuntamiento/Gobierno;
8. Finanzas;
9. centro de notificaciones;
10. ayuda contextual;
11. overlay de servicios;
12. resolución 1280×720;
13. resolución 1920×1080.

Las capturas deben demostrar jerarquía y densidad, no sólo que el DOM existe.

---

## 25. Performance

V.d-UX no debe cambiar la simulación.

Presupuestos:

- no empeorar `system:cost` por lógica UI;
- evitar reconstrucciones completas del scene por hover;
- thumbnails reutilizan assets existentes;
- iconos SVG pequeños;
- world indicators con pooling/reuse si Phaser los mantiene;
- no crear cientos de nodos DOM invisibles para todos los edificios;
- notificaciones derivadas no deben recalcular Dijkstra ni reglas económicas.

Si el UI shell aumenta significativamente el bundle, registrar tamaño before/after.

---

## 26. No objetivos

Fuera de V.d-UX:

- arte final de todos los edificios;
- orientación física lateral de edificios;
- ciclo día/noche;
- mobile completo;
- nueva simulación de tráfico;
- nuevo sistema de tutorial/misiones autoritativas;
- nuevo banco físico;
- perspectiva política jugable;
- perspectiva criminal jugable completa;
- reequilibrar economía;
- solucionar `delegated_deferred`;
- optimizar el cold graph hitch salvo que la UI revele un bloqueo grave;
- rehacer Phaser o React.

---

## 27. Definition of Done

V.d-UX puede considerarse técnicamente terminada sólo si:

1. todos los acceptance criteria están verdes;
2. tests unitarios y browser pasan;
3. lint/typecheck/format/build pasan;
4. `smoke:alpha` y `smoke:vd-core-loop` siguen verdes;
5. no hay regresión de simulación;
6. existe evidencia visual en las resoluciones definidas;
7. no quedan P0/P1 de UX conocidos;
8. el playtest humano sigue pendiente explícitamente hasta que una persona lo realice.

El estado automático correcto al finalizar es:

`PASS WITH MANUAL PLAYTEST GATE`

No declarar `V.d CLOSED` desde un agente.

---

## 28. Playtest humano posterior

Después de V.d-UX se ejecutará una sesión humana de 45–60 minutos.

El playtest debe observar como mínimo:

- tiempo hasta entender la primera acción;
- tiempo hasta comprar primera parcela;
- tiempo hasta iniciar primera obra;
- errores de navegación;
- conceptos que requieren ayuda;
- frecuencia de apertura/cierre de paneles;
- comprensión de iconos;
- comprensión de materiales;
- comprensión de Gobierno/Finanzas;
- capacidad de responder a una notificación;
- capacidad de encontrar un edificio problemático;
- apariciones de vocabulario técnico;
- percepción de densidad visual;
- percepción del tamaño útil del mapa;
- fricciones que obligan a consultar documentación externa.

Si aparecen P0/P1, corregir antes de cerrar V.d.

---

## 29. Regla final para futuras features

> Toda feature futura debe declarar dónde vive en la experiencia del jugador antes de implementarse.

Para cada nueva mecánica se debe responder:

1. ¿aparece en una entidad física?;
2. ¿pertenece a un hub global?;
3. ¿genera notificación?;
4. ¿necesita world indicator?;
5. ¿qué icono/thumbnail la representa?;
6. ¿qué ayuda contextual necesita?;
7. ¿qué información es resumen y cuál detalle?;
8. ¿cómo se expresa sin términos internos?;
9. ¿cómo se prueba en navegador?;
10. ¿cómo se evita aumentar innecesariamente la carga cognitiva?

Esta regla evita volver a convertir la interfaz en un inspector monolítico a medida que crezcan los sistemas.