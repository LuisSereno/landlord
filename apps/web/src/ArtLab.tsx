import { useEffect, useMemo, useRef, useState } from "react";
import {
  BUILDING_ASSET_STATES,
  type BuildingAssetState,
  type CharacterAssetV1,
  type RuntimeAssetManifestV1,
} from "@landlord/shared";
import runtimeAssets from "./generated/runtime-assets.json";
import blenderBundle from "../public/assets/runtime/blender/runtime-assets-blender.json";
import { animationFrameFor, framesPerDirection } from "./isometric/building-sprites";
import { mountDenseAssetScene } from "./isometric/DenseAssetScene";

const ASSETS = runtimeAssets as RuntimeAssetManifestV1;
const BLENDER = blenderBundle as unknown as RuntimeAssetManifestV1;

const directions = [
  {
    id: "graphic_civic",
    title: "Graphic civic",
    role: "Baseline recomendada",
    rationale: "Mayor contraste estructural, ownership legible y mejor separación de categoría.",
    image: "/assets/art-spike/visual_direction_spike_graphic_civic_2026-10-23.png",
  },
  {
    id: "warm_editorial",
    title: "Warm editorial",
    role: "Alternativa de tono",
    rationale: "Más calidez material y narrativa; exige vigilar contraste en escenas densas.",
    image: "/assets/art-spike/visual_direction_spike_warm_editorial_2026-10-23.png",
  },
  {
    id: "blue_hour",
    title: "Blue hour ledger",
    role: "Preset atmosférico",
    rationale: "Buen modo nocturno estilizado; no es baseline por su menor margen de contraste.",
    image: "/assets/art-spike/visual_direction_spike_blue_hour_2026-10-23.png",
  },
] as const;

const STATE_LABELS: Record<BuildingAssetState, string> = {
  complete: "Completo",
  construction: "En obra",
  damaged: "Dañado",
  burning: "Incendio",
};

function CharacterStrip({
  character,
  staticMode,
}: {
  character: CharacterAssetV1;
  staticMode: boolean;
}) {
  const perDirection = framesPerDirection(character, "walk");
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (staticMode) return;
    const timer = window.setInterval(
      () => setPhase((current) => (current + 1) % perDirection),
      character.animations.walk.frameDurationMs,
    );
    return () => window.clearInterval(timer);
  }, [character.animations.walk.frameDurationMs, perDirection, staticMode]);
  const walk = character.animations.walk.frames;
  return (
    <article className="art-lab-card" data-character={character.id}>
      <div className="art-lab-card-heading">
        <div>
          <p className="eyebrow">Personaje · {character.directions} direcciones</p>
          <h3>{character.name}</h3>
        </div>
        <span className="art-lab-status">
          {walk.length} frames · {perDirection} por dirección
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {Array.from({ length: character.directions }, (_, direction) => {
          const idleFrame = animationFrameFor(character, "idle", direction, 0);
          const walkFrame = animationFrameFor(character, "walk", direction, phase);
          return (
            <figure key={direction} style={{ margin: 0, textAlign: "center" }}>
              <img src={idleFrame.src} alt={`${character.name} quieto ${direction}`} width={36} />
              <img
                data-walk-direction={direction}
                src={walkFrame.src}
                alt={`${character.name} andando ${direction}`}
                width={36}
              />
              <figcaption style={{ fontSize: 10 }}>dir {direction}</figcaption>
            </figure>
          );
        })}
      </div>
    </article>
  );
}

function DenseScene({ count, staticMode }: { count: number; staticMode: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    return mountDenseAssetScene(container.current, count, staticMode);
  }, [count, staticMode]);
  return <div data-testid="dense-scene" ref={container} />;
}

