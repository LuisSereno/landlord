/**
 * Texturas derivadas en runtime para el laboratorio D-111 §7.
 *
 * Se generan en un canvas 2D al cargar la escena: el repo no recibe ningún binario nuevo (D-100 /
 * D-101 siguen intactos) y el catálogo de producción no se toca. Todo lo que aquí se produce es
 * presentación desechable, hija de un sprite ya existente.
 */

/** Color cálido de lámpara de incandescencia de época (1925-1940), en sRGB. */
export const LAMP_RGB = { r: 255, g: 196, b: 122 } as const;

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

/**
 * Reconstruye un canvas a partir de un source de textura de Phaser. Phaser acepta `canvas` como
 * source, así que el round-trip conserva el tamaño exacto del frame.
 */
function sourceToCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext("2d");
  if (context) context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export type EmissiveExtraction = {
  readonly canvas: HTMLCanvasElement;
  /** Fracción de píxeles opacos del original que sobrevivió al umbral: 0 ⇒ sin emisivos. */
  readonly coverage: number;
  /** Máximo de luminancia encontrado, para saber si el umbral era alcanzable. */
  readonly peakLuminance: number;
};

/**
 * EXTRAe la capa emisiva de un sprite prerenderizado: conservan alfa sólo los píxeles por encima de
 * `threshold` de luminancia normalizada (0-1). Es el mecanismo con el que el laboratorio marca «qué
 * pinta luz» sin tocar el asset ni añadir metadatos de producción: los ventanales y cabezas de
 * farola ya son lo más brillante del bake, así que el umbral los aísla solo.
 *
 * El resultado se tiñe a la temperatura de lámpara y se normaliza para que lo más brillante quede
 * cerca de 1.0: es lo que después corta el `Threshold` del bloom.
 *
 * `warmOnly` añade además la condición de MATIZ: solo sobrevive lo cálido (R sobre B). Hace falta
 * porque los estados `burning` del catálogo runtime no llevan fuego horneado —son el mismo PNG que
 * `complete`, medido en `scripts/fx-fire-anchor-measure.py`—, de modo que un umbral de luminancia
 * pintaba de naranja el alféizar más soleado y el laboratorio lo vendía como incendio.
 */
export function extractEmissiveLayer(
  source: CanvasImageSource,
  width: number,
  height: number,
  threshold = 0.72,
  softness = 0.14,
  warmOnly = false,
): EmissiveExtraction {
  const origin = sourceToCanvas(source, width, height);
  const output = makeCanvas(origin.width, origin.height);
  const originContext = origin.getContext("2d");
  const outputContext = output.getContext("2d");
  if (!originContext || !outputContext) {
    return { canvas: output, coverage: 0, peakLuminance: 0 };
  }
  const image = originContext.getImageData(0, 0, origin.width, origin.height);
  const data = image.data;
  let opaque = 0;
  let emitted = 0;
  let peak = 0;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]!;
    if (alpha < 8) {
      data[i + 3] = 0;
      continue;
    }
    opaque += 1;
    const luminance = (0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!) / 255;
    if (luminance > peak) peak = luminance;
    /** Ramp suave: evita el borde de cuchara en la silueta de la ventana. */
    const brightness = Math.min(1, Math.max(0, (luminance - threshold) / softness));
    /** Puerta de matiz: R sobre B, con su propio rampa para no dejar un borde duro. */
    const warmth = warmOnly ? Math.min(1, Math.max(0, (data[i]! - data[i + 2]! - 24) / 40)) : 1;
    const weight = brightness * warmth;
    if (weight <= 0) {
      data[i + 3] = 0;
      continue;
    }
    emitted += 1;
    data[i] = LAMP_RGB.r;
    data[i + 1] = LAMP_RGB.g;
    data[i + 2] = LAMP_RGB.b;
    data[i + 3] = Math.round(alpha * weight);
  }
  outputContext.putImageData(image, 0, 0);
  return { canvas: output, coverage: opaque === 0 ? 0 : emitted / opaque, peakLuminance: peak };
}

/** Disco suave radial: base de humo, polvo y chispa. Nunca se versiona como PNG. */
export function makeSoftDisc(size: number, inner: string, outer: string): HTMLCanvasElement {
  const canvas = makeCanvas(size, size);
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  const half = canvas.width / 2;
  const gradient = context.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.55, inner);
  gradient.addColorStop(1, outer);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(half, half, half, 0, Math.PI * 2);
  context.fill();
  return canvas;
}

/** Mote de polvo con núcleo más marcado: lee como obra, no como fuego. */
export function makeDustMote(size: number): HTMLCanvasElement {
  const canvas = makeSoftDisc(size, "rgba(222,205,178,0.95)", "rgba(222,205,178,0)");
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  context.globalCompositeOperation = "source-atop";
  context.fillStyle = "rgba(255,255,255,0.25)";
  context.fillRect(0, 0, canvas.width, canvas.height * 0.45);
  return canvas;
}

/** Brasa: núcleo casi blanco y halo anaranjado, para que el umbral de bloom la pesque. */
export function makeEmber(size: number): HTMLCanvasElement {
  return makeSoftDisc(size, "rgba(255,241,205,1)", "rgba(255,108,20,0)");
}

