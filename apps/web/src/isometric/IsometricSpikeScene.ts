import Phaser from "phaser";
import type {
  BuildingAssetState,
  BuildingAssetV1,
  RuntimeAssetManifestV1,
  SceneryAssetV1,
  ViewProjectionV2,
} from "@landlord/shared";
import runtimeAssets from "../generated/runtime-assets.json";
import runtimeAssetsBlender from "../generated/runtime-assets-blender.json";
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
  buildingAssetStateFor,
  depthForAsset,
  footprintCenter,
  originFromPivot,
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

const COLORS = {
  selected: 0xf2c14e,
  parcelAvailable: 0x7f8fa6,
  parcelPlayer: 0x4db6ac,
  parcelRival: 0xd97757,
  parcelCivic: 0x6fa8dc,
  building: 0xead7a1,
  construction: 0xb8a46a,
  fire: 0xf05a28,
  ruin: 0x6b5b73,
};

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
const ASSETS = runtimeAssets as RuntimeAssetManifestV1;
const ASSETS_BLENDER = runtimeAssetsBlender as RuntimeAssetManifestV1;

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

export type MapOverlay =
  | "ownership"
  | "profitability"
  | "condition"
  | "zoning"
  | "risk"
  | "landValue"
  | "security"
  | "fire"
  | "health"
  | "education"
  | "transport";

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
  }

  public setOverlay(overlay: MapOverlay): void {
    this.overlay = overlay;
    this.drawOverlay();
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
    for (const building of this.projection?.economy?.buildings ?? []) {
      if (this.assetsReady) break;
      const parcel = this.projection?.economy?.parcels.find(
        (entry) => entry.buildingId === building.id,
      );
      if (!parcel) continue;
      const center = this.screenCenter(parcel.cell);
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
      const parcel = this.projection?.economy?.parcels.find((entry) => entry.id === site.parcelId);
      if (!parcel) continue;
      const center = this.screenCenter(parcel.cell);
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
      const parcel = this.projection?.economy?.parcels.find(
        (entry) => entry.buildingId === incident.buildingId,
      );
      if (!parcel) continue;
      const center = this.screenCenter(parcel.cell);
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
    if (this.overlay === "condition") {
      const building = this.projection?.economy?.buildings.find(
        (entry) => entry.id === parcel.buildingId,
      );
      if (!building) return COLORS.parcelAvailable;
      if (building.condition <= 35) return COLORS.fire;
      if (building.condition <= 70) return COLORS.construction;
      return COLORS.parcelPlayer;
    }
    if (this.overlay === "profitability") {
      const building = this.projection?.economy?.buildings.find(
        (entry) => entry.id === parcel.buildingId,
      );
      if (!building) return COLORS.parcelAvailable;
      if (building.effectiveRent <= building.maintenanceDue) return COLORS.fire;
      if (building.effectiveRent < building.maintenanceDue * 2) return COLORS.construction;
      return COLORS.parcelPlayer;
    }
    if (this.overlay === "zoning")
      return parcel.zoning === "industrial"
        ? 0x9b7ede
        : parcel.zoning === "mixed"
          ? 0xe0b04b
          : 0x69a86b;
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
    manifest: RuntimeAssetManifestV1,
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
    const seen = new Set<string>();
    const place = (
      id: string,
      domainType: string,
      state: BuildingAssetState,
      cell: GridCell,
      alpha: number,
      depthBias: number,
    ): void => {
      const archetype = this.buildingArchetypes.get(id) ?? domainType;
      const resolved = this.resolveBuildingVisual(archetype, domainType, state);
      if (!resolved) return;
      const { key, asset } = resolved;
      const center = gridToScreen(footprintCenter(cell, asset.footprint), this.layout);
      const sprite = this.ensureBuildingSprite(id, key, asset);
      sprite.setPosition(center.x, center.y);
      sprite.setScale(spriteScaleFor(asset, this.layout.tileWidth));
      sprite.setDepth(depthForAsset(cell, asset.footprint) + depthBias);
      sprite.setAlpha(alpha);
      sprite.setVisible(this.isInViewport(center.x, center.y, view, 96));
      seen.add(id);
    };
    for (const building of economy.buildings) {
      const parcel = economy.parcels.find((entry) => entry.buildingId === building.id);
      if (!parcel) continue;
      place(
        `building:${building.id}`,
        building.type,
        buildingAssetStateFor(building.state, building.condition),
        parcel.cell,
        building.state === "ruin" ? 0.4 : 1,
        0,
      );
    }
    for (const site of economy.constructionSites) {
      const parcel = economy.parcels.find((entry) => entry.id === site.parcelId);
      if (!parcel) continue;
      place(`site:${site.id}`, site.buildingType, "construction", parcel.cell, 1, 1);
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
   */
  private resolveBuildingVisual(
    archetype: string,
    domainType: string,
    state: BuildingAssetState,
  ): { key: string; asset: BuildingAssetV1 } | null {
    const blenderKey = `blender-building-${archetype}-${state}`;
    const blenderAsset = ASSETS_BLENDER.buildings[archetype];
    if (blenderAsset && this.textures.exists(blenderKey)) {
      return { key: blenderKey, asset: blenderAsset };
    }
    const proceduralKey = spriteKeyFor(domainType, state);
    const proceduralAsset = ASSETS.buildings[domainType];
    if (proceduralAsset && this.textures.exists(proceduralKey)) {
      return { key: proceduralKey, asset: proceduralAsset };
    }
    return null;
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
