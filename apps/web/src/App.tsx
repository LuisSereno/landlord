import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import type { BuildingType, ViewProjectionV2 } from "@landlord/shared";

import {
  mountIsometricSpike,
  focusIsometricCell,
  setIsometricEntityPickedListener,
  setIsometricIndicatorListener,
  setIsometricPlacement,
  setIsometricPlacementCandidateListener,
  setIsometricSelectionTarget,
  updateIsometricOverlay,
  updateIsometricProjection,
  type MapSelectionTarget,
  type MapOverlay,
} from "./isometric/mount";
import type { GridCell } from "./isometric/coordinates";
import { BenchmarkApp } from "./BenchmarkApp";
import { ArtLab } from "./ArtLab";
import { VisualSlice } from "./VisualSlice";
import { VisualCatalog } from "./VisualCatalog";
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
import {
  resolveContextSelection,
  selectionTargetForCell,
  type SpatialSelection,
} from "./ui/selection";
import type { GameActions, HubKind, ProjectedParcel } from "./ui/types";
import { siteAssemblyCandidates, type PendingDevelopmentSite } from "./ui/site-assembly";
import { constructionBlockedReasons } from "./ui/disabled-reasons";
import {
  beginPlacementRequest,
  nextPlacementCandidate,
  placementAnswerReceived,
  placementConfirmIssues,
  placementRequestFailed,
  previousPlacementCandidate,
  rotatePlacementCandidate,
  selectPlacementCandidate,
  selectedCandidate,
  type PendingPlacement,
  type PlacementHandlers,
} from "./ui/placement";

const PLAYER = "org_00000001";

export function RootApp() {
  if (window.location.pathname === "/art-lab") return <ArtLab />;
  if (window.location.pathname === "/visual-slice") return <VisualSlice />;
  if (window.location.pathname === "/visual-catalog") return <VisualCatalog />;
  return new URLSearchParams(window.location.search).get("benchmark") === "gate1-reference-v1" ? (
    <BenchmarkApp />
  ) : (
    <App />
  );
}

