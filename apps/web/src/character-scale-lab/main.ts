import Phaser from "phaser";
import { ARRANGEMENTS, DEFAULT_CONFIG_ID, SCALE_CONFIGS, type ArrangementId, type ScaleConfigId } from "./config";
import { CharacterScaleLabScene } from "./scene";
import type { LabSpriteManifest } from "./types";
import "./style.css";

declare global {
  interface Window {
    __charScaleLab?: {
      ready: boolean;
      setConfig: (id: ScaleConfigId) => void;
      setArrangement: (id: ArrangementId) => void;
      setPaused: (paused: boolean) => void;
      setShowGrid: (show: boolean) => void;
      setShowPivots: (show: boolean) => void;
      setShowReferences: (show: boolean) => void;
      setMotionEnabled: (enabled: boolean) => void;
      setMotionPhase: (phase: number) => void;
      setCharacterDirection: (role: string, direction: number) => void;
      gridCellToScreen: (cell: { x: number; y: number }) => { x: number; y: number };
      screenToWorld: (x: number, y: number) => { x: number; y: number };
      worldToScreen: (x: number, y: number) => { x: number; y: number };
      setZoom: (zoom: number) => void;
      reset: () => void;
      getState: () => unknown;
      pickAtScreen: (x: number, y: number) => unknown;
    };
  }
}

