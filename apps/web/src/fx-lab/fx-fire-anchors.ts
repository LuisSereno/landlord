/**
 * D-111.2 FASE 4.4 — anclajes del incendio, derivados de cada edificio.
 *
 * El laboratorio colocaba los emisores con `sprite.y − 26`: una constante universal que ignoraba que
 * cada sprite mide lo que mide. Para colmo, la premisa era falsa — medido con `scripts/
 * fx-fire-anchor-measure.py` y guardado en
 * `docs/art/graphics-capabilities/evidence/phaser/fire_anchor_measure.json`: los cuatro estados de
 * los seis módulos `bld_*` del catálogo runtime son **el mismo PNG** (`sha256` idéntico entre
 * `complete`, `construction`, `damaged` y `burning`). No hay fuego horneado que copiar: el incendio
 * del laboratorio es 100 % presentación derivada, y su geometría tiene que salir del edificio.
 *
 * De dónde sale cada anclaje, en orden de preferencia:
 * 1. `fireAnchors` en la metadata del asset, si algún día un sprite promocionado los lleva. El
 *    compositor YA publica los focos en metros para sus candidatos (`candidates/*.json`), así que el
 *    hueco existe y está reservado; mientras no se promocione nada, esta rama no dispara.
 * 2. Si no: la **silueta del propio sprite**. Se recorre su alfa una vez por textura y se sacan tres
 *    hitos reales —la primera fila con ancho estructural (cubierta), el centroide de la banda de
 *    cubierta y la línea de suelo del pivote— y sobre ellos se colocan los focos. Un edificio alto
 *    ancla alto; una nave baja, bajo. Ninguna constante en píxeles.
 *
 * Los tamaños se expresan como fracción de la altura del propio sprite, de modo que un rascacielos
 * arde con llamas más grandes que un chalet sin que nadie haya escrito un píxel.
 */
import type Phaser from "phaser";
import { textureSize } from "./fx-effects";
import { EMISSIVE_DEPTH_OFFSET } from "./fx-street";

export type FireFocusKind = "roof" | "wall";

/** Hitos de la silueta, en píxeles del sprite sin escalar. */
export type SilhouetteLandmarks = {
  readonly widthPx: number;
  readonly heightPx: number;
  /** Primera fila cuya anchura ya es estructural (≥35 % de la máxima): borde de cubierta. */
  readonly roofRowPx: number;
  /** Centroide de la banda de cubierta: el punto donde nace un incendio de azotea. */
  readonly roofU: number;
  readonly roofV: number;
  /** Fin de la banda de cubierta: desde ahí empieza el paño de fachada. */
  readonly wallTopV: number;
  /** Línea de suelo según el pivote declarado del asset. */
  readonly groundV: number;
  readonly maxWidthPx: number;
};

export type FireFocus = {
  readonly kind: FireFocusKind;
  /** Coordenadas de mundo de Phaser: el zoom y la cámara se aplican solos, el ancla no se despeina. */
  readonly x: number;
  readonly y: number;
  /** Altura de la llama dominante en px de mundo para ESTE edificio. */
  readonly flameWorldPx: number;
  /** px de mundo por px de sprite: multiplica todos los tamaños de partícula. */
  readonly px: number;
  /** Altura visible del edificio en px de mundo: el humo se dimensiona contra ella, no contra un número. */
  readonly buildingWorldPx: number;
  readonly depth: number;
  readonly landmarks: SilhouetteLandmarks;
};

/** Foco declarado por la metadata de un asset. Reservado para cuando un candidato se promocione. */
export type FireAnchorMetadata = {
  readonly kind?: FireFocusKind;
  readonly u: number;
  readonly v: number;
  /** Altura de llama como fracción de la altura del sprite: la única unidad que este módulo puede honrar. */
  readonly flameFraction?: number;
};

/** Fracciones de la altura del sprite: ver el encabezado. No son píxeles, son proporciones. */
const ROOF_BAND_FRACTION = 0.2;
/**
 * La llama de cubierta mide 0,26 del edificio: con 0,2 (medido en `fire_animation_sheet.png` de la
 * primera corrida) el fuego desaparecía bajo su propio halo y la fachada seguía leyendo intacta.
 */
const ROOF_FLAME_FRACTION = 0.26;
/** El foco de paño es más bajo que el de azotea, pero tiene que verse: 0,16 no es un detalle. */
const WALL_FLAME_FRACTION = 0.16;
/** Dónde cae un incendio de fachada dentro del paño visible: un tercio bajo la cubierta. */
const WALL_FOCUS_FRACTION = 0.34;

