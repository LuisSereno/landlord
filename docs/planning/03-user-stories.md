# Historias de usuario del prototipo

## US-01 — Partida determinista
Como jugador quiero iniciar una partida con una seed.
- Dado el mismo estado y comandos, cuando se repite, entonces el resultado coincide.
- Sin seed explícita, se genera y persiste una.
Estimación: 5-8 jornadas.

## US-02 — Navegar mapa
Como jugador quiero mover cámara, zoom y seleccionar.
- La cámara respeta límites.
- La selección muestra ficha.
- El picking respeta profundidad isométrica.
Estimación: 8-12 jornadas.

## US-03 — Comprar parcela
- Parcela libre + saldo: cambia ownership y caja.
- Parcela rival: rechazo.
- Saldo insuficiente: no cambia estado.
Estimación: 5-8 jornadas.

## US-04 — Construir
- Parcela propia + recursos + worker: crea obra.
- Trabajo completo: crea edificio.
- Estado inválido: devuelve motivo.
- Cancelación: aplica política de reembolso.
Estimación: 18-25 jornadas.

## US-05 — Producir materiales
- Fábrica operativa produce por ciclos.
- Almacén lleno detiene incremento.
- Inoperativa no produce.
- Pausa/velocidad conservan coherencia.
Estimación: 12-18 jornadas.

## US-06 — Tenant y renta
- Tenant compatible ocupa.
- Vencimiento genera ingreso.
- Insatisfacción puede provocar salida.
- Incompatibilidad se informa.
Estimación: 14-20 jornadas.

## US-07 — Upgrade
- Requisitos completos inician mejora.
- Requisito faltante se identifica.
- Finalización cambia stats.
- Save conserva progreso.
Estimación: 8-12 jornadas.

## US-08 — IA rival
- Evalúa oportunidades con capital.
- Elige acciones válidas.
- Ajusta memoria/riesgo tras fracasos.
- No crea dinero ilegal.
Estimación: 20-30 jornadas.

## US-09 — Acción ilegal
- Calcula coste, duración y riesgo.
- Detección aumenta heat.
- Heat alto aumenta consecuencias.
- Acción legal no genera heat.
Estimación: 12-18 jornadas.

## US-10 — Política
- Propuesta muestra efectos.
- Lobby altera predisposición dentro de límites.
- Influencia no garantiza apoyo.
- Policy aprobada aplica modifiers.
- Derogación/expiración los retira.
Estimación: 14-22 jornadas.

## US-11 — Save/load
- Persiste economía, política, territorio y RNG.
- Recupera tick/estado.
- Migra esquemas compatibles.
- Save corrupto no destruye última copia válida.
Estimación: 10-15 jornadas.

## US-12 — Rendimiento
- Benchmark de 500 agentes simplificados.
- Ticks lentos quedan instrumentados.
- Soak de dos horas sin crecimiento injustificado.
- Suite determinista en CI.
Estimación: 16-24 jornadas.

## Total
Desarrollo directo: 142-212 jornadas.
Con integración, arte provisional, UX y QA: 200-280 jornadas.