async function bootstrap(): Promise<void> {
  const response = await fetch("/qa-character-scale/manifest.json");
  if (!response.ok) throw new Error(`No se pudo cargar el manifiesto del laboratorio: ${response.status}`);
  const manifest = (await response.json()) as LabSpriteManifest;
  const root = document.querySelector<HTMLDivElement>("#lab-root");
  if (!root) throw new Error("Falta #lab-root");
  root.innerHTML = `
    <main class="lab-shell">
      <header class="lab-header">
        <div>
          <h1>Character Scale Lab</h1>
          <p>Kenney + edificios y vehículos reales · escena aislada, no gameplay</p>
        </div>
        <output id="lab-status">Cargando Phaser…</output>
      </header>
      <section class="lab-controls" aria-label="Controles del laboratorio">
        <div class="control-group">
          <span>Escala</span>
          ${Object.values(SCALE_CONFIGS)
            .map(
              (config) =>
                `<button data-config="${config.id}" class="${config.id === DEFAULT_CONFIG_ID ? "active" : ""}">${config.id} · ${config.label}<small>zoom ${config.cameraZoom}× · ${config.characterWorldHeight}px</small></button>`,
            )
            .join("")}
        </div>
        <div class="control-group">
          <span>Posición</span>
          ${(Object.keys(ARRANGEMENTS) as ArrangementId[])
            .map((id) => `<button data-arrangement="${id}" class="${id === "street" ? "active" : ""}">${id}</button>`)
            .join("")}
        </div>
        <label><input id="pause" type="checkbox" /> Pausar</label>
        <label><input id="grid" type="checkbox" checked /> Retícula</label>
        <label><input id="pivots" type="checkbox" /> Pivotes</label>
        <label><input id="references" type="checkbox" checked /> Referencias</label>
        <label><input id="motion" type="checkbox" checked /> Movimiento</label>
        <button id="reset">Restablecer</button>
      </section>
      <div id="phaser-root" class="phaser-root"></div>
      <footer>Arrastra con botón derecho para desplazar · rueda para zoom · clic izquierdo para picking · zoom 0,5×–2,5×</footer>
    </main>
  `;
  const status = root.querySelector<HTMLOutputElement>("#lab-status");
  let scene: CharacterScaleLabScene | null = null;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "phaser-root",
    backgroundColor: "#cdd2c8",
    scale: { mode: Phaser.Scale.RESIZE, width: 1280, height: 720 },
    render: { antialias: true, pixelArt: false, roundPixels: false },
    scene: new CharacterScaleLabScene(manifest, (state) => {
      if (!status) return;
      const heights = state.characters.map((character) => `${character.role}:${character.screenHeight.toFixed(1)}`).join(" · ");
      status.value = `${state.config} · zoom ${state.cameraZoom.toFixed(2)}× · ${state.fps.toFixed(0)} FPS · ${state.spriteCount} sprites · ${heights}`;
      if (state.ready) installApi();
    }),
  });
  function installApi(): void {
    if (window.__charScaleLab?.ready) return;
    const active = game.scene.getScene("CharacterScaleLab") as CharacterScaleLabScene;
    scene = active;
    window.__charScaleLab = {
      ready: true,
      setConfig: (id) => active.setConfig(id),
      setArrangement: (id) => active.setArrangement(id),
      setPaused: (paused) => active.setPaused(paused),
      setShowGrid: (show) => active.setShowGrid(show),
      setShowPivots: (show) => active.setShowPivots(show),
      setShowReferences: (show) => active.setShowReferences(show),
      setMotionEnabled: (enabled) => active.setMotionEnabled(enabled),
      setMotionPhase: (phase) => active.setMotionPhase(phase),
      setCharacterDirection: (role, direction) => active.setCharacterDirection(role, direction),
      gridCellToScreen: (cell) => active.gridCellToScreen(cell),
      screenToWorld: (x, y) => active.screenToWorld(x, y),
      worldToScreen: (x, y) => active.worldToScreen(x, y),
      setZoom: (zoom) => active.setZoom(zoom),
      reset: () => active.reset(),
      getState: () => active.getState(),
      pickAtScreen: (x, y) => active.pickAtScreen(x, y),
    };
  }
  root.querySelectorAll<HTMLButtonElement>("[data-config]").forEach((button) => {
    button.addEventListener("click", () => {
      scene?.setConfig(button.dataset.config as ScaleConfigId);
      root.querySelectorAll("[data-config]").forEach((item) => item.classList.toggle("active", item === button));
    });
  });
  root.querySelectorAll<HTMLButtonElement>("[data-arrangement]").forEach((button) => {
    button.addEventListener("click", () => {
      scene?.setArrangement(button.dataset.arrangement as ArrangementId);
      root.querySelectorAll("[data-arrangement]").forEach((item) => item.classList.toggle("active", item === button));
    });
  });
  root.querySelector<HTMLInputElement>("#pause")?.addEventListener("change", (event) => scene?.setPaused((event.target as HTMLInputElement).checked));
  root.querySelector<HTMLInputElement>("#grid")?.addEventListener("change", (event) => scene?.setShowGrid((event.target as HTMLInputElement).checked));
  root.querySelector<HTMLInputElement>("#pivots")?.addEventListener("change", (event) => scene?.setShowPivots((event.target as HTMLInputElement).checked));
  root.querySelector<HTMLInputElement>("#references")?.addEventListener("change", (event) => scene?.setShowReferences((event.target as HTMLInputElement).checked));
  root.querySelector<HTMLInputElement>("#motion")?.addEventListener("change", (event) => scene?.setMotionEnabled((event.target as HTMLInputElement).checked));
  root.querySelector<HTMLButtonElement>("#reset")?.addEventListener("click", () => {
    scene?.reset();
    const current = scene?.getState();
    root.querySelectorAll<HTMLButtonElement>("[data-config]").forEach((button) => button.classList.toggle("active", button.dataset.config === current?.config));
    root.querySelectorAll<HTMLButtonElement>("[data-arrangement]").forEach((button) => button.classList.toggle("active", button.dataset.arrangement === current?.arrangement));
    for (const id of ["pause", "pivots"]) {
      const input = root.querySelector<HTMLInputElement>(`#${id}`);
      if (input) input.checked = false;
    }
    for (const id of ["grid", "references", "motion"]) {
      const input = root.querySelector<HTMLInputElement>(`#${id}`);
      if (input) input.checked = true;
    }
  });
}

bootstrap().catch((error: unknown) => {
  const status = document.querySelector<HTMLOutputElement>("#lab-status");
  if (status) status.value = error instanceof Error ? error.message : String(error);
});
