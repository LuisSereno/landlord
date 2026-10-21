import Phaser from "phaser";
import type { ViewProjectionV1 } from "@landlord/shared";
import {
  gridToScreen,
  pickGridCell,
  REFERENCE_LAYOUT,
  type GridCell,
  type IsometricLayout,
} from "./coordinates";

const COLORS = {
  tile: 0x314158,
  tileAlternate: 0x384b68,
  outline: 0x536b8b,
  selected: 0xf2c14e,
};

const STRUCTURE_TEXTURE_KEY = "benchmark-structure-marker";
const AGENT_TEXTURE_KEY = "benchmark-agent-marker";

export class IsometricSpikeScene extends Phaser.Scene {
  private readonly layout: IsometricLayout = REFERENCE_LAYOUT;
  private mapGraphics?: Phaser.GameObjects.Graphics;
  private structureBlitter?: Phaser.GameObjects.Blitter;
  private agentBlitter?: Phaser.GameObjects.Blitter;
  private structureBobs: Phaser.GameObjects.Bob[] = [];
  private agentBobs: Phaser.GameObjects.Bob[] = [];
  private debugText?: Phaser.GameObjects.Text;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
  private selectedCell: GridCell | null = null;
  private projection: ViewProjectionV1 | null = null;
  private cellPickedListener?: (cell: GridCell) => void;
  private dragStart: { x: number; y: number; scrollX: number; scrollY: number } | null = null;

  public constructor() {
    super({ key: "IsometricSpikeScene" });
  }

  public create(): void {
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
      const center = gridToScreen(cell, this.layout);
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
    this.updateBlitterPositions();
    if (this.selectedCell) {
      const center = gridToScreen(this.selectedCell, this.layout);
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

  private createMarkerTexture(key: string, width: number, height: number, color: string): void {
    if (this.textures.exists(key)) return;
    const texture = this.textures.createCanvas(key, width, height);
    if (!texture) return;
    texture.context.fillStyle = color;
    texture.context.fillRect(0, 0, width, height);
    texture.refresh();
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
        bob.setVisible(structure !== undefined);
        if (structure) {
          const center = gridToScreen(structure.cell, this.layout);
          bob.setPosition(center.x - 8, center.y - 10);
          bob.setVisible(this.isInViewport(center.x, center.y, view, 16));
        }
      });
    }
    if (this.agentBlitter) {
      while (this.agentBobs.length < agents.length)
        this.agentBobs.push(this.agentBlitter.create(0, 0));
      this.agentBobs.forEach((bob, index) => {
        const agent = agents[index];
        bob.setVisible(agent !== undefined);
        if (agent) {
          const center = gridToScreen(agent.cell, this.layout);
          bob.setPosition(center.x - 2, center.y - 8);
          bob.setVisible(this.isInViewport(center.x, center.y, view, 4));
        }
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
    const selected = pickGridCell({ x: pointer.worldX, y: pointer.worldY }, this.layout);
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
  width: 640,
  height: 480,
  backgroundColor: "#101827",
  scene: [IsometricSpikeScene],
};
