import Phaser from "phaser";
import {
  gridToScreen,
  pickGridCell,
  type GridCell,
  type IsometricLayout,
} from "../isometric/coordinates";
import {
  depthForAsset,
  depthForCell,
  directionIndexFor,
  footprintCenter,
  spriteScaleFor,
} from "../isometric/building-sprites";
import { CHARACTER_LIFT_LUT } from "../isometric/visual-scale";
import runtimeManifest from "../generated/runtime-assets-blender-day.json";
import {
  ARRANGEMENTS,
  CAMERA_TARGETS,
  DEFAULT_CONFIG_ID,
  SCALE_CONFIGS,
  type ArrangementId,
  type ScaleConfigId,
} from "./config";
import { calibrateAnimation, type SpriteCalibration } from "./scale-calibration";
import type {
  CharacterSnapshot,
  CharacterVisual,
  LabSpriteFrame,
  LabSpriteManifest,
} from "./types";

const LAYOUT: IsometricLayout = {
  origin: { x: 700, y: 70 },
  tileWidth: 64,
  tileHeight: 32,
  mapWidth: 24,
  mapHeight: 18,
};

const MOVE_CELLS_PER_SECOND = 1.4;

type RuntimeManifest = {
  buildings: Record<
    string,
    {
      pivot: { x: number; y: number };
      footprint: { width: number; height: number };
      pixelsPerMeter: number;
      states: { complete: { src: string } };
    }
  >;
  vehicles: Record<
    string,
    {
      pivot: { x: number; y: number };
      footprint: { width: number; height: number };
      pixelsPerMeter: number;
      image: { src: string };
    }
  >;
};

type LabState = {
  ready: boolean;
  config: ScaleConfigId;
  arrangement: ArrangementId;
  paused: boolean;
  cameraZoom: number;
  cameraScroll: { x: number; y: number };
  cameraCenterWorld: { x: number; y: number };
  visibleWorldArea: number;
  fps: number;
  spriteCount: number;
  visibleBuildingCount: number;
  textureCount: number;
  estimatedTextureBytes: number;
  pickedCell: GridCell | null;
  characters: CharacterSnapshot[];
};

function textureKey(frame: LabSpriteFrame): string {
  return `char_${frame.role}_${frame.animation}_d${frame.direction}_${frame.sampleIndex.toString().padStart(2, "0")}`;
}

function groupKey(frame: LabSpriteFrame): string {
  return `${frame.role}/${frame.animation}/d${frame.direction}`;
}

export class CharacterScaleLabScene extends Phaser.Scene {
  private readonly manifest: LabSpriteManifest;
  private readonly roles: string[];
  private readonly onState: (state: LabState) => void;
  private readonly runtime = runtimeManifest as unknown as RuntimeManifest;
  private readonly framesByKey = new Map<string, LabSpriteFrame>();
  private readonly groups = new Map<string, LabSpriteFrame[]>();
  private readonly calibrations = new Map<string, SpriteCalibration[]>();
  private readonly characters = new Map<string, CharacterVisual>();
  private readonly labBuildings: Array<{
    image: Phaser.GameObjects.Image;
    denseOnly: boolean;
  }> = [];
  private ground!: Phaser.GameObjects.Graphics;
  private grid!: Phaser.GameObjects.Graphics;
  private pivots!: Phaser.GameObjects.Graphics;
  private references!: Phaser.GameObjects.Graphics;
  private selection!: Phaser.GameObjects.Graphics;
  private readonly referenceTexts: Phaser.GameObjects.Text[] = [];
  private configId: ScaleConfigId = DEFAULT_CONFIG_ID;
  private arrangement: ArrangementId = "street";
  private paused = false;
  private showGrid = true;
  private showPivots = false;
  private showReferences = true;
  private motionEnabled = true;
  private motionElapsed = 0;
  private forcedPhase: number | null = null;
  private pickedCell: GridCell | null = null;
  private dragging = false;
  private lastPointer = { x: 0, y: 0 };

