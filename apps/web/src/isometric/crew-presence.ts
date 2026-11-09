import type {
  AgentId,
  CharacterAnimation,
  ConstructionSiteId,
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

export const cellKey = (cell: GridCell): string => `${cell.x},${cell.y}`;

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
 * V.k.4 · recuento por estado visible de la plantilla de una cuadrilla en una obra. Vive aquí, junto
 * al resto de la lectura de cuadrillas, porque el panel y el mapa no pueden discrepar sobre quién
 * está en obra: las dos superficies pasan por `crewMembersBySite`, `siteWorkingCells` y
 * `crewVisualState` por esta misma puerta. Orden: mayor recuento primero y, empatado, el estado por
 * nombre.
 *
 * Un miembro que la proyección no publica cuenta como no presente: el panel habla de la plantilla
 * asignada, mientras el mapa sólo pinta a quien está en el distrito observado (D-103).
 */
export function crewRosterCounts(input: {
  economy: Economy;
  agents: readonly { id: AgentId; cell: GridCell; state?: string }[];
  siteId: ConstructionSiteId;
  crewId: CrewId;
}): { state: CrewVisualState; members: number }[] {
  const row = crewMembersBySite(input.economy).find(
    (entry) => entry.site.id === input.siteId && entry.crew.id === input.crewId,
  );
  if (!row) return [];
  const working = siteWorkingCells(row.site.footprintCells);
  const counts = new Map<CrewVisualState, number>();
  for (const agentId of row.agentIds) {
    const agent = input.agents.find((entry) => entry.id === agentId);
    const state = crewVisualState({
      assignedToSite: true,
      agentState: agent?.state,
      atSite: agent ? working.has(cellKey(agent.cell)) : false,
    });
    counts.set(state, (counts.get(state) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([state, members]) => ({ state, members }))
    .sort((left, right) => right.members - left.members || left.state.localeCompare(right.state));
}

/**
 * Rumbo del paso en la retícula, como índice de las cuatro vistas horneadas del personaje
 * (`azimuth = CAMERA_AZIMUTH_DEGREES + direction * 90`, runtime_asset.py:738).
 *
 * Calibrada en V.k.3 sobre `chr_worker-d{0..3}-walk-0.png`: la cámara orbita y el rig nunca gira, así
 * que el frente del personaje (−Y de Blender) cae a la derecha de pantalla en `−cos(azimuth)` y hacia
 * arriba en `−0.5·sin(azimuth)`. Con +x al abajo-derecha y +y al abajo-izquierda de la retícula
 * isométrica, d0 mira al abajo-izquierda (+y), d1 al abajo-derecha (+x), d2 al arriba-derecha (−y) y
 * d3 al arriba-izquierda (−x) — y eso es lo que se ve en las sprites: d0/d1 enseñan el frente (el paso
 * baja por pantalla) y d2/d3 la espalda (se aleja). Es la misma convención que corrigió `8890ff2` en
 * los vehículos. `null` = el delta no es un paso 4-adyacente (el render conserva el rumbo previo).
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

/**
 * V.k.3 · el avatar de obra. Los oficios que el roster pone en una cuadrilla (`supervisor`,
 * `construction_worker`, `maintenance_technician`) comparten el profesional horneado desde
 * Rocketbox: no hay un sprite distinto que el dominio autorize, y distinguirse por tinte sería
 * inventar una lectura que el motor no publica.
 */
export const CREW_CHARACTER = "chr_worker";

/**
 * Fase del tramo en curso, 0 en `cell` y 1 al entrar en `nextCell`.
 *
 * El paso se ejecuta cuando el clock aún vale `ticksPerCell · k` y se publica en el tick siguiente,
 * así que la resta es la del tick *anterior* al paso. Con `tick % ticksPerCell` el agente rebobina
 * una décima de celda en cada llegada: el off-by-one lo fijó la medición de
 * `movement-tick-counter.test.ts`, no la intuición.
 */
export function crewStepProgress(tick: number, ticksPerCell: number): number {
  if (!Number.isFinite(tick) || !Number.isInteger(ticksPerCell) || ticksPerCell <= 0) return 0;
  return ((((tick - 1) % ticksPerCell) + ticksPerCell) % ticksPerCell) / ticksPerCell;
}

/** Posición de la retícula que pinta el sprite: el tramo autoritativo, interpolado por la fase. */
export function crewRenderCell(from: GridCell, to: GridCell, progress: number): GridCell {
  const t = Math.min(1, Math.max(0, progress));
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

/**
 * Frame en curso del clip: la cadencia la marca `frameDurationMs` del manifiesto, no el tick. El
 * reloj de animación es tiempo de render y por eso nunca entra en el estado autoritativo.
 */
export function crewAnimationFrameKey(
  manifest: RuntimeAssetManifestV2,
  character: string,
  animation: CharacterAnimation,
  direction: 0 | 1 | 2 | 3,
  elapsedMs: number,
): string {
  const clip = manifest.characters[character]?.animations[animation];
  if (!clip) throw new Error(`animation fuera del contrato para ${character}: ${animation}`);
  const framesPerDirection = clip.frames.length / manifest.characters[character]!.directions;
  return crewSpriteKey(
    manifest,
    character,
    animation,
    direction,
    crewAnimationSlot(elapsedMs, clip.frameDurationMs, framesPerDirection),
  );
}

/**
 * Lo que la escena necesita para pintar a un miembro de cuadrilla en la proyección actual. `cell`
 * es autoritativo (y es la memoria que la siguiente proyección usa como origen del rumbo llegado);
 * `renderCell` es presentación y puede ser fraccionaria.
 */
export type CrewSpriteObservation = {
  agentId: AgentId;
  siteId: ConstructionSiteId;
  character: string;
  animation: CharacterAnimation;
  direction: 0 | 1 | 2 | 3;
  visualState: CrewVisualState;
  cell: GridCell;
  renderCell: GridCell;
};

/**
 * V.k.3 · pool de sprites de cuadrilla derivado de la proyección. La memoria entre proyecciones
 * (`previous`) sólo sirve para saber de dónde venía cada agente: sin ella un agente que llega a su
 * celda giraría hacia la cámara, porque `nextCell` ya apunta al siguiente tramo.
 *
 * Las claves del mapa son exactamente los agentes pintables: la escena destruye lo que aquí no
 * esté, así que una obra terminada o una cuadrilla despedida no deja sprites huérfanos.
 */
export function crewSpriteObservations(
  projection: ViewProjectionV2,
  previous: ReadonlyMap<AgentId, CrewSpriteObservation>,
): Map<AgentId, CrewSpriteObservation> {
  const observations = new Map<AgentId, CrewSpriteObservation>();
  const economy = projection.economy;
  if (!economy) return observations;
  const agentsById = new Map(
    projection.agents
      .filter((agent) => agent.districtId === projection.observedDistrictId)
      .map((agent) => [agent.id, agent]),
  );
  const progress = crewStepProgress(projection.tick, projection.movement.ticksPerCell);
  for (const row of crewMembersBySite(economy)) {
    const working = siteWorkingCells(row.site.footprintCells);
    for (const agentId of row.agentIds) {
      const agent = agentsById.get(agentId);
      if (!agent) continue;
      const plan = crewWalkPlan({
        previousCell: previous.get(agentId)?.cell ?? null,
        cell: agent.cell,
        nextCell: agent.nextCell,
        agentState: agent.state,
        atSite: working.has(cellKey(agent.cell)),
      });
      observations.set(agentId, {
        agentId,
        siteId: row.site.id,
        character: CREW_CHARACTER,
        animation: plan.animation,
        direction: plan.direction,
        visualState: plan.visualState,
        cell: { x: agent.cell.x, y: agent.cell.y },
        renderCell: agent.nextCell
          ? crewRenderCell(agent.cell, agent.nextCell, progress)
          : { x: agent.cell.x, y: agent.cell.y },
      });
    }
  }
  return observations;
}
