import { useEffect, useMemo, useRef, useState } from "react";
import {
  BUILDING_ASSET_STATES,
  type BuildingAssetState,
  type BuildingAssetV1,
  type CharacterAssetV1,
  type RuntimeAssetManifestV1,
} from "@landlord/shared";
import runtimeAssets from "./generated/runtime-assets.json";
import blenderBundle from "./generated/runtime-assets-blender.json";
import { animationFrameFor, framesPerDirection } from "./isometric/building-sprites";
import { mountDenseAssetScene } from "./isometric/DenseAssetScene";

const ASSETS = runtimeAssets as RuntimeAssetManifestV1;
const BLENDER = blenderBundle as unknown as RuntimeAssetManifestV1;

const directions = [
  {
    id: "graphic_civic",
    title: "Graphic civic",
    role: "APPROVED / BASELINE",
    rationale: "Dirección aprobada: contraste estructural y ownership legible.",
    image: "/assets/art-spike/visual_direction_spike_graphic_civic_2026-10-23.png",
  },
  {
    id: "warm_editorial",
    title: "Warm editorial",
    role: "ARCHIVE / ALTERNATIVE",
    rationale: "Alternativa histórica conservada como referencia, no como candidata activa.",
    image: "/assets/art-spike/visual_direction_spike_warm_editorial_2026-10-23.png",
  },
  {
    id: "blue_hour",
    title: "Blue hour ledger",
    role: "ARCHIVE / ALTERNATIVE",
    rationale: "Preset atmosférico archivado; no reabre la baseline visual.",
    image: "/assets/art-spike/visual_direction_spike_blue_hour_2026-10-23.png",
  },
] as const;

const STATE_LABELS: Record<BuildingAssetState, string> = {
  complete: "Complete",
  construction: "Construction",
  damaged: "Damaged",
  burning: "Burning",
};

function manifestProvenance(manifest: RuntimeAssetManifestV1): string {
  return `${manifest.generator.id} v${manifest.generator.version} · ${manifest.generator.method} · ${manifest.provenance.author} · ${manifest.provenance.license}`;
}

function BuildingStates({
  building,
  source,
}: {
  building: BuildingAssetV1;
  source: "Procedural" | "Blender";
}) {
  return (
    <div className="asset-state-grid" data-asset-source={source.toLowerCase()}>
      {BUILDING_ASSET_STATES.map((state) => (
        <figure key={state}>
          <img
            src={building.states[state].src}
            alt={`${building.name} ${STATE_LABELS[state]} (${source})`}
          />
          <figcaption>{STATE_LABELS[state]}</figcaption>
        </figure>
      ))}
    </div>
  );
}

