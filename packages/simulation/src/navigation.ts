/** Deterministic N/E/S/W A* for operational agents. */
export function findDeterministicPath(
  start: { x: number; y: number },
  goal: { x: number; y: number },
  blocked: ReadonlySet<string>,
  width = 64,
  height = 64,
): Array<{ x: number; y: number }> {
  const key = (cell: { x: number; y: number }) => `${cell.x}:${cell.y}`;
  const heuristic = (cell: { x: number; y: number }) => Math.abs(cell.x - goal.x) + Math.abs(cell.y - goal.y);
  const open = [{ ...start }];
  const came = new Map<string, { x: number; y: number }>();
  const cost = new Map([[key(start), 0]]);
  while (open.length) {
    open.sort((a, b) => (cost.get(key(a))! + heuristic(a)) - (cost.get(key(b))! + heuristic(b)) || a.y - b.y || a.x - b.x);
    const current = open.shift()!;
    if (key(current) === key(goal)) {
      const path = [current];
      while (came.has(key(path[0]!))) path.unshift(came.get(key(path[0]!))!);
      return path.slice(1);
    }
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const next = { x: current.x + dx, y: current.y + dy };
      if (next.x < 0 || next.y < 0 || next.x >= width || next.y >= height || (blocked.has(key(next)) && key(next) !== key(goal))) continue;
      const nextCost = cost.get(key(current))! + 1;
      if (nextCost < (cost.get(key(next)) ?? Infinity)) { cost.set(key(next), nextCost); came.set(key(next), current); if (!open.some((item) => key(item) === key(next))) open.push(next); }
    }
  }
  return [];
}
