# D-048 — PRNG determinista

Estado: Aceptada  
Fecha: 2026-10-20  
Alcance: Gate 1 y saves posteriores

## Contexto

El estado aleatorio debe continuar exactamente después de guardar/cargar y producir los mismos resultados en Node, Chromium y Firefox. Una dependencia externa añadiría riesgo de cambio de algoritmo o formato.

## Decisión

Implementar internamente `xoshiro128** v1` con expansión de seed mediante `splitmix32`.

- Seed pública: entero unsigned de 32 bits, `0..4294967295`.
- Estado: tupla de cuatro `uint32` y literal `xoshiro128ss-v1`.
- Operaciones: `nextUint32`, `nextInt(minInclusive, maxExclusive)`, `exportState`, `restoreState`.
- `nextInt` usa rejection sampling para evitar sesgo de módulo.
- Gate 1 no expone `nextFloat`.
- La implementación usa operaciones bitwise unsigned y `Math.imul`.
- Se rechazan seeds, rangos o estados fuera de contrato.
- `Math.random`, Web Crypto y tiempo real quedan prohibidos en reglas de dominio.

### Vectores de conformidad

Algoritmo de expansión: sumar `0x9e3779b9`, mezclar con `0x21f0aaad` y `0x735a2d97`, usando operaciones de 32 bits en cada paso.

| Seed | Estado inicial | Primeros diez `nextUint32()` | Estado final |
|---:|---|---|---|
| `0` | `[1684164658,3653269916,2939563536,2141751570]` | `[1789933344,44971166,2521387044,3848737593,1138324114,749234105,1899511038,1995189375,3629653958,19166872]` | `[3935033944,190438867,878468656,2324950187]` |
| `1` | `[1580013426,350525680,3524174333,3011703609]` | `[393288148,2174103013,3814759091,2092745082,1865176206,2179171167,3207394750,2858353069,559075315,3395495274]` | `[3604652282,544282413,1267161376,3034057615]` |
| `4294967295` | `[3950124170,4293442868,1302505678,2762329221]` | `[4104197751,1825856343,1152209388,2427537429,3685145430,609215610,4161674276,1502890106,904255344,859094872]` | `[1209703510,1679837229,4053859004,718193118]` |

## Alternativas descartadas

- `Math.random`: no permite seed ni estado portable.
- PCG32 con BigInt: estado claro, pero añade operaciones de 64 bits innecesarias para el spike.
- Librería externa: puede alterar implementación o serialización entre versiones.
- Float como primitiva pública: anticipa reglas de conversión y precisión no necesarias.

## Consecuencias

- El algoritmo y su versión pasan a formar parte del contrato de save.
- Cambiarlo exige nueva versión, migración o conservación del runner anterior.
- Toda iteración que consume aleatoriedad debe tener orden estable.

## Condición de revisión

Sólo si aparecen defectos demostrados, rendimiento insuficiente o requisitos estadísticos que el algoritmo no satisfaga. La revisión no puede cambiar partidas existentes silenciosamente.