function CharacterStrip({
  character,
  manifest,
  source,
  staticMode,
}: {
  character: CharacterAssetV1;
  manifest: RuntimeAssetManifestV1;
  source: "Procedural" | "Blender";
  staticMode: boolean;
}) {
  const perDirection = framesPerDirection(character, "walk");
  const idlePerDirection = framesPerDirection(character, "idle");
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (staticMode) return;
    const timer = window.setInterval(
      () => setPhase((current) => (current + 1) % perDirection),
      character.animations.walk.frameDurationMs,
    );
    return () => window.clearInterval(timer);
  }, [character.animations.walk.frameDurationMs, perDirection, staticMode]);
  return (
    <article
      className="art-lab-card"
      data-character={character.id}
      data-character-directions={character.directions}
      data-character-source={source}
    >
      <div className="art-lab-card-heading">
        <div>
          <p className="eyebrow">
            {source} · {character.directions} directions
          </p>
          <h3>{character.name}</h3>
        </div>
        <span className="art-lab-status">idle + walk</span>
      </div>
      <dl className="asset-metadata">
        <div>
          <dt>Frames</dt>
          <dd>
            idle {idlePerDirection}/dir · walk {perDirection}/dir
          </dd>
        </div>
        <div>
          <dt>Generator / provenance</dt>
          <dd>{manifestProvenance(manifest)}</dd>
        </div>
      </dl>
      <div className="character-direction-grid">
        {Array.from({ length: character.directions }, (_, direction) => {
          const idleFrame = animationFrameFor(character, "idle", direction, 0);
          const walkFrame = animationFrameFor(character, "walk", direction, phase);
          return (
            <figure key={direction}>
              <div>
                <img src={idleFrame.src} alt={`${character.name} idle ${direction}`} />
                <img
                  data-walk-direction={direction}
                  src={walkFrame.src}
                  alt={`${character.name} walk ${direction}`}
                />
              </div>
              <figcaption>dir {direction} · idle / walk</figcaption>
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

function RuntimeAssetQa() {
  const denseCount = useMemo(() => {
    const value = Number(new URLSearchParams(window.location.search).get("density") ?? 0);
    return Number.isFinite(value) && value > 0 ? Math.min(600, Math.round(value)) : 0;
  }, []);
  const staticMode = useMemo(
    () => new URLSearchParams(window.location.search).get("static") === "1",
    [],
  );
  const proceduralComparison = ASSETS.buildings["courtyard_home"]!;
  const blenderComparison = BLENDER.buildings["courtyard_home"]!;

  return (
    <>
      <section aria-labelledby="asset-qa-title" data-testid="asset-qa">
        <header className="art-lab-section-header">
          <div>
            <p className="eyebrow">Primary workspace · procedural baseline</p>
            <h2 id="asset-qa-title">Asset QA</h2>
          </div>
          <span className="art-lab-status">
            {ASSETS.schemaVersion === 1 ? "schema v1" : "invalid"}
          </span>
        </header>
        <div className="asset-card-grid">
          {Object.values(ASSETS.buildings).map((building) => (
            <article className="art-lab-card" data-building={building.type} key={building.type}>
              <div className="art-lab-card-heading">
                <div>
                  <p className="eyebrow">Building · {building.type}</p>
                  <h3>{building.name}</h3>
                </div>
                <span className="art-lab-status">validated</span>
              </div>
              <dl className="asset-metadata">
                <div>
                  <dt>Footprint</dt>
                  <dd>
                    {building.footprint.width} × {building.footprint.height}
                  </dd>
                </div>
                <div>
                  <dt>Pivot</dt>
                  <dd>
                    {building.pivot.x.toFixed(3)}, {building.pivot.y.toFixed(3)}
                  </dd>
                </div>
                <div>
                  <dt>Generator / provenance</dt>
                  <dd>{manifestProvenance(ASSETS)}</dd>
                </div>
              </dl>
              <BuildingStates building={building} source="Procedural" />
            </article>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="comparison-title"
        className="art-lab-section"
        data-testid="procedural-blender-comparison"
      >
        <header className="art-lab-section-header">
          <div>
            <p className="eyebrow">Per-asset promotion review · runtime unchanged</p>
            <h2 id="comparison-title">Procedural vs Blender</h2>
          </div>
          <span className="art-lab-status">courtyard_home</span>
        </header>
        <article className="art-lab-card comparison-card" data-blender-e2e="courtyard_home">
          <h3>Patio compacto</h3>
          <div className="asset-comparison-grid">
            <section aria-label="Procedural courtyard_home">
              <p className="eyebrow">Procedural · Alpha baseline</p>
              <BuildingStates building={proceduralComparison} source="Procedural" />
              <small>{manifestProvenance(ASSETS)}</small>
            </section>
            <section aria-label="Blender courtyard_home">
              <p className="eyebrow">Blender · candidate / not promoted</p>
              <BuildingStates building={blenderComparison} source="Blender" />
              <small>{manifestProvenance(BLENDER)}</small>
            </section>
          </div>
        </article>
      </section>

      <section
        aria-labelledby="character-qa-title"
        className="art-lab-section"
        data-testid="character-qa"
      >
        <header className="art-lab-section-header">
          <div>
            <p className="eyebrow">Directions · animations · frame ownership</p>
            <h2 id="character-qa-title">Character QA</h2>
          </div>
        </header>
        <div className="asset-card-grid">
          {Object.values(ASSETS.characters).map((character) => (
            <CharacterStrip
              key={`procedural:${character.id}`}
              character={character}
              manifest={ASSETS}
              source="Procedural"
              staticMode={staticMode}
            />
          ))}
          {Object.values(BLENDER.characters).map((character) => (
            <CharacterStrip
              key={`blender:${character.id}`}
              character={character}
              manifest={BLENDER}
              source="Blender"
              staticMode={staticMode}
            />
          ))}
        </div>
      </section>

      <section
        aria-labelledby="technical-qa-title"
        className="art-lab-section"
        data-testid="technical-qa"
      >
        <header className="art-lab-section-header">
          <div>
            <p className="eyebrow">Manifest and repository guards</p>
            <h2 id="technical-qa-title">Technical QA</h2>
          </div>
        </header>
        <dl className="technical-qa-grid">
          <div>
            <dt>Contract</dt>
            <dd>RuntimeAssetManifest schema v1</dd>
          </div>
          <div>
            <dt>Manifest generator</dt>
            <dd>
              {ASSETS.generator.id} v{ASSETS.generator.version}
            </dd>
          </div>
          <div>
            <dt>Hashes / validation</dt>
            <dd>SHA-256 + dimensions + required states</dd>
          </div>
          <div>
            <dt>Blender E2E</dt>
            <dd>20 PNG · building + character · static manifest import</dd>
          </div>
          <div>
            <dt>Binary budget</dt>
            <dd>&lt; 120 KB bundle · 1 MB repository guard</dd>
          </div>
        </dl>
      </section>

      {denseCount > 0 && (
        <section className="art-lab-section" aria-label="Dense performance scene">
          <article className="art-lab-card">
            <div className="art-lab-card-heading">
              <div>
                <p className="eyebrow">Dense performance scene · opt-in query</p>
                <h2>{denseCount} sprites</h2>
              </div>
              <span className="art-lab-status">FPS live</span>
            </div>
            <DenseScene count={denseCount} staticMode={staticMode} />
          </article>
        </section>
      )}
    </>
  );
}

export function ArtLab() {
  return (
    <main className="art-lab-shell">
      <header className="art-lab-header">
        <div>
          <p className="eyebrow">Landlord · internal content tooling</p>
          <h1>Art Lab / Asset QA</h1>
          <p className="art-lab-lede">
            QA de estados, huellas, pivotes, animación y provenance. Graphic civic es la baseline
            aprobada; Blender se revisa por asset antes de cualquier promoción.
          </p>
        </div>
        <a className="art-lab-back" href="/">
          Volver al slice
        </a>
      </header>

      <RuntimeAssetQa />

      <details className="visual-archive art-lab-section" data-testid="visual-direction-archive">
        <summary>
          <span>
            <span className="eyebrow">Historical reference · secondary</span>
            <strong>Visual direction archive</strong>
          </span>
          <span>3 renders</span>
        </summary>
        <div className="art-lab-grid" aria-label="Visual direction archive">
          {directions.map((direction) => (
            <article className="art-lab-card" data-direction={direction.id} key={direction.id}>
              <div className="art-lab-card-heading">
                <div>
                  <p className="eyebrow">{direction.role}</p>
                  <h2>{direction.title}</h2>
                </div>
              </div>
              <img src={direction.image} alt={`${direction.title}: archived visual direction`} />
              <p>{direction.rationale}</p>
            </article>
          ))}
        </div>
      </details>

      <footer className="art-lab-footer">
        <span>Procedural runtime baseline + Blender 5.2.2 candidate assets</span>
        <span>Visual direction: graphic_civic · APPROVED</span>
      </footer>
    </main>
  );
}
