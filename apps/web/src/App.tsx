import { useEffect, useRef, useState } from "react";

import type { WorkerResponse } from "@landlord/shared";
import { SnapshotPersistenceError, createIndexedDbPersistence } from "./persistence/indexed-db";
import type { GridCell } from "./isometric/coordinates";
import { mountIsometricSpike, updateIsometricProjection } from "./isometric/mount";
import { SimulationWorkerClient } from "./worker/client";

export function App() {
  const [selectedCell, setSelectedCell] = useState<GridCell | null>(null);
  const [projection, setProjection] = useState<
    Parameters<typeof updateIsometricProjection>[1] | null
  >(null);
  const [client, setClient] = useState<SimulationWorkerClient | null>(null);
  const [runState, setRunState] = useState<"paused" | "running">("paused");
  const [message, setMessage] = useState("Conectando con el Worker…");
  const clientRef = useRef<SimulationWorkerClient | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("./worker/simulation.worker.ts", import.meta.url), {
      type: "module",
    });
    const workerClient = new SimulationWorkerClient(
      worker,
      (nextProjection) => setProjection(nextProjection),
      (error) => setMessage(error),
    );
    clientRef.current = workerClient;
    setClient(workerClient);
    void workerClient.initialize(1).then(async (response) => {
      if (response.type === "RequestFailed") {
        setMessage(response.payload.message);
        return;
      }
      if (response.type !== "RequestSucceeded") {
        setMessage("El Worker no confirmó el guardado.");
        return;
      }
      const runResponse = await workerClient.setRunState("running", 1);
      if (runResponse.type === "RequestFailed") setMessage(runResponse.payload.message);
      else {
        setRunState("running");
        setMessage("Worker conectado · simulación ejecutándose");
      }
    });
    return () => {
      workerClient.dispose();
      clientRef.current = null;
    };
  }, []);

  const placeStructure = async () => {
    if (!selectedCell || !clientRef.current) return;
    const response = await clientRef.current.placeTestStructure(selectedCell);
    setMessage(responseMessage(response, "Comando enviado; esperando el tick efectivo."));
  };

  const toggleRunState = async () => {
    if (!clientRef.current) return;
    const next = runState === "running" ? "paused" : "running";
    const response = await clientRef.current.setRunState(next, 1);
    if (response.type === "RequestFailed") setMessage(response.payload.message);
    else {
      setRunState(next);
      setMessage(next === "running" ? "Simulación ejecutándose" : "Simulación pausada");
    }
  };

  const saveSnapshot = async () => {
    if (!clientRef.current) return;
    try {
      const response = await clientRef.current.saveSnapshot();
      if (response.type === "RequestFailed") {
        setMessage(response.payload.message);
        return;
      }
      if (response.type !== "RequestSucceeded") {
        setMessage("El Worker no confirmó el guardado.");
        return;
      }
      const snapshot = (response.payload.result as { snapshot?: unknown } | undefined)?.snapshot;
      if (!snapshot) throw new SnapshotPersistenceError("El Worker no devolvió un snapshot");
      await createIndexedDbPersistence().save("default", snapshot);
      setMessage("Snapshot guardado en IndexedDB");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el snapshot");
    }
  };

  const loadSnapshot = async () => {
    if (!clientRef.current) return;
    try {
      const snapshot = await createIndexedDbPersistence().load("default");
      if (!snapshot) {
        setMessage("No existe un snapshot guardado");
        return;
      }
      const response = await clientRef.current.loadSnapshot(snapshot);
      setMessage(responseMessage(response, "Snapshot cargado y proyección resincronizada."));
      if (response.type === "RequestSucceeded") {
        await clientRef.current.setRunState("running", 1);
        setRunState("running");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar el snapshot");
    }
  };

  return (
    <main>
      <h1>Landlord</h1>
      <p>{message}</p>
      <IsometricCanvas projection={projection} onCellPicked={setSelectedCell} />
      <aside aria-label="Inspección de celda">
        {selectedCell
          ? `Celda seleccionada: ${selectedCell.x}, ${selectedCell.y}`
          : "Ninguna celda seleccionada"}
      </aside>
      <div>
        <button
          type="button"
          disabled={!client || !selectedCell}
          onClick={() => void placeStructure()}
        >
          Colocar estructura técnica
        </button>
        <button type="button" disabled={!client} onClick={() => void toggleRunState()}>
          {runState === "running" ? "Pausar" : "Continuar"}
        </button>
        <button type="button" disabled={!client} onClick={() => void saveSnapshot()}>
          Guardar
        </button>
        <button type="button" disabled={!client} onClick={() => void loadSnapshot()}>
          Cargar
        </button>
      </div>
    </main>
  );
}

function IsometricCanvas({
  projection,
  onCellPicked,
}: {
  projection: Parameters<typeof updateIsometricProjection>[1] | null;
  onCellPicked: (cell: GridCell) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const game = useRef<ReturnType<typeof mountIsometricSpike> | null>(null);

  useEffect(() => {
    if (!container.current) return undefined;
    game.current = mountIsometricSpike(container.current, onCellPicked);
    return () => {
      game.current?.destroy(true);
      game.current = null;
    };
  }, [onCellPicked]);

  useEffect(() => {
    if (game.current && projection) updateIsometricProjection(game.current, projection);
  }, [projection]);

  return <div ref={container} aria-label="Mapa isométrico técnico" />;
}

function responseMessage(response: WorkerResponse, success: string): string {
  return response.type === "RequestFailed" ? response.payload.message : success;
}
