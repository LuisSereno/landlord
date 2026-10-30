import Phaser from "phaser";
import {
  type BuildingAssetState,
  type BuildingAssetV1,
  type RuntimeAssetManifestV2,
  type SceneryAssetV1,
  type ViewProjectionV2,
} from "@landlord/shared";
import { BLENDER_ASSETS, PROCEDURAL_ASSETS } from "../assets/runtime-assets";
import {
  CODE_PALETTE,
  MAP_COLORS,
  ROLE_COLORS,
  USE_COLORS,
  ZONING_COLORS,
  type MapOverlay,
} from "../ui/overlay-catalog";
import { planGround, type GroundPlan } from "../visual-slice/ground";
import {
  CROSSING_TEXTURE,
  paintCrossing,
  paintGround,
  type GroundBounds,
  type TerrainStage,
} from "../visual-slice/terrain-paint";
import type { SliceLot, VisualSliceLayout } from "../visual-slice/layout";
import {
  assetFor,
  buildingSpritePlan,
  depthForAsset,
  depthForFootprintCells,
  footprintCenter,
  footprintVisualCenter,
  originFromPivot,
  resolveBuildingVisual,
  selectBuildingTextureKey,
  spriteKeyFor,
  spriteScaleFor,
} from "./building-sprites";
import {
  gridToScreen,
  pickGridCell,
  REFERENCE_LAYOUT,
  type GridCell,
  type IsometricLayout,
  type ScreenPoint,
} from "./coordinates";
import {
  buildGameplayVisualModel,
  type GameplayParkedVehicle,
  type GameplayVisualModel,
} from "./gameplay-visual-adapter";

const COLORS = MAP_COLORS;

const STRUCTURE_TEXTURE_KEY = "benchmark-structure-marker";
const AGENT_TEXTURE_KEY = "benchmark-agent-marker";
const TILE_TEXTURE_KEY = "district-ground-tiles";
const CROSSING_TEXTURE_KEY = "district-crossings";
const SLICE_SHADOW_TEXTURE_KEY = "slice-contact-shadow";
/** Las capas de terreno viven por debajo de cualquier objeto con depth isométrico. */
const TERRAIN_DEPTH = 100;
/** Marca de vial por encima de todos los tiles de calzada, por debajo del mobiliario. */
const ROAD_MARKING_DEPTH = TERRAIN_DEPTH + 250;
/**
 * Profundidad de las parcelas en obra. La cesión de suelo es una decisión de la simulación; el
 * contorno ámbar es presentación y sólo aparece en el Visual Slice.
 */
const CONSTRUCTION_SITE_DEPTH = TERRAIN_DEPTH + 300;
/**
 * Los dos bundles entran por el mismo parser: el procedural ya es V2 y el de Blender sigue siendo V1,
 * que se convierte de forma explícita. Aquí no hay rama silenciosa por versión.
 */
const ASSETS = PROCEDURAL_ASSETS;
const ASSETS_BLENDER = BLENDER_ASSETS;
/** Azimut fijo de la cámara isométrica del juego. Un asset que no lo declare no se dibuja. */
const SCENE_AZIMUTH = 45;

/** Las piezas Kenney están modeladas a escala pequeña; el slice las lleva a presencia de calle. */
const SLICE_BUILDING_SCALE = 1.45;
const FPS_WINDOW_MS = 500;

export type IsometricSceneOptions = {
  /** Capa de presentación del Visual Slice; no altera la simulación. */
  visualSlice?: VisualSliceLayout;
  /** Personajes de la capa de presentación (`?characters=1`). */
  sliceCharacters?: boolean;
  /**
   * Capa del suelo hasta la que se hornea (evidence BEFORE/AFTER de WP4.15-V.b0). `full` es el
   * estado normal; los demás valores sirven para aislar qué aporta cada capa.
   */
  terrainStage?: TerrainStage | undefined;
  /** Cuadrícula de edición por celda. La captura de referencia del gate no debe parecer un editor. */
  showGrid?: boolean | undefined;
};

type CameraTestApi = {
  configure(camera: { zoom: number; scrollX: number; scrollY: number }): void;
  getCamera(): { zoom: number; scrollX: number; scrollY: number };
  getCellScreenPoint(cell: GridCell): ScreenPoint;
  getWorldPoint(point: ScreenPoint): ScreenPoint;
  getSelectedCell(): GridCell | null;
  centerOnCell(cell: GridCell): void;
  /** Inyecta una proyección (captura QA): atraviesa el mismo camino de render que la partida real. */
  injectProjection(projection: ViewProjectionV2): void;
};

declare global {
  interface Window {
    __landlordCameraTest?: CameraTestApi;
    __visualSliceReady?: boolean;
    __visualSliceObjects?: number;
    __visualSliceFps?: number;
    __visualSlicePerformance?: {
      currentFps: number;
      samples: number[];
      objectCount: number;
    };
    /** Sonda de gameplay (WP4.15-V.c.1): objetos renderizados y rebakes de suelo. */
    __gameplayVisualStats?: () => {
      buildings: number;
      decorations: number;
      roadCells: number;
      junctions: number;
      crossings: number;
      streetLights: number;
      trafficLights: number;
      benches: number;
      trashCans: number;
      parkedVehicles: number;
      trees: number;
      totalSprites: number;
      groundRebakes: number;
      groundBakeLastMs: number;
      groundBakeMaxMs: number;
    };
  }
}

/** El catálogo del mapa vive en la UI para que la leyenda y el render compartan fuente. */
export type { MapOverlay } from "../ui/overlay-catalog";

export class IsometricSpikeScene extends Phaser.Scene {
  private readonly layout: IsometricLayout = REFERENCE_LAYOUT;
  private readonly sliceLayout: VisualSliceLayout | undefined;
  private readonly sliceCharacters: boolean;
  private readonly terrainStage: TerrainStage;
  private readonly showGrid: boolean;
  private readonly logFps: boolean;
  private groundPlan: GroundPlan | null = null;
  private readonly screenCenters: ScreenPoint[] = [];
  private mapGraphics?: Phaser.GameObjects.Graphics;
  private structureBlitter?: Phaser.GameObjects.Blitter;
  private agentBlitter?: Phaser.GameObjects.Blitter;
  private structureBobs: Phaser.GameObjects.Bob[] = [];
  private agentBobs: Phaser.GameObjects.Bob[] = [];
  private buildingSprites = new Map<string, Phaser.GameObjects.Image>();
  private sliceObjects: Phaser.GameObjects.GameObject[] = [];
  private assetsReady = false;
  private debugText?: Phaser.GameObjects.Text;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
  private selectedCell: GridCell | null = null;
  private projection: ViewProjectionV2 | null = null;
  private overlay: MapOverlay = "ownership";
  private cellPickedListener?: (cell: GridCell) => void;
  private indicatorListener?: (target: { parcelId: string; buildingId?: string }) => void;
  private indicatorLayer?: Phaser.GameObjects.Container;
  private indicatorEntries: Array<{
    object: Phaser.GameObjects.Container;
    critical: boolean;
  }> = [];
  private indicatorTooltip?: Phaser.GameObjects.Text;
  private indicatorSignature = "";
  private lastIndicatorZoom = 1;
  private dragStart: { x: number; y: number; scrollX: number; scrollY: number } | null = null;
  private fpsAccumulator = 0;
  private fpsFrames = 0;
  /** Modelo visual del gameplay derivado de la proyección; nulo en modo Visual Slice. */
  private gameplayVisual: GameplayVisualModel | null = null;
  private gameplayGroundKey: string | null = null;
  private groundRebakeCount = 0;
  private groundBakeLastMs = 0;
  private groundBakeMaxMs = 0;
  private buildingArchetypes = new Map<string, string>();
  private decorSprites: Phaser.GameObjects.Image[] = [];
  /** Decalcos de cruces derivados de la proyección; se reconstruyen sólo con la geometría vial. */
  private roadMarkingSprites: Phaser.GameObjects.Image[] = [];
  private streetFurnitureSprites = new Map<string, Phaser.GameObjects.Image>();
  private parkedVehicleSprites = new Map<string, Phaser.GameObjects.Image>();

