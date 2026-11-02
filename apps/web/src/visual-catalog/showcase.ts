import Phaser from "phaser";
import runtimeAssets from "../generated/runtime-assets.json";
import blenderAssets from "../generated/runtime-assets-blender.json";

export type ShowcaseSelection = {
  name: string;
  category: string;
  state: string;
  footprint: string;
  source: string;
};
const states = [
  "complete",
  "complete",
  "complete",
  "construction",
  "complete",
  "damaged",
  "complete",
  "burning",
  "complete",
  "complete",
  "complete",
  "complete",
  "complete",
  "complete",
  "complete",
] as const;

class ShowcaseScene extends Phaser.Scene {
  constructor(private readonly onSelect: (value: ShowcaseSelection) => void) {
    super("visual-showcase");
  }
  create(): void {
    void this.build();
  }
  private async texture(
    key: string,
    source: { src: string; width: number; height: number },
  ): Promise<boolean> {
    if (this.textures.exists(key)) return true;
    const image = new Image();
    image.src = source.src;
    try {
      await image.decode();
    } catch {
      return false;
    }
    const texture = this.textures.createCanvas(key, source.width, source.height);
    if (!texture) return false;
    texture.context.drawImage(image, 0, 0, source.width, source.height);
    texture.refresh();
    return true;
  }
  private async build(): Promise<void> {
    const zones = [
      [150, 120, 280, 190, 0x304638],
      [480, 120, 300, 190, 0x3d3440],
      [810, 120, 280, 190, 0x4a3a2c],
      [190, 385, 360, 240, 0x283b47],
      [560, 385, 330, 240, 0x4b4535],
      [850, 385, 230, 240, 0x334a3a],
    ];
    for (const [x, y, w, h, color] of zones)
      this.add.rectangle(x!, y!, w!, h!, color!).setStrokeStyle(2, 0x647985);
    for (let x = 0; x < 960; x += 80) this.add.rectangle(x, 270, 64, 540, 0x26323a);
    for (const [index, [id, asset]] of Object.entries(runtimeAssets.buildings).entries()) {
      const state = states[index]!;
      const image = asset.states[state];
      const key = `showcase-${id}-${state}`;
      if (!(await this.texture(key, image))) continue;
      const column = index % 5,
        row = Math.floor(index / 5);
      this.add
        .image(115 + column * 185, 105 + row * 165, key)
        .setScale(0.72)
        .setDepth(10 + row)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () =>
          this.onSelect({
            name: asset.name,
            category: "building",
            state,
            footprint: `${asset.footprint.width}×${asset.footprint.height}`,
            source: "runtime procedural manifest",
          }),
        );
    }
    const decor: Array<[string, { src: string; width: number; height: number }, number, number]> = [
      ["sedan", blenderAssets.vehicles.veh_sedan.image, 410, 485],
      ["truck", blenderAssets.vehicles.veh_truck.image, 680, 465],
      ["tree", blenderAssets.props.prp_tree_oak.image, 885, 420],
      ["bench", blenderAssets.props.prp_bench.image, 800, 485],
      ["light", blenderAssets.props.prp_street_light.image, 735, 430],
    ];
    for (const [key, image, x, y] of decor)
      if (await this.texture(`showcase-${key}`, image))
        this.add.image(x, y, `showcase-${key}`).setScale(0.55).setDepth(30);
    const character = blenderAssets.characters.vecino_variante.animations.idle.frames[0]!;
    if (await this.texture("showcase-character", character))
      for (const [x, y] of [
        [330, 455],
        [530, 445],
        [760, 455],
      ])
        this.add.image(x!, y!, "showcase-character").setScale(0.8).setDepth(35);
    this.add
      .text(18, 18, "RESIDENTIAL · MIXED · INDUSTRIAL · CIVIC · PARK · PLAZA", {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#e9edf0",
        backgroundColor: "#17232bdd",
        padding: { x: 8, y: 5 },
      })
      .setDepth(50);
    window.dispatchEvent(new CustomEvent("visual-showcase-ready"));
  }
}

export function mountVisualShowcase(
  parent: HTMLElement,
  onSelect: (value: ShowcaseSelection) => void,
) {
  const scene = new ShowcaseScene(onSelect);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 540,
    backgroundColor: "#17232b",
    scene: [scene],
    banner: false,
    audio: { noAudio: true },
  });
  return {
    destroy: () => game.destroy(true),
    zoom: (delta: number) =>
      scene.cameras.main.setZoom(Math.max(0.75, Math.min(1.5, scene.cameras.main.zoom + delta))),
  };
}
