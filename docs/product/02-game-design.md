# Diseño de juego

## Bucle principal

1. Analizar una oportunidad.
2. Comprar o controlar una parcela.
3. Conseguir materiales y capacidad de trabajo.
4. Construir o adquirir un activo.
5. Ocuparlo con hogares o negocios.
6. Generar ingresos.
7. Mantener, mejorar, refinanciar, vender o reconvertir.
8. Competir por suelo, capital, influencia y territorio.
9. Reaccionar a acontecimientos económicos, criminales, sociales y políticos.
10. Reinvertir.

## Bucles superpuestos

### Micro
Construcción, mantenimiento, producción, alquiler y acciones tácticas ejecutadas por agentes
físicos. Una orden relevante debe poder identificar actor, tarea, destino y efecto; el timer no
es por sí solo la representación final del trabajo.

### Empresa
Cartera de activos, deuda, empleados, liquidez, reputación y automatización.

### Territorial
Control de parcelas, corredores, barrios y distritos.

### Criminal
Extorsión, protección, contrabando, sabotaje, corrupción, blanqueo y presión policial.

### Político
Ordenanzas, licencias, presupuestos, urbanismo, elecciones, lobby e influencia.

### Social
Empleo, vivienda, precios, criminalidad, servicios, asociaciones y opinión pública.

### Macro
Tipos de interés, recesiones, expansión, burbujas, crisis sectoriales y transformación urbana.

## Filosofía de interfaz

Un sistema debe ofrecer tres niveles:
- acción manual;
- reglas de automatización;
- delegación en empleados/gestores.

Si una acción se repite de forma idéntica muchas veces, debe existir una forma de automatizarla.

## Contenido emergente

No depender exclusivamente de misiones. El mundo debe crear objetivos:
- una parcela en subasta;
- un rival endeudado;
- una nueva estación que cambia precios;
- una ordenanza que amenaza un negocio;
- una investigación policial;
- un barrio que se degrada;
- una asociación vecinal que bloquea una promoción;
- un concejal que necesita apoyo;
- una crisis que obliga a refinanciar.

## Simulación táctica de agentes

Landlord necesita una capa acotada entre la economía agregada y la life simulation:

- personas visibles con especialidad, posición, salud y tarea;
- cuadrillas y técnicos que construyen, mantienen y responden a incidentes;
- operativos hostiles capaces de afectar objetivos concretos;
- edificios con condición operativa, integridad y estados de incidente;
- efectos espaciales que alcanzan personas y propiedades cercanas;
- consecuencias económicas, policiales y reputacionales consumidas por otros sistemas.

Esta capa reutiliza `Person`/actor, organizations, ownership y control sin asumir que el jugador
es una empresa. No incluye todavía vida cotidiana, familia, envejecimiento ni perspectivas
jugables alternativas. A escala deberá admitir órdenes de cuadrilla y automatización para no
convertirse en micromanagement lineal.

## Condiciones de derrota

No se plantea una única derrota inmediata. Posibles estados críticos:
- insolvencia;
- pérdida de activos clave;
- condena o confiscación;
- colapso reputacional;
- toma de control por acreedores;
- incapacidad de operar en un distrito.

El diseño debe permitir recuperación cuando sea razonable.

## Victoria

El juego de larga duración no necesita una pantalla definitiva de victoria. Pueden existir objetivos de escenario, logros, hitos y rankings, pero la simulación continúa.
