import type {
  AgentId,
  CharacterAnimation,
  CrewId,
  GridCell,
  RuntimeAssetManifestV2,
  ViewProjectionV2,
} from "@landlord/shared";

import { crewVisualState, type CrewVisualState } from "./construction-stages";

/**
 * V.k.2 · lectura pura de cuadrillas. No mueve ni un agente: cruza lo que la proyección ya publica
 * (sitios, cuadrillas, celda y estado por agente) y decide únicamente cómo se lee en pantalla.
 * Vive aquí, y no duplicado en la escena y en el panel, porque las dos superficies tenían cada una
 * su propia copia de la huella + vecinas y de la lista de miembros.
 */
type Economy = NonNullable<ViewProjectionV2["economy"]>;
type ProjectedSite = Economy["constructionSites"][number];
type ProjectedCrew = Economy["crews"][number];

export type SiteCrewRoster = {
  site: ProjectedSite;
  crew: ProjectedCrew;
  agentIds: AgentId[];
};

const cellKey = (cell: GridCell): string => `${cell.x},${cell.y}`;

/** Huella de la obra más sus cuatro vecinas: donde un agente se lee como "en obra". */
export function siteWorkingCells(footprintCells: readonly GridCell[]): Set<string> {
  const cells = new Set<string>();
  for (const cell of footprintCells) {
    cells.add(cellKey(cell));
    cells.add(`${cell.x + 1},${cell.y}`);
    cells.add(`${cell.x - 1},${cell.y}`);
    cells.add(`${cell.x},${cell.y + 1}`);
    cells.add(`${cell.x},${cell.y - 1}`);
  }
  return cells;
}

export function agentWorksAtSiteFootprint(
  cell: GridCell,
  footprintCells: readonly GridCell[],
): boolean {
  return siteWorkingCells(footprintCells).has(cellKey(cell));
}

/**
 * Una fila por (sitio, cuadrilla asignada que existe en el roster). El orden es el de la
 * proyección: sitios en su orden canónico y cuadrillas en el orden de `assignedCrewIds`.
 */
export function crewMembersBySite(economy: Economy): SiteCrewRoster[] {
  const crewsById = new Map<CrewId, ProjectedCrew>(economy.crews.map((crew) => [crew.id, crew]));
  const rows: SiteCrewRoster[] = [];
  for (const site of economy.constructionSites) {
    for (const crewId of site.assignedCrewIds) {
      const crew = crewsById.get(crewId);
      if (!crew) continue;
      rows.push({ site, crew, agentIds: [crew.supervisorAgentId, ...crew.workerAgentIds] });
    }
  }
  return rows;
}

/**
 * Rumbo del paso en la retícula, como índice de las cuatro vistas horneadas del personaje
 * (`azimuth = CAMERA_AZIMUTH_DEGREES + direction * 90`, runtime_asset.py:738).
 *
 * Tabla derivada de la convención de cámara, NO verificada todavía contra píxel: V.k.3 la calibra
 * con una captura de las cuatro direcciones antes de dar el sprite por bueno. Es exactamente la
 * clase de bug que corrigió `8890ff2` en los vehículos; si la captura sale espejada se corrige esta
 * tabla y nada más. `null` = el delta no es un paso 4-adyacente (el render conserva el rumbo previo).
 */
export const GRID_DELTA_TO_DIRECTION: Readonly<Record<string, 0 | 1 | 2 | 3>> = {
  "1,0": 1,
  "0,1": 0,
  "-1,0": 3,
  "0,-1": 2,
};

export function crewStepDirection(from: GridCell, to: GridCell): 0 | 1 | 2 | 3 | null {
  return GRID_DELTA_TO_DIRECTION[`${to.x - from.x},${to.y - from.y}`] ?? null;
}

export type CrewWalkPlan = {
  direction: 0 | 1 | 2 | 3;
  animation: CharacterAnimation;
  moving: boolean;
  visualState: CrewVisualState;
};

/**
 * El paso autoritativo manda: si la proyección publica `nextCell`, el agente camina hacia ella; sin
 * paso, posa idle (también cuando ya está en obra). El rumbo sin paso es el del último tramo
 * recorrido, para que un agente que llega no gire hacia la cámara al parar.
 */
export function crewWalkPlan(input: {
  previousCell: GridCell | null;
  cell: GridCell;
  nextCell: GridCell | null;
  agentState: string | undefined;
  atSite: boolean;
}): CrewWalkPlan {
  const visualState = crewVisualState({
    assignedToSite: true,
    agentState: input.agentState,
    atSite: input.atSite,
  });
  const step = input.nextCell ? crewStepDirection(input.cell, input.nextCell) : null;
  const arrived =
    input.previousCell && cellKey(input.previousCell) !== cellKey(input.cell)
      ? crewStepDirection(input.previousCell, input.cell)
      : null;
  return {
    direction: step ?? arrived ?? 0,
    animation: step === null ? "idle" : "walk",
    moving: step !== null,
    visualState,
  };
}

/** Frame de un clip de dos poses: el reloj de render avanza por duración publicada, no por tick. */
export function crewAnimationSlot(
  elapsedMs: number,
  frameDurationMs: number,
  frameCount: number,
): number {
  if (frameDurationMs <= 0 || frameCount <= 0) return 0;
  return Math.floor(Math.max(0, elapsedMs) / frameDurationMs) % frameCount;
}

/**
 * Clave de textura del avatar con la misma validación que `expectActorRuntimeReference`: personaje
 * existente, dirección y slot dentro de la matriz publicada. Fail-closed: una referencia rota es un
 * bug de contrato, no un sprite que se salta en silencio.
 */
export function crewSpriteKey(
  manifest: RuntimeAssetManifestV2,
  character: string,
  animation: CharacterAnimation,
  direction: number,
  slot: number,
): string {
  const asset = manifest.characters[character];
  if (!asset) throw new Error(`personaje fuera del manifiesto: ${character}`);
  if (!Number.isInteger(direction) || direction < 0 || direction >= asset.directions) {
    throw new Error(`direction fuera del contrato para ${character}: ${direction}`);
  }
  const clip = asset.animations[animation];
  if (!clip) throw new Error(`animation fuera del contrato para ${character}: ${animation}`);
  if (clip.frames.length % asset.directions !== 0) {
    throw new Error(`matriz de frames irregular para ${character}/${animation}`);
  }
  const framesPerDirection = clip.frames.length / asset.directions;
  if (!Number.isInteger(slot) || slot < 0 || slot >= framesPerDirection) {
    throw new Error(`slot fuera del contrato para ${character}/${animation}: ${slot}`);
  }
  return `blender-character-${character}-${animation}-d${direction}-${slot}`;
}