  public constructor(options: IsometricSceneOptions = {}) {
    super({ key: "IsometricSpikeScene" });
    this.sliceLayout = options.visualSlice;
    this.sliceCharacters = options.sliceCharacters ?? false;
    this.terrainStage = options.terrainStage ?? "full";
    this.showGrid = options.showGrid ?? false;
    this.logFps = new URLSearchParams(window.location.search).get("fpsDebug") === "1";
  }

  public create(): void {
    this.buildScreenCenterCache();
    this.groundPlan = this.sliceLayout
      ? planGround(this.sliceLayout, this.layout.mapWidth, this.layout.mapHeight)
      : null;
    this.bakeGround();
    this.mapGraphics = this.add.graphics().setDepth(20_000);
    this.createMarkerTexture(STRUCTURE_TEXTURE_KEY, 16, 16, "#d97757");
    this.createMarkerTexture(AGENT_TEXTURE_KEY, 4, 4, "#8fcae7");
    this.structureBlitter = this.add.blitter(0, 0, STRUCTURE_TEXTURE_KEY).setDepth(15_000);
    this.agentBlitter = this.add.blitter(0, 0, AGENT_TEXTURE_KEY).setDepth(15_000);
    this.drawOverlay();
    this.cameras.main.setZoom(1);
    /** La cámara debe poder panear y centrar el distrito completo en cualquier zoom. */
    this.cameras.main.setBounds(-4096, -4096, 16_384, 16_384);
    this.installCameraTestHook();
    window.__gameplayVisualStats = () => ({
      buildings: this.buildingSprites.size,
      decorations: this.decorSprites.length,
      roadCells: this.gameplayVisual?.roadVisuals.length ?? 0,
      junctions:
        this.gameplayVisual?.roadVisuals.filter(
          (road) => road.shape === "t_junction" || road.shape === "intersection",
        ).length ?? 0,
      crossings: this.gameplayVisual?.groundPlan.roadMarkings?.length ?? 0,
      streetLights:
        this.gameplayVisual?.streetFurniture.filter((entry) => entry.kind === "street_light")
          .length ?? 0,
      trafficLights:
        this.gameplayVisual?.streetFurniture.filter((entry) => entry.kind === "traffic_light")
          .length ?? 0,
      benches:
        this.gameplayVisual?.streetFurniture.filter((entry) => entry.kind === "bench").length ?? 0,
      trashCans:
        this.gameplayVisual?.streetFurniture.filter((entry) => entry.kind === "trash_can").length ??
        0,
      parkedVehicles: this.gameplayVisual?.parkedVehicles.length ?? 0,
      trees: this.decorSprites.length,
      totalSprites:
        this.buildingSprites.size +
        this.decorSprites.length +
        this.streetFurnitureSprites.size +
        this.parkedVehicleSprites.size +
        this.roadMarkingSprites.length +
        this.structureBobs.length +
        this.agentBobs.length,
      groundRebakes: this.groundRebakeCount,
      groundBakeLastMs: this.groundBakeLastMs,
      groundBakeMaxMs: this.groundBakeMaxMs,
    });
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("pointermove", this.handlePointerMove, this);
    this.input.on("pointerup", this.handlePointerUp, this);
    this.input.on("wheel", this.handleWheel, this);
    void this.registerBuildingTextures();
  }

  public override update(time: number, delta: number): void {
    this.fpsFrames += 1;
    this.fpsAccumulator += delta;
    if (this.fpsAccumulator >= FPS_WINDOW_MS) {
      const currentFps = Math.round((this.fpsFrames * 1000) / this.fpsAccumulator);
      window.__visualSliceFps = currentFps;
      if (!window.__visualSlicePerformance) {
        window.__visualSlicePerformance = {
          currentFps,
          samples: [],
          objectCount: this.sliceObjects.length,
        };
      } else {
        window.__visualSlicePerformance.currentFps = currentFps;
        window.__visualSlicePerformance.samples.push(currentFps);
      }
      if (this.logFps) {
        window.console.info(
          `[FPS] ${currentFps}, samples: ${window.__visualSlicePerformance.samples.length}`,
        );
      }
      this.fpsFrames = 0;
      this.fpsAccumulator = 0;
    }
    this.updateGameplayStreetLifeVisibility();
    /**
     * V.d-UX · en zoom lejano se ocultan los avisos no críticos para no llenar la ciudad de
     * badges. Los críticos (incendio/colapso) siguen visibles siempre.
     */
    const zoom = this.cameras.main.zoom;
    if (Math.abs(zoom - this.lastIndicatorZoom) > 0.001) {
      this.lastIndicatorZoom = zoom;
      const showSecondary = zoom >= 0.7;
      for (const entry of this.indicatorEntries)
        entry.object.setVisible(entry.critical || showSecondary);
    }
    if (!this.cursors) return;
    const camera = this.cameras.main;
    const speed = 8 / camera.zoom;
    if (this.cursors.left?.isDown) camera.scrollX -= speed;
    if (this.cursors.right?.isDown) camera.scrollX += speed;
    if (this.cursors.up?.isDown) camera.scrollY -= speed;
    if (this.cursors.down?.isDown) camera.scrollY += speed;
  }

  public setProjection(projection: ViewProjectionV2): void {
    this.projection = projection;
    if (!this.sliceLayout) this.syncGameplayVisual();
    this.updateBlitterPositions();
    this.syncBuildingSprites();
    this.drawOverlay();
    this.syncWorldIndicators();
  }

  public setOverlay(overlay: MapOverlay): void {
    this.overlay = overlay;
    this.drawOverlay();
  }

  /** Selección dirigida desde la UI (notificaciones, fichas): sólo presentación. */
  public setSelectedCell(cell: GridCell | null): void {
    this.selectedCell = cell ? { ...cell } : null;
    this.drawOverlay();
  }

