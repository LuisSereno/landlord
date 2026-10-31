import {
  buildingFrameForOrientation,
  type AssetImageV1,
  type BuildingAssetState,
  type BuildingAssetV1,
  type BuildingAssetV2,
  type CharacterAnimation,
  type CharacterAssetV1,
  type GridCell,
  type RuntimeAssetManifestV2,
  type ViewProjectionV2,
} from "@landlord/shared";

/**
 * Helpers puros de la capa de sprites (WP4.15). Separan el contrato de assets del render para que
 * pivote, estado visual y depth se puedan probar sin Phaser.
 */
export type ProjectedBuildingState = "operational" | "burning" | "collapse_pending" | "ruin";

export function buildingAssetStateFor(
  state: ProjectedBuildingState,
  condition: number,
): BuildingAssetState {
  if (state === "burning" || state === "collapse_pending") return "burning";
  if (state === "ruin") return "damaged";
  return condition < 60 ? "damaged" : "complete";
}

export function spriteKeyFor(type: string, state: BuildingAssetState): string {
  return `building-${type}-${state}`;
}

/**
 * Orden de dibujo isométrico: primero las filas más lejanas (x+y), después y, después x. Coincide con
 * el orden con el que el mapa pinta sus losetas, así que un edificio nunca se adelanta a la loseta
 * que tiene delante.
 */
export function depthForCell(cell: GridCell): number {
  return (cell.x + cell.y) * 1_000 + cell.y * 10 + cell.x;
}

/**
 * Depth de un sprite con huella. El asset ocupa `width × height` celdas hacia el sureste desde su celda
 * ancla, así que se ordena por la celda más cercana a cámara: sin esto una planta de cemento 2×2 se
 * pintaría detrás de los edificios que tapa.
 */
export function depthForAsset(
  cell: GridCell,
  footprint: { width: number; height: number },
): number {
  return depthForCell({
    x: cell.x + Math.max(1, Math.round(footprint.width)) - 1,
    y: cell.y + Math.max(1, Math.round(footprint.height)) - 1,
  });
}

/**
 * Celda del centro de la huella, fraccionaria cuando la huella es par. El pivote del contrato es el
 * centro de la huella, no la celda ancla: ahí se coloca el sprite.
 */
export function footprintCenter(
  cell: GridCell,
  footprint: { width: number; height: number },
): GridCell {
  return {
    x: cell.x + (Math.max(1, Math.round(footprint.width)) - 1) / 2,
    y: cell.y + (Math.max(1, Math.round(footprint.height)) - 1) / 2,
  };
}

/**
 * Bounds de una huella arbitraria (H2-01). Los edificios del dominio ya no se dibujan desde el
 * anchor de su parcela: se colocan y ordenan por su `footprintCells` real, que puede estar lejos
 * del anchor y no ser un rectángulo sólido. Se devuelve el bounding box, no la forma: la forma
 * vive en las celdas concretas.
 */
export type FootprintBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

