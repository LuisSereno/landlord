/** Physical presentation contracts introduced by V.h visual remediation. */
export const CHARACTER_SOURCE_FRAME_PIXELS = 256;
export const CHARACTER_TARGET_HEIGHT_PIXELS = 28;
export const CHARACTER_RENDER_SCALE =
  CHARACTER_TARGET_HEIGHT_PIXELS / CHARACTER_SOURCE_FRAME_PIXELS;

/**
 * Gamma del aclaramiento de personajes horneados. Medido sobre `chr_worker-d0-walk-0.png`: el bake
 * sale con mediana 10/255 y media 16/255, por debajo del suelo sobre el que pisa, así que a 1× la
 * cuadrilla se leía como una silueta. Con 1.8 la mediana sube a ~41 y la ropa de trabajo sigue
 * siendo oscura; 2.2 ya la decolora a gris.
 */
export const CHARACTER_LIFT_GAMMA = 1.8;

/**
 * Tabla `v ↦ 255·(v/255)^(1/γ)` que aplica la escena al rasterizar una textura de personaje. Es
 * presentación pura: el PNG horneado, su hash y el manifiesto no cambian, y solo se toca el color,
 * nunca el alfa, para no ensuciar el recorte de la silueta.
 */
export const CHARACTER_LIFT_LUT: Uint8Array = (() => {
  const lut = new Uint8Array(256);
  for (let value = 0; value < 256; value += 1) {
    lut[value] = Math.round(255 * (value / 255) ** (1 / CHARACTER_LIFT_GAMMA));
  }
  return lut;
})();