export function App() {
  const session = useGameSession();
  const { economy, projection, client } = session;
  const [selectionTarget, setSelectionTarget] = useState<SpatialSelection | null>(null);
  const [pendingSite, setPendingSite] = useState<PendingDevelopmentSite | null>(null);
  // La vista normal es el punto de partida: las capas semánticas son una decisión explícita
  // del jugador y no deben convertir el mapa base en un plano catastral.
  const [overlay, setOverlay] = useState<MapOverlay>("none");
  /**
   * V.d-7C · colocación interactiva. Estado de React y nada más: las candidatas las enumera el motor
   * por petición de sólo lectura, y si el jugador cancela no se ha enviado ningún comando.
   */
  const [pendingPlacement, setPendingPlacement] = useState<PendingPlacement | null>(null);
  const placementRequestKey = useRef<string | null>(null);
  const placementConfirmedId = useRef<string | null>(null);
  const [hub, setHub] = useState<HubKind | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [readNotifications, setReadNotifications] = useState<ReadonlySet<string>>(new Set());
  const [dismissedOnboarding, setDismissedOnboarding] = useState<ReadonlySet<string>>(new Set());
  const mapRef = useRef<MapViewportHandle>(null);
  const debug = useMemo(() => new URLSearchParams(window.location.search).get("debug") === "1", []);

  const selectParcel = useCallback((parcel: ProjectedParcel) => {
    setSelectionTarget({ kind: "parcel", parcelId: parcel.id });
    setHub(null);
    mapRef.current?.focus(parcel.cell);
  }, []);

  const cancelPlacement = useCallback(() => {
    setPendingPlacement(null);
    placementRequestKey.current = null;
    placementConfirmedId.current = null;
  }, []);

  const beginPlacement = useCallback(
    (buildingType: BuildingType, parcelIds: readonly string[]) => {
      const districtId = economy?.district.id;
      if (!districtId) return;
      placementRequestKey.current = null;
      placementConfirmedId.current = null;
      setPendingPlacement(
        beginPlacementRequest({
          buildingType,
          districtId,
          parcelIds: [...parcelIds].sort((left, right) => left.localeCompare(right)),
        }),
      );
    },
    [economy],
  );

  /**
   * Las candidatas se piden cuando cambian los insumos autoritativos (parcela, tipo, conjunto), no
   * por frame ni por movimiento de puntero (§46). Una clave por solicitud evita reenumerar en cada
   * render y de paso impide el doble disparo de `StrictMode` en desarrollo.
   */
  useEffect(() => {
    if (!pendingPlacement || pendingPlacement.status !== "requesting" || !client) return;
    const key = `${pendingPlacement.districtId}|${pendingPlacement.parcelIds.join(",")}|${pendingPlacement.buildingType}`;
    if (placementRequestKey.current === key) return;
    placementRequestKey.current = key;
    const request = pendingPlacement;
    let discarded = false;
    void client
      .getDevelopmentPlacementCandidates({
        buildingType: request.buildingType,
        districtId: request.districtId,
        parcelIds: [...request.parcelIds],
      })
      .then((answer) => {
        if (discarded) return;
        setPendingPlacement((current) => {
          if (!current || current.status !== "requesting") return current;
          return answer
            ? placementAnswerReceived(current, answer)
            : placementRequestFailed(current);
        });
      });
    return () => {
      discarded = true;
    };
  }, [client, pendingPlacement]);

  /** El motor confirma la obra por la proyección: ahí se cierra el modo, no antes. */
  useEffect(() => {
    if (!pendingPlacement || !economy) return;
    const built = economy.constructionSites.some(
      (site) =>
        site.buildingType === pendingPlacement.buildingType &&
        site.parcelIds.length === pendingPlacement.parcelIds.length &&
        site.parcelIds.every((id) => pendingPlacement.parcelIds.includes(id)),
    );
    if (built) cancelPlacement();
  }, [cancelPlacement, economy, pendingPlacement]);

  /**
   * Razones que impiden confirmar sin impedir ver el mapa (§33): se leen de la proyección con el
   * mismo helper que ya usa el catálogo, así que no se reinventa ninguna regla económica.
   */
  const placementBlockers = useMemo<readonly string[]>(() => {
    if (!pendingPlacement || !economy) return [];
    const option = economy.constructionOptions.find(
      (entry) => entry.type === pendingPlacement.buildingType,
    );
    const parcel = economy.parcels.find((entry) => entry.id === pendingPlacement.parcelIds[0]);
    if (!option || !parcel) return [];
    return placementConfirmIssues(
      constructionBlockedReasons({
        option,
        economy,
        parcelOwned: parcel.ownerOrganizationId === PLAYER,
        hasBuilding: parcel.buildingIds.length > 0,
        permitted: parcel.permittedBuildingTypes.includes(option.type),
      }),
    );
  }, [economy, pendingPlacement]);

  const onCellPicked = useCallback(
    (cell: GridCell) => {
      if (economy && projection)
        setSelectionTarget(selectionTargetForCell({ economy, projection, cell }));
      setHub(null);
    },
    [economy, projection],
  );

  useEffect(() => {
    mapRef.current?.setPlacement(
      pendingPlacement && pendingPlacement.status === "placing"
        ? {
            buildingType: pendingPlacement.buildingType,
            parcelIds: pendingPlacement.parcelIds,
            candidates: pendingPlacement.candidates,
            selectedCandidateId: pendingPlacement.selectedCandidateId,
          }
        : null,
    );
  }, [pendingPlacement]);

  useEffect(() => {
    mapRef.current?.setSelection(
      pendingSite
        ? {
            kind: "site-assembly",
            parcelIds: pendingSite.parcelIds,
            candidateParcelIds: economy
              ? siteAssemblyCandidates(economy, pendingSite).map((parcel) => parcel.id)
              : [],
          }
        : selectionTarget,
    );
  }, [economy, pendingSite, selectionTarget]);

  /** Sólo se cierra el ensamblado cuando la proyección confirma que el comando creó la obra. */
  useEffect(() => {
    if (
      pendingSite &&
      economy?.constructionSites.some(
        (site) =>
          site.buildingType === pendingSite.buildingType &&
          site.parcelIds.length === pendingSite.parcelIds.length &&
          site.parcelIds.every((id) => pendingSite.parcelIds.includes(id)),
      )
    )
      setPendingSite(null);
  }, [economy, pendingSite]);

  /** Tras iniciar una obra directa, conserva el contexto espacial en la ficha de esa obra. */
  useEffect(() => {
    if (!economy || selectionTarget?.kind !== "parcel") return;
    const site = economy.constructionSites.find(
      (entry) =>
        entry.ownerOrganizationId === PLAYER &&
        entry.parcelIds.some((parcelId) => parcelId === selectionTarget.parcelId),
    );
    if (site) setSelectionTarget({ kind: "construction", siteId: site.id });
  }, [economy, selectionTarget]);

  /** Mantiene la ficha espacial al completar una obra: site → edificio construido. */
  useEffect(() => {
    if (!economy || selectionTarget?.kind !== "construction") return;
    const siteStillExists = economy.constructionSites.some(
      (site) => site.id === selectionTarget.siteId,
    );
    if (siteStillExists) return;
    const building = economy.buildings.find(
      (entry) =>
        entry.ownerOrganizationId === PLAYER &&
        entry.parcelIds.some((parcelId) =>
          economy.parcels.some((parcel) => parcel.id === parcelId),
        ),
    );
    if (building) setSelectionTarget({ kind: "building", buildingId: building.id });
  }, [economy, selectionTarget]);

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
      ownedBuildingId: () =>
        economy?.buildings.find((entry) => entry.ownerOrganizationId === "org_00000001")?.id ??
        null,
      marketableParcelCellForType: (buildingType: string) =>
        economy?.parcels.find(
          (parcel) =>
            parcel.disposition === "marketable" &&
            !parcel.ownerOrganizationId &&
            parcel.permittedBuildingTypes.includes(buildingType as never),
        )?.cell ?? null,
      largestMarketableParcel: () => {
        const parcel = [...(economy?.parcels ?? [])]
          .filter((entry) => entry.disposition === "marketable" && !entry.ownerOrganizationId)
          .sort((left, right) => right.cells.length - left.cells.length)[0];
        return parcel ? { cell: parcel.cell, cellCount: parcel.cells.length } : null;
      },
      facilityCell: (kind: string) => {
        const facility = projection?.facilities.find((entry) => entry.kind === kind);
        return facility
          ? (economy?.parcels.find((parcel) => parcel.id === facility.parcelIds[0])?.cell ?? null)
          : null;
      },
      pendingSite: () =>
        pendingSite && economy
          ? (() => {
              const selected = economy.parcels.filter((parcel) =>
                pendingSite.parcelIds.includes(parcel.id),
              );
              const anchor = economy.parcels.find(
                (parcel) => parcel.id === pendingSite.anchorParcelId,
              );
              const selectedCells = new Set(
                selected.flatMap((parcel) => parcel.cells.map((cell) => `${cell.x}:${cell.y}`)),
              );
              const adjacentAvailableCells = anchor
                ? economy.parcels
                    .filter(
                      (parcel) =>
                        !pendingSite.parcelIds.includes(parcel.id) &&
                        parcel.disposition === "marketable" &&
                        !parcel.ownerOrganizationId &&
                        parcel.developmentCodeId === anchor.developmentCodeId &&
                        parcel.permittedBuildingTypes.includes(pendingSite.buildingType as never) &&
                        parcel.cells.some((cell) =>
                          [
                            `${cell.x + 1}:${cell.y}`,
                            `${cell.x - 1}:${cell.y}`,
                            `${cell.x}:${cell.y + 1}`,
                            `${cell.x}:${cell.y - 1}`,
                          ].some((key) => selectedCells.has(key)),
                        ),
                    )
                    .map((parcel) => parcel.cell)
                : [];
              return {
                buildingType: pendingSite.buildingType,
                parcelCount: pendingSite.parcelIds.length,
                candidateCells: siteAssemblyCandidates(economy, pendingSite).map(
                  (parcel) => parcel.cell,
                ),
                adjacentAvailableCells,
              };
            })()
          : null,
      constructionStatus: () =>
        economy?.constructionSites.map((site) => ({
          id: site.id,
          kind: site.kind,
          progress: site.progress,
          workRequired: site.workRequired,
          assignedCrewCount: site.assignedCrewIds.length,
          crewCapacity: site.crewCapacity,
        })) ?? [],
      /** Sondas observacionales de V.d-7C: leen la proyección, no deciden nada por el jugador. */
      cash: () => economy?.cash ?? null,
      constructionSiteCount: () =>
        economy?.constructionSites.filter((site) => site.ownerOrganizationId === PLAYER).length ??
        0,
      /** Huella real de la obra en curso: es lo que debe coincidir con el fantasma confirmado. */
      ownedSiteFootprint: () => {
        const site = economy?.constructionSites.find(
          (entry) => entry.ownerOrganizationId === PLAYER,
        );
        if (!site) return null;
        return {
          buildingType: site.buildingType,
          parcelIds: [...site.parcelIds].sort(),
          orientation: site.orientation,
          signature: [...site.footprintCells]
            .map((cell) => `${cell.x},${cell.y}`)
            .sort()
            .join("|"),
        };
      },
      /** Progreso de la obra propia: permite capturar cada etapa visible sin acelerar trampas. */
      ownedSiteProgress: () => {
        const site = economy?.constructionSites.find(
          (entry) => entry.ownerOrganizationId === PLAYER,
        );
        if (!site) return null;
        return {
          progress: site.progress,
          workRequired: site.workRequired,
          assignedCrewIds: [...site.assignedCrewIds],
        };
      },
      /** Solar comprable más pequeño del distrito observado: caso natural de «no cabe». */
      smallestMarketableParcelCell: () => {
        const candidates = (economy?.parcels ?? []).filter(
          (parcel) =>
            parcel.disposition === "marketable" &&
            !parcel.ownerOrganizationId &&
            parcel.buildingIds.length === 0,
        );
        if (candidates.length === 0) return null;
        const smallest = candidates.reduce((best, parcel) =>
          parcel.cells.length < best.cells.length ? parcel : best,
        );
        return smallest.cell;
      },
      /** Celda de un edificio ya terminado del distrito, para fotografiar su recinto. */
      finishedBuildingCell: (buildingType: string) => {
        const building = economy?.buildings.find((entry) => entry.type === buildingType);
        if (!building) return null;
        return economy?.parcels.find((parcel) => parcel.id === building.parcelIds[0])?.cell ?? null;
      },
      /** Celda de la primera parcela ampliable del ensamblado en curso (observacional). */
      assemblyCandidateCell: () => {
        if (!pendingSite || !economy) return null;
        return siteAssemblyCandidates(economy, pendingSite)[0]?.cell ?? null;
      },
      /**
       * Localizador de prueba: conjunto de parcelas COMPRABLES que forman un solar válido para el
       * tipo pedido en el distrito observado. No decide elegibilidad de juego —el comando vuelve a
       * validar todo— sólo dice dónde está un triplete que un humano también podría encontrar.
       */
      purchasableSiteForType: (buildingType: string) => {
        if (!economy) return null;
        const required =
          economy.constructionOptions.find((option) => option.type === buildingType)
            ?.siteRequirements.requiredParcels ?? 1;
        const marketable = economy.parcels.filter(
          (parcel) =>
            parcel.disposition === "marketable" &&
            !parcel.ownerOrganizationId &&
            parcel.buildingIds.length === 0 &&
            parcel.permittedBuildingTypes.includes(buildingType as never),
        );
        const byId = new Map<string, (typeof marketable)[number]>(
          marketable.map((parcel) => [parcel.id, parcel]),
        );
        const neighbours = (parcel: (typeof marketable)[number]) =>
          marketable.filter(
            (other) =>
              other.id !== parcel.id &&
              other.developmentCodeId === parcel.developmentCodeId &&
              other.cells.some((cell) =>
                parcel.cells.some(
                  (entry) => Math.abs(entry.x - cell.x) + Math.abs(entry.y - cell.y) === 1,
                ),
              ),
          );
        for (const seed of marketable) {
          const frontier: string[][] = [[seed.id]];
          while (frontier.length > 0) {
            const set = frontier.shift()!;
            if (set.length === required) {
              const parcels = set.map((id) => byId.get(id)!).filter(Boolean);
              if (parcels.length === required) return parcels.map((parcel) => parcel.id);
              continue;
            }
            const last = byId.get(set[set.length - 1]!)!;
            for (const next of neighbours(last))
              if (!set.includes(next.id)) frontier.push([...set, next.id].sort());
          }
        }
        return null;
      },
      /** Celda de una parcela concreta, para poder pincharla desde el smoke. */
      parcelCellById: (parcelId: string) =>
        economy?.parcels.find((parcel) => parcel.id === parcelId)?.cell ?? null,
      inventory: () =>
        economy
          ? {
              cement: economy.inventory.cement,
              brick: economy.inventory.brick,
              steel: economy.inventory.steel,
            }
          : null,
    };
    return () => {
      delete window.__landlordUiTest;
    };
  }, [economy, pendingSite, projection]);

  /** Escape cierra en jerarquía: ayuda → notificaciones → debug → hub/panel. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (helpOpen) setHelpOpen(false);
      else if (notificationsOpen) setNotificationsOpen(false);
      else if (debugOpen) setDebugOpen(false);
      else if (hub) setHub(null);
      else if (pendingPlacement) cancelPlacement();
      else if (pendingSite) setPendingSite(null);
      else if (selectionTarget) setSelectionTarget(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    cancelPlacement,
    debugOpen,
    helpOpen,
    hub,
    notificationsOpen,
    pendingPlacement,
    pendingSite,
    selectionTarget,
  ]);

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
      startConstruction: (
        parcelIds: readonly string[],
        buildingType: BuildingType,
        placementId?: string,
      ) =>
        run(
          () => client!.startConstruction([...parcelIds], buildingType, placementId),
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

  const placementHandlers = useMemo<PlacementHandlers | null>(
    () =>
      pendingPlacement
        ? {
            cycle: (delta) =>
              setPendingPlacement((current) =>
                current
                  ? delta < 0
                    ? previousPlacementCandidate(current)
                    : nextPlacementCandidate(current)
                  : current,
              ),
            rotate: () =>
              setPendingPlacement((current) =>
                current ? rotatePlacementCandidate(current) : current,
              ),
            select: (candidateId) =>
              setPendingPlacement((current) =>
                current ? selectPlacementCandidate(current, candidateId) : current,
              ),
            confirm: (placementId) => {
              if (placementConfirmedId.current === placementId) return;
              placementConfirmedId.current = placementId;
              actions.startConstruction(
                pendingPlacement.parcelIds,
                pendingPlacement.buildingType,
                placementId,
              );
            },
            cancel: cancelPlacement,
          }
        : null,
    [cancelPlacement, pendingPlacement, actions],
  );

  /**
   * V.d-7C · el modo de colocación también se recorre con teclado (§28, §53): ← → cambian de
   * candidata legal, R rota a otra orientación y Enter confirma la seleccionada. Un botón enfocado
   * conserva su propio Enter para no disparar dos veces el mismo comando.
   */
  useEffect(() => {
    if (!pendingPlacement || pendingPlacement.status !== "placing") return undefined;
    const active = document.activeElement;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft")
        setPendingPlacement((c) => (c ? previousPlacementCandidate(c) : c));
      else if (event.key === "ArrowRight")
        setPendingPlacement((c) => (c ? nextPlacementCandidate(c) : c));
      else if (event.key === "r" || event.key === "R")
        setPendingPlacement((c) => (c ? rotatePlacementCandidate(c) : c));
      else if (
        event.key === "Enter" &&
        !(
          active instanceof HTMLElement &&
          ["BUTTON", "INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)
        )
      ) {
        const placementId = selectedCandidate(pendingPlacement)?.id;
        if (placementId) placementHandlers?.confirm(placementId);
      } else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingPlacement, placementHandlers]);

  const selection = useMemo(
    () =>
      economy && projection && selectionTarget
        ? resolveContextSelection({
            economy,
            projection,
            target: selectionTarget,
          })
        : null,
    [economy, projection, selectionTarget],
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
            /** Cambiar de distrito abandona la colocación: las candidatas son del solar observado. */
            cancelPlacement();
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
            setSelectionTarget(
              target.kind === "building"
                ? { kind: "building", buildingId: target.id }
                : { kind: "construction", siteId: target.id },
            );
            setHub(null);
          }}
          onIndicator={(target) => {
            setSelectionTarget(
              target.buildingId
                ? { kind: "building", buildingId: target.buildingId }
                : { kind: "parcel", parcelId: target.parcelId },
            );
          }}
          onPlacementPick={(candidateId) =>
            setPendingPlacement((current) =>
              current ? selectPlacementCandidate(current, candidateId) : current,
            )
          }
          overlay={overlay}
          projection={projection}
          ref={mapRef}
        />
        <OverlayToolbar onChange={setOverlay} overlay={overlay} />
        {showOnboarding && onboarding && !pendingPlacement ? (
          /** El banner de "elige qué construir" contradice un mapa que ya está colocando. */
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
              onClose: () => setSelectionTarget(null),
              onOpenHub: openHub,
              onSelectBuilding: (buildingId) =>
                setSelectionTarget({ kind: "building", buildingId }),
              pendingSite,
              pendingPlacement,
              placementHandlers,
              placementBlockers,
              onBeginPlacement: beginPlacement,
              onBeginSite: setPendingSite,
              onUpdateSite: setPendingSite,
              onCancelSite: () => setPendingSite(null),
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
  setSelection: (target: MapSelectionTarget | null) => void;
  setPlacement: (target: import("./isometric/mount").MapPlacementTarget | null) => void;
};

declare global {
  interface Window {
    __landlordUiTest?: {
      publicParcelCell: () => GridCell | null;
      marketableParcelCell: () => GridCell | null;
      ownedBuildingParcelCell: () => GridCell | null;
      ownedBuildingId: () => string | null;
      marketableParcelCellForType: (buildingType: string) => GridCell | null;
      largestMarketableParcel: () => { cell: GridCell; cellCount: number } | null;
      facilityCell: (kind: string) => GridCell | null;
      pendingSite: () => {
        buildingType: string;
        parcelCount: number;
        candidateCells: GridCell[];
        adjacentAvailableCells: GridCell[];
      } | null;
      constructionStatus: () => Array<{
        id: string;
        kind: string;
        progress: number;
        workRequired: number;
        assignedCrewCount: number;
        crewCapacity: number;
      }>;
      cash: () => number | null;
      constructionSiteCount: () => number;
      assemblyCandidateCell: () => GridCell | null;
      ownedSiteProgress: () => {
        progress: number;
        workRequired: number;
        assignedCrewIds: string[];
      } | null;
      smallestMarketableParcelCell: () => GridCell | null;
      finishedBuildingCell: (buildingType: string) => GridCell | null;
      purchasableSiteForType: (buildingType: string) => string[] | null;
      parcelCellById: (parcelId: string) => GridCell | null;
      ownedSiteFootprint: () => {
        buildingType: string;
        parcelIds: string[];
        orientation: number;
        signature: string;
      } | null;
      inventory: () => { cement: number; brick: number; steel: number } | null;
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
    onPlacementPick: (candidateId: string) => void;
  }
>(function MapViewport(
  { projection, overlay, onCellPicked, onEntityPicked, onIndicator, onPlacementPick },
  ref,
) {
  const container = useRef<HTMLDivElement>(null);
  const game = useRef<ReturnType<typeof mountIsometricSpike> | null>(null);
  /**
   * El motor Phaser se monta UNA vez. Los callbacks viven en una ref: si el efecto dependiera de
   * ellos, cada render de React destruiría y recrearía el canvas (y con él el contexto WebGL).
   */
  const handlers = useRef({ onCellPicked, onEntityPicked, onIndicator, onPlacementPick });
  useEffect(() => {
    handlers.current = { onCellPicked, onEntityPicked, onIndicator, onPlacementPick };
  }, [onCellPicked, onEntityPicked, onIndicator, onPlacementPick]);

  useEffect(() => {
    if (!container.current) return undefined;
    const mounted = mountIsometricSpike(container.current, (cell) =>
      handlers.current.onCellPicked(cell),
    );
    game.current = mounted;
    setIsometricEntityPickedListener(mounted, (target) => handlers.current.onEntityPicked(target));
    setIsometricIndicatorListener(mounted, (target) => handlers.current.onIndicator(target));
    setIsometricPlacementCandidateListener(mounted, (candidateId) =>
      handlers.current.onPlacementPick(candidateId),
    );
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
      setSelection: (target) => {
        if (game.current) setIsometricSelectionTarget(game.current, target);
      },
      setPlacement: (target) => {
        if (game.current) setIsometricPlacement(game.current, target);
      },
    }),
    [],
  );

  return <div className="map-canvas" ref={container} aria-label="Mapa isométrico del distrito" />;
});
