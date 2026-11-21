/**
 * Aplicación y desmontaje de cada familia de efectos del laboratorio D-111 §7.
 *
 * Contrato de este módulo: TODA función es no-op seguro cuando el renderer no es WebGL, devuelve un
 * disposer idempotente y nunca lanza. La degradación (§7.5) es responsabilidad de aquí, no de la UI:
 * si Phaser no puede, la escena sigue dibujando el mundo igual que sin efectos.
 */
import Phaser from "phaser";
import { extractEmissiveLayer } from "./fx-textures";
import { buildNormalMapFromSprite } from "./fx-normal-map";

export type DisposeResult = { readonly applied: boolean; readonly note: string };
export type Disposer = () => void;

export function isWebGL(scene: Phaser.Scene): boolean {
  const renderer = scene.game.renderer as Partial<Phaser.Renderer.WebGL.WebGLRenderer> | undefined;
  return Boolean(renderer && renderer.gl);
}

/**
 * Sonda del SDK en runtime: es la evidencia de qué API existe REALMENTE en la copia instalada de
 * Phaser 4.2.1, medida sobre el objeto vivo en vez de sobre la documentación. Las claves `* (v3)`
 * deben salir `false`: se comprueban precisamente para dejar constancia de la API desaparecida.
 */
export function probeFxCapabilities(scene: Phaser.Scene): Record<string, boolean> {
  const proto = Phaser.GameObjects.Image.prototype as unknown as Record<string, unknown>;
  const actions = Phaser.Actions as unknown as Record<string, unknown> | undefined;
  const filters = Phaser.Filters as unknown as Record<string, unknown> | undefined;
  const camera = scene.cameras.main as unknown as Record<string, unknown>;
  const lists = scene.cameras.main.filters as unknown as Record<string, unknown> | undefined;
  const internal = lists?.["internal"] as Record<string, unknown> | undefined;
  const texture = scene.textures.get("__DEFAULT") as unknown as Record<string, unknown>;
  const rendererNamespace = Phaser.Renderer.WebGL as unknown as Record<string, unknown> | undefined;
  return {
    "GameObject.enableFilters()": typeof proto["enableFilters"] === "function",
    "GameObject.preFX (v3)": "preFX" in proto,
    "GameObject.postFX (v3)": "postFX" in proto,
    "Camera.postFX (v3)": "postFX" in camera,
    "Camera.filters.internal.addColorMatrix": typeof internal?.["addColorMatrix"] === "function",
    "Camera.filters.internal.addParallelFilters":
      typeof internal?.["addParallelFilters"] === "function",
    "Camera.filters.internal.addThreshold": typeof internal?.["addThreshold"] === "function",
    "Camera.filters.internal.addImageLight": typeof internal?.["addImageLight"] === "function",
    "Camera.filters.internal.addGlow": typeof internal?.["addGlow"] === "function",
    "Camera.filters.internal.addVignette": typeof internal?.["addVignette"] === "function",
    "Camera.filters.external": Boolean(lists?.["external"]),
    "Phaser.Filters.ParallelFilters": typeof filters?.["ParallelFilters"] === "function",
    "Phaser.Actions.AddEffectBloom": typeof actions?.["AddEffectBloom"] === "function",
    "Phaser.Filters.Bloom (v3 FX)": "Bloom" in (filters ?? {}),
    "GameObject.setLighting() (v4)": typeof proto["setLighting"] === "function",
    "GameObject.setSelfShadow() (v4)": typeof proto["setSelfShadow"] === "function",
    "Renderer.WebGL.Pipelines (v3)": Boolean(rendererNamespace?.["Pipelines"]),
    "lights.enable": typeof scene.lights.enable === "function",
    "lights.addLight (diffuso)": typeof scene.lights.addLight === "function",
    "lights.addConeLight (v4)": typeof scene.lights.addConeLight === "function",
    "lights.addPointLight (glow visible)": typeof scene.lights.addPointLight === "function",
    "lights.setAmbientColor": typeof scene.lights.setAmbientColor === "function",
    "add.pointlight":
      typeof (scene.add as unknown as Record<string, unknown>)["pointlight"] === "function",
    "Texture.setDataSource (normales)": typeof texture?.["setDataSource"] === "function",
    "add.particles": typeof scene.add.particles === "function",
  };
}

/* ------------------------------------------------------------------ 7.1 grading */

