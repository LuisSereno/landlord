import { useEffect, useRef, useState } from "react";

import { mountIsometricSpike } from "./isometric/mount";
import type { GridCell } from "./isometric/coordinates";

export function App() {
  const [selectedCell, setSelectedCell] = useState<GridCell | null>(null);

  return (
    <main>
      <h1>Landlord</h1>
      <p>Gate 1 — escena web técnica.</p>
      <IsometricCanvas onCellPicked={setSelectedCell} />
      <aside aria-label="Inspección de celda">
        {selectedCell
          ? `Celda seleccionada: ${selectedCell.x}, ${selectedCell.y}`
          : "Ninguna celda seleccionada"}
      </aside>
    </main>
  );
}

function IsometricCanvas({ onCellPicked }: { onCellPicked: (cell: GridCell) => void }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return undefined;
    const game = mountIsometricSpike(container.current, onCellPicked);
    return () => game.destroy(true);
  }, [onCellPicked]);

  return <div ref={container} aria-label="Mapa isométrico técnico" />;
}
