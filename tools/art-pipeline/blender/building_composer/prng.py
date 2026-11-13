"""PRNG con seed explícita (§13).

`random` del sistema no vale: su secuencia depende de la build de CPython y del estado global, así
que dos corridas del mismo seed podrían producir edificios distintos y §13/§14 serían inverificables.
SplitMix64 es entero puro: idéntico en cualquier Python, dentro o fuera de Blender, y entra en la
firma del compositor como parte del algoritmo declarado en el manifiesto.
"""

MASK64 = (1 << 64) - 1
GOLDEN = 0x9E3779B97F4A7C15


class SealedRandom:
    """Series deterministas derivadas de un entero. Cada eje de variante saca su propio mazo."""

    def __init__(self, seed, label=""):
        # La etiqueta entra en el estado: dos ejes con el mismo seed numérico no reparten igual.
        mixed = (int(seed) & MASK64) ^ (_hash(label) << 1)
        self.state = mixed & MASK64
        self.draws = 0

    def next_uint64(self):
        self.state = (self.state + GOLDEN) & MASK64
        value = self.state
        value = ((value ^ (value >> 30)) * 0xBF58476D1CE4E5B9) & MASK64
        value = ((value ^ (value >> 27)) * 0x94D049BB1331C11B) & MASK64
        value = (value ^ (value >> 31)) & MASK64
        self.draws += 1
        return value

    def below(self, bound):
        """Entero en [0, bound) con rechazo exacto: `%` a secas sesgaría las opciones cortas."""
        if bound <= 0:
            raise ValueError("bound debe ser positivo")
        if bound == 1:
            return 0
        limit = MASK64 - (MASK64 % bound)
        while True:
            draw = self.next_uint64()
            if draw < limit:
                return draw % bound

    def choice(self, options):
        items = list(options)
        if not items:
            raise ValueError("no hay opciones que elegir")
        return items[self.below(len(items))]

    def sampled(self, options, count):
        """`count` elementos sin reposición, en el orden en que salen."""
        pool = list(options)
        picked = []
        for _ in range(min(count, len(pool))):
            picked.append(pool.pop(self.below(len(pool))))
        return picked

    def percent(self):
        return self.below(100)


def _hash(text):
    """FNV-1a de 64 bits sobre la etiqueta: estable entre plataformas, sin `hash()` (que es aleatorio)."""
    accumulator = 0xCBF29CE484222325
    for byte in str(text).encode("utf-8"):
        accumulator = ((accumulator ^ byte) * 0x100000001B3) & MASK64
    return accumulator
