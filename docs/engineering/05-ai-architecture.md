# Arquitectura de IA

## Componentes

### Navigation
Pathfinding y ocupación.

### State/Behavior
Máquinas de estados o behavior trees para rutinas tácticas.

### Utility
Puntúa acciones disponibles según contexto.

### Planner
Genera secuencias para objetivos complejos.

### Faction Brain
Decide inversión, expansión, deuda, negociación, crimen y conflicto.

### Memory
Registra resultados y relaciones.

## Ejemplo de evaluación

Una promotora rival evalúa:
- liquidez;
- retorno esperado;
- riesgo;
- sinergia territorial;
- exposición de deuda;
- probabilidad de intervención rival;
- política vigente.

No compra simplemente porque existe una parcela.

## Antirrepetición

Cada acción fallida relevante modifica:
- coste percibido;
- confianza;
- memoria;
- cooldown;
- evaluación de riesgo.

Esto evita bucles suicidas.

## Información imperfecta

La IA no debe leer automáticamente todo el estado del jugador. Puede tener:
- información pública;
- inteligencia parcial;
- rumores;
- conocimiento adquirido.

## Tests

- escenarios fijos;
- seeds conocidas;
- invariantes económicos;
- no generar dinero de la nada salvo reglas explícitas;
- evitar ciclos de decisión;
- test de recuperación tras pérdidas.

## LLM

No usar para pathfinding, economía o decisiones de estado.

Puede generar texto condicionado a un JSON de contexto. La salida se valida antes de presentarse.
