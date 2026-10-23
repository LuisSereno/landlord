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
      <footer className="art-lab-footer">
        <span>Fuente reproducible: Blender 5.2.2 + EEVEE + seed 42</span>
        <span>Baseline propuesta: graphic civic</span>
      </footer>
    </main>
  );
}
