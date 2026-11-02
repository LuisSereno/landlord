import { useEffect, useMemo, useRef, useState } from "react";
import catalog from "./generated/visual-catalog.json";
import type { ShowcaseSelection } from "./visual-catalog/showcase";

const states = ["complete", "construction", "damaged", "burning"] as const;
const tabs = [
  "Overview",
  "Buildings",
  "Building states",
  "Characters",
  "Animations",
  "Vehicles",
  "Props",
  "Terrain",
  "Parcels",
  "Overlays",
  "Showcase",
  "Coverage",
];

export function VisualCatalog() {
  const staticMode = useMemo(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("static") === "1",
    [],
  );
  const [category, setCategory] = useState("all");
  const [selection, setSelection] = useState<ShowcaseSelection | null>(null);
  const showcase = useRef<HTMLDivElement>(null);
  const controller = useRef<{ destroy: () => void; zoom: (delta: number) => void } | null>(null);
  useEffect(() => {
    if (!showcase.current || typeof window === "undefined") return;
    let active = true;
    void import("./visual-catalog/showcase").then(({ mountVisualShowcase }) => {
      if (active && showcase.current)
        controller.current = mountVisualShowcase(showcase.current, setSelection);
    });
    return () => {
      active = false;
      controller.current?.destroy();
    };
  }, []);
  const buildings = catalog.buildings.filter(
    (building) => category === "all" || building.category === category,
  );
  return (
    <main
      className={`visual-catalog ${staticMode ? "is-static" : ""}`}
      data-testid="visual-catalog"
    >
      <header className="catalog-hero" id="overview">
        <p className="eyebrow">Internal visual encyclopedia · candidate → QA → promote</p>
        <h1>Landlord visual catalog</h1>
        <p>Todo el vocabulario visual relevante, inspeccionable sin jugar una partida.</p>
      </header>
      <nav className="catalog-tabs" aria-label="Catalog sections">
        {tabs.map((tab) => (
          <a key={tab} href={`#${tab.toLowerCase().replaceAll(" ", "-")}`}>
            {tab}
          </a>
        ))}
      </nav>
      <section id="buildings">
        <div className="catalog-heading">
          <h2>Buildings</h2>
          <label>
            Category{" "}
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">All</option>
              <option value="residential">Residential</option>
              <option value="mixed">Mixed</option>
              <option value="industrial">Industrial</option>
              <option value="civic">Civic</option>
            </select>
          </label>
        </div>
        <div className="catalog-building-grid">
          {buildings.map((building) => (
            <article className="catalog-card" data-building-card={building.id} key={building.id}>
              <img
                loading="lazy"
                src={building.states.complete.src}
                alt={`${building.displayName} complete`}
              />
              <h3>{building.displayName}</h3>
              <p>
                {building.category} · {building.floors} floor(s) · {building.footprint.width}×
                {building.footprint.height}
              </p>
              <small>
                {building.source} · {building.status}
              </small>
            </article>
          ))}
        </div>
      </section>
      <section id="building-states">
        <h2>Building states</h2>
        {catalog.buildings.map((building) => (
          <article className="state-row" data-state-row={building.id} key={building.id}>
            <h3>{building.displayName}</h3>
            <div>
              {states.map((state) => (
                <figure key={state}>
                  <img
                    loading="lazy"
                    src={building.states[state].src}
                    alt={`${building.displayName} ${state}`}
                  />
                  <figcaption>{state}</figcaption>
                </figure>
              ))}
            </div>
            {building.duplicateStates.length > 0 && <strong>STATE NOT DIFFERENTIATED</strong>}
          </article>
        ))}
      </section>
      <section id="characters">
        <h2>Characters</h2>
        <div className="catalog-role-grid">
          {catalog.characters.map((character) => (
            <article className="catalog-card" data-character-card={character.id} key={character.id}>
              <div className="role-silhouette">●</div>
              <h3>{character.displayName}</h3>
              <p>
                {character.role} · {character.scope}
              </p>
              <small>
                {character.baseSource} · {character.clothing} · {character.roleProp}
              </small>
            </article>
          ))}
        </div>
      </section>
      <section id="animations">
        <h2>Animations</h2>
        <p>
          Runtime: {catalog.characterAnimations.runtime.join(", ")}. Showcase-only:{" "}
          {catalog.characterAnimations.showcase.join(", ")}.
        </p>
      </section>
      <section id="vehicles">
        <h2>Vehicles</h2>
        <div className="catalog-chip-grid">
          {catalog.world.vehicles.map((item) => (
            <span key={item.id}>
              {item.id} · {item.status}
            </span>
          ))}
        </div>
      </section>
      <section id="props">
        <h2>Props</h2>
        <div className="catalog-chip-grid">
          {catalog.world.props.map((item) => (
            <span key={item.category}>{item.category}</span>
          ))}
        </div>
      </section>
      <section id="terrain">
        <h2>Terrain</h2>
        <div className="catalog-chip-grid">
          {catalog.world.terrain.map((item) => (
            <span key={item.id}>{item.id}</span>
          ))}
        </div>
      </section>
      <section id="parcels">
        <h2>Parcels</h2>
        <p>
          Small rectangle · large rectangle · L-shaped · road frontage · public · industrial ·
          2/3-parcel assembly.
        </p>
      </section>
      <section id="overlays">
        <h2>Overlays</h2>
        <div className="catalog-chip-grid">
          {"none ownership land-value zoning use risk security fire health education transport condition profitability"
            .split(" ")
            .map((value) => (
              <span key={value}>{value}</span>
            ))}
        </div>
      </section>
      <section id="showcase">
        <div className="catalog-heading">
          <h2>Showcase</h2>
          <div>
            <button onClick={() => controller.current?.zoom(-0.1)}>−</button>
            <button onClick={() => controller.current?.zoom(0.1)}>+</button>
          </div>
        </div>
        <div data-testid="showcase-mount" className="showcase-canvas" ref={showcase} />
        {selection && (
          <aside className="showcase-selection">
            <strong>{selection.name}</strong>
            <span>
              {selection.category} · {selection.state} · {selection.footprint}
            </span>
            <small>{selection.source}</small>
          </aside>
        )}
      </section>
      <section id="construction-sequence">
        <h2>Construction demo</h2>
        <div className="construction-sequence">
          {states.map((state) => (
            <figure key={state}>
              <img src={catalog.buildings[0]!.states[state].src} alt={state} />
              <figcaption>{state}</figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section id="scale-reference">
        <h2>Scale reference</h2>
        <div className="scale-reference">
          <span className="scale-person">●</span>
          <span className="scale-door" />
          <span className="scale-car">▰</span>
          <span className="scale-tree">♣</span>
          <span className="scale-cell">4 m cell</span>
        </div>
      </section>
      <section id="coverage">
        <h2>Coverage</h2>
        <dl className="coverage-grid">
          {Object.entries(catalog.coverage).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
