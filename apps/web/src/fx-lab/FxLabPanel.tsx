/**
 * Panel de QA del laboratorio D-111 §7.
 *
 * Sólo se monta desde `/art-lab?artQa=1` (o con cualquier `?fx=…`). Cada familia de efectos se
 * enciende de una en una y el estado inicial son todos apagados. El reloj de los checkboxes es la
 * escena, no React: `lightingNormals` necesita el rig y por eso lo enciende con él. Nada se
 * persiste: no hay `localStorage`, ni preferencias, ni save — el único estado vive en la URL de la
 * página de QA.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mountFxLab, type FxLabController } from "./mount";
import "./fx-lab.css";
import {
  FX_EFFECTS,
  FX_LABELS,
  FX_PRESETS,
  FX_PRESET_TABLE,
  parseFxLabOptions,
  type FxEffect,
  type FxMood,
  type FxPreset,
  type FxRenderer,
} from "./fx-lab-types";
import type { FxLabProbeWindow } from "./mount";
import { candidateMetadataUrl, candidatePngUrl, type CandidateQaMetadata } from "./fx-candidate-qa";

const CAPTURE_VIEWPORT = { width: 960, height: 540 };

export function FxLabPanel() {
  const initial = useMemo(
    () => (typeof window === "undefined" ? null : parseFxLabOptions(window.location.search)),
    [],
  );
  const [effects, setEffects] = useState<FxEffect[]>([...(initial?.effects ?? [])]);
  const [mood, setMood] = useState<FxMood>(initial?.mood ?? "day");
  const [zoom, setZoom] = useState<number>(initial?.zoom ?? 1);
  const [renderer, setRenderer] = useState<FxRenderer>(initial?.renderer ?? "auto");
  /** Preset puesto: el estado manda en la escena, así que se re-sincroniza desde la sonda. */
  const [preset, setPreset] = useState<FxPreset | null>(initial?.preset ?? null);
  const perf = initial?.perf ?? true;
  const container = useRef<HTMLDivElement>(null);
  const controller = useRef<FxLabController | null>(null);
  const [probe, setProbe] = useState<FxLabProbeWindow | null>(null);
  /**
   * D-111.2 cierre: la candidata QA se resuelve ANTES de montar. Si el parámetro `fxCandidate`
   * explicita una candidata y su JSON no está (la ruta `/qa-candidates/` sólo la escribe el arnés),
   * el lab NO se monta: una captura sin candidata no puede pasar por híbrida.
   */
  const [candidate, setCandidate] = useState<
    { metadata: CandidateQaMetadata; pngUrl: string; textureKey: string } | "failed" | null
  >(null);

  useEffect(() => {
    const name = initial?.candidate ?? null;
    if (!name) {
      setCandidate(null);
      return;
    }
    let alive = true;
    fetch(candidateMetadataUrl(name))
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<CandidateQaMetadata>;
      })
      .then((metadata) => {
        if (alive) {
          setCandidate({
            metadata,
            pngUrl: candidatePngUrl(name),
            textureKey: `fx-candidate-${name}`,
          });
        }
      })
      .catch(() => {
        if (alive) setCandidate("failed");
      });
    return () => {
      alive = false;
    };
  }, [initial]);

  /** El renderer se cambia remontando el juego: no se puede migrar de WebGL a CANVAS en caliente. */
  useEffect(() => {
    if (!container.current || !initial) return;
    if (initial.candidate && !candidate) return;
    if (candidate === "failed") return;
    const mounted = mountFxLab(container.current, {
      effects: initial.effects,
      preset: initial.preset,
      mood,
      zoom,
      perf,
      renderer,
      candidate: candidate ?? null,
      ...CAPTURE_VIEWPORT,
    });
    controller.current = mounted;
    const poll = window.setInterval(() => {
      setProbe(mounted.getProbe());
    }, 400);
    return () => {
      window.clearInterval(poll);
      controller.current = null;
      mounted.destroy();
    };
    // mood/zoom se aplican por API; sólo el renderer, la candidata y el estado inicial remontan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderer, candidate]);

  useEffect(() => {
    controller.current?.setMood(mood);
  }, [mood]);

  useEffect(() => {
    controller.current?.setZoom(zoom);
  }, [zoom]);

  /** Un toggle puede arrastrar a otro (`lightingNormals` pide el rig): manda lo que dice la escena. */
  const toggle = useCallback((effect: FxEffect) => {
    const mounted = controller.current;
    if (!mounted) return;
    const on = !mounted.getProbe().effects.includes(effect);
    mounted.applyEffect(effect, on);
    const probe = mounted.getProbe();
    setEffects(probe.effects);
    setPreset(probe.preset);
  }, []);

  const setAll = useCallback((on: boolean) => {
    const mounted = controller.current;
    if (!mounted) return;
    for (const effect of FX_EFFECTS) mounted.applyEffect(effect, on);
    setEffects(mounted.getProbe().effects);
    setPreset(mounted.getProbe().preset);
  }, []);

  /** Un preset fija mood y lista de efectos en la escena; React sólo re-sincroniza lo que ve. */
  const pickPreset = useCallback((name: FxPreset) => {
    const mounted = controller.current;
    if (!mounted) return;
    mounted.applyPreset(name);
    const probe = mounted.getProbe();
    setEffects(probe.effects);
    setMood(probe.mood);
    setPreset(probe.preset);
  }, []);

  const stats = probe?.stats ?? null;

  return (
    <section aria-labelledby="fx-lab-title" className="art-lab-section" data-testid="fx-lab">
      <header className="art-lab-section-header">
        <div>
          <p className="eyebrow">
            D-111 §7 · candidatos de presentación, nada activado por defecto
          </p>
          <h2 id="fx-lab-title">FX Lab · Phaser 4.2.1</h2>
        </div>
        <span className="art-lab-status" data-testid="fx-lab-renderer">
          {probe?.webgl ? "WebGL" : "CANVAS"} · {renderer}
        </span>
      </header>
      {candidate === "failed" && (
        <p className="fx-lab-note" data-testid="fx-lab-candidate-error">
          La candidata <code>{initial?.candidate}</code> no está en <code>/qa-candidates/</code>: la
          ruta QA sólo la escribe el arnés de captura y el lab no se monta sin ella.
        </p>
      )}

      <article className="art-lab-card">
        <div className="fx-lab-controls">
          <div role="group" aria-label="Presets" className="fx-lab-toggles">
            {FX_PRESETS.map((name) => {
              const config = FX_PRESET_TABLE[name];
              const active = (probe?.preset ?? preset) === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => pickPreset(name)}
                  aria-pressed={active}
                  title={config.nota}
                  data-testid={`fx-preset-${name}`}
                  data-active={active ? "yes" : "no"}
                >
                  {config.label}
                </button>
              );
            })}
            <span className="fx-lab-note">
              Preset = configuración guardada (mood + lista de efectos), no una macro de clicks.
              Ninguno lleva bloom por umbral.
            </span>
          </div>
          <div role="group" aria-label="Efectos" className="fx-lab-toggles">
            {FX_EFFECTS.map((effect) => (
              <label key={effect} className="fx-lab-toggle">
                <input
                  type="checkbox"
                  checked={(probe?.effects ?? effects).includes(effect)}
                  onChange={() => toggle(effect)}
                  data-testid={`fx-toggle-${effect}`}
                />
                {FX_LABELS[effect]}
              </label>
            ))}
          </div>
          <div role="group" aria-label="Condiciones" className="fx-lab-toggles">
            <label className="fx-lab-toggle">
              <input
                type="radio"
                name="fx-mood"
                checked={mood === "day"}
                onChange={() => setMood("day")}
                data-testid="fx-mood-day"
              />
              Día
            </label>
            <label className="fx-lab-toggle">
              <input
                type="radio"
                name="fx-mood"
                checked={mood === "night"}
                onChange={() => setMood("night")}
                data-testid="fx-mood-night"
              />
              Noche
            </label>
            <label className="fx-lab-toggle">
              <input
                type="radio"
                name="fx-renderer"
                checked={renderer === "auto"}
                onChange={() => setRenderer("auto")}
                data-testid="fx-renderer-webgl"
              />
              WebGL
            </label>
            <label className="fx-lab-toggle">
              <input
                type="radio"
                name="fx-renderer"
                checked={renderer === "canvas"}
                onChange={() => setRenderer("canvas")}
                data-testid="fx-renderer-canvas"
              />
              CANVAS forzado
            </label>
            <label className="fx-lab-toggle">
              Zoom
              <input
                type="range"
                min={0.5}
                max={2.5}
                step={0.05}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                data-testid="fx-zoom"
              />
              {zoom.toFixed(2)}
            </label>
            <button type="button" onClick={() => setAll(true)} data-testid="fx-all-on">
              Todo ON
            </button>
            <button type="button" onClick={() => setAll(false)} data-testid="fx-all-off">
              Todo OFF
            </button>
          </div>
        </div>

        <div data-testid="fx-lab-scene" className="fx-lab-scene-canvas" ref={container} />

        <dl className="technical-qa-grid" data-testid="fx-lab-metrics">
          <div>
            <dt>FPS (mínimo por rasterizado por software)</dt>
            <dd>{stats ? stats.fps : "—"}</dd>
          </div>
          <div>
            <dt>Frame p50 / p95 (ms)</dt>
            <dd>{stats ? `${stats.frameTimeP50Ms} / ${stats.frameTimeP95Ms}` : "—"}</dd>
          </div>
          <div>
            <dt>Draw calls</dt>
            <dd>{stats?.drawCalls ?? "no expuesto por WebGL"}</dd>
          </div>
          <div>
            <dt>Texturas vivas / bytes</dt>
            <dd>
              {stats && stats.gpuTextureBytes !== null
                ? `${stats.texturesLive} · ${(stats.gpuTextureBytes / 1_048_576).toFixed(2)} MB`
                : "—"}
            </dd>
          </div>
          <div>
            <dt>Emisivos / objetos iluminados / luces</dt>
            <dd>{probe ? `${probe.emissive} · ${probe.litObjects} · ${probe.lights}` : "—"}</dd>
          </div>
          <div>
            <dt>Partículas vivas</dt>
            <dd>{probe?.particles ?? "—"}</dd>
          </div>
          <div>
            <dt>Efectos activos</dt>
            <dd data-testid="fx-lab-active">{probe?.effects.join(", ") || "ninguno"}</dd>
          </div>
          <div>
            <dt>Preset puesto</dt>
            <dd data-testid="fx-lab-preset">
              {probe?.preset ?? preset ?? "ninguno (combinación suelta)"}
            </dd>
          </div>
          <div>
            <dt>Errores de escena</dt>
            <dd data-testid="fx-lab-errors">
              {probe?.errors.length ? probe.errors.join(" | ") : "0"}
            </dd>
          </div>
        </dl>

        <p className="fx-lab-note" data-testid="fx-lab-gl-renderer">
          GPU declarada por el navegador: {probe?.glRenderer ?? "desconocida"} · sin aceleración por
          hardware: los FPS de esta página son un suelo, no una medida de producción.
        </p>

        <details className="fx-lab-api-evidence">
          <summary>API real detectada en el SDK en runtime</summary>
          <ul>
            {Object.entries(probe?.capabilities ?? {}).map(([api, present]) => (
              <li key={api} data-capability={api} data-present={present ? "yes" : "no"}>
                <code>{api}</code> — {present ? "existe" : "NO existe"}
              </li>
            ))}
          </ul>
        </details>
      </article>
    </section>
  );
}