  constructor(manifest: LabSpriteManifest, onState: (state: LabState) => void) {
    super("CharacterScaleLab");
    this.manifest = manifest;
    this.roles = [...new Set(manifest.frames.map((frame) => frame.role))].sort();
    this.onState = onState;
    for (const frame of manifest.frames) {
      this.framesByKey.set(textureKey(frame), frame);
      const key = groupKey(frame);
      const group = this.groups.get(key) ?? [];
      group.push(frame);
      this.groups.set(key, group);
    }
    for (const group of this.groups.values()) {
      group.sort((first, second) => first.sampleIndex - second.sampleIndex);
    }
  }

  preload(): void {
    for (const frame of this.manifest.frames) {
      this.load.image(textureKey(frame), frame.path);
    }
    this.load.image("lab_row_house", this.runtime.buildings.row_house!.states.complete.src);
    this.load.image("lab_workshop", this.runtime.buildings.workshop!.states.complete.src);
    this.load.image("lab_truck", this.runtime.vehicles.veh_truck!.image.src);
    this.load.image("lab_delivery", this.runtime.vehicles.veh_delivery!.image.src);
    for (const type of [
      "courtyard_home",
      "clinic",
      "police_station",
      "fire_station",
      "market_hall",
    ]) {
      this.load.image(`lab_${type}`, this.runtime.buildings[type]!.states.complete.src);
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#cdd2c8");
    this.cameras.main.setBounds(-4096, -4096, 16384, 16384);
    this.ground = this.add.graphics().setDepth(0);
    this.grid = this.add.graphics().setDepth(1);
    this.drawGround();
    this.createLiftedCharacterTextures();
    this.createBuildings();
    this.createVehicles();
    this.createFurniture();
    this.references = this.add.graphics().setDepth(20);
    this.pivots = this.add.graphics().setDepth(5000);
    this.selection = this.add.graphics().setDepth(5001);
    for (const role of this.roles) {
      const sprite = this.add.image(0, 0, "missing").setVisible(false);
      this.characters.set(role, {
        role,
        sprite,
        cell: { x: 0, y: 0 },
        direction: 0,
        animation: "idle",
        sampleIndex: 0,
        scale: 1,
        originX: 0.5,
        originY: 0.94,
        worldHeight: 0,
        screenHeight: 0,
      });
    }
    this.installInput();
    this.setArrangement("street", false);
    this.setConfig(DEFAULT_CONFIG_ID, false);
    this.drawPivots();
    this.drawReferences();
    this.emitState();
  }

  private drawGround(): void {
    for (let y = 0; y < LAYOUT.mapHeight; y += 1) {
      for (let x = 0; x < LAYOUT.mapWidth; x += 1) {
        const center = gridToScreen({ x, y }, LAYOUT);
        const points = [
          new Phaser.Math.Vector2(center.x, center.y - LAYOUT.tileHeight / 2),
          new Phaser.Math.Vector2(center.x + LAYOUT.tileWidth / 2, center.y),
          new Phaser.Math.Vector2(center.x, center.y + LAYOUT.tileHeight / 2),
          new Phaser.Math.Vector2(center.x - LAYOUT.tileWidth / 2, center.y),
        ];
        const street = y >= 8 && y <= 10;
        const sidewalk = y === 7 || y === 11;
        const color = street
          ? 0x555d61
          : sidewalk
            ? 0xb9b5a8
            : (x + y) % 2 === 0
              ? 0xaeb7a4
              : 0xb5bdab;
        this.ground.fillStyle(color, 1);
        this.ground.fillPoints(points, true);
        this.grid.lineStyle(1, 0x7d887d, 0.28);
        this.grid.strokePoints(points, true);
      }
    }
    this.ground.lineStyle(3, 0xe4dcc5, 1);
    for (let x = 0; x < LAYOUT.mapWidth; x += 1) {
      for (const y of [7, 11]) {
        const center = gridToScreen({ x, y }, LAYOUT);
        this.ground.lineBetween(center.x - 32, center.y, center.x, center.y + 16);
      }
    }
    this.ground.lineStyle(4, 0xd7c587, 0.9);
    for (let x = 1; x < LAYOUT.mapWidth; x += 4) {
      const center = gridToScreen({ x, y: 9 }, LAYOUT);
      this.ground.lineBetween(center.x - 10, center.y - 5, center.x + 10, center.y + 5);
    }
  }

  private createLiftedCharacterTextures(): void {
    for (const frame of this.manifest.frames) {
      const key = textureKey(frame);
      const source = this.textures.get(key).getSourceImage() as HTMLImageElement;
      const canvasTexture = this.textures.createCanvas(`${key}_lift`, source.width, source.height);
      if (!canvasTexture) throw new Error(`No se pudo crear textura ${key}`);
      const context = canvasTexture.context;
      context.drawImage(source, 0, 0);
      const imageData = context.getImageData(0, 0, source.width, source.height);
      for (let index = 0; index < imageData.data.length; index += 4) {
        imageData.data[index] = CHARACTER_LIFT_LUT[imageData.data[index]!]!;
        imageData.data[index + 1] = CHARACTER_LIFT_LUT[imageData.data[index + 1]!]!;
        imageData.data[index + 2] = CHARACTER_LIFT_LUT[imageData.data[index + 2]!]!;
      }
      context.putImageData(imageData, 0, 0);
      canvasTexture.refresh();
      this.textures.remove(key);
    }
  }

  private createBuildings(): void {
    const definitions = [
      { key: "row_house", cell: { x: 2, y: 3 } as GridCell, denseOnly: false },
      { key: "workshop", cell: { x: 14, y: 3 } as GridCell, denseOnly: false },
      { key: "courtyard_home", cell: { x: 7, y: 2 } as GridCell, denseOnly: true },
      { key: "row_house", cell: { x: 10, y: 2 } as GridCell, denseOnly: true },
      { key: "courtyard_home", cell: { x: 19, y: 2 } as GridCell, denseOnly: true },
      { key: "row_house", cell: { x: 2, y: 13 } as GridCell, denseOnly: true },
      { key: "workshop", cell: { x: 7, y: 13 } as GridCell, denseOnly: true },
      { key: "clinic", cell: { x: 12, y: 13 } as GridCell, denseOnly: true },
      { key: "police_station", cell: { x: 15, y: 13 } as GridCell, denseOnly: true },
      { key: "fire_station", cell: { x: 18, y: 13 } as GridCell, denseOnly: true },
    ];
    for (const definition of definitions) {
      const asset = this.runtime.buildings[definition.key]!;
      const cells: GridCell[] = [];
      for (let x = 0; x < asset.footprint.width; x += 1) {
        for (let y = 0; y < asset.footprint.height; y += 1) {
          cells.push({ x: definition.cell.x + x, y: definition.cell.y + y });
        }
      }
      const center = footprintCenter(definition.cell, asset.footprint);
      const position = gridToScreen(center, LAYOUT);
      const scale = spriteScaleFor(asset, LAYOUT.tileWidth);
      const image = this.add
        .image(position.x, position.y, `lab_${definition.key}`)
        .setOrigin(asset.pivot.x, asset.pivot.y)
        .setScale(scale)
        .setDepth(depthForAsset(definition.cell, asset.footprint))
        .setVisible(!definition.denseOnly);
      this.labBuildings.push({ image, denseOnly: definition.denseOnly });
    }
  }

  private createVehicles(): void {
    const definitions = [
      { key: "veh_truck", cell: { x: 11, y: 9 } as GridCell },
      { key: "veh_delivery", cell: { x: 17, y: 9 } as GridCell },
    ];
    for (const definition of definitions) {
      const asset = this.runtime.vehicles[definition.key]!;
      const position = gridToScreen(definition.cell, LAYOUT);
      this.add
        .image(
          position.x,
          position.y,
          `lab_${definition.key === "veh_truck" ? "truck" : "delivery"}`,
        )
        .setOrigin(asset.pivot.x, asset.pivot.y)
        .setScale(spriteScaleFor(asset, LAYOUT.tileWidth))
        .setDepth(depthForCell(definition.cell) + 5);
    }
  }

  private createFurniture(): void {
    for (const cell of [
      { x: 4, y: 7 },
      { x: 20, y: 11 },
    ] as GridCell[]) {
      const position = gridToScreen(cell, LAYOUT);
      const depth = depthForCell(cell);
      const pole = this.add.rectangle(position.x, position.y - 32, 4, 64, 0x3e4947).setDepth(depth);
      const lamp = this.add.circle(position.x, position.y - 64, 7, 0xe7d7a0).setDepth(depth);
      pole.setData("reference", true);
      lamp.setData("reference", true);
    }
    const benchCell = { x: 8, y: 11 } as GridCell;
    const bench = gridToScreen(benchCell, LAYOUT);
    this.add.rectangle(bench.x, bench.y - 8, 42, 8, 0x76583d).setDepth(depthForCell(benchCell));
    this.add.rectangle(bench.x, bench.y - 17, 42, 5, 0x76583d).setDepth(depthForCell(benchCell));
  }

  private installInput(): void {
    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.dragging = true;
        this.lastPointer = { x: pointer.x, y: pointer.y };
      } else if (pointer.leftButtonDown()) {
        const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.pickedCell = pickGridCell(world, LAYOUT);
        this.drawSelection();
        this.emitState();
      }
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging || !pointer.isDown) return;
      const dx = pointer.x - this.lastPointer.x;
      const dy = pointer.y - this.lastPointer.y;
      const zoom = this.cameras.main.zoom;
      this.cameras.main.scrollX -= dx / zoom;
      this.cameras.main.scrollY -= dy / zoom;
      this.lastPointer = { x: pointer.x, y: pointer.y };
      this.emitState();
    });
    this.input.on("pointerup", () => {
      this.dragging = false;
    });
    this.input.on(
      "wheel",
      (
        _pointer: Phaser.Input.Pointer,
        _objects: Phaser.GameObjects.GameObject[],
        _dx: number,
        dy: number,
      ) => {
        const camera = this.cameras.main;
        const worldBefore = camera.getWorldPoint(
          this.input.activePointer.x,
          this.input.activePointer.y,
        );
        const nextZoom = Phaser.Math.Clamp(camera.zoom * (dy > 0 ? 0.9 : 1.1), 0.5, 2.5);
        camera.setZoom(nextZoom);
        camera.preRender();
        const worldAfter = camera.getWorldPoint(
          this.input.activePointer.x,
          this.input.activePointer.y,
        );
        camera.scrollX += worldBefore.x - worldAfter.x;
        camera.scrollY += worldBefore.y - worldAfter.y;
        camera.preRender();
        this.emitState();
      },
    );
  }

  setConfig(id: ScaleConfigId, emit = true): void {
    this.configId = id;
    const config = SCALE_CONFIGS[id];
    this.cameras.main.setZoom(config.cameraZoom);
    this.centerCamera();
    this.calibrations.clear();
    for (const visual of this.characters.values()) {
      this.applyVisual(visual, visual.animation, visual.direction, visual.sampleIndex);
    }
    if (emit) this.emitState();
  }

  setArrangement(id: ArrangementId, emit = true): void {
    this.arrangement = id;
    this.motionElapsed = 0;
    this.forcedPhase = null;
    const positions = ARRANGEMENTS[id];
    for (const [role, visual] of this.characters) {
      const cell = positions[role];
      visual.sprite.setVisible(Boolean(cell));
      if (!cell) continue;
      visual.cell = { ...cell };
      visual.direction = 0;
      visual.animation = "idle";
      visual.sampleIndex = 0;
      this.applyVisual(visual, "idle", 0, 0);
      this.positionVisual(visual);
    }
    for (const building of this.labBuildings) {
      building.image.setVisible(!building.denseOnly || id === "dense" || id === "catalog");
    }
    this.centerCamera();
    this.drawPivots();
    if (emit) this.emitState();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.emitState();
  }

  setShowGrid(show: boolean): void {
    this.showGrid = show;
    this.grid.setVisible(show);
    this.emitState();
  }

  setShowPivots(show: boolean): void {
    this.showPivots = show;
    this.pivots.setVisible(show);
    this.drawPivots();
    this.emitState();
  }

  setShowReferences(show: boolean): void {
    this.showReferences = show;
    this.references.setVisible(show);
    for (const text of this.referenceTexts) text.setVisible(show);
    this.drawReferences();
    this.emitState();
  }

  setMotionEnabled(enabled: boolean): void {
    this.motionEnabled = enabled;
    this.emitState();
  }

  setMotionPhase(phase: number): void {
    this.forcedPhase = Phaser.Math.Clamp(phase, 0, 1);
    this.updateMotion();
    this.emitState();
  }

  setZoom(zoom: number): void {
    const camera = this.cameras.main;
    const center = this.cameraTargetWorld();
    camera.setZoom(Phaser.Math.Clamp(zoom, 0.5, 2.5));
    camera.centerOn(center.x, center.y);
    for (const visual of this.characters.values()) {
      visual.screenHeight = visual.worldHeight * camera.zoom;
    }
    this.emitState();
  }

  setCharacterDirection(role: string, direction: number): void {
    this.setCharacterPose(role, "idle", direction, 0);
  }

  setCharacterPose(
    role: string,
    animation: "idle" | "walk",
    direction: number,
    sampleIndex: number,
  ): void {
    const visual = this.characters.get(role);
    if (!visual || !visual.sprite.visible) return;
    const normalized = ((direction % 4) + 4) % 4;
    this.applyVisual(visual, animation, normalized, sampleIndex);
    this.positionVisual(visual);
    this.emitState();
  }

  gridCellToScreen(cell: GridCell): { x: number; y: number } {
    return gridToScreen(cell, LAYOUT);
  }

  screenToWorld(x: number, y: number): { x: number; y: number } {
    this.cameras.main.preRender();
    const world = this.cameras.main.getWorldPoint(x, y);
    return { x: world.x, y: world.y };
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    const camera = this.cameras.main;
    camera.preRender();
    const matrix = camera.matrixCombined.matrix;
    return {
      x: matrix[0]! * x + matrix[2]! * y + matrix[4]!,
      y: matrix[1]! * x + matrix[3]! * y + matrix[5]!,
    };
  }

  reset(): void {
    this.configId = DEFAULT_CONFIG_ID;
    this.arrangement = "street";
    this.paused = false;
    this.motionEnabled = true;
    this.forcedPhase = null;
    this.pickedCell = null;
    this.showGrid = true;
    this.showPivots = false;
    this.showReferences = true;
    this.grid.setVisible(true);
    this.pivots.setVisible(false);
    this.references.setVisible(true);
    this.setArrangement("street", false);
    this.setConfig(DEFAULT_CONFIG_ID, false);
    this.drawSelection();
    this.emitState();
  }

  getState(): LabState {
    const camera = this.cameras.main;
    const center = camera.getWorldPoint(camera.width / 2, camera.height / 2);
    const textureKeys = this.textures.getTextureKeys();
    const estimatedTextureBytes = textureKeys.reduce((total, key) => {
      const source = this.textures.get(key).getSourceImage() as HTMLImageElement;
      return total + source.width * source.height * 4;
    }, 0);
    return {
      ready: true,
      config: this.configId,
      arrangement: this.arrangement,
      paused: this.paused,
      cameraZoom: camera.zoom,
      cameraScroll: { x: camera.scrollX, y: camera.scrollY },
      cameraCenterWorld: { x: center.x, y: center.y },
      visibleWorldArea: camera.worldView.width * camera.worldView.height,
      fps: this.game.loop.actualFps,
      spriteCount: this.children.list.filter((child) => child instanceof Phaser.GameObjects.Image)
        .length,
      visibleBuildingCount: this.labBuildings.filter((building) => building.image.visible).length,
      textureCount: textureKeys.length,
      estimatedTextureBytes,
      pickedCell: this.pickedCell,
      characters: [...this.characters.values()]
        .filter((visual) => visual.sprite.visible)
        .map((visual) => ({
          role: visual.role,
          cell: { ...visual.cell },
          direction: visual.direction,
          animation: visual.animation,
          sampleIndex: visual.sampleIndex,
          scale: visual.scale,
          originX: visual.originX,
          originY: visual.originY,
          worldHeight: visual.worldHeight,
          screenHeight: visual.worldHeight * camera.zoom,
          x: visual.sprite.x,
          y: visual.sprite.y,
          depth: visual.sprite.depth,
          textureKey: visual.sprite.texture.key,
          inView: Phaser.Geom.Rectangle.Overlaps(camera.worldView, visual.sprite.getBounds()),
        })),
    };
  }

  pickAtScreen(x: number, y: number): GridCell | null {
    this.cameras.main.preRender();
    const world = this.cameras.main.getWorldPoint(x, y);
    return pickGridCell(world, LAYOUT);
  }

  override update(time: number, delta: number): void {
    void time;
    if (
      !this.paused &&
      this.motionEnabled &&
      this.forcedPhase === null &&
      this.arrangement === "street"
    ) {
      this.motionElapsed += delta / 1000;
      this.updateMotion();
    }
  }

  private updateMotion(): void {
    const paths: Record<string, [GridCell, GridCell]> = {
      worker: [
        { x: 7, y: 10 },
        { x: 14, y: 10 },
      ],
      enforcer: [
        { x: 10, y: 10 },
        { x: 15, y: 7 },
      ],
    };
    for (const [role, path] of Object.entries(paths)) {
      const visual = this.characters.get(role);
      if (!visual?.sprite.visible) continue;
      const [start, end] = path;
      const duration =
        Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y) / MOVE_CELLS_PER_SECOND;
      const phase = this.forcedPhase ?? (this.motionElapsed % duration) / duration;
      const cell = {
        x: Phaser.Math.Linear(start.x, end.x, phase),
        y: Phaser.Math.Linear(start.y, end.y, phase),
      };
      const startScreen = gridToScreen(start, LAYOUT);
      const endScreen = gridToScreen(end, LAYOUT);
      const direction = directionIndexFor(
        endScreen.x - startScreen.x,
        endScreen.y - startScreen.y,
        4,
      );
      const sampleIndex = Math.floor(phase * 8) % 8;
      visual.cell = cell;
      if (
        visual.animation !== "walk" ||
        visual.direction !== direction ||
        visual.sampleIndex !== sampleIndex
      ) {
        this.applyVisual(visual, "walk", direction, sampleIndex);
      }
      this.positionVisual(visual);
    }
  }

  private applyVisual(
    visual: CharacterVisual,
    animation: "idle" | "walk",
    direction: number,
    sampleIndex: number,
  ): void {
    const key = `${visual.role}/${animation}/d${direction}`;
    const frames = this.groups.get(key);
    if (!frames || frames.length === 0) {
      this.applyVisual(visual, "idle", direction, 0);
      return;
    }
    let calibration = this.calibrations.get(key);
    if (!calibration) {
      calibration = calibrateAnimation(
        frames,
        SCALE_CONFIGS[this.configId].characterWorldHeight,
        this.cameras.main.zoom,
      );
      this.calibrations.set(key, calibration);
    }
    const requestedSample = ((sampleIndex % 8) + 8) % 8;
    const matchedIndex = frames.findIndex((frame) => frame.sampleIndex === requestedSample);
    const resolvedIndex = matchedIndex >= 0 ? matchedIndex : 0;
    const frame = frames[resolvedIndex]!;
    const calibrated = calibration[resolvedIndex]!;
    visual.animation = animation;
    visual.direction = direction;
    visual.sampleIndex = frame.sampleIndex;
    visual.scale = calibrated.scale;
    visual.originX = calibrated.originX;
    visual.originY = calibrated.originY;
    visual.worldHeight = calibrated.worldHeight;
    visual.screenHeight = calibrated.screenHeight;
    visual.sprite
      .setTexture(`${textureKey(frame)}_lift`)
      .setScale(calibrated.scale)
      .setOrigin(calibrated.originX, calibrated.originY);
  }

  private positionVisual(visual: CharacterVisual): void {
    const position = gridToScreen(visual.cell, LAYOUT);
    visual.sprite.setPosition(position.x, position.y);
    visual.sprite.setDepth(depthForCell(visual.cell) + 8);
  }

  private centerCamera(): void {
    const target = this.cameraTargetWorld();
    this.cameras.main.centerOn(target.x, target.y);
  }

  private cameraTargetWorld(): { x: number; y: number } {
    return gridToScreen(CAMERA_TARGETS[this.arrangement], LAYOUT);
  }

  private drawPivots(): void {
    this.pivots.clear();
    if (!this.showPivots) return;
    for (const visual of this.characters.values()) {
      if (!visual.sprite.visible) continue;
      this.pivots.lineStyle(2, 0xe34b4b, 1);
      this.pivots.strokeCircle(visual.sprite.x, visual.sprite.y, 5);
      this.pivots.lineBetween(
        visual.sprite.x - 9,
        visual.sprite.y,
        visual.sprite.x + 9,
        visual.sprite.y,
      );
      this.pivots.lineBetween(
        visual.sprite.x,
        visual.sprite.y - 9,
        visual.sprite.x,
        visual.sprite.y + 9,
      );
    }
  }

  private drawReferences(): void {
    this.references.clear();
    for (const text of this.referenceTexts) text.destroy();
    this.referenceTexts.length = 0;
    if (!this.showReferences) return;
    const door = gridToScreen({ x: 5, y: 6 }, LAYOUT);
    const doorHeight = 2 * (LAYOUT.tileWidth / (4 * Math.SQRT2));
    this.references.lineStyle(3, 0xf3d26a, 1);
    this.references.lineBetween(door.x + 38, door.y, door.x + 38, door.y - doorHeight);
    this.references.lineBetween(door.x + 32, door.y, door.x + 44, door.y);
    this.references.lineBetween(door.x + 32, door.y - doorHeight, door.x + 44, door.y - doorHeight);
    this.referenceTexts.push(
      this.add
        .text(door.x + 48, door.y - doorHeight - 8, "Puerta 2 m", {
          fontSize: "14px",
          color: "#f3d26a",
          backgroundColor: "#343a3dcc",
        })
        .setDepth(21),
    );
    const truck = gridToScreen({ x: 11, y: 9 }, LAYOUT);
    this.references.lineStyle(2, 0x8fd3e8, 0.9);
    this.references.strokeRect(truck.x - 28, truck.y - 30, 56, 38);
    this.referenceTexts.push(
      this.add
        .text(truck.x - 30, truck.y - 52, "Vehículo real", {
          fontSize: "13px",
          color: "#8fd3e8",
          backgroundColor: "#343a3dcc",
        })
        .setDepth(21),
    );
  }

  private drawSelection(): void {
    this.selection.clear();
    if (!this.pickedCell) return;
    const center = gridToScreen(this.pickedCell, LAYOUT);
    const points = [
      new Phaser.Math.Vector2(center.x, center.y - 16),
      new Phaser.Math.Vector2(center.x + 32, center.y),
      new Phaser.Math.Vector2(center.x, center.y + 16),
      new Phaser.Math.Vector2(center.x - 32, center.y),
    ];
    this.selection.lineStyle(3, 0xffe08a, 1);
    this.selection.strokePoints(points, true);
  }

  private emitState(): void {
    this.onState(this.getState());
  }
}