const landmarkCache = new Map<string, SilhouetteLandmarks>();

/**
 * Lee la silueta del sprite una vez por textura. Es un dato del asset, no del frame: se cachea y se
 * libera con la escena (`clearFireAnchorCache`).
 */
export function silhouetteOf(
  scene: Phaser.Scene,
  textureKey: string,
  groundV: number,
): SilhouetteLandmarks | null {
  const cached = landmarkCache.get(textureKey);
  if (cached) return cached;
  const measured = textureSize(scene, textureKey);
  if (!measured) return null;
  const probe = document.createElement("canvas");
  probe.width = measured.width;
  probe.height = measured.height;
  const context = probe.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(measured.source, 0, 0);
  const data = context.getImageData(0, 0, probe.width, probe.height).data;
  probe.width = probe.height = 1;

  const widths: number[] = [];
  let maxWidth = 0;
  for (let y = 0; y < measured.height; y += 1) {
    let count = 0;
    for (let x = 0; x < measured.width; x += 1)
      if (data[(y * measured.width + x) * 4 + 3]! > 8) count += 1;
    widths.push(count);
    if (count > maxWidth) maxWidth = count;
  }
  const roofRow = widths.findIndex((w) => w >= maxWidth * 0.35);
  if (roofRow < 0 || maxWidth === 0) return null;
  const bandEnd = Math.min(
    measured.height,
    roofRow + Math.round(measured.height * ROOF_BAND_FRACTION),
  );

  let sumX = 0;
  let sumY = 0;
  let pixels = 0;
  for (let y = roofRow; y < bandEnd; y += 1) {
    for (let x = 0; x < measured.width; x += 1) {
      if (data[(y * measured.width + x) * 4 + 3]! <= 8) continue;
      sumX += x;
      sumY += y;
      pixels += 1;
    }
  }
  if (!pixels) return null;
  const landmarks: SilhouetteLandmarks = {
    widthPx: measured.width,
    heightPx: measured.height,
    roofRowPx: roofRow,
    roofU: sumX / pixels / measured.width,
    roofV: sumY / pixels / measured.height,
    wallTopV: bandEnd / measured.height,
    groundV,
    maxWidthPx: maxWidth,
  };
  landmarkCache.set(textureKey, landmarks);
  return landmarks;
}

/**
 * Focos de un edificio ardiendo. `pivot` es el del manifiesto —el mismo con el que se colocó el
 * sprite—, así que la resta `(u − pivot.x)` es exacta y el ancla sigue al edificio al escalar.
 */
export function fireAnchorsFor(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Image,
  pivot: { x: number; y: number },
  metadata?: readonly FireAnchorMetadata[],
): FireFocus[] {
  const landmarks = silhouetteOf(scene, sprite.texture.key, pivot.y);
  if (!landmarks) return [];
  const px = sprite.displayHeight / Math.max(1, sprite.height);
  const focus = (kind: FireFocusKind, u: number, v: number, flameWorldPx: number): FireFocus => ({
    kind,
    x: sprite.x + (u - pivot.x) * sprite.displayWidth,
    y: sprite.y + (v - pivot.y) * sprite.displayHeight,
    flameWorldPx,
    px,
    buildingWorldPx: sprite.displayHeight,
    /** Mismo desplazamiento de profundidad que la capa emisiva: el fuego se dibuja sobre el paño. */
    depth: sprite.depth + EMISSIVE_DEPTH_OFFSET,
    landmarks,
  });

  /** Metadata de producción: la ruta correcta, pero sólo si el asset la trae. */
  if (metadata?.length) {
    return metadata.map((entry) =>
      focus(
        entry.kind ?? "roof",
        entry.u,
        entry.v,
        (entry.flameFraction ?? ROOF_FLAME_FRACTION) * sprite.displayHeight,
      ),
    );
  }

  const roofFlame = sprite.height * ROOF_FLAME_FRACTION * px;
  const wallFlame = sprite.height * WALL_FLAME_FRACTION * px;
  const wallV = landmarks.wallTopV + (landmarks.groundV - landmarks.wallTopV) * WALL_FOCUS_FRACTION;
  /**
   * Dos focos, no uno: un incendio de azotea solo es una fogata encima del edificio; con un segundo
   * en el paño de fachada la lectura es "el edificio arde por dentro y le sale fuego por fuera".
   */
  return [
    focus("roof", landmarks.roofU, landmarks.roofV, roofFlame),
    focus("wall", landmarks.roofU, wallV, wallFlame),
  ];
}

export function clearFireAnchorCache(): void {
  landmarkCache.clear();
}