/**
 * Matriz de grading cálida sobre el `Phaser.Display.ColorMatrix` del filtro.
 *
 * Nota de API medida en 4.2.1: `ColorMatrix#sepia()` NO acepta cantidad (es `sepia(multiply?)`,
 * todo-o-nada), así que el viraje de época se aplica como ganancia por canal sobre la matriz ya
 * compuesta: R +7 %, G neutro, B −10 %. Es la misma corrección que haría una sepia al ~16 % sin el
 * naranja plano de `sepia()` completo.
 *
 * §5.2 — de NOCHE el levantado de negros se recorta y el contraste sube. Con 0,045/0,14 (los valores
 * del pase diurno) la calle nocturna salía lechosa: el negro elevado se sumaba al ambiente bajo y la
 * fachada perdía el relieve. Aquí se toca la CURVA, no la exposición: la oscuridad de la calle se
 * resolvió con el color de ambiente y los radios de luz, no levantando todo el fotograma.
 */
function warmGrade(matrix: Phaser.Display.ColorMatrix, mood: "day" | "night"): void {
  matrix.reset();
  /** Levantado de negros + contraste suave + ligera desaturación: la maqueta es mate. */
  matrix.brightness(mood === "night" ? 0.02 : 0.045);
  matrix.contrast(mood === "night" ? 0.2 : 0.14);
  matrix.saturate(-0.1);
  const data = matrix.getData();
  data[0] = (data[0] ?? 1) * 1.07;
  data[6] = (data[6] ?? 1) * 1.0;
  data[12] = (data[12] ?? 1) * 0.9;
  matrix.set(data);
}

export function applyGrading(
  scene: Phaser.Scene,
  mood: "day" | "night",
): { dispose: Disposer } | null {
  if (!isWebGL(scene)) return null;
  const camera = scene.cameras.main;
  const color = camera.filters.internal.addColorMatrix();
  warmGrade(color.colorMatrix, mood);
  /**
   * La viñeta entra como MULTIPLY suave: empuja la mirada al centro de la calzada y disimula el
   * borde del viewport sin tocar la legibilidad de los edificios de la esquina.
   */
  const vignette = camera.filters.internal.addVignette(
    0.5,
    0.5,
    // `radius` es el radio NORMALIZADO dentro del cual no hay efecto y `strength` la opacidad del
    // borde (semántica de Phaser 4, no la de v3). Con 0,5/0,28 la calzada quedaba dentro de un
    // óvalo pequeño y las esquinas casi negras: se ensancha el radio y se baja la fuerza.
    // §5.2 segunda pasada: a 0,78/0,3 nocturno el edificio de la esquina izquierda —el que arde—
    // perdía lectura de paño. El radio pasa a 0,92/0,9 (casi todo el viewport limpio) y la fuerza
    // baja a 0,12/0,1: la viñeta deja de ser información tapada y pasa a ser sólo encuadre.
    mood === "night" ? 0.92 : 0.9,
    mood === "night" ? 0.12 : 0.1,
    mood === "night" ? 0x101828 : 0x2a2118,
    Phaser.BlendModes.MULTIPLY,
  );
  return {
    dispose: () => {
      camera.filters.internal.remove(vignette, true);
      camera.filters.internal.remove(color, true);
    },
  };
}

/* ------------------------------------------------------------------- 7.2 bloom */

export type EmissiveOverlay = {
  readonly image: Phaser.GameObjects.Image;
  /**
   * `fireGlow` es el halo del incendio: entra en la lista para que el bloom por objeto lo pesque,
   * pero su alfa lo manda el rig de fuego (varía con la llama), no el mood de la calle.
   *
   * `lampPool` es la charca de luz sobre el pavimento: mismo disco que `lamp` pero aplastado a la
   * altura de la calzada. Se declara aparte porque no va en el aire y porque el bloom se le niega
   * por el mismo motivo que a la cabeza de la farola (§7.2: agrandaría un disco ya pintado).
   */
  readonly kind: "window" | "lamp" | "lampPool" | "fire" | "fireGlow";
};

/**
 * Bloom LOCALIZADO por umbral de luminancia sobre la cámara.
 *
 * Phaser 4.2.1 no trae filtro Bloom (ver `Phaser.Filters` y la tabla de migración del propio
 * paquete). El sustituto oficial es `ParallelFilters` + `Threshold` + `Blur` + mezcla ADitiva, y eso
 * es exactamente lo que hace `Phaser.Actions.AddEffectBloom`. La localización NO viene de una lista
 * de objetos sino de la franja de luminancia: sólo pasan al pase difuso los píxeles por encima de
 * `edge1`, y en esta escena esos píxeles son exclusivamente la capa emisiva que se inyecta por
 * separado (ventanas y farolas horneadas, brasas). El gradiente de suelo mate y las fachadas quedan
 * por debajo del umbral.
 */
