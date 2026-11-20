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
 */
export function extractEmissiveLayer(
  source: CanvasImageSource,
  width: number,
  height: number,
  threshold = 0.72,
  softness = 0.14,
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
    const weight = Math.min(1, Math.max(0, (luminance - threshold) / softness));
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
