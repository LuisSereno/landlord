# Política y sociedad

## Alcance

La política se diseña inicialmente en escala municipal porque afecta directamente a inmobiliario, licencias, seguridad, impuestos y urbanismo. No se pretende convertir Landlord en un simulador parlamentario nacional.

## Instituciones

Modelo conceptual:
- Alcaldía.
- Ayuntamiento/Concejo.
- Urbanismo.
- Hacienda.
- Vivienda.
- Seguridad.
- Obras públicas.
- Policía.
- Justicia en una fase posterior.
- Sindicatos.
- Asociaciones vecinales.
- Grupos empresariales.
- Medios.

**Estado de implementación (WP4.11, D-074):** del modelo conceptual está implementado el Ayuntamiento/Concejo como
institución electa con calendario propio —nueve escaños, legislatura de seis meses, debate dos meses después de la
elección— y con una capacidad legislativa real: aprueba su propia ordenanza por sorteo modulado por su
alineamiento, y el partido que gobierna decide el **orden de recorte** del presupuesto municipal (D-068). Alcaldía,
urbanismo, hacienda, policía y justicia siguen siendo un solo actor en el motor (`MUNICIPALITY_ORGANIZATION_ID`)
sin órganos separados; sindicatos, asociaciones vecinales, grupos empresariales y medios no tienen estado.

## Políticas

Ejemplos:
- impuesto inmobiliario;
- control de alquileres;
- salario mínimo;
- zonificación;
- licencias de alcohol;
- regulación del juego;
- vivienda pública;
- presupuesto policial;
- transporte;
- infraestructuras;
- protección patrimonial;
- límites de altura;
- subvenciones.

Cada política debe expresar efectos mediante modificadores consumibles por otros sistemas.

**Estado de implementación (WP4.11, D-074):** ya se cumple —las cuatro ordenanzas del catálogo se consumen por
renta, coste de materiales, impuestos, transmisiones y licencias, y la tabla `ORDINANCE_AXES` conecta esos mismos
modificadores con la opinión sin campos nuevos. El catálogo añade *Tope de renta del Umbral*, que es el "control de
alquileres" de la lista; zonificación, salario mínimo, licencias de alcohol, vivienda pública y límites de altura
siguen sin datos.

## Influencia

La influencia política no debe equivaler a "pagar y conseguir la ley". Puede obtenerse mediante:
- reputación;
- empleo generado;
- financiación;
- relaciones;
- lobby;
- participación en proyectos urbanos;
- control de medios;
- favores;
- corrupción ilegal.

Cada político pondera esos factores de manera distinta.

**Estado de implementación (WP4.11, D-074):** la regla de "pagar y conseguir la ley" ya no es cierta. El
cabildeo conserva su precio en influencia y su sorteo, pero el concejo gobernante modula la probabilidad ±25
puntos según lo mucho que la ley encaje con su plataforma —la misma ordenanza con la misma inversión sale al
65 % con un concejo afín, al 48 % con uno hostil— y la influencia que reparte el gobierno sigue viniendo de la
reputación (D-071). Lo que todavía no existe es la ponderación distinta por político: alinea el partido, no la
persona.

## Políticos

Atributos posibles:
- prioridades políticas;
- ambición;
- integridad;
- aversión al riesgo;
- popularidad;
- relaciones;
- dependencia de grupos;
- agenda.

No es necesario representar ideologías reales ni partidos reales.

## Elecciones

**Estado de implementación (WP4.11, D-074):** implementado en Alpha, no como fase posterior. Las preferencias se
forman exactamente por la lista de abajo —alquiler, empleo, seguridad, servicios e impuestos— medida cada mes sobre
el estado real del distrito, con saliencia distinta por segmento (al hogar le duele la renta, al artesano el
trabajo, al comerciante la mezcla de licencias y tasas). Votan los hogares del censo de viviendas, la participación
sube con la queja y los escaños se reparten por resto mayor. Los partidos son ficticios y son datos:
*Concentración del Suelo Común*, *Liga del Trabajo Local* y *Unión de Cuentas Claras*, con cinco posiciones, un
orden de gasto y una ordenanza preferida. **Ingresos** entra como eje propio (empleo), no como renta del hogar:
`tenant.budget` es un presupuesto de renta, no un sueldo. La frase "el sistema no debe garantizar control político"
es ahora una prueba: con 0 y con 50 de influencia el resultado electoral es idéntico. No hay candidatos con
atributos, ni campaña, ni sondeos, ni perspectiva ciudadana jugable.

Los partidos serán ficticios. Los ciudadanos pueden formar preferencias a partir de su situación:
- alquiler;
- ingresos;
- empleo;
- seguridad;
- servicios;
- impuestos;
- vivienda.

El jugador afecta indirectamente a resultados al transformar barrios, pero el sistema no debe garantizar control político.

## Urbanismo

La política urbana es un componente central:
- recalificación;
- densidad;
- usos;
- expropiación;
- infraestructuras;
- transporte;
- conservación.

Una decisión urbanística puede multiplicar o destruir el valor de una inversión.

## Información privilegiada

El jugador puede anticipar legalmente cambios urbanos mediante análisis o acceder ilegalmente a información confidencial. El beneficio económico puede ser similar, pero la segunda ruta genera riesgo legal y político.

## Medios

En fases futuras:
- periódicos;
- campañas;
- investigaciones;
- publicidad;
- escándalos;
- reputación.

La información difundida por medios puede modificar opinión pública, presión policial y valoración de actores.

## Protestas y asociaciones

Los grupos ciudadanos pueden surgir cuando se combinan condiciones como alquiler alto, desempleo, corrupción o degradación. Pueden:
- protestar;
- presionar;
- recurrir proyectos;
- convocar huelgas;
- apoyar propuestas.

## Feedback loops

Economía -> sociedad -> política -> regulación -> economía.

Crimen -> policía -> política -> crimen.

Urbanismo -> suelo -> población -> elecciones -> urbanismo.

Estos bucles son una fuente principal de longevidad.
