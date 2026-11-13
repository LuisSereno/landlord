import type {
  BuildingType,
  DevelopmentPlacementCandidate,
  DevelopmentPlacementCandidates,
  GridCell,
  PlacementRejection,
} from "@landlord/shared";

/**
 * V.d-7C · estado transitorio de la colocación (D-097 · Persistence).
 *
 * Vive solo en React y se descarta al confirmar, cancelar, cambiar de distrito o cerrar la ficha:
 * nada de esto entra en `GameState`, en el snapshot ni en la cadena canónica. Las candidatas las
 * decide el motor; aquí únicamente se elige entre ellas.
 */
export type PlacementStatus = "requesting" | "placing" | "blocked" | "failed";

/** Acciones de la ficha: todas seleccionan entre candidatas ya legales, ninguna crea geometría. */
export type PlacementHandlers = {
  cycle: (delta: number) => void;
  rotate: () => void;
  select: (candidateId: string) => void;
  confirm: (placementId: string) => void;
  cancel: () => void;
};

export type PendingPlacement = {
  buildingType: BuildingType;
  districtId: string;
  /** Conjunto canónico del proyecto, tal y como lo devolvió el motor. */
  parcelIds: readonly string[];
  candidates: readonly DevelopmentPlacementCandidate[];
  selectedCandidateId: string | null;
  totalCandidates: number;
  rejection: PlacementRejection | null;
  status: PlacementStatus;
};

export function beginPlacementRequest(input: {
  buildingType: BuildingType;
  districtId: string;
  parcelIds: readonly string[];
}): PendingPlacement {
  return {
    buildingType: input.buildingType,
    districtId: input.districtId,
    parcelIds: input.parcelIds,
    candidates: [],
    selectedCandidateId: null,
    totalCandidates: 0,
    rejection: null,
    status: "requesting",
  };
}

/**
 * Respuesta del motor. Si no hay ninguna colocación legal el estado pasa a `blocked` con la razón
 * autoritativa: la ficha la traduce a lenguaje de jugador en lugar de dejar un botón apagado.
 */
export function placementAnswerReceived(
  pending: PendingPlacement,
  answer: DevelopmentPlacementCandidates,
): PendingPlacement {
  const candidates = answer.candidates as readonly DevelopmentPlacementCandidate[];
  const selected = candidates[0]?.id ?? null;
  return {
    ...pending,
    parcelIds: answer.parcelIds,
    districtId: answer.districtId,
    candidates,
    selectedCandidateId: selected,
    totalCandidates: answer.totalCandidates,
    rejection: answer.rejection,
    status: candidates.length > 0 ? "placing" : "blocked",
  };
}

export function placementRequestFailed(pending: PendingPlacement): PendingPlacement {
  return { ...pending, status: "failed", candidates: [], selectedCandidateId: null };
}

export function selectedCandidate(pending: PendingPlacement): DevelopmentPlacementCandidate | null {
  return (
    pending.candidates.find((candidate) => candidate.id === pending.selectedCandidateId) ?? null
  );
}

/** Sólo se puede confirmar una candidata legal: sin selección no hay comando. */
export function confirmablePlacement(pending: PendingPlacement): string | null {
  if (pending.status !== "placing") return null;
  return selectedCandidate(pending)?.id ?? null;
}

export function selectPlacementCandidate(
  pending: PendingPlacement,
  candidateId: string,
): PendingPlacement {
  if (!pending.candidates.some((candidate) => candidate.id === candidateId)) return pending;
  return { ...pending, selectedCandidateId: candidateId };
}

function step(pending: PendingPlacement, delta: number): PendingPlacement {
  if (pending.candidates.length === 0) return pending;
  const index = pending.candidates.findIndex(
    (candidate) => candidate.id === pending.selectedCandidateId,
  );
  const size = pending.candidates.length;
  const next = ((((index < 0 ? 0 : index) + delta) % size) + size) % size;
  return { ...pending, selectedCandidateId: pending.candidates[next]!.id };
}

export const nextPlacementCandidate = (pending: PendingPlacement): PendingPlacement =>
  step(pending, 1);

export const previousPlacementCandidate = (pending: PendingPlacement): PendingPlacement =>
  step(pending, -1);

/**
 * Rotar = elegir otra candidata legal con otra orientación (D-097 · Orientation). Si el dominio no
 * ofrece ninguna huella girada, el botón no hace nada: nunca se gira sólo el sprite.
 */
export function rotatePlacementCandidate(pending: PendingPlacement): PendingPlacement {
  const current = selectedCandidate(pending);
  if (!current || pending.candidates.length === 0) return pending;
  const start = pending.candidates.findIndex((candidate) => candidate.id === current.id);
  for (let offset = 1; offset <= pending.candidates.length; offset += 1) {
    const candidate = pending.candidates[(start + offset) % pending.candidates.length]!;
    if (candidate.orientation !== current.orientation)
      return { ...pending, selectedCandidateId: candidate.id };
  }
  return pending;
}

export function placementHasRotation(pending: PendingPlacement): boolean {
  const current = selectedCandidate(pending);
  if (!current) return false;
  return pending.candidates.some((candidate) => candidate.orientation !== current.orientation);
}

