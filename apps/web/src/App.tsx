import { useCallback, useEffect, useRef, useState } from "react";

import type { SimulationMetrics, ViewProjectionV1, WorkerResponse } from "@landlord/shared";
import { appendDiagnostic, summarizeDiagnostics, type DiagnosticEntry } from "./diagnostics";
import { SnapshotPersistenceError, createIndexedDbPersistence } from "./persistence/indexed-db";
import type { GridCell } from "./isometric/coordinates";
import { mountIsometricSpike, updateIsometricProjection } from "./isometric/mount";
import { SimulationWorkerClient, type ClientDiagnostic } from "./worker/client";
import { BenchmarkApp } from "./BenchmarkApp";

export function RootApp() {
  return new URLSearchParams(window.location.search).get("benchmark") === "gate1-reference-v1" ? (
    <BenchmarkApp />
  ) : (
    <App />
  );
}

export function App() {
  const [selectedCell, setSelectedCell] = useState<GridCell | null>(null);
  const [projection, setProjection] = useState<
    Parameters<typeof updateIsometricProjection>[1] | null
  >(null);
  const [client, setClient] = useState<SimulationWorkerClient | null>(null);
  const [runState, setRunState] = useState<"paused" | "running">("paused");
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [operationsOpen, setOperationsOpen] = useState(true);
  const [message, setMessage] = useState("Conectando con el Worker…");
  const [diagnostics, setDiagnostics] = useState<DiagnosticEntry[]>([]);
  const [latestMetrics, setLatestMetrics] = useState<SimulationMetrics | null>(null);
  const clientRef = useRef<SimulationWorkerClient | null>(null);
  const diagnosticId = useRef(1);

  const recordDiagnostic = useCallback((diagnostic: ClientDiagnostic) => {
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
    const worker = new Worker(new URL("./worker/simulation.worker.ts", import.meta.url), {
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

  const placeStructure = async () => {
    if (!selectedCell || !clientRef.current) return;
    const response = await clientRef.current.placeTestStructure(selectedCell);
    setMessage(responseMessage(response, "Comando enviado; esperando el tick efectivo."));
  };

  const sendAction = async (action: () => Promise<WorkerResponse>, success: string) => {
    try {
      const response = await action();
      setMessage(responseMessage(response, success));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo enviar la acción");
    }
  };

  const economy = projection?.economy;
  const diagnosticSummary = summarizeDiagnostics(diagnostics);
  const selectedParcel = economy?.parcels.find(
    (parcel) => parcel.cell.x === selectedCell?.x && parcel.cell.y === selectedCell?.y,
  );
  const selectedBuilding = selectedParcel?.buildingId
    ? economy?.buildings.find((building) => building.id === selectedParcel.buildingId)
    : undefined;
  const compatibleTenants =
    economy?.tenants.filter(
      (tenant) =>
        !tenant.activeContractBuildingId && tenant.preferredBuildingType === selectedBuilding?.type,
    ) ?? [];
  const selectedConstructionSite = economy?.constructionSites.find(
    (site) => site.parcelId === selectedParcel?.id,
  );
  const selectedBuildingOption = economy?.constructionOptions.find(
    (option) => option.type === selectedBuilding?.type,
  );
  const eligibleConstructionOptions =
    economy?.constructionOptions.filter(
      (option) => selectedParcel && option.allowedZoning.includes(selectedParcel.zoning),
    ) ?? [];
  const debugToolsEnabled = new URLSearchParams(window.location.search).get("debug") === "1";

  const toggleRunState = async () => {
    if (!clientRef.current) return;
    const next = runState === "running" ? "paused" : "running";
    const response = await clientRef.current.setRunState(next, speed);
    if (response.type === "RequestFailed") setMessage(response.payload.message);
    else {
      setRunState(next);
      setMessage(next === "running" ? "Simulación ejecutándose" : "Simulación pausada");
    }
  };

  const changeSpeed = async (nextSpeed: 1 | 2 | 4) => {
    setSpeed(nextSpeed);
    if (!clientRef.current || runState !== "running") return;
    const response = await clientRef.current.setRunState("running", nextSpeed);
    setMessage(responseMessage(response, `Velocidad ajustada a ${nextSpeed}×.`));
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
        await clientRef.current.setRunState("running", speed);
        setRunState("running");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar el snapshot");
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <h1>Landlord</h1>
          <p>Distrito piloto</p>
        </div>
        <div className="run-controls" aria-label="Control de simulación">
          <button
            aria-controls="operations-panel"
            aria-expanded={operationsOpen}
            type="button"
            onClick={() => setOperationsOpen((open) => !open)}
          >
            {operationsOpen ? "Ocultar panel" : "Abrir panel"}
          </button>
          <button type="button" disabled={!client} onClick={() => void toggleRunState()}>
            {runState === "running" ? "Pausar" : "Continuar"}
          </button>
          {([1, 2, 4] as const).map((value) => (
            <button
              aria-pressed={speed === value}
              disabled={!client}
              key={value}
              type="button"
              onClick={() => void changeSpeed(value)}
            >
              {value}×
            </button>
          ))}
          <button type="button" disabled={!client} onClick={() => void saveSnapshot()}>
            Guardar
          </button>
          <button type="button" disabled={!client} onClick={() => void loadSnapshot()}>
            Cargar
          </button>
        </div>
      </header>
      <div className="workspace">
        <section className="map-panel" aria-label="Mapa del distrito">
          <header className="map-header">
            <strong>Mapa operativo</strong>
            <span className="map-help">Rueda: zoom · flechas o botón derecho: desplazamiento</span>
          </header>
          <IsometricCanvas projection={projection} onCellPicked={setSelectedCell} />
        </section>
        <aside
          className={`sidebar ${operationsOpen ? "" : "sidebar-collapsed"}`}
          id="operations-panel"
          aria-label="Panel de operación"
          aria-hidden={!operationsOpen}
        >
          <details className="side-panel onboarding-panel" open>
            <summary>Cómo jugar esta prueba</summary>
            <ol>
              <li>Compra una parcela disponible.</li>
              <li>Espera materiales y elige qué construir según su zonificación.</li>
              <li>Ocupa el edificio, cobra rentas y reinvierte o asume riesgos.</li>
            </ol>
          </details>
          <section className="side-panel">
            <p className="status-line" role="status">
              {message}
            </p>
            <div className="metric-grid" aria-label="Estado de la empresa">
              <Metric label="Caja" value={`${economy?.cash ?? "—"} u.`} />
              <Metric label="Tick" value={projection?.tick ?? "—"} />
              <Metric label="Cemento" value={economy?.inventory.cement ?? "—"} />
              <Metric
                label="Ladrillo / acero"
                value={`${economy?.inventory.brick ?? "—"} / ${economy?.inventory.steel ?? "—"}`}
              />
              <Metric
                label="Cuadrilla"
                value={economy ? `${economy.crew.used}/${economy.crew.capacity}` : "—"}
              />
              <Metric label="Influencia" value={economy?.influence ?? "—"} />
            </div>
            {economy && (
              <p className="compact-note">
                Producción:{" "}
                {economy.production
                  .map(
                    (facility) =>
                      `${resourceLabel(facility.output)} ${facility.cycleProgress}/${facility.cycleLength} (+${facility.outputAmount})`,
                  )
                  .join(" · ")}
              </p>
            )}
          </section>
          <section className="side-panel" aria-label="Inspección de parcela">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Selección</p>
                <h2>{selectedParcel ? "Parcela" : "Mapa"}</h2>
              </div>
            </div>
            {selectedCell ? (
              selectedParcel ? (
                <>
                  <p className="selection-title">
                    {zoningLabel(selectedParcel.zoning)} ·{" "}
                    {ownershipLabel(selectedParcel.ownerOrganizationId)}
                  </p>
                  <p className="selection-detail">
                    {selectedBuilding
                      ? `${buildingLabel(selectedBuilding.type)} · nivel ${selectedBuilding.level} · estado ${selectedBuilding.condition}%`
                      : selectedConstructionSite
                        ? `${buildingLabel(selectedConstructionSite.buildingType)} en obra · ${selectedConstructionSite.progress}/${selectedConstructionSite.workRequired}`
                        : `Solar disponible · precio ${selectedParcel.price} u.`}
                  </p>
                  {selectedConstructionSite && (
                    <div className="construction-options">
                      <p>
                        Progreso{" "}
                        {Math.floor(
                          (selectedConstructionSite.progress /
                            selectedConstructionSite.workRequired) *
                            100,
                        )}
                        % · la cuadrilla está ocupada.
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          void sendAction(
                            () =>
                              clientRef.current!.cancelConstruction(selectedConstructionSite.id),
                            "Obra cancelada; se recuperó la mitad de los materiales y no la caja.",
                          )
                        }
                      >
                        Cancelar obra
                      </button>
                    </div>
                  )}
                  {!selectedBuilding &&
                    !selectedConstructionSite &&
                    selectedParcel?.ownerOrganizationId === "org_00000001" && (
                      <div className="construction-options" aria-label="Opciones de construcción">
                        <p className="eyebrow">Opciones de construcción</p>
                        {eligibleConstructionOptions.map((option) => {
                          const missing = missingResources(economy?.inventory, option.resources);
                          const unavailable =
                            !client ||
                            Boolean(selectedParcel.buildingId) ||
                            missing.length > 0 ||
                            (economy?.cash ?? 0) < option.cost;
                          const crewUnavailable =
                            (economy?.crew.used ?? 0) >= (economy?.crew.capacity ?? 1);
                          return (
                            <button
                              className="construction-option"
                              disabled={unavailable || crewUnavailable}
                              key={option.type}
                              type="button"
                              onClick={() =>
                                void sendAction(
                                  () =>
                                    clientRef.current!.startConstruction(
                                      selectedParcel.id,
                                      option.type,
                                    ),
                                  `${option.name} en construcción; la capacidad de trabajo está reservada.`,
                                )
                              }
                            >
                              <strong>{option.name}</strong>
                              <span>
                                {option.cost} u. · {option.workRequired} ticks · {option.capacity}{" "}
                                plazas · renta {option.baseRent} u.
                              </span>
                              <span>Requiere: {resourceSummary(option.resources)}.</span>
                              {missing.length > 0 && <span>Faltan: {missing.join(", ")}.</span>}
                              {(economy?.cash ?? 0) < option.cost && <span>Falta caja.</span>}
                              {crewUnavailable && <span>La cuadrilla está ocupada.</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  {selectedBuilding && (
                    <div className="construction-options">
                      <p className="eyebrow">Explotación del activo</p>
                      <p>Renta efectiva: {selectedBuilding.effectiveRent} u. cada 12 ticks.</p>
                      {selectedBuilding.tenantId ? (
                        <p>
                          Ocupado · contrato restante{" "}
                          {economy?.tenants.find(
                            (tenant) => tenant.id === selectedBuilding.tenantId,
                          )?.leaseRemaining ?? 0}{" "}
                          cobros.
                        </p>
                      ) : compatibleTenants.length > 0 ? (
                        compatibleTenants.map((tenant) => (
                          <button
                            key={tenant.id}
                            type="button"
                            onClick={() =>
                              void sendAction(
                                () =>
                                  clientRef.current!.assignTenant(selectedBuilding.id, tenant.id),
                                "Inquilino asignado; la renta se liquidará cada 12 ticks.",
                              )
                            }
                          >
                            Ocupar con {tenantProfileLabel(tenant.profile)} · presupuesto{" "}
                            {tenant.budget} u.
                          </button>
                        ))
                      ) : (
                        <p>No hay inquilinos compatibles disponibles.</p>
                      )}
                      {!selectedBuilding.upgraded && selectedBuildingOption && (
                        <button
                          type="button"
                          disabled={
                            economy!.crew.used >= economy!.crew.capacity ||
                            economy!.cash < selectedBuildingOption.upgradeCost ||
                            missingResources(
                              economy!.inventory,
                              selectedBuildingOption.upgradeResources,
                            ).length > 0
                          }
                          onClick={() =>
                            void sendAction(
                              () => clientRef.current!.upgradeBuilding(selectedBuilding.id),
                              "Mejora iniciada; aumentará la renta cuando termine.",
                            )
                          }
                        >
                          Mejorar: {selectedBuildingOption.upgradeCost} u. ·{" "}
                          {selectedBuildingOption.upgradeWorkRequired} ticks · renta +
                          {selectedBuildingOption.upgradeRentBonusPercent}%
                        </button>
                      )}
                      {selectedBuilding.upgraded && <p>Mejora completada · renta bonificada.</p>}
                    </div>
                  )}
                </>
              ) : (
                <p className="empty-state">
                  Celda {selectedCell.x}, {selectedCell.y}; no pertenece al distrito disponible.
                </p>
              )
            ) : (
              <p className="empty-state">Selecciona una parcela del mapa para ver sus opciones.</p>
            )}
            <div className="action-grid">
              <button
                className="primary-action"
                type="button"
                disabled={!client || !selectedParcel || Boolean(selectedParcel.ownerOrganizationId)}
                onClick={() =>
                  selectedParcel &&
                  void sendAction(
                    () => clientRef.current!.buyParcel(selectedParcel.id),
                    "Parcela comprada; el rival también está buscando oportunidades.",
                  )
                }
              >
                Comprar parcela
              </button>
              <button
                type="button"
                disabled={!client || economy?.ordinance.status !== "proposed"}
                onClick={() =>
                  economy &&
                  void sendAction(
                    () => clientRef.current!.lobbyPolicy(economy.ordinance.id),
                    "Ordenanza aprobada y aplicada al ciclo económico.",
                  )
                }
              >
                Promover ordenanza
              </button>
              <button
                className="risk-action"
                type="button"
                disabled={!client}
                onClick={() =>
                  void sendAction(
                    () => clientRef.current!.commitCrime(),
                    "La acción de riesgo fue procesada; revisa heat y presión policial.",
                  )
                }
              >
                Intentar ruta ilegal
              </button>
              {debugToolsEnabled && (
                <button
                  type="button"
                  disabled={!client || !selectedCell}
                  onClick={() => void placeStructure()}
                >
                  Marcador técnico
                </button>
              )}
            </div>
          </section>
          {economy && (
            <section className="side-panel" aria-label="Decisiones y riesgos">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Distrito</p>
                  <h2>Riesgo y política</h2>
                </div>
              </div>
              <div className="info-list">
                <p>
                  <strong>Ordenanza:</strong> {economy.ordinance.name} ·{" "}
                  {ordinanceStatusLabel(economy.ordinance.status)}
                </p>
                <p>{ordinanceExplanation(economy.ordinance, projection?.tick ?? 0)}</p>
                <p>
                  <strong>Heat:</strong> {economy.heat} · presión policial {economy.policePressure}
                </p>
                <p>
                  <strong>Ruta ilegal:</strong> +{economy.illegalRoute.benefitOnSuccess} u. si sale
                  bien; detección estimada {economy.illegalRoute.detectionChancePercent}% y +
                  {economy.illegalRoute.heatOnAttempt} heat en cada intento. Si te detectan: multa
                  de hasta {economy.illegalRoute.fineOnDetection} u.
                </p>
                <p>
                  <strong>Activos:</strong> {economy.buildings.length} edificios ·{" "}
                  {economy.constructionSites.length} obras activas
                </p>
                <p>
                  <strong>Rival:</strong> {economy.rival.parcels} parcelas ·{" "}
                  {economy.rival.buildings} edificios · {economy.rival.occupiedBuildings} ocupados ·{" "}
                  {economy.rival.cash} u.
                </p>
              </div>
            </section>
          )}
          {economy && (
            <details className="side-panel">
              <summary>Libro de caja reciente</summary>
              <ol className="diagnostic-log">
                {economy.recentTransactions.map((transaction, index) => (
                  <li key={`${transaction.tick}-${transaction.cause}-${index}`}>
                    tick {transaction.tick} · {transactionLabel(transaction.cause)} ·{" "}
                    {transaction.direction === "credit" ? "+" : "−"}
                    {transaction.amount} u.
                  </li>
                ))}
              </ol>
            </details>
          )}
          <details className="side-panel diagnostic-panel">
            <summary>Diagnóstico de sesión</summary>
            <div className="diagnostic-summary">
              <p>
                Transporte: {diagnosticSummary.errors} errores · rechazos{" "}
                {diagnosticSummary.rejections.reduce((total, [, count]) => total + count, 0)} ·
                aceptados {diagnostics.filter((entry) => entry.code === "commandAccepted").length}
              </p>
              {latestMetrics && (
                <p>
                  Worker: tick {latestMetrics.tick} · cola {latestMetrics.pendingCommands} ·
                  aceptados {latestMetrics.acceptedCommands}
                </p>
              )}
              {diagnosticSummary.patterns.map((pattern) => (
                <p className="pattern-alert" key={pattern.code} role="alert">
                  Patrón: {pattern.count} rechazos {pattern.code}.
                </p>
              ))}
              <button type="button" onClick={() => setDiagnostics([])}>
                Limpiar diagnóstico
              </button>
            </div>
            <ol className="diagnostic-log">
              {diagnostics
                .slice(-8)
                .reverse()
                .map((entry) => (
                  <li key={entry.id}>
                    [{entry.level}] {entry.message}
                  </li>
                ))}
            </ol>
          </details>
        </aside>
      </div>
    </main>
  );
}

function IsometricCanvas({
  projection,
  onCellPicked,
}: {
  projection: ViewProjectionV1 | null;
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

  return <div className="map-canvas" ref={container} aria-label="Mapa isométrico del distrito" />;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
    </div>
  );
}

function ownershipLabel(ownerOrganizationId: string | null): string {
  if (ownerOrganizationId === "org_00000001") return "Tu organización";
  if (ownerOrganizationId === "org_00000002") return "Rival";
  return "Disponible";
}

function buildingLabel(type: string): string {
  return type === "courtyard_home" ? "Patio residencial" : "Taller";
}

function zoningLabel(zoning: "residential" | "industrial" | "mixed"): string {
  return { residential: "Residencial", industrial: "Industrial", mixed: "Mixta" }[zoning];
}

function tenantProfileLabel(profile: "household" | "maker" | "shopkeeper"): string {
  return { household: "hogar", maker: "artesano", shopkeeper: "comerciante" }[profile];
}

function transactionLabel(cause: string): string {
  return (
    {
      parcel_purchase: "compra de parcela",
      construction_start: "inicio de obra",
      building_upgrade: "mejora de edificio",
      rent_collection: "cobro de renta",
      illegal_route: "ruta ilegal",
      crime_fine: "multa por detección",
    }[cause] ?? cause
  );
}

function resourceSummary(resources: { cement: number; brick: number; steel: number }): string {
  return `${resources.cement} cemento, ${resources.brick} ladrillo y ${resources.steel} acero`;
}

function missingResources(
  inventory: { cement: number; brick: number; steel: number } | undefined,
  requirements: { cement: number; brick: number; steel: number },
): string[] {
  if (!inventory) return [resourceSummary(requirements)];
  return (["cement", "brick", "steel"] as const).flatMap((resource) => {
    const missing = requirements[resource] - inventory[resource];
    return missing > 0 ? [`${missing} ${resourceLabel(resource)}`] : [];
  });
}

function resourceLabel(resource: "cement" | "brick" | "steel"): string {
  return resource === "cement" ? "cemento" : resource === "brick" ? "ladrillo" : "acero";
}

function ordinanceStatusLabel(status: "proposed" | "approved" | "active" | "expired" | "rejected") {
  return {
    proposed: "propuesta disponible",
    approved: "aprobada",
    active: "activa",
    expired: "expirada",
    rejected: "rechazada",
  }[status];
}

function ordinanceExplanation(
  ordinance: {
    status: "proposed" | "approved" | "active" | "expired" | "rejected";
    expiresAtTick: number | null;
    materialCostModifierPercent: number;
    rentModifierPercent: number;
    influenceRequired: number;
  },
  tick: number,
): string {
  const effects = `Construcción ${ordinance.materialCostModifierPercent}% · renta ${ordinance.rentModifierPercent}%.`;
  if (ordinance.status === "proposed")
    return `Puedes promoverla por ${ordinance.influenceRequired} influencia. ${effects}`;
  if (ordinance.status === "active")
    return `Está aplicada hasta el tick ${ordinance.expiresAtTick ?? tick}. ${effects}`;
  return `No puede promoverse en este momento. ${effects} Ya no se aplica.`;
}

function responseMessage(response: WorkerResponse, success: string): string {
  return response.type === "RequestFailed" ? response.payload.message : success;
}
