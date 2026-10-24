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

El prototipo de Gate 2 conserva un ciclo material sencillo:
- cemento;
- ladrillo;
- acero.

La activación abstracta mediante `InvestInProduction` es una simplificación de Gate 2 para validar la decisión mercado frente a producción propia. No representa el modelo objetivo del producto y no debe consolidarse como una instalación invisible permanente.

### Modelo objetivo de producción física

A partir del Vertical Slice, la producción propia debe materializarse mediante edificios productivos normales construidos sobre parcelas:

```text
comprar parcela
-> construir instalación productiva
-> completar obra con crews
-> instalación operativa
-> producción automática y lenta
-> inventario
-> consumo en obras
```

Estos edificios comparten las reglas del resto de activos: ownership, zoning, coste de construcción, condition, structuralIntegrity, mantenimiento, incendio, reparación, sabotaje, valor, fiscalidad y seguros cuando esos sistemas existan.

El mercado de materiales permanece como alternativa paralela. Comprar debe ofrecer disponibilidad inmediata sin ocupar suelo ni inmovilizar capital industrial; producir internamente debe ofrecer una ventaja de coste o autonomía a cambio de parcela, inversión, tiempo, costes operativos y riesgo.

### Aptitud productiva de la parcela

La ubicación debe modificar la productividad. La parcela podrá exponer potenciales o suitability enteros por familia de recurso, por ejemplo:

```text
cementPotential
brickPotential
steelPotential
```

Los nombres definitivos y el modelo físico se decidirán con los datos del Vertical Slice. No todas las instalaciones deben depender de los mismos factores: una instalación de materiales cerámicos puede valorar suelo/arcilla; una industria pesada, logística, infraestructura o energía.

La tasa efectiva debe ser data-driven y determinista, evitando floats autoritativos:

```text
effectiveOutput =
  baseOutput
  * parcelSuitability
  * conditionModifier
  * upgradeModifier
  * policyModifier
```

Los porcentajes se implementarán mediante enteros/fixed-point cuando llegue esta fase.

### Inversión y upgrades

El botón genérico `Invertir` de Gate 2 desaparecerá del flujo normal cuando existan fábricas físicas. La inversión pasa a significar ampliar o mejorar un activo productivo existente: capacidad, eficiencia, almacenamiento, seguridad o control ambiental.

No se introducen todavía minas, canteras, energía, materias primas intermedias ni cadenas industriales complejas. El objetivo es conectar suelo, construcción, producción, mercado y riesgo, no crear un juego fabril independiente.

En el producto final los nombres, edificios, números y cadenas serán propios de Landlord.

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

**Estado de implementación (WP4.9, D-072):** el mercado ya no publica las cifras privadas del rival. El
jugador puede pagar 150 u. por una estimación con error declarado (caja, deuda viva, impuestos adeudados
o puja prevista) que envejece, y el canal gratuito del mercado sólo re-basa lo que llevaba tres meses sin
refrescarse. No hay todavía oportunidades reales de arbitraje: el registro de accesos no genera ni filtra
por sí solo las ofertas del mundo.

**Actualización (WP4.10, D-073):** la nota de arriba se quedó corta porque el rival apenas pedía préstamo ni
pujaba. Con perfiles de facción y memoria, una campaña larga sí le abre crédito con el banco y sí le presenta
a una licitación —en la seed 4 a doce meses la expansionista firma `request_financing` y
`bid_public_contract:contract_00000004`—, así que `deuda viva` y `puja prevista` pasan a valer algo en
partidas largas y su estimación deja de ser un cero. La cifra de `impuestos adeudados` sigue necesitando que
el rival no pague, y ninguna de las tres aparece en los doce meses de un smoke corto.
