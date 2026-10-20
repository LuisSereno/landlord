# IA y simulación emergente

## Principio

La inteligencia aparente debe nacer principalmente de:
- objetivos;
- información;
- memoria;
- utilidad;
- planificación;
- relaciones;
- restricciones económicas;
- reacción a resultados.

No de un LLM controlando cada personaje.

## Capas de IA

### Movimiento
Pathfinding y navegación.

### Acción inmediata
Máquinas de estados o behavior trees.

### Elección
Utility AI que puntúa acciones según contexto.

### Planificación
GOAP, HTN o un planificador propio para secuencias de objetivos.

### Estrategia
Planner de facción que decide expansión, liquidez, conflicto, alianzas e inversión.

### Director
Sistema global opcional para ritmo y generación de oportunidades, sin hacer trampas invisibles.

### Narrativa generativa
LLM opcional para noticias, rumores, textos y variaciones narrativas. Nunca es autoridad del estado.

## Memoria

Una facción debe registrar al menos:
- acciones recientes;
- pérdidas;
- agresiones;
- acuerdos;
- deudas;
- reputación del otro actor;
- intentos fallidos relevantes.

Esto evita repetir ataques inútiles indefinidamente, problema documentado en la recepción histórica de Street Wars.

## Personalidad

Ejemplo de parámetros:
- agresividad;
- aversión al riesgo;
- preferencia por liquidez;
- preferencia por crimen;
- ambición territorial;
- tendencia a negociar;
- memoria de agravios.

## Dificultad

Preferencia:
- mejor información limitada;
- mejores heurísticas;
- mejor planificación;
- personalidad distinta.

Evitar basar la dificultad únicamente en bonificaciones económicas ocultas.

## Simulación masiva

Al desacoplar simulación y gráficos, el motor puede ejecutar miles de partidas sin render. Usos:
- balance;
- detectar estrategias dominantes;
- medir quiebras;
- probar parámetros;
- regresión;
- comparar versiones de IA.

## IA generativa

Permitida para:
- noticias;
- cartas;
- rumores;
- contratos narrativos;
- nombres;
- ambientación.

Debe devolver estructuras validadas y no ejecutar acciones arbitrarias.
