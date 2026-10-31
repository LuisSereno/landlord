import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import type { BuildingId, BuildingType, ViewProjectionV2 } from "@landlord/shared";

import {
  mountIsometricSpike,
  focusIsometricCell,
  setIsometricEntityPickedListener,
  setIsometricIndicatorListener,
  setIsometricSelection,
  updateIsometricOverlay,
  updateIsometricProjection,
  type MapOverlay,
} from "./isometric/mount";
import type { GridCell } from "./isometric/coordinates";
import { BenchmarkApp } from "./BenchmarkApp";
import { ArtLab } from "./ArtLab";
import { VisualSlice } from "./VisualSlice";
import { useGameSession } from "./session/use-game-session";
import { ContextPanel } from "./ui/panels";
import { HubPanel } from "./ui/hubs";
import {
  DebugPanel,
  GameHud,
  HelpMenu,
  NotificationCenter,
  OnboardingBanner,
  OverlayToolbar,
} from "./ui/game-hud";
import { deriveNotifications, type GameNotification } from "./ui/notifications";
import { deriveOnboardingStep, type OnboardingAction } from "./ui/onboarding";
import { resolveContextSelection } from "./ui/selection";
import type { GameActions, HubKind, ProjectedParcel } from "./ui/types";

const PLAYER = "org_00000001";

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
  const session = useGameSession();
  const { economy, projection, client } = session;
  const [selectedCell, setSelectedCell] = useState<GridCell | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<BuildingId | null>(null);
  const [overlay, setOverlay] = useState<MapOverlay>("ownership");
  const [hub, setHub] = useState<HubKind | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [readNotifications, setReadNotifications] = useState<ReadonlySet<string>>(new Set());
  const [dismissedOnboarding, setDismissedOnboarding] = useState<ReadonlySet<string>>(new Set());
  const mapRef = useRef<MapViewportHandle>(null);
  const debug = useMemo(() => new URLSearchParams(window.location.search).get("debug") === "1", []);

  const selectParcel = useCallback((parcel: ProjectedParcel) => {
    setSelectedCell({ ...parcel.cell });
    setSelectedBuildingId(null);
    setHub(null);
    mapRef.current?.focus(parcel.cell);
  }, []);

  const onCellPicked = useCallback((cell: GridCell) => {
    setSelectedCell(cell);
    setSelectedBuildingId(null);
    setHub(null);
  }, []);

  useEffect(() => {
    mapRef.current?.setSelection(selectedCell);
  }, [selectedCell]);

  /**
   * Hook observacional para el smoke de Playwright (mismo patrón que `__landlordCameraTest`):
   * sólo existe con `?cameraTest=1`, no participa en reglas ni en input, y sirve para localizar
   * una celda conocida sin barrer el mapa a ciegas.
   */
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("cameraTest") !== "1") return undefined;
    window.__landlordUiTest = {
      publicParcelCell: () =>
        economy?.parcels.find((parcel) => parcel.disposition === "public")?.cell ?? null,
      marketableParcelCell: () =>
        economy?.parcels.find(
          (parcel) => parcel.disposition === "marketable" && !parcel.ownerOrganizationId,
        )?.cell ?? null,
      ownedBuildingParcelCell: () => {
        const building = economy?.buildings.find(
          (entry) => entry.ownerOrganizationId === "org_00000001",
        );
        if (!building) return null;
        return (
          economy?.parcels.find((parcel) => parcel.id === building.parcelIds[0]!)?.cell ?? null
        );
      },
      marketableParcelCellForType: (buildingType: string) =>
        economy?.parcels.find(
          (parcel) =>
            parcel.disposition === "marketable" &&
            !parcel.ownerOrganizationId &&
            parcel.permittedBuildingTypes.includes(buildingType as never),
        )?.cell ?? null,
    };
    return () => {
      delete window.__landlordUiTest;
    };
  }, [economy]);

  /** Escape cierra en jerarquía: ayuda → notificaciones → debug → hub/panel. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (helpOpen) setHelpOpen(false);
      else if (notificationsOpen) setNotificationsOpen(false);
      else if (debugOpen) setDebugOpen(false);
      else if (hub) setHub(null);
      else if (selectedCell) setSelectedCell(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [debugOpen, helpOpen, hub, notificationsOpen, selectedCell]);

  /** Rutina de cartera (WP3.12): ocupa vacantes y asigna cuadrillas libres con comandos normales. */
  const runPortfolioRoutine = useCallback(async () => {
    if (!client || !economy) return;
    const occupied = new Set(
      economy.buildings
        .filter((building) => building.ownerOrganizationId === PLAYER)
        .flatMap((building) => building.tenantIds),
    );
    let completed = 0;
    for (const building of economy.buildings
      .filter(
        (entry) =>
          entry.ownerOrganizationId === PLAYER &&
          entry.state === "operational" &&
          entry.tenantIds.length < entry.capacity,
      )
      .sort((left, right) => left.id.localeCompare(right.id))) {
      const vacancies = building.capacity - building.tenantIds.length;
      const tenants = economy.tenants.filter(
        (tenant) =>
          !tenant.activeContractBuildingId &&
          !occupied.has(tenant.id) &&
          tenant.preferredBuildingType === building.type &&
          tenant.budget >= building.effectiveRent,
      );
      for (const tenant of tenants.slice(0, vacancies)) {
        const response = await client.assignTenant(building.id, tenant.id);
        if (response.type !== "RequestFailed") {
          occupied.add(tenant.id);
          completed += 1;
        }
      }
    }
    const freeCrews = economy.crews.filter((crew) => !crew.assignedWorkOrderId);
    for (const site of economy.constructionSites
      .filter((entry) => entry.ownerOrganizationId === PLAYER && entry.assignedCrewIds.length === 0)
      .sort((left, right) => left.id.localeCompare(right.id))) {
      const crew = freeCrews.shift();
      if (!crew) break;
      const response = await client.assignCrew(crew.id, site.id);
      if (response.type !== "RequestFailed") completed += 1;
    }
    session.setMessage(
      completed > 0
        ? `Rutina de cartera: ${completed} operación(es) ejecutada(s).`
        : "No hay excepciones rutinarias que resolver.",
    );
  }, [client, economy, session]);

  const actions = useMemo<GameActions>(() => {
    const run = (action: () => Promise<unknown>, success: string) =>
      void session.send(action as () => never, success);
    return {
      buyParcel: (parcelId) =>
        run(
          () => client!.buyParcel(parcelId),
          "Parcela comprada; el rival también busca oportunidades.",
        ),
      startConstruction: (parcelId, buildingType: BuildingType) =>
        run(
          () => client!.startConstruction([parcelId], buildingType),
          "Obra iniciada; asigna una cuadrilla para que avance.",
        ),
      cancelConstruction: (siteId) =>
        run(
          () => client!.cancelConstruction(siteId),
          "Obra cancelada; se recuperó la mitad de los materiales.",
        ),
      assignCrew: (crewId, siteId) =>
        run(() => client!.assignCrew(crewId, siteId), "Cuadrilla asignada a la obra."),
      assignTenant: (buildingId, tenantId) =>
        run(() => client!.assignTenant(buildingId, tenantId), "Inquilino asignado."),
      upgradeBuilding: (buildingId) =>
        run(() => client!.upgradeBuilding(buildingId), "Mejora iniciada."),
      repairBuilding: (buildingId) =>
        run(() => client!.repairBuilding(buildingId), "Reparación iniciada."),
      assignMaintenance: (buildingId) =>
        run(() => client!.assignMaintenance(buildingId), "Técnico enviado."),
      clearRuin: (buildingId) => run(() => client!.clearRuin(buildingId), "Desescombro iniciado."),
      buyMaterials: (resource, amount) =>
        run(
          () => client!.buyMaterials(resource, amount),
          `Compradas ${amount} unidades de material.`,
        ),
      requestLoan: (amount, termMonths, collateralParcelId) =>
        run(
          () => client!.requestLoan(amount, termMonths, collateralParcelId),
          "Préstamo solicitado.",
        ),
      acceptLoanOffer: (offerId) =>
        run(() => client!.acceptLoanOffer(offerId), "Préstamo aceptado."),
      requestRefinancing: (loanId, termMonths) =>
        run(() => client!.requestRefinancing(loanId, termMonths), "Refinanciación solicitada."),
      placeAuctionBid: (loanId, amount) =>
        run(() => client!.placeAuctionBid(loanId, amount), "Puja reservada."),
      withdrawAuctionBid: (loanId) =>
        run(() => client!.withdrawAuctionBid(loanId), "Puja retirada."),
      buyInsurance: (buildingId, coverage) =>
        run(() => client!.buyInsurance(buildingId, coverage), "Seguro contratado."),
      cancelInsurance: (buildingId) =>
        run(() => client!.cancelInsurance(buildingId), "Póliza cancelada."),
      setMaintenancePolicy: (policy) =>
        run(() => client!.setMaintenancePolicy(policy), "Política de mantenimiento actualizada."),
      setAutomationPolicy: (patch) =>
        run(() => client!.setAutomationPolicy(patch), "Automatización actualizada."),
      runPortfolioRoutine: () => void runPortfolioRoutine(),
      proposePolicy: (policyId) =>
        run(() => client!.proposePolicy(policyId), "Propuesta municipal registrada."),
      lobbyPolicy: (policyId, influence) =>
        run(() => client!.lobbyPolicy(policyId, influence), "Propuesta apoyada con influencia."),
      withdrawPolicy: (policyId) =>
        run(() => client!.withdrawPolicy(policyId), "Propuesta retirada."),
      submitPublicBid: (contractId, amount) =>
        run(() => client!.submitPublicBid(contractId, amount), "Oferta presentada."),
      commissionIntelligence: (organizationId, kind) =>
        run(
          () => client!.commissionIntelligence(organizationId, kind),
          "Encargo de inteligencia enviado.",
        ),
      orderEnforcerSabotage: (agentId, buildingId) =>
        run(() => client!.orderEnforcerSabotage(agentId, buildingId), "Enforcer enviado."),
      placeStructure: (cell) => void session.placeStructure(cell),
    };
  }, [client, runPortfolioRoutine, session]);

  const selection = useMemo(
    () =>
      economy && projection && selectedCell
        ? resolveContextSelection({
            economy,
            projection,
            cell: selectedCell,
            selectedBuildingId,
          })
        : null,
    [economy, projection, selectedCell, selectedBuildingId],
  );

  const notifications = useMemo(() => deriveNotifications(economy), [economy]);
  const unread = notifications.filter((entry) => !readNotifications.has(entry.id)).length;
  const onboarding = useMemo(() => deriveOnboardingStep(economy), [economy]);
  const showOnboarding = onboarding !== null && !dismissedOnboarding.has(onboarding.id);
  const districtName =
    projection?.city.districts.find((district) => district.id === projection.observedDistrictId)
      ?.name ?? "Distrito";

  const openHub = useCallback((next: HubKind) => {
    setHub(next);
    setHelpOpen(false);
    setNotificationsOpen(false);
  }, []);

  const navigateNotification = useCallback(
    (notification: GameNotification) => {
      setReadNotifications((current) => new Set(current).add(notification.id));
      const target = notification.target;
      if (target.kind === "hub") {
        openHub(target.hub);
        return;
      }
      if (target.kind === "parcel" && economy) {
        const parcel = economy.parcels.find((entry) => entry.id === target.parcelId);
        if (parcel) selectParcel(parcel);
      }
      setNotificationsOpen(false);
    },
    [economy, openHub, selectParcel],
  );

  const onOnboardingAction = useCallback(
    (action: OnboardingAction | null) => {
      if (!action || !economy) return;
      if (action === "open-finance") return openHub("finance");
      if (action === "open-government") return openHub("government");
      if (action === "buy-materials") {
        if (!onboarding) return;
        for (const entry of onboarding.missing) actions.buyMaterials(entry.resource, entry.amount);
        return;
      }
      const owned = economy.parcels.filter((parcel) => parcel.ownerOrganizationId === PLAYER);
      if (action === "show-parcel") {
        const target =
          economy.parcels.find(
            (parcel) => parcel.disposition === "marketable" && !parcel.ownerOrganizationId,
          ) ?? owned[0];
        if (target) selectParcel(target);
        return;
      }
      if (action === "open-build") {
        const target = owned.find((parcel) => parcel.buildingIds.length === 0) ?? owned[0];
        if (target) selectParcel(target);
        return;
      }
      if (action === "open-construction") {
        const site = economy.constructionSites.find(
          (entry) => entry.ownerOrganizationId === PLAYER,
        );
        const target = site
          ? economy.parcels.find((parcel) => parcel.id === site.parcelIds[0]!)
          : undefined;
        if (target) selectParcel(target);
      }
    },
    [actions, economy, onboarding, openHub, selectParcel],
  );

  const calendar = economy?.gameTime;
  const hubProps =
    economy && projection && calendar
      ? {
          economy,
          projection,
          calendar,
          actions,
          onClose: () => setHub(null),
          onOpenHub: openHub,
          onSelectDistrict: (districtId: string) => {
            void session.selectDistrict(districtId);
            setHub(null);
          },
        }
      : null;

  return (
    <main className={(hub ?? selection) ? "game-shell panel-open" : "game-shell"}>
      <GameHud
        debug={debug}
        districtName={districtName}
        helpOpen={helpOpen}
        notificationsOpen={notificationsOpen}
        onOpenCity={() => openHub("city")}
        onOpenHub={openHub}
        onToggleDebug={() => setDebugOpen((value) => !value)}
        onToggleHelp={() => {
          setHelpOpen((value) => !value);
          setNotificationsOpen(false);
        }}
        onToggleNotifications={() => {
          setNotificationsOpen((value) => !value);
          setHelpOpen(false);
        }}
        session={session}
        unread={unread}
      />
      <div className="game-body">
        <MapViewport
          onCellPicked={onCellPicked}
          onEntityPicked={(target) => {
            if (!economy) return;
            if (target.kind === "building") {
              const building = economy.buildings.find((entry) => entry.id === target.id);
              if (!building) return;
              const parcel = building
                ? economy.parcels.find((entry) => entry.id === building.parcelIds[0])
                : undefined;
              if (!parcel) return;
              setSelectedCell({ ...parcel.cell });
              setSelectedBuildingId(building.id);
            } else {
              const site = economy.constructionSites.find((entry) => entry.id === target.id);
              const parcel = site
                ? economy.parcels.find((entry) => entry.id === site.parcelIds[0])
                : undefined;
              if (!parcel) return;
              setSelectedCell({ ...parcel.cell });
              setSelectedBuildingId(null);
            }
            setHub(null);
          }}
          onIndicator={(target) => {
            const parcel = economy?.parcels.find((entry) => entry.id === target.parcelId);
            if (parcel) selectParcel(parcel);
            if (target.buildingId) setSelectedBuildingId(target.buildingId as BuildingId);
          }}
          overlay={overlay}
          projection={projection}
          ref={mapRef}
        />
        <OverlayToolbar onChange={setOverlay} overlay={overlay} />
        {showOnboarding && onboarding ? (
          <OnboardingBanner
            onAction={onOnboardingAction}
            onDismiss={() =>
              setDismissedOnboarding((current) => new Set(current).add(onboarding.id))
            }
            step={onboarding}
          />
        ) : null}
        {hub && hubProps ? <HubPanel hub={hub} {...hubProps} /> : null}
        {!hub && selection && hubProps ? (
          <ContextPanel
            context={{
              economy: hubProps.economy,
              projection: hubProps.projection,
              projectionDistrictName: districtName,
              calendar: hubProps.calendar,
              actions,
              onClose: () => setSelectedCell(null),
              onOpenHub: openHub,
              onSelectBuilding: (buildingId) => setSelectedBuildingId(buildingId as BuildingId),
            }}
            selection={selection}
          />
        ) : null}
        {notificationsOpen ? (
          <NotificationCenter
            notifications={notifications}
            onClose={() => setNotificationsOpen(false)}
            onMarkAllRead={() =>
              setReadNotifications(new Set(notifications.map((entry) => entry.id)))
            }
            onNavigate={navigateNotification}
            read={readNotifications}
          />
        ) : null}
        {helpOpen ? <HelpMenu onClose={() => setHelpOpen(false)} /> : null}
        {debugOpen && debug ? (
          <DebugPanel onClose={() => setDebugOpen(false)} session={session} />
        ) : null}
      </div>
    </main>
  );
}

