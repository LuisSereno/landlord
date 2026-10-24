# Fiscalidad, operación urbana y economía pública

## Objetivo

Esta capa amplía Landlord desde la mera propiedad de activos hacia la gestión realista de una organización económica urbana.

La regla de diseño es estricta:

> Un sistema nuevo debe crear una decisión relevante; no una tarea administrativa repetitiva.

Por tanto, impuestos, licencias, seguros, mantenimiento, nóminas o tasas se liquidan automáticamente salvo que exista una decisión estratégica asociada.

---

## 1. Fiscalidad y tasas

### Tipos previstos

- impuesto inmobiliario / property tax;
- impuesto sobre beneficios;
- tasas de construcción;
- licencia de actividad;
- tasa por cambio de uso;
- impuestos o tasas por compraventa;
- costes laborales asociados a empleados;
- tasas sectoriales;
- sanciones y multas;
- tasas de residuos o servicios urbanos;
- incentivos, bonificaciones y deducciones.

### Principio

Los impuestos no deben ser un simple drenaje periódico.

Deben afectar a:
- rentabilidad;
- precio del suelo;
- decisión de compra;
- localización;
- estructura financiera;
- estrategia política;
- atractivo de determinados sectores.

Ejemplo conceptual:

Ingresos alquileres        12.000
Mantenimiento              -1.600
Impuesto inmobiliario      -1.200
Seguro                       -350
Servicios                    -500
Intereses hipoteca         -2.400
Cash flow                    5.950

### Fiscalidad dinámica

Una modificación de impuestos puede alterar mercado y estrategia:

subida de property tax
-> menor rentabilidad
-> algunos propietarios venden
-> aumenta oferta
-> determinados precios bajan
-> aparecen oportunidades de compra.

La fiscalidad debe formar parte del motor económico y político.

---

## 2. Presupuesto municipal

El Ayuntamiento debe tener ingresos y gastos reales dentro de la simulación.

### Ingresos posibles

- impuestos inmobiliarios;
- impuestos empresariales;
- licencias;
- multas;
- tasas;
- transferencias;
- deuda municipal en fases posteriores.

### Gastos posibles

- policía;
- transporte;
- limpieza;
- vivienda;
- infraestructuras;
- parques;
- administración;
- servicios sociales;
- otros servicios urbanos.

Esto crea feedback:

impuestos
-> presupuesto
-> servicios
-> calidad urbana
-> actividad económica
-> base fiscal.

No debe existir una política fiscal universalmente óptima.

**Estado de implementación (WP4.11, D-074):** el feedback de arriba ya se cierra por el lado político. De los
gastos posibles están financiados cuatro categorías —administración, seguridad, transporte y limpieza— y el **orden
en que se recortan cuando no hay caja** lo decide ahora el partido que gana las elecciones municipales, no una
constante del motor: con la misma tesorería, la plataforma de obras paga transporte entero y deja administración a
medias, y la de cuentas al revés. Del lado de los ingresos, la opinión de impuestos se mide sobre lo que el
municipio realmente recauda (contribución + transmisiones + tasa de servicios) en relación con la renta que paga el
distrito, así que subir la presión fiscal sobre el barrio tiene un coste electoral aunque nadie vote impuestos.
Impuestos empresariales, licencias, multas, transferencias y deuda municipal siguen sin ingresos propios, y el
resto de categorías de gasto no existe.

---

## 3. Permisos y licencias

El proceso conceptual de desarrollo urbano puede incluir:

compra de parcela
-> uso permitido
-> licencia
-> proyecto
-> construcción
-> inspección
-> apertura.

La interfaz debe automatizar el proceso normal.

El jugador interviene cuando existe conflicto:
- uso incompatible;
- licencia rechazada;
- edificio protegido;
- límites de altura;
- actividad restringida;
- necesidad de recalificación.

Opciones:
- modificar proyecto;
- solicitar cambio urbanístico;
- recurrir;
- esperar;
- vender;
- ejercer influencia política;
- utilizar una vía ilegal si el diseño lo permite.

---

## 4. Zonificación

Tipos orientativos, no definitivos:

- R1 residencial baja densidad;
- R2 residencial alta densidad;
- C comercial;
- I industrial;
- MX mixto;
- H histórico/protegido.

Atributos:
- uso;
- altura;
- densidad;
- ruido;
- contaminación;
- ocupación;
- retranqueos u otras restricciones simplificadas.

Una recalificación puede cambiar radicalmente el valor de un activo.

Ejemplo:
I1 -> R2
puede convertir suelo industrial barato en suelo residencial valioso.

El sistema debe ser comprensible sin exigir conocimientos urbanísticos reales.

---

## 5. Seguros

Coberturas posibles:
- edificio;
- incendio;
- robo;
- responsabilidad;
- actividad empresarial.

Decisión:
prima alta -> menor riesgo financiero.
sin seguro -> mayor cash flow -> mayor pérdida potencial.

El seguro debe cubrir eventos modelados, no operar como un porcentaje opaco.

Fraude al seguro puede existir como mecánica ilegal futura, con riesgo policial y judicial.