export function applyThresholdBloom(
  scene: Phaser.Scene,
  options: { edge1?: number; blurRadius?: number; blendAmount?: number } = {},
): { dispose: Disposer } | null {
  if (!isWebGL(scene)) return null;
  const created = Phaser.Actions.AddEffectBloom(scene.cameras.main, {
    threshold: options.edge1 ?? 0.82,
    blurRadius: options.blurRadius ?? 3,
    blurSteps: 3,
    blurQuality: 0,
    blendAmount: options.blendAmount ?? 0.65,
    useInternal: true,
  });
  return {
    dispose: () => {
      for (const entry of created) entry.parallelFilters.destroy();
    },
  };
}

/**
 * Bloom LOCALIZADO por objeto: cada marcador emisivo lleva su propio `ParallelFilters` interno, así
 * que el pase difuso no puede tocar NUNCA un píxel de fachada. Es la vía estricta de «lista de
 * objetos» en vez de umbral.
 *
 * Limitación medida y documentada en el propio SDK (`src/actions/AddEffectBloom.js`, comentario de
 * cabecera): aplicado sobre un objeto con regiones alfa, el glow no puede sumar contra el fondo
 * porque el objeto se compone en NORMAL y el bloom en ADD. Se usa `filters.internal` para ceñirse a
 * la caja del objeto y una textura emisiva casi opaca para minimizar el artefacto.
 *
 * §5.2 — umbral 0,35 → 0,5 y mezcla 0,9 → 0,55. Con los valores antiguos el pase difuso se comía
 * también el marco de las ventanas y el borde del disco de farola, y al sumar al 0,9 sobre la propia
 * capa ADD el resultado era un blanco plano de dos o tres edificios (`street_night_fire.png`).
 *
 * Y §5.2 — sólo se bloomiza lo que tiene ESTRUCTURA que difuminar: las capas emisivas derivadas del
 * bake (ventanas y el paño caliente del edificio que arde). `lamp` y `fireGlow` son discos suaves
 * pintados por construcción, sin detalle interior: un pase difuso sobre ellos no puede añadir glow,
 * sólo agrandar el disco ya pintado, y éso es el «halo que satura varios edificios» del encargo. La
 * prueba en el otro sentido es `fallback_canvas_night_fire.png`: esos mismos discos, sin ningún
 * filtro, leen como charcas cálidas. El encargo pide «glow localizado, no halo de distrito», y el
 * glow localizado lo dan las ventanas y el incendio.
 */
const BLOOMED_KINDS = new Set<EmissiveOverlay["kind"]>(["window", "fire"]);

export function applyObjectBloom(
  scene: Phaser.Scene,
  overlays: readonly EmissiveOverlay[],
): { dispose: Disposer; bloomed: number } | null {
  if (!isWebGL(scene)) return null;
  const created: Phaser.Types.Actions.AddEffectBloomReturn[] = [];
  for (const overlay of overlays) {
    if (!overlay.image.active || !BLOOMED_KINDS.has(overlay.kind)) continue;
    const entry = Phaser.Actions.AddEffectBloom(overlay.image, {
      threshold: 0.5,
      blurRadius: 2,
      blurSteps: 3,
      blurQuality: 0,
      blendAmount: 0.55,
      useInternal: true,
    })[0];
    if (entry) created.push(entry);
  }
  return {
    bloomed: created.length,
    dispose: () => {
      for (const entry of created) entry.parallelFilters.destroy();
    },
  };
}

/* ------------------------------------------------------- 7.3 luz dinámica + normales */

export type LightRig = {
  dispose: Disposer;
  readonly lights: number;
  readonly litObjects: number;
};

/** Color de filamento cálido para la farola; la componente azul se recorta a propósito. */
const LAMP_LIGHT_COLOR = 0xffb45e;

export type LampAnchor = { readonly x: number; readonly y: number; readonly depth: number };