function RuntimeAssetFactory() {
  const denseCount = useMemo(() => {
    const value = Number(new URLSearchParams(window.location.search).get("density") ?? 0);
    return Number.isFinite(value) && value > 0 ? Math.min(600, Math.round(value)) : 0;
  }, []);
  /** `?static=1` congela la animación para que la captura de regresión visual sea determinista. */
  const staticMode = useMemo(
    () => new URLSearchParams(window.location.search).get("static") === "1",
    [],
  );
  const blenderBuilding = Object.values(BLENDER.buildings)[0]!;
  const blenderCharacter = Object.values(BLENDER.characters)[0]!;
  return (
    <section aria-label="Factoría runtime de assets" style={{ marginTop: 32 }}>
      <header>
        <p className="eyebrow">Factoría procedural · contrato v1</p>
        <h2>Assets runtime generados</h2>
        <p>
          {Object.keys(ASSETS.buildings).length} edificios × {BUILDING_ASSET_STATES.length} estados
          · {Object.keys(ASSETS.characters).length} variantes de personaje · imágenes SVG en data
          URI con pivote, huella y hash.
        </p>
      </header>
      <div style={{ display: "grid", gap: 16 }}>
        {Object.values(ASSETS.buildings).map((building) => (
          <article className="art-lab-card" data-building={building.type} key={building.type}>
            <div className="art-lab-card-heading">
              <div>
                <p className="eyebrow">
                  Edificio · huella {building.footprint.width}×{building.footprint.height}
                </p>
                <h3>{building.name}</h3>
              </div>
              <span className="art-lab-status">
                pivote {building.pivot.x.toFixed(2)}, {building.pivot.y.toFixed(2)}
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {BUILDING_ASSET_STATES.map((state) => (
                <figure key={state} style={{ margin: 0, textAlign: "center" }}>
                  <img
                    src={building.states[state].src}
                    alt={`${building.name} ${STATE_LABELS[state]}`}
                    width={96}
                  />
                  <figcaption style={{ fontSize: 11 }}>{STATE_LABELS[state]}</figcaption>
                </figure>
              ))}
            </div>
          </article>
        ))}
        <article className="art-lab-card" data-blender-e2e={blenderBuilding.type}>
          <div className="art-lab-card-heading">
            <div>
              <p className="eyebrow">Ruta Blender E2E · render → trim → metadata → Phaser</p>
              <h3>{blenderBuilding.name}</h3>
            </div>
            <span className="art-lab-status">
              pivote {blenderBuilding.pivot.x.toFixed(2)}, {blenderBuilding.pivot.y.toFixed(2)}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {BUILDING_ASSET_STATES.map((state) => (
              <figure key={state} style={{ margin: 0, textAlign: "center" }}>
                <img
                  src={blenderBuilding.states[state].src}
                  alt={`${blenderBuilding.name} ${STATE_LABELS[state]} (Blender)`}
                  width={96}
                />
                <figcaption style={{ fontSize: 11 }}>{STATE_LABELS[state]}</figcaption>
              </figure>
            ))}
            {Array.from({ length: blenderCharacter.directions }, (_, direction) => (
              <figure key={direction} style={{ margin: 0, textAlign: "center" }}>
                <img
                  src={animationFrameFor(blenderCharacter, "walk", direction, 0).src}
                  alt={`${blenderCharacter.name} andando ${direction} (Blender)`}
                  width={48}
                />
                <figcaption style={{ fontSize: 11 }}>dir {direction}</figcaption>
              </figure>
            ))}
          </div>
        </article>
        {Object.values(ASSETS.characters).map((character) => (
          <CharacterStrip key={character.id} character={character} staticMode={staticMode} />
        ))}
        {denseCount > 0 && (
          <article className="art-lab-card">
            <div className="art-lab-card-heading">
              <div>
                <p className="eyebrow">Perfil de distrito denso en Phaser</p>
                <h3>{denseCount} sprites</h3>
              </div>
              <span className="art-lab-status">FPS en vivo</span>
            </div>
            <DenseScene count={denseCount} staticMode={staticMode} />
          </article>
        )}
      </div>
    </section>
  );
}

export function ArtLab() {
  return (
    <main className="art-lab-shell">
      <header className="art-lab-header">
        <div>
          <p className="eyebrow">Landlord · visual direction spike</p>
          <h1>Art Lab</h1>
          <p className="art-lab-lede">
            Mismo kit funcional, cámara ortográfica y composición. Sólo cambia la capa de estilo.
          </p>
        </div>
        <a className="art-lab-back" href="/">
          Volver al slice
        </a>
      </header>
      <section className="art-lab-grid" aria-label="Direcciones visuales comparables">
        {directions.map((direction) => (
          <article className="art-lab-card" data-direction={direction.id} key={direction.id}>
            <div className="art-lab-card-heading">
              <div>
                <p className="eyebrow">{direction.role}</p>
                <h2>{direction.title}</h2>
              </div>
              <span className="art-lab-status" aria-label="Render cargado">
                Render
              </span>
            </div>
            <img src={direction.image} alt={`${direction.title}: escena del kit del spike`} />
            <p>{direction.rationale}</p>
            <ul>
              <li>Ortho 45° / 30° · 1024×576 RGBA16</li>
              <li>Residencial, industrial, road, parcela, worker, civilian, vehículo</li>
              <li>Selección, ownership, andamio y humo incluidos</li>
            </ul>
          </article>
        ))}
      </section>
      <RuntimeAssetFactory />
      <footer className="art-lab-footer">
        <span>Fuente reproducible: factoría SVG + Blender 5.2.2 para assets finales</span>
        <span>Baseline propuesta: graphic civic</span>
      </footer>
    </main>
  );
}
