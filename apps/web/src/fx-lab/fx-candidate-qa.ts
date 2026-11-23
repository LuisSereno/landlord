/**
 * D-111.2 cierre — ruta QA para sprites candidatos del Building Composer.
 *
 * Los candidatos publican sus focos de incendio en METROS de escena (`fireAnchors[].position`,
 * zRangeMeters) junto con la cámara ortográfica (azimut 45°, elevación 30°), el encuadre y el
 * recorte con los que se renderizó el PNG. Este adaptador convierte esas posiciones a las
 * coordenadas normalizadas (u,v) del sprite que `fireAnchorsFor()` ya sabe consumir, de modo que
 * el rig de `fx-fire.ts` colocará el cuerpo animado donde Blender horneó el suyo — un solo
 * algoritmo, sin silueta compitiendo.
 *
 * La matemática es la misma que `runtime_asset.pivot_from_origin` aplica al origen: `pivot`
 * publicado es la proyección de (0,0,0) sobre el PNG recortado, y dos candidatos (1082×1233 y
 * 1091×1237) la reproducen a 4 decimales — esa es la prueba de que la conversión no inventa nada.
 *
 * Sólo alcanza a sprites cargados por la ruta QA (`fxCandidate=<name>` en `/art-lab`): producción
 * sigue sin promocionar candidatos y el catálogo runtime no cambia.
 */
import type { FireAnchorMetadata } from "./fx-fire-anchors";

export type ComposerFireAnchor = {
  readonly focus: string;
  readonly purpose: string;
  readonly position: readonly [number, number, number];
  readonly zRangeMeters: readonly [number, number];
};

/** Subconjunto de la metadata §24 que el adaptador necesita; el JSON del candidato lo trae entero. */
export type CandidateQaMetadata = {
  readonly candidateId: string;
  readonly buildingType: string;
  readonly state: string;
  readonly compositionSignature: string;
  readonly candidateProfile?: string;
  /** `weathering.visualState` es lo que hace que `mixed_tenement-aged` exista como variante QA. */
  readonly weathering?: unknown;
  readonly footprintCells: { readonly width: number; readonly height: number };
  readonly camera: {
    readonly azimuthDegrees: number;
    readonly elevationDegrees: number;
    readonly targetZ: number;
  };
  readonly trim: {
    readonly rendered: { readonly width: number; readonly height: number };
    readonly cropped: {
      readonly width: number;
      readonly height: number;
      readonly offsetX: number;
      readonly offsetY: number;
    };
    readonly final: { readonly width: number; readonly height: number };
  };
  readonly framing: { readonly pixelsPerMeter: number };
  readonly pivot: { readonly x: number; readonly y: number };
  /** Sólo los candidatos `burning` publican focos; `complete`/`damaged`/`aged` no traen la clave. */
  readonly fireAnchors?: readonly ComposerFireAnchor[];
};

/** Cómo se llaman los hermanos dentro de la ruta QA de la captura; el arnés los copia juntos. */
export function candidatePngUrl(name: string): string {
  return `/qa-candidates/${name}.png`;
}

export function candidateMetadataUrl(name: string): string {
  return `/qa-candidates/${name}.json`;
}

/**
 * FINAL-ASSET-QA 2.3 · prohibición de sustituciones silenciosas. La ruta QA sólo acepta la candidata
 * solicitada: valida que la metadata declare identidad (`candidateId`, `candidateProfile`,
 * `compositionSignature`), que el TIPO sea el pedido (el nombre es el `buildingType`, o
 * `buildingType-estado` para variantes) y que el ESTADO corresponda. Si algo falla se informa
 * explícitamente — nunca se muestra otro edificio antiguo como sustituto.
 */
export type CandidateQaValidation =
  | { readonly ok: true; readonly requestedName: string }
  | { readonly ok: false; readonly requestedName: string; readonly problems: readonly string[] };