/**
 * Luz dinámica de Phaser 4.2.1, con las dos piezas que el motor separa y que en Phaser 3 estaban
 * fundidas en el pipeline `Light2D`:
 *
 * 1. `lights.addLight()` registra un `Light` en el `LightsManager`. ES la que alimenta el shader
 *    difuso (`ApplyLighting.glsl` → `uLights[]` + `uAmbientLightColor`) de los objetos con
 *    `setLighting(true)`. No dibuja nada por sí misma.
 * 2. `lights.addPointLight()` devuelve un GameObject `PointLight` que se rasteriza con su propio
 *    shader de caída radial: es el HALO VISIBLE, no una fuente difusa.
 *
 * §5.2 — el halo NO se usa. Atribución medida en la misma escena, encendiendo `lighting` sobre
 * `fire`: sin rig el filamento de la farola mide RGB (161,153,141) —el disco horneado en ADD— y con
 * `lighting` encima medía (255,255,255) en las TRES farolas, incluso con el radio ya bajado a 12 px y
 * la intensidad a 0,28 (`fx_v2/atribucion/halo_sin_lighting.png` vs `halo_con_pointlight.png`). El
 * `PointLight` es el ÚNICO objeto del rig que se dibuja en el aire —la difusa sólo actúa sobre los
 * objetos con `setLighting(true)`, es decir las fachadas—, así que la bola blanca flotante era suya:
 * recorta a blanco puro por debajo de la caída, no hay radio ni intensidad que lo evite, tapa dos
 * fachadas y encima se confunde con un segundo incendio. Retirado, la misma escena vuelve a ámbar y
 * los píxeles totalmente recortados de la toma pasan de 932 a 51 (`halo_retirado_fire_lighting.png`).
 * La calidez visible de la farola la lleva el disco horneado (`LAMP_GLOW_TEXTURE`, en ADD), que sí
 * escala sin recortar; por eso su alfa nocturno sube de 0,5 a 0,7 en la escena.
 *
 * `setAmbientColor()` multiplica el resultado: con los sprites ya horneados, bajar el ambiente de
 * noche oscurece el bake (que ya venía iluminado) en lugar de volverlo a iluminar. Ese es el punto
 * exacto de fricción que §7.3 pide documentar.
 */
export function applyLighting(
  scene: Phaser.Scene,
  mood: "day" | "night",
  facades: readonly Phaser.GameObjects.Image[],
  lampAnchors: readonly LampAnchor[],
): LightRig | null {
  if (!isWebGL(scene)) return null;
  scene.lights.enable();
  /**
   * De día el ambiente se deja casi blanco para que la prueba sea aditiva: si no, la luz dinámica
   * también resta y el A/B no permite atribuir el cambio a la farola.
   *
   * §5.2 — de noche el ambiente era `0x30384e` (≈0,19·0,22·0,31 sobre el bake) y ésa es la causa
   * directa de «calles demasiado oscuras / fachadas sin detalle»: el multiplicador se comía el paño
   * antes de que ninguna farola llegara. Es LUZ AMBIENTAL, no exposición: actúa sólo sobre los
   * objetos con `setLighting(true)` —las fachadas— y deja el suelo pintado y los props intactos, así
   * que el contraste de la escena sobrevive.
   *
   * Medido sobre el paño de ladrillo del bloque grande (ventana 180×110 auto-localizada en el control
   * diurno, `scripts/fx-presets-sheet-assemble.py` → `phaser_fx_v2_measure.json`), de noche:
   *   sin rig            luma 54,1 · desviación 23,3 · salto entre vecinos 4,83
   *   ambiente 0x7a86a0  luma 30,9 · desviación 13,3 · salto entre vecinos 2,63
   *   ambiente 0x8f97a6  luma 34,2 · desviación 14,1 · salto entre vecinos 2,94
   * El tono se eligió por el canal rojo: `0x7a86a0` era azul luna y restaba justo lo que el ladrillo
   * necesita (0,48 de rojo). Con 0,56 el paño vuelve a leerse sin que la escena entera suba (media
   * 34,2 → 34,6) y sin ni un píxel recortado. La diferencia que queda contra el control sin rig NO es
   * un ajuste pendiente: es el coste de multiplicar un bake que ya venía iluminado, el punto de
   * fricción que §7.3 obliga a documentar. Bajarlo a blanco devolvería el paño al nivel del control y
   * mataría el charco de las farolas, que es lo único que da profundidad a la calle.
   */
  scene.lights.setAmbientColor(mood === "night" ? 0x8f97a6 : 0xdfe3ea);
  /**
   * Radios calibrados contra la separación real de las farolas: 3 celdas con `tileWidth` 64 son
   * ~107 px en pantalla. Con 240/190 los cuatro discos se solapaban más de dos veces y, en mezcla
   * aditiva sobre el bake ya iluminado, la manzana entera saturaba a blanco (medido 2026-11-20 en
   * `street_night_lighting`). Con 150/26 cada farola deja una charca propia y el halo no tapa la
   * fachada; la intensidad difusa sube porque a 0,9 el levantado sobre el horneado no se veía. El
   * halo se deja pequeño porque la escena ya lleva su glow horneado (`LAMP_GLOW_TEXTURE`): dos
   * halos apilados sobre el mismo punto saturan el centro a blanco.
   *
   * §5.2: con el ambiente nocturno ya levantado, la difusa vuelve a bajar de 1,6 a 1,25 y el radio de
   * 150 a 132 para que la SUMA (ambiente + charca + emisivo + bloom) no recorte otra vez a blanco.
   * Es el equilibrio que pide el encargo: se reparte entre las cuatro fuentes en vez de subir una.
   */
  const diffuse = lampAnchors.map((anchor) =>
    scene.lights.addLight(
      anchor.x,
      anchor.y,
      132,
      LAMP_LIGHT_COLOR,
      mood === "night" ? 1.25 : 0.35,
    ),
  );
  for (const facade of facades) facade.setLighting(true);
  return {
    lights: diffuse.length,
    litObjects: facades.length,
    dispose: () => {
      for (const light of diffuse) scene.lights.removeLight(light);
      for (const facade of facades) facade.setLighting(false);
      scene.lights.disable();
      scene.lights.setAmbientColor(0xffffff);
    },
  };
}