---

## 6. Mantenimiento y deterioro

Todo inmueble puede tener condición.

Ejemplo:
- 100: excelente;
- 75: correcto;
- 50: deteriorado;
- 25: peligroso;
- 0: inhabitable.

La condición puede afectar:
- alquiler;
- valor;
- satisfacción;
- accidentes;
- consumo;
- imagen del barrio;
- inspecciones;
- seguros.

La gestión rutinaria debe automatizarse mediante políticas del jugador, por ejemplo:

"Mantener automáticamente los edificios residenciales por encima de 80".

El jugador interviene ante excepciones, escasez de caja o prioridades.

---

## 7. Inspecciones

Tipos futuros:
- urbanística;
- sanitaria;
- laboral;
- fiscal;
- seguridad;
- incendios.

Posibles consecuencias:
advertencia
-> multa
-> limitación de actividad
-> cierre temporal
-> clausura.

Pueden conectar con:
- mantenimiento;
- licencias;
- reputación;
- corrupción;
- justicia.

---

## 8. Contabilidad empresarial

Landlord no será un ERP.

Debe ofrecer una visión financiera suficientemente rica para tomar decisiones.

### Estados simplificados

- cash;
- assets;
- liabilities;
- equity;
- revenue;
- expenses;
- net cash flow.

### Ratios útiles

- debt/assets;
- occupancy;
- ROI;
- liquidity;
- interest coverage;
- leverage;
- operating margin.

El usuario casual puede operar con indicadores simples; el jugador avanzado puede profundizar.

---

## 9. Bancos y crédito

Los bancos se convierten progresivamente en actores con reglas de riesgo.

Variables:
- patrimonio;
- historial;
- liquidez;
- apalancamiento;
- reputación;
- entorno macroeconómico;
- heat/exposición criminal;
- garantías.

Posibles efectos:
- tipo de interés;
- límite de crédito;
- exigencia de garantías;
- denegación;
- refinanciación.

En crisis:
- se endurece crédito;
- aumentan ventas forzadas;
- aparecen oportunidades para jugadores líquidos.

---

## 10. Ejecuciones y subastas

Ciclo conceptual:

impago
-> mora
-> ejecución
-> subasta
-> transferencia de propiedad.

También pueden producirse por:
- deuda fiscal;
- quiebra;
- resolución judicial;
- liquidación empresarial.

Jugador e IA pueden pujar.

Las subastas son una fuente de oportunidades emergentes.

---

## 11. Insolvencia y bancarrota

No debe equivaler automáticamente a Game Over.

Opciones:
- refinanciación;
- negociación con acreedores;
- venta de activos;
- liquidación parcial;
- reestructuración;
- entrada de capital;
- ejecución.

Debe diferenciarse:
- patrimonio;
- cash;
- deuda;
- liquidez;
- solvencia.

Un grupo con muchos activos puede quebrar por falta de caja.

---

## 12. Inversores y socios

Fase posterior.

Un inversor puede aportar capital a cambio de:
- equity;
- dividendos;
- derechos;
- capacidad de bloquear decisiones;
- objetivos de rentabilidad.

Esto permite separar financiación mediante deuda y mediante capital.

### Estructuras futuras

Holding
- Real Estate Co
- Construction Co
- Services Co
- Entertainment Co
- otras divisiones

No forma parte del MVP.

---

## 13. Contratos públicos

El Ayuntamiento puede licitar:
- vivienda;
- demolición;
- urbanización;
- limpieza;
- mantenimiento;
- infraestructuras;
- servicios.

Las empresas compiten por:
- precio;
- capacidad;
- experiencia;
- reputación;
- relaciones;
- cumplimiento.

La corrupción puede afectar ciertos contratos, pero nunca debe garantizar automáticamente el resultado.

---

## 14. Servicios urbanos

Variables posibles:
- transporte;
- agua;
- energía;
- limpieza;
- seguridad;
- educación;
- salud;
- ocio.

No es obligatorio que el jugador construya directamente todos los servicios.

Los servicios afectan:
- precio del suelo;
- demanda;
- población;
- productividad;
- satisfacción;
- actividad empresarial.

---

## 15. Transporte y accesibilidad

Cada parcela o zona puede disponer de una medida de accesibilidad derivada de:
- red viaria;
- transporte público;
- distancia al empleo;
- congestión;
- servicios.

Afecta a:
- valor;
- demanda residencial;
- visitantes;
- empleo;
- actividad comercial.

Las nuevas infraestructuras pueden crear oportunidades especulativas legítimas.

---

## 16. Oferta y demanda de vivienda

Los tenants no deben ser infinitos.

El mundo debe mantener demanda segmentada:
- niveles de renta;
- tamaño de hogar;
- preferencias;
- localización;
- capacidad de pago.

Una promoción de lujo puede quedar vacía si no existe demanda suficiente.

La ocupación es una variable económica real.

---

## 17. Empleo

Los negocios crean empleos.

El empleo afecta:
- renta disponible;
- demanda de vivienda;
- movimiento poblacional;
- política;
- valor urbano.

