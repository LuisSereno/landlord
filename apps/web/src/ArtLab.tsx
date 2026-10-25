import { useEffect, useMemo, useState } from "react";
import {
  BUILDING_ASSET_STATES,
  type BuildingAssetState,
  type CharacterAssetV1,
  type RuntimeAssetManifestV1,
} from "@landlord/shared";
import runtimeAssets from "./generated/runtime-assets.json";

const ASSETS = runtimeAssets as RuntimeAssetManifestV1;

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

declare global {
  interface Window {
    __artLabFps?: number;
    __artLabSprites?: number;
  }
}

function CharacterStrip({ character }: { character: CharacterAssetV1 }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => setFrame((current) => (current + 1) % character.animations.walk.frames.length),
      character.animations.walk.frameDurationMs,
    );
    return () => window.clearInterval(timer);
  }, [character.animations.walk.frameDurationMs, character.animations.walk.frames.length]);
  const idle = character.animations.idle.frames;
  const walk = character.animations.walk.frames;
  return (
    <article className="art-lab-card" data-character={character.id}>
      <div className="art-lab-card-heading">
        <div>
          <p className="eyebrow">Personaje · {character.directions} direcciones</p>
          <h3>{character.name}</h3>
        </div>
        <span className="art-lab-status">{walk.length} frames</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {Array.from({ length: character.directions }, (_, direction) => {
          const idleFrame = idle[(direction * 2) % idle.length]!;
          const walkFrame = walk[frame % walk.length]!;
          return (
            <figure key={direction} style={{ margin: 0, textAlign: "center" }}>
              <img src={idleFrame.src} alt={`${character.name} quieto ${direction}`} width={36} />
              <img src={walkFrame.src} alt={`${character.name} andando ${direction}`} width={36} />
              <figcaption style={{ fontSize: 10 }}>dir {direction}</figcaption>
            </figure>
          );
        })}
      </div>
    </article>
  );
}

function DenseScene({ count }: { count: number }) {
  const tiles = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => {
        const buildings = Object.values(ASSETS.buildings);
        const building = buildings[index % buildings.length]!;
        const state = BUILDING_ASSET_STATES[index % BUILDING_ASSET_STATES.length]!;
        return { key: index, src: building.states[state].src };
      }),
    [count],
  );
  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    window.__artLabSprites = count;
    const tick = (now: number) => {
      frames += 1;
      if (now - last >= 500) {
        window.__artLabFps = Math.round((frames * 1000) / (now - last));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [count]);
  return (
    <div
      data-testid="dense-scene"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(20, 48px)",
        gap: 2,
        background: "#1c2533",
        padding: 8,
      }}
    >
      {tiles.map((tile) => (
        <img key={tile.key} src={tile.src} width={48} height={42} alt="" />
      ))}
    </div>
  );
}

function RuntimeAssetFactory() {
  const denseCount = useMemo(() => {
    const value = Number(new URLSearchParams(window.location.search).get("density") ?? 0);
    return Number.isFinite(value) && value > 0 ? Math.min(600, Math.round(value)) : 0;
  }, []);
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
        {Object.values(ASSETS.characters).map((character) => (
          <CharacterStrip key={character.id} character={character} />
        ))}
        {denseCount > 0 && (
          <article className="art-lab-card">
            <div className="art-lab-card-heading">
              <div>
                <p className="eyebrow">Perfil de distrito denso</p>
                <h3>{denseCount} sprites</h3>
              </div>
              <span className="art-lab-status">FPS en vivo</span>
            </div>
            <DenseScene count={denseCount} />
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