/**
 * Canvas que el laboratorio dejó puesto en cada textura. `texture.dataSource[0]` guarda el
 * `TextureSource`, no el canvas: sin este registro no hay forma honesta de volver al estado anterior.
 */
const injectedNormals = new WeakMap<object, HTMLCanvasElement>();

/**
 * Inyecta el mapa de normales en `dataSource[0]`, el slot del que Phaser lee la normal de un objeto
 * iluminado (`SubmitterQuad.setRenderOptions`).
 *
 * `renew=false` es obligatorio: con `renew=true` Phaser destruye el `TextureSource` anterior y
 * devuelve su canvas al `CanvasPool`, pero el batcher sigue guardando la referencia vieja y revienta
 * en `batchTextures` (`batchUnit` sobre `null`) congelando el fotograma. Actualizando el source en
 * sitio el envoltorio GL no cambia de identidad y el A/B plano ↔ derivado no rompe el renderer. Por
 * el mismo motivo el canvas plano se genera al tamaño del sprite: cambiar dimensiones en caliente es
 * otra reasignación de textura.
 */
function putNormal(texture: Phaser.Textures.Texture, canvas: HTMLCanvasElement): void {
  texture.setDataSource(canvas, 0, false, canvas.width, canvas.height);
  injectedNormals.set(texture, canvas);
}

export function attachNormalMaps(
  scene: Phaser.Scene,
  entries: readonly { textureKey: string; normal: HTMLCanvasElement }[],
): Disposer {
  const touched: { texture: Phaser.Textures.Texture; previous: HTMLCanvasElement | null }[] = [];
  for (const entry of entries) {
    if (!scene.textures.exists(entry.textureKey)) continue;
    const texture = scene.textures.get(entry.textureKey) as Phaser.Textures.Texture;
    touched.push({ texture, previous: injectedNormals.get(texture) ?? null });
    putNormal(texture, entry.normal);
  }
  return () => {
    for (const { texture, previous } of touched) {
      if (previous) putNormal(texture, previous);
    }
  };
}

/** Tamaño real del source de una textura, sin depender de frames internos del SDK. */
export function textureSize(
  scene: Phaser.Scene,
  textureKey: string,
): { source: CanvasImageSource; width: number; height: number } | null {
  if (!scene.textures.exists(textureKey)) return null;
  const texture = scene.textures.get(textureKey) as Phaser.Textures.Texture;
  const source = texture.getSourceImage() as
    (HTMLImageElement & HTMLCanvasElement) | HTMLCanvasElement | null | undefined;
  if (!source) return null;
  const width = (source as HTMLImageElement).naturalWidth || source.width;
  const height = (source as HTMLImageElement).naturalHeight || source.height;
  if (!width || !height) return null;
  return { source: source as CanvasImageSource, width, height };
}

/** Deriva el canvas emisivo de una textura ya cargada. Devuelve null si el bake no tiene nada brillante. */
export function buildEmissiveTexture(
  scene: Phaser.Scene,
  textureKey: string,
  emissiveKey: string,
  threshold = 0.72,
  warmOnly = false,
): { key: string; coverage: number; peak: number } | null {
  if (scene.textures.exists(emissiveKey)) return { key: emissiveKey, coverage: 1, peak: 1 };
  const measured = textureSize(scene, textureKey);
  if (!measured) return null;
  const extraction = extractEmissiveLayer(
    measured.source,
    measured.width,
    measured.height,
    threshold,
    0.14,
    warmOnly,
  );
  if (extraction.coverage <= 0.0004)
    return { key: "", coverage: 0, peak: extraction.peakLuminance };
  scene.textures.addCanvas(emissiveKey, extraction.canvas);
  return { key: emissiveKey, coverage: extraction.coverage, peak: extraction.peakLuminance };
}

export { buildNormalMapFromSprite };