export function validateCandidateQa(
  meta: CandidateQaMetadata,
  requestedName: string,
): CandidateQaValidation {
  const problems: string[] = [];
  if (!meta.candidateId) problems.push("metadata sin candidateId");
  if (!meta.candidateProfile) problems.push("metadata sin candidateProfile");
  if (!meta.compositionSignature) problems.push("metadata sin compositionSignature");
  if (!meta.buildingType) {
    problems.push("metadata sin buildingType");
  } else if (requestedName !== meta.buildingType && !requestedName.startsWith(`${meta.buildingType}-`)) {
    problems.push(
      `tipo solicitado "${requestedName}" no corresponde a la candidata "${meta.buildingType}"`,
    );
  }
  if (!meta.state) {
    problems.push("metadata sin state");
  } else if (meta.buildingType && requestedName.startsWith(`${meta.buildingType}-`)) {
    const requestedState = requestedName.slice(meta.buildingType.length + 1);
    // `aged` es una proyección de MATERIAL sobre `complete` (contrato de weathering), no un cuarto
    // estado geométrico: la variante pedida es válida cuando la metadata la declara en `weathering`.
    const weatheringState =
      typeof meta.weathering === "object" && meta.weathering !== null
        ? ((meta.weathering as { visualState?: string }).visualState ?? null)
        : null;
    if (requestedState !== meta.state && requestedState !== weatheringState) {
      problems.push(`variante pedida "${requestedState}" no disponible; la candidata es "${meta.state}"`);
    }
  }
  return problems.length
    ? { ok: false, requestedName, problems }
    : { ok: true, requestedName };
}

/**
 * Metros de la escena del compositor → píxel del PNG final. Misma cadena que `pivot_from_origin`:
 * proyección ortográfica sobre el lienzo renderizado (px/m del framing), menos el offset del
 * recorte, reescalado al PNG publicado por el factor `final/cropped` (supersample).
 */
export function composerPointToSpriteUv(
  meta: CandidateQaMetadata,
  x: number,
  y: number,
  z: number,
): { u: number; v: number } {
  const theta = (meta.camera.azimuthDegrees * Math.PI) / 180;
  const phi = (meta.camera.elevationDegrees * Math.PI) / 180;
  /** Ejes de cámara derivados de `place_camera`: right=(sinθ,cosθ,0), up=(−sinφcosθ, sinφsinθ, cosφ). */
  const rightX = Math.sin(theta);
  const rightY = Math.cos(theta);
  const upX = -Math.sin(phi) * Math.cos(theta);
  const upY = Math.sin(phi) * Math.sin(theta);
  const upZ = Math.cos(phi);

  const screenX = rightX * x + rightY * y;
  const screenY = upX * x + upY * y + upZ * (z - meta.camera.targetZ);
  const scale = meta.trim.final.width / meta.trim.cropped.width;

  const px =
    (meta.trim.rendered.width / 2 +
      screenX * meta.framing.pixelsPerMeter -
      meta.trim.cropped.offsetX) *
    scale;
  const py =
    (meta.trim.rendered.height / 2 -
      screenY * meta.framing.pixelsPerMeter -
      meta.trim.cropped.offsetY) *
    scale;
  return { u: px / meta.trim.final.width, v: py / meta.trim.final.height };
}

/**
 * Focos de incendio listos para `fireAnchorsFor()`. Los anclajes `fire:smoke` se quedan fuera: el
 * sprite QA hornea su columna (la variante híbrida redujo las LLAMAS estáticas, no el humo) y el
 * rig no debe soltar una segunda columna sobre la primera.
 */
export function candidateFireMetadata(meta: CandidateQaMetadata): FireAnchorMetadata[] {
  const out: FireAnchorMetadata[] = [];
  for (const anchor of meta.fireAnchors ?? []) {
    if (!anchor.purpose.startsWith("fire:flame")) continue;
    const [x, y, z] = anchor.position;
    const [zMin, zMax] = anchor.zRangeMeters;
    const { u, v } = composerPointToSpriteUv(meta, x, y, z);
    const phi = (meta.camera.elevationDegrees * Math.PI) / 180;
    const scale = meta.trim.final.width / meta.trim.cropped.width;
    const flameFraction =
      (Math.cos(phi) * (zMax - zMin) * meta.framing.pixelsPerMeter * scale) /
      meta.trim.final.height;
    out.push({
      kind: anchor.purpose === "fire:flame:window" ? "wall" : "roof",
      u,
      v,
      flameFraction,
    });
  }
  return out;
}