export function footprintBounds(cells: readonly GridCell[]): FootprintBounds {
  if (cells.length === 0) {
    throw new RangeError("footprintBounds: la huella necesita al menos una celda");
  }
  let minX = cells[0]!.x;
  let minY = cells[0]!.y;
  let maxX = cells[0]!.x;
  let maxY = cells[0]!.y;
  for (const cell of cells) {
    if (cell.x < minX) minX = cell.x;
    if (cell.y < minY) minY = cell.y;
    if (cell.x > maxX) maxX = cell.x;
    if (cell.y > maxY) maxY = cell.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Centro visual de la huella: punto medio del bounding box. Es fraccionario cuando la huella es
 * par, igual que `footprintCenter(cell, {width,height})`, pero se deriva de las celdas físicas y
 * no de un rectángulo declarado: dos edificios de la misma parcela con huellas distintas quedan en
 * centros distintos.
 */
export function footprintVisualCenter(cells: readonly GridCell[]): GridCell {
  const { minX, minY, maxX, maxY } = footprintBounds(cells);
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

/**
 * Depth derivado de la huella física: la celda más próxima a cámara es la que tiene x+y mayor
 * (empates resueltos por la fórmula clásica de `depthForCell`). Sin esto, un edificio desplazado
 * respecto al anchor de su parcela se ordenaría por una celda que no ocupa.
 */
export function depthForFootprintCells(cells: readonly GridCell[]): number {
  const { maxX, maxY } = footprintBounds(cells);
  return depthForCell({ x: maxX, y: maxY });
}

/**
 * Una entrada del plan de sprites: todo lo que la escena necesita para colocar, escalar y ordenar
 * un edificio u obra concreta. Es pura —sin Phaser— para poder comprobar la paridad
 * "sprites == edificios proyectados renderizables" sin levantar la escena (H2-01).
 */
export type BuildingSpritePlacement = {
  id: string;
  entityKind: "building" | "construction";
  entityId: string;
  domainType: string;
  assetState: BuildingAssetState;
  cells: readonly GridCell[];
  alpha: number;
  depthBias: number;
};

/**
 * Proyección del `economy` de la vista al plan de sprites. Una entrada por edificio y una por obra,
 * en el mismo orden en que viajan en la proyección. El scene sólo tiene que recorrer el plan.
 *
 * La resolución del asset (Blender → procedural → null) se inyecta para poder probar la paridad:
 * una parcela con dos edificios produce dos entradas en el plan, no una, porque el plan no vuelve
 * a la parcela para localizar su `buildingId` (H2-01).
 */
export function buildingSpritePlan(
  economy: Pick<NonNullable<ViewProjectionV2["economy"]>, "buildings" | "constructionSites">,
  opts: {
    /** Id → archetype (puede caer en `domainType` si el adapter no lo ha resuelto aún). */
    archetypeFor: (id: string, domainType: string) => string;
    /**
     * Resolver el par `{key, asset}` o `null` si ni el Blender ni el procedural cubren el tipo.
     * En H2-02 se exige que ningún tipo del catálogo devuelva `null`, así que la paridad del
     * plan se convierte en la paridad de los edificios proyectados.
     */
    resolveVisual: (
      archetype: string,
      domainType: string,
      state: BuildingAssetState,
    ) => { key: string; asset: BuildingAssetV1 } | null;
  },
): Array<BuildingSpritePlacement & { textureKey: string; asset: BuildingAssetV1 }> {
  const plan: Array<BuildingSpritePlacement & { textureKey: string; asset: BuildingAssetV1 }> = [];
  for (const building of economy.buildings) {
    const id = `building:${building.id}`;
    const state = buildingAssetStateFor(building.state, building.condition);
    const archetype = opts.archetypeFor(id, building.type);
    const resolved = opts.resolveVisual(archetype, building.type, state);
    if (!resolved) continue;
    plan.push({
      id,
      entityKind: "building",
      entityId: building.id,
      domainType: building.type,
      assetState: state,
      cells: building.footprintCells,
      alpha: building.state === "ruin" ? 0.4 : 1,
      depthBias: 0,
      textureKey: resolved.key,
      asset: resolved.asset,
    });
  }
  for (const site of economy.constructionSites) {
    const id = `site:${site.id}`;
    const state: BuildingAssetState = "construction";
    const archetype = opts.archetypeFor(id, site.buildingType);
    const resolved = opts.resolveVisual(archetype, site.buildingType, state);
    if (!resolved) continue;
    plan.push({
      id,
      entityKind: "construction",
      entityId: site.id,
      domainType: site.buildingType,
      assetState: state,
      cells: site.footprintCells,
      alpha: 1,
      depthBias: 1,
      textureKey: resolved.key,
      asset: resolved.asset,
    });
  }
  return plan;
}

/**
 * Frames por dirección de una animación. El manifiesto los ordena por dirección y después por fase, así
 * que el índice de un frame es `dirección × framesPorDirección + fase`.
 */ export function framesPerDirection(
  character: Pick<CharacterAssetV1, "directions" | "animations">,
  animation: CharacterAnimation,
): number {
  return Math.max(
    1,
    Math.floor(character.animations[animation].frames.length / character.directions),
  );
}

/** Frame de una dirección y fase concretas: cada dirección camina con sus propios frames. */
export function animationFrameFor(
  character: Pick<CharacterAssetV1, "directions" | "animations">,
  animation: CharacterAnimation,
  direction: number,
  phase: number,
): AssetImageV1 {
  const frames = character.animations[animation].frames;
  const perDirection = framesPerDirection(character, animation);
  const index = (direction % character.directions) * perDirection + (phase % perDirection);
  return frames[index]!;
}

export function assetFor(manifest: RuntimeAssetManifestV2, type: string): BuildingAssetV2 | null {
  return manifest.buildings[type] ?? null;
}

/** Lado de la celda lógica en metros: las losetas Kenney que definen el grid miden 4 m. */
export const CELL_METERS = 4;

/**
 * Escala que lleva un render Blender a la celda isométrica. La cámara del pack declara su densidad
 * (`pixelsPerMeter`); el grid del juego mide la diagonal de una celda de 4 m como `tileWidth` px.
 * Los assets procedurales ya están dibujados a esa escala y no declaran densidad.
 */
export function spriteScaleFor(
  asset: { pixelsPerMeter?: number | undefined },
  tileWidth: number,
): number {
  if (!asset.pixelsPerMeter) return 1;
  const gamePixelsPerMeter = tileWidth / (CELL_METERS * Math.SQRT2);
  return gamePixelsPerMeter / asset.pixelsPerMeter;
}

/** Origen normalizado listo para `setOrigin`: el pivote es el punto de suelo del sprite. */
export function originFromPivot(asset: BuildingAssetV1): { x: number; y: number } {
  return { x: asset.pivot.x, y: asset.pivot.y };
}

/** Compara una dirección de pantalla (+y hacia abajo) con las variantes del manifiesto (0 = derecha, sentido horario). */
export function directionIndexFor(dx: number, dy: number, directions: 4 | 8): number {
  if (dx === 0 && dy === 0) return 0;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const normalized = (angle + 360) % 360;
  const step = 360 / directions;
  return Math.round(normalized / step) % directions;
}

/**
 * Selecciona la textura Blender si está disponible; si no, usa la procedural.
 * Implementa la degradación por asset (caso C): un Blender corrupto no bloquea el fallback.
 *
 * @param proceduralKey Clave del sprite procedural (`building-{type}-{state}`).
 * @param blenderAvailable Set de claves Blender disponibles (`blender-building-{type}-{state}`).
 * @returns La clave a usar.
 */
export function selectBuildingTextureKey(
  proceduralKey: string,
  blenderAvailable: Set<string>,
): string {
  const blenderKey = `blender-${proceduralKey}`;
  return blenderAvailable.has(blenderKey) ? blenderKey : proceduralKey;
}

/**
 * H2-02 · resolución pura de la cadena Blender → procedural → null. `IsometricSpikeScene`
 * la invierte con sus bundles registrados y con `this.textures.exists`; aquí se prueba sin
 * Phaser que, ante un Blender ausente o corrupto, los 15 tipos del catálogo de dominio
 * resuelven una textura procedural válida. Con un procedural incompleto el helper devuelve
 * `null` y el edificio desaparece: el manifiesto tiene que cubrir el catálogo entero, y
 * `assets.test.ts` lo fuerza estructuralmente.
 */
export type BuildingVisualBundle = {
  buildings: Record<string, BuildingAssetV2 | undefined>;
};

export function resolveBuildingVisual(
  archetype: string,
  domainType: string,
  state: BuildingAssetState,
  options: {
    /** Bundle Blender: puede faltar (`undefined` o vacío) sin que la cadena se rompa. */
    blenderBundle: BuildingVisualBundle | undefined;
    /** Bundle procedural: tiene que declarar el tipo de dominio o el edificio desaparece. */
    proceduralBundle: BuildingVisualBundle;
    /** Registrar en la textura de Phaser; se inyecta para poder llamar al helper sin escena. */
    textureExists: (key: string) => boolean;
    /** Azimut de cámara declarado por la escena; un asset que no lo autorice se rechaza. */
    azimuth: number;
  },
): { key: string; asset: BuildingAssetV1 } | null {
  const blenderKey = `blender-building-${archetype}-${state}`;
  const blenderAsset = options.blenderBundle?.buildings[archetype];
  if (
    blenderAsset &&
    options.textureExists(blenderKey) &&
    buildingFrameForOrientation(blenderAsset, options.azimuth)
  ) {
    return { key: blenderKey, asset: blenderAsset };
  }
  const proceduralKey = spriteKeyFor(domainType, state);
  const proceduralAsset = options.proceduralBundle.buildings[domainType];
  if (
    proceduralAsset &&
    options.textureExists(proceduralKey) &&
    buildingFrameForOrientation(proceduralAsset, options.azimuth)
  ) {
    return { key: proceduralKey, asset: proceduralAsset };
  }
  return null;
}
