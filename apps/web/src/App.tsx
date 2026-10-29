import { useCallback, useEffect, useRef, useState } from "react";

import type { SimulationMetrics, ViewProjectionV2, WorkerResponse } from "@landlord/shared";
import { appendDiagnostic, summarizeDiagnostics, type DiagnosticEntry } from "./diagnostics";
import { SnapshotPersistenceError, createIndexedDbPersistence } from "./persistence/indexed-db";
import type { GridCell } from "./isometric/coordinates";
import {
  mountIsometricSpike,
  updateIsometricOverlay,
  updateIsometricProjection,
  type MapOverlay,
} from "./isometric/mount";
import { SimulationWorkerClient, type ClientDiagnostic } from "./worker/client";
import { BenchmarkApp } from "./BenchmarkApp";
import { CityView } from "./CityView";
import { ArtLab } from "./ArtLab";
import { VisualSlice } from "./VisualSlice";
import { playFeedback } from "./audio/feedback";

export function RootApp() {
  if (window.location.pathname === "/art-lab") return <ArtLab />;
  if (window.location.pathname === "/visual-slice") return <VisualSlice />;
  return new URLSearchParams(window.location.search).get("benchmark") === "gate1-reference-v1" ? (
    <BenchmarkApp />
  ) : (
    <App />
  );
}

