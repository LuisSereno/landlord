# Economía e inmobiliario

## Núcleo económico

Cada activo debe tener:
- coste de adquisición;
- coste de construcción o reforma;
- mantenimiento;
- impuestos;
- capacidad;
- ingresos potenciales;
- ocupación;
- riesgo;
- valor de mercado;
- deuda asociada;
- efectos de localización.

## Valor del suelo

Modelo conceptual:

valor = valor_base
      * demanda
      * accesibilidad
      * seguridad
      * servicios
      * empleo
      * reputación
      * densidad
      * regulación
      * contaminación
      * expectativas

No todos los modificadores deben aplicarse de forma multiplicativa en implementación; es una guía de diseño.

## Gentrificación y regeneración

Un jugador puede adquirir una zona barata, mejorarla y elevar su valor. Esa mejora también puede:
- subir alquileres;
- atraer hogares con mayores ingresos;
- desplazar población;
- cambiar comercios;
- alterar la política local;
- aumentar oposición social.

## Deuda

Instrumentos previstos:
- hipoteca;
- préstamo empresarial;
- crédito puente;
- refinanciación;
- bonos o financiación avanzada en fases posteriores.

Variables:
- principal;
- interés;
- plazo;
- garantía;
- covenant;
- riesgo de ejecución.

La deuda debe acelerar crecimiento pero crear vulnerabilidad a tipos de interés y caídas de ingresos.

## Liquidez

Un jugador solvente en patrimonio puede quebrar por falta de caja. El motor debe separar:
- valor patrimonial;
- flujo de caja;
- liquidez disponible;
- deuda;
- capacidad de endeudamiento.

## Tenants/hogares

Los ocupantes no son simples contadores. En fases avanzadas pueden tener:
- ingresos;
- tamaño de hogar;
- profesión;
- sensibilidad al precio;
- preferencias de barrio;
- satisfacción;
- relaciones;
- historial residencial.

No debe simularse más detalle individual del necesario para generar decisiones jugables.

## Empresas y comercios

Los negocios pueden depender de:
- visitantes;
- renta;
- población cercana;
- competencia;
- criminalidad;
- regulación;
- horarios;
- suministros;
- personal.

## Producción

El prototipo conserva un ciclo material sencillo inspirado en el tipo de sistema documentado históricamente:
- cemento;
- ladrillo;
- acero.

En el producto final los nombres, edificios, números y cadenas serán propios.

## Mercado

El mercado debe producir:
- ventas;
- subastas;
- alquileres;
- vacantes;
- ejecuciones;
- ofertas de compra;
- oportunidades por información imperfecta.

El jugador no debe conocer siempre el valor futuro real.
