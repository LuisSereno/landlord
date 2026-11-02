import { useEffect, useRef } from "react";

import { BuildingThumbnail } from "./building-thumbnail";
import { HelpTooltip } from "./help";
import { UiIcon } from "./icons";
import { buildingTypeLabel } from "./labels";
import {
  confirmablePlacement,
  placementCounterLabel,
  placementHasRotation,
  placementIssue,
  placementSummary,
  type PendingPlacement,
  type PlacementHandlers,
} from "./placement";

/**
 * V.d-7C · ficha de colocación. Enseña lo que el motor ya decidió que es legal y deja elegir.
 * No comprueba retranqueos, cobertura ni frente vial: si el motor no devuelve una candidata, aquí
 * se explica con palabras de jugador y no se puede confirmar nada.
 */
export function PlacementPanel({
  pending,
  handlers,
  blockers = [],
}: {
  pending: PendingPlacement;
  handlers: PlacementHandlers;
  /** Razones económicas de la proyección: se explican, pero no impiden ver el mapa. */
  blockers?: readonly string[];
}) {
  const placementId = confirmablePlacement(pending);
  const issue = placementIssue(pending);
  const candidates = pending.candidates;
  const canRotate = placementHasRotation(pending);
  const section = useRef<HTMLElement>(null);
  /**
   * La ficha se abre dentro de un panel largo: sin traerla a la vista, el jugador ve la lista de
   * candidatas pero no sabe qué proyecto está colocando ni cómo salir.
   */
  useEffect(() => {
    section.current?.scrollIntoView({ block: "nearest" });
  }, [pending.buildingType, pending.status]);
  return (
    <section
      aria-label={`Colocación de ${buildingTypeLabel(pending.buildingType)}`}
      className="panel-section placement-panel"
      ref={section}
    >
      <header className="section-heading">
        <h3>
          <UiIcon name="construction" /> Elegir ubicación
        </h3>
        <HelpTooltip topic="construction" />
      </header>
      <p className="placement-target">
        <BuildingThumbnail size={40} type={pending.buildingType} />
        <span>
          {buildingTypeLabel(pending.buildingType)} · {pending.parcelIds.length} parcela(s)
        </span>
      </p>
      {issue ? (
        <p aria-live="polite" className="placement-issue" role="status">
          <UiIcon name="warning" size={14} /> {issue}
        </p>
      ) : (
        <p aria-live="polite" className="placement-summary" role="status">
          <UiIcon name="success" size={14} /> {placementSummary(pending)} ·{" "}
          {placementCounterLabel(pending)}
        </p>
      )}
      {candidates.length > 0 ? (
        <>
          <div className="placement-controls">
            <button
              aria-label="Colocación anterior"
              disabled={candidates.length < 2}
              onClick={() => handlers.cycle(-1)}
              type="button"
            >
              <span aria-hidden="true">←</span> Anterior
            </button>
            <button
              aria-label="Colocación siguiente"
              disabled={candidates.length < 2}
              onClick={() => handlers.cycle(1)}
              type="button"
            >
              Siguiente <span aria-hidden="true">→</span>
            </button>
            <button
              aria-label="Rotar orientación"
              disabled={!canRotate}
              onClick={handlers.rotate}
              type="button"
            >
              <span aria-hidden="true">⟳</span> Rotar
            </button>
          </div>
          <ul aria-label="Colocaciones legales" className="placement-list" role="list">
            {candidates.map((candidate, index) => {
              const selected = candidate.id === pending.selectedCandidateId;
              return (
                <li key={candidate.id}>
                  <button
                    aria-pressed={selected}
                    className={selected ? "placement-choice selected" : "placement-choice"}
                    onClick={() => handlers.select(candidate.id)}
                    type="button"
                  >
                    <span className="placement-choice-index">{index + 1}</span>
                    <span className="placement-choice-body">
                      {candidate.footprintCells.length} celdas · {candidate.orientation}° ·{" "}
                      {candidate.floors} planta(s)
                    </span>
                    {candidate.recommended ? (
                      <span className="placement-choice-tag">recomendada</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="muted">
            También puedes tocar el mapa: la ficha salta a la colocación legal más cercana. El
            puntero no dibuja huellas nuevas.
          </p>
        </>
      ) : null}
      {blockers.length > 0 && placementId !== null ? (
        <ul aria-label="Falta para poder confirmar" className="blocked-reasons" role="list">
          {blockers.map((message) => (
            <li key={message}>
              <UiIcon name="warning" size={14} /> {message}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="placement-actions">
        <button
          className="primary-action"
          disabled={placementId === null}
          onClick={() => (placementId ? handlers.confirm(placementId) : undefined)}
          type="button"
        >
          <UiIcon name="construction" /> Confirmar proyecto
        </button>
        <button className="text-action" onClick={handlers.cancel} type="button">
          Cancelar
        </button>
      </div>
      <p className="muted">
        Enter confirma · Escape cancela · ← → cambian de colocación · R rota si hay otra orientación
        legal.
      </p>
    </section>
  );
}