export function App() {
  const [selectedCell, setSelectedCell] = useState<GridCell | null>(null);
  const [mapOverlay, setMapOverlay] = useState<MapOverlay>("ownership");
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
    const districtId = projection?.economy?.district.id;
    if (!selectedCell || !clientRef.current || !districtId) return;
    const response = await clientRef.current.placeTestStructure(selectedCell, districtId);
    setMessage(responseMessage(response, "Comando enviado; esperando el tick efectivo."));
  };

  /** Cambiar de distrito es una petición técnica: no consume caja ni mueve el mundo. */
  const selectDistrict = async (districtId: string) => {
    if (!clientRef.current) return;
    const response = await clientRef.current.setObservedDistrict(districtId);
    setMessage(responseMessage(response, "Distrito observado cambiado."));
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
  const currentGameMonth = economy?.gameTime.month;
  const currentGameDay = economy?.gameTime.day;
  const currentGameHour = economy?.gameTime.hour;
  const diagnosticSummary = summarizeDiagnostics(diagnostics);
  const runPortfolioRoutine = async () => {
    if (!clientRef.current || !economy) return;
    const occupiedTenantIds = new Set(
      economy.buildings
        .filter((building) => building.ownerOrganizationId === "org_00000001")
        .flatMap((building) => building.tenantIds),
    );
    let completed = 0;
    for (const building of economy.buildings
      .filter(
        (entry) =>
          entry.ownerOrganizationId === "org_00000001" &&
          entry.state === "operational" &&
          entry.tenantIds.length < entry.capacity,
      )
      .sort((left, right) => left.id.localeCompare(right.id))) {
      const vacancies = building.capacity - building.tenantIds.length;
      const tenants = economy.tenants.filter(
        (tenant) =>
          !tenant.activeContractBuildingId &&
          !occupiedTenantIds.has(tenant.id) &&
          tenant.preferredBuildingType === building.type &&
          tenant.budget >= building.effectiveRent,
      );
      for (const tenant of tenants.slice(0, vacancies)) {
        const response = await clientRef.current.assignTenant(building.id, tenant.id);
        if (response.type !== "RequestFailed") {
          occupiedTenantIds.add(tenant.id);
          completed += 1;
        }
      }
    }
    const freeCrews = economy.crews.filter((crew) => !crew.assignedWorkOrderId);
    for (const site of economy.constructionSites
      .filter(
        (entry) =>
          entry.ownerOrganizationId === "org_00000001" && entry.assignedCrewIds.length === 0,
      )
      .sort((left, right) => left.id.localeCompare(right.id))) {
      const crew = freeCrews.shift();
      if (!crew) break;
      const response = await clientRef.current.assignCrew(crew.id, site.id);
      if (response.type !== "RequestFailed") completed += 1;
    }
    setMessage(
      completed > 0
        ? `Rutina de cartera completada: ${completed} operación(es) ejecutada(s).`
        : "No hay excepciones rutinarias que resolver.",
    );
  };
  const selectedParcel = economy?.parcels.find((parcel) =>
    parcel.cells.some((cell) => cell.x === selectedCell?.x && cell.y === selectedCell?.y),
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
  const selectedOwnedBuilding =
    selectedBuilding?.ownerOrganizationId === "org_00000001" ? selectedBuilding : undefined;
  const selectedInsuranceContract = selectedOwnedBuilding
    ? economy?.insurance.contracts.find(
        (contract) => contract.buildingId === selectedOwnedBuilding.id,
      )
    : undefined;
  const selectedInsuranceOffers = selectedOwnedBuilding
    ? (economy?.insurance.offers.filter((offer) => offer.buildingId === selectedOwnedBuilding.id) ??
      [])
    : [];
  const selectedAuction = economy?.banking.auctions.find(
    (auction) => auction.collateralParcelId === selectedParcel?.id,
  );
  const selectedPhysicalFacility = selectedOwnedBuilding
    ? economy?.production.find((facility) => facility.buildingId === selectedOwnedBuilding.id)
    : undefined;
  const selectedIsProductionBuilding = Boolean(selectedPhysicalFacility);
  const selectedOwnedSite =
    selectedConstructionSite?.ownerOrganizationId === "org_00000001"
      ? selectedConstructionSite
      : undefined;
  const eligibleConstructionOptions =
    economy?.constructionOptions.filter(
      (option) =>
        selectedParcel &&
        option.allowedUses.every((use) => selectedParcel.allowedUses.includes(use)),
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
          <a className="art-lab-link" href="/art-lab">
            Art Lab
          </a>
        </div>
      </header>
      <div className="workspace">
        <section className="map-panel" aria-label="Mapa del distrito">
          <header className="map-header">
            <strong>Mapa operativo</strong>
            <span className="map-district" aria-label="Distrito observado">
              {projection?.city.districts.find(
                (district) => district.id === projection.observedDistrictId,
              )?.name ?? "—"}
            </span>
            <label>
              <span className="sr-only">Capa del mapa</span>
              <select
                aria-label="Capa del mapa"
                value={mapOverlay}
                onChange={(event) => setMapOverlay(event.target.value as MapOverlay)}
              >
                <option value="ownership">Propiedad</option>
                <option value="profitability">Rentabilidad</option>
                <option value="condition">Condición</option>
                <option value="zoning">Zoning</option>
                <option value="risk">Riesgo regulatorio</option>
                <option value="landValue">Valor del suelo</option>
                <option value="security">Seguridad</option>
                <option value="fire">Bomberos</option>
                <option value="health">Salud</option>
                <option value="education">Educación</option>
                <option value="transport">Transporte</option>
                <option value="use">Uso</option>
                <option value="developmentCode">Código urbanístico</option>
                <option value="urbanRole">Rol urbano</option>
              </select>
            </label>
            <span className="map-help">Rueda: zoom · flechas o botón derecho: desplazamiento</span>
          </header>
          <IsometricCanvas
            projection={projection}
            overlay={mapOverlay}
            onCellPicked={setSelectedCell}
          />
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
              <li>Compra materiales o invierte en producción propia.</li>
              <li>Construye, asigna unidades, mantén los activos y reinvierte.</li>
            </ol>
          </details>
          {projection ? (
            <CityView
              districts={projection.city.districts}
              observedDistrictId={projection.observedDistrictId}
              onSelect={(districtId) => void selectDistrict(districtId)}
            />
          ) : null}
          {projection ? (
            <details className="side-panel">
              <summary>Equipamientos y espacios públicos</summary>
              {projection.facilities.length === 0 && projection.publicSpaces.length === 0 ? (
                <p>Este distrito no tiene programa municipal.</p>
              ) : (
                <>
                  {projection.facilities.map((facility) => (
                    <p key={facility.id} className="selection-detail">
                      <strong>{facilityLabel(facility.kind)}</strong> · capacidad{" "}
                      {facility.capacity} · operador {facility.operatorOrganizationId}
                      <br />
                      función {facility.serviceProfileId} · edificios{" "}
                      {facility.buildingIds.join(", ") || "—"} · parcelas{" "}
                      {facility.parcelIds.join(", ")}
                      <br />
                      cobertura: {facility.coverage?.coveragePercent ?? 0}% (
                      {facility.coverage?.served ?? 0}/{facility.coverage?.demand ?? 0} parcelas ·
                      capacidad {facility.coverage?.effectiveCapacity ?? 0}
                      {facility.coverage?.saturated ? " · saturada" : ""}) ·{" "}
                      {facility.accessCells.length} celdas de acceso vial
                    </p>
                  ))}
                  {projection.publicSpaces.map((space) => (
                    <p key={space.id} className="selection-detail">
                      <strong>{publicSpaceLabel(space.kind)}</strong> · {space.cells.length} celdas
                      · operador {space.operatorOrganizationId}
                      {space.blockId ? ` · manzana ${space.blockId}` : ""}
                    </p>
                  ))}
                </>
              )}
            </details>
          ) : null}
          <section className="side-panel">
            <p className="status-line" role="status">
              {message}
            </p>
            <div className="metric-grid" aria-label="Estado de la empresa">
              <Metric label="Caja" value={`${economy?.cash ?? "—"} u.`} />
              <Metric
                label="Calendario"
                value={
                  economy
                    ? `Mes ${economy.gameTime.month} · día ${economy.gameTime.day} · ${economy.gameTime.hour}:00`
                    : "—"
                }
              />
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
          </section>
          {economy && (
            <details className="side-panel">
              <summary>Resumen financiero</summary>
              <div className="diagnostic-summary">
                <p>
                  <strong>Posición:</strong> activos {economy.financials.assets} u. · pasivos{" "}
                  {economy.financials.liabilities} u. · patrimonio {economy.financials.equity} u.
                </p>
                <p>
                  <strong>Mes {economy.financials.period.month}:</strong> ingresos{" "}
                  {economy.financials.period.income} u. · gastos{" "}
                  {economy.financials.period.expenses} u. · resultado{" "}
                  {signedAmount(economy.financials.period.netIncome)}
                </p>
                <p>
                  <strong>Previsión:</strong> {economy.financials.forecast.income} u. de ingresos ·{" "}
                  {economy.financials.forecast.expenses} u. de gastos · cierre{" "}
                  {economy.financials.forecast.closingCash} u.
                  {economy.financials.forecast.shortfall > 0 && (
                    <> · faltan {economy.financials.forecast.shortfall} u.</>
                  )}
                </p>
                <p>
                  <strong>Fiscalidad:</strong> propiedad {economy.taxation.propertyRateBps / 100}%
                  mensual · próxima liquidación en tick {economy.taxation.nextSettlementTick} ·
                  previsión {economy.taxation.projectedMonthlyPropertyTax} u./mes
                  {economy.taxation.playerArrears > 0 &&
                    ` · atrasos ${economy.taxation.playerArrears} u.`}
                </p>
                <p>
                  <strong>Mantenimiento:</strong> política {economy.maintenance.policy} · próxima
                  liquidación en tick {economy.maintenance.nextSettlementTick} · carga prevista{" "}
                  {economy.maintenance.monthlyCost} u. · backlog {economy.maintenance.backlog} u.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    void sendAction(
                      () =>
                        clientRef.current!.setMaintenancePolicy(
                          economy.maintenance.policy === "balanced" ? "deferred" : "balanced",
                        ),
                      "Política de mantenimiento actualizada.",
                    )
                  }
                >
                  Cambiar a {economy.maintenance.policy === "balanced" ? "diferido" : "equilibrado"}
                </button>
                <p>
                  <strong>Automatización:</strong> propiedad{" "}
                  {economy.automation.policies.property === "manual"
                    ? "manual"
                    : "gestor de vacantes"}{" "}
                  · finanzas{" "}
                  {economy.automation.policies.finance === "manual"
                    ? "manual"
                    : "cubre la caja con préstamo"}{" "}
                  · reparación automática{" "}
                  {economy.automation.policies.maintenanceRepairThreshold === null
                    ? "desactivada"
                    : `bajo ${economy.automation.policies.maintenanceRepairThreshold} % de condición`}{" "}
                  · caja objetivo {economy.automation.policies.financeCashFloor} u. · rutina
                  detectada {economy.automation.routineTaskCount} tarea(s).
                </p>
                <button
                  type="button"
                  disabled={!client}
                  onClick={() =>
                    void sendAction(
                      () =>
                        clientRef.current!.setAutomationPolicy({
                          property:
                            economy.automation.policies.property === "manual"
                              ? "fill_vacancies"
                              : "manual",
                        }),
                      "Gestor de propiedad actualizado.",
                    )
                  }
                >
                  {economy.automation.policies.property === "manual"
                    ? "Activar gestor de propiedad"
                    : "Desactivar gestor de propiedad"}
                </button>
                <button
                  type="button"
                  disabled={!client}
                  onClick={() =>
                    void sendAction(
                      () =>
                        clientRef.current!.setAutomationPolicy({
                          finance:
                            economy.automation.policies.finance === "manual"
                              ? "cover_shortfall"
                              : "manual",
                        }),
                      "Gestor financiero actualizado.",
                    )
                  }
                >
                  {economy.automation.policies.finance === "manual"
                    ? "Activar gestor financiero"
                    : "Desactivar gestor financiero"}
                </button>
                <button
                  type="button"
                  disabled={!client}
                  onClick={() =>
                    void sendAction(
                      () =>
                        clientRef.current!.setAutomationPolicy({
                          maintenanceRepairThreshold:
                            economy.automation.policies.maintenanceRepairThreshold === null
                              ? 40
                              : null,
                        }),
                      "Reparación automática actualizada.",
                    )
                  }
                >
                  {economy.automation.policies.maintenanceRepairThreshold === null
                    ? "Activar reparación bajo 40 %"
                    : "Desactivar reparación automática"}
                </button>
                <button type="button" disabled={!client} onClick={() => void runPortfolioRoutine()}>
                  Resolver rutina de cartera
                </button>
                <p>
                  <strong>Seguros:</strong>{" "}
                  {
                    economy.insurance.contracts.filter((contract) => contract.status === "active")
                      .length
                  }{" "}
                  póliza(s) activa(s) · primas{" "}
                  {economy.insurance.contracts
                    .filter((contract) => contract.status === "active")
                    .reduce((total, contract) => total + contract.premium, 0)}{" "}
                  u./mes · siniestros pagados{" "}
                  {economy.insurance.claims.filter((claim) => claim.status === "paid").length}
                </p>
                <p>
                  <strong>Crisis:</strong>{" "}
                  {economy.banking.auctions.filter((auction) => auction.status === "open").length}{" "}
                  subasta(s) abierta(s) · la caja sólo se carga al adjudicar.
                </p>
              </div>
            </details>
          )}
          {economy && (
            <details className="side-panel" open={economy.alerts.length > 0}>
              <summary>Excepciones y alertas ({economy.alerts.length})</summary>
              <ol className="diagnostic-log">
                {economy.alerts.length === 0 && <li>No hay excepciones prioritarias.</li>}
                {economy.alerts.map((alert) => (
                  <li key={alert.id}>
                    <strong>{alert.severity}</strong> · {alert.message}
                  </li>
                ))}
              </ol>
            </details>
          )}
          {economy && (
            <details className="side-panel">
              <summary>Comparador de cartera</summary>
              <div className="diagnostic-summary">
                {economy.buildings
                  .filter((building) => building.ownerOrganizationId === "org_00000001")
                  .map((building) => (
                    <p key={building.id}>
                      <strong>{building.id}</strong> · renta {building.effectiveRent} u. · condición{" "}
                      {building.condition}% · mantenimiento {building.maintenanceDue} u.
                    </p>
                  ))}
                {economy.banking.loans.map((loan) => (
                  <p key={loan.id}>
                    <strong>{loan.id}</strong> · {loan.status} · deuda {loan.outstandingPrincipal}{" "}
                    u. · cuota {loan.monthlyPayment} u.
                  </p>
                ))}
                {economy.insurance.contracts
                  .filter((contract) => contract.status === "active")
                  .map((contract) => (
                    <p key={contract.buildingId}>
                      <strong>{contract.buildingId}</strong> · seguro {contract.coverage} · prima{" "}
                      {contract.premium} u. · límite {contract.coverageLimit} u.
                    </p>
                  ))}
                {economy.buildings.filter(
                  (building) => building.ownerOrganizationId === "org_00000001",
                ).length === 0 &&
                  economy.banking.loans.length === 0 &&
                  economy.insurance.contracts.length === 0 && (
                    <p>No hay activos ni contratos que comparar.</p>
                  )}
              </div>
            </details>
          )}
          {economy && (
            <details className="side-panel">
              <summary>Materiales y producción</summary>
              <div className="construction-options">
                {(["cement", "brick", "steel"] as const).map((resource) => (
                  <div className="production-row" key={`market-${resource}`}>
                    <p>
                      <strong>{resourceLabel(resource)}</strong> · mercado{" "}
                      {economy.market.prices[resource]} u./ud.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        void sendAction(
                          () => clientRef.current!.buyMaterials(resource, 2),
                          `Compradas 2 unidades de ${resourceLabel(resource)}.`,
                        )
                      }
                    >
                      Comprar 2
                    </button>
                  </div>
                ))}
                {economy.production.map((facility) => (
                  <div
                    className="production-row"
                    key={facility.buildingId ?? `legacy-${facility.output}`}
                  >
                    <p>
                      <strong>{resourceLabel(facility.output)}</strong> · mercado{" "}
                      {economy.market.prices[facility.output]} u./ud.
                    </p>
                    <p>
                      {facility.operational
                        ? `Ciclo ${facility.cycleProgress}/${facility.cycleLength} h · media ${facility.averageOutputAmount.toFixed(2)} · próximo +${facility.nextCycleOutputAmount} · coste ${facility.operatingCost} u.`
                        : "Instalación física inactiva"}{" "}
                      · base {facility.baseOutputAmount} · aptitud {facility.suitabilityPercent}% ·
                      condición {facility.conditionPercent}% · ampliación {facility.upgradePercent}%
                    </p>
                  </div>
                ))}
                {economy.production.length === 0 && <p>No hay fábricas físicas operativas.</p>}
              </div>
            </details>
          )}
          {economy && (
            <details className="side-panel">
              <summary>Financiación</summary>
              <div className="diagnostic-summary">
                <p>
                  Banco independiente · garantía: parcela propia · tipo anual{" "}
                  {(economy.banking.offers[0]?.annualInterestRateBps ?? 900) / 100}%.
                </p>
                {selectedParcel?.ownerOrganizationId === "org_00000001" &&
                  !selectedParcel.buildingId && (
                    <button
                      type="button"
                      onClick={() =>
                        void sendAction(
                          () => clientRef.current!.requestLoan(600, 12, selectedParcel.id),
                          "Solicitud de préstamo enviada.",
                        )
                      }
                    >
                      Solicitar 600 u. · 12 meses
                    </button>
                  )}
                {economy.banking.offers.map((offer) => (
                  <div className="production-row" key={offer.id}>
                    <p>
                      Oferta {offer.principal} u. · {offer.termMonths} meses ·{" "}
                      {offer.annualInterestRateBps / 100}% anual · garantía{" "}
                      {offer.collateralParcelId}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        void sendAction(
                          () => clientRef.current!.acceptLoanOffer(offer.id),
                          "Préstamo aceptado; la cuota se liquidará automáticamente.",
                        )
                      }
                    >
                      Aceptar oferta
                    </button>
                  </div>
                ))}
                {economy.banking.loans.map((loan) => (
                  <p key={loan.id}>
                    <strong>{loan.status}</strong> · deuda {loan.outstandingPrincipal} u. · cuota{" "}
                    {loan.monthlyPayment} u. · {loan.remainingMonths} meses restantes
                    {loan.missedPayments > 0 && ` · impagos: ${loan.missedPayments}`}
                  </p>
                ))}
                {economy.banking.offers.length === 0 && economy.banking.loans.length === 0 && (
                  <p>Selecciona una parcela propia para solicitar una oferta.</p>
                )}
              </div>
            </details>
          )}
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
                    {selectedParcel.disposition === "public"
                      ? "Suelo público"
                      : zoningLabel(selectedParcel.zoning)}{" "}
                    · {ownershipLabel(selectedParcel.ownerOrganizationId)}
                  </p>
                  <p className="selection-detail">
                    {selectedBuilding
                      ? `${buildingLabel(selectedBuilding.type)} · nivel ${selectedBuilding.level} · estado ${selectedBuilding.condition}%`
                      : selectedConstructionSite
                        ? `${buildingLabel(selectedConstructionSite.buildingType)} en obra · ${selectedConstructionSite.progress}/${selectedConstructionSite.workRequired}`
                        : selectedParcel.disposition === "public"
                          ? "Reserva municipal: no transferible"
                          : `Solar disponible · precio ${selectedParcel.marketValue} u.`}
                  </p>
                  <div className="selection-detail">
                    <strong>Aptitud productiva</strong>
                    <span>
                      Cemento {selectedParcel.productionSuitability.cement}% · ladrillo{" "}
                      {selectedParcel.productionSuitability.brick}% · acero{" "}
                      {selectedParcel.productionSuitability.steel}%
                    </span>
                  </div>
                  <p className="selection-detail">
                    <strong>Cargas estimadas:</strong> transmisión{" "}
                    {selectedParcel.estimatedTransferTax} u. · propiedad{" "}
                    {selectedParcel.estimatedMonthlyPropertyTax} u./mes
                  </p>
                  {selectedParcel.disposition === "marketable" ? (
                    <p className="selection-detail">
                      <strong>Valor del suelo:</strong> base {selectedParcel.baseLandValue} u. ·
                      mercado {selectedParcel.marketValue} u. · score{" "}
                      {selectedParcel.landValueBreakdown.score}
                      <br />
                      centralidad {selectedParcel.landValueBreakdown.roadCentrality} · comercio{" "}
                      {selectedParcel.landValueBreakdown.commercialAccess} · amenidades{" "}
                      {selectedParcel.landValueBreakdown.civicAmenities} · frente{" "}
                      {selectedParcel.landValueBreakdown.frontage} · código{" "}
                      {selectedParcel.landValueBreakdown.codePotential} · servicios{" "}
                      {selectedParcel.landValueBreakdown.services} · industria{" "}
                      {selectedParcel.landValueBreakdown.industrialExternality} · aislamiento{" "}
                      {selectedParcel.landValueBreakdown.isolation} · seed{" "}
                      {selectedParcel.landValueBreakdown.seedVariation}
                    </p>
                  ) : null}
                  <p className="selection-detail">
                    <strong>Regulación:</strong> riesgo conocido{" "}
                    {selectedParcel.regulatoryRiskPercent}% · usos{" "}
                    {selectedParcel.permittedBuildingTypes.map(buildingLabel).join(", ")}
                    {selectedParcel.permitStatus &&
                      ` · permiso ${selectedParcel.permitStatus}${selectedParcel.permitExpiresAtTick !== null ? ` hasta tick ${selectedParcel.permitExpiresAtTick}` : ""}`}
                  </p>
                  {selectedBuilding && (
                    <p className="selection-detail">
                      <strong>Mantenimiento:</strong> {selectedBuilding.maintenanceCost} u./mes ·
                      debido {selectedBuilding.maintenanceDue} u.
                    </p>
                  )}
                  {selectedOwnedBuilding && selectedInsuranceContract?.status === "active" && (
                    <div className="construction-options">
                      <p className="selection-detail">
                        <strong>Seguro:</strong> {selectedInsuranceContract.coverage} · prima{" "}
                        {selectedInsuranceContract.premium} u./mes · límite{" "}
                        {selectedInsuranceContract.coverageLimit} u. · siguiente cobro en tick{" "}
                        {selectedInsuranceContract.nextPremiumTick}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          void sendAction(
                            () => clientRef.current!.cancelInsurance(selectedOwnedBuilding.id),
                            "Póliza cancelada; no se devolverá la prima ya pagada.",
                          )
                        }
                      >
                        Cancelar seguro
                      </button>
                    </div>
                  )}
                  {selectedOwnedBuilding &&
                    !selectedInsuranceContract &&
                    selectedInsuranceOffers.length > 0 && (
                      <div className="construction-options">
                        <p className="selection-detail">
                          <strong>Coberturas comparables:</strong> elige una para proteger este
                          activo.
                        </p>
                        {selectedInsuranceOffers.map((offer) => (
                          <button
                            key={offer.coverage}
                            type="button"
                            disabled={!client || (economy?.cash ?? 0) < offer.premium}
                            onClick={() =>
                              void sendAction(
                                () =>
                                  clientRef.current!.buyInsurance(offer.buildingId, offer.coverage),
                                `Contratada cobertura ${offer.coverage}; prima inicial ${offer.premium} u.`,
                              )
                            }
                          >
                            {offer.coverage} · {offer.premium} u./mes · límite {offer.coverageLimit}{" "}
                            u.
                          </button>
                        ))}
                      </div>
                    )}
                  {selectedAuction?.status === "open" && (
                    <div className="construction-options">
                      <p className="selection-detail">
                        <strong>Subasta:</strong> reserva {selectedAuction.reservePrice} u. · puja
                        actual {selectedAuction.highestBid} u. · cierre tick{" "}
                        {selectedAuction.closesAtTick}
                      </p>
                      {selectedAuction.sellerOrganizationId === "org_00000001" ? (
                        <button
                          type="button"
                          onClick={() =>
                            void sendAction(
                              () =>
                                clientRef.current!.requestRefinancing(selectedAuction.loanId, 12),
                              "Solicitud de refinanciación aceptada; la subasta se retira.",
                            )
                          }
                        >
                          Refinanciar a 12 meses
                        </button>
                      ) : selectedAuction.highestBidderOrganizationId === "org_00000001" ? (
                        <button
                          type="button"
                          onClick={() =>
                            void sendAction(
                              () => clientRef.current!.withdrawAuctionBid(selectedAuction.loanId),
                              "Puja retirada; la caja vuelve a quedar disponible.",
                            )
                          }
                        >
                          Retirar puja
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={
                            !client ||
                            (economy?.cash ?? 0) <
                              Math.max(selectedAuction.reservePrice, selectedAuction.highestBid + 1)
                          }
                          onClick={() =>
                            void sendAction(
                              () =>
                                clientRef.current!.placeAuctionBid(
                                  selectedAuction.loanId,
                                  Math.max(
                                    selectedAuction.reservePrice,
                                    selectedAuction.highestBid + 1,
                                  ),
                                ),
                              "Puja reservada; la caja sólo se cargará si se adjudica.",
                            )
                          }
                        >
                          Pujar{" "}
                          {Math.max(selectedAuction.reservePrice, selectedAuction.highestBid + 1)}{" "}
                          u.
                        </button>
                      )}
                    </div>
                  )}
                  {selectedOwnedSite && (
                    <div className="construction-options">
                      <p>
                        Progreso{" "}
                        {Math.floor(
                          (selectedOwnedSite.progress / selectedOwnedSite.workRequired) * 100,
                        )}
                        % · {selectedOwnedSite.assignedCrewIds.length} cuadrilla(s) asignada(s).
                      </p>
                      {economy!.crews.map((crew) => (
                        <button
                          key={crew.id}
                          type="button"
                          disabled={selectedOwnedSite.assignedCrewIds.includes(crew.id)}
                          onClick={() =>
                            void sendAction(
                              () => clientRef.current!.assignCrew(crew.id, selectedOwnedSite.id),
                              "Crew enviada a la obra; sus agentes se desplazarán a la celda de interacción.",
                            )
                          }
                        >
                          {crew.id} · {crew.assignedWorkOrderId ? "ocupada" : "libre"}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          void sendAction(
                            () => clientRef.current!.cancelConstruction(selectedOwnedSite.id),
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
                            (economy?.crews.filter((crew) => !crew.assignedWorkOrderId).length ??
                              0) === 0;
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
                                {option.cost} u.
                                {option.cost !== option.baseCost
                                  ? ` (base ${option.baseCost})`
                                  : ""}{" "}
                                · {option.workRequired} h
                                {!option.production &&
                                  ` · ${option.capacity} unidades · renta ${option.baseRent} u.`}
                              </span>
                              {option.production && (
                                <span>
                                  Producción base de {resourceLabel(option.production.output)}: +
                                  {option.production.outputAmount} cada{" "}
                                  {option.production.cycleLength} h · coste{" "}
                                  {option.production.operatingCost} u.
                                </span>
                              )}
                              <span>Requiere: {resourceSummary(option.resources)}.</span>
                              {missing.length > 0 && <span>Faltan: {missing.join(", ")}.</span>}
                              {(economy?.cash ?? 0) < option.cost && <span>Falta caja.</span>}
                              {crewUnavailable && <span>La cuadrilla está ocupada.</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  {selectedOwnedBuilding && (
                    <div className="construction-options">
                      <p className="eyebrow">
                        {selectedIsProductionBuilding
                          ? "Operación de la fábrica"
                          : "Explotación del activo"}
                      </p>
                      {!selectedIsProductionBuilding && (
                        <>
                          <p>
                            Renta efectiva: {selectedOwnedBuilding.effectiveRent} u. por unidad y
                            mes.
                          </p>
                          <p>
                            Ocupación: {selectedOwnedBuilding.tenantIds.length}/
                            {selectedOwnedBuilding.capacity} unidades.
                          </p>
                          {selectedOwnedBuilding.tenantIds.map((tenantId) => {
                            const tenant = economy?.tenants.find((entry) => entry.id === tenantId);
                            return tenant ? (
                              <p key={tenantId}>
                                {tenantProfileLabel(tenant.profile)} · satisfacción{" "}
                                {tenant.satisfaction}% · contrato {tenant.leaseRemaining} meses
                              </p>
                            ) : null;
                          })}
                          {selectedOwnedBuilding.tenantIds.length <
                            selectedOwnedBuilding.capacity && compatibleTenants.length > 0 ? (
                            compatibleTenants.map((tenant) => (
                              <button
                                key={tenant.id}
                                type="button"
                                disabled={tenant.budget < selectedOwnedBuilding.effectiveRent}
                                onClick={() =>
                                  void sendAction(
                                    () =>
                                      clientRef.current!.assignTenant(
                                        selectedOwnedBuilding.id,
                                        tenant.id,
                                      ),
                                    "Inquilino asignado; la renta se liquidará cada mes.",
                                  )
                                }
                              >
                                {tenant.budget < selectedOwnedBuilding.effectiveRent
                                  ? "No compatible por presupuesto: "
                                  : "Ocupar con "}
                                {tenantProfileLabel(tenant.profile)} · presupuesto {tenant.budget}{" "}
                                u.
                              </button>
                            ))
                          ) : (
                            <p>No hay inquilinos compatibles disponibles.</p>
                          )}
                        </>
                      )}
                      {selectedIsProductionBuilding && selectedPhysicalFacility && (
                        <p>
                          Producción media:{" "}
                          {selectedPhysicalFacility.averageOutputAmount.toFixed(2)}{" "}
                          {resourceLabel(selectedPhysicalFacility.output)} por ciclo · próximo ciclo
                          +{selectedPhysicalFacility.nextCycleOutputAmount} · aptitud{" "}
                          {selectedPhysicalFacility.suitabilityPercent}% · condición{" "}
                          {selectedPhysicalFacility.conditionPercent}% · ampliación{" "}
                          {selectedPhysicalFacility.upgradePercent}%
                        </p>
                      )}
                      {!selectedOwnedBuilding.upgraded && selectedBuildingOption && (
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
                              () => clientRef.current!.upgradeBuilding(selectedOwnedBuilding.id),
                              selectedIsProductionBuilding
                                ? "Ampliación iniciada; aumentará la capacidad productiva al terminar."
                                : "Mejora iniciada; aumentará la renta cuando termine.",
                            )
                          }
                        >
                          {selectedIsProductionBuilding ? "Ampliar fábrica" : "Mejorar"}:{" "}
                          {selectedBuildingOption.upgradeCost} u. ·{" "}
                          {selectedBuildingOption.upgradeWorkRequired} h ·{" "}
                          {selectedIsProductionBuilding
                            ? "producción +25%"
                            : `renta +${selectedBuildingOption.upgradeRentBonusPercent}%`}
                        </button>
                      )}
                      {selectedOwnedBuilding.upgraded && (
                        <p>
                          {selectedIsProductionBuilding
                            ? "Ampliación completada · capacidad productiva mejorada."
                            : "Mejora completada · renta bonificada."}
                        </p>
                      )}
                      {selectedOwnedBuilding.state === "ruin" && (
                        <button
                          type="button"
                          onClick={() =>
                            void sendAction(
                              () => clientRef.current!.clearRuin(selectedOwnedBuilding.id),
                              "Despeje de ruina iniciado; la parcela se liberará al completarse.",
                            )
                          }
                        >
                          Despejar ruina
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={
                          selectedOwnedBuilding.condition >= 100 ||
                          economy!.crew.used >= economy!.crew.capacity ||
                          economy!.cash < economy!.maintenance.repairCost
                        }
                        onClick={() =>
                          void sendAction(
                            () => clientRef.current!.repairBuilding(selectedOwnedBuilding.id),
                            "Reparación iniciada; restaurará la condición al terminar.",
                          )
                        }
                      >
                        Reparar: {economy!.maintenance.repairCost} u. ·{" "}
                        {economy!.maintenance.repairWorkRequired} h
                      </button>
                      <button
                        type="button"
                        disabled={selectedOwnedBuilding.state === "ruin"}
                        onClick={() =>
                          void sendAction(
                            () => clientRef.current!.assignMaintenance(selectedOwnedBuilding.id),
                            "Técnico enviado a la celda de interacción.",
                          )
                        }
                      >
                        Enviar técnico
                      </button>
                    </div>
                  )}
                  {selectedBuilding && !selectedOwnedBuilding && (
                    <>
                      <p className="empty-state">
                        Edificio rival visible · estado {selectedBuilding.state} · integridad{" "}
                        {selectedBuilding.structuralIntegrity}%.
                      </p>
                      <button
                        type="button"
                        disabled={
                          !projection?.agents.some(
                            (agent) =>
                              agent.organizationId === "org_00000001" &&
                              agent.specialty === "enforcer" &&
                              agent.state === "idle",
                          )
                        }
                        onClick={() => {
                          const enforcer = projection?.agents.find(
                            (agent) =>
                              agent.organizationId === "org_00000001" &&
                              agent.specialty === "enforcer",
                          );
                          if (enforcer)
                            void sendAction(
                              () =>
                                clientRef.current!.orderEnforcerSabotage(
                                  enforcer.id,
                                  selectedBuilding.id,
                                ),
                              "Enforcer enviado; el sabotaje resolverá fuego, detección y heat al alcanzar el objetivo.",
                            );
                        }}
                      >
                        Ordenar sabotaje físico
                      </button>
                    </>
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
                disabled={
                  !client ||
                  economy?.ordinance.status !== "proposed" ||
                  (economy?.influence ?? 0) < 1
                }
                onClick={() =>
                  economy &&
                  void sendAction(
                    () =>
                      clientRef.current!.lobbyPolicy(
                        economy.ordinance.id,
                        Math.min(2, economy.influence),
                      ),
                    "La propuesta fue resuelta; revisa su estado.",
                  )
                }
              >
                Promover ordenanza
              </button>
              {economy?.policyOptions
                .filter((option) => option.id !== economy.ordinance.id)
                .map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    disabled={!client || ["active", "proposed"].includes(economy.ordinance.status)}
                    onClick={() =>
                      void sendAction(
                        () => clientRef.current!.proposePolicy(option.id),
                        `Propuesta municipal seleccionada: ${option.name}.`,
                      )
                    }
                  >
                    Proponer {option.name}
                  </button>
                ))}
              <button
                type="button"
                disabled={!client || economy?.ordinance.status !== "proposed"}
                onClick={() =>
                  economy &&
                  void sendAction(
                    () => clientRef.current!.withdrawPolicy(economy.ordinance.id),
                    "La propuesta municipal ha sido retirada.",
                  )
                }
              >
                Retirar propuesta actual
              </button>
              <p className="empty-state">
                Riesgo táctico: selecciona un edificio rival y ordena el sabotaje con un enforcer.
              </p>
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
                <ul>
                  {economy.policyOptions.map((option) => (
                    <li key={option.id}>
                      {option.name}: materiales {option.materialCostModifierPercent}% · renta{" "}
                      {option.rentModifierPercent}% · propiedad {option.propertyTaxModifierPercent}%
                      · permisos {option.permitApprovalModifierPercent}% · influencia{" "}
                      {option.influenceRequired}.
                    </li>
                  ))}
                </ul>
                <p>
                  <strong>Heat:</strong> {economy.heat} · presión policial {economy.policePressure}
                </p>
                <p>
                  <strong>Ruta ilegal:</strong> +{economy.illegalRoute.benefitOnSuccess} u. si sale
                  bien; detección estimada {economy.illegalRoute.detectionChancePercent}% y +
                  {economy.illegalRoute.heatOnAttempt} heat en cada intento. Si te detectan: multa
                  de hasta {economy.illegalRoute.fineOnDetection} u.
                  {economy.illegalRoute.cooldownRemainingTicks > 0 &&
                    ` Disponible de nuevo en ${Math.ceil(economy.illegalRoute.cooldownRemainingTicks / 1200)} días.`}
                </p>
                <p>
                  <strong>Activos:</strong>{" "}
                  {
                    economy.buildings.filter(
                      (building) => building.ownerOrganizationId === "org_00000001",
                    ).length
                  }{" "}
                  edificios ·{" "}
                  {
                    economy.constructionSites.filter(
                      (site) => site.ownerOrganizationId === "org_00000001",
                    ).length
                  }{" "}
                  obras activas
                </p>
                <ul>
                  {economy.urbanServices.map((service) => (
                    <li key={service.id}>
                      Servicio {service.id}: calidad {service.qualityPercent}% · radio{" "}
                      {service.radiusCells} celdas · {service.buildingsCovered} bajo cobertura ·{" "}
                      cobertura media {service.meanCoveragePercent}%
                    </li>
                  ))}
                </ul>
                <p>
                  <strong>Municipio:</strong> reservas {economy.municipal.reserve} u. · ingresos del
                  mes {economy.municipal.revenueThisMonthBySource.propertyTax ?? 0} propiedad +{" "}
                  {economy.municipal.revenueThisMonthBySource.transferTax ?? 0} transferencia · tasa
                  de servicios {economy.municipal.serviceFeeDueNextSettlement} u. previstas para el
                  próximo cierre ({economy.municipal.revenueTotalBySource.serviceFee ?? 0} u.
                  cobradas en total) · gasto planificado{" "}
                  {municipalPlannedTotal(economy.municipal.plannedByCategory)} u. · administración{" "}
                  {economy.municipal.serviceLevelPercentByCategory.administration ?? 100}% ·
                  seguridad {economy.municipal.serviceLevelPercentByCategory.security ?? 100}% ·
                  transporte {economy.municipal.serviceLevelPercentByCategory.transport ?? 100}% ·
                  limpieza {economy.municipal.serviceLevelPercentByCategory.cleaning ?? 100}% ·
                  meses en déficit {economy.municipal.deficitMonths}
                </p>
                <p>
                  <strong>Empleo:</strong> {economy.employment.jobs} puestos ·{" "}
                  {economy.employment.workers} trabajadores · paro{" "}
                  {100 - economy.employment.employmentRatePercent}% · salario índice{" "}
                  {economy.employment.salaryIndexPercent}% · ingreso hogares{" "}
                  {economy.employment.incomeIndexPercentBySegment.household ?? 100}%
                </p>
                <p>
                  <strong>Mercado de vivienda:</strong> índice de renta patio{" "}
                  {economy.housingMarket.rentIndexPercentByBuildingType.courtyard_home ?? 100}% ·
                  taller {economy.housingMarket.rentIndexPercentByBuildingType.workshop ?? 100}% ·
                  vacancia patio{" "}
                  {economy.housingMarket.vacancyPercentByBuildingType.courtyard_home ?? 0}% · taller{" "}
                  {economy.housingMarket.vacancyPercentByBuildingType.workshop ?? 0}% ·{" "}
                  {economy.housingMarket.arrivalsTotal} llegadas y{" "}
                  {economy.housingMarket.departuresTotal} salidas acumuladas.
                </p>
                <ul>
                  {economy.housingMarket.segments.map((segment) => (
                    <li key={segment.id}>
                      {segment.label}: {segment.population}/{segment.populationCap} hogares ·
                      atractivo {segment.appealPercent}% · {segment.vacantSlots} plazas vacantes (
                      {segment.affordableVacantSlots} asequibles)
                    </li>
                  ))}
                </ul>
                <p>
                  <strong>Clima económico:</strong>{" "}
                  {economy.macroEvents.active.length === 0
                    ? `sin macroeventos activos · próximo sorteo en el tick ${economy.macroEvents.nextCheckTick}`
                    : economy.macroEvents.active
                        .map(
                          (event) =>
                            `${event.label} (intensidad ${Math.round(event.intensity * 100)} % · hasta el tick ${event.endTick})`,
                        )
                        .join(" · ")}
                  {economy.macroEvents.active.length > 0 &&
                  Object.keys(economy.macroEvents.aggregatedModifiers).length > 0
                    ? ` · efectos: ${macroModifierSummary(economy.macroEvents.aggregatedModifiers)}`
                    : ""}
                </p>
                <p>
                  <strong>Contratos públicos:</strong> {economy.publicContracts.open.length} en
                  curso · {economy.publicContracts.reliability.completed} completados ·{" "}
                  {economy.publicContracts.reliability.defaulted} incumplidos ·{" "}
                  {economy.publicContracts.reliability.awarded} adjudicados al jugador.
                </p>
                <div className="construction-options">
                  {economy.publicContracts.open.map((contract) => (
                    <ContractBidForm
                      cash={economy.cash}
                      contract={contract}
                      disabled={!client || contract.status !== "open"}
                      key={contract.id}
                      onSubmit={(amount) =>
                        void sendAction(
                          () => clientRef.current!.submitPublicBid(contract.id, amount),
                          "Oferta presentada; la fianza sólo se cobra al adjudicar.",
                        )
                      }
                    />
                  ))}
                  {economy.publicContracts.open.length === 0 && (
                    <p className="empty-state">No hay licitaciones abiertas este mes.</p>
                  )}
                </div>
                <p>
                  <strong>Reputación:</strong> vecinos{" "}
                  {economy.reputation.standingByGroup.residents} · gobierno{" "}
                  {economy.reputation.standingByGroup.municipality} · banca{" "}
                  {economy.reputation.standingByGroup.banks}. La banca aplica{" "}
                  {economy.reputation.bankRateModifierBps} puntos básicos al préstamo, los
                  residentes valoran tu parque al {economy.reputation.residentFactorPercent} % y el
                  gobierno te deja {economy.reputation.influenceGainPerMonth} de influencia al mes.
                </p>
                <ul>
                  {economy.reputation.facts.map((fact) => (
                    <li key={fact.id}>
                      {fact.kind}
                      {fact.magnitude > 1 ? ` ×${fact.magnitude}` : ""} en el tick {fact.atTick}.
                    </li>
                  ))}
                </ul>
                <p>
                  <strong>Inteligencia:</strong> encargar una cifra cuesta{" "}
                  {economy.intelligence.commissionCost} u. y deja el canal{" "}
                  {economy.intelligence.cooldownRemainingTicks} ticks enfriado. El mercado re-basa
                  solo lo que lleva {economy.intelligence.staleAfterMonths} meses sin refrescarse.
                </p>
                <div className="construction-options">
                  {economy.intelligence.kinds.map((entry) => (
                    <button
                      key={entry.kind}
                      type="button"
                      disabled={
                        !client ||
                        economy.intelligence.cooldownRemainingTicks > 0 ||
                        economy.cash < economy.intelligence.commissionCost
                      }
                      onClick={() =>
                        void sendAction(
                          () =>
                            clientRef.current!.commissionIntelligence("org_00000002", entry.kind),
                          `Encargo de ${entry.label} enviado; la estimación llega con error conocido.`,
                        )
                      }
                    >
                      Investigar {entry.label} · {economy.intelligence.commissionCost} u.
                    </button>
                  ))}
                </div>
                <ul>
                  {economy.intelligence.estimates.length === 0 ? (
                    <li>El expediente está vacío: no has pagado por saber nada del rival.</li>
                  ) : (
                    economy.intelligence.estimates.map((estimate) => (
                      <li key={estimate.id}>
                        {estimate.subjectOrganizationId}: {estimate.label} estimada {estimate.value}{" "}
                        u. por {estimate.source === "contacts" ? "contacto" : "mercado"} con{" "}
                        {estimate.effectiveAccuracyPercent}% de acierto ({estimate.ageMonths} meses
                        de antigüedad).
                      </li>
                    ))
                  )}
                </ul>
                <p>
                  <strong>Rival:</strong> {economy.rival.parcels} parcelas ·{" "}
                  {economy.rival.buildings} edificios · {economy.rival.occupiedBuildings} ocupados.
                  Caja, contratos e intención no son observables; el expediente de inteligencia es
                  la única vía para estimarlos.
                </p>
              </div>
            </section>
          )}
          {economy && (
            <details className="side-panel">
              <summary>Concejo municipal</summary>
              <div className="diagnostic-summary">
                <p>
                  <strong>Gobierna:</strong> {economy.politics.governingPartyName} · participación{" "}
                  {economy.politics.lastTurnoutPercent}% · {economy.politics.electionsHeld}{" "}
                  elección(es) celebrada(s).
                </p>
                <p>
                  <strong>Calendario:</strong> próxima elección en el tick{" "}
                  {economy.politics.nextElectionTick}
                  {economy.politics.nextDebateTick !== null
                    ? ` · próximo debate en el tick ${economy.politics.nextDebateTick}`
                    : " · sin debate programado"}
                  .
                </p>
                <ul>
                  {economy.politics.parties.map((party) => (
                    <li key={party.id}>
                      {party.name}: {party.seats} escaños · {party.supportPercent}% de apoyo.
                    </li>
                  ))}
                </ul>
                <p>
                  <strong>Ánimo del distrito:</strong> vivienda{" "}
                  {economy.politics.moodByIssue.housing} · empleo{" "}
                  {economy.politics.moodByIssue.employment} · seguridad{" "}
                  {economy.politics.moodByIssue.safety} · servicios{" "}
                  {economy.politics.moodByIssue.services} · impuestos{" "}
                  {economy.politics.moodByIssue.taxes}.
                </p>
              </div>
            </details>
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

type ProjectedContract = NonNullable<
  NonNullable<ViewProjectionV2["economy"]>["publicContracts"]
>["open"][number];

function ContractBidForm({
  contract,
  cash,
  disabled,
  onSubmit,
}: {
  contract: ProjectedContract;
  cash: number;
  disabled: boolean;
  onSubmit: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(String(Math.ceil((contract.budget * 92) / 100)));
  const parsed = Number(amount);
  const valid = Number.isSafeInteger(parsed) && parsed > 0 && parsed <= contract.budget;
  return (
    <div className="production-row">
      <p>
        <strong>{contract.title}</strong> · presupuesto {contract.budget} u. · fianza{" "}
        {contract.bond} u. · {contract.bidCount} oferta(s)
        {contract.playerBid !== null ? ` · tu oferta ${contract.playerBid} u.` : ""}
        {contract.status === "awarded" && contract.awardedToOrganizationId
          ? ` · adjudicado por ${contract.awardedAmount ?? 0} u.`
          : ""}
      </p>
      {contract.status === "open" && contract.playerBid === null && (
        <>
          <label className="selection-detail">
            <span>Importe de la oferta</span>
            <input
              type="number"
              min={1}
              max={contract.budget}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={disabled || !valid || cash < contract.bond}
            onClick={() => onSubmit(parsed)}
          >
            Presentar oferta · {valid ? parsed : "—"} u.
          </button>
          {!valid && <p>La oferta debe ser un entero entre 1 y {contract.budget} u.</p>}
          {cash < contract.bond && <p>La caja no cubre la fianza de {contract.bond} u.</p>}
        </>
      )}
    </div>
  );
}

function municipalPlannedTotal(planned: Record<string, number>): number {
  return (
    (planned.administration ?? 0) +
    (planned.security ?? 0) +
    (planned.transport ?? 0) +
    (planned.cleaning ?? 0)
  );
}

const MACRO_MODIFIER_LABELS: Record<string, string> = {
  materialCostModifierPercent: "materiales",
  rentModifierPercent: "rentas",
  vacancyModifierPercent: "presión de vacancia",
  constructionCostModifierPercent: "esfuerzo de obra",
  laborCostModifierPercent: "coste laboral",
  demandModifierPercent: "demanda de vivienda",
};

function macroModifierSummary(modifiers: Record<string, number | undefined>): string {
  return Object.entries(modifiers)
    .filter((entry): entry is [string, number] => entry[1] !== undefined)
    .map(
      ([key, value]) =>
        `${MACRO_MODIFIER_LABELS[key] ?? key} ${value >= 0 ? "+" : "−"}${Math.abs(value)} %`,
    )
    .join(", ");
}

function IsometricCanvas({
  projection,
  overlay,
  onCellPicked,
}: {
  projection: ViewProjectionV2 | null;
  overlay: MapOverlay;
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

  useEffect(() => {
    if (game.current) updateIsometricOverlay(game.current, overlay);
  }, [overlay]);

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
  return (
    {
      courtyard_home: "Patio residencial",
      workshop: "Taller",
      cement_plant: "Planta de cemento",
      brickworks: "Ladrillera",
      steelworks: "Acería",
    }[type] ?? type
  );
}

function facilityLabel(kind: string): string {
  return (
    {
      town_hall: "Ayuntamiento",
      school: "Escuela",
      clinic: "Clínica",
      police_station: "Comisaría",
      fire_station: "Parque de bomberos",
      market: "Mercado",
    }[kind] ?? kind
  );
}

function publicSpaceLabel(kind: string): string {
  return (
    {
      plaza: "Plaza",
      park: "Parque",
      pocket_park: "Pocket park",
      civic_courtyard: "Patio cívico",
      schoolyard: "Patio escolar",
    }[kind] ?? kind
  );
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
      materials_market: "compra de materiales",
      production_investment: "inversión productiva",
      production_operation: "coste de producción",
      building_repair: "reparación",
      intelligence_commission: "encargo de investigación",
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

function signedAmount(value: number): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value)} u.`;
}

function ordinanceStatusLabel(
  status: "proposed" | "approved" | "active" | "expired" | "rejected" | "withdrawn",
) {
  return {
    proposed: "propuesta disponible",
    approved: "aprobada",
    active: "activa",
    expired: "expirada",
    rejected: "rechazada",
    withdrawn: "retirada",
  }[status];
}

function ordinanceExplanation(
  ordinance: {
    status: "proposed" | "approved" | "active" | "expired" | "rejected" | "withdrawn";
    expiresAtTick: number | null;
    materialCostModifierPercent: number;
    rentModifierPercent: number;
    influenceRequired: number;
    approvalChancePercent: number;
    propertyTaxModifierPercent: number;
    permitApprovalModifierPercent: number;
  },
  tick: number,
): string {
  const effects = `Construcción ${ordinance.materialCostModifierPercent}% · renta ${ordinance.rentModifierPercent}% · propiedad ${ordinance.propertyTaxModifierPercent}% · permisos ${ordinance.permitApprovalModifierPercent}%.`;
  if (ordinance.status === "proposed")
    return `Apoyo base ${ordinance.approvalChancePercent}%; cada influencia adicional suma 15 puntos. ${effects}`;
  if (ordinance.status === "active")
    return `Está aplicada hasta el tick ${ordinance.expiresAtTick ?? tick}. ${effects}`;
  return `No puede promoverse en este momento. ${effects} Ya no se aplica.`;
}

function responseMessage(response: WorkerResponse, success: string): string {
  return response.type === "RequestFailed" ? response.payload.message : success;
}
