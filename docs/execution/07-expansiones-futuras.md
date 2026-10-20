# Fases futuras — Perspectivas transitables y simulación vital

## Estado

No comprometidas. Este documento define puertas de decisión y orden seguro; no constituye un backlog autorizado para Gate 1, Gate 2, vertical slice, alpha o lanzamiento base.

## Requisitos para considerar una expansión

- Producto base lanzado o validado con evidencia suficiente.
- Core económico, político y social estable.
- Demanda de jugadores observada, no sólo interés interno.
- Presupuesto, equipo y ventana de compatibilidad de saves aprobados.
- Auditoría de cómo la expansión afecta complejidad, UI y micromanagement.
- Capacidad de mantener una única causalidad mundial.

## Fase 7 — Roles y perspectivas transitables

### Tramo 7.0 — Infraestructura mínima común

- Formalizar `RoleAssignment` sólo con casos reales.
- Implementar resolución de capabilities desde roles, cargos, ownership y delegación.
- Formalizar `ControlContext`: persona, rol, organización, capabilities, information scope y view profile.
- Separar capability (“puede hacer”) de información (“puede saber”).
- Registrar career history y eventos relevantes.
- Asegurar que cambiar perspectiva no cambia ownership ni duplica mundo.
- Implementar delegación para capas no activas y escalado de excepciones.
- Migrar saves y probar transiciones bidireccionales.

**Gate 7.0:** una misma `Person` puede cambiar control entre dos contextos autorizados sin corromper economía, información o automatización.

### Tramo 7.1 — Politician / Mayor

Primera extensión recomendada por reutilización de sistemas.

- Profundizar gobierno, presupuesto, servicios, policies y elecciones.
- Añadir cargos, mandato, capabilities y límites institucionales.
- Delegar negocios privados cuando corresponda.
- Modelar conflictos de interés y visibilidad de información.
- Permitir pérdida electoral y retorno al sector privado.
- Probar que la ciudad sigue simulándose bajo cualquier rol.

### Tramo 7.2 — Criminal

- Separar organización criminal, membresía, autoridad y ownership.
- Profundizar heat, evidencia, policía, corrupción y territorio.
- Delegar cartera legal o criminal según contexto.
- Evitar contenido que glorifique daño realista sin necesidad de diseño.
- Permitir salida, legitimación, encarcelamiento u otras transiciones decididas.

### Tramo 7.3 — Bank / Investor

- Añadir cartera de crédito/inversión, riesgo y garantías.
- Definir information scope financiero.
- Evitar acceso omnisciente a prestatarios.
- Conectar ciclos de crédito, ejecuciones y estabilidad urbana.

### Tramo 7.4 — Contractor

- Profundizar capacidad, costes, licitaciones y ejecución de obra.
- Distinguir propiedad del activo de prestación del servicio.
- Conectar reputación, calidad y calendario.

### Tramo 7.5 — Union / Media / Strategic Citizen

Cada perspectiva necesita un gate independiente que demuestre:

- fantasía de jugador diferenciada;
- decisiones recurrentes no cubiertas por otra capa;
- información y capabilities propias;
- coste de UX y simulación sostenible;
- interacción fuerte con el mundo existente.

No se implementan sólo porque las organizaciones ya existan como IA.

## Fase 8 — Life/society simulation

Visión de muy largo plazo y probablemente ampliación de producto de gran escala.

### Orden de investigación

1. Strategic Citizen con vivienda, empleo y relaciones al nivel mínimo.
2. Carrera y educación si producen decisiones no redundantes.
3. Tiempo vital y envejecimiento compatible con escala económica.
4. Familia y relaciones persistentes.
5. Sucesión, herencia y generaciones.

### Preguntas bloqueantes

- ¿Cuál es la escala temporal común entre obra, política y vida humana?
- ¿Qué detalle individual aporta gameplay y qué debe agregarse?
- ¿Cómo se evita que la vida personal eclipse Landlord?
- ¿Cómo se representa continuidad al morir/retirarse una `Person`?
- ¿Qué información se conserva entre generaciones?
- ¿Cómo se mantiene rendimiento y tamaño de save?
- ¿Cómo se presenta sin multiplicar paneles y alertas?

### Gate de investigación

Antes de producción debe existir un prototipo separado que demuestre:

- una trayectoria corta con al menos dos transiciones significativas;
- convivencia con economía urbana existente;
- Gameplay LOD y delegación comprensibles;
- coste de simulación dentro de budget;
- valor de jugador superior a la complejidad añadida.

## Multijugador futuro

Se evalúa de forma ortogonal, nunca como consecuencia automática de roles múltiples.

- Definir modo concreto: PvP 2-4, cooperativo o asíncrono.
- Adoptar servidor autoritativo si se aprueba.
- Revalidar tecnología en la fecha del proyecto.
- Tratar seguridad, sincronización, latencia, griefing y costes como parte del gate.
- Mantener single-player funcional si ése sigue siendo el producto principal.

## LLM futuro

Sólo capa narrativa opcional:

- entrada estructurada y limitada;
- salida schema-validada;
- sin autoridad sobre estado, economía o decisiones de IA;
- fallback determinista/no generativo;
- evaluación de coste, privacidad, moderación y latencia.

## Regla final

Preservar opcionalidad no obliga a implementar generalizaciones. Cada abstracción futura debe llegar cuando dos o más casos reales la necesiten o cuando un spike demuestre que posponerla generaría una reescritura desproporcionada.