function centroid(cells: readonly GridCell[]): { x: number; y: number } {
  const total = cells.reduce(
    (accumulator, cell) => ({ x: accumulator.x + cell.x, y: accumulator.y + cell.y }),
    { x: 0, y: 0 },
  );
  return { x: total.x / cells.length, y: total.y / cells.length };
}

/**
 * El puntero sólo selecciona entre las candidatas ya calculadas (D-097 · Snapping): nunca crea
 * geometría nueva. Distancia canónica al centroide; empate resuelto por id para que sea total.
 * Vive aquí, y no dentro del scene, para que Phaser y React compartan la misma regla de cercanía.
 */
export function nearestCandidateToCell(
  candidates: readonly { id: string; footprintCells: readonly GridCell[] }[],
  cell: GridCell,
): string | null {
  let best: { id: string; distance: number } | null = null;
  for (const candidate of candidates) {
    const center = centroid(candidate.footprintCells);
    const distance = (center.x - cell.x) ** 2 + (center.y - cell.y) ** 2;
    if (!best || distance < best.distance - 1e-9) best = { id: candidate.id, distance };
    else if (Math.abs(distance - best.distance) <= 1e-9 && candidate.id < best.id)
      best = { id: candidate.id, distance };
  }
  return best?.id ?? null;
}

export function nearestPlacementCandidate(
  pending: PendingPlacement,
  cell: GridCell,
): string | null {
  return nearestCandidateToCell(pending.candidates, cell);
}

/**
 * Entrar en el modo de colocación no debe depender de la tesorería: el jugador necesita ver DÓNDE
 * cabe antes de decidir si puede pagarlo. Estas son las razones que sí impiden mirar el mapa (el
 * solar no admite el proyecto); el resto sólo impide confirmar. Los códigos los produce
 * `disabled-reasons`, que lee la proyección y no reinventa ninguna regla.
 */
const ENTRY_BLOCKING_CODES = new Set(["not_owned", "use_not_permitted", "parcel_busy"]);

export function placementEntryIssues(
  reasons: readonly { code: string; message: string }[],
): string[] {
  return reasons.filter((reason) => ENTRY_BLOCKING_CODES.has(reason.code)).map((r) => r.message);
}

export function placementConfirmIssues(
  reasons: readonly { code: string; message: string }[],
): string[] {
  return reasons.filter((reason) => !ENTRY_BLOCKING_CODES.has(reason.code)).map((r) => r.message);
}

/** Traducción a lenguaje de jugador de la razón autoritativa (§29). Ningún enum técnico sale aquí. */
const ISSUE_COPY: Record<PlacementRejection, string> = {
  NO_BUILDABLE_ENVELOPE: "No cabe este edificio respetando los retranqueos del código.",
  COVERAGE_LIMIT: "La superficie edificable ya está agotada en este solar.",
  FAR_LIMIT: "La edificabilidad permitida no da para una nueva planta.",
  SITE_AREA_TOO_SMALL: "La superficie conjunta de las parcelas es insuficiente.",
  PARCELS_NOT_EDGE_CONTIGUOUS: "Esta combinación de parcelas no forma un solar continuo.",
  MIXED_DEVELOPMENT_CODES: "Las parcelas elegidas tienen normas urbanísticas incompatibles.",
  PARCEL_OCCUPIED: "Alguna parcela del proyecto ya está ocupada por otro edificio u obra.",
  ACTIVE_SITE_ON_PARCEL: "Ya hay una obra en marcha en alguna de estas parcelas.",
  USE_NOT_ALLOWED: "El código urbanístico del solar no permite este uso.",
  ACTOR_NOT_AUTHORIZED: "Necesitas ser propietario de todas las parcelas del proyecto.",
  WRONG_PARCEL_COUNT: "El proyecto necesita otro número de parcelas.",
  DUPLICATE_PARCELS: "La misma parcela aparece dos veces en el proyecto.",
  PARCEL_NOT_FOUND: "Alguna parcela del proyecto ya no existe.",
  PARCELS_DIFFERENT_DISTRICT: "Las parcelas elegidas están en distritos distintos.",
  PUBLIC_LAND_NOT_BUILDABLE: "El suelo público no se puede edificar.",
};

export function placementIssue(pending: PendingPlacement): string | null {
  if (pending.status === "requesting") return "Consultando al motor las colocaciones legales…";
  if (pending.status === "failed")
    return "El motor no pudo responder a esta petición. Vuelve a intentarlo.";
  if (pending.status === "blocked")
    return pending.rejection
      ? ISSUE_COPY[pending.rejection]
      : "Este solar no admite una colocación legal con la normativa vigente.";
  return null;
}

/** Texto de la ficha: qué se va a construir, dónde y con qué orientación. */
export function placementSummary(pending: PendingPlacement): string {
  const candidate = selectedCandidate(pending);
  if (!candidate) return "Sin colocación seleccionada.";
  return `${candidate.footprintCells.length} celdas · orientación ${candidate.orientation}° · ${candidate.floors} planta(s)`;
}

export function placementCounterLabel(pending: PendingPlacement): string {
  const index = pending.candidates.findIndex(
    (candidate) => candidate.id === pending.selectedCandidateId,
  );
  if (index < 0) return "—";
  const shown = Math.min(pending.candidates.length, pending.totalCandidates);
  return `${index + 1} de ${shown}${
    pending.totalCandidates > pending.candidates.length ? ` (hay más)` : ""
  }`;
}
