/**
 * Mapa de normales DERIVADO del bake para el experimento de luz dinámica (D-111 §7.3).
 *
 * No se regenera ningún asset de producción ni se escribe un `_n.png` al catálogo: el mapa se
 * calcula en memoria a partir de la luminancia del sprite ya horneado y vive sólo mientras vive la
 * escena. Si el experimento se aprobara, la versión buena la tendría que producir Blender con su
 * propio pase de normales, no este filtro.
 */

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Luminancia normalizada por píxel, con 0 donde el sprite es transparente. */
function luminanceField(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { luma: Float32Array; alpha: Uint8Array } {
  const luma = new Float32Array(width * height);
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const o = i * 4;
    alpha[i] = data[o + 3]!;
    luma[i] = (0.2126 * data[o]! + 0.7152 * data[o + 1]! + 0.0722 * data[o + 2]!) / 255;
  }
  return { luma, alpha };
}

/**
 * Sobel 3×3 sobre la luminancia → normal tangencial. `strength` escala la pendiente: con sprites que
 * ya llevan la luz horneada, las aristas del bake se convierten en relieve falso, que es precisamente
 * el riesgo que este experimento quiere enseñar a medir.
 */
export function buildNormalMapFromSprite(
  source: CanvasImageSource,
  width: number,
  height: number,
  strength = 2.4,
): HTMLCanvasElement {
  const origin = document.createElement("canvas");
  origin.width = Math.max(1, Math.round(width));
  origin.height = Math.max(1, Math.round(height));
  const originContext = origin.getContext("2d");
  const output = document.createElement("canvas");
  output.width = origin.width;
  output.height = origin.height;
  const outputContext = output.getContext("2d");
  if (!originContext || !outputContext) return output;
  originContext.drawImage(source, 0, 0, origin.width, origin.height);
  const image = originContext.getImageData(0, 0, origin.width, origin.height);
  const { luma, alpha } = luminanceField(image.data, origin.width, origin.height);
  const out = outputContext.createImageData(origin.width, origin.height);
  const at = (x: number, y: number): number =>
    luma[
      Math.min(origin.height - 1, Math.max(0, y)) * origin.width +
        Math.min(origin.width - 1, Math.max(0, x))
    ]!;

  for (let y = 0; y < origin.height; y += 1) {
    for (let x = 0; x < origin.width; x += 1) {
      const index = y * origin.width + x;
      const o = index * 4;
      if (alpha[index]! < 8) {
        /** Fuera de la silueta: normal plana, para que la luz no invente relieve en el aire. */
        out.data[o] = 128;
        out.data[o + 1] = 128;
        out.data[o + 2] = 255;
        out.data[o + 3] = 255;
        continue;
      }
      const tl = at(x - 1, y - 1);
      const t = at(x, y - 1);
      const tr = at(x + 1, y - 1);
      const l = at(x - 1, y);
      const r = at(x + 1, y);
      const bl = at(x - 1, y + 1);
      const b = at(x, y + 1);
      const br = at(x + 1, y + 1);
      const dx = tr + 2 * r + br - (tl + 2 * l + bl);
      const dy = bl + 2 * b + br - (tl + 2 * t + tr);
      const nx = -dx * strength;
      const ny = -dy * strength;
      const length = Math.sqrt(nx * nx + ny * ny + 1);
      out.data[o] = Math.round(255 * clamp01((nx / length + 1) / 2));
      out.data[o + 1] = Math.round(255 * clamp01((ny / length + 1) / 2));
      out.data[o + 2] = Math.round(255 * clamp01((1 / length + 1) / 2));
      out.data[o + 3] = 255;
    }
  }
  outputContext.putImageData(out, 0, 0);
  return output;
}

/**
 * Normal MAP PLANO (128,128,255). Es exactamente el contenido del `__NORMAL` que Phaser crea en el
 * renderer, así que devolverlo al desmontar el experimento deja el objeto iluminado en las MISMAS
 * condiciones de shader que antes: el A/B con/sin normales compara un solo factor.
 */
export function makeFlatNormal(width = 4, height = 4): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "rgb(128,128,255)";
    context.fillRect(0, 0, width, height);
  }
  return canvas;
}
