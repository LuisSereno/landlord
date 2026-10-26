import Phaser from "phaser";
import type {
  BuildingAssetState,
  BuildingAssetV1,
  RuntimeAssetManifestV1,
  SceneryAssetV1,
  ViewProjectionV1,
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

const COLORS = {
  selected: 0xf2c14e,
  parcelAvailable: 0x7f8fa6,
  parcelPlayer: 0x4db6ac,
  parcelRival: 0xd97757,
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
};

declare global {
  interface Window {
    __landlordCameraTest?: CameraTestApi;
    __visualSliceReady?: boolean;
    __visualSliceObjects?: number;
  }
}

export type MapOverlay = "ownership" | "profitability" | "condition" | "zoning" | "risk";

export class IsometricSpikeScene extends Phaser.Scene {
  private readonly layout: IsometricLayout = REFERENCE_LAYOUT;
  private readonly sliceLayout: VisualSliceLayout | undefined;
  private readonly sliceCharacters: boolean;
  private readonly terrainStage: TerrainStage;
  private readonly showGrid: boolean;
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
  private projection: ViewProjectionV1 | null = null;
  private overlay: MapOverlay = "ownership";
  private cellPickedListener?: (cell: GridCell) => void;
  private dragStart: { x: number; y: number; scrollX: number; scrollY: number } | null = null;

  public constructor(options: IsometricSceneOptions = {}) {
    super({ key: "IsometricSpikeScene" });
    this.sliceLayout = options.visualSlice;
    this.sliceCharacters = options.sliceCharacters ?? false;
    this.terrainStage = options.terrainStage ?? (this.sliceLayout ? "full" : "base");
    this.showGrid = options.showGrid ?? !this.sliceLayout;
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
    if (!this.sliceLayout) {
      this.debugText = this.add
        .text(16, 16, "cell: — | zoom: 1.00", {
          color: "#f4f7fb",
          fontFamily: "monospace",
          fontSize: "14px",
        })
        .setScrollFactor(0)
        .setDepth(1000);
    }
    this.drawOverlay();
    this.cameras.main.setZoom(1);
    if (this.sliceLayout) {
      /** La cámara de captura debe poder centrar la microzona en cualquier zoom. */
      this.cameras.main.setBounds(-4096, -4096, 16_384, 16_384);
    } else {
      this.cameras.main.setBounds(0, 0, 4096, 4096);
    }
    this.installCameraTestHook();
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("pointermove", this.handlePointerMove, this);
    this.input.on("pointerup", this.handlePointerUp, this);
    this.input.on("wheel", this.handleWheel, this);
    void this.registerBuildingTextures();
  }

  public override update(): void {
    if (!this.cursors) return;
    const camera = this.cameras.main;
    const speed = 8 / camera.zoom;
    if (this.cursors.left?.isDown) camera.scrollX -= speed;
    if (this.cursors.right?.isDown) camera.scrollX += speed;
    if (this.cursors.up?.isDown) camera.scrollY -= speed;
    if (this.cursors.down?.isDown) camera.scrollY += speed;
  }

  public setProjection(projection: ViewProjectionV1): void {
    this.projection = projection;
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
        paintGround({
          context: texture.context,
          document: this.game.canvas.ownerDocument,
          layout: this.layout,
          bounds,
          plan: this.groundPlan,
          stage: this.terrainStage,
          showGrid: this.showGrid,
        });
        texture.refresh();
      }
    }
    this.add.image(bounds.x, bounds.y, TILE_TEXTURE_KEY).setOrigin(0, 0).setDepth(0);
    /** Los decalcos viales son la capa 4: sólo aparecen en el horneado completo. */
    if (this.groundPlan && this.terrainStage === "full") {
      this.drawCrossings();
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
    parcel: NonNullable<ViewProjectionV1["economy"]>["parcels"][number],
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
    return parcel.ownerOrganizationId === "org_00000001"
      ? COLORS.parcelPlayer
      : parcel.ownerOrganizationId === "org_00000002"
        ? COLORS.parcelRival
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
      // La ruta de gameplay sólo consume edificios; la escenografía se carga para el slice.
      if (!this.sliceLayout) continue;
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
    const blenderKeys = new Set<string>();
    for (const key of this.textures.getTextureKeys()) {
      if (key.startsWith("blender-building-")) blenderKeys.add(key);
    }
    for (const building of economy.buildings) {
      const parcel = economy.parcels.find((entry) => entry.buildingId === building.id);
      const asset = assetFor(ASSETS, building.type);
      if (!parcel || !asset) continue;
      const proceduralKey = spriteKeyFor(
        building.type,
        buildingAssetStateFor(building.state, building.condition),
      );
      const key = selectBuildingTextureKey(proceduralKey, blenderKeys);
      if (!this.textures.exists(key)) continue;
      const id = `building:${building.id}`;
      const center = gridToScreen(footprintCenter(parcel.cell, asset.footprint), this.layout);
      const sprite = this.ensureBuildingSprite(id, key, asset);
      sprite.setPosition(center.x, center.y);
      sprite.setDepth(depthForAsset(parcel.cell, asset.footprint));
      sprite.setAlpha(building.state === "ruin" ? 0.4 : 1);
      sprite.setVisible(this.isInViewport(center.x, center.y, view, 96));
      seen.add(id);
    }
    for (const site of economy.constructionSites) {
      const parcel = economy.parcels.find((entry) => entry.id === site.parcelId);
      const asset = assetFor(ASSETS, site.buildingType);
      if (!parcel || !asset) continue;
      const proceduralKey = spriteKeyFor(site.buildingType, "construction");
      const key = selectBuildingTextureKey(proceduralKey, blenderKeys);
      if (!this.textures.exists(key)) continue;
      const id = `site:${site.id}`;
      const center = gridToScreen(footprintCenter(parcel.cell, asset.footprint), this.layout);
      const sprite = this.ensureBuildingSprite(id, key, asset);
      sprite.setPosition(center.x, center.y);
      sprite.setDepth(depthForAsset(parcel.cell, asset.footprint) + 1);
      sprite.setAlpha(1);
      sprite.setVisible(this.isInViewport(center.x, center.y, view, 96));
      seen.add(id);
    }
    for (const [id, sprite] of this.buildingSprites) {
      if (seen.has(id)) continue;
      sprite.destroy();
      this.buildingSprites.delete(id);
    }
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
    antialias: false,
    roundPixels: true,
  },
  scene: [IsometricSpikeScene],
};