  /** Centra la cámara en una celda; respeta `prefers-reduced-motion`. */
  public focusCell(cell: GridCell): void {
    const world = gridToScreen(cell, this.layout);
    const camera = this.cameras.main;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) camera.setScroll(world.x - camera.width / 2, world.y - camera.height / 2);
    else camera.pan(world.x, world.y, 260, Phaser.Math.Easing.Sine.InOut);
  }

  /** Click en un indicador de mundo: navega al target sin decidir nada por el jugador. */
  public setIndicatorListener(
    listener: (target: { parcelId: string; buildingId?: string }) => void,
  ): void {
    this.indicatorListener = listener;
  }

  public setCellPickedListener(listener: (cell: GridCell) => void): void {
    this.cellPickedListener = listener;
  }

  private debugLabel(): string {
    const selected = this.selectedCell ? `${this.selectedCell.x},${this.selectedCell.y}` : "—";
    return `cell: ${selected} | zoom: ${this.cameras.main.zoom.toFixed(2)}`;
  }

  /**
   * Hornea el suelo del distrito una sola vez en una CanvasTexture con Canvas 2D. No se usa
   * Graphics: en Phaser 4 el horneado de Graphics (RenderTexture.draw / generateTexture) no resulta
   * fiable y el suelo ya desapareció de la escena una vez, dejando los edificios flotando.
   */
  private bakeGround(): void {
    const bounds = this.groundBounds();
    if (!this.textures.exists(TILE_TEXTURE_KEY)) {
      const texture = this.textures.createCanvas(TILE_TEXTURE_KEY, bounds.width, bounds.height);
      if (texture) {
        this.paintGroundInto(texture.context);
        texture.refresh();
      }
    }
    this.add.image(bounds.x, bounds.y, TILE_TEXTURE_KEY).setOrigin(0, 0).setDepth(0);
    /** Los decalcos viales son la capa 4: sólo aparecen en el horneado completo con calzadas. */
    if (this.groundPlan && this.terrainStage === "full" && this.groundPlan.crossings.length > 0) {
      this.drawCrossings();
    }
  }

  private paintGroundInto(context: CanvasRenderingContext2D): void {
    const startedAt = performance.now();
    paintGround({
      context,
      document: this.game.canvas.ownerDocument,
      layout: this.layout,
      bounds: this.groundBounds(),
      plan: this.groundPlan,
      stage: this.terrainStage,
      showGrid: this.showGrid,
      // El Visual Slice conserva sus aceras fixture; gameplay marca todo frente asphalt/no-asphalt.
      curbMode: this.sliceLayout ? "pavement" : "all_non_asphalt",
    });
    this.groundBakeLastMs = performance.now() - startedAt;
    this.groundBakeMaxMs = Math.max(this.groundBakeMaxMs, this.groundBakeLastMs);
  }

  /** Repinta la textura de suelo ya creada sin volver a instanciar la imagen del mapa. */
  private repaintGround(): void {
    const existing = this.textures.exists(TILE_TEXTURE_KEY)
      ? (this.textures.get(TILE_TEXTURE_KEY) as Phaser.Textures.CanvasTexture)
      : undefined;
    if (existing?.context) {
      this.paintGroundInto(existing.context);
      existing.refresh();
      return;
    }
    this.bakeGround();
  }

  /**
   * Reconstruye el modelo visual del gameplay desde la proyección. Sólo repinta el suelo y las
   * decoraciones cuando cambia la clave de geometría, no cuando cambian caja, renta, condición o tick.
   */
  private syncGameplayVisual(): void {
    const projection = this.projection;
    if (!projection) return;
    const model = buildGameplayVisualModel(projection);
    if (model.geometryKey === this.gameplayGroundKey) return;
    this.gameplayGroundKey = model.geometryKey;
    this.gameplayVisual = model;
    this.groundPlan = model.groundPlan;
    this.buildingArchetypes = new Map(model.buildings.map((entry) => [entry.id, entry.archetype]));
    this.repaintGround();
    this.groundRebakeCount += 1;
    this.renderGameplayRoadMarkings();
    if (this.assetsReady) this.renderGameplayStreetLife();
  }

  /** Coloca la decoración sin carretera (árboles) derivada del modelo visual de gameplay. */
  private renderGameplayDecorations(): void {
    for (const sprite of this.decorSprites) sprite.destroy();
    this.decorSprites = [];
    const model = this.gameplayVisual;
    if (!model || !this.assetsReady) return;
    const assets = ASSETS_BLENDER.props ?? {};
    for (const decoration of model.decorations) {
      const asset = assets[decoration.asset];
      if (!asset) continue;
      const key = `blender-sprite-${decoration.asset}`;
      if (!this.textures.exists(key)) continue;
      const frame = this.sceneryFrame(asset, undefined);
      const center = gridToScreen(footprintCenter(decoration.cell, asset.footprint), this.layout);
      const image = this.add
        .image(center.x, center.y, key)
        .setOrigin(frame.pivot.x, frame.pivot.y)
        .setScale(spriteScaleFor(asset, this.layout.tileWidth) * decoration.scale)
        .setDepth(depthForAsset(decoration.cell, asset.footprint));
      image.setVisible(this.isInViewport(center.x, center.y, this.cameras.main.worldView, 96));
      this.decorSprites.push(image);
    }
  }

  private renderGameplayStreetLife(): void {
    this.renderGameplayDecorations();
    const model = this.gameplayVisual;
    if (!model || !this.assetsReady) return;
    const props = ASSETS_BLENDER.props ?? {};
    const seenFurniture = new Set<string>();
    for (const furniture of model.streetFurniture) {
      const asset = props[furniture.asset];
      if (!asset) continue;
      const frame = this.sceneryFrame(asset, furniture.azimuth);
      const center = gridToScreen(furniture.cell, this.layout);
      const offset = furniture.curbEdge
        ? this.screenOffsetTowardRoad(furniture.curbEdge, 0.28)
        : { x: 0, y: 0 };
      const key = `blender-sprite-${furniture.asset}${frame.keySuffix}`;
      if (!this.textures.exists(key)) continue;
      const image =
        this.streetFurnitureSprites.get(furniture.id) ??
        this.add.image(center.x + offset.x, center.y + offset.y, key);
      this.streetFurnitureSprites.set(furniture.id, image);
      image
        .setTexture(key)
        .setPosition(center.x + offset.x, center.y + offset.y)
        .setOrigin(frame.pivot.x, frame.pivot.y)
        .setScale(spriteScaleFor(frame, this.layout.tileWidth) * furniture.scale)
        .setDepth(depthForAsset(furniture.cell, asset.footprint));
      image.setVisible(this.isInViewport(image.x, image.y, this.cameras.main.worldView, 96));
      seenFurniture.add(furniture.id);
    }
    for (const [id, sprite] of this.streetFurnitureSprites) {
      if (seenFurniture.has(id)) continue;
      sprite.destroy();
      this.streetFurnitureSprites.delete(id);
    }
    const vehicles = ASSETS_BLENDER.vehicles ?? {};
    const seenVehicles = new Set<string>();
    for (const vehicle of model.parkedVehicles) {
      const asset = vehicles[vehicle.asset];
      if (!asset) continue;
      const frame = this.sceneryFrame(asset, vehicle.azimuth);
      const key = `blender-sprite-${vehicle.asset}${frame.keySuffix}`;
      if (!this.textures.exists(key)) continue;
      const center = gridToScreen(footprintCenter(vehicle.roadCell, asset.footprint), this.layout);
      const offset = this.screenOffsetForVehicle(vehicle);
      const image =
        this.parkedVehicleSprites.get(vehicle.id) ??
        this.add.image(center.x + offset.x, center.y + offset.y, key);
      this.parkedVehicleSprites.set(vehicle.id, image);
      image
        .setTexture(key)
        .setPosition(center.x + offset.x, center.y + offset.y)
        .setOrigin(frame.pivot.x, frame.pivot.y)
        .setScale(spriteScaleFor(frame, this.layout.tileWidth) * vehicle.scale)
        .setDepth(depthForAsset(vehicle.roadCell, asset.footprint));
      image.setVisible(this.isInViewport(image.x, image.y, this.cameras.main.worldView, 128));
      seenVehicles.add(vehicle.id);
    }
    for (const [id, sprite] of this.parkedVehicleSprites) {
      if (seenVehicles.has(id)) continue;
      sprite.destroy();
      this.parkedVehicleSprites.delete(id);
    }
  }

  private screenOffsetTowardRoad(edge: "n" | "e" | "s" | "w", cells: number): ScreenPoint {
    const delta =
      edge === "n"
        ? { x: 0, y: cells }
        : edge === "e"
          ? { x: -cells, y: 0 }
          : edge === "s"
            ? { x: 0, y: -cells }
            : { x: cells, y: 0 };
    const origin = gridToScreen({ x: 0, y: 0 }, this.layout);
    const target = gridToScreen(delta, this.layout);
    return { x: target.x - origin.x, y: target.y - origin.y };
  }

  private screenOffsetForVehicle(vehicle: GameplayParkedVehicle): ScreenPoint {
    const lateral =
      vehicle.side === "n"
        ? { x: 0, y: -vehicle.lateralOffset }
        : vehicle.side === "e"
          ? { x: vehicle.lateralOffset, y: 0 }
          : vehicle.side === "s"
            ? { x: 0, y: vehicle.lateralOffset }
            : { x: -vehicle.lateralOffset, y: 0 };
    const longitudinal =
      vehicle.azimuth === 45
        ? { x: 0, y: vehicle.longitudinalOffset }
        : { x: vehicle.longitudinalOffset, y: 0 };
    const origin = gridToScreen({ x: 0, y: 0 }, this.layout);
    const target = gridToScreen(
      { x: lateral.x + longitudinal.x, y: lateral.y + longitudinal.y },
      this.layout,
    );
    return { x: target.x - origin.x, y: target.y - origin.y };
  }

  private updateGameplayStreetLifeVisibility(): void {
    if (this.sliceLayout) return;
    const view = this.cameras.main.worldView;
    for (const sprite of [...this.decorSprites, ...this.streetFurnitureSprites.values()]) {
      sprite.setVisible(this.isInViewport(sprite.x, sprite.y, view, 96));
    }
    for (const sprite of this.parkedVehicleSprites.values()) {
      sprite.setVisible(this.isInViewport(sprite.x, sprite.y, view, 128));
    }
  }

  /**
   * Renderiza pasos de peatones sólo en T y cruces publicados por la simulación. Los decals no
   * rederivan carreteras: consumen la máscara que ya calculó el adapter desde `roads.cells`.
   */
  private renderGameplayRoadMarkings(): void {
    for (const sprite of this.roadMarkingSprites) sprite.destroy();
    this.roadMarkingSprites = [];
    const markings = this.groundPlan?.roadMarkings ?? [];
    for (const marking of markings) {
      const key = `${CROSSING_TEXTURE_KEY}-${marking.mask}`;
      if (!this.textures.exists(key)) {
        const texture = this.textures.createCanvas(
          key,
          CROSSING_TEXTURE.width,
          CROSSING_TEXTURE.height,
        );
        if (texture) {
          paintCrossing(texture.context, this.layout, marking.mask);
          texture.refresh();
        }
      }
      if (!this.textures.exists(key)) continue;
      const center = this.screenCenter(marking.cell);
      this.roadMarkingSprites.push(
        this.add.image(center.x, center.y, key).setOrigin(0.5, 0.5).setDepth(ROAD_MARKING_DEPTH),
      );
    }
  }

  /**
   * Pasos de peatones sobre la calzada. Una sola textura horneada se reutiliza en cada cruce: la
   * calzada es un sprite de Blender por encima del suelo, así que su marca vial va en su propia capa.
   */
  private drawCrossings(): void {
    const plan = this.groundPlan;
    if (!plan) return;
    if (!this.textures.exists(CROSSING_TEXTURE_KEY)) {
      const texture = this.textures.createCanvas(
        CROSSING_TEXTURE_KEY,
        CROSSING_TEXTURE.width,
        CROSSING_TEXTURE.height,
      );
      if (texture) {
        paintCrossing(texture.context, this.layout);
        texture.refresh();
      }
    }
    for (const crossing of plan.crossings) {
      const center = this.screenCenter(crossing);
      const image = this.add
        .image(center.x, center.y, CROSSING_TEXTURE_KEY)
        .setOrigin(0.5, 0.5)
        .setDepth(ROAD_MARKING_DEPTH);
      this.sliceObjects.push(image);
    }
  }

  private groundBounds(): GroundBounds {
    const halfWidth = this.layout.tileWidth / 2;
    const halfHeight = this.layout.tileHeight / 2;
    return {
      x: this.layout.origin.x - (this.layout.mapHeight - 1) * halfWidth - halfWidth,
      y: this.layout.origin.y - halfHeight,
      width: (this.layout.mapWidth + this.layout.mapHeight) * halfWidth,
      height: (this.layout.mapWidth + this.layout.mapHeight) * halfHeight,
    };
  }

  private drawOverlay(): void {
    const graphics = this.mapGraphics;
    if (!graphics) return;
    graphics.clear();
    /** Vista normal: sin contornos semánticos; la ciudad se lee por sus sprites. */
    if (this.overlay === "none") return;
    for (const parcel of this.projection?.economy?.parcels ?? []) {
      const center = this.screenCenter(parcel.cell);
      const halfWidth = this.layout.tileWidth / 2 - 4;
      const halfHeight = this.layout.tileHeight / 2 - 3;
      const color = this.parcelOverlayColor(parcel);
      graphics.lineStyle(2, color, 0.9);
      graphics.beginPath();
      graphics.moveTo(center.x, center.y - halfHeight);
      graphics.lineTo(center.x + halfWidth, center.y);
      graphics.lineTo(center.x, center.y + halfHeight);
      graphics.lineTo(center.x - halfWidth, center.y);
      graphics.closePath();
      graphics.strokePath();
    }
    /**
     * H2-01: el overlay es el fallback mientras los sprites no están listos, así que también debe
     * leerse por la huella física del edificio. Antes se resolvía la parcela vía
     * `parcel.buildingId === building.id`, que es sólo el primer edificio derivado, así que un
     * parcela multi-edificio ocultaba al segundo también aquí.
     */
    const buildingById = new Map<string, { footprintCells: readonly GridCell[]; level: number }>();
    for (const building of this.projection?.economy?.buildings ?? []) {
      buildingById.set(building.id, {
        footprintCells: building.footprintCells,
        level: building.level,
      });
    }
    for (const building of this.projection?.economy?.buildings ?? []) {
      if (this.assetsReady) break;
      const center = gridToScreen(footprintVisualCenter(building.footprintCells), this.layout);
      graphics.fillStyle(
        building.state === "ruin"
          ? COLORS.ruin
          : building.state === "burning" || building.state === "collapse_pending"
            ? COLORS.fire
            : COLORS.building,
        0.9,
      );
      graphics.fillRect(center.x - 7, center.y - 12, 14, 12 + building.level * 3);
    }
    for (const site of this.projection?.economy?.constructionSites ?? []) {
      const center = gridToScreen(footprintVisualCenter(site.footprintCells), this.layout);
      graphics.lineStyle(3, COLORS.construction, 1);
      graphics.strokeRect(center.x - 8, center.y - 8, 16, 8);
      graphics.fillStyle(COLORS.construction, 1);
      graphics.fillRect(
        center.x - 8,
        center.y - 8,
        16 * Math.min(1, site.progress / site.workRequired),
        3,
      );
    }
    for (const incident of this.projection?.economy?.incidents.filter(
      (entry) => entry.status === "active",
    ) ?? []) {
      const building = buildingById.get(incident.buildingId);
      if (!building) continue;
      const center = gridToScreen(footprintVisualCenter(building.footprintCells), this.layout);
      graphics.fillStyle(COLORS.fire, 0.9);
      graphics.fillCircle(center.x + 8, center.y - 14, 4 + Math.min(6, incident.intensity / 20));
    }
    if (this.selectedCell) {
      const center = this.screenCenter(this.selectedCell);
      const halfWidth = this.layout.tileWidth / 2;
      const halfHeight = this.layout.tileHeight / 2;
      graphics.lineStyle(3, COLORS.selected, 1);
      graphics.beginPath();
      graphics.moveTo(center.x, center.y - halfHeight);
      graphics.lineTo(center.x + halfWidth, center.y);
      graphics.lineTo(center.x, center.y + halfHeight);
      graphics.lineTo(center.x - halfWidth, center.y);
      graphics.closePath();
      graphics.strokePath();
    }
  }

  private parcelOverlayColor(
    parcel: NonNullable<ViewProjectionV2["economy"]>["parcels"][number],
  ): number {
    /**
     * H2-01: en una parcela multi-edificio el overlay debe enseñar el peor caso, no el primero.
     * `parcel.buildingId` sólo publica el primer edificio derivado; usarlo para colorear hacía que
     * un edificio en ruinas pasara desapercibido si otro edificio de la parcela estaba intacto.
     */
    const buildingsOfParcel = (this.projection?.economy?.buildings ?? []).filter(
      (entry) => entry.parcelId === parcel.id,
    );
    if (this.overlay === "condition") {
      if (buildingsOfParcel.length === 0) return COLORS.parcelAvailable;
      const worst = Math.min(...buildingsOfParcel.map((entry) => entry.condition));
      if (worst <= 35) return COLORS.fire;
      if (worst <= 70) return COLORS.construction;
      return COLORS.parcelPlayer;
    }
    if (this.overlay === "profitability") {
      if (buildingsOfParcel.length === 0) return COLORS.parcelAvailable;
      /**
       * Rentabilidad agregada: la suma de rentas menos la suma de deudas. Si la parcela en conjunto
       * pierde, el rojo manda; si gana menos del doble, ámbar; si dobla la deuda, verde. Es la misma
       * banda que antes aplicada al primer edificio, pero ahora es la de la parcela.
       */
      const rent = buildingsOfParcel.reduce((total, entry) => total + entry.effectiveRent, 0);
      const due = buildingsOfParcel.reduce((total, entry) => total + entry.maintenanceDue, 0);
      if (rent <= due) return COLORS.fire;
      if (rent < due * 2) return COLORS.construction;
      return COLORS.parcelPlayer;
    }
    if (this.overlay === "zoning") return ZONING_COLORS[parcel.zoning];
    if (this.overlay === "risk") {
      if (parcel.regulatoryRiskPercent >= 30) return COLORS.fire;
      if (parcel.regulatoryRiskPercent >= 15) return COLORS.construction;
      return COLORS.parcelPlayer;
    }
    if (this.overlay === "landValue") {
      const score = parcel.landValueBreakdown.score;
      if (score >= 25) return COLORS.parcelPlayer;
      if (score >= 5) return COLORS.construction;
      if (score >= -10) return COLORS.parcelAvailable;
      return COLORS.fire;
    }
    if (this.overlay === "urbanRole") {
      const colors: Record<string, number> = ROLE_COLORS;
      return colors[parcel.urbanRole] ?? COLORS.parcelAvailable;
    }
    if (this.overlay === "developmentCode") {
      let hash = 0;
      for (let index = 0; index < parcel.developmentCodeId.length; index += 1) {
        hash = (hash * 31 + parcel.developmentCodeId.charCodeAt(index)) >>> 0;
      }
      return CODE_PALETTE[hash % CODE_PALETTE.length]!;
    }
    if (this.overlay === "use") {
      const use = parcel.currentUses[0] ?? parcel.allowedUses[0] ?? "residential";
      const colors: Record<string, number> = USE_COLORS;
      return colors[use] ?? COLORS.parcelAvailable;
    }
    if (
      this.overlay === "security" ||
      this.overlay === "fire" ||
      this.overlay === "health" ||
      this.overlay === "education" ||
      this.overlay === "transport"
    ) {
      const coverage = parcel.serviceCoverage?.[this.overlay] ?? 0;
      if (coverage >= 75) return COLORS.parcelPlayer;
      if (coverage >= 40) return COLORS.construction;
      if (coverage > 0) return COLORS.parcelAvailable;
      return COLORS.fire;
    }
    return parcel.ownerOrganizationId === "org_00000001"
      ? COLORS.parcelPlayer
      : parcel.ownerOrganizationId === "org_00000002"
        ? COLORS.parcelRival
        : parcel.ownerOrganizationId === "org_00000004"
          ? COLORS.parcelCivic
          : COLORS.parcelAvailable;
  }

  private createMarkerTexture(key: string, width: number, height: number, color: string): void {
    if (this.textures.exists(key)) return;
    const texture = this.textures.createCanvas(key, width, height);
    if (!texture) return;
    texture.context.fillStyle = color;
    texture.context.fillRect(0, 0, width, height);
    texture.refresh();
  }

  /**
   * Compila las imágenes del manifiesto en texturas de Phaser. El contrato viaja como SVG en data
   * URI; el navegador lo rasteriza al cargar. Si una textura falla, se conserva el rectángulo de
   * respaldo en vez de romper la escena.
   */
  private async registerBuildingTextures(): Promise<void> {
    await this.registerTexturesFromBundle(ASSETS, "");
    await this.registerTexturesFromBundle(ASSETS_BLENDER, "blender-");
    if (this.sliceCharacters) await this.registerSliceCharacterTextures();
    this.assetsReady = true;
    this.syncBuildingSprites();
    this.drawOverlay();
    if (this.sliceLayout) this.renderVisualSlice();
    else this.renderGameplayStreetLife();
  }

  private async registerTexturesFromBundle(
    manifest: RuntimeAssetManifestV2,
    keyPrefix: string,
  ): Promise<void> {
    for (const [type, asset] of Object.entries(manifest.buildings)) {
      for (const [state, image] of Object.entries(asset.states)) {
        const key = `${keyPrefix}${spriteKeyFor(type, state as BuildingAssetState)}`;
        await this.registerImageTexture(key, image.src, image.width, image.height);
      }
    }
    for (const group of ["terrain", "props", "vehicles"] as const) {
      for (const [id, asset] of Object.entries(manifest[group] ?? {})) {
        const key = `${keyPrefix}sprite-${id}`;
        await this.registerImageTexture(
          key,
          asset.image.src,
          asset.image.width,
          asset.image.height,
        );
        for (const [azimuth, frame] of Object.entries(asset.orientations ?? {})) {
          await this.registerImageTexture(
            `${key}-az${azimuth}`,
            frame.image.src,
            frame.image.width,
            frame.image.height,
          );
        }
      }
    }
  }

  /** Rasteriza un src (data URI o ruta) en una textura de Phaser; un fallo no bloquea al resto. */
  private async registerImageTexture(
    key: string,
    src: string,
    width: number,
    height: number,
  ): Promise<void> {
    if (this.textures.exists(key)) return;
    const element = new Image();
    element.src = src;
    try {
      await element.decode();
    } catch {
      return;
    }
    if (!element.complete || element.naturalWidth === 0) return;
    const texture = this.textures.createCanvas(key, width, height);
    if (!texture) return;
    texture.context.drawImage(element, 0, 0, width, height);
    texture.refresh();
  }

  private async registerSliceCharacterTextures(): Promise<void> {
    for (const [id, character] of Object.entries(ASSETS.characters)) {
      for (const animation of ["idle", "walk"] as const) {
        for (const [index, frame] of character.animations[animation].frames.entries()) {
          await this.registerImageTexture(
            `character-${id}-${animation}-${index}`,
            frame.src,
            frame.width,
            frame.height,
          );
        }
      }
    }
  }

  /** Capa de presentación del Visual Slice: suelo, edificios, props, vehículos y personajes. */
  private renderVisualSlice(): void {
    const slice = this.sliceLayout;
    if (!slice || !this.assetsReady) return;
    for (const tile of slice.terrain) {
      const key = `blender-sprite-${tile.asset}`;
      const asset = ASSETS_BLENDER.terrain?.[tile.asset];
      if (!asset || !this.textures.exists(key)) continue;
      const center = this.screenCenter(tile.cell);
      const image = this.add
        .image(center.x, center.y, key)
        .setOrigin(asset.pivot.x, asset.pivot.y)
        .setScale(spriteScaleFor(asset, this.layout.tileWidth) * (tile.scale ?? 1))
        .setFlipX(tile.flipX ?? false)
        .setDepth(TERRAIN_DEPTH + tile.cell.x + tile.cell.y);
      this.sliceObjects.push(image);
    }
    const blenderKeys = new Set(this.textures.getTextureKeys());
    for (const building of slice.buildings) {
      const asset = assetFor(ASSETS_BLENDER, building.type) ?? assetFor(ASSETS, building.type);
      const proceduralKey = spriteKeyFor(building.type, building.state ?? "complete");
      const key = selectBuildingTextureKey(proceduralKey, blenderKeys);
      if (!asset || !this.textures.exists(key)) continue;
      const center = gridToScreen(footprintCenter(building.cell, asset.footprint), this.layout);
      const image = this.add
        .image(center.x, center.y, key)
        .setOrigin(asset.pivot.x, asset.pivot.y)
        .setScale(spriteScaleFor(asset, this.layout.tileWidth) * SLICE_BUILDING_SCALE)
        .setFlipX(building.flipX ?? false)
        .setDepth(depthForAsset(building.cell, asset.footprint));
      this.sliceObjects.push(image);
    }
    // Quaternius A/B test: load evidence PNG if ?quaternius=1
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("quaternius") === "1") {
      const quaterniusKey = "qa-quaternius-evidence";
      if (!this.textures.exists(quaterniusKey)) {
        const img = new Image();
        img.src = "/assets/runtime-evidence/bld_downtown-complete.png";
        img.onload = () => {
          this.textures.addImage(quaterniusKey, img);
        };
      }
      if (this.textures.exists(quaterniusKey)) {
        const quaterniusCell = { x: 32, y: 24 };
        const quaterniusFootprint = { width: 4, height: 4 };
        const center = gridToScreen(
          footprintCenter(quaterniusCell, quaterniusFootprint),
          this.layout,
        );
        const image = this.add
          .image(center.x, center.y, quaterniusKey)
          .setOrigin(0.6456, 0.8479) // pivot from evidence metadata
          .setScale(SLICE_BUILDING_SCALE)
          .setDepth(depthForAsset(quaterniusCell, quaterniusFootprint));
        this.sliceObjects.push(image);
      }
    }
    for (const [group, placements] of [
      ["props", slice.props],
      ["vehicles", slice.vehicles],
    ] as const) {
      const assets = ASSETS_BLENDER[group] ?? {};
      for (const placement of placements) {
        const asset = assets[placement.asset];
        if (!asset) continue;
        const frame = this.sceneryFrame(asset, placement.azimuth);
        const key = `blender-sprite-${placement.asset}${frame.keySuffix}`;
        if (!this.textures.exists(key)) continue;
        const center = gridToScreen(footprintCenter(placement.cell, asset.footprint), this.layout);
        const offset = "offset" in placement ? placement.offset : undefined;
        const depth = depthForAsset(placement.cell, asset.footprint);
        const image = this.add
          .image(center.x + (offset?.x ?? 0), center.y + (offset?.y ?? 0), key)
          .setOrigin(frame.pivot.x, frame.pivot.y)
          .setScale(
            spriteScaleFor(frame, this.layout.tileWidth) *
              ("scale" in placement ? (placement.scale ?? 1) : 1),
          )
          .setFlipX(placement.flipX ?? false)
          .setDepth(depth);
        this.sliceObjects.push(image);
      }
    }
    if (slice.lots?.length) this.drawSliceLots(slice.lots);
    if (this.sliceCharacters) {
      for (const character of slice.characters) {
        const asset = ASSETS.characters["vecino_variante"];
        const key = `character-vecino_variante-idle-${character.direction * 2}`;
        if (!asset || !this.textures.exists(key)) continue;
        const center = this.screenCenter(character.cell);
        const image = this.add
          .image(center.x, center.y, key)
          .setOrigin(0.5, 0.94)
          .setScale(0.7)
          .setDepth(depthForAsset(character.cell, { width: 1, height: 1 }));
        this.sliceObjects.push(image);
        this.addSliceShadow(image, center.x, center.y, image.depth);
      }
    }
    window.__visualSliceReady = true;
    window.__visualSliceObjects = this.sliceObjects.length;
    window.__visualSlicePerformance = {
      currentFps: 0,
      samples: [],
      objectCount: this.sliceObjects.length,
    };
  }

  /** Frame por defecto o variante de orientación de un asset escénico. */
  private sceneryFrame(
    asset: SceneryAssetV1,
    azimuth: number | undefined,
  ): { keySuffix: string; pivot: { x: number; y: number }; pixelsPerMeter: number | undefined } {
    const frame = azimuth === undefined ? undefined : asset.orientations?.[String(azimuth)];
    return frame
      ? { keySuffix: `-az${azimuth}`, pivot: frame.pivot, pixelsPerMeter: frame.pixelsPerMeter }
      : { keySuffix: "", pivot: asset.pivot, pixelsPerMeter: asset.pixelsPerMeter };
  }

  /** Contorno discontinuo de parcela en obra: lenguaje visual del juego, sólo presentación. */
  private drawSliceLots(lots: SliceLot[]): void {
    const graphics = this.add.graphics().setDepth(CONSTRUCTION_SITE_DEPTH);
    const halfWidth = this.layout.tileWidth / 2;
    const halfHeight = this.layout.tileHeight / 2;
    for (const lot of lots) {
      const northWest = gridToScreen(lot.from, this.layout);
      const northEast = gridToScreen({ x: lot.to.x, y: lot.from.y }, this.layout);
      const southEast = gridToScreen(lot.to, this.layout);
      const southWest = gridToScreen({ x: lot.from.x, y: lot.to.y }, this.layout);
      const corners = [
        { x: northWest.x, y: northWest.y - halfHeight },
        { x: northEast.x + halfWidth, y: northEast.y },
        { x: southEast.x, y: southEast.y + halfHeight },
        { x: southWest.x - halfWidth, y: southWest.y },
      ];
      graphics.lineStyle(2, COLORS.construction, 0.85);
      for (let index = 0; index < corners.length; index += 1) {
        this.drawDashedSegment(graphics, corners[index]!, corners[(index + 1) % corners.length]!);
      }
      graphics.fillStyle(COLORS.construction, 0.9);
      for (const corner of corners) graphics.fillRect(corner.x - 2, corner.y - 2, 4, 4);
    }
    this.sliceObjects.push(graphics);
  }

  private drawDashedSegment(
    graphics: Phaser.GameObjects.Graphics,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): void {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const dash = 7;
    const gap = 5;
    for (let travelled = 0; travelled < length; travelled += dash + gap) {
      const start = Math.min(1, travelled / length);
      const end = Math.min(1, (travelled + dash) / length);
      graphics.beginPath();
      graphics.moveTo(from.x + (to.x - from.x) * start, from.y + (to.y - from.y) * start);
      graphics.lineTo(from.x + (to.x - from.x) * end, from.y + (to.y - from.y) * end);
      graphics.strokePath();
    }
  }

  /**
   * Sombra de contacto para los personajes procedurales, que no pasan por el bake de Blender.
   */
  private addSliceShadow(
    image: Phaser.GameObjects.Image,
    x: number,
    y: number,
    depth: number,
  ): void {
    const key = this.ensureSliceShadowTexture();
    if (!this.textures.exists(key)) return;
    const width = Math.max(12, image.displayWidth * 0.95);
    const shadow = this.add
      .image(x - 6, y + 3, key)
      .setOrigin(0.5, 0.5)
      .setScale(width / 64, (width * 0.36) / 32)
      .setAlpha(0.55)
      .setDepth(depth - 0.5);
    this.sliceObjects.push(shadow);
  }

  private ensureSliceShadowTexture(): string {
    if (this.textures.exists(SLICE_SHADOW_TEXTURE_KEY)) return SLICE_SHADOW_TEXTURE_KEY;
    const texture = this.textures.createCanvas(SLICE_SHADOW_TEXTURE_KEY, 64, 32);
    if (!texture) return SLICE_SHADOW_TEXTURE_KEY;
    const gradient = texture.context.createRadialGradient(32, 16, 2, 32, 16, 30);
    gradient.addColorStop(0, "rgba(10, 16, 26, 0.55)");
    gradient.addColorStop(0.55, "rgba(10, 16, 26, 0.3)");
    gradient.addColorStop(1, "rgba(10, 16, 26, 0)");
    texture.context.fillStyle = gradient;
    texture.context.fillRect(0, 0, 64, 32);
    texture.refresh();
    return SLICE_SHADOW_TEXTURE_KEY;
  }

  /** Mantiene un sprite por edificio y sitio de obra, con pivote y depth derivados del manifiesto. */
  private syncBuildingSprites(): void {
    if (!this.assetsReady || !this.projection?.economy) return;
    const economy = this.projection.economy;
    const view = this.cameras.main.worldView;
    /**
     * H2-01: el plan de sprites es puro y se construye recorriendo `economy.buildings` y
     * `economy.constructionSites` una vez cada uno, con su `footprintCells` real. Antes el scene
     * resolvía cada edificio buscando `parcel.buildingId === building.id`, que sólo publica el
     * primer edificio derivado: una parcela con dos edificios pintaba uno. Ahora la paridad
     * "sprites == entradas proyectadas renderizables" se sostiene por construcción y se prueba
     * en `building-sprites.test.ts`.
     */
    const plan = buildingSpritePlan(economy, {
      archetypeFor: (id, domainType) => this.buildingArchetypes.get(id) ?? domainType,
      resolveVisual: (archetype, domainType, state) =>
        this.resolveBuildingVisual(archetype, domainType, state),
    });
    const seen = new Set<string>();
    for (const placement of plan) {
      const center = gridToScreen(footprintVisualCenter(placement.cells), this.layout);
      const sprite = this.ensureBuildingSprite(placement.id, placement.textureKey, placement.asset);
      sprite.setPosition(center.x, center.y);
      sprite.setScale(spriteScaleFor(placement.asset, this.layout.tileWidth));
      sprite.setDepth(depthForFootprintCells(placement.cells) + placement.depthBias);
      sprite.setAlpha(placement.alpha);
      sprite.setVisible(this.isInViewport(center.x, center.y, view, 96));
      seen.add(placement.id);
    }
    for (const [id, sprite] of this.buildingSprites) {
      if (seen.has(id)) continue;
      sprite.destroy();
      this.buildingSprites.delete(id);
    }
  }

  /**
   * Prioriza el asset Blender del archetype resuelto por el adapter; si no existe, cae al procedural
   * del tipo de dominio. Un edificio nunca desaparece por falta de un Blender: el fallback sostiene
   * la cadena `simulation → projection → archetype → Blender si existe → procedural fallback`.
   *
   * H2-02 · la cadena vive en `resolveBuildingVisual` (helper puro de `building-sprites.ts`); aquí
   * sólo se inyectan los bundles registrados y el estado de `this.textures`, así que los 15 tipos
   * del catálogo se pueden probar sin levantar la escena.
   */
  private resolveBuildingVisual(
    archetype: string,
    domainType: string,
    state: BuildingAssetState,
  ): { key: string; asset: BuildingAssetV1 } | null {
    return resolveBuildingVisual(archetype, domainType, state, {
      blenderBundle: ASSETS_BLENDER,
      proceduralBundle: ASSETS,
      textureExists: (key) => this.textures.exists(key),
      azimuth: SCENE_AZIMUTH,
    });
  }

  private ensureBuildingSprite(
    id: string,
    key: string,
    asset: BuildingAssetV1,
  ): Phaser.GameObjects.Image {
    let sprite = this.buildingSprites.get(id);
    if (!sprite) {
      sprite = this.add.image(0, 0, key);
      this.buildingSprites.set(id, sprite);
    } else if (sprite.texture.key !== key) {
      sprite.setTexture(key);
    }
    const origin = originFromPivot(asset);
    sprite.setOrigin(origin.x, origin.y);
    return sprite;
  }

  private buildScreenCenterCache(): void {
    for (let y = 0; y < this.layout.mapHeight; y += 1) {
      for (let x = 0; x < this.layout.mapWidth; x += 1) {
        this.screenCenters[y * this.layout.mapWidth + x] = gridToScreen({ x, y }, this.layout);
      }
    }
  }

  private screenCenter(cell: GridCell): ScreenPoint {
    return this.screenCenters[cell.y * this.layout.mapWidth + cell.x]!;
  }

  private updateBlitterPositions(): void {
    const structures = this.projection?.structures ?? [];
    const agents = this.projection?.agents ?? [];
    const view = this.cameras.main.worldView;
    if (this.structureBlitter) {
      while (this.structureBobs.length < structures.length) {
        this.structureBobs.push(this.structureBlitter.create(0, 0));
      }
      this.structureBobs.forEach((bob, index) => {
        const structure = structures[index];
        if (!structure) {
          if (bob.visible) bob.setVisible(false);
          return;
        }
        const center = this.screenCenter(structure.cell);
        if (!this.isInViewport(center.x, center.y, view, 16)) {
          if (bob.visible) bob.setVisible(false);
          return;
        }
        bob.setPosition(center.x - 8, center.y - 10);
        if (!bob.visible) bob.setVisible(true);
      });
    }
    if (this.agentBlitter) {
      while (this.agentBobs.length < agents.length)
        this.agentBobs.push(this.agentBlitter.create(0, 0));
      this.agentBobs.forEach((bob, index) => {
        const agent = agents[index];
        if (!agent) {
          if (bob.visible) bob.setVisible(false);
          return;
        }
        const center = this.screenCenter(agent.cell);
        if (!this.isInViewport(center.x, center.y, view, 4)) {
          if (bob.visible) bob.setVisible(false);
          return;
        }
        bob.setPosition(center.x - 2, center.y - 8);
        const tint =
          agent.state === "dead"
            ? 0x555555
            : agent.state === "injured"
              ? 0xe0a23b
              : agent.specialty === "enforcer"
                ? 0xd95757
                : agent.specialty === "maintenance_technician"
                  ? 0xb48ead
                  : agent.organizationId === "org_00000002"
                    ? 0xd97757
                    : 0x8fcae7;
        bob.setTint(tint);
        if (!bob.visible) bob.setVisible(true);
      });
    }
  }

  private isInViewport(x: number, y: number, view: Phaser.Geom.Rectangle, margin: number): boolean {
    return (
      x + margin >= view.x &&
      x - margin <= view.right &&
      y + margin >= view.y &&
      y - margin <= view.bottom
    );
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.rightButtonDown()) {
      this.dragStart = {
        x: pointer.x,
        y: pointer.y,
        scrollX: this.cameras.main.scrollX,
        scrollY: this.cameras.main.scrollY,
      };
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragStart || !pointer.isDown) return;
    const camera = this.cameras.main;
    const dx = (pointer.x - this.dragStart.x) / camera.zoom;
    const dy = (pointer.y - this.dragStart.y) / camera.zoom;
    camera.setScroll(this.dragStart.scrollX - dx, this.dragStart.scrollY - dy);
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.rightButtonReleased()) {
      this.dragStart = null;
      return;
    }
    const camera = this.cameras.main;
    const world = camera.getWorldPoint(pointer.x, pointer.y);
    const selected = pickGridCell(
      {
        x: world.x,
        y: world.y,
      },
      this.layout,
    );
    this.selectedCell = selected;
    this.drawOverlay();
    this.debugText?.setText(this.debugLabel());
    if (selected) {
      const value = { ...selected };
      this.events.emit("cell-picked", value);
      this.cellPickedListener?.(value);
    }
  }

  private handleWheel(
    pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number,
  ): void {
    void deltaX;
    void _gameObjects;
    const camera = this.cameras.main;
    const nextZoom = Phaser.Math.Clamp(camera.zoom - deltaY * 0.001, 0.5, 2.5);
    const before = camera.getWorldPoint(pointer.x, pointer.y);
    camera.setZoom(nextZoom);
    // `getWorldPoint` reads Phaser's camera matrix, which is refreshed during pre-render. Refresh it
    // here as well so the second sample observes the new zoom within this wheel event.
    camera.preRender();
    const after = camera.getWorldPoint(pointer.x, pointer.y);
    camera.scrollX += before.x - after.x;
    camera.scrollY += before.y - after.y;
    // Apply bounds now; the next render must not introduce a delayed clamp/jump.
    camera.preRender();
    this.debugText?.setText(this.debugLabel());
  }

  /**
   * V.d-UX · indicadores de mundo (spec §9). Sólo asuntos espaciales y accionables, en orden de
   * prioridad: incendio/colapso > mantenimiento crítico > obra sin cuadrilla. Se reconstruyen
   * únicamente cuando cambia su firma —no hay un nodo por edificio ni un rebuild por tick— y su
   * visibilidad depende del zoom: los críticos siempre, el resto a partir de 0,7.
   */
  private syncWorldIndicators(): void {
    const economy = this.projection?.economy;
    if (!economy) {
      this.indicatorLayer?.setVisible(false);
      return;
    }
    type Indicator = {
      key: string;
      critical: boolean;
      cell: GridCell;
      label: string;
      parcelId: string;
      buildingId?: string;
    };
    const candidates: Indicator[] = [];
    for (const building of economy.buildings) {
      if (building.ownerOrganizationId !== "org_00000001") continue;
      const cell = footprintVisualCenter(building.footprintCells);
      if (building.state === "burning" || building.state === "collapse_pending") {
        candidates.push({
          key: `building:${building.id}:critical`,
          critical: true,
          cell,
          label:
            building.state === "burning"
              ? "Incendio activo: revisa el edificio"
              : "Riesgo de colapso: revisa el edificio",
          parcelId: building.parcelId,
          buildingId: building.id,
        });
        continue;
      }
      if (building.condition <= 55)
        candidates.push({
          key: `building:${building.id}:maintenance`,
          critical: false,
          cell,
          label: `Condición ${building.condition} %: conviene reparar`,
          parcelId: building.parcelId,
          buildingId: building.id,
        });
    }
    for (const site of economy.constructionSites) {
      if (site.ownerOrganizationId !== "org_00000001") continue;
      if (site.assignedCrewIds.length > 0) continue;
      candidates.push({
        key: `site:${site.id}`,
        critical: false,
        cell: footprintVisualCenter(site.footprintCells),
        label: "Obra sin cuadrilla: asígnala para avanzar",
        parcelId: site.parcelId,
      });
    }
    candidates.sort((left, right) => Number(right.critical) - Number(left.critical));
    const indicators = candidates.slice(0, 12);
    const signature = indicators.map((entry) => entry.key).join("|");
    if (!this.indicatorLayer) {
      this.indicatorLayer = this.add.container(0, 0).setDepth(1_000_000);
    }
    if (signature === this.indicatorSignature) {
      this.indicatorLayer.setVisible(true);
      this.syncIndicatorVisibility();
      return;
    }
    this.indicatorSignature = signature;
    this.indicatorLayer.removeAll(true);
    this.indicatorLayer.setVisible(true);
    this.indicatorEntries = [];
    for (const entry of indicators) {
      const center = gridToScreen(entry.cell, this.layout);
      const color = entry.critical
        ? COLORS.fire
        : entry.label.startsWith("Condición")
          ? COLORS.construction
          : COLORS.parcelAvailable;
      const graphic = this.add.graphics();
      graphic.fillStyle(color, 0.95);
      graphic.lineStyle(2, 0x0c1220, 1);
      if (entry.critical) {
        graphic.beginPath();
        graphic.moveTo(0, -11);
        graphic.lineTo(9, 0);
        graphic.lineTo(0, 11);
        graphic.lineTo(-9, 0);
        graphic.closePath();
        graphic.fillPath();
        graphic.strokePath();
      } else {
        graphic.fillCircle(0, 0, 8);
        graphic.strokeCircle(0, 0, 8);
      }
      const hit = this.add.zone(0, 0, 28, 28).setInteractive({ useHandCursor: true });
      hit.on("pointerover", () => this.showIndicatorTooltip(center, entry.label));
      hit.on("pointerout", () => this.indicatorTooltip?.setVisible(false));
      hit.on("pointerdown", () =>
        this.indicatorListener?.({
          parcelId: entry.parcelId,
          ...(entry.buildingId ? { buildingId: entry.buildingId } : {}),
        }),
      );
      const item = this.add.container(center.x, center.y, [graphic, hit]);
      this.indicatorLayer.add(item);
      this.indicatorEntries.push({ object: item, critical: entry.critical });
    }
    this.lastIndicatorZoom = this.cameras.main.zoom;
    this.syncIndicatorVisibility();
  }

  private syncIndicatorVisibility(): void {
    const showSecondary = this.lastIndicatorZoom >= 0.7;
    for (const entry of this.indicatorEntries)
      entry.object.setVisible(entry.critical || showSecondary);
  }

  private showIndicatorTooltip(center: { x: number; y: number }, label: string): void {
    if (!this.indicatorLayer) return;
    if (!this.indicatorTooltip) {
      this.indicatorTooltip = this.add
        .text(0, 0, "", {
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: "12px",
          color: "#f7f1df",
          backgroundColor: "#0c1220",
          padding: { x: 6, y: 4 },
        })
        .setDepth(1);
      this.indicatorLayer.add(this.indicatorTooltip);
    }
    this.indicatorTooltip
      .setText(label)
      .setPosition(center.x + 12, center.y - 30)
      .setVisible(true);
  }

  /**
   * Hook observacional para la regresión Playwright de cámara. Sólo existe con `?cameraTest=1` y no
   * participa en input, reglas ni estado autoritativo: los eventos siguen atravesando Phaser.
   */
  private installCameraTestHook(): void {
    if (new URLSearchParams(window.location.search).get("cameraTest") !== "1") return;
    const camera = this.cameras.main;
    const api: CameraTestApi = {
      configure: (next) => {
        camera.setZoom(next.zoom);
        camera.setScroll(next.scrollX, next.scrollY);
        camera.preRender();
      },
      getCamera: () => ({
        zoom: camera.zoom,
        scrollX: camera.scrollX,
        scrollY: camera.scrollY,
      }),
      getCellScreenPoint: (cell) => {
        camera.preRender();
        const world = gridToScreen(cell, this.layout);
        const screen = camera.matrixCombined.transformPoint(world.x, world.y);
        return { x: screen.x, y: screen.y };
      },
      getWorldPoint: (point) => {
        camera.preRender();
        const world = camera.getWorldPoint(point.x, point.y);
        return { x: world.x, y: world.y };
      },
      getSelectedCell: () => (this.selectedCell ? { ...this.selectedCell } : null),
      centerOnCell: (cell) => {
        // Phaser hace zoom sobre el centro del viewport: el scroll es el mundo del borde
        // superior izquierdo sin escalar, así que el centro cae en scroll + tamaño/2.
        const world = gridToScreen(cell, this.layout);
        camera.setScroll(world.x - camera.width / 2, world.y - camera.height / 2);
        camera.preRender();
      },
      injectProjection: (projection) => {
        this.setProjection(projection);
      },
    };
    window.__landlordCameraTest = api;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (window.__landlordCameraTest === api) delete window.__landlordCameraTest;
    });
  }
}

export const isometricSpikeGameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: 640,
    height: 480,
  },
  backgroundColor: "#101827",
  render: {
    antialias: true,
    roundPixels: false,
  },
  scene: [IsometricSpikeScene],
};