export type MapViewportHandle = {
  focus: (cell: GridCell) => void;
  setSelection: (cell: GridCell | null) => void;
};

declare global {
  interface Window {
    __landlordUiTest?: {
      publicParcelCell: () => GridCell | null;
      marketableParcelCell: () => GridCell | null;
      ownedBuildingParcelCell: () => GridCell | null;
      marketableParcelCellForType: (buildingType: string) => GridCell | null;
    };
  }
}

const MapViewport = forwardRef<
  MapViewportHandle,
  {
    projection: ViewProjectionV2 | null;
    overlay: MapOverlay;
    onCellPicked: (cell: GridCell) => void;
    onEntityPicked: (target: { kind: "building" | "construction"; id: string }) => void;
    onIndicator: (target: { parcelId: string; buildingId?: string }) => void;
  }
>(function MapViewport({ projection, overlay, onCellPicked, onEntityPicked, onIndicator }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const game = useRef<ReturnType<typeof mountIsometricSpike> | null>(null);
  /**
   * El motor Phaser se monta UNA vez. Los callbacks viven en una ref: si el efecto dependiera de
   * ellos, cada render de React destruiría y recrearía el canvas (y con él el contexto WebGL).
   */
  const handlers = useRef({ onCellPicked, onEntityPicked, onIndicator });
  useEffect(() => {
    handlers.current = { onCellPicked, onEntityPicked, onIndicator };
  }, [onCellPicked, onEntityPicked, onIndicator]);

  useEffect(() => {
    if (!container.current) return undefined;
    const mounted = mountIsometricSpike(container.current, (cell) =>
      handlers.current.onCellPicked(cell),
    );
    game.current = mounted;
    setIsometricEntityPickedListener(mounted, (target) => handlers.current.onEntityPicked(target));
    setIsometricIndicatorListener(mounted, (target) => handlers.current.onIndicator(target));
    return () => {
      mounted.destroy(true);
      game.current = null;
    };
  }, []);

  useEffect(() => {
    if (game.current && projection) updateIsometricProjection(game.current, projection);
  }, [projection]);

  useEffect(() => {
    if (game.current) updateIsometricOverlay(game.current, overlay);
  }, [overlay]);

  useImperativeHandle(
    ref,
    () => ({
      focus: (cell) => {
        if (game.current) focusIsometricCell(game.current, cell);
      },
      setSelection: (cell) => {
        if (game.current) setIsometricSelection(game.current, cell);
      },
    }),
    [],
  );

  return <div className="map-canvas" ref={container} aria-label="Mapa isométrico del distrito" />;
});