Una nueva industria puede:
- generar empleo;
- aumentar vivienda demandada;
- incrementar tráfico;
- introducir contaminación;
- modificar el equilibrio electoral.

---

## 18. Salarios y sindicatos

Fase posterior.

Variables:
- salario;
- cualificación;
- jornada;
- satisfacción;
- seguridad;
- productividad.

Un sindicato puede negociar:
- salarios;
- jornada;
- seguridad;
- estabilidad;
- convenios.

Las huelgas pueden afectar obras y negocios.

La legislación laboral conecta este sistema con política.

---

## 19. Servicios públicos y concesiones

Algunos servicios pueden ser:
- municipales;
- privados;
- concesionados.

Una empresa del jugador puede competir por concesiones.

Esto abre líneas de negocio no puramente inmobiliarias.

---

## 20. Reputación multidimensional

No usar una única barra universal.

Estado implementado (WP4.8, D-071): tres grupos con canal real —residentes, gobierno y banca—. Los
demás siguen pendientes del canal que deba consumirlos (policía sobre riesgo táctico, medios sobre
percepción, sindicatos sobre empleo, criminales sobre acuerdos) y se añadirán con él, no como barra
decorativa.

Ejemplo:

- ciudadanos;
- empresarios;
- gobierno;
- policía;
- bancos;
- sindicatos;
- criminales;
- medios.

Una acción puede mejorar una reputación y empeorar otra.

La reputación afecta:
- crédito;
- contratos;
- política;
- empleo;
- alquiler;
- cooperación;
- crimen.

---

## 21. Justicia

Fase posterior.

Sistemas posibles:
- demandas;
- multas;
- juicios;
- embargos;
- confiscaciones;
- recursos;
- abogados.

Debe conectarse a:
- crimen;
- corrupción;
- contratos;
- fiscalidad;
- propiedad.

---

## 22. Información y espionaje

El jugador no debe disponer de información perfecta.

Fuentes:
- analistas;
- abogados;
- investigadores;
- contactos;
- espionaje.

Información obtenible:
- planes urbanísticos;
- situación financiera rival;
- intención de voto de concejales;
- contratos futuros;
- riesgos;
- actividad criminal.

La información es un recurso estratégico.

---

## 23. Contratos y negociación entre actores

Posibles acuerdos:
- compraventa de propiedades;
- préstamos;
- participaciones;
- alquileres;
- joint ventures;
- treguas;
- protección;
- alianzas.

Esto reduce dependencia del combate como única interacción.

---

## 24. Eventos económicos

No deben ser sólo random.

Pueden estar condicionados por el estado:
- boom inmobiliario;
- crisis bancaria;
- escasez de materiales;
- huelga;
- incendio;
- nueva infraestructura;
- cierre de gran empleador;
- migración;
- burbuja de alquiler;
- recesión.

Su objetivo es modificar qué estrategias son válidas.

---

## 25. Regla de experiencia de usuario

No hacer que el jugador pulse manualmente:

- pagar impuesto;
- pagar nómina;
- pagar seguro;
- pagar electricidad;
- pagar una tasa recurrente.

Esas obligaciones se procesan automáticamente.

Las decisiones son:
- ¿compro este activo con esta carga fiscal?
- ¿acepto esta financiación?
- ¿contrato esta cobertura?
- ¿reubico el negocio?
- ¿presiono por una reforma?
- ¿participo en una licitación?
- ¿vendo antes de una modificación regulatoria?
- ¿mantengo liquidez o maximizo apalancamiento?

---

## 26. Priorización

### Gate 1
No incorporar estos sistemas salvo interfaces mínimas requeridas por arquitectura.

### Gate 2
Mantener el núcleo ya definido. Sólo costes simples necesarios para que la economía sea coherente.

### Vertical slice — prioridad alta
- impuestos/tasas principales;
- mantenimiento;
- seguros;
- deuda bancaria;
- zonificación;
- licencias;
- subastas;
- liquidez;
- estados financieros simplificados.

### Alpha sistémica
- presupuesto municipal;
- empleo;
- servicios urbanos;
- contratos públicos;
- reputación multidimensional;
- información imperfecta;
- oferta/demanda de vivienda más rica;
- eventos macro.

### Posterior
- sindicatos;
- justicia;
- concesiones complejas;
- inversores/equity;
- holdings;
- fraude de seguros;
- evolución histórica extensa.

---

## 27. Feedback loops prioritarios

Fiscalidad
-> rentabilidad
-> oferta de activos
-> precios
-> inversión
-> recaudación.

Presupuesto municipal
-> servicios
-> atractivo urbano
-> valor suelo
-> actividad
-> base fiscal.

Empleo
-> renta
-> vivienda
-> población
-> política
-> regulación.

Crédito
-> inversión
-> precios
-> deuda
-> riesgo
-> ejecuciones
-> oportunidades.

Mantenimiento
-> calidad
-> renta
-> satisfacción
-> valor
-> fiscalidad.

La profundidad de Landlord debe surgir de estas interdependencias, no de multiplicar pantallas administrativas.