/** Columna de humo: disco plano y sucio, alfa bajo para no tapar la silueta del edificio. */
export function makeSmokePuff(size: number): HTMLCanvasElement {
  return makeSoftDisc(size, "rgba(150,148,146,0.55)", "rgba(84,86,92,0)");
}

/**
 * Humo alto: el mismo disco pero más suelto y más pálido, para que la familia ascendente no se lea
 * como la repetición de la del foco. Un solo degradado radial no da silueta a 0,5×.
 */
export function makeSmokeWisp(size: number): HTMLCanvasElement {
  const canvas = makeCanvas(size, size);
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  const half = canvas.width / 2;
  /**
   * Los alfas van aquí, no en el emisor: la columna tiene que existir sobre el cielo nocturno sin
   * tapar la silueta del edificio. Con 0,10/0,12/0,14 la pluma era invisible en la hoja de animación
   * y el incendio leía como una fogata sin humo.
   */
  for (const [radius, alpha] of [
    [0.42, 0.14],
    [0.3, 0.16],
    [0.19, 0.18],
  ] as const) {
    const cx = half + (radius - 0.32) * half * 0.9;
    const cy = half - (radius - 0.3) * half * 0.6;
    const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, canvas.width * radius);
    gradient.addColorStop(0, `rgba(168,164,158,${alpha + 0.2})`);
    gradient.addColorStop(0.6, `rgba(126,124,122,${alpha})`);
    gradient.addColorStop(1, "rgba(92,94,100,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

/**
 * Lengua de fuego dibujada a mano, no un disco teñido: el encargo prohíbe que el cuerpo del incendio
 * dependa de partículas de brasa. `variant` cambia la silueta (estecha y torcida) para que dos
 * lenguas contiguas no sean el mismo dibujo escalado.
 *
 * Se compone de tres pasadas concéntricas (núcleo, cuerpo, borde) con el mismo trazado exterior y
 * radios cada vez más pequeños: así el degradado va de blanco amarillento dentro a rojo fuera sin
 * bordes de cuchara, que es lo que hacía plano el fuego del laboratorio.
 */
export function makeFlameTongue(size: number, variant = 0): HTMLCanvasElement {
  const width = Math.round(size * (variant === 0 ? 0.62 : 0.78));
  const height = Math.round(size * 1.5);
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  const lean = variant === 0 ? 0.06 : -0.11;
  const tip = 0.1 + variant * 0.05;

  /** Lágrima apuntando arriba, con la base redonda y el filo controlado por `lean`. */
  const path = (cx: number, baseY: number, halfWidth: number, topY: number) => {
    context.beginPath();
    context.moveTo(cx - halfWidth, baseY);
    context.bezierCurveTo(
      cx - halfWidth * 1.05,
      baseY - (baseY - topY) * 0.42,
      cx + halfWidth * lean - halfWidth * 0.5,
      baseY - (baseY - topY) * 0.72,
      cx + halfWidth * lean,
      topY,
    );
    context.bezierCurveTo(
      cx + halfWidth * 1.02 + halfWidth * lean,
      baseY - (baseY - topY) * 0.66,
      cx + halfWidth * 1.05,
      baseY - (baseY - topY) * 0.34,
      cx + halfWidth,
      baseY,
    );
    context.quadraticCurveTo(cx, baseY + halfWidth * 0.55, cx - halfWidth, baseY);
    context.closePath();
  };

  const zones: readonly [number, string, number][] = [
    [1.0, "rgba(226,74,18,0.72)", 0.0],
    [0.72, "rgba(255,146,32,0.88)", 0.0],
    [0.42, "rgba(255,226,150,0.96)", 0.0],
  ];
  for (const [shrink, color] of zones) {
    const halfWidth = (width / 2) * shrink * 0.94;
    const baseY = height * 0.94;
    const topY = height * (tip + (1 - shrink) * 0.16);
    path(width / 2, baseY, halfWidth, topY);
    const gradient = context.createLinearGradient(0, baseY, 0, topY);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.55, color);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fill();
  }
  return canvas;
}

/**
 * Resplandor del incendio: halo cálido ancho y muy transparente, para luz próxima, no para farola.
 *
 * Los alfas están bajos a propósito y se midieron: con 0,5/0,55 en ADD sobre la escena nocturna el
 * centro saturaba a blanco y se comía la silueta de la llama (primera corrida de
 * `fire_animation_sheet.png`). El halo tiene que envolver el fuego, no sustituirlo.
 */
export function makeFireGlow(size: number): HTMLCanvasElement {
  const canvas = makeSoftDisc(size, "rgba(255,140,58,0.3)", "rgba(255,96,24,0)");
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  context.globalCompositeOperation = "source-atop";
  const half = canvas.width / 2;
  const core = context.createRadialGradient(half, half, 0, half, half, half * 0.34);
  core.addColorStop(0, "rgba(255,206,140,0.3)");
  core.addColorStop(1, "rgba(255,180,90,0)");
  context.fillStyle = core;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}
