import Phaser from "phaser";
import type { ViewProjectionV1 } from "@landlord/shared";
import {
  gridToScreen,
  pickGridCell,
  REFERENCE_LAYOUT,
  type GridCell,
  type IsometricLayout,
  type ScreenPoint,
} from "./coordinates";

const COLORS = {
  tile: 0x314158,
  tileAlternate: 0x384b68,
  outline: 0x536b8b,
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

export type MapOverlay = "ownership" | "profitability" | "condition" | "zoning" | "risk";

export class IsometricSpikeScene extends Phaser.Scene {
  private readonly layout: IsometricLayout = REFERENCE_LAYOUT;
  private readonly screenCenters: ScreenPoint[] = [];
  private mapGraphics?: Phaser.GameObjects.Graphics;
  private structureBlitter?: Phaser.GameObjects.Blitter;
  private agentBlitter?: Phaser.GameObjects.Blitter;
  private structureBobs: Phaser.GameObjects.Bob[] = [];
  private agentBobs: Phaser.GameObjects.Bob[] = [];
  private debugText?: Phaser.GameObjects.Text;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
  private selectedCell: GridCell | null = null;
  private projection: ViewProjectionV1 | null = null;
  private overlay: MapOverlay = "ownership";
  private cellPickedListener?: (cell: GridCell) => void;
  private dragStart: { x: number; y: number; scrollX: number; scrollY: number } | null = null;

  public constructor() {
    super({ key: "IsometricSpikeScene" });
  }

  public create(): void {
    this.buildScreenCenterCache();
    const tileGraphics = this.add.graphics();
    this.drawTiles(tileGraphics);
    const staticMap = this.add.renderTexture(0, 0, 4096, 4096).setOrigin(0, 0);
    staticMap.draw(tileGraphics);
    tileGraphics.destroy();
    this.mapGraphics = this.add.graphics();
    this.createMarkerTexture(STRUCTURE_TEXTURE_KEY, 16, 16, "#d97757");
    this.createMarkerTexture(AGENT_TEXTURE_KEY, 4, 4, "#8fcae7");
    this.structureBlitter = this.add.blitter(0, 0, STRUCTURE_TEXTURE_KEY);
    this.agentBlitter = this.add.blitter(0, 0, AGENT_TEXTURE_KEY);
    this.debugText = this.add
      .text(16, 16, "cell: — | zoom: 1.00", {
        color: "#f4f7fb",
        fontFamily: "monospace",
        fontSize: "14px",
      })
      .setScrollFactor(0)
      .setDepth(1000);
    this.drawOverlay();
    this.cameras.main.setZoom(1);
    this.cameras.main.setBounds(0, 0, 4096, 4096);
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("pointermove", this.handlePointerMove, this);
    this.input.on("pointerup", this.handlePointerUp, this);
    this.input.on("wheel", this.handleWheel, this);
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

  private drawTiles(graphics: Phaser.GameObjects.Graphics): void {
    const cells: GridCell[] = [];
    for (let y = 0; y < this.layout.mapHeight; y += 1) {
      for (let x = 0; x < this.layout.mapWidth; x += 1) cells.push({ x, y });
    }
    cells.sort(
      (left, right) =>
        left.x + left.y - (right.x + right.y) || left.y - right.y || left.x - right.x,
    );
    for (const cell of cells) {
      const center = this.screenCenter(cell);
      const halfWidth = this.layout.tileWidth / 2;
      const halfHeight = this.layout.tileHeight / 2;
      const color = (cell.x + cell.y) % 2 === 0 ? COLORS.tile : COLORS.tileAlternate;
      graphics.fillStyle(color, 1);
      graphics.lineStyle(1, COLORS.outline, 0.65);
      graphics.beginPath();
      graphics.moveTo(center.x, center.y - halfHeight);
      graphics.lineTo(center.x + halfWidth, center.y);
      graphics.lineTo(center.x, center.y + halfHeight);
      graphics.lineTo(center.x - halfWidth, center.y);
      graphics.closePath();
      graphics.fillPath();
      graphics.strokePath();
    }
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
    this.cameras.main.setScroll(
      this.dragStart.scrollX - (pointer.x - this.dragStart.x),
      this.dragStart.scrollY - (pointer.y - this.dragStart.y),
    );
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.rightButtonReleased()) {
      this.dragStart = null;
      return;
    }
    const camera = this.cameras.main;
    const nativePointer = pointer.event as PointerEvent;
    const selected = pickGridCell(
      {
        x: nativePointer.offsetX / camera.zoom + camera.scrollX,
        y: nativePointer.offsetY / camera.zoom + camera.scrollY,
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
    _pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number,
  ): void {
    void deltaX;
    void _gameObjects;
    const nextZoom = Phaser.Math.Clamp(this.cameras.main.zoom - deltaY * 0.001, 0.5, 2.5);
    this.cameras.main.setZoom(nextZoom);
    this.debugText?.setText(this.debugLabel());
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
