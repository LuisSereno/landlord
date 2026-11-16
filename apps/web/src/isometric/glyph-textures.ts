import { glyphSvgMarkup, type UiIconName } from "../ui/icons";
import { STATUS_COLORS, type StatusTone } from "../ui/overlay-catalog";

/**
 * V.d-UX.S · rasterizado de glifos para la escena.
 *
 * El markup sale del MISMO registro que pinta `UiIcon` (`glyphSvgMarkup`), así que no hay una
 * segunda colección de iconos que pueda divergir. Es síncrono: no hace falta `react-dom/server`
 * en el bundle del navegador ni un import dinámico que añada un chunk lazy.
 *
 * La escena registra el data URI con su helper existente `registerImageTexture`, una vez por
 * (glifo, tono, tamaño). El resultado se cachea por clave: nunca se regenera por frame.
 */

/** Tamaño de rasterizado: sobrado para un badge de 16-22 px en pantalla con zoom alto. */
export const GLYPH_TEXTURE_PX = 48;

const LIGHT_INK = "#f7f1df";
const DARK_INK = "#0c1220";

export function toneHex(tone: StatusTone): number {
  return STATUS_COLORS[tone];
}

export function cssTone(tone: StatusTone): string {
  return `#${STATUS_COLORS[tone].toString(16).padStart(6, "0")}`;
}

function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: number): number {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(first: number, second: number): number {
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Tinta del glifo elegida por CONTRASTE real, no por un umbral de brillo a ojo: sobre teal y ocre
 * gana la tinta oscura, sobre tinta bancaria, rojo y violeta gana la clara. Así ningún badge queda
 * ilegible y el color nunca es el único canal de información.
 */
export function glyphInkFor(tone: number): string {
  const background = luminance(tone);
  const withLight = contrast(background, luminance(0xf7f1df));
  const withDark = contrast(background, luminance(0x0c1220));
  return withDark >= withLight ? DARK_INK : LIGHT_INK;
}

export function glyphTextureKey(
  name: UiIconName,
  tone: StatusTone,
  px: number = GLYPH_TEXTURE_PX,
): string {
  return `glyph:${name}:${cssTone(tone)}:${px}`;
}

/** Data URI autónomo del glifo con la tinta que corresponde al tono de fondo. */
export function glyphDataUri(
  name: UiIconName,
  tone: StatusTone,
  px: number = GLYPH_TEXTURE_PX,
): string {
  const markup = glyphSvgMarkup(name, { size: px, stroke: glyphInkFor(toneHex(tone)) });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}