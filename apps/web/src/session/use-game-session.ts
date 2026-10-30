import { useCallback, useEffect, useRef, useState } from "react";

import type { SimulationMetrics, ViewProjectionV2, WorkerResponse } from "@landlord/shared";

import { appendDiagnostic, type DiagnosticEntry } from "../diagnostics";
import { SnapshotPersistenceError, createIndexedDbPersistence } from "../persistence/indexed-db";
import { SimulationWorkerClient, type ClientDiagnostic } from "../worker/client";
import { playFeedback } from "../audio/feedback";

/**
 * V.d-UX · la sesión de juego (worker, proyección, reloj, persistencia y mensajes) sale de
 * `App.tsx` para que el shell sea composición y no un segundo estado paralelo. La simulación
 * sigue siendo la única autoridad: aquí sólo se envían comandos y se guarda/carga el snapshot.
 */
export type GameSession = {
  client: SimulationWorkerClient | null;
  projection: ViewProjectionV2 | null;
  economy: NonNullable<ViewProjectionV2["economy"]> | undefined;
  runState: "paused" | "running";
  speed: 1 | 2 | 4;
  message: string;
  diagnostics: DiagnosticEntry[];
  latestMetrics: SimulationMetrics | null;
  setMessage: (message: string) => void;
  send: (action: () => Promise<WorkerResponse>, success: string) => Promise<void>;
  toggleRunState: () => Promise<void>;
  changeSpeed: (speed: 1 | 2 | 4) => Promise<void>;
  saveSnapshot: () => Promise<void>;
  loadSnapshot: () => Promise<void>;
  selectDistrict: (districtId: string) => Promise<void>;
  placeStructure: (cell: { x: number; y: number }) => Promise<void>;
  clearDiagnostics: () => void;
};

function responseMessage(response: WorkerResponse, success: string): string {
  return response.type === "RequestFailed" ? response.payload.message : success;
}

export function useGameSession(): GameSession {
  const [projection, setProjection] = useState<ViewProjectionV2 | null>(null);
  const [client, setClient] = useState<SimulationWorkerClient | null>(null);
  const [runState, setRunState] = useState<"paused" | "running">("paused");
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [message, setMessage] = useState("Conectando con el Worker…");
  const [diagnostics, setDiagnostics] = useState<DiagnosticEntry[]>([]);
  const [latestMetrics, setLatestMetrics] = useState<SimulationMetrics | null>(null);
  const clientRef = useRef<SimulationWorkerClient | null>(null);
  const diagnosticId = useRef(1);
  const autosavedMonth = useRef<number | null>(null);

  const recordDiagnostic = useCallback((diagnostic: ClientDiagnostic) => {
    if (diagnostic.kind === "commandAccepted") void playFeedback("accepted");
    if (diagnostic.kind === "commandRejected") void playFeedback("rejected");
    if (diagnostic.kind === "metrics") {
      setLatestMetrics(diagnostic.metrics);
      return;
    }
    const entry: DiagnosticEntry = {
      id: diagnosticId.current++,
      at: Date.now(),
      level:
        diagnostic.kind === "transportError"
          ? "error"
          : diagnostic.kind === "commandRejected"
            ? "warning"
            : "info",
      category: diagnostic.kind === "transportError" ? "transport" : "command",
      code: diagnostic.kind === "commandRejected" ? diagnostic.code : diagnostic.kind,
      message:
        diagnostic.kind === "commandRejected" || diagnostic.kind === "transportError"
          ? diagnostic.message
          : `Aceptado: ${diagnostic.label}`,
    };
    setDiagnostics((entries) => appendDiagnostic(entries, entry));
  }, []);

  useEffect(() => {
    const worker = new Worker(new URL("../worker/simulation.worker.ts", import.meta.url), {
      type: "module",
    });
    const workerClient = new SimulationWorkerClient(
      worker,
      (nextProjection) => setProjection(nextProjection),
      (error) => setMessage(error),
      recordDiagnostic,
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
  }, [recordDiagnostic]);

  const economy = projection?.economy;
  const currentGameMonth = economy?.gameTime.month;
  const currentGameDay = economy?.gameTime.day;
  const currentGameHour = economy?.gameTime.hour;

  useEffect(() => {
    if (
      currentGameMonth === undefined ||
      currentGameMonth <= 1 ||
      currentGameDay !== 1 ||
      currentGameHour !== 0
    )
      return;
    if (autosavedMonth.current === currentGameMonth || !clientRef.current) return;
    autosavedMonth.current = currentGameMonth;
    void clientRef.current
      .saveSnapshot()
      .then(async (response) => {
        if (response.type !== "RequestSucceeded") return;
        const snapshot = (response.payload.result as { snapshot?: unknown } | undefined)?.snapshot;
        if (snapshot) await createIndexedDbPersistence().save("autosave", snapshot);
      })
      .catch(() => {
        setMessage("No se pudo guardar el autosave mensual; el slot manual sigue disponible.");
      });
  }, [currentGameDay, currentGameHour, currentGameMonth]);

  const send = useCallback(async (action: () => Promise<WorkerResponse>, success: string) => {
    try {
      const response = await action();
      setMessage(responseMessage(response, success));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo enviar la acción");
    }
  }, []);

  const placeStructure = useCallback(
    async (cell: { x: number; y: number }) => {
      const districtId = projection?.economy?.district.id;
      if (!cell || !clientRef.current || !districtId) return;
      const response = await clientRef.current.placeTestStructure(cell, districtId);
      setMessage(responseMessage(response, "Comando enviado; esperando el tick efectivo."));
    },
    [projection?.economy?.district.id],
  );

  const selectDistrict = useCallback(async (districtId: string) => {
    if (!clientRef.current) return;
    const response = await clientRef.current.setObservedDistrict(districtId);
    setMessage(responseMessage(response, "Distrito observado cambiado."));
  }, []);

  const toggleRunState = useCallback(async () => {
    if (!clientRef.current) return;
    const next = runState === "running" ? "paused" : "running";
    const response = await clientRef.current.setRunState(next, speed);
    if (response.type === "RequestFailed") setMessage(response.payload.message);
    else {
      setRunState(next);
      setMessage(next === "running" ? "Simulación ejecutándose" : "Simulación pausada");
    }
  }, [runState, speed]);

  const changeSpeed = useCallback(
    async (nextSpeed: 1 | 2 | 4) => {
      setSpeed(nextSpeed);
      if (!clientRef.current || runState !== "running") return;
      const response = await clientRef.current.setRunState("running", nextSpeed);
      setMessage(responseMessage(response, `Velocidad ajustada a ${nextSpeed}×.`));
    },
    [runState],
  );

  const saveSnapshot = useCallback(async () => {
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
  }, []);

  const loadSnapshot = useCallback(async () => {
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
        await clientRef.current.setRunState("running", speed);
        setRunState("running");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar el snapshot");
    }
  }, [speed]);

  return {
    client,
    projection,
    economy,
    runState,
    speed,
    message,
    diagnostics,
    latestMetrics,
    setMessage,
    send,
    toggleRunState,
    changeSpeed,
    saveSnapshot,
    loadSnapshot,
    selectDistrict,
    placeStructure,
    clearDiagnostics: () => setDiagnostics([]),
  };
}
