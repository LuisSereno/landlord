# Architecture Decision Records

Los ADR de este directorio amplían las entradas condensadas de `ai-context/DECISIONS.md`.

Estados posibles: `Propuesta`, `Aceptada`, `Sustituida` y `Rechazada`.

Una decisión aceptada sólo se modifica mediante un ADR posterior que la sustituya. El código y los tests demostrarán su implementación cuando comience Gate 1; estos documentos no implican que ya exista código.

## Decisiones

- [D-046 — Toolchain de Gate 1](D-046-toolchain-gate-1.md)
- [D-047 — Paquetes y dependencias iniciales](D-047-paquetes-gate-1.md)
- [D-048 — PRNG determinista](D-048-prng-determinista.md)
- [D-049 — Schemas y modelo de entidades](D-049-schemas-y-entidades.md)
- [D-050 — Phaser para el spike](D-050-phaser-gate-1.md)
- [D-051 — Contratos, protocolo y snapshot](D-051-contratos-gate-1.md)
- [D-052 — Benchmark y umbrales](D-052-benchmark-gate-1.md)

- [D-053 — Blender 5.2.2 LTS para toolchain artístico](D-053-blender-5-2-2-lts.md)
- [D-054 — Bootstrap artístico self-contained](D-054-bootstrap-artistico-self-contained.md)
- [D-055 — Eventos efímeros y registros persistentes derivados](D-055-eventos-efimeros-y-registros-persistentes.md)
- [D-056 — Baseline económico de Gate 2](D-056-baseline-economico-gate-2.md)
- [D-057 — Diagnóstico efímero de Gate 2](D-057-diagnostico-efimero-gate-2.md)
- [D-058 — Base de presentación antes del spike](D-058-base-presentacion-antes-spike.md)
- [D-059 — Cierre funcional del baseline de Gate 2](D-059-cierre-funcional-baseline-gate-2.md)
- [D-060 — Coherencia económica y temporal de Gate 2](D-060-coherencia-economica-gate-2.md)
- [D-061 — Spike de agentes, daño e incidentes](D-061-spike-agentes-dano-incidentes-gate-2.md)
- [D-062 — Producción física localizada](D-062-produccion-fisica-localizada.md)
- [D-063 — Excepción al criterio de entrada de Alpha](D-063-excepcion-criterio-entrada-alpha.md)
- [D-064 — Generación procedural de distritos con anclas autoradas](D-064-generacion-procedural-de-distritos.md)
- [D-065 — Coste del tick medido por sistema; LOD espacial documentado pero latente](D-065-coste-del-tick-y-lod-latente.md)
- [D-066 — Mercado de vivienda segmentado con precio descubierto por vacancia](D-066-mercado-de-vivienda-segmentado.md)
- [D-067 — Mercado laboral agregado, salario y capacidad de alquiler](D-067-empleo-agregado-y-capacidad-de-alquiler.md)
- [D-068 — Presupuesto municipal con caja real, prioridad de gasto y niveles de servicio](D-068-presupuesto-municipal.md)
- [D-069 — Servicios urbanos con cobertura radial y tasa por unidad ocupada](D-069-servicios-urbanos-y-cobertura.md)
- [D-070 — Contratos públicos con licitación, fianza y ejecución](D-070-contratos-publicos.md)
- [D-071 — Reputación multidimensional con tres grupos y memoria de hechos](D-071-reputacion-multidimensional.md)
- [D-072 — Información imperfecta: registro de accesos y expediente de estimaciones](D-072-informacion-imperfecta.md)
- [D-073 — IA estratégica: perfiles de facción, postura por encuentro y memoria antirrepetición](D-073-ia-estrategica-y-facciones.md)
- [D-074 — Política y elecciones municipales: opinión por eje, partido gobernante y transferencia del presupuesto](D-074-politica-y-elecciones-municipales.md)
- [D-075 — Hardening transversal de los sistemas Alpha](D-075-hardening-alpha-sistemica.md)
- [D-076 — Follow-up de corrección del hardening Alpha](D-076-follow-up-hardening-alpha.md)
- [D-077 — Macroeventos económicos acotados](D-077-macroeventos-acotados.md)
- [D-078 — Delegación con los mismos comandos y bandeja de excepciones](D-078-delegacion-y-excepciones.md)
- [D-079 — Herramientas internas, invariantes y dataset de balance](D-079-herramientas-internas-y-balance.md)
- [D-080 — Contrato runtime de assets y factoría procedural](D-080-contrato-assets-y-factoria.md)
- [D-081 — Presupuesto de binarios, atlas y Git LFS reclasificados a Beta](D-081-binarios-atlas-lfs-y-regresion-visual.md)
- [D-082 — Cámara isométrica autoritativa y Art Lab como Asset QA](D-082-camara-picking-y-art-lab-qa.md)
- [D-083 — Licencias de terceros, procedencia por asset y escala física](D-083-licencias-permisivas-procedencia-por-asset-y-escala.md)

**Deuda documental**: D-084, D-085 y D-086 existen como entrada condensada en
`ai-context/DECISIONS.md` pero **no tienen ADR propio**, y D-084/D-085 son cambios de contrato
(promoción del renderer Graphic Civic a gameplay y topología vial autoritativa). Escritos el
2026-10-28 al preparar la Fase 0 de V.d; se rellenan con su propia evidencia, no de rebote.

## V.d — Ciudad multidistrito (propuestas del 2026-10-28, pendientes de ratificación)

- [D-087 — Evidencia de sesión de Alpha y excepción residual de D-063](D-087-evidencia-sesion-alpha-vd.md)
- [D-088 — Ciudad 3×3 de nueve distritos y escala física permanente](D-088-ciudad-multiples-distritos-3x3.md)
- [D-089 — SnapshotV2, protocolo v2 y rechazo de guardados v1](D-089-snapshot-v2-protocolo-v2.md)
- [D-090 — Tejido urbano, manzanas y parcela multi-cell](D-090-tejido-urbano-y-parcela-multicell.md)
- [D-091 — Mercados híbridos por distrito](D-091-mercados-hibridos-por-distrito.md)
- [D-092 — Equipamientos municipales y servicios espaciales](D-092-equipamientos-y-servicios-espaciales.md)

## V.d-H1 — Hardening de integridad urbana (2026-10-29)

- [D-093 — Identidad espacial por distrito, huellas autoritativas y contratos completos](D-093-integridad-urbana-de-vd.md)

Amplía D-088/D-089/D-090/D-092 y D-080 donde su texto aún asumía un solo distrito, un edificio de una
celda o un permiso sin identidad. No sustituye ninguna de esas decisiones.

## V.d-H2 — Cierre de presentación y servicios municipales (2026-10-30)

- [D-095 — Interfaz jugable, paneles contextuales y vocabulario visual](D-095-interfaz-jugable-y-vocabulario-visual.md)
- [D-094 — Semántica de demanda urbana y asignación capacity-aware](D-094-demanda-urbana-y-asignacion-capacity-aware.md) — enmendado en V.d-H2.1 (§2 métricas del informe, §5 suelo vacante, §3 evidencia de cohortes)

Amplía D-092 y D-093: la demanda activa es el desarrollo urbano, no el censo catastral; la asignación
pasa a greedy capacity-aware; la capacidad se calibra por servicio; la respuesta al presupuesto
modula unidades, no cohortes enteras; la proyección publica la huella física real; el bundle
procedural cubre los 15 tipos de dominio; la orientación de dominio se separa explícitamente del
azimut de cámara. D-093 §7 se aclara (H2-11): `civicAmenities` geométrica y `services` operativa
son canales ortogonales, no una suma paralela.
